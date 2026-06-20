package com.ucgi.integrationapi.shaper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Polling service del ucgi-shaper (HU-03.7 versión mínima — IUDCYGI-160).
 *
 * <p>Cada {@code shaper.polling.intervalMs} (default 10000) consulta
 * {@code GET /status}, parsea {@link ShaperStatus} y decide qué tier de
 * códecs corresponde con {@link ShaperPolicy}. Hoy la decisión solo se
 * <i>loguea</i> y se expone vía {@link #lastDecision()}; la reescritura
 * efectiva de la plantilla MikoPBX queda para la versión completa en
 * Sprint 4 (ver {@code docs/notas-tecnicas/2026-06-19-hu-03.7-deuda.md}).
 */
@Service
public class ShaperPollingService {

    private static final Logger log = LoggerFactory.getLogger(ShaperPollingService.class);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String shaperBaseUrl;
    private final boolean enabled;
    private final AtomicReference<Decision> lastDecision =
            new AtomicReference<>(Decision.unknown());

    public ShaperPollingService(
            ObjectMapper objectMapper,
            @Value("${shaper.base-url:http://shaper:9100}") String shaperBaseUrl,
            @Value("${shaper.polling.enabled:true}") boolean enabled) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .build();
        this.objectMapper = objectMapper;
        this.shaperBaseUrl = shaperBaseUrl;
        this.enabled = enabled;
    }

    @Scheduled(fixedDelayString = "${shaper.polling.intervalMs:10000}", initialDelay = 5000)
    public void poll() {
        if (!enabled) return;
        try {
            ShaperStatus status = fetchStatus();
            ShaperPolicy.Tier tier = ShaperPolicy.tierFor(status.bandwidthMbps());
            var codecs = ShaperPolicy.codecsFor(tier);
            Decision decision = new Decision(status.bandwidthMbps(), tier, codecs);
            Decision previous = lastDecision.getAndSet(decision);
            if (previous.tier != decision.tier) {
                log.info("Shaper policy change: tier={} bw={}Mbps codecs={}",
                        decision.tier, decision.bandwidthMbps, decision.codecs);
            } else {
                log.debug("Shaper poll OK: bw={}Mbps tier={}",
                        decision.bandwidthMbps, decision.tier);
            }
        } catch (Exception e) {
            log.warn("Shaper poll failed: {}", e.getMessage());
        }
    }

    public Decision lastDecision() {
        return lastDecision.get();
    }

    ShaperStatus fetchStatus() throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(shaperBaseUrl + "/status"))
                .timeout(Duration.ofSeconds(2))
                .GET()
                .build();
        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) {
            throw new IllegalStateException("Shaper respondió " + resp.statusCode());
        }
        return objectMapper.readValue(resp.body(), ShaperStatus.class);
    }

    public record Decision(int bandwidthMbps, ShaperPolicy.Tier tier, java.util.List<String> codecs) {
        public static Decision unknown() {
            return new Decision(-1, ShaperPolicy.Tier.UNKNOWN, java.util.List.of());
        }
    }
}
