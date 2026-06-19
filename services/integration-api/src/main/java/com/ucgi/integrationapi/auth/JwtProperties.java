package com.ucgi.integrationapi.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("jwt")
public record JwtProperties(String secret, int expirationMinutes, String issuer) {

    public JwtProperties {
        if (secret == null || secret.length() < 32) {
            throw new IllegalArgumentException("jwt.secret debe tener ≥ 32 caracteres");
        }
        if (expirationMinutes <= 0) expirationMinutes = 60;
        if (issuer == null || issuer.isBlank()) issuer = "ucgi-integration-api";
    }
}
