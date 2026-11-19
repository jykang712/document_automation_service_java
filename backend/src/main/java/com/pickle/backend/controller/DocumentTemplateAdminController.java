package com.pickle.backend.controller;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import com.pickle.backend.dto.DocumentTemplateWriteRequest;
import com.pickle.backend.security.ApplicationPrincipal;
import com.pickle.backend.service.DocumentTemplateService;

@RestController
@RequestMapping("/api/templates")
public class DocumentTemplateAdminController {
    private final DocumentTemplateService service;

    public DocumentTemplateAdminController(DocumentTemplateService service) {
        this.service = service;
    }

    @GetMapping
    public Map<String, Object> list(@AuthenticationPrincipal ApplicationPrincipal principal) {
        return service.adminList(principal.getId());
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(@AuthenticationPrincipal ApplicationPrincipal principal,
            @PathVariable("id") Long id) {
        return service.adminDetail(principal.getId(), id);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            @AuthenticationPrincipal ApplicationPrincipal principal,
            @RequestBody DocumentTemplateWriteRequest request) {
        var result = service.create(principal.getId(), request);
        var uri = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(result.get("id")).toUri();
        return ResponseEntity.created(uri).body(result);
    }

    @PatchMapping("/{id}")
    public Map<String, Object> update(@AuthenticationPrincipal ApplicationPrincipal principal,
            @PathVariable("id") Long id, @RequestBody DocumentTemplateWriteRequest request) {
        return service.update(principal.getId(), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@AuthenticationPrincipal ApplicationPrincipal principal,
            @PathVariable("id") Long id) {
        service.deactivate(principal.getId(), id);
        return ResponseEntity.noContent().build();
    }
}
