package com.pickle.backend.controller;

import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.pickle.backend.service.UserManagementService;

@RestController
@RequestMapping("/api/admin/user-management")
public class UserManagementController {
    private final UserManagementService service;
    public UserManagementController(UserManagementService service) { this.service = service; }
    @GetMapping
    public List<UserManagementService.UserRow> list() { return service.list(); }
    @GetMapping("/org-members")
    public List<UserManagementService.MemberOption> members() { return service.members(); }
    @PatchMapping("/{id}/org-member")
    public Map<String, Object> link(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        service.link(id, request);
        return Map.of("status", "ok", "user_id", id);
    }
    // 권한 변경은 기존 /api/admin/users/{id}/role을 사용합니다.
}
