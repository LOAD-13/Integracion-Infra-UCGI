package com.ucgi.integrationapi.metrics;

import com.ucgi.integrationapi.cdr.Cdr;
import com.ucgi.integrationapi.cdr.CdrRepository;
import com.ucgi.integrationapi.cdr.CdrSpecifications;
import com.ucgi.integrationapi.error.ResourceNotFoundException;
import com.ucgi.integrationapi.sipextension.SipExtensionRepository;
import com.ucgi.integrationapi.user.User;
import com.ucgi.integrationapi.user.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MetricsService {

    private final CdrRepository cdrRepository;
    private final UserRepository userRepository;
    private final SipExtensionRepository sipExtensionRepository;

    public MetricsService(CdrRepository cdrRepository,
                          UserRepository userRepository,
                          SipExtensionRepository sipExtensionRepository) {
        this.cdrRepository = cdrRepository;
        this.userRepository = userRepository;
        this.sipExtensionRepository = sipExtensionRepository;
    }

    @Transactional(readOnly = true)
    public AgentMetricsResponse computeForUser(String username, LocalDate date) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuario autenticado no encontrado: " + username));
        Long agentUserId = user.getId();
        // Las llamadas internas entre extensiones cuentan en la métrica del
        // agente que ATIENDE también — si solo filtramos por agent_user_id,
        // los CDR donde el agente es el destino (callee) no aparecen.
        String extension = sipExtensionRepository.findByUserId(agentUserId)
                .map(e -> e.getExtensionNumber())
                .orElse("__none__");

        LocalDateTime from = date.atStartOfDay();
        LocalDateTime to = date.atTime(LocalTime.MAX);

        List<Cdr> cdrs = cdrRepository.findForAgentInRange(agentUserId, extension, from, to);

        long answered = 0;
        long missed = 0;
        long busy = 0;
        long failed = 0;
        long totalDurationSeconds = 0;
        Map<Integer, long[]> hourly = new HashMap<>();

        for (Cdr cdr : cdrs) {
            if (cdr.getDisposition() == Cdr.Disposition.ANSWERED) {
                answered++;
                totalDurationSeconds += cdr.getDurationSeconds();
            } else if (cdr.getDisposition() == Cdr.Disposition.NO_ANSWER) {
                missed++;
            } else if (cdr.getDisposition() == Cdr.Disposition.BUSY) {
                busy++;
            } else if (cdr.getDisposition() == Cdr.Disposition.FAILED) {
                failed++;
            }

            int hour = cdr.getStartTime() != null ? cdr.getStartTime().getHour() : 0;
            long[] bucket = hourly.computeIfAbsent(hour, k -> new long[2]);
            bucket[0]++;
            if (cdr.getDisposition() == Cdr.Disposition.ANSWERED) bucket[1]++;
        }

        long total = cdrs.size();
        double avg = answered > 0 ? (double) totalDurationSeconds / answered : 0;
        double rate = total > 0 ? (double) answered / total : 0;

        List<AgentMetricsResponse.HourlyBucket> byHour = new ArrayList<>();
        for (int h = 0; h < 24; h++) {
            long[] bucket = hourly.getOrDefault(h, new long[]{0, 0});
            byHour.add(new AgentMetricsResponse.HourlyBucket(h, bucket[0], bucket[1]));
        }

        return new AgentMetricsResponse(date.toString(), answered, missed, busy,
                failed, total, avg, rate, byHour);
    }

    @Transactional(readOnly = true)
    public AdminMetricsResponse computeForAdmin(LocalDate date) {
        LocalDateTime from = date.atStartOfDay();
        LocalDateTime to = date.atTime(LocalTime.MAX);

        List<Cdr> cdrs = cdrRepository.findAll(
                CdrSpecifications.startedAfter(from)
                        .and(CdrSpecifications.startedBefore(to)));

        // Mapeo extensión → user_id para poder sumar al callee en INTERNAL.
        Map<String, Long> extToUser = new HashMap<>();
        for (var ext : sipExtensionRepository.findAllByEnabledTrueOrderByExtensionNumberAsc()) {
            extToUser.put(ext.getExtensionNumber(), ext.getUserId());
        }

        long answered = 0;
        long missed = 0;
        long totalDur = 0;
        Map<Integer, long[]> hourly = new HashMap<>();
        // username -> [total, answered, durationSum]
        Map<Long, long[]> perAgent = new HashMap<>();

        for (Cdr c : cdrs) {
            int hour = c.getStartTime() != null ? c.getStartTime().getHour() : 0;
            long[] bucket = hourly.computeIfAbsent(hour, k -> new long[2]);

            // Agentes involucrados en esta llamada: el agent_user_id explícito
            // (caller, asignado por CdrSyncService) y para INTERNAL también el
            // callee si su extensión está mapeada a un user.
            java.util.Set<Long> involved = new java.util.HashSet<>();
            if (c.getAgentUserId() != null) involved.add(c.getAgentUserId());
            if (c.getDirection() == Cdr.Direction.INTERNAL) {
                Long calleeUser = extToUser.get(c.getCalleeNumber());
                if (calleeUser != null) involved.add(calleeUser);
            }

            for (Long userId : involved) {
                long[] agentAcc = perAgent.computeIfAbsent(userId, k -> new long[3]);
                agentAcc[0]++;
                if (c.getDisposition() == Cdr.Disposition.ANSWERED) {
                    agentAcc[1]++;
                    agentAcc[2] += c.getDurationSeconds();
                }
            }

            // Suma de participaciones (coherente con el ranking): cada agente
            // involucrado cuenta como una llamada. INTERNAL → 2, INBOUND/OUTBOUND
            // sin agente → 1 (para no perder la llamada).
            int participants = Math.max(involved.size(), 1);
            bucket[0] += participants;

            if (c.getDisposition() == Cdr.Disposition.ANSWERED) {
                answered += participants;
                totalDur += (long) c.getDurationSeconds() * participants;
                bucket[1] += participants;
            } else if (c.getDisposition() == Cdr.Disposition.NO_ANSWER
                    || c.getDisposition() == Cdr.Disposition.BUSY
                    || c.getDisposition() == Cdr.Disposition.FAILED) {
                missed += participants;
            }
        }

        long total = answered + missed;
        double avg = answered > 0 ? (double) totalDur / answered : 0;
        double rate = total > 0 ? (double) answered / total : 0;

        List<AgentMetricsResponse.HourlyBucket> byHour = new ArrayList<>();
        for (int h = 0; h < 24; h++) {
            long[] b = hourly.getOrDefault(h, new long[]{0, 0});
            byHour.add(new AgentMetricsResponse.HourlyBucket(h, b[0], b[1]));
        }

        List<User> allUsers = userRepository.findAll();
        long activeAgents = allUsers.stream()
                .filter(u -> !"ADMIN".equalsIgnoreCase(u.getRole()))
                .filter(u -> u.getAgentStatus() == User.AgentStatus.AVAILABLE)
                .count();
        long totalAgents = allUsers.stream()
                .filter(u -> !"ADMIN".equalsIgnoreCase(u.getRole()))
                .count();
        Map<Long, User> usersById = new HashMap<>();
        for (User u : allUsers) usersById.put(u.getId(), u);

        List<AdminMetricsResponse.AgentBreakdown> top = perAgent.entrySet().stream()
                .map(e -> {
                    User u = usersById.get(e.getKey());
                    long[] acc = e.getValue();
                    double agentAvg = acc[1] > 0 ? (double) acc[2] / acc[1] : 0;
                    return new AdminMetricsResponse.AgentBreakdown(
                            u != null ? u.getUsername() : "?",
                            u != null ? u.getFullName() : "?",
                            acc[0], acc[1], agentAvg);
                })
                .sorted(Comparator.comparingLong(AdminMetricsResponse.AgentBreakdown::totalCalls).reversed())
                .limit(5)
                .toList();

        return new AdminMetricsResponse(date.toString(), total, answered, missed,
                rate, avg, activeAgents, totalAgents, top, byHour);
    }
}
