package com.ucgi.integrationapi.note;

import com.ucgi.integrationapi.error.ResourceNotFoundException;
import com.ucgi.integrationapi.user.UserRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NoteService {

    private final NoteRepository repository;
    private final UserRepository userRepository;

    public NoteService(NoteRepository repository, UserRepository userRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> listByClient(Long clientId) {
        return repository.findByClientIdOrderByUpdatedAtDesc(clientId)
                .stream().map(NoteResponse::from).toList();
    }

    @Transactional
    public NoteResponse create(NoteRequest req, String authorUsername) {
        Long authorId = userRepository.findByUsername(authorUsername)
                .map(u -> u.getId())
                .orElse(null);
        Note note = new Note(req.clientId(), authorId, req.cdrId(), req.body());
        return NoteResponse.from(repository.save(note));
    }

    @Transactional
    public NoteResponse update(Long id, NoteUpdateRequest req) {
        Note note = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Nota no encontrada: " + id));
        note.setBody(req.body());
        return NoteResponse.from(repository.save(note));
    }
}
