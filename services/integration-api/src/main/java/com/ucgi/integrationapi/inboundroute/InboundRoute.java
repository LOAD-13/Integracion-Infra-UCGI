package com.ucgi.integrationapi.inboundroute;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalTime;

@Entity
@Table(name = "inbound_routes")
public class InboundRoute {

    public enum ScheduleKind { ALWAYS, BUSINESS, CUSTOM }
    public enum FallbackAction { VOICEMAIL, OVERFLOW_SKILL, HANGUP }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "did_number", nullable = false, length = 64)
    private String didNumber;

    @Column(name = "skill_id", nullable = false)
    private Long skillId;

    @Column(nullable = false)
    private Integer priority;

    @Enumerated(EnumType.STRING)
    @Column(name = "schedule_kind", nullable = false, length = 12)
    private ScheduleKind scheduleKind;

    @Column(name = "schedule_start")
    private LocalTime scheduleStart;

    @Column(name = "schedule_end")
    private LocalTime scheduleEnd;

    @Column(name = "days_mask", nullable = false)
    private Short daysMask;

    @Enumerated(EnumType.STRING)
    @Column(name = "fallback_action", nullable = false, length = 16)
    private FallbackAction fallbackAction;

    @Column(name = "fallback_skill_id")
    private Long fallbackSkillId;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    protected InboundRoute() {
    }

    public InboundRoute(String didNumber, Long skillId, Integer priority,
                        ScheduleKind scheduleKind, LocalTime scheduleStart, LocalTime scheduleEnd,
                        Short daysMask, FallbackAction fallbackAction, Long fallbackSkillId) {
        this.didNumber = didNumber;
        this.skillId = skillId;
        this.priority = priority;
        this.scheduleKind = scheduleKind;
        this.scheduleStart = scheduleStart;
        this.scheduleEnd = scheduleEnd;
        this.daysMask = daysMask;
        this.fallbackAction = fallbackAction;
        this.fallbackSkillId = fallbackSkillId;
        this.enabled = true;
    }

    public Long getId() { return id; }
    public String getDidNumber() { return didNumber; }
    public void setDidNumber(String didNumber) { this.didNumber = didNumber; }
    public Long getSkillId() { return skillId; }
    public void setSkillId(Long skillId) { this.skillId = skillId; }
    public Integer getPriority() { return priority; }
    public void setPriority(Integer priority) { this.priority = priority; }
    public ScheduleKind getScheduleKind() { return scheduleKind; }
    public void setScheduleKind(ScheduleKind scheduleKind) { this.scheduleKind = scheduleKind; }
    public LocalTime getScheduleStart() { return scheduleStart; }
    public void setScheduleStart(LocalTime scheduleStart) { this.scheduleStart = scheduleStart; }
    public LocalTime getScheduleEnd() { return scheduleEnd; }
    public void setScheduleEnd(LocalTime scheduleEnd) { this.scheduleEnd = scheduleEnd; }
    public Short getDaysMask() { return daysMask; }
    public void setDaysMask(Short daysMask) { this.daysMask = daysMask; }
    public FallbackAction getFallbackAction() { return fallbackAction; }
    public void setFallbackAction(FallbackAction fallbackAction) { this.fallbackAction = fallbackAction; }
    public Long getFallbackSkillId() { return fallbackSkillId; }
    public void setFallbackSkillId(Long fallbackSkillId) { this.fallbackSkillId = fallbackSkillId; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
