package com.plus.api;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Configuração de segurança HTTP e encoder de senha.
 * Atualmente os endpoints do projeto estão liberados (permitAll) por compatibilidade com o front.
 */
@Configuration
@EnableWebSecurity
/**
 * Define regras de seguranca HTTP da aplicacao.
 */
public class ConfigSeguranca {

    /**
     * Encoder padrao para armazenamento e validacao de senha.
     *
     * @return encoder BCrypt.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Filtro de seguranca principal.
     *
     * @param http configuracao HTTP do Spring Security.
     * @return cadeia de filtros aplicada.
     * @throws Exception erro de configuracao.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/",
                                "/hello",
                                "/answers",
                                "/answers/details",
                                "/comments",
                                "/dashboard/summary",
                                "/gerar-pdf",
                                "/login",
                                "/site/**",
                                "/questionario/**",
                                "/delivery/**"
                        ).permitAll()
                        .anyRequest().permitAll()
                );

        return http.build();
    }
}
