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
        // Disparar provisioning Asterisk solo tras commit (evita reload con datos no persistidos).
        events.publishEvent(new SipExtensionPersistedEvent(saved.getExtensionNumber()));
        return SipExtensionResponse.of(saved, user.getUsername());
    }

    /**
     * Listener post-commit: regenera pjsip-dynamic.conf y dispara pjsip reload vía AMI.
     * Si AMI falla tras los reintentos, se loggea pero NO se propaga error al caller —
     * la persistencia ya tuvo éxito y el reload se reintentará en el próximo trigger.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onPersisted(SipExtensionPersistedEvent event) {
        try {
            AsteriskProvisioningService.ProvisioningResult result = provisioningService.provision();
            log.info("Provisioning Asterisk para ext {}: reloaded={}, intentos={}",
                    event.extensionNumber(), result.reloaded(), result.attempts());
        } catch (RuntimeException ex) {
            log.error("Provisioning Asterisk falló para ext {} (no se propaga, persistencia OK)",
                    event.extensionNumber(), ex);
        }
    }

    public record SipExtensionPersistedEvent(String extensionNumber) {
    }
}
