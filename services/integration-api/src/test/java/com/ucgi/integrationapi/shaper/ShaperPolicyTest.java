package com.ucgi.integrationapi.shaper;

import static org.assertj.core.api.Assertions.assertThat;

import com.ucgi.integrationapi.shaper.ShaperPolicy.Tier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ShaperPolicyTest {

    @ParameterizedTest
    @CsvSource({
            "100, FULL",
            " 50, FULL",
            " 30, FULL",
            " 29, MIXED",
            " 15, MIXED",
            " 10, MIXED",
            "  9, DOWNGRADED",
            "  5, DOWNGRADED",
            "  0, DOWNGRADED",
            " -1, UNKNOWN",
    })
    @DisplayName("Umbrales 10/30 segmentan correctamente en FULL/MIXED/DOWNGRADED")
    void tierFor_segmentsByThreshold(int mbps, ShaperPolicy.Tier expected) {
        assertThat(ShaperPolicy.tierFor(mbps)).isEqualTo(expected);
    }

    @Test
    @DisplayName("FULL incluye opus + video; MIXED solo audio narrowband; DOWNGRADED g729/gsm")
    void codecsFor_returnsExpectedSets() {
        assertThat(ShaperPolicy.codecsFor(Tier.FULL))
                .containsExactly("opus", "ulaw", "alaw", "vp8", "h264");
        assertThat(ShaperPolicy.codecsFor(Tier.MIXED))
                .containsExactly("ulaw", "alaw", "gsm");
        assertThat(ShaperPolicy.codecsFor(Tier.DOWNGRADED))
                .containsExactly("g729", "gsm");
        assertThat(ShaperPolicy.codecsFor(Tier.UNKNOWN)).isEmpty();
    }
}
