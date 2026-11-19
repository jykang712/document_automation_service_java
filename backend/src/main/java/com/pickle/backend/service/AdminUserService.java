package com.pickle.backend.service;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.dto.AuthUserResponse;
import com.pickle.backend.entity.Role;
import com.pickle.backend.entity.User;
import com.pickle.backend.repository.UserRepository;

@Service
public class AdminUserService {
    private final UserRepository users;
    private final UserMutationExecutor mutations;
    public AdminUserService(UserRepository users, UserMutationExecutor mutations) {
        this.users = users;
        this.mutations = mutations;
    }

    @Transactional(readOnly = true)
    public List<AuthUserResponse> list(Long actorId) {
        requireAdmin(actorId);
        return users.findAllByOrderByIdAsc().stream().map(AuthUserResponse::from).toList();
    }

    public AuthUserResponse changeRole(Long actorId, Long targetId, Role role) {
        if (role == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "role 은 ADMIN 또는 USER여야 합니다.");
        }
        return mutations.execute(() -> {
            // SecurityFilter 이후 역할이 바뀌는 경우까지 저장 직전에 재확인합니다.
            requireAdmin(actorId);
            User target = users.findById(targetId).orElseThrow(() ->
                    new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));
            if (target.isActive() && target.getRole() == Role.ADMIN && role == Role.USER
                    && users.countByRoleAndActiveTrue(Role.ADMIN) <= 1) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "마지막 활성 ADMIN의 권한은 해제할 수 없습니다.");
            }
            target.setRole(role);
            return AuthUserResponse.from(users.saveAndFlush(target));
        });
    }

    private void requireAdmin(Long actorId) {
        User actor = users.findById(actorId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        if (!actor.isActive() || actor.getRole() != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ADMIN 권한이 필요합니다.");
        }
    }
}
