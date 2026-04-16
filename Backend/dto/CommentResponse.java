package com.plus.api.dto;

import java.time.LocalDateTime;

/**
 * DTO de saida para listagem de comentarios no painel.
 */
public record CommentResponse(
        Long id,
        String name,
        String comment,
        double averageScore,
        String classification,
        LocalDateTime createdAt
) {
}
