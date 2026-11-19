package com.pickle.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record OrgMemberAccountCreateRequest(
        @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) String password) {
    @Override
    public String toString() { return "OrgMemberAccountCreateRequest[password=REDACTED]"; }
}
