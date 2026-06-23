package com.ucgi.integrationapi.inboundroute;

import com.ucgi.integrationapi.error.ResourceConflictException;
import com.ucgi.integrationapi.error.ResourceNotFoundException;
import com.ucgi.integrationapi.skill.SkillRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InboundRouteService {

    private final InboundRouteRepository repository;
    private final SkillRepository skillRepository;

    public InboundRouteService(InboundRouteRepository repository, SkillRepository skillRepository) {
        this.repository = repository;
        this.skillRepository = skillRepository;
    }

    @Transactional(readOnly = true)
    public List<InboundRouteResponse> list() {
        return repository.findAllByOrderByPriorityAscIdAsc().stream()
                .map(InboundRouteResponse::from).toList();
    }

    @Transactional
    public InboundRouteResponse create(InboundRouteRequest req) {
        validate(req);
        InboundRoute route = new InboundRoute(req.didNumber(), req.skillId(), req.priority(),
                req.scheduleKind(), req.scheduleStart(), req.scheduleEnd(),
                req.daysMask(), req.fallbackAction(), req.fallbackSkillId());
        if (req.enabled() != null) route.setEnabled(req.enabled());
        return InboundRouteResponse.from(repository.save(route));
    }

    @Transactional
    public InboundRouteResponse update(Long id, InboundRouteRequest req) {
        validate(req);
        InboundRoute route = require(id);
        route.setDidNumber(req.didNumber());
        route.setSkillId(req.skillId());
        route.setPriority(req.priority());
        route.setScheduleKind(req.scheduleKind());
        route.setScheduleStart(req.scheduleStart());
        route.setScheduleEnd(req.scheduleEnd());
        route.setDaysMask(req.daysMask());
        route.setFallbackAction(req.fallbackAction());
        route.setFallbackSkillId(req.fallbackSkillId());
        if (req.enabled() != null) route.setEnabled(req.enabled());
        return InboundRouteResponse.from(repository.save(route));
    }

    @Transactional
    public void delete(Long id) {
        require(id);
        repository.deleteById(id);
    }

    @Transactional
    public List<InboundRouteResponse> reorder(List<Long> orderedIds) {
        int p = 100;
        for (Long id : orderedIds) {
            InboundRoute r = require(id);
            r.setPriority(p);
            repository.save(r);
            p += 10;
        }
        return list();
    }

    private InboundRoute require(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ruta entrante no encontrada: " + id));
    }

    private void validate(InboundRouteRequest req) {
        if (!skillRepository.existsById(req.skillId())) {
            throw new ResourceNotFoundException("Skill no encontrada: " + req.skillId());
        }
        if (req.fallbackAction() == InboundRoute.FallbackAction.OVERFLOW_SKILL
                && req.fallbackSkillId() == null) {
            throw new ResourceConflictException("fallback_skill_id es requerido si fallback_action = OVERFLOW_SKILL");
        }
        if (req.fallbackSkillId() != null && !skillRepository.existsById(req.fallbackSkillId())) {
            throw new ResourceNotFoundException("Skill fallback no encontrada: " + req.fallbackSkillId());
        }
        if (req.scheduleKind() == InboundRoute.ScheduleKind.CUSTOM
                && (req.scheduleStart() == null || req.scheduleEnd() == null)) {
            throw new ResourceConflictException("schedule_start y schedule_end son requeridos si schedule_kind = CUSTOM");
        }
        if (req.daysMask() < 1 || req.daysMask() > 127) {
            throw new ResourceConflictException("days_mask debe estar entre 1 y 127");
        }
    }
}
