package com.ucgi.integrationapi.client;

import java.time.Instant;

public record ClientResponse(
        Long id,
        String name,
        String phone,
        String email,
        String company,
        String notesSummary,
        Instant createdAt,
        Instant updatedAt
) {
    public static ClientResponse from(Client c) {
        return new ClientResponse(c.getId(), c.getName(), c.getPhone(),
                c.getEmail(), c.getCompany(), c.getNotesSummary(),
                c.getCreatedAt(), c.getUpdatedAt());
    }
}
