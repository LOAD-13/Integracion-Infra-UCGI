package com.ucgi.integrationapi.skill;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record SkillAssignmentRequest(
        @NotEmpty List<Long> userIds
) {
}
