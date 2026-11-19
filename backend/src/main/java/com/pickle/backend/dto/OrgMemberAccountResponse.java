package com.pickle.backend.dto;

import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonProperty;

// Entity/User를 직접 JSON으로 반환하지 않아 비밀번호 필드가 노출되지 않습니다.
public record OrgMemberAccountResponse(
        Long id, String name, String title, String email, String department,
        @JsonProperty("is_active") boolean active,
        @JsonProperty("created_at") LocalDateTime createdAt,
        @JsonProperty("updated_at") LocalDateTime updatedAt,
        @JsonProperty("user_id") Long userId,
        @JsonProperty("account_email") String accountEmail,
        @JsonProperty("account_role") String accountRole,
        @JsonProperty("account_active") Boolean accountActive) {}

