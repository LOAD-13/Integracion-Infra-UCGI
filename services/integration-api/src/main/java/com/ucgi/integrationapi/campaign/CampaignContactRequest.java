package com.ucgi.integrationapi.campaign;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CampaignContactRequest(
        Long clientId,
        @NotBlank @Size(max = 64) String phone,
        @Size(max = 255) String displayName,
        Integer position
) {
}
