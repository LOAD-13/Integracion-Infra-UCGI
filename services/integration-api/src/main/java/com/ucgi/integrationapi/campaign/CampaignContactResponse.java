package com.ucgi.integrationapi.campaign;

import java.time.Instant;

public record CampaignContactResponse(
        Long id,
        Long campaignId,
        Long clientId,
        String phone,
        String displayName,
        CampaignContact.Status status,
        Integer attempts,
        Instant lastAttemptAt,
        Integer position
) {
    public static CampaignContactResponse from(CampaignContact c) {
        return new CampaignContactResponse(c.getId(), c.getCampaignId(), c.getClientId(),
                c.getPhone(), c.getDisplayName(), c.getStatus(),
                c.getAttempts(), c.getLastAttemptAt(), c.getPosition());
    }
}
