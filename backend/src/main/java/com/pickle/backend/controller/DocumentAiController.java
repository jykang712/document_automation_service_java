package com.pickle.backend.controller;

import java.util.Map;
import com.pickle.backend.security.ApplicationPrincipal;
import com.pickle.backend.service.DocumentAiService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class DocumentAiController {
    private final DocumentAiService service;
    public DocumentAiController(DocumentAiService service) { this.service = service; }

    @PostMapping(
    	    value = "/templates/recommend-fields",
    	    consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    	)
    	public Map<String, Object> templateFields(
    	        @AuthenticationPrincipal ApplicationPrincipal principal,
    	        @RequestParam("file") MultipartFile file,
    	        @RequestParam("source_sha256") String sourceSha,
    	        @RequestParam(value = "template_name", defaultValue = "") String name) {

    	    return service.templateFields(
    	            actor(principal), file, sourceSha, name);
    	}

    @PostMapping(
    	    value = "/generated-documents/draft",
    	    consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    	)
    	public Map<String, Object> documentDraft(
    	        @AuthenticationPrincipal ApplicationPrincipal principal,
    	        @RequestParam("template_id") Long templateId,
    	        @RequestParam(value = "description", defaultValue = "") String description,
    	        @RequestParam(value = "current_values", defaultValue = "{}") String current,
    	        @RequestParam(value = "receipt", required = false) MultipartFile receipt) {

    	    return service.documentDraft(
    	            actor(principal), templateId, description, current, receipt);
    	}

    private static Long actor(ApplicationPrincipal principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        return principal.getId();
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handle(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("detail",
                ex.getReason() == null ? "AI 요청을 처리할 수 없습니다." : ex.getReason()));
    }

    @ExceptionHandler({org.springframework.web.bind.ServletRequestBindingException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, String>> invalidRequest(Exception ex) {
        return ResponseEntity.badRequest().body(Map.of("detail", "요청 파일과 필수 입력값을 확인해 주세요."));
    }
}
