package com.pickle.backend.service;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.dto.OrgMemberCreateRequest;
import com.pickle.backend.dto.OrgMemberResponse;
import com.pickle.backend.entity.OrgMember;
import com.pickle.backend.repository.OrgMemberRepository;

@Service
@Transactional(readOnly = true)
public class OrgMemberService {
    private final OrgMemberRepository repository;

    public OrgMemberService(OrgMemberRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public Long create(OrgMemberCreateRequest request) {
        if (request == null) {
            throw badRequest("요청 본문은 필수입니다.");
        }
        String name = required(request.name(), "name", 100);
        String title = required(request.title(), "title", 100);
        String email = required(request.email(), "email", 255);
        String department = optional(request.department(), "department", 100);

        if (repository.existsByEmail(email)) {
            throw badRequest("이미 등록된 이메일입니다: " + email);
        }
        OrgMember member = new OrgMember();
        member.setName(name);
        member.setTitle(title);
        member.setEmail(email);
        member.setDepartment(department);
        member.setActive(true);
        // 동시 등록에 대한 최종 중복 제한은 DB UNIQUE 제약이 처리합니다.
        return repository.saveAndFlush(member).getId();
    }

    public List<OrgMemberResponse> list() {
        return repository.findActiveMembers().stream()
                .map(OrgMemberResponse::from).toList();
    }

    private static String required(String value, String field, int maxLength) {
        String normalized = optional(value, field, maxLength);
        if (normalized == null) {
            throw badRequest(field + " 은 필수입니다.");
        }
        return normalized;
    }

    private static String optional(String value, String field, int maxLength) {
        String normalized = value == null ? "" : value.strip();
        if (normalized.codePointCount(0, normalized.length()) > maxLength) {
            throw badRequest(field + " 은 " + maxLength + "자 이하여야 합니다.");
        }
        return normalized.isEmpty() ? null : normalized;
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
