package com.ucgi.integrationapi.cdr;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDateTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CdrResponse(
        Long id,
        String callId,
        Long agentUserId,
        Long clientId,
        String callerNumber,
        String calleeNumber,
        String direction,
        LocalDateTime startTime,
        LocalDateTime answerTime,
        LocalDateTime endTime,
        int durationSeconds,
        String disposition
) {

    public static CdrResponse from(Cdr e) {
        return new CdrResponse(
                e.getId(),
                e.getCallId(),
                e.getAgentUserId(),
                e.getClientId(),
                e.getCallerNumber(),
                e.getCalleeNumber(),
                e.getDirection() != null ? e.getDirection().name() : null,
                e.getStartTime(),
                e.getAnswerTime(),
                e.getEndTime(),
                e.getDurationSeconds(),
                e.getDisposition() != null ? e.getDisposition().name() : null);
    }
}
