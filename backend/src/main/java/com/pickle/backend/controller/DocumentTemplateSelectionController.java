package com.pickle.backend.controller;

import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.pickle.backend.security.ApplicationPrincipal;
import com.pickle.backend.service.DocumentTemplateService;

@RestController
@RequestMapping("/api/available-templates")
public class DocumentTemplateSelectionController {
    private final DocumentTemplateService service;

    public DocumentTemplateSelectionController(DocumentTemplateService service) {
        this.service = service;
    }

    @GetMapping
    public Map<String, Object> list(@AuthenticationPrincipal ApplicationPrincipal principal) {
        return service.availableList(principal.getId());
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(@AuthenticationPrincipal ApplicationPrincipal principal,
            @PathVariable("id") Long id) {
        return service.availableDetail(principal.getId(), id);
    }
}
