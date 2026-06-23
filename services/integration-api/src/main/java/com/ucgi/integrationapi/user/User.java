package com.ucgi.integrationapi.user;

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
@Table(name = "users")
public class User {

    public enum AgentStatus { AVAILABLE, BREAK, BUSY, DND, OFFLINE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String username;

    @Column(name = "full_name", nullable = false, length = 255)
    private String fullName;

    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 16)
    private String role;

    @Enumerated(EnumType.STRING)
    @Column(name = "agent_status", nullable = false, length = 16)
    private AgentStatus agentStatus;

    @Column(name = "status_since", nullable = false)
    private Instant statusSince;

    protected User() {
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getFullName() { return fullName; }
    public String getPasswordHash() { return passwordHash; }
    public String getRole() { return role; }
    public AgentStatus getAgentStatus() {
        return agentStatus == null ? AgentStatus.OFFLINE : agentStatus;
    }
    public Instant getStatusSince() { return statusSince; }

    public void updateAgentStatus(AgentStatus next) {
        this.agentStatus = next;
        this.statusSince = Instant.now();
    }
}
