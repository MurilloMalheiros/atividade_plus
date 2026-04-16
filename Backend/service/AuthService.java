package com.plus.api.service;


import com.plus.api.dto.*;
import com.plus.api.model.User;
import com.plus.api.repository.UseRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
/**
 * Camada de autenticacao para login administrativo e usuarios de restaurante.
 */
public class AuthService {

    private final UseRepository useRepository;
    private final JwtServices jwtServices;
    private final PasswordEncoder passwordEncoder;

    @Value("${admin.username}")
    private String adminUsername;

    @Value("${admin.password}")
    private String adminPassword;

    public AuthService(UseRepository useRepository, JwtServices jwtServices, PasswordEncoder passwordEncoder){
        this.useRepository = useRepository;
        this.jwtServices = jwtServices;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Processa o login com fallback para admin fixo e usuarios em banco.
     *
     * @param loginRequest credenciais recebidas do front.
     * @return token com papel do usuario ou retorno nulo para credenciais invalidas.
     */
    public AuthResponse login(LoginRequest loginRequest){
        if (loginRequest == null) {
            return new AuthResponse(null, null, null);
        }

        String identifier = loginRequest.getLoginIdentifier();
        String secret = loginRequest.getLoginSecret();

        if (identifier == null || secret == null) {
            return new AuthResponse(null, null, null);
        }

        // Compatibilidade com o front atual: admin/admin123 em application.properties
        if (identifier.equals(adminUsername) && secret.equals(adminPassword)) {
            String token = jwtServices.generateToken(adminUsername, "ADMIN");
            return new AuthResponse(token, "admin", "administrador");
        }

        // Fallback para usuário armazenado no banco (users.email + users.password BCrypt)
        Optional<User> userOptional = useRepository.findByEmail(identifier);
        AuthResponse responseFromDb = authenticateUser(userOptional, secret);
        if (responseFromDb != null) {
            return responseFromDb;
        }

        // Front usa "Nome" no campo de login; tentamos por name também.
        userOptional = useRepository.findByName(identifier);
        responseFromDb = authenticateUser(userOptional, secret);
        if (responseFromDb != null) {
            return responseFromDb;
        }

        return new AuthResponse(null, null, null);
    }

    private AuthResponse authenticateUser(Optional<User> userOptional, String secret) {
        if (userOptional.isEmpty()) {
            return null;
        }

        User user = userOptional.get();
        String dbPassword = user.getPassword();
        if (dbPassword == null || !passwordMatches(secret, dbPassword)) {
            return null;
        }

        String role = user.getRole() == null || user.getRole().isBlank()
                ? "user"
                : user.getRole().toLowerCase();
        String subject = user.getEmail() != null && !user.getEmail().isBlank()
                ? user.getEmail()
                : user.getName();
        String token = jwtServices.generateToken(subject, role.toUpperCase());
        String displayName = user.getName() == null || user.getName().isBlank()
                ? subject
                : user.getName();
        return new AuthResponse(token, role, displayName);
    }

    /**
     * Compara senha pura com hash BCrypt ou valor legado em texto puro.
     *
     * @param rawSecret senha enviada.
     * @param storedPassword senha persistida.
     * @return verdadeiro quando a senha confere.
     */
    private boolean passwordMatches(String rawSecret, String storedPassword) {
        String normalized = storedPassword.trim();
        boolean looksLikeBcrypt = normalized.startsWith("$2a$")
                || normalized.startsWith("$2b$")
                || normalized.startsWith("$2y$");

        if (looksLikeBcrypt) {
            return passwordEncoder.matches(rawSecret, normalized);
        }

        // Compatibilidade temporária para registros legados sem hash
        return normalized.equals(rawSecret);
    }

}
