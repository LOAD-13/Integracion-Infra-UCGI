package com.ucgi.integrationapi.auth;

import com.ucgi.integrationapi.error.ResourceNotFoundException;
import com.ucgi.integrationapi.user.User;
import com.ucgi.integrationapi.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Servicio de autenticación.
 *
 * <p>Fase actual (HU-03.5): valida {@code username + password} contra
 * {@code crm.users.password_hash} (bcrypt). Emite JWT propio firmado con
 * {@code jwt.secret}.
 *
 * <p>TODO HU-05.x: añadir camino "delegar a midPoint" — si midPoint REST
 * responde, validar ahí; si no, fallback a la verificación local. La firma
 * pública del método no cambiará.
 */
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public LoginResult login(String username, String password) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadCredentialsException("Credenciales inválidas"));
        if (user.getPasswordHash() == null
                || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BadCredentialsException("Credenciales inválidas");
        }
        String token = jwtService.issue(user.getUsername(), user.getRole());
        return new LoginResult(token, "Bearer", jwtService.expirationSeconds(),
                user.getUsername(), user.getRole(), user.isMustChangePassword());
    }

    public record LoginResult(String accessToken, String tokenType, long expiresIn,
                              String username, String role, boolean mustChangePassword) {
    }

    public static class BadCredentialsException extends RuntimeException {
        public BadCredentialsException(String message) {
            super(message);
        }
    }
}
