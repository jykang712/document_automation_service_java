package com.pickle.backend.service;

import java.util.Map;
import java.util.LinkedHashMap;
import tools.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import com.pickle.backend.repository.DocumentTemplateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.dto.GeneratedDocumentCreateRequest;
import com.pickle.backend.entity.GeneratedDocument;
import com.pickle.backend.entity.Role;
import com.pickle.backend.repository.GeneratedDocumentRepository;
import com.pickle.backend.repository.UserRepository;

@Service
public class GeneratedDocumentCreateService {
    private final GeneratedDocumentRepository documents;
    private final UserRepository users;
    private final DocumentTemplateRepository templates;
    private final AvailableApprovalRuleService rules;
    private final ObjectMapper json;

    public GeneratedDocumentCreateService(GeneratedDocumentRepository documents,
            UserRepository users, DocumentTemplateRepository templates,
            AvailableApprovalRuleService rules, ObjectMapper json) {
        this.documents = documents;
        this.users = users;
        this.templates = templates;
        this.rules = rules; this.json = json;
    }

    @Transactional
    public Map<String, Object> create(Long actorId, GeneratedDocumentCreateRequest request) {
        var actor = users.findById(actorId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        if (!actor.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "비활성 계정입니다.");
        }
        if (actor.getRole() != Role.ADMIN && actor.getRole() != Role.USER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "문서 생성 권한이 없습니다.");
        }
        if (request == null || request.templateId() == null || request.templateId() <= 0) {
            throw bad("template_id는 양의 정수여야 합니다.");
        }
        String title = request.documentTitle() == null ? "" : request.documentTitle().strip();
        if (title.isEmpty() || title.codePointCount(0, title.length()) > 255) {
            throw bad("document_title은 1~255자여야 합니다.");
        }
        String html = request.htmlContent();
        if (html == null || html.isBlank() || html.length() > 1_000_000) {
            throw bad("html_content는 필수이며 최대 길이는 1,000,000입니다.");
        }
        templates.findActiveForUse(request.templateId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "활성 양식을 찾을 수 없습니다."));

        var document = new GeneratedDocument();
        document.setOwnerUserId(actor.getId());
        document.setTemplateId(request.templateId());
        document.setDocumentTitle(title);
        var content = DocumentValueSupport.synchronize(html, request.extractedJson(), json);
        document.setHtmlContent(content.html());
        document.setExtractedJson(content.json());
        document.setApprovalLineJson("[]");
        if (request.appliedRuleId() != null) {
            var selection = rules.forDocument(actor.getId(), request.templateId(), request.appliedRuleId());
            document.setAppliedRuleId(selection.ruleId());
            document.setApprovalLineJson(json.writeValueAsString(selection.approvalLine()));
            document.setApprovalLineText(selection.lineText());
            document.setRecipientMemberId(selection.recipientId());
            document.setRecipientName(selection.recipientName());
            document.setRecipientTitle(selection.recipientTitle());
            document.setRecipientEmail(selection.recipientEmail());
        }
        document.setSent(false);
        document.setActive(true);
        var saved = documents.saveAndFlush(document);
        var result = new LinkedHashMap<String, Object>();
        result.put("id", saved.getId()); result.put("owner_user_id", saved.getOwnerUserId());
        result.put("template_id", saved.getTemplateId()); result.put("document_title", saved.getDocumentTitle());
        result.put("applied_rule_id", saved.getAppliedRuleId());
        result.put("approval_line_text", saved.getApprovalLineText());
        result.put("is_sent", saved.isSent()); result.put("is_active", saved.isActive());
        return result;
    }

    private static ResponseStatusException bad(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }
}
