package com.ucgi.integrationapi.campaign;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record CampaignRequest(
        @NotBlank @Size(max = 120) String name,
        @NotNull Campaign.Type type,
        Long skillId,
        @DecimalMin("0.10") BigDecimal pacingFactor,
        @Min(1) Integer maxConcurrent,
        @Size(max = 64) String callerId
) {
}
