package com.plus.api.cotroller;

import com.plus.api.dto.AnswerSummaryResponse;
import com.plus.api.dto.AuthResponse;
import com.plus.api.dto.CommentResponse;
import com.plus.api.dto.DashboardSummaryResponse;
import com.plus.api.dto.EvaluationRequest;
import com.plus.api.dto.LoginRequest;
import com.plus.api.model.SurveyAnswer;
import com.plus.api.service.AuthService;
import com.plus.api.service.SurveyAnswerService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Controller principal da API.
 * Reúne autenticação, cadastro de respostas e endpoints de leitura do dashboard.
 */
@RestController
public class HelloController {
    private final SurveyAnswerService surveyAnswerService;
    private final AuthService authService;

    public HelloController(SurveyAnswerService surveyAnswerService, AuthService authService) {
        this.surveyAnswerService = surveyAnswerService;
        this.authService = authService;
    }

    /**
     * Endpoint de healthcheck simples.
     *
     * @return mensagem de status.
     */
    @GetMapping("/hello")
    public String hello() {
        return "api funcionando";
    }

    /**
     * Realiza autenticacao do usuario e retorna token/role.
     *
     * @param loginRequest credenciais enviadas pelo cliente.
     * @return payload de autenticacao ou erro 401.
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest loginRequest) {
        AuthResponse response = authService.login(loginRequest);

        if (response.getToken() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Credenciais invalidas"));
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Lista respostas cruas do banco.
     *
     * @return respostas ordenadas por data de criacao.
     */
    @GetMapping("/answers")
    public List<SurveyAnswer> listAnswers() {
        return surveyAnswerService.listAll();
    }

    /**
     * Lista respostas enriquecidas com media e classificacao.
     *
     * @return respostas detalhadas para uso no dashboard.
     */
    @GetMapping("/answers/details")
    public List<AnswerSummaryResponse> listDetailedAnswers() {
        return surveyAnswerService.listDetailedAnswers();
    }

    /**
     * Lista apenas comentarios validos das avaliacoes.
     *
     * @return lista de comentarios com dados resumidos.
     */
    @GetMapping("/comments")
    public List<CommentResponse> listComments() {
        return surveyAnswerService.listComments();
    }

    /**
     * Retorna resumo consolidado para visualizacao do dashboard.
     *
     * @return agregados gerais e por pergunta.
     */
    @GetMapping("/dashboard/summary")
    public DashboardSummaryResponse getDashboardSummary() {
        return surveyAnswerService.getDashboardSummary();
    }

    /**
     * Persiste uma nova avaliacao enviada pelo formulario.
     *
     * @param request resposta da avaliacao.
     * @return recurso criado ou erro de validacao.
     */
    @PostMapping("/answers")
    public ResponseEntity<?> createAnswer(@RequestBody EvaluationRequest request) {
        try {
            SurveyAnswer savedAnswer = surveyAnswerService.create(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(savedAnswer);
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
        }
    }
}
