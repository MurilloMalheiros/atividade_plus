package com.plus.api.dto;

/**
 * DTO de entrada para autenticacao.
 * Suporta compatibilidade com campos antigos do front.
 */
public class LoginRequest {
    private String email;
    private String password;
    private String name;
    private String phone;
    private String telefone;

    public String getEmail(){ return email;}
    public void setEmail(String email){ this.email = email; }

    public String getPassword(){ return password;}
    public void setPassword(String password){ this.password = password; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getTelefone(){ return telefone;}
    public void setTelefone(String telefone){ this.telefone = telefone; }

    public String getLoginIdentifier() {
        if (email != null && !email.isBlank()) {
            return email.trim();
        }
        if (name != null && !name.isBlank()) {
            return name.trim();
        }
        return null;
    }

    public String getLoginSecret() {
        if (password != null && !password.isBlank()) {
            return password.trim();
        }
        if (phone != null && !phone.isBlank()) {
            return phone.trim();
        }
        if (telefone != null && !telefone.isBlank()) {
            return telefone.trim();
        }
        return null;
    }
}
