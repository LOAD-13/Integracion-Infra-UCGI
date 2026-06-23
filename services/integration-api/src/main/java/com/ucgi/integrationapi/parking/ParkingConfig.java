package com.ucgi.integrationapi.parking;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "parking_config")
public class ParkingConfig {

    @Id
    private Short id;

    @Column(name = "loop_seconds", nullable = false)
    private Integer loopSeconds;

    @Column(name = "timeout_seconds", nullable = false)
    private Integer timeoutSeconds;

    @Column(name = "greeting_url", length = 255)
    private String greetingUrl;

    @Column(name = "hold_music_url", length = 255)
    private String holdMusicUrl;

    @Column(name = "volume_pct", nullable = false)
    private Short volumePct;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    protected ParkingConfig() {
    }

    public Short getId() { return id; }
    public void setId(Short id) { this.id = id; }
    public Integer getLoopSeconds() { return loopSeconds; }
    public void setLoopSeconds(Integer loopSeconds) { this.loopSeconds = loopSeconds; }
    public Integer getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(Integer timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }
    public String getGreetingUrl() { return greetingUrl; }
    public void setGreetingUrl(String greetingUrl) { this.greetingUrl = greetingUrl; }
    public String getHoldMusicUrl() { return holdMusicUrl; }
    public void setHoldMusicUrl(String holdMusicUrl) { this.holdMusicUrl = holdMusicUrl; }
    public Short getVolumePct() { return volumePct; }
    public void setVolumePct(Short volumePct) { this.volumePct = volumePct; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Instant getUpdatedAt() { return updatedAt; }
}
