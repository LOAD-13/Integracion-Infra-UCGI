package com.ucgi.integrationapi.asterisk;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuración de la integración con Asterisk (AMI + path de pjsip-dynamic.conf).
 * Valores bindean desde {@code application.yml} bajo {@code asterisk.*} y
 * pueden sobreescribirse con env vars (ej. {@code ASTERISK_AMI_HOST}).
 */
@ConfigurationProperties("asterisk")
public record AsteriskProperties(Ami ami, String configPath, Reload reload) {

    public AsteriskProperties {
        if (ami == null) ami = new Ami("asterisk", 5038, "ucgi-ami", "changeme-ami", 5000);
        if (configPath == null || configPath.isBlank()) configPath = "/etc/asterisk/dynamic.d/pjsip.conf";
        if (reload == null) reload = new Reload(3, 200, 2.0);
    }

    public record Ami(String host, int port, String user, String secret, int timeoutMs) {
    }

    public record Reload(int maxAttempts, long initialBackoffMs, double backoffMultiplier) {
    }
}
