package com.ucgi.integrationapi.skill;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "skills")
public class Skill {

    public enum Strategy { ALL_TO_FIRST, ROUND_ROBIN, LONGEST_IDLE, LEAST_BUSY }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80, unique = true)
    private String name;

    @Column(length = 255)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Strategy strategy;

    @Column(name = "max_wait_seconds", nullable = false)
    private Integer maxWaitSeconds;

    @Column(name = "overflow_skill_id")
    private Long overflowSkillId;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    protected Skill() {
    }

    public Skill(String name, String description, Strategy strategy,
                 Integer maxWaitSeconds, Long overflowSkillId) {
        this.name = name;
        this.description = description;
        this.strategy = strategy;
        this.maxWaitSeconds = maxWaitSeconds;
        this.overflowSkillId = overflowSkillId;
        this.enabled = true;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Strategy getStrategy() { return strategy; }
    public void setStrategy(Strategy strategy) { this.strategy = strategy; }
    public Integer getMaxWaitSeconds() { return maxWaitSeconds; }
    public void setMaxWaitSeconds(Integer maxWaitSeconds) { this.maxWaitSeconds = maxWaitSeconds; }
    public Long getOverflowSkillId() { return overflowSkillId; }
    public void setOverflowSkillId(Long overflowSkillId) { this.overflowSkillId = overflowSkillId; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
