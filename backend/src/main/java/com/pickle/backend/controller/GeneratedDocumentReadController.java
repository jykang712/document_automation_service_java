package com.pickle.backend.controller;

import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.pickle.backend.security.ApplicationPrincipal;
import com.pickle.backend.service.GeneratedDocumentReadService;

@RestController
@RequestMapping("/api/generated-documents")
public class GeneratedDocumentReadController {
    private final GeneratedDocumentReadService service;
    public GeneratedDocumentReadController(GeneratedDocumentReadService service) {
        this.service = service;
    }

    @GetMapping
    public Map<String, Object> list(@AuthenticationPrincipal ApplicationPrincipal principal) {
        return service.list(principal.getId());
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(@PathVariable Long id,
            @AuthenticationPrincipal ApplicationPrincipal principal) {
        return service.detail(principal.getId(), id);
    }
}
