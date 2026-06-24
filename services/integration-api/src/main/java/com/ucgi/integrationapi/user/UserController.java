package com.ucgi.integrationapi.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints de administración de usuarios — solo accesibles para
 * {@code ROLE_ADMIN} (ver SecurityConfig). Sirve la vista admin del CRM
 * (HU-04.8). La provisión SIP automática vía midPoint llega con HU-05.3.
 */
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService service;

    public UserController(UserService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<UserResponse>> list() {
        return ResponseEntity.ok(service.list());
    }

    @PostMapping
    public ResponseEntity<UserResponse> create(@Valid @RequestBody UserCreateRequest req) {
        UserResponse created = service.create(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}/role")
    public ResponseEntity<UserResponse> updateRole(@PathVariable Long id,
                                                   @Valid @RequestBody UpdateRoleRequest req) {
        return ResponseEntity.ok(service.updateRole(id, req.role()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    public record UserCreateRequest(
            @NotBlank @Size(max = 64) String username,
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(max = 255) String fullName,
            @NotBlank @Pattern(regexp = "ADMIN|AGENTE") String role,
            @Size(max = 128) String password
    ) {
    }

    public record UpdateRoleRequest(
            @NotBlank @Pattern(regexp = "ADMIN|AGENTE") String role
    ) {
    }

    public record UserResponse(
            Long id,
            String username,
            String email,
            String fullName,
            String role,
            boolean active,
            String agentStatus,
            Instant statusSince,
            Instant createdAt,
            /** Contraseña inicial autogenerada — null para list/update. Solo viene en create. */
            String generatedPassword
    ) {
    }
}
