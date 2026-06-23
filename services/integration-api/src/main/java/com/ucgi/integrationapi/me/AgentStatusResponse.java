package com.ucgi.integrationapi.me;

import com.ucgi.integrationapi.user.User;
import java.time.Instant;

public record AgentStatusResponse(
        User.AgentStatus status,
        Instant since
) {
    public static AgentStatusResponse from(User u) {
        return new AgentStatusResponse(u.getAgentStatus(), u.getStatusSince());
    }
}
