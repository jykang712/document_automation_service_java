package com.pickle.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import java.io.ByteArrayOutputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

class RuleGuidePdfServiceTest {
    @Test void extractsRealPdfText() throws Exception {
        byte[] bytes;
        try (var doc = new PDDocument(); var output = new ByteArrayOutputStream()) {
            var page = new PDPage(); doc.addPage(page);
            try (var stream = new PDPageContentStream(doc, page)) {
                stream.beginText(); stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                stream.newLineAtOffset(40, 700); stream.showText("Travel requests need manager approval."); stream.endText();
            }
            doc.save(output); bytes = output.toByteArray();
        }
        var result = new RuleGuidePdfService().extract(new MockMultipartFile("guide_file", "guide.pdf", "application/pdf", bytes));
        assertTrue(result.text().contains("Travel requests"));
        assertEquals(1, result.pages());
    }
    @Test void rejectsNonPdfAndOversize() {
        var service = new RuleGuidePdfService();
        assertThrows(ResponseStatusException.class, () -> service.extract(new MockMultipartFile("guide_file", "fake.pdf", "application/pdf", "not PDF".getBytes())));
        var large = new MockMultipartFile("guide_file", "large.pdf", "application/pdf", new byte[5 * 1024 * 1024 + 1]);
        assertThrows(ResponseStatusException.class, () -> service.extract(large));
    }
}
