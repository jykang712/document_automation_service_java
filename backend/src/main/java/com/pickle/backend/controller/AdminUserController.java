package com.pickle.backend.controller;

import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.pickle.backend.dto.AuthUserResponse;
import com.pickle.backend.dto.RoleChangeRequest;
import com.pickle.backend.security.ApplicationPrincipal;
import com.pickle.backend.service.AdminUserService;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {
    private final AdminUserService service;
    public AdminUserController(AdminUserService service) { this.service = service; }

    @GetMapping
    public List<AuthUserResponse> list(@AuthenticationPrincipal ApplicationPrincipal principal) {
        return service.list(principal.getId());
    }

    @PatchMapping("/{id}/role")
    public AuthUserResponse changeRole(@PathVariable Long id,
            @RequestBody RoleChangeRequest request,
            @AuthenticationPrincipal ApplicationPrincipal principal) {
        return service.changeRole(principal.getId(), id, request.role());
    }
}
