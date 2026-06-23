package com.ucgi.integrationapi.tag;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ClientTagRequest(
        @NotBlank @Size(max = 40) String name,
        @NotBlank @Size(max = 40)
        @Pattern(regexp = "^(#[0-9a-fA-F]{3,8}|rgba?\\([^)]+\\))$",
                 message = "color_bg debe ser hex o rgba()") String colorBg,
        @NotBlank @Size(max = 40)
        @Pattern(regexp = "^(#[0-9a-fA-F]{3,8}|rgba?\\([^)]+\\))$",
                 message = "color_text debe ser hex o rgba()") String colorText
) {
}
