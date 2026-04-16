package com.plus.api.model;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.LinkedHashMap;
import java.util.Map;

@Converter
/**
 * Conversor JPA entre Map<String, Integer> e coluna JSON em texto.
 */
public class MapToJsonConverter implements AttributeConverter<Map<String, Integer>, String> {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeReference<LinkedHashMap<String, Integer>> MAP_TYPE = new TypeReference<>() { };

    @Override
    /**
     * Serializa o mapa para JSON antes de salvar no banco.
     */
    public String convertToDatabaseColumn(Map<String, Integer> attribute) {
        try {
            return OBJECT_MAPPER.writeValueAsString(attribute == null ? Map.of() : attribute);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Nao foi possivel serializar as respostas.", exception);
        }
    }

    @Override
    /**
     * Desserializa JSON para mapa ao ler o registro do banco.
     */
    public Map<String, Integer> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return new LinkedHashMap<>();
        }

        try {
            return OBJECT_MAPPER.readValue(dbData, MAP_TYPE);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Nao foi possivel ler as respostas salvas.", exception);
        }
    }
}
