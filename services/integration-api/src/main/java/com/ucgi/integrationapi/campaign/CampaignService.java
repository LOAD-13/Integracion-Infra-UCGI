package com.ucgi.integrationapi.campaign;

import com.ucgi.integrationapi.cdr.CdrRepository;
import com.ucgi.integrationapi.error.ResourceConflictException;
import com.ucgi.integrationapi.error.ResourceNotFoundException;
import com.ucgi.integrationapi.user.UserRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CampaignService {

    private final CampaignRepository repository;
    private final CampaignContactRepository contactRepository;
    private final UserRepository userRepository;
    private final CdrRepository cdrRepository;

    public CampaignService(CampaignRepository repository,
                           CampaignContactRepository contactRepository,
                           UserRepository userRepository,
                           CdrRepository cdrRepository) {
        this.repository = repository;
        this.contactRepository = contactRepository;
        this.userRepository = userRepository;
        this.cdrRepository = cdrRepository;
    }

    @Transactional(readOnly = true)
    public List<CampaignResponse> listMine(String username) {
        Long userId = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuario autenticado no encontrado: " + username))
                .getId();
        return repository.findByOwnerUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::enrich).toList();
    }

    @Transactional(readOnly = true)
    public List<CampaignResponse> listAll() {
        return repository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::enrich).toList();
    }

    @Transactional(readOnly = true)
    public CampaignResponse get(Long id) {
        return enrich(require(id));
    }

    @Transactional
    public CampaignResponse create(String username, CampaignRequest req) {
        Long ownerId = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuario autenticado no encontrado: " + username))
                .getId();
        BigDecimal pacing = req.pacingFactor() != null
                ? req.pacingFactor() : BigDecimal.ONE;
        Integer concurrent = req.maxConcurrent() != null ? req.maxConcurrent() : 1;
        Campaign campaign = new Campaign(req.name(), req.type(), ownerId, req.skillId(),
                pacing, concurrent, req.callerId());
        return enrich(repository.save(campaign));
    }

    @Transactional
    public CampaignResponse update(Long id, CampaignRequest req) {
        Campaign c = require(id);
        c.setName(req.name());
        c.setSkillId(req.skillId());
        if (req.pacingFactor() != null) c.setPacingFactor(req.pacingFactor());
        if (req.maxConcurrent() != null) c.setMaxConcurrent(req.maxConcurrent());
        c.setCallerId(req.callerId());
        return enrich(repository.save(c));
    }

    @Transactional
    public void delete(Long id) {
        require(id);
        repository.deleteById(id);
    }

    @Transactional
    public CampaignResponse transition(Long id, Campaign.Status target) {
        Campaign c = require(id);
        if (c.getStatus() == Campaign.Status.FINISHED && target != Campaign.Status.DRAFT) {
            throw new ResourceConflictException("Una campana finalizada no puede transicionar");
        }
        c.setStatus(target);
        return enrich(repository.save(c));
    }

    @Transactional(readOnly = true)
    public List<CampaignContactResponse> listContacts(Long campaignId) {
        require(campaignId);
        return contactRepository.findByCampaignIdOrderByPositionAscIdAsc(campaignId).stream()
                .map(CampaignContactResponse::from).toList();
    }

    @Transactional
    public CampaignContactResponse addContact(Long campaignId, CampaignContactRequest req) {
        require(campaignId);
        CampaignContact contact = new CampaignContact(campaignId, req.clientId(),
                req.phone(), req.displayName(), req.position());
        return CampaignContactResponse.from(contactRepository.save(contact));
    }

    @Transactional
    public Optional<CampaignContactResponse> nextContact(Long campaignId) {
        Campaign campaign = require(campaignId);
        if (campaign.getStatus() != Campaign.Status.RUNNING) {
            throw new ResourceConflictException("La campana no esta en estado RUNNING");
        }
        List<CampaignContact> pending = contactRepository.findByCampaignAndStatus(
                campaignId, CampaignContact.Status.PENDING);
        if (pending.isEmpty()) {
            campaign.setStatus(Campaign.Status.FINISHED);
            repository.save(campaign);
            return Optional.empty();
        }
        CampaignContact next = pending.get(0);
        next.setStatus(CampaignContact.Status.DIALING);
        next.setAttempts(next.getAttempts() + 1);
        next.setLastAttemptAt(Instant.now());
        return Optional.of(CampaignContactResponse.from(contactRepository.save(next)));
    }

    @Transactional
    public CampaignContactResponse setContactStatus(Long contactId, CampaignContact.Status status) {
        CampaignContact contact = contactRepository.findById(contactId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Contacto no encontrado: " + contactId));
        contact.setStatus(status);
        return CampaignContactResponse.from(contactRepository.save(contact));
    }

    /**
     * Calcula cuantas llamadas paralelas deberia disparar la campana predictiva
     * a partir del TMO real del agente owner. Sin agente, devuelve max_concurrent
     * por default. Para PROGRESSIVE y MANUAL siempre 1.
     */
    @Transactional(readOnly = true)
    public PredictiveSuggestion predictiveSuggestion(Long campaignId) {
        Campaign campaign = require(campaignId);
        if (campaign.getType() != Campaign.Type.PREDICTIVE) {
            return new PredictiveSuggestion(1, BigDecimal.ZERO);
        }
        Long ownerId = campaign.getOwnerUserId();
        if (ownerId == null) {
            return new PredictiveSuggestion(campaign.getMaxConcurrent(), BigDecimal.ZERO);
        }
        Double avg = cdrRepository.averageDurationSecondsForAgent(ownerId);
        BigDecimal tmoSeconds = avg == null ? BigDecimal.ZERO
                : BigDecimal.valueOf(avg).setScale(1, RoundingMode.HALF_UP);
        int dial = Math.max(1,
                (int) Math.round(campaign.getMaxConcurrent()
                        * campaign.getPacingFactor().doubleValue()));
        return new PredictiveSuggestion(dial, tmoSeconds);
    }

    private CampaignResponse enrich(Campaign c) {
        long total = contactRepository.findByCampaignIdOrderByPositionAscIdAsc(c.getId()).size();
        long pending = contactRepository.countByCampaignIdAndStatus(c.getId(), CampaignContact.Status.PENDING);
        long answered = contactRepository.countByCampaignIdAndStatus(c.getId(), CampaignContact.Status.ANSWERED);
        return CampaignResponse.from(c, total, pending, answered);
    }

    private Campaign require(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Campana no encontrada: " + id));
    }

    public record PredictiveSuggestion(int dialNow, BigDecimal tmoSeconds) {
    }
}
