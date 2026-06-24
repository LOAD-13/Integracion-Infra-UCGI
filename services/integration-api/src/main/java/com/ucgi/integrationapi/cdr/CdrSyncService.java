package com.ucgi.integrationapi.cdr;

import com.ucgi.integrationapi.client.Client;
import com.ucgi.integrationapi.client.ClientRepository;
import com.ucgi.integrationapi.mikopbx.MikoCdrRecord;
import com.ucgi.integrationapi.mikopbx.MikoPbxException;
import com.ucgi.integrationapi.mikopbx.MikoPbxRestClient;
import com.ucgi.integrationapi.sipextension.SipExtension;
import com.ucgi.integrationapi.sipextension.SipExtensionRepository;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.temporal.ChronoField;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sincroniza los CDR del MikoPBX (REST {@code /pbxcore/api/v3/cdr}) a la
 * tabla {@code crm.cdr}. Sin este job los KPIs del CRM (Dashboard, Métricas,
 * actividad reciente) quedan estáticos porque ninguna parte del código creaba
 * filas en la tabla CDR.
 *
 * <p>Mapeo:
 * <ul>
 *   <li>{@code linkedid} → {@code call_id} (UNIQUE).</li>
 *   <li>{@code src_num} / {@code dst_num} → {@code caller_number} / {@code callee_number}.</li>
 *   <li>Lookup de {@code agent_user_id}: si el src es una extensión SIP interna,
 *       tomamos su user_id (caso OUTBOUND/INTERNAL del agente que marca). Si no,
 *       tomamos el del dst (caso INBOUND donde el agente que contesta es el dst).</li>
 *   <li>Lookup de {@code client_id}: matchea por {@code phone} con el otro
 *       extremo de la llamada.</li>
 *   <li>{@code direction}: ambas internas → INTERNAL; src no interna → INBOUND;
 *       dst no interna → OUTBOUND.</li>
 * </ul>
 *
 * <p>Idempotente: si el {@code call_id} ya existe, lo ignoramos en lugar de
 * UPSERT — los CDR de MikoPBX no se editan después de cerrados.
 */
@Service
public class CdrSyncService {

    private static final Logger log = LoggerFactory.getLogger(CdrSyncService.class);

    private static final DateTimeFormatter MIKO_FORMAT = new DateTimeFormatterBuilder()
            .appendPattern("yyyy-MM-dd HH:mm:ss")
            .optionalStart()
            .appendFraction(ChronoField.NANO_OF_SECOND, 0, 9, true)
            .optionalEnd()
            .toFormatter();

    private final MikoPbxRestClient miko;
    private final CdrRepository cdrRepository;
    private final SipExtensionRepository sipExtensionRepository;
    private final ClientRepository clientRepository;

    public CdrSyncService(MikoPbxRestClient miko,
                          CdrRepository cdrRepository,
                          SipExtensionRepository sipExtensionRepository,
                          ClientRepository clientRepository) {
        this.miko = miko;
        this.cdrRepository = cdrRepository;
        this.sipExtensionRepository = sipExtensionRepository;
        this.clientRepository = clientRepository;
    }

    @Scheduled(fixedDelayString = "${ucgi.cdr-sync.fixedDelayMs:30000}",
            initialDelayString = "${ucgi.cdr-sync.initialDelayMs:15000}")
    public void poll() {
        try {
            SyncResult result = syncOnce();
            if (result.imported > 0) {
                log.info("CDR sync: imported={} skipped={} total={}",
                        result.imported, result.skipped, result.total);
            } else {
                log.debug("CDR sync: nada nuevo (skipped={} total={})",
                        result.skipped, result.total);
            }
        } catch (MikoPbxException e) {
            log.warn("CDR sync: MikoPBX no respondió ({})", e.getMessage());
        } catch (RuntimeException e) {
            log.error("CDR sync falló", e);
        }
    }

    @Transactional
    public SyncResult syncOnce() {
        List<MikoCdrRecord> records = miko.listCdrRecords();
        Map<String, Long> extToUser = loadExtensionMap();

        int imported = 0;
        int skipped = 0;
        for (MikoCdrRecord r : records) {
            if (r.linkedId().isEmpty()) { skipped++; continue; }
            if (cdrRepository.findByCallId(r.linkedId()).isPresent()) {
                skipped++;
                continue;
            }
            LocalDateTime start = parseStart(r.startRaw());
            if (start == null) { skipped++; continue; }
            LocalDateTime end = start.plusSeconds(Math.max(r.duration(), 0));

            Long srcUserId = extToUser.get(r.srcNum());
            Long dstUserId = extToUser.get(r.dstNum());
            Cdr.Direction direction = resolveDirection(srcUserId != null, dstUserId != null);
            Long agentUserId = srcUserId != null ? srcUserId : dstUserId;

            String externalNumber = srcUserId != null && dstUserId == null
                    ? r.dstNum()
                    : dstUserId != null && srcUserId == null
                        ? r.srcNum()
                        : null;
            Long clientId = externalNumber != null
                    ? clientRepository.findFirstByPhone(externalNumber).map(Client::getId).orElse(null)
                    : null;

            Cdr.Disposition disposition = parseDisposition(r.disposition());

            Cdr cdr = Cdr.ofImported(
                    r.linkedId(),
                    agentUserId,
                    clientId,
                    r.srcNum(),
                    r.dstNum(),
                    direction,
                    start,
                    end,
                    Math.max(r.billsec(), 0),
                    disposition);
            cdrRepository.save(cdr);
            imported++;
        }
        return new SyncResult(records.size(), imported, skipped);
    }

    private Map<String, Long> loadExtensionMap() {
        Map<String, Long> map = new HashMap<>();
        for (SipExtension ext : sipExtensionRepository.findAllByEnabledTrueOrderByExtensionNumberAsc()) {
            map.put(ext.getExtensionNumber(), ext.getUserId());
        }
        return map;
    }

    private static LocalDateTime parseStart(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDateTime.parse(raw, MIKO_FORMAT);
        } catch (RuntimeException e) {
            log.debug("CDR sync: timestamp inválido '{}'", raw);
            return null;
        }
    }

    private static Cdr.Direction resolveDirection(boolean srcInternal, boolean dstInternal) {
        if (srcInternal && dstInternal) return Cdr.Direction.INTERNAL;
        if (!srcInternal && dstInternal) return Cdr.Direction.INBOUND;
        return Cdr.Direction.OUTBOUND;
    }

    private static Cdr.Disposition parseDisposition(String raw) {
        if (raw == null) return Cdr.Disposition.FAILED;
        return switch (raw.trim().toUpperCase()) {
            case "ANSWERED" -> Cdr.Disposition.ANSWERED;
            case "NO ANSWER", "NO_ANSWER" -> Cdr.Disposition.NO_ANSWER;
            case "BUSY" -> Cdr.Disposition.BUSY;
            default -> Cdr.Disposition.FAILED;
        };
    }

    public record SyncResult(int total, int imported, int skipped) {
    }
}
