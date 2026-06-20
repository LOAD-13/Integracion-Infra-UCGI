package com.ucgi.integrationapi.metrics;

import com.ucgi.integrationapi.cdr.Cdr;
import com.ucgi.integrationapi.cdr.CdrRepository;
import com.ucgi.integrationapi.cdr.CdrSpecifications;
import com.ucgi.integrationapi.error.ResourceNotFoundException;
import com.ucgi.integrationapi.user.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MetricsService {

    private final CdrRepository cdrRepository;
    private final UserRepository userRepository;

    public MetricsService(CdrRepository cdrRepository, UserRepository userRepository) {
        this.cdrRepository = cdrRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public AgentMetricsResponse computeForUser(String username, LocalDate date) {
        Long agentUserId = userRepository.findByUsername(username)
                .map(u -> u.getId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuario autenticado no encontrado: " + username));

        LocalDateTime from = date.atStartOfDay();
        LocalDateTime to = date.atTime(LocalTime.MAX);

        List<Cdr> cdrs = cdrRepository.findAll(
                CdrSpecifications.agentIs(agentUserId)
                        .and(CdrSpecifications.startedAfter(from))
                        .and(CdrSpecifications.startedBefore(to)));

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
}
