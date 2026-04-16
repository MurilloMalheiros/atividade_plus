package com.plus.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// Ponto de entrada da aplicação Spring Boot.
 
@SpringBootApplication
// Classe de bootstrap da API.
 
public class ApiApplication {

	/**
	 * Inicializa o contexto Spring e sobe o servidor.
	 *
	 * @param args argumentos de linha de comando.
	 */
	public static void main(String[] args) {
		SpringApplication.run(ApiApplication.class, args);
	}

}
