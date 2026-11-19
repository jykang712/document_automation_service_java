package com.pickle.backend.dto;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

public record ApprovalRuleDraft(String name, String text, long templateId, String excerpt, List<Step> approvers) {
    public static final Set<String> TYPES = Set.of("결재", "합의", "최종승인", "참조");
    public record Step(long memberId, int order, String type) {}
    public static ApprovalRuleDraft parse(JsonNode node) {
        if (node == null || !node.isObject()) throw bad("규칙은 JSON 객체여야 합니다.");
        String name = text(node.get("rule_name"), "규칙명", 255, true);
        String text = text(node.get("rule_text"), "규칙 설명", 10000, true);
        long templateId = id(node.get("template_id"), "적용 양식");
        String excerpt = text(node.get("source_excerpt"), "근거 문장", 8000, false);
        JsonNode array = node.get("approvers");
        if (array == null || !array.isArray() || array.isEmpty() || array.size() > 20) {
            throw bad("결재자는 1~20명이어야 합니다.");
        }
        var steps = new ArrayList<Step>();
        var people = new HashSet<Long>();
        var orders = new HashSet<Integer>();
        for (JsonNode step : array) {
            if (!step.isObject()) throw bad("결재자 항목을 확인하세요.");
            long memberId = id(step.get("approver_member_id"), "결재자");
            long order = id(step.get("approval_order"), "결재 순서");
            if (order > array.size()) throw bad("결재 순서는 1부터 인원수까지 연속이어야 합니다.");
            if (!people.add(memberId)) throw bad("같은 조직원을 중복 결재자로 지정할 수 없습니다.");
            if (!orders.add((int) order)) throw bad("결재 순서가 중복되었습니다.");
            String type = text(step.get("approval_type"), "결재 유형", 50, true);
            if (!TYPES.contains(type)) throw bad("지원하지 않는 결재 유형입니다.");
            steps.add(new Step(memberId, (int) order, type));
        }
        steps.sort(java.util.Comparator.comparingInt(Step::order));
        return new ApprovalRuleDraft(name, text, templateId, excerpt, List.copyOf(steps));
    }
    public static long id(JsonNode value, String field) {
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong() || value.asLong() <= 0) {
            throw bad(field + "은 양의 정수 ID/순서여야 합니다.");
        }
        return value.asLong();
    }
    public static String text(JsonNode value, String field, int max, boolean required) {
        if (value == null || value.isNull()) {
            if (required) throw bad(field + "은 필수입니다.");
            return null;
        }
        if (!value.isString()) throw bad(field + "은 문자열이어야 합니다.");
        return text(value.asString(), field, max, required);
    }
    public static String text(String value, String field, int max, boolean required) {
        String result = value == null ? "" : value.strip();
        if (required && result.isEmpty()) throw bad(field + "은 필수입니다.");
        if (result.codePointCount(0, result.length()) > max) throw bad(field + "의 최대 길이는 " + max + "자입니다.");
        return result.isEmpty() ? null : result;
    }
    public static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
