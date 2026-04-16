package com.plus.api.dto;

import java.time.LocalDateTime;

/**
 * Ponto de serie temporal com media por avaliacao.
 */
public record AverageTimelinePoint(
        LocalDateTime createdAt,
        double averageScore
) {
}
