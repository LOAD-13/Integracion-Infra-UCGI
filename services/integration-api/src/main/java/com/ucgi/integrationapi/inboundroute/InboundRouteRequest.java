package com.ucgi.integrationapi.inboundroute;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalTime;

public record InboundRouteRequest(
        @NotBlank @Size(max = 64) String didNumber,
        @NotNull Long skillId,
        @NotNull Integer priority,
        @NotNull InboundRoute.ScheduleKind scheduleKind,
        LocalTime scheduleStart,
        LocalTime scheduleEnd,
        @NotNull Short daysMask,
        @NotNull InboundRoute.FallbackAction fallbackAction,
        Long fallbackSkillId,
        Boolean enabled
) {
}
