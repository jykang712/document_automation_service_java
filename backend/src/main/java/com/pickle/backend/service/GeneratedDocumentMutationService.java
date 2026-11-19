package com.pickle.backend.service;

import java.util.LinkedHashMap;
import java.util.Map;
import jakarta.persistence.EntityManager;
import tools.jackson.databind.ObjectMapper;
import jakarta.persistence.LockModeType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.dto.GeneratedDocumentUpdateRequest;
import com.pickle.backend.entity.GeneratedDocument;
import com.pickle.backend.entity.Role;
import com.pickle.backend.repository.GeneratedDocumentRepository;
import com.pickle.backend.repository.UserRepository;

@Service
public class GeneratedDocumentMutationService {
    private final GeneratedDocumentRepository documents;
    private final UserRepository users;
    private final EntityManager entityManager;
    private final ObjectMapper json;

    public GeneratedDocumentMutationService(GeneratedDocumentRepository documents,
            UserRepository users, EntityManager entityManager, ObjectMapper json) {
        this.documents = documents;
        this.users = users;
        this.entityManager = entityManager;
        this.json = json;
    }

    @Transactional
    public Map<String, Object> update(Long actorId, Long documentId,
            GeneratedDocumentUpdateRequest request) {
        var document = editableDocument(actorId, documentId);
        if (request == null || (request.documentTitle() == null && request.htmlContent() == null && request.extractedJson() == null)) {
            throw bad("document_title, html_content 또는 extracted_json 중 하나 이상을 입력해 주세요.");
        }
        if (request.documentTitle() != null) {
            String title = request.documentTitle().strip();
            if (title.isEmpty() || title.codePointCount(0, title.length()) > 255) {
                throw bad("document_title은 1~255자여야 합니다.");
            }
            document.setDocumentTitle(title);
        }
        if (request.htmlContent() != null) {
            String html = request.htmlContent();
            if (html.isBlank() || html.length() > 1_000_000) {
                throw bad("html_content는 공백일 수 없으며 최대 길이는 1,000,000입니다.");
            }
            document.setHtmlContent(html);
        }
        if (request.htmlContent() != null || request.extractedJson() != null) {
            Map<String, Object> values = new LinkedHashMap<>();
            if (document.getExtractedJson() != null && !document.getExtractedJson().isBlank()) {
                values.putAll(json.readValue(document.getExtractedJson(), Map.class));
            }
            if (request.extractedJson() != null) values.putAll(request.extractedJson());
            var content = DocumentValueSupport.synchronize(document.getHtmlContent(), values, json);
            document.setHtmlContent(content.html());
            document.setExtractedJson(content.json());
        }
        var saved = documents.saveAndFlush(document);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", saved.getId());
        result.put("owner_user_id", saved.getOwnerUserId());
        result.put("template_id", saved.getTemplateId());
        result.put("document_title", saved.getDocumentTitle());
        result.put("html_content", saved.getHtmlContent());
        result.put("extracted_json", json.readTree(saved.getExtractedJson()));
        result.put("is_active", saved.isActive());
        result.put("is_sent", saved.isSent());
        return result;
    }

    @Transactional
    public void delete(Long actorId, Long documentId) {
        var document = editableDocument(actorId, documentId);
        document.setActive(false);
        documents.saveAndFlush(document);
    }

    private GeneratedDocument editableDocument(Long actorId, Long documentId) {
        var actor = users.findById(actorId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        if (!actor.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "비활성 계정입니다.");
        }
        if (actor.getRole() != Role.USER && actor.getRole() != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "문서 변경 권한이 없습니다.");
        }
        if (documentId == null || documentId <= 0) {
            throw missing();
        }
        // 수정/삭제가 동시에 실행될 때 비활성 상태를 오래된 값으로 덮어쓰지 않도록 잠급니다.
        var document = entityManager.find(GeneratedDocument.class, documentId,
                LockModeType.PESSIMISTIC_WRITE);
        if (document == null || (actor.getRole() != Role.ADMIN
                && (!document.isActive() || !actor.getId().equals(document.getOwnerUserId())))) {
            throw missing();
        }
        return document;
    }

    private static ResponseStatusException missing() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "문서를 찾을 수 없습니다.");
    }

    private static ResponseStatusException bad(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }
}
