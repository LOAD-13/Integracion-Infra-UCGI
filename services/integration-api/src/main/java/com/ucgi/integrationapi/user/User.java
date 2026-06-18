package com.ucgi.integrationapi.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Mínima en HU-03.2: solo necesitamos resolver username → id para asociar
 * la extensión SIP. Las columnas adicionales (email, full_name, role, active,
 * password_hash, timestamps) se irán mapeando en HU-03.5 (auth) y HU-05.x.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String username;

    protected User() {
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }
}
