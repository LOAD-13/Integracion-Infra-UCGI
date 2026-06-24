package com.ucgi.integrationapi.audit;

import java.time.LocalDateTime;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    Page<AuditLog> findByActorAndOccurredAtBetween(
        String actor, LocalDateTime from, LocalDateTime to, Pageable pageable);

    Page<AuditLog> findByOccurredAtBetween(
        LocalDateTime from, LocalDateTime to, Pageable pageable);

    Page<AuditLog> findByActor(String actor, Pageable pageable);
}
