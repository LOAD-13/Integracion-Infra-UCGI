package com.ucgi.integrationapi.inboundroute;

import java.time.LocalTime;

public record InboundRouteResponse(
        Long id,
        String didNumber,
        Long skillId,
        Integer priority,
        InboundRoute.ScheduleKind scheduleKind,
        LocalTime scheduleStart,
        LocalTime scheduleEnd,
        Short daysMask,
        InboundRoute.FallbackAction fallbackAction,
        Long fallbackSkillId,
        boolean enabled
) {
    public static InboundRouteResponse from(InboundRoute r) {
        return new InboundRouteResponse(r.getId(), r.getDidNumber(), r.getSkillId(),
                r.getPriority(), r.getScheduleKind(), r.getScheduleStart(), r.getScheduleEnd(),
                r.getDaysMask(), r.getFallbackAction(), r.getFallbackSkillId(), r.isEnabled());
    }
}
