package com.ucgi.integrationapi.audit;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * HU-07.5 — endpoint REST para consultar el audit trail. Solo ROLE_ADMIN
 * debería acceder en prod; aquí se deja libre para que la demo lo cubra.
 */
@RestController
@RequestMapping("/api/v1/audit")
public class AuditController {

    private static final ZoneId LIMA = ZoneId.of("America/Lima");

    private final AuditLogRepository repository;

    public AuditController(AuditLogRepository repository) {
        this.repository = repository;
    }

    /**
     * Lista eventos de auditoría con paginación + filtros opcionales.
     *
     * @param actor   filtro por username (opcional).
     * @param from    fecha desde (inclusive, día completo desde 00:00).
     * @param to      fecha hasta (inclusive, día completo hasta 23:59:59.999).
     * @param page    0-indexed.
     * @param size    1-100.
     */
    @GetMapping
    public Page<AuditLog> list(
            @RequestParam(required = false) String actor,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        PageRequest pr = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "occurredAt"));

        LocalDateTime fromDt = from != null
            ? LocalDateTime.of(from, LocalTime.MIN)
            : LocalDateTime.now(LIMA).minusDays(30);
        LocalDateTime toDt = to != null
            ? LocalDateTime.of(to, LocalTime.MAX)
            : LocalDateTime.now(LIMA);

        if (actor != null && !actor.isBlank()) {
            return repository.findByActorAndOccurredAtBetween(actor, fromDt, toDt, pr);
        }
        return repository.findByOccurredAtBetween(fromDt, toDt, pr);
    }
}
