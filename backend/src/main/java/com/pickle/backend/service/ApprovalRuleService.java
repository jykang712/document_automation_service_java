package com.pickle.backend.service;

import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import com.pickle.backend.dto.ApprovalRuleDraft;

@Service
@Transactional(readOnly = true)
public class ApprovalRuleService {
    private final JdbcTemplate jdbc;
    public ApprovalRuleService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public static void admin() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getAuthorities().stream().noneMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ADMIN만 결재규칙을 관리할 수 있습니다.");
        }
    }
    public List<Map<String, Object>> catalogTemplates() {
        admin();
        return jdbc.query("SELECT id,template_name FROM document_templates WHERE is_active=TRUE ORDER BY id", (r, n) ->
                map("id", r.getLong("id"), "template_name", r.getString("template_name")));
    }
    public List<Map<String, Object>> catalogMembers() {
        admin();
        // AI에는 로그인 정보와 이메일을 보내지 않습니다.
        return jdbc.query("SELECT id,name,title,department FROM org_members WHERE is_active=TRUE ORDER BY id", (r, n) ->
                map("id", r.getLong("id"), "name", r.getString("name"), "title", r.getString("title"), "department", r.getString("department")));
    }
    public List<Map<String, Object>> list(boolean includeInactive) {
        admin();
        return readRows(includeInactive ? "" : " WHERE r.is_active=TRUE", new Object[0]);
    }
    public Map<String, Object> get(long id) {
        admin();
        return getForResolution(id);
    }
    // 문서 서비스가 서버에서 선택한 규칙을 내부적으로 해석할 때 사용합니다.
    // 이 메서드를 사용자 입력을 그대로 받는 공개 Controller로 노출하지 않습니다.
    Map<String, Object> getForResolution(long id) {
        var rows = readRows(" WHERE r.id=?", new Object[]{id});
        if (rows.isEmpty()) throw missing();
        return rows.get(0);
    }
    private List<Map<String, Object>> readRows(String where, Object[] args) {
        var rows = jdbc.query("""
                SELECT r.*,t.template_name,t.is_active AS template_active FROM approval_rules r
                JOIN document_templates t ON t.id=r.template_id
                """ + where + " ORDER BY r.id DESC", (r, n) -> map(
                "id", r.getLong("id"), "rule_name", r.getString("rule_name"), "rule_text", r.getString("rule_text"),
                "template_id", r.getLong("template_id"), "template_name", r.getString("template_name"), "template_active", r.getBoolean("template_active"),
                "source_type", r.getString("source_type"), "source_name", r.getString("source_name"), "source_excerpt", r.getString("source_excerpt"),
                "is_active", r.getBoolean("is_active"), "created_at", r.getTimestamp("created_at").toLocalDateTime(),
                "updated_at", r.getTimestamp("updated_at").toLocalDateTime(), "approvers", new ArrayList<Map<String, Object>>()), args);
        if (rows.isEmpty()) return rows;
        var byId = new LinkedHashMap<Long, Map<String, Object>>();
        rows.forEach(row -> byId.put((Long) row.get("id"), row));
        String placeholders = String.join(",", java.util.Collections.nCopies(rows.size(), "?"));
        var steps = jdbc.query("""
                SELECT a.rule_id,a.approver_member_id,a.approval_order,a.approval_type,
                       m.name,m.title,m.email,m.department,m.is_active
                FROM approval_rule_approvers a JOIN org_members m ON m.id=a.approver_member_id
                WHERE a.rule_id IN (
                """ + placeholders + ") ORDER BY a.rule_id,a.approval_order", (r, n) -> map(
                "rule_id", r.getLong("rule_id"), "approver_member_id", r.getLong("approver_member_id"),
                "approval_order", r.getInt("approval_order"), "approval_type", r.getString("approval_type"),
                "approver_name", r.getString("name"), "approver_title", r.getString("title"), "approver_email", r.getString("email"),
                "approver_department", r.getString("department"), "member_active", r.getBoolean("is_active")), byId.keySet().toArray());
        for (var step : steps) appendStep(byId.get((Long) step.remove("rule_id")), step);
        return rows;
    }
    @SuppressWarnings("unchecked")
    private static void appendStep(Map<String, Object> rule, Map<String, Object> step) {
        ((List<Map<String, Object>>) rule.get("approvers")).add(step);
    }
    @Transactional
    public long create(JsonNode body) {
        admin();
        var draft = ApprovalRuleDraft.parse(body);
        lockReferences(List.of(draft));
        return insert(draft, "manual", null);
    }
    @Transactional
    public void update(long id, JsonNode body) {
        admin();
        boolean active = lockRule(id);
        if (!active) throw new ResponseStatusException(HttpStatus.CONFLICT, "비활성 규칙은 수정할 수 없습니다. 새 규칙으로 등록하세요.");
        var draft = ApprovalRuleDraft.parse(body);
        lockReferences(List.of(draft));
        jdbc.update("UPDATE approval_rules SET rule_name=?,rule_text=?,template_id=?,source_excerpt=? WHERE id=?",
                draft.name(), draft.text(), draft.templateId(), draft.excerpt(), id);
        jdbc.update("DELETE FROM approval_rule_approvers WHERE rule_id=?", id);
        insertSteps(id, draft);
    }
    @Transactional
    public void deactivate(long id) {
        admin();
        lockRule(id);
        jdbc.update("UPDATE approval_rules SET is_active=FALSE WHERE id=?", id);
    }
    @Transactional
    public Map<String, Object> savePreview(JsonNode body) {
        admin();
        if (body == null || !body.isObject()) throw ApprovalRuleDraft.bad("저장 요청을 확인하세요.");
        String source = ApprovalRuleDraft.text(body.get("source_name"), "지침서 이름", 255, true);
        JsonNode array = body.get("rules");
        if (array == null || !array.isArray() || array.isEmpty() || array.size() > 20) throw ApprovalRuleDraft.bad("규칙은 1~20개여야 합니다.");
        var drafts = new ArrayList<ApprovalRuleDraft>();
        for (JsonNode row : array) drafts.add(ApprovalRuleDraft.parse(row));
        lockReferences(drafts); // 모든 규칙을 먼저 검증하고, 일괄 INSERT를 한 트랜잭션에서 수행합니다.
        var results = drafts.stream().map(d -> map("id", insert(d, "guide", source))).toList();
        return map("status", "ok", "saved_rule_count", results.size(), "results", results);
    }
    private boolean lockRule(long id) {
        var rows = jdbc.query("SELECT is_active FROM approval_rules WHERE id=? FOR UPDATE", (r, n) -> r.getBoolean(1), id);
        if (rows.isEmpty()) throw missing();
        return rows.get(0);
    }
    private void lockReferences(List<ApprovalRuleDraft> drafts) {
        var templates = new TreeSet<Long>();
        var members = new TreeSet<Long>();
        for (var d : drafts) { templates.add(d.templateId()); d.approvers().forEach(s -> members.add(s.memberId())); }
        for (long id : templates) activeReference("document_templates", id, "양식");
        for (long id : members) activeReference("org_members", id, "조직원");
    }
    private void activeReference(String table, long id, String label) {
        // table은 위의 두 서버 상수만 사용합니다.
        var rows = jdbc.query("SELECT is_active FROM " + table + " WHERE id=? FOR UPDATE", (r, n) -> r.getBoolean(1), id);
        if (rows.isEmpty() || !rows.get(0)) throw new ResponseStatusException(HttpStatus.CONFLICT, label + " #" + id + "가 없거나 비활성입니다. 선택 정보를 새로 확인하세요.");
    }
    private long insert(ApprovalRuleDraft d, String type, String source) {
        var key = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var stmt = connection.prepareStatement("INSERT INTO approval_rules (rule_name,rule_text,template_id,source_type,source_name,source_excerpt,is_active) VALUES (?,?,?,?,?,?,TRUE)", Statement.RETURN_GENERATED_KEYS);
            stmt.setString(1, d.name()); stmt.setString(2, d.text()); stmt.setLong(3, d.templateId());
            stmt.setString(4, type); stmt.setString(5, source); stmt.setString(6, d.excerpt());
            return stmt;
        }, key);
        Number id = key.getKey();
        if (id == null) throw new IllegalStateException("규칙 ID를 확인할 수 없습니다.");
        insertSteps(id.longValue(), d);
        return id.longValue();
    }
    private void insertSteps(long id, ApprovalRuleDraft d) {
        for (var step : d.approvers()) jdbc.update("INSERT INTO approval_rule_approvers (rule_id,approver_member_id,approval_order,approval_type) VALUES (?,?,?,?)",
                id, step.memberId(), step.order(), step.type());
    }
    public static Map<String, Object> map(Object... values) {
        var result = new LinkedHashMap<String, Object>();
        for (int i = 0; i < values.length; i += 2) result.put((String) values[i], values[i + 1]);
        return result;
    }
    private static ResponseStatusException missing() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "규칙이 존재하지 않습니다."); }
}
