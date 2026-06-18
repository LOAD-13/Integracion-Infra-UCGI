package com.ucgi.integrationapi.sipextension;

import com.ucgi.integrationapi.error.ResourceConflictException;
import com.ucgi.integrationapi.error.ResourceNotFoundException;
import com.ucgi.integrationapi.user.User;
import com.ucgi.integrationapi.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SipExtensionService {

    private final SipExtensionRepository sipExtensionRepository;
    private final UserRepository userRepository;

    public SipExtensionService(SipExtensionRepository sipExtensionRepository,
                               UserRepository userRepository) {
        this.sipExtensionRepository = sipExtensionRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public SipExtensionResponse create(SipExtensionCreateRequest request) {
        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "usuario '" + request.username() + "' no existe"));

        if (sipExtensionRepository.existsByExtensionNumber(request.extensionNumber())) {
            throw new ResourceConflictException(
                    "extensionNumber '" + request.extensionNumber() + "' ya está en uso");
        }
        if (sipExtensionRepository.existsByUserId(user.getId())) {
            throw new ResourceConflictException(
                    "el usuario '" + request.username() + "' ya tiene una extensión asignada");
        }

        SipExtension saved = sipExtensionRepository.save(
                new SipExtension(user.getId(), request.extensionNumber(), request.password()));
        return SipExtensionResponse.of(saved, user.getUsername());
    }
}
