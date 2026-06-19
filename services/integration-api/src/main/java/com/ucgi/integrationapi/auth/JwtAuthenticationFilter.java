package com.ucgi.integrationapi.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Filtro que extrae el Bearer JWT del header {@code Authorization}, valida la
 * firma + issuer + expiración con {@link JwtService}, y popula el
 * {@link SecurityContextHolder} con un {@link UsernamePasswordAuthenticationToken}
 * cuya authority es {@code ROLE_<role>} (ej. {@code ROLE_ADMIN}, {@code ROLE_AGENTE}).
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String AUTH_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader(AUTH_HEADER);
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            String token = header.substring(BEARER_PREFIX.length()).trim();
            try {
                JwtService.ParsedToken parsed = jwtService.parse(token);
                var auth = new UsernamePasswordAuthenticationToken(
                        parsed.username(), null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + parsed.role())));
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (JwtService.InvalidJwtException ignored) {
                // Token mal formado/expirado/firma inválida: dejamos el SecurityContext
                // vacío y que SecurityConfig + AuthenticationEntryPoint manejen el 401.
            }
        }
        chain.doFilter(request, response);
    }
}
