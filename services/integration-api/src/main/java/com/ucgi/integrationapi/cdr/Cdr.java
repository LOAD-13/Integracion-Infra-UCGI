package com.ucgi.integrationapi.cdr;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDateTime;

@Entity
@Table(name = "cdr")
public class Cdr {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "call_id", nullable = false, unique = true, length = 128)
    private String callId;

    @Column(name = "agent_user_id")
    private Long agentUserId;

    @Column(name = "client_id")
    private Long clientId;

    @Column(name = "caller_number", nullable = false, length = 64)
    private String callerNumber;

    @Column(name = "callee_number", nullable = false, length = 64)
    private String calleeNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Direction direction;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "answer_time")
    private LocalDateTime answerTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "duration_seconds", nullable = false)
    private int durationSeconds;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private Disposition disposition;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    protected Cdr() {
    }

    /**
     * Factory para registros importados (MikoPBX → crm.cdr).
     * Mantiene la inmutabilidad de la entidad fuera de package.
     */
    public static Cdr ofImported(
            String callId,
            Long agentUserId,
            Long clientId,
            String callerNumber,
            String calleeNumber,
            Direction direction,
            LocalDateTime startTime,
            LocalDateTime endTime,
            int durationSeconds,
            Disposition disposition
    ) {
        Cdr c = new Cdr();
        c.callId = callId;
        c.agentUserId = agentUserId;
        c.clientId = clientId;
        c.callerNumber = callerNumber;
        c.calleeNumber = calleeNumber;
        c.direction = direction;
        c.startTime = startTime;
        c.endTime = endTime;
        c.answerTime = disposition == Disposition.ANSWERED ? startTime : null;
        c.durationSeconds = durationSeconds;
        c.disposition = disposition;
        return c;
    }

    public Long getId() { return id; }
    public String getCallId() { return callId; }
    public Long getAgentUserId() { return agentUserId; }
    public Long getClientId() { return clientId; }
    public String getCallerNumber() { return callerNumber; }
    public String getCalleeNumber() { return calleeNumber; }
    public Direction getDirection() { return direction; }
    public LocalDateTime getStartTime() { return startTime; }
    public LocalDateTime getAnswerTime() { return answerTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public int getDurationSeconds() { return durationSeconds; }
    public Disposition getDisposition() { return disposition; }
    public Instant getCreatedAt() { return createdAt; }

    public enum Direction {
        INBOUND, OUTBOUND, INTERNAL
    }

    public enum Disposition {
        ANSWERED, NO_ANSWER, BUSY, FAILED
    }
}
