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
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 * <p>Convención del namespace: usamos {@code /v3/employees} para crear/eliminar
 * porque {@code /v3/extensions} es read-only por diseño en MikoPBX. Un Employee
 * encapsula User + Extension + SIP.
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

    /** Sanity check rápido (no requiere auth — endpoint público de MikoPBX). */
    public boolean ping() {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(properties.baseUrl() + "/pbxcore/api/system/ping"))
                    .timeout(Duration.ofMillis(properties.readTimeoutMs()))
                    .GET()
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            return resp.statusCode() == 200 && resp.body().contains("PONG");
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            return false;
        }
    }

    // ---------- internals ----------

    private JsonNode postJson(String path, Map<String, Object> body) {
        return sendJson("POST", path, body);
    }

    private JsonNode sendJson(String method, String path, Map<String, Object> body) {
        try {
            String token = getValidToken();
            HttpRequest.Builder b = HttpRequest.newBuilder()
                    .uri(URI.create(properties.baseUrl() + path))
                    .timeout(Duration.ofMillis(properties.readTimeoutMs()))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + token);
            HttpRequest.BodyPublisher pub = body == null
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body));
            HttpRequest req = b.method(method, pub).build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() >= 500) {
                throw new MikoPbxException("MikoPBX " + method + " " + path
                        + " → " + resp.statusCode() + ": " + truncate(resp.body()), resp.statusCode());
            }
            return mapper.readTree(resp.body());
        } catch (IOException e) {
            throw new MikoPbxException("IO error en " + method + " " + path, e);
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
        try {
            Map<String, Object> body = Map.of(
                    "login", properties.adminUser(),
                    "password", properties.adminPassword());
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(properties.baseUrl() + "/pbxcore/api/v3/auth:login"))
                    .timeout(Duration.ofMillis(properties.readTimeoutMs()))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                throw new MikoPbxException("Login MikoPBX falló: " + resp.statusCode()
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
            throw new MikoPbxException("Login MikoPBX falló (IO)", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new MikoPbxException("Login MikoPBX interrumpido", e);
        }
    }

    private static String truncate(String s) {
        return s != null && s.length() > 200 ? s.substring(0, 200) + "..." : String.valueOf(s);
    }

    private static HttpClient defaultHttp(MikoPbxProperties props) {
        return HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(props.connectTimeoutMs()))
                .version(HttpClient.Version.HTTP_1_1)
                .build();
    }

    public record CreatedEmployee(String id, String number) {
    }
}
