package com.ucgi.integrationapi.campaign;

import java.math.BigDecimal;
import java.time.Instant;

public record CampaignResponse(
        Long id,
        String name,
        Campaign.Type type,
        Campaign.Status status,
        Long ownerUserId,
        Long skillId,
        BigDecimal pacingFactor,
        Integer maxConcurrent,
        String callerId,
        long totalContacts,
        long pendingContacts,
        long answeredContacts,
        Instant createdAt
) {
    public static CampaignResponse from(Campaign c, long total, long pending, long answered) {
        return new CampaignResponse(c.getId(), c.getName(), c.getType(), c.getStatus(),
                c.getOwnerUserId(), c.getSkillId(), c.getPacingFactor(), c.getMaxConcurrent(),
                c.getCallerId(), total, pending, answered, c.getCreatedAt());
    }
}
