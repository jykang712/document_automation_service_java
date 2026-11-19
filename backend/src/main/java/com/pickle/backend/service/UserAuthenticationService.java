package com.pickle.backend.service;

import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.dto.AuthUserResponse;
import com.pickle.backend.dto.SignupRequest;
import com.pickle.backend.entity.Role;
import com.pickle.backend.entity.User;
import com.pickle.backend.repository.UserRepository;

@Service
public class UserAuthenticationService {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final UserMutationExecutor mutations;
    public UserAuthenticationService(UserRepository users, PasswordEncoder encoder, UserMutationExecutor mutations) {
        this.users = users; this.encoder = encoder; this.mutations = mutations;
    }
    public AuthUserResponse signup(SignupRequest request) {
        if (request == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "가입 정보를 입력하세요.");
        String loginId = ManagementSupport.loginId(request.loginId());
        String name = ManagementSupport.required(request.name(), "이름", 100);
        String hash = encoder.encode(password(request.password()));
        return mutations.execute(() -> {
            if (users.countByRoleAndActiveTrue(Role.ADMIN) == 0) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "최초 관리자 설정을 먼저 완료해 주세요.");
            }
            if (users.existsByLoginId(loginId)) throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 사용 중인 로그인 아이디입니다.");
            var user = new User();
            user.setLoginId(loginId); user.setName(name); user.setPasswordHash(hash);
            user.setRole(Role.USER); user.setActive(true);
            return AuthUserResponse.from(users.saveAndFlush(user));
        });
    }
    public boolean createInitialAdmin(String loginId, String name, String password) {
        return mutations.execute(() -> {
            if (users.count() != 0) return false;
            var user = new User();
            user.setLoginId(ManagementSupport.loginId(loginId));
            user.setName(ManagementSupport.required(name, "이름", 100));
            user.setPasswordHash(encoder.encode(password(password)));
            user.setRole(Role.ADMIN); user.setActive(true);
            users.saveAndFlush(user);
            return true;
        });
    }
    private static String password(String value) {
        if (value == null || value.isBlank() || value.codePointCount(0, value.length()) < 12
                || value.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호는 12자 이상, UTF-8 기준 72바이트 이하여야 합니다.");
        }
        return value;
    }
}
