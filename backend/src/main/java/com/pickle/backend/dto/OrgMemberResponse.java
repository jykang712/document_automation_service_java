package com.pickle.backend.dto;

import com.pickle.backend.entity.OrgMember;

public record OrgMemberResponse(
        Long id,
        String name,
        String department,
        String title,
        String email
) {
    public static OrgMemberResponse from(OrgMember member) {
        return new OrgMemberResponse(
                member.getId(),
                member.getName(),
                member.getDepartment() == null ? "" : member.getDepartment(),
                member.getTitle(),
                member.getEmail()
        );
    }
}
