package com.ucgi.integrationapi.notification;

import java.time.Instant;

public record NotificationResponse(
        Long id,
        Notification.Kind kind,
        String title,
        String link,
        Instant createdAt,
        Instant readAt
) {
    public static NotificationResponse from(Notification n) {
        return new NotificationResponse(n.getId(), n.getKind(), n.getTitle(),
                n.getLink(), n.getCreatedAt(), n.getReadAt());
    }
}
