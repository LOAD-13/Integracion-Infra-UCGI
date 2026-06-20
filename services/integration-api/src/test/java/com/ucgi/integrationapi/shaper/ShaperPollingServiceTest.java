package com.ucgi.integrationapi.shaper;

import static org.assertj.core.api.Assertions.assertThat;
import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ShaperPollingServiceTest {

    private WireMockServer wireMock;

    @BeforeEach
    void start() {
        wireMock = new WireMockServer(WireMockConfiguration.options().dynamicPort());
        wireMock.start();
    }

    @AfterEach
    void stop() {
        wireMock.stop();
    }

    @Test
    void poll_picksTierFromBandwidthAndStoresDecision() {
        wireMock.stubFor(get(urlEqualTo("/status"))
                .willReturn(aResponse()
                        .withHeader("Content-Type", "application/json")
                        .withBody("{\"bandwidthMbps\":25,\"qdiscActive\":false,\"policy\":\"MIXED\"}")));

        ShaperPollingService svc = newService();
        svc.poll();

        ShaperPollingService.Decision decision = svc.lastDecision();
        assertThat(decision.tier()).isEqualTo(ShaperPolicy.Tier.MIXED);
        assertThat(decision.bandwidthMbps()).isEqualTo(25);
        assertThat(decision.codecs()).containsExactly("ulaw", "alaw", "gsm");
    }

    @Test
    void poll_downgradesWhenBandwidthDropsBelowTenMbps() {
        wireMock.stubFor(get(urlEqualTo("/status"))
                .willReturn(aResponse()
                        .withHeader("Content-Type", "application/json")
                        .withBody("{\"bandwidthMbps\":3,\"qdiscActive\":true,\"policy\":\"DOWNGRADED\"}")));

        ShaperPollingService svc = newService();
        svc.poll();

        assertThat(svc.lastDecision().tier()).isEqualTo(ShaperPolicy.Tier.DOWNGRADED);
        assertThat(svc.lastDecision().codecs()).containsExactly("g729", "gsm");
    }

    @Test
    void poll_isResilientToShaperDowntime() {
        // No stub registrado → WireMock devolverá 404.
        ShaperPollingService svc = newService();
        svc.poll(); // no debe lanzar

        // Mantiene la última decisión conocida (UNKNOWN inicial).
        assertThat(svc.lastDecision().tier()).isEqualTo(ShaperPolicy.Tier.UNKNOWN);
    }

    @Test
    void poll_disabledFlagShortCircuits() {
        wireMock.stubFor(get(urlEqualTo("/status"))
                .willReturn(aResponse().withStatus(200).withBody(
                        "{\"bandwidthMbps\":50,\"qdiscActive\":false,\"policy\":\"FULL\"}")));

        ShaperPollingService svc = new ShaperPollingService(
                new ObjectMapper(), wireMock.baseUrl(), false);
        svc.poll();

        // No debe haber consultado al shaper.
        assertThat(svc.lastDecision().tier()).isEqualTo(ShaperPolicy.Tier.UNKNOWN);
    }

    private ShaperPollingService newService() {
        return new ShaperPollingService(new ObjectMapper(), wireMock.baseUrl(), true);
    }
}
