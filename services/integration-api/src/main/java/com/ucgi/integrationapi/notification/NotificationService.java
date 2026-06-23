package com.ucgi.integrationapi.notification;

import com.ucgi.integrationapi.error.ResourceNotFoundException;
import com.ucgi.integrationapi.user.UserRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    private final NotificationRepository repository;
    private final UserRepository userRepository;

    public NotificationService(NotificationRepository repository, UserRepository userRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> listForUser(String username, boolean unreadOnly) {
        Long userId = resolveUserId(username);
        List<Notification> rows = unreadOnly
                ? repository.findUnread(userId)
                : repository.findByUserIdOrderByCreatedAtDesc(userId);
        return rows.stream().map(NotificationResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public long countUnread(String username) {
        return repository.countByUserIdAndReadAtIsNull(resolveUserId(username));
    }

    @Transactional
    public int markAllRead(String username) {
        return repository.markAllRead(resolveUserId(username));
    }

    @Transactional
    public NotificationResponse push(Long userId, Notification.Kind kind, String title, String link) {
        Notification n = new Notification(userId, kind, title, link);
        return NotificationResponse.from(repository.save(n));
    }

    private Long resolveUserId(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuario autenticado no encontrado: " + username))
                .getId();
    }
}
