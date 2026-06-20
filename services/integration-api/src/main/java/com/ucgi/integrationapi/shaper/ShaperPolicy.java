package com.ucgi.integrationapi.shaper;

import java.util.List;

/**
 * Decide qué códecs SIP usar dada la capacidad reportada por {@code ucgi-shaper}.
 *
 * <p>Política Nivel 1 (HU-03.7 versión mínima):
 * <ul>
 *   <li><b>≥ 30 Mbps</b>: FULL — {@code opus, ulaw, alaw, vp8, h264}.
 *   <li><b>10–29 Mbps</b>: MIXED — {@code ulaw, alaw, gsm} (sin video).
 *   <li><b>&lt; 10 Mbps</b>: DOWNGRADED — {@code g729, gsm}.
 * </ul>
 *
 * <p>El integration-api solo toma la <i>decisión</i> y la loguea — la
 * reescritura efectiva de {@code pjsip.conf} / template MikoPBX queda para
 * la versión completa de HU-03.7 en Sprint 4 (ver
 * {@code docs/notas-tecnicas/2026-06-19-hu-03.7-deuda.md}).
 */
public final class ShaperPolicy {

    private ShaperPolicy() {
    }

    public enum Tier {
        FULL,
        MIXED,
        DOWNGRADED,
        UNKNOWN
    }

    public static Tier tierFor(int bandwidthMbps) {
        if (bandwidthMbps < 0) return Tier.UNKNOWN;
        if (bandwidthMbps >= 30) return Tier.FULL;
        if (bandwidthMbps >= 10) return Tier.MIXED;
        return Tier.DOWNGRADED;
    }

    public static List<String> codecsFor(Tier tier) {
        return switch (tier) {
            case FULL -> List.of("opus", "ulaw", "alaw", "vp8", "h264");
            case MIXED -> List.of("ulaw", "alaw", "gsm");
            case DOWNGRADED -> List.of("g729", "gsm");
            case UNKNOWN -> List.of();
        };
    }
}
