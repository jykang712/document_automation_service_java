package com.pickle.backend.exception;

import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.controller.DocxTemplateImportController;

@RestControllerAdvice(assignableTypes = DocxTemplateImportController.class)
public class DocxTemplateApiExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handle(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("detail",
                ex.getReason() == null ? "요청을 처리할 수 없습니다." : ex.getReason()));
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> constraint(DataIntegrityViolationException ex) {
        return ResponseEntity.status(409).body(Map.of("detail", "양식 저장 중 DB 제약 오류가 발생했습니다."));
    }
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> tooLarge(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(413).body(Map.of("detail", "업로드 허용 크기를 초과했습니다."));
    }
}
