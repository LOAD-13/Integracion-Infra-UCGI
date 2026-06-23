package com.ucgi.integrationapi.skill;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SkillRequest(
        @NotBlank @Size(max = 80) String name,
        @Size(max = 255) String description,
        @NotNull Skill.Strategy strategy,
        @NotNull @Min(10) Integer maxWaitSeconds,
        Long overflowSkillId,
        Boolean enabled
) {
}
