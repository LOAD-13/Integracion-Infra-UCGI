package com.ucgi.integrationapi.queue;

import com.ucgi.integrationapi.client.ClientRepository;
import com.ucgi.integrationapi.mikopbx.MikoPbxException;
import com.ucgi.integrationapi.mikopbx.MikoPbxRestClient;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoint que arma la "Cola de llamadas entrantes" del Dashboard del agente
 * a partir de las llamadas activas en MikoPBX. Filtra por estado Ringing y
 * enriquece con datos del cliente cuando el caller-id matchea por phone.
 */
@RestController
@RequestMapping("/api/v1/queues")
public class QueueController {

    private final MikoPbxRestClient pbx;
    private final ClientRepository clientRepository;

    public QueueController(MikoPbxRestClient pbx, ClientRepository clientRepository) {
        this.pbx = pbx;
        this.clientRepository = clientRepository;
    }

    @GetMapping("/incoming")
    public ResponseEntity<List<QueueEntry>> incoming() {
        List<MikoPbxRestClient.ActiveCall> calls;
        try {
            calls = pbx.getActiveCalls();
        } catch (MikoPbxException e) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        List<QueueEntry> entries = new ArrayList<>();
        long now = Instant.now().getEpochSecond();
        for (MikoPbxRestClient.ActiveCall c : calls) {
            String state = c.state() == null ? "" : c.state().toUpperCase();
            if (!state.contains("RING")) continue;
            int wait = c.startEpoch() > 0 ? (int) Math.max(0, now - c.startEpoch()) : 0;
            String fromNumber = c.src();
            String reason = "Entrante";
            String name = clientRepository.search(fromNumber, null,
                            org.springframework.data.domain.PageRequest.of(0, 1))
                    .stream().findFirst().map(cl -> cl.getName()).orElse(null);
            entries.add(new QueueEntry(c.uniqueId(), fromNumber, name, reason,
                    formatWait(wait), priority(wait)));
        }
        return ResponseEntity.ok(entries);
    }

    private static String formatWait(int seconds) {
        return String.format("%02d:%02d", seconds / 60, seconds % 60);
    }

    private static String priority(int seconds) {
        if (seconds > 90) return "alta";
        if (seconds > 30) return "media";
        return "baja";
    }

    public record QueueEntry(String uniqueId, String fromNumber, String clientName,
                             String reason, String wait, String priority) {
    }
}
