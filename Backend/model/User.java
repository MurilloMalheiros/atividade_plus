package com.plus.api.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name= "users")

/**
 * Entidade JPA para credenciais e perfil de acesso.
 */
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;

    @Column(unique = true, nullable = false,  length = 100 )
    private String email;

    @Column(unique =  true, nullable = false, length = 100)
    private String  name;

    @Column(unique = false)
    private String  password;

    @Column(unique = false)
    private String  confirmPassword;

    @Column(unique = false)
    private String role = "admin";

    @Column(name = "created_at")
    private LocalDateTime createdAt =  LocalDateTime.now();

    //getter e setter
    public Long getId(){return id;}
    public Long gentId(){return id;}
    public String getEmail(){return email;}
    public void setEmail(String email){this.email = email;}
    public String getName(){return name;}
    public void setName(String name){this.name = name;}
    public String getPassword(){return password;}
    public void setPassword(String password){this.password = password;}
    public String getConfirmPassword(){return confirmPassword;}
    public void setConfirmPassword(String confirmPassword){this.confirmPassword = confirmPassword;}
    public String getRole(){return role;}
    public void setRole(String role){this.role = role;}
    public LocalDateTime getCreatedAt(){return createdAt;}
    public void setCreatedAt(LocalDateTime createdAt){this.createdAt = createdAt;}
}
