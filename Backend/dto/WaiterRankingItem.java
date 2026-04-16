package com.plus.api.dto;

/**
 * DTO com consolidado de desempenho por garcom.
 */
public record WaiterRankingItem(
        String waiterName,
        double averageScore,
        long totalEvaluations
) {
}
