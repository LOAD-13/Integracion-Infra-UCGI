package com.ucgi.integrationapi.parking;

public record ParkingConfigResponse(
        Integer loopSeconds,
        Integer timeoutSeconds,
        String greetingUrl,
        String holdMusicUrl,
        Short volumePct,
        boolean enabled
) {
    public static ParkingConfigResponse from(ParkingConfig c) {
        return new ParkingConfigResponse(c.getLoopSeconds(), c.getTimeoutSeconds(),
                c.getGreetingUrl(), c.getHoldMusicUrl(), c.getVolumePct(), c.isEnabled());
    }
}
