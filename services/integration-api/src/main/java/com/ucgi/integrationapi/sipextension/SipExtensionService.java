package com.ucgi.integrationapi.sipextension;

import com.ucgi.integrationapi.asterisk.AsteriskProvisioningService;
import com.ucgi.integrationapi.error.ResourceConflictException;
import com.ucgi.integrationapi.error.ResourceNotFoundException;
import com.ucgi.integrationapi.user.User;
import com.ucgi.integrationapi.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.context.ApplicationEventPublisher;

@Service
public class SipExtensionService {

    private static final Logger log = LoggerFactory.getLogger(SipExtensionService.class);

    private final SipExtensionRepository sipExtensionRepository;
    private final UserRepository userRepository;
    private final AsteriskProvisioningService provisioningService;
    private final ApplicationEventPublisher events;

    public SipExtensionService(SipExtensionRepository sipExtensionRepository,
                               UserRepository userRepository,
                               AsteriskProvisioningService provisioningService,
                               ApplicationEventPublisher events) {
        this.sipExtensionRepository = sipExtensionRepository;
        this.userRepository = userRepository;
        this.provisioningService = provisioningService;
        this.events = events;
    }

    @Transactional
    public SipExtensionResponse create(SipExtensionCreateRequest request) {
        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "usuario '" + request.username() + "' no existe"));

        if (sipExtensionRepository.existsByExtensionNumber(request.extensionNumber())) {
            throw new ResourceConflictException(
                    "extensionNumber '" + request.extensionNumber() + "' ya está en uso");
        }
        if (sipExtensionRepository.existsByUserId(user.getId())) {
            throw new ResourceConflictException(
                    "el usuario '" + request.username() + "' ya tiene una extensión asignada");
        }

        SipExtension saved = sipExtensionRepository.save(
                new SipExtension(user.getId(), request.extensionNumber(), request.password()));
        // Disparar provisioning Asterisk solo tras commit (evita crear extensión en
        // MikoPBX si la transacción rollback). Ver @TransactionalEventListener abajo.
        String displayName = request.displayName() != null && !request.displayName().isBlank()
                ? request.displayName() : user.getUsername();
        events.publishEvent(new SipExtensionPersistedEvent(
                saved.getExtensionNumber(), displayName, request.password()));
        return SipExtensionResponse.of(saved, user.getUsername());
    }

    /**
     * Listener post-commit: crea la extensión en MikoPBX vía REST (HU-03.8).
     * Si MikoPBX está temporalmente caída, se loggea pero NO se propaga el error
     * al caller — la persistencia en {@code crm.sip_extensions} ya tuvo éxito y
     * la sincronización se reintenta en el próximo trigger.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onPersisted(SipExtensionPersistedEvent event) {
        try {
            AsteriskProvisioningService.ProvisioningResult result =
                    provisioningService.provisionExtension(
                            event.extensionNumber(), event.displayName(), event.sipPassword());
            log.info("Provisioning MikoPBX para ext {}: success={}, intentos={}, mikoPbxId={}",
                    event.extensionNumber(), result.success(), result.attempts(), result.mikoPbxId());
        } catch (RuntimeException ex) {
            log.error("Provisioning MikoPBX falló para ext {} (no se propaga, persistencia OK)",
                    event.extensionNumber(), ex);
        }
    }

    public record SipExtensionPersistedEvent(String extensionNumber, String displayName, String sipPassword) {
    }

    @Transactional(readOnly = true)
    public java.util.List<SipExtensionResponse> list() {
        return sipExtensionRepository.findAll().stream()
                .map(ext -> SipExtensionResponse.of(ext,
                        userRepository.findById(ext.getUserId())
                                .map(User::getUsername).orElse("?")))
                .toList();
    }

    @Transactional
    public SipExtensionResponse update(Long id, SipExtensionUpdateRequest req) {
        SipExtension ext = sipExtensionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Extension SIP no encontrada: " + id));
        if (req.password() != null && !req.password().isBlank()) {
            ext.setSipPassword(req.password());
        }
        if (req.enabled() != null) {
            ext.setEnabled(req.enabled());
        }
        SipExtension saved = sipExtensionRepository.save(ext);
        String username = userRepository.findById(saved.getUserId())
                .map(User::getUsername).orElse("?");
        return SipExtensionResponse.of(saved, username);
    }

    @Transactional
    public void delete(Long id) {
        SipExtension ext = sipExtensionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Extension SIP no encontrada: " + id));
        sipExtensionRepository.delete(ext);
        // Hint a MikoPBX para que limpie. No tenemos mikoPbxId persistido aun
        // (deuda S5); por ahora intentamos por number.
        try {
            provisioningService.deprovisionExtension(ext.getExtensionNumber());
        } catch (RuntimeException ex) {
            log.warn("Deprovisioning best-effort para ext {} falló: {}",
                    ext.getExtensionNumber(), ex.getMessage());
        }
    }

    @Transactional
    public void markManualAttributesApplied(String extensionNumber) {
        sipExtensionRepository.findAllByEnabledTrueOrderByExtensionNumberAsc().stream()
                .filter(e -> extensionNumber.equals(e.getExtensionNumber()))
                .findFirst()
                .ifPresent(e -> {
                    e.setManualAttributesApplied(true);
                    sipExtensionRepository.save(e);
                });
    }
}
