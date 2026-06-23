package com.ucgi.integrationapi.campaign;

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
@Table(name = "campaign_contacts")
public class CampaignContact {

    public enum Status { PENDING, DIALING, ANSWERED, NO_ANSWER, BUSY, FAILED, DONE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "campaign_id", nullable = false)
    private Long campaignId;

    @Column(name = "client_id")
    private Long clientId;

    @Column(nullable = false, length = 64)
    private String phone;

    @Column(name = "display_name", length = 255)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    @Column(nullable = false)
    private Integer attempts;

    @Column(name = "last_attempt_at")
    private Instant lastAttemptAt;

    @Column(nullable = false)
    private Integer position;

    protected CampaignContact() {
    }

    public CampaignContact(Long campaignId, Long clientId, String phone,
                           String displayName, Integer position) {
        this.campaignId = campaignId;
        this.clientId = clientId;
        this.phone = phone;
        this.displayName = displayName;
        this.status = Status.PENDING;
        this.attempts = 0;
        this.position = position == null ? 0 : position;
    }

    public Long getId() { return id; }
    public Long getCampaignId() { return campaignId; }
    public Long getClientId() { return clientId; }
    public void setClientId(Long clientId) { this.clientId = clientId; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public Integer getAttempts() { return attempts; }
    public void setAttempts(Integer attempts) { this.attempts = attempts; }
    public Instant getLastAttemptAt() { return lastAttemptAt; }
    public void setLastAttemptAt(Instant lastAttemptAt) { this.lastAttemptAt = lastAttemptAt; }
    public Integer getPosition() { return position; }
    public void setPosition(Integer position) { this.position = position; }
}
