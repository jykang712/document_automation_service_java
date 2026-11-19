package com.pickle.backend.controller;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.pickle.backend.service.ApprovalRuleService;
import com.pickle.backend.service.ApprovalLineService;
import com.pickle.backend.service.RuleGuideAiService;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/approval-rules")
public class ApprovalRuleController {
    private final ApprovalRuleService rules;
    private final ApprovalLineService lines;
    private final RuleGuideAiService ai;
    public ApprovalRuleController(ApprovalRuleService rules, ApprovalLineService lines, RuleGuideAiService ai) {
        this.rules = rules; this.lines = lines; this.ai = ai;
    }
    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(defaultValue = "false") boolean includeInactive) { return rules.list(includeInactive); }
    @GetMapping("/catalog")
    public Map<String, Object> catalog() { return Map.of("templates", rules.catalogTemplates(), "members", rules.catalogMembers()); }
    @GetMapping("/{id}")
    public Map<String, Object> detail(@PathVariable long id) { return rules.get(id); }
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@RequestBody JsonNode body) { return Map.of("status", "ok", "id", rules.create(body)); }
    @PatchMapping("/{id}")
    public Map<String, Object> update(@PathVariable long id, @RequestBody JsonNode body) {
        rules.update(id, body); return Map.of("status", "ok", "id", id);
    }
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(@PathVariable long id) { rules.deactivate(id); }
    @GetMapping("/{id}/approval-line")
    public Map<String, Object> line(@PathVariable long id) { ApprovalRuleService.admin(); return lines.resolve(id); }
    @PostMapping(value = "/preview-guide", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> preview(@RequestParam("guide_file") MultipartFile file) { return ai.preview(file); }
    @PostMapping("/save-preview")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> savePreview(@RequestBody JsonNode body) { return rules.savePreview(body); }
}
