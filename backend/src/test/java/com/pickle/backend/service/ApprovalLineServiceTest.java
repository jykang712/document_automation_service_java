package com.pickle.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class ApprovalLineServiceTest {
    @Test void databaseNamesOverrideAiAndFirstTitleWins() {
        var rules = mock(ApprovalRuleService.class);
        var first = step(3L, 1, "김팀장", "팀장", true);
        var second = step(5L, 2, "이팀장", "팀장", true);
        when(rules.getForResolution(1L)).thenReturn(ApprovalRuleService.map("is_active", true, "template_active", true,
                "template_id", 1L, "approvers", List.of(first, second)));
        var result = new ApprovalLineService(rules).overwriteApprovalValues(1L,
                Map.of("approval_team_leader_name", "AI 사칭", "approval_ceo_name", "AI 추측", "amount", 1000));
        assertEquals("김팀장", result.get("approval_team_leader_name"));
        assertEquals("", result.get("approval_ceo_name"));
        assertEquals(1000, result.get("amount"));
        assertTrue(result.get("approval_line").toString().contains("이팀장"));
    }
    @Test void rejectsInactiveApprover() {
        var rules = mock(ApprovalRuleService.class);
        when(rules.getForResolution(1L)).thenReturn(ApprovalRuleService.map("is_active", true, "template_active", true,
                "template_id", 1L, "approvers", List.of(step(3L, 1, "김팀장", "팀장", false))));
        assertThrows(ResponseStatusException.class, () -> new ApprovalLineService(rules).resolve(1L));
    }
    private Map<String, Object> step(long id, int order, String name, String title, boolean active) {
        return ApprovalRuleService.map("approver_member_id", id, "approval_order", order, "approval_type", "결재",
                "approver_name", name, "approver_title", title, "approver_department", "개발팀", "approver_email", "work@example.com", "member_active", active);
    }
}
