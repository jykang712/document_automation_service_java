package com.pickle.backend.service;

import java.nio.charset.StandardCharsets;
import java.sql.Statement;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.pickle.backend.dto.PublicSignupRequest;

@Service
public class PublicSignupService {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;
    public PublicSignupService(JdbcTemplate jdbc, PasswordEncoder passwords) {
        this.jdbc = jdbc;
        this.passwords = passwords;
    }
    public record SignupUser(Long id, @JsonProperty("login_id") String loginId, String name, String role, boolean active) {}

    @Transactional
    public SignupUser signup(PublicSignupRequest request) {
        if (request == null) throw ManagementSupport.error(HttpStatus.BAD_REQUEST, "가입 정보를 입력하세요.");
        String name = ManagementSupport.required(request.name(), "이름", 100);
        String loginId = ManagementSupport.loginId(request.loginId());
        String password = request.password();
        if (password == null || password.isBlank()
                || password.codePointCount(0, password.length()) < 8
                || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw ManagementSupport.error(HttpStatus.BAD_REQUEST, "비밀번호는 8자 이상, UTF-8 기준 72바이트 이하여야 합니다.");
        }
        Long count = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE login_id = ?", Long.class, loginId);
        if (count != null && count > 0) {
            throw ManagementSupport.error(HttpStatus.CONFLICT, "이미 사용 중인 로그인 아이디입니다.");
        }
        String hash = passwords.encode(password);
        var key = new GeneratedKeyHolder();
        try {
            jdbc.update(connection -> {
                var statement = connection.prepareStatement(
                        "INSERT INTO users (login_id,password_hash,name,role,is_active) VALUES (?,?,?,'USER',TRUE)",
                        Statement.RETURN_GENERATED_KEYS);
                statement.setString(1, loginId);
                statement.setString(2, hash);
                statement.setString(3, name);
                return statement;
            }, key);
        } catch (DataIntegrityViolationException ex) {
            throw ManagementSupport.error(HttpStatus.CONFLICT, "이미 사용 중인 로그인 아이디입니다.");
        }
        Number id = key.getKey();
        if (id == null) throw new IllegalStateException("가입 계정 ID를 확인할 수 없습니다.");
        // org_members를 조회/생성/자동 연결하지 않습니다. 관리자가 사용자 관리에서 연결합니다.
        return new SignupUser(id.longValue(), loginId, name, "USER", true);
    }
}
