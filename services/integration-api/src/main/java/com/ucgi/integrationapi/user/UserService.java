package com.ucgi.integrationapi.user;

import com.ucgi.integrationapi.error.ResourceNotFoundException;
import java.time.Instant;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Administración de usuarios del CRM. Para los campos no mapeados todavía en
 * la entity {@link User} (email, active, createdAt) se usa {@link JdbcTemplate}
 * directo — evita ampliar la entidad solo para esta HU.
 */
@Service
public class UserService {

    private final UserRepository repository;
    private final PasswordEncoder encoder;
    private final JdbcTemplate jdbc;

    public UserService(UserRepository repository,
                       PasswordEncoder encoder,
                       JdbcTemplate jdbc) {
        this.repository = repository;
        this.encoder = encoder;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<UserController.UserResponse> list() {
        return jdbc.query(
                "SELECT id, username, email, full_name, role, active, created_at "
                        + "FROM users ORDER BY username",
                (rs, i) -> new UserController.UserResponse(
                        rs.getLong("id"),
                        rs.getString("username"),
                        rs.getString("email"),
                        rs.getString("full_name"),
                        rs.getString("role"),
                        rs.getBoolean("active"),
                        rs.getTimestamp("created_at").toInstant()));
    }

    @Transactional
    public UserController.UserResponse create(UserController.UserCreateRequest req) {
        String hash = encoder.encode(req.password());
        try {
            jdbc.update("INSERT INTO users (username, email, full_name, password_hash, role, active) "
                            + "VALUES (?, ?, ?, ?, ?, ?)",
                    req.username(), req.email(), req.fullName(), hash, req.role(), true);
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT,
                    "Username o email ya en uso");
        }
        Long id = jdbc.queryForObject(
                "SELECT id FROM users WHERE username = ?", Long.class, req.username());
        return findResponse(id);
    }

    @Transactional
    public UserController.UserResponse updateRole(Long id, String role) {
        int rows = jdbc.update("UPDATE users SET role = ? WHERE id = ?", role, id);
        if (rows == 0) {
            throw new ResourceNotFoundException("Usuario no encontrado: " + id);
        }
        return findResponse(id);
    }

    @Transactional
    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new ResourceNotFoundException("Usuario no encontrado: " + id);
        }
        repository.deleteById(id);
    }

    private UserController.UserResponse findResponse(Long id) {
        return jdbc.queryForObject(
                "SELECT id, username, email, full_name, role, active, created_at "
                        + "FROM users WHERE id = ?",
                (rs, i) -> new UserController.UserResponse(
                        rs.getLong("id"),
                        rs.getString("username"),
                        rs.getString("email"),
                        rs.getString("full_name"),
                        rs.getString("role"),
                        rs.getBoolean("active"),
                        rs.getTimestamp("created_at").toInstant()),
                id);
    }

    /** Permite a otros paquetes (auth/me) ignorar inyección manual. */
    @SuppressWarnings("unused")
    private Instant nowMarker() {
        return Instant.now();
    }
}
