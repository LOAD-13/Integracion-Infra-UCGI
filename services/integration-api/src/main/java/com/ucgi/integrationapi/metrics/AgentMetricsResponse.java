package com.ucgi.integrationapi.metrics;

import java.util.List;

public record AgentMetricsResponse(
        String date,
        long answeredCount,
        long missedCount,
        long busyCount,
        long failedCount,
        long totalCount,
        double averageDurationSeconds,
        double answerRate,
        List<HourlyBucket> byHour
) {
    public record HourlyBucket(int hour, long total, long answered) {
    }
}
