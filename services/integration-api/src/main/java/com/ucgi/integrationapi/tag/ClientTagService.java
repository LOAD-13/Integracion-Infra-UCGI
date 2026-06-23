package com.ucgi.integrationapi.tag;

import com.ucgi.integrationapi.error.ResourceConflictException;
import com.ucgi.integrationapi.error.ResourceNotFoundException;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ClientTagService {

    private final ClientTagRepository repository;

    public ClientTagService(ClientTagRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<ClientTagResponse> list() {
        return repository.findAllByOrderByNameAsc().stream()
                .map(ClientTagResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ClientTagResponse> forClient(Long clientId) {
        return repository.findByClientId(clientId).stream()
                .map(ClientTagResponse::from).toList();
    }

    @Transactional
    public ClientTagResponse create(ClientTagRequest req) {
        if (repository.findAllByOrderByNameAsc().stream()
                .anyMatch(t -> t.getName().equalsIgnoreCase(req.name()))) {
            throw new ResourceConflictException("Tag con ese nombre ya existe: " + req.name());
        }
        ClientTag tag = new ClientTag(req.name(), req.colorBg(), req.colorText(), false);
        return ClientTagResponse.from(repository.save(tag));
    }

    @Transactional
    public ClientTagResponse update(Long id, ClientTagRequest req) {
        ClientTag tag = get(id);
        if (tag.isSystem() && !tag.getName().equalsIgnoreCase(req.name())) {
            throw new ResourceConflictException("Los tags de sistema no se pueden renombrar");
        }
        tag.setName(req.name());
        tag.setColorBg(req.colorBg());
        tag.setColorText(req.colorText());
        return ClientTagResponse.from(repository.save(tag));
    }

    @Transactional
    public void delete(Long id) {
        ClientTag tag = get(id);
        if (tag.isSystem()) {
            throw new ResourceConflictException("Los tags de sistema no se pueden eliminar");
        }
        repository.delete(tag);
    }

    @Transactional
    public void replaceTagsForClient(Long clientId, Set<Long> tagIds) {
        repository.clearAssignmentsForClient(clientId);
        if (tagIds == null) return;
        for (Long tagId : tagIds) {
            if (!repository.existsById(tagId)) {
                throw new ResourceNotFoundException("Tag no encontrado: " + tagId);
            }
            repository.assignTag(clientId, tagId);
        }
    }

    private ClientTag get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tag no encontrado: " + id));
    }
}
