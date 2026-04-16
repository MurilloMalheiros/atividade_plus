package com.plus.api;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Paragraph;

import java.io.ByteArrayOutputStream;


/**
 * Utilitário simples para geração de PDF em memória via iText.
 */
public class pdfGenaretor {
    /**
     * Gera um PDF simples em memoria.
     *
     * @return bytes do arquivo PDF.
     */
    public static byte[] gerarpdf(){
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdf = new PdfDocument(writer);
        Document document = new Document(pdf);


        document.add(new Paragraph("Olá caras!"));
        document.add(new Paragraph("Esse PDF foi gerado com Java."));

        document.close();

        return baos.toByteArray();

    }
}
