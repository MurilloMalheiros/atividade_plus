package com.plus.api.cotroller;

import com.plus.api.pdfGenaretor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController

/**
 * Exponibiliza endpoint para download de PDF de teste.
 */
public class PdfController {
    /**
     * Gera e retorna um PDF em anexo.
     *
     * @return resposta HTTP contendo arquivo PDF.
     */
    @GetMapping("/gerar-pdf")
    public ResponseEntity<byte[]> gerarPdf() {

        byte[] pdf = pdfGenaretor.gerarpdf();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=arquivo.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
