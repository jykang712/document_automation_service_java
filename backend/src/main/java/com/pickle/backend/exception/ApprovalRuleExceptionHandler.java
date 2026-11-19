package com.pickle.backend.exception;

import java.util.Map;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.controller.ApprovalRuleController;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = ApprovalRuleController.class)
public class ApprovalRuleExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> status(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("detail", ex.getReason() == null ? "규칙을 처리하지 못했습니다." : ex.getReason()));
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> conflict(DataIntegrityViolationException ex) {
        return error(HttpStatus.CONFLICT, "참조 정보가 변경되었습니다. 새로고침 후 다시 시도하세요.");
    }
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> invalid(HttpMessageNotReadableException ex) { return error(HttpStatus.BAD_REQUEST, "JSON 입력값 형식을 확인하세요."); }
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> large(MaxUploadSizeExceededException ex) { return error(HttpStatus.CONTENT_TOO_LARGE, "PDF는 5MB 이하여야 합니다."); }
    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String message) { return ResponseEntity.status(status).body(Map.of("detail", message)); }
}
