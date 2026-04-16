package com.plus.api.dto;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * DTO de saida com detalhes de uma resposta individual.
 */
public record AnswerSummaryResponse(
        Long id,
        String name,
        String phone,
        String comment,
        String waiterName,
        Integer waiterServiceScore,
        Map<String, Integer> answers,
        double averageScore,
        String classification,
        LocalDateTime createdAt
) {
}
