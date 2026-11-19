package com.pickle.backend.dto;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

class ApprovalRuleDraftTest {
    private final JsonMapper json = JsonMapper.builder().build();
    private String body(String steps) { return "{\"rule_name\":\"출장\",\"rule_text\":\"결재 설명\",\"template_id\":1,\"approvers\":" + steps + "}"; }
    @Test void sortsByExplicitOrder() {
        var draft = ApprovalRuleDraft.parse(json.readTree(body("[{\"approver_member_id\":5,\"approval_order\":2,\"approval_type\":\"최종승인\"},{\"approver_member_id\":3,\"approval_order\":1,\"approval_type\":\"결재\"}]")));
        assertEquals(3L, draft.approvers().get(0).memberId());
        assertEquals(5L, draft.approvers().get(1).memberId());
    }
    @Test void rejectsDuplicatePeople() {
        assertThrows(ResponseStatusException.class, () -> ApprovalRuleDraft.parse(json.readTree(body("[{\"approver_member_id\":3,\"approval_order\":1,\"approval_type\":\"결재\"},{\"approver_member_id\":3,\"approval_order\":2,\"approval_type\":\"합의\"}]"))));
    }
    @Test void rejectsFractionalIdsAndMissingOrders() {
        assertThrows(ResponseStatusException.class, () -> ApprovalRuleDraft.parse(json.readTree(body("[{\"approver_member_id\":3.5,\"approval_order\":1,\"approval_type\":\"결재\"}]"))));
        assertThrows(ResponseStatusException.class, () -> ApprovalRuleDraft.parse(json.readTree(body("[{\"approver_member_id\":3,\"approval_order\":2,\"approval_type\":\"결재\"}]"))));
    }
    @Test void rejectsUnknownType() {
        assertThrows(ResponseStatusException.class, () -> ApprovalRuleDraft.parse(json.readTree(body("[{\"approver_member_id\":3,\"approval_order\":1,\"approval_type\":\"임의유형\"}]"))));
    }
}
