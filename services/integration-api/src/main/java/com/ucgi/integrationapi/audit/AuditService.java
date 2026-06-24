package com.ucgi.integrationapi.audit;

import java.time.LocalDateTime;
import java.time.ZoneId;
import org.springframework.stereotype.Service;

/**
 * Servicio para persistir eventos de auditoría. Lo invocan los controllers
 * críticos (auth, sip-extensions, role-assignments) tras cada operación.
 *
 * <p>Diseño: best-effort — un fallo escribiendo el audit no debe propagarse al
 * caller (la operación de negocio ya tuvo éxito). Errores van a logs.</p>
 */
@Service
public class AuditService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AuditService.class);
    private static final ZoneId LIMA = ZoneId.of("America/Lima");

    private final AuditLogRepository repository;

    public AuditService(AuditLogRepository repository) {
        this.repository = repository;
    }

    /**
     * Registra un evento de auditoría. Si el persist falla, loguea y no propaga.
     */
    public void record(String actor, String action, String targetType, String targetId,
                        String outcome, String ipAddress, String userAgent, String metadata) {
        try {
            AuditLog event = new AuditLog();
            event.setOccurredAt(LocalDateTime.now(LIMA));
            event.setActor(actor);
            event.setAction(action);
            event.setTargetType(targetType);
            event.setTargetId(targetId);
            event.setOutcome(outcome == null ? "success" : outcome);
            event.setIpAddress(ipAddress);
            event.setUserAgent(userAgent);
            event.setMetadata(metadata);
            repository.save(event);
        } catch (Exception e) {
            log.warn("audit persist falló (no propaga): actor={} action={} target={}/{} - {}",
                    actor, action, targetType, targetId, e.getMessage());
        }
    }

    /** Atajo para eventos de éxito simples sin metadata. */
    public void recordSuccess(String actor, String action, String targetType, String targetId) {
        record(actor, action, targetType, targetId, "success", null, null, null);
    }
}
