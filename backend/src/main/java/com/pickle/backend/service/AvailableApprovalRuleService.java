package com.pickle.backend.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.entity.Role;
import com.pickle.backend.repository.UserRepository;

/** 문서 작성용 읽기 API와 저장 시 결재선 검증. 관리자 CRUD와 분리합니다. */
@Service
@Transactional(readOnly = true)
public class AvailableApprovalRuleService {
    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private static final Set<String> TYPES = Set.of("결재", "합의", "최종승인", "참조");
    public AvailableApprovalRuleService(JdbcTemplate jdbc, UserRepository users) {
        this.jdbc = jdbc; this.users = users;
    }

    public Map<String, Object> available(Long actorId, Long templateId) {
        requireUser(actorId);
        if (templateId == null || templateId <= 0) throw bad("양식을 선택하세요.");
        var templates = jdbc.query("SELECT id FROM document_templates WHERE id=? AND is_active=TRUE",
                (rs, n) -> rs.getLong("id"), templateId);
        if (templates.isEmpty()) throw missing("활성 양식을 찾을 수 없습니다.");
        var rules = jdbc.query("""
                SELECT r.id,r.template_id,r.rule_name,r.rule_text,r.is_active,t.is_active AS template_active
                FROM approval_rules r JOIN document_templates t ON t.id=r.template_id
                WHERE r.template_id=? AND r.is_active=TRUE AND t.is_active=TRUE ORDER BY r.id DESC
                """, (rs, n) -> new Rule(rs.getLong("id"), rs.getLong("template_id"),
                        rs.getString("rule_name"), rs.getString("rule_text"),
                        rs.getBoolean("is_active"), rs.getBoolean("template_active")), templateId);
        var grouped = steps(rules.stream().map(Rule::id).toList(), false).stream()
                .collect(Collectors.groupingBy(Step::ruleId, LinkedHashMap::new, Collectors.toList()));
        var result = new ArrayList<Map<String, Object>>();
        for (var rule : rules) {
            var approvers = grouped.getOrDefault(rule.id(), List.of());
            String issue = issue(approvers);
            var row = new LinkedHashMap<String, Object>();
            row.put("id", rule.id()); row.put("template_id", rule.templateId());
            row.put("rule_name", text(rule.name())); row.put("rule_text", text(rule.text()));
            row.put("selectable", issue.isEmpty()); row.put("unavailable_reason", issue);
            // 사용자용 응답에는 이메일 및 지침서 원문 인용을 포함하지 않습니다.
            row.put("approvers", approvers.stream().map(step -> Map.<String, Object>of(
                    "approver_member_id", step.memberId(), "approval_order", step.order(),
                    "approval_type", text(step.type()), "approver_name", text(step.name()),
                    "approver_title", text(step.title()))).toList());
            row.put("approval_line_text", lineText(approvers));
            result.add(row);
        }
        return Map.of("template_id", templateId, "rules", result);
    }

    public record Selection(Long ruleId, List<Map<String, Object>> approvalLine, String lineText,
            Long recipientId, String recipientName, String recipientTitle, String recipientEmail) {}
    private record Rule(Long id, Long templateId, String name, String text, boolean active, boolean templateActive) {}
    private record Step(Long ruleId, Long memberId, int order, String type,
            String name, String title, String email, String department, boolean active) {}

    /** 문서 생성 트랜잭션 안에서 호출하여 현재 규칙과 조직원을 잠금·검증합니다. */
    @Transactional
    public Selection forDocument(Long actorId, Long templateId, Long ruleId) {
        requireUser(actorId);
        if (ruleId == null || ruleId <= 0 || templateId == null || templateId <= 0) throw bad("양식과 결재 규칙 ID를 확인하세요.");
        var rows = jdbc.query("""
                SELECT r.id,r.template_id,r.rule_name,r.rule_text,r.is_active,t.is_active AS template_active
                FROM approval_rules r JOIN document_templates t ON t.id=r.template_id
                WHERE r.id=? FOR UPDATE
                """, (rs, n) -> new Rule(rs.getLong("id"), rs.getLong("template_id"),
                        rs.getString("rule_name"), rs.getString("rule_text"),
                        rs.getBoolean("is_active"), rs.getBoolean("template_active")), ruleId);
        if (rows.isEmpty()) throw missing("선택한 결재 규칙을 찾을 수 없습니다.");
        var rule = rows.getFirst();
        if (!rule.templateId().equals(templateId)) throw bad("선택한 양식에 속한 결재 규칙을 선택하세요.");
        if (!rule.active() || !rule.templateActive()) throw conflict("양식 또는 결재 규칙이 비활성화되었습니다. 선택 정보를 다시 확인하세요.");
        var approvers = steps(List.of(ruleId), true);
        String problem = issue(approvers);
        if (!problem.isEmpty()) throw conflict(problem);
        var snapshot = approvers.stream().map(step -> Map.<String, Object>of(
                "approver_member_id", step.memberId(), "approval_order", step.order(),
                "approval_type", text(step.type()), "approver_name", text(step.name()),
                "approver_title", text(step.title()), "approver_email", text(step.email()),
                "approver_department", text(step.department()))).toList();
        var first = approvers.getFirst();
        return new Selection(ruleId, snapshot, lineText(approvers), first.memberId(),
                text(first.name()), text(first.title()), text(first.email()));
    }

    private List<Step> steps(List<Long> ruleIds, boolean lock) {
        if (ruleIds.isEmpty()) return List.of();
        String marks = String.join(",", java.util.Collections.nCopies(ruleIds.size(), "?"));
        return jdbc.query("""
                SELECT a.rule_id,a.approver_member_id,a.approval_order,a.approval_type,
                       m.name,m.title,m.email,m.department,m.is_active AS member_active
                FROM approval_rule_approvers a LEFT JOIN org_members m ON m.id=a.approver_member_id
                WHERE a.rule_id IN (
                """ + marks + ") ORDER BY a.rule_id,a.approval_order" + (lock ? " FOR UPDATE" : ""),
                (rs, n) -> new Step(rs.getLong("rule_id"), rs.getLong("approver_member_id"),
                        rs.getInt("approval_order"), rs.getString("approval_type"),
                        rs.getString("name"), rs.getString("title"), rs.getString("email"),
                        rs.getString("department"), rs.getBoolean("member_active")), ruleIds.toArray());
    }
    private static String issue(List<Step> steps) {
        if (steps.isEmpty()) return "결재자가 등록되지 않은 규칙입니다. 관리자에게 결재선 등록을 요청하세요.";
        var seen = new java.util.HashSet<Long>();
        for (int i = 0; i < steps.size(); i++) {
            var step = steps.get(i);
            if (!step.active()) return "결재선에 비활성 또는 삭제된 조직원이 있습니다. 관리자에게 수정을 요청하세요.";
            if (step.order() != i + 1 || !seen.add(step.memberId()) || !TYPES.contains(text(step.type()))) {
                return "결재 순서 또는 결재 종류가 올바르지 않습니다. 관리자에게 수정을 요청하세요.";
            }
        }
        return "";
    }
    private static String lineText(List<Step> steps) {
        return steps.stream().map(step -> (text(step.name()) + " " + text(step.title())).strip()
                + " (" + text(step.type()) + ")").collect(Collectors.joining(" → "));
    }
    private void requireUser(Long id) {
        if (id == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        var actor = users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        if (!actor.isActive()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "비활성 계정입니다.");
        if (actor.getRole() != Role.ADMIN && actor.getRole() != Role.USER) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "문서 작성 권한이 없습니다.");
    }
    private static String text(String value) { return value == null ? "" : value; }
    private static ResponseStatusException bad(String reason) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason); }
    private static ResponseStatusException missing(String reason) { return new ResponseStatusException(HttpStatus.NOT_FOUND, reason); }
    private static ResponseStatusException conflict(String reason) { return new ResponseStatusException(HttpStatus.CONFLICT, reason); }
}
