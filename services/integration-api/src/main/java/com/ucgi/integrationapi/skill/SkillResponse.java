package com.ucgi.integrationapi.skill;

import java.util.List;

public record SkillResponse(
        Long id,
        String name,
        String description,
        Skill.Strategy strategy,
        Integer maxWaitSeconds,
        Long overflowSkillId,
        boolean enabled,
        long agentCount,
        List<Long> agentIds
) {
    public static SkillResponse from(Skill s, long agentCount, List<Long> agentIds) {
        return new SkillResponse(s.getId(), s.getName(), s.getDescription(),
                s.getStrategy(), s.getMaxWaitSeconds(), s.getOverflowSkillId(),
                s.isEnabled(), agentCount, agentIds);
    }
}
