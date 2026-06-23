package com.ucgi.integrationapi.parking;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ParkingIvrOptionRequest(
        @NotBlank @Pattern(regexp = "^[0-9*#]$",
                message = "dtmf_key debe ser 0-9, * o #") String dtmfKey,
        @NotBlank @Size(max = 120) String label,
        @NotNull ParkingIvrOption.Action action,
        Long transferSkillId,
        Integer position
) {
}
