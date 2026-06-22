package com.ucgi.integrationapi.mikopbx;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Cliente HTTP de la REST API de MikoPBX (v3).
 *
 * <p>Mecanismo:
 * <ol>
 *   <li>{@code POST /pbxcore/api/v3/auth:login} con login+password → JWT (15 min).</li>
 *   <li>JWT cacheado en memoria; se refresca si quedan &lt; 60 s.</li>
 *   <li>Cada operación de negocio añade {@code Authorization: Bearer {jwt}}.</li>
 * </ol>
 *
 * <p>Convención del namespace: {@code /v3/employees} para crear/eliminar
 * porque {@code /v3/extensions} es read-only por diseño en MikoPBX. Un Employee
 * encapsula User + Extension + SIP secret en una sola operación.
 */
@Component
public class MikoPbxRestClient {

    private static final Logger log = LoggerFactory.getLogger(MikoPbxRestClient.class);

    private final MikoPbxProperties properties;
    private final HttpClient http;
    private final ObjectMapper mapper = new ObjectMapper();

    // Caché del JWT (en memoria, single-instance — suficiente para integration-api)
    private volatile String cachedToken;
    private volatile Instant cachedExpiresAt = Instant.EPOCH;

    @Autowired
    public MikoPbxRestClient(MikoPbxProperties properties) {
        this(properties, defaultHttp(properties));
    }

    /** Constructor para tests: permite inyectar un HttpClient configurado contra WireMock. */
    public MikoPbxRestClient(MikoPbxProperties properties, HttpClient http) {
        this.properties = properties;
        this.http = http;
    }

    public CreatedEmployee createEmployee(String number, String displayName, String sipSecret) {
        Map<String, Object> body = new HashMap<>();
        body.put("number", number);
        body.put("user_username", displayName != null && !displayName.isBlank()
                ? displayName : "User-" + number);
        body.put("sip_secret", sipSecret);

        JsonNode resp = postJson("/pbxcore/api/v3/employees", body);
        JsonNode data = resp.path("data");
        if (!resp.path("result").asBoolean(false) || data.isMissingNode()) {
            throw new MikoPbxException("Crear employee falló: " + resp);
        }
        String id = data.path("id").asText();
        String confirmedNumber = data.path("number").asText(number);
        return new CreatedEmployee(id, confirmedNumber);
    }

    public void deleteEmployee(String id) {
        JsonNode resp = sendJson("DELETE", "/pbxcore/api/v3/employees/" + id, null);
        if (!resp.path("result").asBoolean(false)) {
            throw new MikoPbxException("Eliminar employee " + id + " falló: " + resp);
        }
    }

    /**
     * Devuelve los números de extensión ya conocidos por MikoPBX (read-only).
     * Útil para idempotencia del bootstrap de provisión: crear solo las que faltan.
     */
    public List<String> listExtensionNumbers() {
        JsonNode resp = sendJson("GET", "/pbxcore/api/v3/extensions", null);
        if (!resp.path("result").asBoolean(false)) {
            throw new MikoPbxException("Listar extensions falló: " + resp);
        }
        JsonNode data = resp.path("data");
        List<String> numbers = new ArrayList<>();
        if (data.isArray()) {
            data.forEach(node -> {
                String n = node.path("number").asText("");
                if (!n.isBlank()) numbers.add(n);
            });
        }
        return numbers;
    }

    /** Sanity check rápido (no requiere auth — endpoint público de MikoPBX). */
    public boolean ping() {
        URI uri = URI.create(properties.baseUrl() + "/pbxcore/api/system/ping");
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(uri)
                    .timeout(Duration.ofMillis(properties.readTimeoutMs()))
                    .GET()
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            return resp.statusCode() == 200 && resp.body().contains("PONG");
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.debug("ping a {} falló: {}", uri, e.toString());
            return false;
        }
    }

    // ---------- internals ----------

    private JsonNode postJson(String path, Map<String, Object> body) {
        return sendJson("POST", path, body);
    }

    private JsonNode sendJson(String method, String path, Map<String, Object> body) {
        URI uri = URI.create(properties.baseUrl() + path);
        try {
            String token = getValidToken();
            HttpRequest.Builder b = HttpRequest.newBuilder()
                    .uri(uri)
                    .timeout(Duration.ofMillis(properties.readTimeoutMs()))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + token);
            HttpRequest.BodyPublisher pub = body == null
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body));
            HttpRequest req = b.method(method, pub).build();
            log.debug("MikoPBX {} {} (body={} bytes)", method, uri,
                    body == null ? 0 : mapper.writeValueAsString(body).length());
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            log.debug("MikoPBX {} {} → {}", method, uri, resp.statusCode());
            if (resp.statusCode() >= 500) {
                throw new MikoPbxException("MikoPBX " + method + " " + path
                        + " → " + resp.statusCode() + ": " + truncate(resp.body()), resp.statusCode());
            }
            return mapper.readTree(resp.body());
        } catch (IOException e) {
            throw new MikoPbxException("IO error en " + method + " " + uri + ": "
                    + rootMessage(e), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new MikoPbxException(method + " " + path + " interrumpido", e);
        }
    }

    /** Devuelve un JWT válido. Refresca si quedan menos de 60s. */
    String getValidToken() {
        if (cachedToken == null || Instant.now().isAfter(cachedExpiresAt.minusSeconds(60))) {
            synchronized (this) {
                if (cachedToken == null || Instant.now().isAfter(cachedExpiresAt.minusSeconds(60))) {
                    refreshToken();
                }
            }
        }
        return cachedToken;
    }

    private void refreshToken() {
        URI uri = URI.create(properties.baseUrl() + "/pbxcore/api/v3/auth:login");
        try {
            Map<String, Object> body = Map.of(
                    "login", properties.adminUser(),
                    "password", properties.adminPassword());
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(uri)
                    .timeout(Duration.ofMillis(properties.readTimeoutMs()))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                    .build();
            log.debug("MikoPBX auth:login → POST {}", uri);
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                throw new MikoPbxException("Login MikoPBX → HTTP " + resp.statusCode()
                        + " body=" + truncate(resp.body()), resp.statusCode());
            }
            JsonNode tree = mapper.readTree(resp.body()).path("data");
            String token = tree.path("accessToken").asText();
            long ttl = tree.path("expiresIn").asLong(900);
            if (token.isEmpty()) throw new MikoPbxException("Login MikoPBX sin accessToken");
            this.cachedToken = token;
            this.cachedExpiresAt = Instant.now().plusSeconds(ttl);
            log.debug("MikoPBX JWT refrescado, expira en {}s", ttl);
        } catch (IOException e) {
            throw new MikoPbxException("Login MikoPBX falló (IO) " + uri + ": " + rootMessage(e), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new MikoPbxException("Login MikoPBX interrumpido", e);
        }
    }

    private static String truncate(String s) {
        return s != null && s.length() > 200 ? s.substring(0, 200) + "..." : String.valueOf(s);
    }

    private static String rootMessage(Throwable t) {
        Throwable root = t;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        return root.getClass().getSimpleName() + ": " + root.getMessage();
    }

    private static HttpClient defaultHttp(MikoPbxProperties props) {
        // Apuntamos directo a https://mikopbx:443 (ver MikoPbxProperties.baseUrl).
        // NO seguimos redirects (Redirect.NEVER) — el HttpClient de Java no
        // reenvía body en 301/302 (solo en 307/308 según RFC 7231 §6.4.2) y eso
        // rompió la primera implementación. Yendo directo a HTTPS no hay redirect.
        //
        // Hostname verification: MikoPBX genera su cert autofirmado con SAN =
        // hostname del container en el primer boot. Si después cambia el
        // hostname o se accede por otro alias (ej. `mikopbx` vs `mikopbx.local`),
        // la verificación de SAN falla con `No subject alternative DNS name
        // matching X found`. Como esto es tráfico interno docker y el cert es
        // autofirmado de todas formas, desactivamos también el endpoint
        // identification dentro del cliente.
        javax.net.ssl.SSLParameters sslParams = new javax.net.ssl.SSLParameters();
        sslParams.setEndpointIdentificationAlgorithm(null);
        return HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(props.connectTimeoutMs()))
                .version(HttpClient.Version.HTTP_1_1)
                .followRedirects(HttpClient.Redirect.NEVER)
                .sslContext(insecureSslContext())
                .sslParameters(sslParams)
                .build();
    }

    /**
     * SSLContext que confía en cualquier certificado — necesario porque MikoPBX
     * expone HTTPS con cert autofirmado solo accesible dentro de la red docker
     * interna (no expuesto al mundo).
     */
    private static javax.net.ssl.SSLContext insecureSslContext() {
        try {
            javax.net.ssl.SSLContext sc = javax.net.ssl.SSLContext.getInstance("TLS");
            sc.init(null, new javax.net.ssl.TrustManager[]{
                    new javax.net.ssl.X509TrustManager() {
                        public void checkClientTrusted(java.security.cert.X509Certificate[] c, String a) {}
                        public void checkServerTrusted(java.security.cert.X509Certificate[] c, String a) {}
                        public java.security.cert.X509Certificate[] getAcceptedIssuers() {
                            return new java.security.cert.X509Certificate[0];
                        }
                    }
            }, new java.security.SecureRandom());
            return sc;
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo configurar SSLContext insecure", e);
        }
    }

    public record CreatedEmployee(String id, String number) {
    }
}
