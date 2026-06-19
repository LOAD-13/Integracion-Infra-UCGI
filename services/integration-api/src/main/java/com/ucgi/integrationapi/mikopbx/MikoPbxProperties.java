package com.ucgi.integrationapi.mikopbx;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuración de la integración con la REST API de MikoPBX.
 *
 * <p>La auth es vía Bearer JWT obtenido con login+password contra
 * {@code POST /pbxcore/api/v3/auth:login}. El JWT vive 15 min; el cliente
 * mantiene la caché y refresca antes de expirar.
 *
 * <p>La API key persistente generada en la GUI ({@code MIKOPBX_API_KEY}) se
 * conserva en el {@code .env} pero no se usa en este cliente — el header
 * Bearer raw no la acepta sin un wrapper específico que MikoPBX no documenta
 * públicamente. Si en HU-07.x se necesita auth sin contraseña humana, se
 * migra a API key en ese momento.
 */
@ConfigurationProperties("mikopbx")
public record MikoPbxProperties(String host, int port, String adminUser, String adminPassword,
                                int connectTimeoutMs, int readTimeoutMs, Retry retry) {

    public MikoPbxProperties {
        if (host == null || host.isBlank()) host = "mikopbx";
        if (port <= 0) port = 80;
        if (adminUser == null || adminUser.isBlank()) adminUser = "admin";
        if (adminPassword == null) adminPassword = "admin";
        if (connectTimeoutMs <= 0) connectTimeoutMs = 3000;
        if (readTimeoutMs <= 0) readTimeoutMs = 5000;
        if (retry == null) retry = new Retry(3, 200, 2.0);
    }

    public String baseUrl() {
        return "http://" + host + ":" + port;
    }

    public record Retry(int maxAttempts, long initialBackoffMs, double backoffMultiplier) {
    }
}
