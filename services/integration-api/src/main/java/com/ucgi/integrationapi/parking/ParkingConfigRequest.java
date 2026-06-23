package com.ucgi.integrationapi.parking;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ParkingConfigRequest(
        @NotNull @Min(5) @Max(600) Integer loopSeconds,
        @NotNull @Min(10) @Max(3600) Integer timeoutSeconds,
        @Size(max = 255) String greetingUrl,
        @Size(max = 255) String holdMusicUrl,
        @NotNull @Min(0) @Max(100) Short volumePct,
        Boolean enabled
) {
}
