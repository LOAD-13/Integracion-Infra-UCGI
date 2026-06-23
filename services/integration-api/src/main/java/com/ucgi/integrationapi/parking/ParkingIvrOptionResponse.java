package com.ucgi.integrationapi.parking;

public record ParkingIvrOptionResponse(
        Long id,
        String dtmfKey,
        String label,
        ParkingIvrOption.Action action,
        Long transferSkillId,
        Integer position
) {
    public static ParkingIvrOptionResponse from(ParkingIvrOption o) {
        return new ParkingIvrOptionResponse(o.getId(), o.getDtmfKey(), o.getLabel(),
                o.getAction(), o.getTransferSkillId(), o.getPosition());
    }
}
