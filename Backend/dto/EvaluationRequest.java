package com.plus.api.dto;

import java.util.Map;

/**
 * DTO de entrada para registro de avaliacao do cliente.
 */
public record EvaluationRequest(
        String name,
        String phone,
        String comment,
        String waiterName,
        Integer waiterServiceScore,
        Map<String, Integer> answers
) {
}
