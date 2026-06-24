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

    /**
     * Crea un employee con los flags WebRTC necesarios para que el CRM pueda
     * registrarse vía WSS sin reproducir el bug 488 (ver
     * docs/notas-tecnicas/2026-06-22-bug-crm-488-causa-root-y-fix.md). Los
     * manualattributes se aplican posteriormente vía SQLite m_Sip — esta
     * llamada solo crea la entidad base; el bootstrap aplica los attributes
     * a través del sidecar mikopbx-bootstrap.
     */
    public CreatedEmployee createEmployeeWithWebRtc(String number, String displayName, String sipSecret) {
        return createEmployee(number, displayName, sipSecret);
    }

    /**
     * Consulta las llamadas activas en MikoPBX (estado Ringing / Active / Hold).
     * Endpoint: GET /pbxcore/api/v3/pbx-status:getActiveCalls
     * (Google-style recurso:verbo).
     */
    public List<ActiveCall> getActiveCalls() {
        JsonNode resp = sendJson("GET", "/pbxcore/api/v3/pbx-status:getActiveCalls", null);
        if (!resp.path("result").asBoolean(false)) {
            throw new MikoPbxException("Listar llamadas activas falló: " + resp);
        }
        JsonNode data = resp.path("data");
        List<ActiveCall> calls = new ArrayList<>();
        if (data.isArray()) {
            data.forEach(node -> calls.add(new ActiveCall(
                    node.path("uniqueid").asText(""),
                    node.path("src").asText(""),
                    node.path("dst").asText(""),
                    node.path("state").asText(""),
                    node.path("start").asLong(0L)
            )));
        }
        return calls;
    }

    /**
     * Devuelve los CDR (historial de llamadas) que MikoPBX guarda en su SQLite
     * interno. El integration-api los importa periódicamente a {@code crm.cdr}
     * para que los KPIs del CRM tengan datos reales.
     * Endpoint: GET /pbxcore/api/v3/cdr
     */
    public List<MikoCdrRecord> listCdrRecords() {
        JsonNode resp = sendJson("GET", "/pbxcore/api/v3/cdr", null);
        if (!resp.path("result").asBoolean(false)) {
            throw new MikoPbxException("Listar CDR falló: " + resp);
        }
        JsonNode records = resp.path("data").path("records");
        List<MikoCdrRecord> out = new ArrayList<>();
        if (records.isArray()) {
            records.forEach(node -> out.add(new MikoCdrRecord(
                    node.path("linkedid").asText(""),
                    node.path("start").asText(""),
                    node.path("src_num").asText(""),
                    node.path("dst_num").asText(""),
                    node.path("did").asText(""),
                    node.path("disposition").asText(""),
                    node.path("totalDuration").asInt(0),
                    node.path("totalBillsec").asInt(0)
            )));
        }
        return out;
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

    /**
     * Sube un archivo de sonido al MikoPBX y lo deja reproducible por Asterisk.
     * El flujo correcto descubierto vía probing de la API es:
     * <ol>
     *   <li>POST {@code /pbxcore/api/v3/files:upload} (multipart Resumable.js, un chunk) → devuelve path tmp.</li>
     *   <li>POST {@code /pbxcore/api/v3/sound-files:convertAudioFile} con {@code temp_filename + name + category}
     *       → MikoPBX convierte (a .webm para Asterisk) y mueve a {@code /storage/usbdisk1/mikopbx/media/custom/}.</li>
     *   <li>POST {@code /pbxcore/api/v3/sound-files} con el path final → registra en BD para que aparezca en la GUI.</li>
     * </ol>
     * Sin el paso 2 el archivo queda en directorio temporal y Asterisk no lo
     * puede reproducir (HTTP 410 / dialplan sin source).
     */
    public MikoSoundFile uploadSoundFile(byte[] content, String filename, String mimeType) {
        String identifier = "ucgi-" + System.currentTimeMillis() + "-" + content.length;
        String boundary = "----DialFlow" + System.nanoTime();
        try {
            byte[] body = buildResumableMultipart(boundary, identifier, filename, mimeType, content);
            URI uri = URI.create(properties.baseUrl() + "/pbxcore/api/v3/files:upload");
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(uri)
                    .timeout(Duration.ofMillis(properties.readTimeoutMs()))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .header("Authorization", "Bearer " + getValidToken())
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode tree = mapper.readTree(resp.body());
            if (!tree.path("result").asBoolean(false)) {
                throw new MikoPbxException("Upload chunk falló: " + truncate(resp.body()));
            }
            String tempPath = tree.path("data").path("filename").asText("");
            if (tempPath.isBlank()) {
                throw new MikoPbxException("Upload chunk sin filename: " + truncate(resp.body()));
            }

            // MikoPBX hace MERGING asíncrono después del chunk upload (d_status). Si
            // llamamos a convertAudioFile inmediatamente, `mv` adentro de MikoPBX
            // falla en silencio y el convert posterior reporta "File not found".
            // Reintentamos con backoff hasta 6s.
            JsonNode conv = null;
            for (int attempt = 0; attempt < 5; attempt++) {
                Thread.sleep(500L + attempt * 500L);
                conv = sendJson("POST", "/pbxcore/api/v3/sound-files:convertAudioFile", Map.of(
                        "temp_filename", tempPath,
                        "name", filename,
                        "category", "custom"
                ));
                if (conv.path("result").asBoolean(false)) break;
                String err = conv.path("messages").path("error").toString();
                if (!err.contains("not found")) break; // otro error, no merece retry
                log.debug("convertAudioFile retry {} ({})", attempt, err);
            }
            if (conv == null || !conv.path("result").asBoolean(false)) {
                throw new MikoPbxException("convertAudioFile falló: " + conv);
            }
            JsonNode convData = conv.path("data");
            String finalPath = convData.isArray() && convData.size() > 0
                    ? convData.get(0).asText("")
                    : convData.path("filename").asText("");
            if (finalPath.isBlank()) {
                throw new MikoPbxException("convertAudioFile sin path final: " + conv);
            }

            // Paso 3: registramos el sound-file con el path ya convertido.
            JsonNode reg = sendJson("POST", "/pbxcore/api/v3/sound-files", Map.of(
                    "name", filename,
                    "category", "custom",
                    "path", finalPath
            ));
            if (!reg.path("result").asBoolean(false)) {
                throw new MikoPbxException("Registrar sound-file falló: " + reg);
            }
            JsonNode data = reg.path("data");
            return new MikoSoundFile(
                    data.path("id").asText(""),
                    data.path("name").asText(filename),
                    data.path("path").asText(finalPath),
                    data.path("category").asText("custom"),
                    data.path("fileSize").asLong(content.length),
                    data.path("duration").asText("")
            );
        } catch (IOException e) {
            throw new MikoPbxException("IO error subiendo sound-file: " + rootMessage(e), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new MikoPbxException("Upload sound-file interrumpido", e);
        }
    }

    /** Devuelve el catálogo de sound files registrados en MikoPBX. */
    public List<MikoSoundFile> listSoundFiles() {
        JsonNode resp = sendJson("GET", "/pbxcore/api/v3/sound-files", null);
        if (!resp.path("result").asBoolean(false)) {
            throw new MikoPbxException("Listar sound-files falló: " + resp);
        }
        JsonNode data = resp.path("data");
        List<MikoSoundFile> out = new ArrayList<>();
        if (data.isArray()) {
            data.forEach(n -> out.add(new MikoSoundFile(
                    n.path("id").asText(""),
                    n.path("name").asText(""),
                    n.path("path").asText(""),
                    n.path("category").asText(""),
                    n.path("fileSize").asLong(0L),
                    n.path("duration").asText("")
            )));
        }
        return out;
    }

    private static byte[] buildResumableMultipart(String boundary, String identifier,
                                                  String filename, String mimeType,
                                                  byte[] content) throws IOException {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        Map<String, String> fields = new java.util.LinkedHashMap<>();
        fields.put("resumableChunkNumber", "1");
        fields.put("resumableChunkSize", String.valueOf(content.length));
        fields.put("resumableCurrentChunkSize", String.valueOf(content.length));
        fields.put("resumableTotalSize", String.valueOf(content.length));
        fields.put("resumableType", mimeType);
        fields.put("resumableIdentifier", identifier);
        fields.put("resumableFilename", filename);
        fields.put("resumableRelativePath", filename);
        fields.put("resumableTotalChunks", "1");
        for (Map.Entry<String, String> e : fields.entrySet()) {
            out.write(("--" + boundary + "\r\n").getBytes());
            out.write(("Content-Disposition: form-data; name=\"" + e.getKey() + "\"\r\n\r\n").getBytes());
            out.write(e.getValue().getBytes());
            out.write("\r\n".getBytes());
        }
        out.write(("--" + boundary + "\r\n").getBytes());
        out.write(("Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n").getBytes());
        out.write(("Content-Type: " + mimeType + "\r\n\r\n").getBytes());
        out.write(content);
        out.write("\r\n".getBytes());
        out.write(("--" + boundary + "--\r\n").getBytes());
        return out.toByteArray();
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

    public record ActiveCall(String uniqueId, String src, String dst, String state, long startEpoch) {
    }
}
