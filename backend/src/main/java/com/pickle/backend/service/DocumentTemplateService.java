package com.pickle.backend.service;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.time.LocalDateTime;
import com.pickle.backend.dto.TemplateFieldMapping;
import tools.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.dto.DocumentTemplateWriteRequest;
import com.pickle.backend.entity.DocumentTemplate;
import com.pickle.backend.entity.Role;
import com.pickle.backend.repository.DocumentTemplateRepository;
import com.pickle.backend.repository.UserRepository;

@Service
@Transactional(readOnly = true)
public class DocumentTemplateService {
    private final DocumentTemplateRepository templates;
    private final UserRepository users;
    private final EntityManager entityManager;
    private final TemplateMappingService mapping;
    private final ObjectMapper json;

    public DocumentTemplateService(DocumentTemplateRepository templates,
            UserRepository users, EntityManager entityManager,
            TemplateMappingService mapping, ObjectMapper json) {
        this.templates = templates;
        this.users = users;
        this.entityManager = entityManager;
        this.mapping = mapping; this.json = json;
    }

    public Map<String, Object> adminList(Long actorId) {
        requireActor(actorId, true);
        return list(templates.findAllByOrderByIdDesc(), true);
    }

    public Map<String, Object> adminDetail(Long actorId, Long id) {
        requireActor(actorId, true);
        return detail(templates.findById(id).orElseThrow(DocumentTemplateService::missing), true);
    }

    public Map<String, Object> availableList(Long actorId) {
        requireActor(actorId, false);
        return list(templates.findByActiveTrueOrderByIdDesc(), false);
    }

    public Map<String, Object> availableDetail(Long actorId, Long id) {
        requireActor(actorId, false);
        return detail(templates.findByIdAndActiveTrue(id)
                .orElseThrow(DocumentTemplateService::missing), false);
    }

    @Transactional
    public Map<String, Object> create(Long actorId, DocumentTemplateWriteRequest request) {
        requireActor(actorId, true);
        if (request == null) { throw bad("요청 본문은 필수입니다."); }
        var template = new DocumentTemplate();
        apply(template, request, true);
        template.setActive(true);
        return detail(templates.saveAndFlush(template), true);
    }

    @Transactional
    public Map<String, Object> update(Long actorId, Long id, DocumentTemplateWriteRequest request) {
        requireActor(actorId, true);
        var template = locked(id);
        if (request == null || (request.templateName() == null && request.htmlContent() == null
                && request.fileName() == null
                && request.templateSchema() == null && request.placeholderKeys() == null
                && request.templateFields() == null)) {
            throw bad("수정할 필드를 하나 이상 입력해 주세요.");
        }
        if (Boolean.TRUE.equals(request.remapFields())) {
            if (request.expectedUpdatedAt() == null) throw bad("편집 버전이 필요합니다. 양식을 다시 불러오세요.");
            LocalDateTime expected;
            try { expected = LocalDateTime.parse(request.expectedUpdatedAt()); }
            catch (java.time.format.DateTimeParseException ex) { throw bad("편집 버전을 확인할 수 없습니다."); }
            if (!expected.equals(template.getUpdatedAt())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "다른 작업으로 양식이 변경되었습니다. 다시 불러온 뒤 수정하세요.");
            }
            if (request.htmlContent() != null || request.templateSchema() != null || request.placeholderKeys() != null) {
                throw bad("셀 연결 수정 시 HTML과 스키마는 서버에서 생성합니다.");
            }
            TemplateFieldMapping[] fields;
            try { fields = json.convertValue(request.templateFields(), TemplateFieldMapping[].class); }
            catch (Exception ex) { throw bad("필드 매핑 형식을 확인하세요."); }
            var base = mapping.editingBase(template.getHtmlContent(), template.getTemplateFields());
            String name = request.templateName() == null ? template.getTemplateName() : request.templateName().strip();
            var mapped = mapping.map(base.html(), fields == null ? null : Arrays.asList(fields), name);
            apply(template, request, false);
            template.setHtmlContent(mapped.html()); template.setTemplateSchema(mapped.schema());
            template.setPlaceholderKeys(mapped.keys()); template.setTemplateFields(mapped.fields());
        } else apply(template, request, false);
        return detail(templates.saveAndFlush(template), true);
    }

    @Transactional
    public void deactivate(Long actorId, Long id) {
        requireActor(actorId, true);
        var template = locked(id);
        template.setActive(false);
        templates.saveAndFlush(template);
    }

    private DocumentTemplate locked(Long id) {
        if (id == null || id <= 0) { throw missing(); }
        var template = entityManager.find(DocumentTemplate.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (template == null) { throw missing(); }
        return template;
    }

    private void requireActor(Long id, boolean adminOnly) {
        var actor = users.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        if (!actor.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "비활성 계정입니다.");
        }
        if ((adminOnly && actor.getRole() != Role.ADMIN)
                || (actor.getRole() != Role.USER && actor.getRole() != Role.ADMIN)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "권한이 없습니다.");
        }
    }

    private static void apply(DocumentTemplate t, DocumentTemplateWriteRequest r, boolean creating) {
        if (creating || r.templateName() != null) {
            String name = r.templateName() == null ? "" : r.templateName().strip();
            if (name.isEmpty() || name.codePointCount(0, name.length()) > 255) {
                throw bad("template_name은 1~255자여야 합니다.");
            }
            t.setTemplateName(name);
        }
        if (creating || r.htmlContent() != null) {
            String html = r.htmlContent();
            if (html == null || html.isBlank() || html.length() > 1_000_000) {
                throw bad("html_content는 필수이며 최대 길이는 1,000,000입니다.");
            }
            t.setHtmlContent(html);
        }
        if (r.fileName() != null) {
            if (r.fileName().codePointCount(0, r.fileName().length()) > 255) {
                throw bad("file_name은 255자 이하여야 합니다.");
            }
            t.setFileName(r.fileName());
        }
        if (r.templateSchema() != null) { t.setTemplateSchema(r.templateSchema()); }
        if (r.placeholderKeys() != null) {
            if (r.placeholderKeys().stream().anyMatch(k -> k == null || k.isBlank())) {
                throw bad("placeholder_keys에는 빈 값이 들어갈 수 없습니다.");
            }
            t.setPlaceholderKeys(r.placeholderKeys());
        }
        if (r.templateFields() != null) {
            if (r.templateFields().stream().anyMatch(f -> f == null)) {
                throw bad("template_fields에는 null이 들어갈 수 없습니다.");
            }
            t.setTemplateFields(r.templateFields());
        }
    }

    private static Map<String, Object> list(List<DocumentTemplate> rows, boolean admin) {
        return Map.of("templates", rows.stream().map(t -> summary(t, admin)).toList(),
                "total", rows.size());
    }

    private static Map<String, Object> summary(DocumentTemplate t, boolean admin) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", t.getId());
        result.put("template_name", t.getTemplateName());
        if (admin) {
            result.put("file_name", t.getFileName());
            result.put("is_active", t.isActive());
            result.put("created_at", t.getCreatedAt());
            result.put("updated_at", t.getUpdatedAt());
        }
        return result;
    }

    private Map<String, Object> detail(DocumentTemplate t, boolean admin) {
        var result = summary(t, admin);
        result.put("html_content", t.getHtmlContent());
        result.put("template_schema", t.getTemplateSchema() == null ? Map.of() : t.getTemplateSchema());
        result.put("placeholder_keys", t.getPlaceholderKeys() == null ? List.of() : t.getPlaceholderKeys());
        result.put("template_fields", t.getTemplateFields() == null ? List.of() : t.getTemplateFields());
        if (admin) {
            var base = mapping.editingBase(t.getHtmlContent(), t.getTemplateFields());
            result.put("mapping_preview_html", base.html()); result.put("cells", base.cells());
            result.put("mapping_warnings", base.warnings());
        }
        return result;
    }

    private static ResponseStatusException missing() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "양식을 찾을 수 없습니다.");
    }

    private static ResponseStatusException bad(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }
}
