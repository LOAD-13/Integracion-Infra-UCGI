package com.ucgi.integrationapi.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

/**
 * Firma y valida JWT HS256 emitidos por integration-api.
 *
 * <p>Payload mínimo: {@code sub} (username), {@code role} (ADMIN o AGENTE),
 * {@code iss} = ucgi-integration-api. TTL configurable, default 60 min.
 */
@Service
public class JwtService {

    private final SecretKey signingKey;
    private final JwtProperties props;

    public JwtService(JwtProperties props) {
        this.props = props;
        this.signingKey = Keys.hmacShaKeyFor(props.secret().getBytes(StandardCharsets.UTF_8));
    }

    public String issue(String username, String role) {
        Instant now = Instant.now();
        Instant exp = now.plus(Duration.ofMinutes(props.expirationMinutes()));
        return Jwts.builder()
                .subject(username)
                .claim("role", role)
                .issuer(props.issuer())
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    public long expirationSeconds() {
        return Duration.ofMinutes(props.expirationMinutes()).toSeconds();
    }

    public ParsedToken parse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .requireIssuer(props.issuer())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return new ParsedToken(claims.getSubject(), claims.get("role", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            throw new InvalidJwtException("Token inválido: " + e.getMessage(), e);
        }
    }

    public record ParsedToken(String username, String role) {
    }

    public static class InvalidJwtException extends RuntimeException {
        public InvalidJwtException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
