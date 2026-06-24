package com.ucgi.integrationapi.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;

/**
 * HU-07.5 — tests unitarios del AuditService. No tocan DB real (mock del
 * repository).
 */
class AuditServiceTest {

    @Test
    void recordSuccess_persiste_evento() {
        AuditLogRepository repo = mock(AuditLogRepository.class);
        AuditService service = new AuditService(repo);

        service.recordSuccess("agente1", "login", "user", "1001");

        verify(repo).save(any(AuditLog.class));
    }

    @Test
    void record_swallowsExceptions() {
        AuditLogRepository repo = mock(AuditLogRepository.class);
        doThrow(new RuntimeException("DB down")).when(repo).save(any(AuditLog.class));
        AuditService service = new AuditService(repo);

        // No debe propagar — best effort.
        service.recordSuccess("agente1", "login", "user", "1001");
    }

    @Test
    void record_outcome_default_success() {
        AuditLogRepository repo = mock(AuditLogRepository.class);
        AuditService service = new AuditService(repo);

        service.record("ash", "logout", "user", "42", null, null, null, null);

        org.mockito.ArgumentCaptor<AuditLog> captor = org.mockito.ArgumentCaptor.forClass(AuditLog.class);
        verify(repo).save(captor.capture());
        AuditLog saved = captor.getValue();
        assertThat(saved.getOutcome()).isEqualTo("success");
        assertThat(saved.getActor()).isEqualTo("ash");
        assertThat(saved.getAction()).isEqualTo("logout");
        assertThat(saved.getOccurredAt()).isNotNull();
    }
}
