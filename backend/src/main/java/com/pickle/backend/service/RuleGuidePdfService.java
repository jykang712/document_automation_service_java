package com.pickle.backend.service;

import java.io.IOException;
import java.io.Writer;
import java.util.Locale;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.dto.ApprovalRuleDraft;

@Service
public class RuleGuidePdfService {
    public record Guide(String name, String text, int pages) {}
    public Guide extract(MultipartFile file) {
        if (file == null || file.isEmpty()) throw ApprovalRuleDraft.bad("PDF 지침서를 선택하세요.");
        if (file.getSize() > 5 * 1024 * 1024L) throw new ResponseStatusException(HttpStatus.CONTENT_TOO_LARGE, "PDF는 5MB 이하여야 합니다.");
        String name = file.getOriginalFilename() == null ? "guide.pdf" : file.getOriginalFilename().replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1);
        if (!name.toLowerCase(Locale.ROOT).endsWith(".pdf")) throw ApprovalRuleDraft.bad("PDF 파일만 지원합니다.");
        name = ApprovalRuleDraft.text(name, "지침서 파일명", 255, true);
        try {
            byte[] bytes = file.getBytes();
            if (bytes.length < 5 || !new String(bytes, 0, 5, java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-")) throw ApprovalRuleDraft.bad("유효한 PDF 파일이 아닙니다.");
            try (var doc = Loader.loadPDF(bytes)) {
                if (doc.isEncrypted()) throw ApprovalRuleDraft.bad("암호화된 PDF는 지원하지 않습니다.");
                if (doc.getNumberOfPages() < 1 || doc.getNumberOfPages() > 100) throw ApprovalRuleDraft.bad("PDF는 1~100페이지여야 합니다.");
                var output = new BoundedText();
                var stripper = new PDFTextStripper();
                stripper.setSortByPosition(true);
                stripper.writeText(doc, output);
                String text = output.toString().strip();
                if (text.isEmpty()) throw ApprovalRuleDraft.bad("텍스트를 추출할 수 없습니다. 스캔 이미지 PDF는 지원하지 않습니다.");
                return new Guide(name, text, doc.getNumberOfPages());
            }
        } catch (LimitExceeded ex) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_CONTENT, "PDF 텍스트가 20,000자를 넘습니다. 필요한 지침 부분만 별도 PDF로 저장하세요.");
        } catch (IOException ex) {
            throw ApprovalRuleDraft.bad("PDF를 읽을 수 없습니다. 암호나 파일 손상 여부를 확인하세요.");
        }
    }
    private static final class LimitExceeded extends IOException { private static final long serialVersionUID = 1L; }
    private static final class BoundedText extends Writer {
        private final StringBuilder text = new StringBuilder();
        @Override public void write(char[] chars, int offset, int length) throws IOException {
            if (text.length() + length > 20000) throw new LimitExceeded();
            text.append(chars, offset, length);
        }
        @Override public void flush() {}
        @Override public void close() {}
        @Override public String toString() { return text.toString(); }
    }
}
