package com.ucgi.integrationapi.campaign;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "campaigns")
public class Campaign {

    public enum Type { MANUAL, PROGRESSIVE, PREDICTIVE }
    public enum Status { DRAFT, RUNNING, PAUSED, FINISHED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Type type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    @Column(name = "owner_user_id")
    private Long ownerUserId;

    @Column(name = "skill_id")
    private Long skillId;

    @Column(name = "pacing_factor", nullable = false, precision = 4, scale = 2)
    private BigDecimal pacingFactor;

    @Column(name = "max_concurrent", nullable = false)
    private Integer maxConcurrent;

    @Column(name = "caller_id", length = 64)
    private String callerId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    protected Campaign() {
    }

    public Campaign(String name, Type type, Long ownerUserId, Long skillId,
                    BigDecimal pacingFactor, Integer maxConcurrent, String callerId) {
        this.name = name;
        this.type = type;
        this.status = Status.DRAFT;
        this.ownerUserId = ownerUserId;
        this.skillId = skillId;
        this.pacingFactor = pacingFactor;
        this.maxConcurrent = maxConcurrent;
        this.callerId = callerId;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Type getType() { return type; }
    public void setType(Type type) { this.type = type; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public Long getOwnerUserId() { return ownerUserId; }
    public void setOwnerUserId(Long ownerUserId) { this.ownerUserId = ownerUserId; }
    public Long getSkillId() { return skillId; }
    public void setSkillId(Long skillId) { this.skillId = skillId; }
    public BigDecimal getPacingFactor() { return pacingFactor; }
    public void setPacingFactor(BigDecimal pacingFactor) { this.pacingFactor = pacingFactor; }
    public Integer getMaxConcurrent() { return maxConcurrent; }
    public void setMaxConcurrent(Integer maxConcurrent) { this.maxConcurrent = maxConcurrent; }
    public String getCallerId() { return callerId; }
    public void setCallerId(String callerId) { this.callerId = callerId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
