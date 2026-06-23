package com.ucgi.integrationapi.metrics;

import java.util.List;

public record AdminMetricsResponse(
        String date,
        long totalCalls,
        long answeredCalls,
        long missedCalls,
        double answerRate,
        double averageHandleSeconds,
        long activeAgents,
        long totalAgents,
        List<AgentBreakdown> topAgents,
        List<AgentMetricsResponse.HourlyBucket> byHour
) {
    public record AgentBreakdown(
            String username,
            String fullName,
            long totalCalls,
            long answeredCalls,
            double averageHandleSeconds
    ) {
    }
}
