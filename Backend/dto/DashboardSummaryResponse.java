package com.plus.api.dto;

import java.util.List;
import java.util.Map;

/**
 * DTO agregado do dashboard principal.
 */
public record DashboardSummaryResponse(
        long totalAnswers,
        double overallAverage,
        long goodAnswers,
        long badAnswers,
        Map<Integer, Long> overallDistribution,
        Map<String, Double> questionAverages,
        Map<String, Map<Integer, Long>> questionDistributions,
        Map<String, Long> classificationTotals,
        List<AverageTimelinePoint> averageTimeline,
        List<WaiterRankingItem> waiterRanking
) {
}
