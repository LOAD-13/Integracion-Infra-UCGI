package com.ucgi.integrationapi.me;

import com.ucgi.integrationapi.cdr.Cdr;
import com.ucgi.integrationapi.cdr.CdrRepository;
import com.ucgi.integrationapi.cdr.CdrSpecifications;
import com.ucgi.integrationapi.client.Client;
import com.ucgi.integrationapi.client.ClientRepository;
import com.ucgi.integrationapi.error.ResourceNotFoundException;
import com.ucgi.integrationapi.sipextension.SipExtension;
import com.ucgi.integrationapi.sipextension.SipExtensionRepository;
import com.ucgi.integrationapi.user.User;
import com.ucgi.integrationapi.user.UserRepository;
import com.ucgi.integrationapi.user.UserService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    private final CdrRepository cdrRepository;
    private final ClientRepository clientRepository;
    private final UserService userService;

    public MeController(UserRepository userRepository,
                        SipExtensionRepository sipExtensionRepository,
                        CdrRepository cdrRepository,
                        ClientRepository clientRepository,
                        UserService userService) {
        this.userRepository = userRepository;
        this.sipExtensionRepository = sipExtensionRepository;
        this.cdrRepository = cdrRepository;
        this.clientRepository = clientRepository;
        this.userService = userService;
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

    @GetMapping("/status")
    public ResponseEntity<AgentStatusResponse> getStatus(Authentication auth) {
        User user = userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuario no encontrado: " + auth.getName()));
        return ResponseEntity.ok(AgentStatusResponse.from(user));
    }

    @PatchMapping("/status")
    @Transactional
    public ResponseEntity<AgentStatusResponse> setStatus(Authentication auth,
                                                         @Valid @RequestBody AgentStatusRequest req) {
        User user = userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuario no encontrado: " + auth.getName()));
        user.updateAgentStatus(req.status());
        userRepository.save(user);
        return ResponseEntity.ok(AgentStatusResponse.from(user));
    }

    @org.springframework.web.bind.annotation.PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(Authentication auth,
                                               @Valid @RequestBody ChangePasswordRequest req) {
        userService.changeOwnPassword(auth.getName(), req.currentPassword(), req.newPassword());
        return ResponseEntity.noContent().build();
    }

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 8, max = 128) String newPassword
    ) {
    }

    /**
     * Últimas 5 actividades del agente autenticado para el dashboard.
     * Hoy expone CDRs reales; cuando aparezcan notas/videollamadas separadas
     * se unen acá en el mismo orden cronológico.
     */
    @GetMapping("/recent-activity")
    @Transactional(readOnly = true)
    public ResponseEntity<List<RecentActivityResponse>> recentActivity(Authentication auth) {
        User user = userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuario no encontrado: " + auth.getName()));

        var pageable = PageRequest.of(0, 5,
                Sort.by(Sort.Direction.DESC, "startTime"));
        var page = cdrRepository.findAll(
                CdrSpecifications.agentIs(user.getId()), pageable);

        List<Long> clientIds = page.getContent().stream()
                .map(Cdr::getClientId).filter(java.util.Objects::nonNull).toList();
        Map<Long, String> clientNames = new HashMap<>();
        if (!clientIds.isEmpty()) {
            for (Client c : clientRepository.findAllById(clientIds)) {
                clientNames.put(c.getId(), c.getName());
            }
        }

        ZoneId zone = ZoneId.systemDefault();
        List<RecentActivityResponse> out = new ArrayList<>();
        for (Cdr cdr : page.getContent()) {
            String contact = cdr.getClientId() != null
                    ? clientNames.getOrDefault(cdr.getClientId(), cdr.getCallerNumber())
                    : cdr.getCallerNumber();
            String title = switch (cdr.getDirection()) {
                case INBOUND -> "Llamada entrante";
                case OUTBOUND -> "Llamada saliente";
                case INTERNAL -> "Llamada interna";
            };
            String outcome = switch (cdr.getDisposition()) {
                case ANSWERED -> "atendida";
                case NO_ANSWER -> "no contestó";
                case BUSY -> "ocupado";
                case FAILED -> "falló";
            };
            String subtitle = contact + " · " + outcome;
            int sec = cdr.getDurationSeconds();
            String meta = sec > 0
                    ? String.format("%d:%02d", sec / 60, sec % 60)
                    : "";
            var occurred = cdr.getStartTime().atZone(zone).toInstant();
            out.add(new RecentActivityResponse(
                    "CALL", title, subtitle, meta, occurred));
        }
        return ResponseEntity.ok(out);
    }
}
