package com.ucgi.integrationapi.notification;

import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<NotificationResponse>> list(
            Authentication auth,
            @RequestParam(value = "unread", defaultValue = "false") boolean unreadOnly) {
        return ResponseEntity.ok(service.listForUser(auth.getName(), unreadOnly));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> unreadCount(Authentication auth) {
        return ResponseEntity.ok(Map.of("count", service.countUnread(auth.getName())));
    }

    @PostMapping("/mark-all-read")
    public ResponseEntity<Map<String, Integer>> markAllRead(Authentication auth) {
        return ResponseEntity.ok(Map.of("updated", service.markAllRead(auth.getName())));
    }
}
