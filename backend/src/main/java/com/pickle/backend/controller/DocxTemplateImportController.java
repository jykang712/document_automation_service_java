package com.pickle.backend.controller;

import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import com.pickle.backend.security.ApplicationPrincipal;
import com.pickle.backend.service.DocxTemplateImportService;

@RestController
@RequestMapping("/api/templates")
public class DocxTemplateImportController {
    private final DocxTemplateImportService service;

    public DocxTemplateImportController(DocxTemplateImportService service) { this.service = service; }

    @PostMapping(value = "/preview-docx", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> preview(@AuthenticationPrincipal ApplicationPrincipal principal,
            @RequestPart("file") MultipartFile file) {
        return service.preview(principal.getId(), file);
    }

    @PostMapping(value = "/save-docx", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> save(@AuthenticationPrincipal ApplicationPrincipal principal,
            @RequestPart("file") MultipartFile file,
            @RequestParam("template_name") String name,
            @RequestParam("source_sha256") String sourceSha,
            @RequestParam("fields") String fieldsJson) {
        var result = service.save(principal.getId(), file, name, sourceSha, fieldsJson);
        var uri = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/templates/{id}").buildAndExpand(result.get("id")).toUri();
        return ResponseEntity.created(uri).body(result);
    }
}
