package com.ucgi.integrationapi.sipextension;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Payload que midPoint envía al provisionar el rol AgenteCallCenter (HU-05.3).
 * El campo {@code displayName} es opcional y se acepta para forward-compat;
 * por ahora no se persiste (el schema CRM no tiene columna display_name).
 */
public record SipExtensionCreateRequest(

        @NotBlank(message = "username no puede estar vacío")
        @Size(max = 64, message = "username máximo 64 caracteres")
        String username,

        @NotBlank(message = "password no puede estar vacío")
        @Size(min = 8, max = 64, message = "password entre 8 y 64 caracteres")
        String password,

        @NotBlank(message = "extensionNumber no puede estar vacío")
        @Pattern(regexp = "^[0-9]{3,20}$", message = "extensionNumber debe ser numérico de 3 a 20 dígitos")
        String extensionNumber,

        @Size(max = 128, message = "displayName máximo 128 caracteres")
        String displayName
) {
}
