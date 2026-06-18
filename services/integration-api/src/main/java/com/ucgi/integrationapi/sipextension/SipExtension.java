package com.ucgi.integrationapi.sipextension;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "sip_extensions")
public class SipExtension {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "extension_number", nullable = false, unique = true, length = 20)
    private String extensionNumber;

    @Column(name = "sip_password", nullable = false, length = 64)
    private String sipPassword;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private Instant updatedAt;

    protected SipExtension() {
    }

    public SipExtension(Long userId, String extensionNumber, String sipPassword) {
        this.userId = userId;
        this.extensionNumber = extensionNumber;
        this.sipPassword = sipPassword;
        this.enabled = true;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getExtensionNumber() {
        return extensionNumber;
    }

    public String getSipPassword() {
        return sipPassword;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
