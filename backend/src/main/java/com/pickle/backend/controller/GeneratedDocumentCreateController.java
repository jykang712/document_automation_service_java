package com.pickle.backend.controller;

import java.net.URI;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import com.pickle.backend.dto.GeneratedDocumentCreateRequest;
import com.pickle.backend.security.ApplicationPrincipal;
import com.pickle.backend.service.GeneratedDocumentCreateService;

@RestController
@RequestMapping("/api/generated-documents")
public class GeneratedDocumentCreateController {
    private final GeneratedDocumentCreateService service;

    public GeneratedDocumentCreateController(GeneratedDocumentCreateService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            @AuthenticationPrincipal ApplicationPrincipal principal,
            @RequestBody GeneratedDocumentCreateRequest request) {
        if (principal == null) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "로그인이 필요합니다.");
        }
        var result = service.create(principal.getId(), request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(result.get("id")).toUri();
        return ResponseEntity.created(location).body(result);
    }

    // 기존 AuthApiExceptionHandler는 조회 Controller 등에만 적용되므로 생성 오류를 여기서 처리합니다.
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleRequest(ResponseStatusException ex) {
        String detail = ex.getReason() == null ? "요청을 처리할 수 없습니다." : ex.getReason();
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("detail", detail));
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
