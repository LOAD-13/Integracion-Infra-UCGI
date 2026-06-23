package com.ucgi.integrationapi.client;

import com.ucgi.integrationapi.tag.ClientTagResponse;
import java.time.Instant;
import java.util.List;

public record ClientResponse(
        Long id,
        String name,
        String phone,
        String email,
        String company,
        String notesSummary,
        List<ClientTagResponse> tags,
        Instant createdAt,
        Instant updatedAt
) {
    public static ClientResponse from(Client c) {
        return new ClientResponse(c.getId(), c.getName(), c.getPhone(),
                c.getEmail(), c.getCompany(), c.getNotesSummary(), List.of(),
                c.getCreatedAt(), c.getUpdatedAt());
    }

    public static ClientResponse from(Client c, List<ClientTagResponse> tags) {
        return new ClientResponse(c.getId(), c.getName(), c.getPhone(),
                c.getEmail(), c.getCompany(), c.getNotesSummary(), tags,
                c.getCreatedAt(), c.getUpdatedAt());
    }
}
