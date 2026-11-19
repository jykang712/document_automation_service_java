package com.pickle.backend.exception;

import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.controller.DocumentTemplateAdminController;
import com.pickle.backend.controller.DocumentTemplateSelectionController;

@RestControllerAdvice(assignableTypes = {
        DocumentTemplateAdminController.class, DocumentTemplateSelectionController.class
})
public class DocumentTemplateApiExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleRequest(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("detail",
                ex.getReason() == null ? "요청을 처리할 수 없습니다." : ex.getReason()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> handleJson(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest().body(Map.of("detail", "JSON 형식과 입력값을 확인해 주세요."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleConstraint(DataIntegrityViolationException ex) {
        return ResponseEntity.status(409).body(Map.of("detail", "데이터 제약으로 저장할 수 없습니다."));
    }
}
