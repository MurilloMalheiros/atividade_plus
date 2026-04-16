package com.plus.api.repository;

import com.plus.api.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

/**
 * Repositorio JPA de usuarios da plataforma.
 */
public interface UseRepository extends JpaRepository<User, Long> {
    /**
     * Busca usuario por email.
     *
     * @param email email cadastrado.
     * @return usuario, quando existir.
     */
    Optional<User> findByEmail(String email);

    /**
     * Busca usuario por nome.
     *
     * @param name nome cadastrado.
     * @return usuario, quando existir.
     */
    Optional<User> findByName(String name);

    /**
     * Verifica existencia de email.
     *
     * @param email email a consultar.
     * @return verdadeiro quando existe.
     */
    boolean existsByEmail(String email);
}
