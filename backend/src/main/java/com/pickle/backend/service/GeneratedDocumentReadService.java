package com.pickle.backend.service;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.pickle.backend.entity.GeneratedDocument;
import com.pickle.backend.entity.Role;
import com.pickle.backend.entity.User;
import com.pickle.backend.repository.GeneratedDocumentRepository;
import com.pickle.backend.repository.UserRepository;

@Service
@Transactional(readOnly = true)
public class GeneratedDocumentReadService {
    private final GeneratedDocumentRepository documents;
    private final UserRepository users;
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper json;

    public GeneratedDocumentReadService(GeneratedDocumentRepository documents,
            UserRepository users, NamedParameterJdbcTemplate jdbc, ObjectMapper json) {
        this.documents = documents;
        this.users = users;
        this.jdbc = jdbc;
        this.json = json;
    }

    public Map<String, Object> list(Long userId) {
        User actor = actor(userId);
        // ADMIN은 비활성 문서를 포함한 전체, USER는 본인의 활성 문서만 조회합니다.
        List<GeneratedDocument> rows = actor.getRole() == Role.ADMIN
                ? documents.findAllByOrderByCreatedAtDescIdDesc()
                : documents.findVisibleByOwner(actor.getId());
        Map<Long, String> names = templateNames(rows.stream()
                .map(GeneratedDocument::getTemplateId).distinct().toList());
        Map<Long, RequesterInfo> requesters = requesterInfos(rows.stream()
                .map(GeneratedDocument::getOwnerUserId).distinct().toList());
        List<Map<String, Object>> results = rows.stream()
                .map(d -> summary(d, names.getOrDefault(d.getTemplateId(), ""),
                        requesters.get(d.getOwnerUserId()))).toList();
        long sent = rows.stream().filter(GeneratedDocument::isSent).count();
        return Map.of("documents", results, "total", results.size(),
                "sent_count", sent, "unsent_count", rows.size() - sent);
    }

    public Map<String, Object> detail(Long userId, Long documentId) {
        User actor = actor(userId);
        GeneratedDocument document = (actor.getRole() == Role.ADMIN
                ? documents.findById(documentId)
                : documents.findVisibleByIdAndOwner(documentId, actor.getId()))
                // 소유자가 아니어도 404: 다른 사용자의 문서 존재 여부를 노출하지 않습니다.
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "문서를 찾을 수 없습니다."));
        Map<Long, String> names = templateNames(List.of(document.getTemplateId()));
        Map<Long, RequesterInfo> requesters = requesterInfos(List.of(document.getOwnerUserId()));
        Map<String, Object> result = summary(document, names.getOrDefault(document.getTemplateId(), ""),
                requesters.get(document.getOwnerUserId()));
        result.put("html_content", text(document.getHtmlContent()));
        result.put("extracted_json", jsonValue(document.getExtractedJson(), false));
        result.put("approval_line_json", jsonValue(document.getApprovalLineJson(), true));
        return result;
    }

    private User actor(Long id) {
        User actor = users.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        if (!actor.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "비활성 계정입니다.");
        }
        return actor;
    }

    // 기존 양식 Entity의 클래스명에 의존하지 않고 필요한 이름만 일괄 조회합니다.
    private Map<Long, String> templateNames(List<Long> ids) {
        Map<Long, String> result = new HashMap<>();
        if (ids.isEmpty()) { return result; }
        jdbc.query("select id, template_name from document_templates where id in (:ids)",
                Map.of("ids", ids), rs -> {
                    result.put(rs.getLong("id"), rs.getString("template_name"));
                });
        return result;
    }

    private record RequesterInfo(String loginId, String memberName, String title, boolean linked) {}

    // 조회가 허용된 문서의 소유자만 일괄 조회해 문서별 추가 쿼리를 방지합니다.
    // 조직원 미연동 계정도 LEFT JOIN으로 유지합니다. 연결된 비활성 조직원도 표시합니다.
    private Map<Long, RequesterInfo> requesterInfos(List<Long> ownerIds) {
        Map<Long, RequesterInfo> result = new HashMap<>();
        if (ownerIds.isEmpty()) { return result; }
        jdbc.query("""
                SELECT u.id AS owner_user_id, u.login_id,
                       om.id AS member_id, om.name AS member_name, om.title AS member_title
                FROM users u
                LEFT JOIN org_members om ON om.user_id = u.id
                WHERE u.id IN (:ids)
                """, Map.of("ids", ownerIds), rs -> {
                    result.put(rs.getLong("owner_user_id"), new RequesterInfo(
                            text(rs.getString("login_id")), text(rs.getString("member_name")),
                            text(rs.getString("member_title")), rs.getObject("member_id") != null));
                });
        return result;
    }

    private Map<String, Object> summary(GeneratedDocument d, String templateName,
            RequesterInfo requester) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", d.getId());
        result.put("owner_user_id", d.getOwnerUserId());
        result.put("requester_login_id", requester == null ? "" : requester.loginId());
        result.put("requester_member_name", requester == null ? "" : requester.memberName());
        result.put("requester_title", requester == null ? "" : requester.title());
        result.put("requester_member_linked", requester != null && requester.linked());
        result.put("document_title", text(d.getDocumentTitle()));
        result.put("template_id", d.getTemplateId());
        result.put("template_name", templateName);
        result.put("requester_name", text(d.getRequesterName()));
        result.put("requester_department", text(d.getRequesterDepartment()));
        result.put("approval_line_text", text(d.getApprovalLineText()));
        result.put("recipient_name", text(d.getRecipientName()));
        result.put("recipient_email", text(d.getRecipientEmail()));
        result.put("recipient_title", text(d.getRecipientTitle()));
        result.put("is_sent", d.isSent());
        result.put("is_active", d.isActive());
        result.put("description", text(d.getDescription()));
        result.put("receipt_file_name", text(d.getReceiptFileName()));
        result.put("created_at", d.getCreatedAt() == null ? "" : d.getCreatedAt().toString());
        result.put("updated_at", d.getUpdatedAt() == null ? "" : d.getUpdatedAt().toString());
        return result;
    }

    private JsonNode jsonValue(String value, boolean array) {
        if (value == null || value.isBlank()) {
            return array ? json.createArrayNode() : json.createObjectNode();
        }
        JsonNode node = json.readTree(value);
        if (node == null || node.isNull()) {
            return array ? json.createArrayNode() : json.createObjectNode();
        }
        return node;
    }

    private static String text(String value) { return value == null ? "" : value; }
}
