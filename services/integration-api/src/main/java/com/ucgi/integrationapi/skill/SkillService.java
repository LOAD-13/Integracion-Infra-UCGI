package com.ucgi.integrationapi.skill;

import com.ucgi.integrationapi.error.ResourceConflictException;
import com.ucgi.integrationapi.error.ResourceNotFoundException;
import com.ucgi.integrationapi.user.UserRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SkillService {

    private final SkillRepository repository;
    private final UserRepository userRepository;

    public SkillService(SkillRepository repository, UserRepository userRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<SkillResponse> list() {
        return repository.findAllByOrderByNameAsc().stream()
                .map(s -> SkillResponse.from(s,
                        repository.countAgents(s.getId()),
                        repository.findAgentIds(s.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public SkillResponse get(Long id) {
        Skill s = require(id);
        return SkillResponse.from(s,
                repository.countAgents(s.getId()),
                repository.findAgentIds(s.getId()));
    }

    @Transactional(readOnly = true)
    public List<SkillResponse> forAgent(Long userId) {
        return repository.findByAgentUserId(userId).stream()
                .map(s -> SkillResponse.from(s, 0L, List.of()))
                .toList();
    }

    @Transactional
    public SkillResponse create(SkillRequest req) {
        validateOverflow(req.overflowSkillId(), null);
        Skill skill = new Skill(req.name(), req.description(), req.strategy(),
                req.maxWaitSeconds(), req.overflowSkillId());
        if (req.enabled() != null) skill.setEnabled(req.enabled());
        Skill saved = repository.save(skill);
        return SkillResponse.from(saved, 0L, List.of());
    }

    @Transactional
    public SkillResponse update(Long id, SkillRequest req) {
        Skill skill = require(id);
        validateOverflow(req.overflowSkillId(), id);
        skill.setName(req.name());
        skill.setDescription(req.description());
        skill.setStrategy(req.strategy());
        skill.setMaxWaitSeconds(req.maxWaitSeconds());
        skill.setOverflowSkillId(req.overflowSkillId());
        if (req.enabled() != null) skill.setEnabled(req.enabled());
        Skill saved = repository.save(skill);
        return SkillResponse.from(saved,
                repository.countAgents(id),
                repository.findAgentIds(id));
    }

    @Transactional
    public void delete(Long id) {
        require(id);
        repository.clearAgents(id);
        repository.deleteById(id);
    }

    @Transactional
    public SkillResponse replaceAgents(Long skillId, List<Long> userIds) {
        Skill skill = require(skillId);
        repository.clearAgents(skillId);
        int priority = userIds.size();
        for (Long userId : userIds) {
            if (!userRepository.existsById(userId)) {
                throw new ResourceNotFoundException("Usuario no encontrado: " + userId);
            }
            repository.assignAgent(skillId, userId, priority);
            priority--;
        }
        return SkillResponse.from(skill,
                repository.countAgents(skillId),
                repository.findAgentIds(skillId));
    }

    private Skill require(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Skill no encontrada: " + id));
    }

    private void validateOverflow(Long overflowSkillId, Long currentSkillId) {
        if (overflowSkillId == null) return;
        if (overflowSkillId.equals(currentSkillId)) {
            throw new ResourceConflictException("Una skill no puede tener overflow hacia si misma");
        }
        if (!repository.existsById(overflowSkillId)) {
            throw new ResourceNotFoundException("Skill overflow no encontrada: " + overflowSkillId);
        }
    }
}
