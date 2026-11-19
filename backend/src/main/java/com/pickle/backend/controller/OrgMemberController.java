package com.pickle.backend.controller;

import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.pickle.backend.dto.OrgMemberCreateRequest;
import com.pickle.backend.dto.OrgMemberEditRequest;
import com.pickle.backend.dto.OrgMemberResponse;
import com.pickle.backend.service.OrgMemberService;
import com.pickle.backend.service.OrgMemberProfileService;

@RestController
@RequestMapping("/api/org-members")
public class OrgMemberController {
    private final OrgMemberService service;
    private final OrgMemberProfileService profiles;
    public OrgMemberController(OrgMemberService service, OrgMemberProfileService profiles) {
        this.service = service;
        this.profiles = profiles;
    }
    @PostMapping
    public Map<String, Object> create(@RequestBody OrgMemberCreateRequest request) {
        return Map.of("status", "ok", "id", service.create(request));
    }
    @GetMapping
    public List<OrgMemberResponse> list() { return service.list(); }

    @PatchMapping("/{id}")
    public Map<String, Object> update(@PathVariable Long id, @RequestBody OrgMemberEditRequest request) {
        profiles.update(id, request);
        return Map.of("status", "ok", "id", id);
    }
    // 조직원·계정 동시 생성 및 관리자 비밀번호 지정 API를 제거했습니다.
}
