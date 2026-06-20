package com.ucgi.integrationapi.client;

import com.ucgi.integrationapi.error.ResourceNotFoundException;
import com.ucgi.integrationapi.user.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ClientService {

    private final ClientRepository repository;
    private final UserRepository userRepository;

    public ClientService(ClientRepository repository, UserRepository userRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public Page<ClientResponse> search(String q, Long agentUserId, Pageable pageable) {
        String trimmed = (q == null || q.isBlank()) ? null : q.trim();
        return repository.search(trimmed, agentUserId, pageable).map(ClientResponse::from);
    }

    @Transactional(readOnly = true)
    public Long resolveAgentUserId(String username) {
        return userRepository.findByUsername(username)
                .map(u -> u.getId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuario autenticado no encontrado: " + username));
    }

    @Transactional(readOnly = true)
    public ClientResponse findById(Long id) {
        return ClientResponse.from(get(id));
    }

    @Transactional
    public ClientResponse create(ClientRequest req) {
        Client client = new Client(req.name(), req.phone(),
                blankToNull(req.email()), blankToNull(req.company()),
                blankToNull(req.notesSummary()));
        return ClientResponse.from(repository.save(client));
    }

    @Transactional
    public ClientResponse update(Long id, ClientRequest req) {
        Client client = get(id);
        client.setName(req.name());
        client.setPhone(req.phone());
        client.setEmail(blankToNull(req.email()));
        client.setCompany(blankToNull(req.company()));
        client.setNotesSummary(blankToNull(req.notesSummary()));
        return ClientResponse.from(repository.save(client));
    }

    @Transactional
    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new ResourceNotFoundException("Cliente no encontrado: " + id);
        }
        repository.deleteById(id);
    }

    private Client get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cliente no encontrado: " + id));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
