package com.ucgi.integrationapi.me;

import com.ucgi.integrationapi.user.User;
import jakarta.validation.constraints.NotNull;

public record AgentStatusRequest(
        @NotNull User.AgentStatus status
) {
}
