package com.ucgi.integrationapi.parking;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "parking_ivr_options")
public class ParkingIvrOption {

    public enum Action { CALLBACK, KEEP_WAITING, HANGUP, TRANSFER_SKILL }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dtmf_key", nullable = false, length = 2, unique = true)
    private String dtmfKey;

    @Column(nullable = false, length = 120)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Action action;

    @Column(name = "transfer_skill_id")
    private Long transferSkillId;

    @Column(nullable = false)
    private Integer position;

    protected ParkingIvrOption() {
    }

    public ParkingIvrOption(String dtmfKey, String label, Action action,
                            Long transferSkillId, Integer position) {
        this.dtmfKey = dtmfKey;
        this.label = label;
        this.action = action;
        this.transferSkillId = transferSkillId;
        this.position = position;
    }

    public Long getId() { return id; }
    public String getDtmfKey() { return dtmfKey; }
    public void setDtmfKey(String dtmfKey) { this.dtmfKey = dtmfKey; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public Action getAction() { return action; }
    public void setAction(Action action) { this.action = action; }
    public Long getTransferSkillId() { return transferSkillId; }
    public void setTransferSkillId(Long transferSkillId) { this.transferSkillId = transferSkillId; }
    public Integer getPosition() { return position; }
    public void setPosition(Integer position) { this.position = position; }
}
