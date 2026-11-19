package com.pickle.backend.exception;

import java.sql.SQLException;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.controller.OrgMemberController;

@RestControllerAdvice(assignableTypes = OrgMemberController.class)
public class OrgMemberExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(OrgMemberExceptionHandler.class);

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleRequest(ResponseStatusException ex) {
        String detail = ex.getReason() == null ? "요청 처리에 실패했습니다." : ex.getReason();
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("detail", detail));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> handleJson(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest()
                .body(Map.of("detail", "요청 본문은 올바른 JSON 객체여야 합니다."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleConstraint(DataIntegrityViolationException ex) {
        // 사전 중복 확인 이후 다른 요청이 먼저 저장한 경우를 처리합니다.
        // 이 등록 경로에서 사용자가 지정하는 UNIQUE 값은 이메일입니다.
        for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql && sql.getErrorCode() == 1062) {
                return ResponseEntity.badRequest()
                        .body(Map.of("detail", "이미 등록된 이메일입니다."));
            }
        }
        log.error("조직원 저장 중 데이터 무결성 오류", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("detail", "조직원 저장 중 오류가 발생했습니다."));
    }
}
