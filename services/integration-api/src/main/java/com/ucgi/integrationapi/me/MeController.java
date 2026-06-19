package com.ucgi.integrationapi.me;

import com.ucgi.integrationapi.error.ResourceNotFoundException;
import com.ucgi.integrationapi.sipextension.SipExtension;
import com.ucgi.integrationapi.sipextension.SipExtensionRepository;
import com.ucgi.integrationapi.user.User;
import com.ucgi.integrationapi.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints sobre el usuario autenticado. Resuelve el {@code Authentication}
 * que pobló {@code JwtAuthenticationFilter} a entidades del dominio.
 */
@RestController
@RequestMapping("/api/v1/me")
public class MeController {

    private final UserRepository userRepository;
    private final SipExtensionRepository sipExtensionRepository;

    public MeController(UserRepository userRepository,
                        SipExtensionRepository sipExtensionRepository) {
        this.userRepository = userRepository;
        this.sipExtensionRepository = sipExtensionRepository;
    }

    @GetMapping("/sip-credentials")
    public ResponseEntity<SipCredentialsResponse> sipCredentials(Authentication auth) {
        String username = auth.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuario no encontrado: " + username));
        SipExtension ext = sipExtensionRepository.findByUserId(user.getId())
                .filter(SipExtension::isEnabled)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "El usuario " + username + " no tiene una extensión SIP habilitada"));
        return ResponseEntity.ok(new SipCredentialsResponse(
                ext.getExtensionNumber(),
                user.getFullName(),
                ext.getSipPassword()));
    }
}
