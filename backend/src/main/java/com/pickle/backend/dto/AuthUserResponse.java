package com.pickle.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.pickle.backend.entity.Role;
import com.pickle.backend.entity.User;

public record AuthUserResponse(Long id, @JsonProperty("login_id") String loginId, String name, Role role, boolean active) {
    public static AuthUserResponse from(User user) {
        return new AuthUserResponse(user.getId(), user.getLoginId(), user.getName(),
                user.getRole(), user.isActive());
    }
}
