package com.pickle.backend.controller;

import java.util.Map;
import com.pickle.backend.security.ApplicationPrincipal;
import com.pickle.backend.service.AvailableApprovalRuleService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/available-approval-rules")
public class ApprovalRuleSelectionController {
    private final AvailableApprovalRuleService service;
    public ApprovalRuleSelectionController(AvailableApprovalRuleService service) { this.service = service; }

    @GetMapping
    public Map<String, Object> list(@AuthenticationPrincipal ApplicationPrincipal principal,
            @RequestParam("template_id") Long templateId) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        return service.available(principal.getId(), templateId);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> failure(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("detail", ex.getReason() == null ? "규칙을 조회하지 못했습니다." : ex.getReason()));
    }
    @ExceptionHandler({org.springframework.web.bind.ServletRequestBindingException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, String>> invalidRequest(Exception ex) {
        return ResponseEntity.badRequest().body(Map.of("detail", "template_id는 양의 정수여야 합니다."));
    }
}
