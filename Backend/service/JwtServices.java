package com.plus.api.service;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.security.Key;
import java.util.Date;


@Service
/**
 * Utilitario para emissao e validacao de tokens JWT.
 */
public class JwtServices {
    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private Long expiration;

    /**
     * Retorna a chave HMAC usada para assinar os tokens.
     *
     * @return chave derivada da propriedade jwt.secret.
     */
    private Key getKey(){
        return Keys.hmacShaKeyFor(secret.getBytes());
    }

    /**
     * Gera token JWT com subject e role.
     *
     * @param email identificador principal do usuario.
     * @param role papel do usuario para autorizacao no front.
     * @return token assinado.
     */
    public String generateToken(String email, String role){
        return Jwts.builder()
                .subject(email)
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getKey())
                .compact();
    }

    /**
     * Extrai o subject de um token.
     *
     * @param token JWT assinado.
     * @return subject do token.
     */
    public String extractEmail(String token){
        return Jwts.parser().verifyWith((javax.crypto.SecretKey) getKey())
                .build().parseSignedClaims(token).getPayload().getSubject();

    }
    /**
     * Valida formato, assinatura e expiracao do token.
     *
     * @param token JWT recebido.
     * @return verdadeiro quando o token e valido.
     */
    public boolean isValidToken(String token){
        try{
            Jwts.parser().verifyWith((javax.crypto.SecretKey) getKey() )
                    .build().parseSignedClaims(token);
            return true;
        } catch(Exception e){
            return false;
        }
    }
}
