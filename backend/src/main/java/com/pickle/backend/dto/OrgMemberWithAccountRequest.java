package com.pickle.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record OrgMemberWithAccountRequest(
        String name, String title, String email, String department,
        @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) String password) {
    @Override
    public String toString() { return "OrgMemberWithAccountRequest[password=REDACTED]"; }
}
