package com.pickle.backend.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ApprovalLineService {
    private final ApprovalRuleService rules;
    public ApprovalLineService(ApprovalRuleService rules) { this.rules = rules; }
    private static final List<String> KEYS = List.of("approval_staff_name", "approval_team_leader_name", "approval_manager_name",
            "approval_general_manager_name", "approval_director_name", "approval_managing_director_name",
            "approval_senior_managing_director_name", "approval_vice_president_name", "approval_ceo_name",
            "approval_reviewer_name", "approval_approver_name", "approver_name", "approval_line");
    private static final Map<String, String> TITLES = Map.ofEntries(
            Map.entry("담당", "approval_staff_name"), Map.entry("사원", "approval_staff_name"), Map.entry("주임", "approval_staff_name"),
            Map.entry("대리", "approval_staff_name"), Map.entry("팀원", "approval_staff_name"), Map.entry("전임", "approval_staff_name"),
            Map.entry("팀장", "approval_team_leader_name"), Map.entry("과장", "approval_manager_name"), Map.entry("차장", "approval_manager_name"),
            Map.entry("부장", "approval_general_manager_name"), Map.entry("이사", "approval_director_name"), Map.entry("상무이사", "approval_director_name"),
            Map.entry("상무", "approval_managing_director_name"), Map.entry("전무", "approval_senior_managing_director_name"),
            Map.entry("부사장", "approval_vice_president_name"), Map.entry("사장", "approval_ceo_name"), Map.entry("대표", "approval_ceo_name"),
            Map.entry("대표이사", "approval_ceo_name"), Map.entry("회장", "approval_ceo_name"));

    @SuppressWarnings("unchecked")
    public Map<String, Object> resolve(long ruleId) {
        var rule = rules.getForResolution(ruleId);
        if (!Boolean.TRUE.equals(rule.get("is_active")) || !Boolean.TRUE.equals(rule.get("template_active"))) {
            throw conflict("규칙 또는 양식이 비활성 상태입니다.");
        }
        var steps = (List<Map<String, Object>>) rule.get("approvers");
        if (steps.isEmpty()) throw conflict("결재자가 없는 규칙입니다.");
        var fields = new LinkedHashMap<String, Object>();
        KEYS.forEach(k -> fields.put(k, ""));
        var line = new ArrayList<Map<String, Object>>();
        var text = new ArrayList<String>();
        int order = 0;
        for (var step : steps) {
            if (!Boolean.TRUE.equals(step.get("member_active"))) throw conflict("비활성 결재자가 포함되어 있습니다. 규칙을 수정하세요.");
            if (((Number) step.get("approval_order")).intValue() != ++order) throw conflict("결재 순서를 다시 확인하세요.");
            String name = string(step.get("approver_name")), title = string(step.get("approver_title"));
            String type = string(step.get("approval_type")), department = string(step.get("approver_department"));
            line.add(ApprovalRuleService.map("member_id", step.get("approver_member_id"), "order", order, "type", type,
                    "name", name, "title", title, "department", department, "email", step.get("approver_email")));
            text.add(order + "차 " + type + ": " + name + " " + title + (department.isEmpty() ? "" : " (" + department + ")"));
            String key = TITLES.get(title);
            if (key != null && "".equals(fields.get(key))) fields.put(key, name); // Python과 같은 정확한 직급 일치/first-wins
        }
        fields.put("approval_line", String.join(" → ", text));
        return ApprovalRuleService.map("rule_id", ruleId, "template_id", rule.get("template_id"),
                "approval_line_text", String.join(" → ", text), "approval_line_json", line, "field_values", fields);
    }
    // 이후 문서 자동작성 서비스에서 호출하면 AI가 준 결재자 값을 DB 결과로 덮어쓸 수 있습니다.
    @SuppressWarnings("unchecked")
    public Map<String, Object> overwriteApprovalValues(long ruleId, Map<String, Object> aiValues) {
        var result = new LinkedHashMap<String, Object>();
        if (aiValues != null) result.putAll(aiValues);
        result.putAll((Map<String, Object>) resolve(ruleId).get("field_values"));
        return result;
    }
    private static String string(Object value) { return Objects.toString(value, "").strip(); }
    private static ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
}
