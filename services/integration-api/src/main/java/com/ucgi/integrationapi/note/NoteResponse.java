package com.ucgi.integrationapi.note;

import java.time.Instant;

public record NoteResponse(
        Long id,
        Long clientId,
        Long authorUserId,
        Long cdrId,
        String body,
        Instant createdAt,
        Instant updatedAt
) {
    public static NoteResponse from(Note n) {
        return new NoteResponse(n.getId(), n.getClientId(), n.getAuthorUserId(),
                n.getCdrId(), n.getBody(), n.getCreatedAt(), n.getUpdatedAt());
    }
}
