package com.plus.api.repository;

import com.plus.api.model.SurveyAnswer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Repositorio JPA de respostas do questionario.
 */
public interface SurveyAnswerRepository extends JpaRepository<SurveyAnswer, Long> {
    /**
     * Busca respostas em ordem cronologica crescente.
     *
     * @return lista de respostas.
     */
    List<SurveyAnswer> findAllByOrderByTsAsc();
}
