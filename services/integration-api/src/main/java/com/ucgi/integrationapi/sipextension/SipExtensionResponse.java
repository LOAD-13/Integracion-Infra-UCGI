package com.ucgi.integrationapi.sipextension;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SipExtensionResponse(
        Long id,
        Long userId,
        String username,
        String extensionNumber,
        boolean enabled,
        Instant createdAt,
        Instant updatedAt
) {

    public static SipExtensionResponse of(SipExtension entity, String username) {
        return new SipExtensionResponse(
                entity.getId(),
                entity.getUserId(),
                username,
                entity.getExtensionNumber(),
                entity.isEnabled(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
