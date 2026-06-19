package com.ucgi.integrationapi.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private final JwtProperties props = new JwtProperties(
            "test-secret-min-32-chars-long-please-1234", 60, "ucgi-integration-api");
    private final JwtService svc = new JwtService(props);

    @Test
    void issueAndParse_roundTrip_keepsUsernameAndRole() {
        String token = svc.issue("admin", "ADMIN");

        JwtService.ParsedToken parsed = svc.parse(token);

        assertThat(parsed.username()).isEqualTo("admin");
        assertThat(parsed.role()).isEqualTo("ADMIN");
    }

    @Test
    void parse_rejectsTokenSignedWithOtherKey() {
        String otherToken = Jwts.builder()
                .subject("admin")
                .claim("role", "ADMIN")
                .issuer("ucgi-integration-api")
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor("OTHER-secret-min-32-chars-XXXXXXXXXX".getBytes(StandardCharsets.UTF_8)),
                        Jwts.SIG.HS256)
                .compact();

        assertThatThrownBy(() -> svc.parse(otherToken))
                .isInstanceOf(JwtService.InvalidJwtException.class);
    }

    @Test
    void parse_rejectsTokenWithWrongIssuer() {
        String token = Jwts.builder()
                .subject("admin")
                .claim("role", "ADMIN")
                .issuer("not-ucgi")
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(props.secret().getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();

        assertThatThrownBy(() -> svc.parse(token))
                .isInstanceOf(JwtService.InvalidJwtException.class);
    }

    @Test
    void parse_rejectsExpiredToken() {
        String expired = Jwts.builder()
                .subject("admin")
                .claim("role", "ADMIN")
                .issuer("ucgi-integration-api")
                .expiration(new Date(System.currentTimeMillis() - 5_000))
                .signWith(Keys.hmacShaKeyFor(props.secret().getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();

        assertThatThrownBy(() -> svc.parse(expired))
                .isInstanceOf(JwtService.InvalidJwtException.class);
    }

    @Test
    void expirationSeconds_matchesConfiguredMinutes() {
        assertThat(svc.expirationSeconds()).isEqualTo(Duration.ofMinutes(60).toSeconds());
    }

    @Test
    void jwtProperties_rejectsShortSecret() {
        assertThatThrownBy(() -> new JwtProperties("short", 60, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("32");
    }
}
