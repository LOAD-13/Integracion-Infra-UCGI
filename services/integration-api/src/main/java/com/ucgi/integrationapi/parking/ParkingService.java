package com.ucgi.integrationapi.parking;

import com.ucgi.integrationapi.error.ResourceConflictException;
import com.ucgi.integrationapi.error.ResourceNotFoundException;
import com.ucgi.integrationapi.skill.SkillRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ParkingService {

    private static final short SINGLETON_ID = 1;

    private final ParkingConfigRepository configRepository;
    private final ParkingIvrOptionRepository optionRepository;
    private final SkillRepository skillRepository;

    public ParkingService(ParkingConfigRepository configRepository,
                          ParkingIvrOptionRepository optionRepository,
                          SkillRepository skillRepository) {
        this.configRepository = configRepository;
        this.optionRepository = optionRepository;
        this.skillRepository = skillRepository;
    }

    @Transactional(readOnly = true)
    public ParkingConfigResponse getConfig() {
        return ParkingConfigResponse.from(configRepository.findById(SINGLETON_ID)
                .orElseThrow(() -> new ResourceNotFoundException("Parking config no inicializada")));
    }

    @Transactional
    public ParkingConfigResponse updateConfig(ParkingConfigRequest req) {
        ParkingConfig cfg = configRepository.findById(SINGLETON_ID)
                .orElseGet(() -> {
                    ParkingConfig fresh = new ParkingConfig();
                    fresh.setId(SINGLETON_ID);
                    return fresh;
                });
        cfg.setLoopSeconds(req.loopSeconds());
        cfg.setTimeoutSeconds(req.timeoutSeconds());
        cfg.setGreetingUrl(blank(req.greetingUrl()));
        cfg.setHoldMusicUrl(blank(req.holdMusicUrl()));
        cfg.setVolumePct(req.volumePct());
        if (req.enabled() != null) cfg.setEnabled(req.enabled());
        return ParkingConfigResponse.from(configRepository.save(cfg));
    }

    @Transactional(readOnly = true)
    public List<ParkingIvrOptionResponse> listOptions() {
        return optionRepository.findAllByOrderByPositionAscIdAsc().stream()
                .map(ParkingIvrOptionResponse::from).toList();
    }

    @Transactional
    public ParkingIvrOptionResponse createOption(ParkingIvrOptionRequest req) {
        validateTransfer(req);
        ParkingIvrOption opt = new ParkingIvrOption(req.dtmfKey(), req.label(), req.action(),
                req.transferSkillId(), req.position() != null ? req.position() : 0);
        return ParkingIvrOptionResponse.from(optionRepository.save(opt));
    }

    @Transactional
    public ParkingIvrOptionResponse updateOption(Long id, ParkingIvrOptionRequest req) {
        validateTransfer(req);
        ParkingIvrOption opt = optionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Opcion IVR no encontrada: " + id));
        opt.setDtmfKey(req.dtmfKey());
        opt.setLabel(req.label());
        opt.setAction(req.action());
        opt.setTransferSkillId(req.transferSkillId());
        if (req.position() != null) opt.setPosition(req.position());
        return ParkingIvrOptionResponse.from(optionRepository.save(opt));
    }

    @Transactional
    public void deleteOption(Long id) {
        if (!optionRepository.existsById(id)) {
            throw new ResourceNotFoundException("Opcion IVR no encontrada: " + id);
        }
        optionRepository.deleteById(id);
    }

    private void validateTransfer(ParkingIvrOptionRequest req) {
        if (req.action() == ParkingIvrOption.Action.TRANSFER_SKILL
                && req.transferSkillId() == null) {
            throw new ResourceConflictException("transfer_skill_id es requerido si action = TRANSFER_SKILL");
        }
        if (req.transferSkillId() != null && !skillRepository.existsById(req.transferSkillId())) {
            throw new ResourceNotFoundException("Skill no encontrada: " + req.transferSkillId());
        }
    }

    private static String blank(String v) {
        return v == null || v.isBlank() ? null : v;
    }
}
