package com.ucgi.integrationapi.me;

import java.time.Instant;

public record RecentActivityResponse(
        String kind,
        String title,
        String subtitle,
        String meta,
        Instant occurredAt
) {
}
