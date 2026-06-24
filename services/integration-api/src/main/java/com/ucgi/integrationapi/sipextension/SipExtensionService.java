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

@Service
public class SipExtensionService {

    private static final Logger log = LoggerFactory.getLogger(SipExtensionService.class);

    private final SipExtensionRepository sipExtensionRepository;
    private final UserRepository userRepository;
    private final AsteriskProvisioningService provisioningService;

    public SipExtensionService(SipExtensionRepository sipExtensionRepository,
                               UserRepository userRepository,
                               AsteriskProvisioningService provisioningService) {
        this.sipExtensionRepository = sipExtensionRepository;
        this.userRepository = userRepository;
        this.provisioningService = provisioningService;
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

        // Provisioning SINCRONO antes de devolver. Si MikoPBX rechaza (password
        // débil, número ya tomado, etc) hacemos rollback para no dejar al admin
        // con una extensión fantasma en el CRM. Antes era async post-commit y
        // los fallos quedaban silenciados — el admin veía "ok" pero MikoPBX
        // no tenía nada.
        String displayName = request.displayName() != null && !request.displayName().isBlank()
                ? request.displayName() : user.getUsername();
        try {
            AsteriskProvisioningService.ProvisioningResult result =
                    provisioningService.provisionExtension(
                            saved.getExtensionNumber(), displayName, request.password());
            if (!result.success()) {
                throw new ResourceConflictException(
                        "MikoPBX rechazó la creación de la extensión. Revisá que la "
                        + "contraseña tenga mayúscula+minúscula+número+símbolo y "
                        + "que el número no esté tomado.");
            }
            log.info("Provisioning MikoPBX OK para ext {}: mikoPbxId={}",
                    saved.getExtensionNumber(), result.mikoPbxId());
        } catch (ResourceConflictException e) {
            throw e; // rollback automático por @Transactional, propaga al frontend
        } catch (RuntimeException ex) {
            log.error("Provisioning MikoPBX falló para ext {}, rollback",
                    saved.getExtensionNumber(), ex);
            throw new ResourceConflictException(
                    "No se pudo provisionar en MikoPBX: " + ex.getMessage());
        }

        return SipExtensionResponse.of(saved, user.getUsername());
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
