package com.plus.api.dto;

/**
 * DTO retornado no login com token, role e nome exibivel.
 */
public class AuthResponse {
    private String token;
    private String role;
    private String name;

    public AuthResponse(String token, String role, String name){
        this.role = role;
        this.name = name;
        this.token = token;
    }
    public String getToken(){ return token;}
    public String getRole(){ return  role;}
    public String getName(){ return name;}
}
