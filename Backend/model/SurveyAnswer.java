package com.plus.api.model;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Entity
@Table(name = "survey_answers")
/**
 * Entidade JPA que representa uma avaliacao preenchida pelo cliente.
 */
public class SurveyAnswer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 30)
    private String phone;

    @Column(length = 500)
    private String comment;

    @Column(name = "waiter_name", length = 120)
    private String waiterName;

    @Column(name = "waiter_service_score")
    private Integer waiterServiceScore;

    @Convert(converter = MapToJsonConverter.class)
    @Column(name = "answers_json", nullable = false, columnDefinition = "TEXT")
    private Map<String, Integer> answers = new LinkedHashMap<>();

    @Column(name = "created_at", nullable = false)
    private LocalDateTime ts;

    @PrePersist
    /**
     * Inicializa campos obrigatorios antes da persistencia.
     */
    void onCreate() {
        if (ts == null) {
            ts = LocalDateTime.now();
        }

        if (answers == null) {
            answers = new LinkedHashMap<>();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getWaiterName() {
        return waiterName;
    }

    public void setWaiterName(String waiterName) {
        this.waiterName = waiterName;
    }

    public Integer getWaiterServiceScore() {
        return waiterServiceScore;
    }

    public void setWaiterServiceScore(Integer waiterServiceScore) {
        this.waiterServiceScore = waiterServiceScore;
    }

    public Map<String, Integer> getAnswers() {
        return answers;
    }

    public void setAnswers(Map<String, Integer> answers) {
        this.answers = answers;
    }

    public LocalDateTime getTs() {
        return ts;
    }

    public void setTs(LocalDateTime ts) {
        this.ts = ts;
    }
}
