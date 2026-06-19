package com.ucgi.integrationapi.client;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO de alta y edición. Mismos campos en ambos casos — el front decide qué
 * formulario muestra (RHF + Zod). El backend solo valida que los campos
 * obligatorios estén presentes y que el email tenga formato correcto si viaja.
 */
public record ClientRequest(
        @NotBlank @Size(max = 255) String name,
        @NotBlank @Size(max = 32) String phone,
        @Email @Size(max = 255) String email,
        @Size(max = 255) String company,
        String notesSummary
) {
}
