package com.pickle.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import java.util.List;
import java.util.Map;
import java.util.Set;
import com.pickle.backend.dto.ApprovalRuleDraft;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class RuleGuideAiServiceTest {
    private final JsonMapper json = JsonMapper.builder().build();
    private JsonNode draft(String template, String approvers) {
        return json.readTree("""
                {"rule_name":"결근 승인","rule_text":"소속부서 상사의 승인을 받는다.",
                 "template_id":%s,"template_hint":"결근계","source_excerpt":"상사의 승인을 받는다.",
                 "approvers":%s}
                """.formatted(template, approvers));
    }
    private String step(String id, int order, String hint) {
        return """
                {"approver_member_id":%s,"approval_order":%d,"approval_type":"결재","approver_hint":"%s"}
                """.formatted(id, order, hint);
    }
    @SuppressWarnings("unchecked")
    private List<Map<String,Object>> steps(Map<String,Object> result) {
        return (List<Map<String,Object>>) result.get("approvers");
    }
    @Test void previewRetainsUnassignedRoleAndTemplateButSaveRemainsStrict() {
        var raw = draft("null", "[" + step("null", 1, "소속부서 상사") + "]");
        var preview = RuleGuideAiService.previewRule(raw, Set.of(1L), Set.of(3L));
        assertNull(preview.get("template_id"));
        assertEquals("결근계", preview.get("template_hint"));
        assertNull(steps(preview).get(0).get("approver_member_id"));
        assertEquals("소속부서 상사", steps(preview).get(0).get("approver_hint"));
        assertEquals(2, ((List<?>) preview.get("validation_errors")).size());
        assertThrows(ResponseStatusException.class, () -> ApprovalRuleDraft.parse(raw));
        var knownTemplate = draft("1", "[" + step("null", 1, "소속부서 상사") + "]");
        assertThrows(ResponseStatusException.class, () -> ApprovalRuleDraft.parse(knownTemplate));
    }
    @Test void emptyCatalogsAndNoStepsStillProduceEditablePreview() {
        var preview = RuleGuideAiService.previewRule(draft("null", "[]"), Set.of(), Set.of());
        assertEquals(1, steps(preview).size());
        assertNull(steps(preview).get(0).get("approver_member_id"));
        assertFalse(((List<?>) preview.get("review_notes")).isEmpty());
    }
    @Test void unknownIdsAreClearedInsteadOfSelectingFirstAvailablePerson() {
        var preview = RuleGuideAiService.previewRule(draft("999", "[" + step("999", 1, "회사 승인") + "]"), Set.of(1L), Set.of(3L));
        assertNull(preview.get("template_id"));
        assertNull(steps(preview).get(0).get("approver_member_id"));
        assertEquals(2, ((List<?>) preview.get("review_notes")).size());
    }
    @Test void preservesExplicitOrderAndStrictlyValidatesCompletedDraft() {
        var raw = draft("1", "[" + step("5", 2, "대표") + "," + step("3", 1, "팀장") + "]");
        var preview = RuleGuideAiService.previewRule(raw, Set.of(1L), Set.of(3L,5L));
        assertEquals(3L, steps(preview).get(0).get("approver_member_id"));
        assertTrue(((List<?>) preview.get("validation_errors")).isEmpty());
        assertEquals(3L, ApprovalRuleDraft.parse(raw).approvers().get(0).memberId());
    }
    @Test void duplicatePeopleStillBlockFinalSave() {
        var raw = draft("1", "[" + step("3", 1, "상사") + "," + step("3", 2, "상사") + "]");
        var preview = RuleGuideAiService.previewRule(raw, Set.of(1L), Set.of(3L));
        assertTrue(((List<?>) preview.get("validation_errors")).stream().anyMatch(v -> v.toString().contains("중복")));
        assertThrows(ResponseStatusException.class, () -> ApprovalRuleDraft.parse(raw));
    }
    @Test void invalidOrderProducesReviewNotice() {
        var preview = RuleGuideAiService.previewRule(draft("1", "[" + step("3", 2, "상사") + "]"), Set.of(1L), Set.of(3L));
        assertEquals(1, steps(preview).get(0).get("approval_order"));
        assertTrue(((List<?>) preview.get("review_notes")).stream().anyMatch(v -> v.toString().contains("순서")));
    }
}
