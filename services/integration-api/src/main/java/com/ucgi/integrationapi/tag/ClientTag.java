package com.ucgi.integrationapi.tag;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "client_tags")
public class ClientTag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40, unique = true)
    private String name;

    @Column(name = "color_bg", nullable = false, length = 40)
    private String colorBg;

    @Column(name = "color_text", nullable = false, length = 40)
    private String colorText;

    @Column(name = "is_system", nullable = false)
    private boolean system;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected ClientTag() {
    }

    public ClientTag(String name, String colorBg, String colorText, boolean system) {
        this.name = name;
        this.colorBg = colorBg;
        this.colorText = colorText;
        this.system = system;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getColorBg() { return colorBg; }
    public void setColorBg(String colorBg) { this.colorBg = colorBg; }
    public String getColorText() { return colorText; }
    public void setColorText(String colorText) { this.colorText = colorText; }
    public boolean isSystem() { return system; }
    public Instant getCreatedAt() { return createdAt; }
}
