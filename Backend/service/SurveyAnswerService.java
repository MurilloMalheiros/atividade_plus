package com.plus.api.service;

import com.plus.api.dto.AnswerSummaryResponse;
import com.plus.api.dto.AverageTimelinePoint;
import com.plus.api.dto.CommentResponse;
import com.plus.api.dto.DashboardSummaryResponse;
import com.plus.api.dto.EvaluationRequest;
import com.plus.api.dto.WaiterRankingItem;
import com.plus.api.model.SurveyAnswer;
import com.plus.api.repository.SurveyAnswerRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
/**
 * Camada de servico responsavel por validar, salvar e agregar avaliacoes.
 */
public class SurveyAnswerService {
    private final SurveyAnswerRepository surveyAnswerRepository;

    public SurveyAnswerService(SurveyAnswerRepository surveyAnswerRepository) {
        this.surveyAnswerRepository = surveyAnswerRepository;
    }

    /**
     * Busca todas as respostas cadastradas.
     *
     * @return lista ordenada por data de criacao.
     */
    public List<SurveyAnswer> listAll() {
        return surveyAnswerRepository.findAllByOrderByTsAsc();
    }

    /**
     * Monta resposta detalhada para exibicao de historico.
     *
     * @return lista detalhada com media e classificacao.
     */
    public List<AnswerSummaryResponse> listDetailedAnswers() {
        return surveyAnswerRepository.findAllByOrderByTsAsc().stream()
                .sorted(Comparator.comparing(SurveyAnswer::getTs).reversed())
                .map(this::toAnswerSummary)
                .toList();
    }

    /**
     * Filtra comentarios nao vazios para exibicao no painel.
     *
     * @return comentarios mais recentes primeiro.
     */
    public List<CommentResponse> listComments() {
        return surveyAnswerRepository.findAllByOrderByTsAsc().stream()
                .filter(answer -> answer.getComment() != null && !answer.getComment().isBlank())
                .sorted(Comparator.comparing(SurveyAnswer::getTs).reversed())
                .map(answer -> new CommentResponse(
                        answer.getId(),
                        answer.getName(),
                        answer.getComment(),
                        calculateAverage(answer.getAnswers()),
                        classify(answer.getAnswers()),
                        answer.getTs()
                ))
                .toList();
    }

    /**
     * Agrega estatisticas gerais e por pergunta para o dashboard.
     *
     * @return resumo consolidado das avaliacoes.
     */
    public DashboardSummaryResponse getDashboardSummary() {
        List<SurveyAnswer> answers = surveyAnswerRepository.findAllByOrderByTsAsc();
        Map<Integer, Long> overallDistribution = createStarMap();
        Map<String, Long> classificationTotals = createClassificationMap();
        Map<String, Double> questionAverages = new LinkedHashMap<>();
        Map<String, Map<Integer, Long>> questionDistributions = new LinkedHashMap<>();
        List<AverageTimelinePoint> averageTimeline = new ArrayList<>();
        List<WaiterRankingItem> waiterRanking = new ArrayList<>();

        double overallAverage = 0.0;

        if (!answers.isEmpty()) {
            List<AnswerSummaryResponse> detailedAnswers = answers.stream()
                    .map(this::toAnswerSummary)
                    .toList();

            averageTimeline = detailedAnswers.stream()
                    .map(answer -> new AverageTimelinePoint(answer.createdAt(), answer.averageScore()))
                    .toList();

            overallAverage = round(detailedAnswers.stream()
                    .mapToDouble(AnswerSummaryResponse::averageScore)
                    .average()
                    .orElse(0.0));

            for (AnswerSummaryResponse answer : detailedAnswers) {
                int roundedAverage = Math.max(1, Math.min(5, (int) Math.round(answer.averageScore())));
                overallDistribution.compute(roundedAverage, (key, value) -> value + 1);
                classificationTotals.compute(answer.classification(), (key, value) -> value + 1);
            }

            Map<String, List<Integer>> groupedScores = new LinkedHashMap<>();
            for (SurveyAnswer answer : answers) {
                for (Map.Entry<String, Integer> entry : answer.getAnswers().entrySet()) {
                    groupedScores.computeIfAbsent(entry.getKey(), key -> new ArrayList<>())
                            .add(entry.getValue());
                }
            }

            for (Map.Entry<String, List<Integer>> entry : groupedScores.entrySet()) {
                questionAverages.put(entry.getKey(), calculateAverage(entry.getValue()));

                Map<Integer, Long> distribution = createStarMap();
                for (Integer score : entry.getValue()) {
                    distribution.compute(score, (key, value) -> value + 1);
                }
                questionDistributions.put(entry.getKey(), distribution);
            }

            waiterRanking = buildWaiterRanking(answers);
        }

        long goodAnswers = classificationTotals.get("boa");
        long badAnswers = answers.size() - goodAnswers;

        return new DashboardSummaryResponse(
                answers.size(),
                overallAverage,
                goodAnswers,
                badAnswers,
                overallDistribution,
                questionAverages,
                questionDistributions,
                classificationTotals,
                averageTimeline,
                waiterRanking
        );
    }

    /**
     * Valida e persiste uma nova resposta.
     *
     * @param request payload da avaliacao.
     * @return entidade salva.
     */
    public SurveyAnswer create(EvaluationRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Avaliacao nao informada.");
        }

        String name = normalizeRequired(request.name(), "Nome obrigatorio.");
        String phone = normalizeRequired(request.phone(), "Telefone obrigatorio.");
        Map<String, Integer> answers = normalizeAnswers(request.answers());
        String comment = normalizeOptional(request.comment());
        String waiterName = normalizeOptional(request.waiterName());
        Integer waiterServiceScore = normalizeOptionalScore(request.waiterServiceScore());

        SurveyAnswer surveyAnswer = new SurveyAnswer();
        surveyAnswer.setName(name);
        surveyAnswer.setPhone(phone);
        surveyAnswer.setComment(comment);
        surveyAnswer.setWaiterName(waiterName);
        surveyAnswer.setWaiterServiceScore(waiterServiceScore);
        surveyAnswer.setAnswers(answers);

        return surveyAnswerRepository.save(surveyAnswer);
    }

    private AnswerSummaryResponse toAnswerSummary(SurveyAnswer answer) {
        return new AnswerSummaryResponse(
                answer.getId(),
                answer.getName(),
                answer.getPhone(),
                answer.getComment(),
                answer.getWaiterName(),
                answer.getWaiterServiceScore(),
                answer.getAnswers(),
                calculateAverage(answer.getAnswers()),
                classify(answer.getAnswers()),
                answer.getTs()
        );
    }

    private double calculateAverage(Map<String, Integer> answers) {
        if (answers == null || answers.isEmpty()) {
            return 0.0;
        }

        return round(answers.values().stream()
                .mapToInt(Integer::intValue)
                .average()
                .orElse(0.0));
    }

    private double calculateAverage(List<Integer> answers) {
        if (answers == null || answers.isEmpty()) {
            return 0.0;
        }

        return round(answers.stream()
                .mapToInt(Integer::intValue)
                .average()
                .orElse(0.0));
    }

    private String classify(Map<String, Integer> answers) {
        double average = calculateAverage(answers);

        if (average < 3.0) {
            return "ruim";
        }

        if (average < 4.0) {
            return "regular";
        }

        return "boa";
    }

    private Map<Integer, Long> createStarMap() {
        Map<Integer, Long> starMap = new LinkedHashMap<>();
        for (int star = 1; star <= 5; star++) {
            starMap.put(star, 0L);
        }
        return starMap;
    }

    private Map<String, Long> createClassificationMap() {
        Map<String, Long> classificationMap = new LinkedHashMap<>();
        classificationMap.put("ruim", 0L);
        classificationMap.put("regular", 0L);
        classificationMap.put("boa", 0L);
        return classificationMap;
    }

    private double round(double value) {
        return BigDecimal.valueOf(value)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private String normalizeRequired(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }

        return value.trim();
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private Map<String, Integer> normalizeAnswers(Map<String, Integer> answers) {
        if (answers == null || answers.isEmpty()) {
            throw new IllegalArgumentException("Respostas obrigatorias.");
        }

        Map<String, Integer> normalizedAnswers = new LinkedHashMap<>();
        for (Map.Entry<String, Integer> entry : answers.entrySet()) {
            String question = entry.getKey() == null ? "" : entry.getKey().trim();
            Integer score = entry.getValue();

            if (question.isBlank()) {
                throw new IllegalArgumentException("As perguntas avaliadas precisam ter identificacao.");
            }
            if (score == null || score < 1 || score > 5) {
                throw new IllegalArgumentException("As notas precisam estar entre 1 e 5.");
            }

            normalizedAnswers.put(question, score);
        }

        if (normalizedAnswers.isEmpty()) {
            throw new IllegalArgumentException("Respostas obrigatorias.");
        }

        return normalizedAnswers;
    }

    private Integer normalizeOptionalScore(Integer score) {
        if (score == null) {
            return null;
        }

        if (score < 0 || score > 5) {
            throw new IllegalArgumentException("A nota do atendimento do garcom precisa estar entre 0 e 5.");
        }

        return score;
    }

    private List<WaiterRankingItem> buildWaiterRanking(List<SurveyAnswer> answers) {
        Map<String, WaiterAccumulator> waiters = new LinkedHashMap<>();

        for (SurveyAnswer answer : answers) {
            String waiterName = normalizeOptional(answer.getWaiterName());
            if (waiterName == null) {
                continue;
            }

            Integer waiterScore = answer.getWaiterServiceScore();
            if (waiterScore == null) {
                waiterScore = answer.getAnswers().get("atendimentoEquipe");
            }

            if (waiterScore == null || waiterScore < 0 || waiterScore > 5) {
                continue;
            }

            WaiterAccumulator accumulator = waiters.computeIfAbsent(waiterName, key -> new WaiterAccumulator());
            accumulator.total += waiterScore;
            accumulator.count += 1;
        }

        return waiters.entrySet().stream()
                .filter(entry -> entry.getValue().count > 0)
                .map(entry -> new WaiterRankingItem(
                        entry.getKey(),
                        round(entry.getValue().total / entry.getValue().count),
                        entry.getValue().count
                ))
                .sorted(Comparator
                        .comparing(WaiterRankingItem::averageScore).reversed()
                        .thenComparing(WaiterRankingItem::totalEvaluations, Comparator.reverseOrder())
                        .thenComparing(item -> item.waiterName().toLowerCase()))
                .toList();
    }

    private static class WaiterAccumulator {
        private double total;
        private long count;
    }
}
