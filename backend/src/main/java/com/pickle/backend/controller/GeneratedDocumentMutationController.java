package com.pickle.backend.controller;

import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.dto.GeneratedDocumentUpdateRequest;
import com.pickle.backend.security.ApplicationPrincipal;
import com.pickle.backend.service.GeneratedDocumentMutationService;

@RestController
@RequestMapping("/api/generated-documents")
public class GeneratedDocumentMutationController {
    private final GeneratedDocumentMutationService service;

    public GeneratedDocumentMutationController(GeneratedDocumentMutationService service) {
        this.service = service;
    }

    @PatchMapping("/{id}")
    public Map<String, Object> update(@PathVariable("id") Long id,
            @AuthenticationPrincipal ApplicationPrincipal principal,
            @RequestBody GeneratedDocumentUpdateRequest request) {
        return service.update(actorId(principal), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") Long id,
            @AuthenticationPrincipal ApplicationPrincipal principal) {
        service.delete(actorId(principal), id);
        return ResponseEntity.noContent().build();
    }

    private static Long actorId(ApplicationPrincipal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }
        return principal.getId();
    }

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
