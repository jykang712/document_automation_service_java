package com.pickle.backend.service;

import java.nio.charset.StandardCharsets;
import java.sql.Statement;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.dto.OrgMemberAccountCreateRequest;
import com.pickle.backend.dto.OrgMemberAccountResponse;
import com.pickle.backend.dto.OrgMemberWithAccountRequest;
import com.pickle.backend.entity.OrgMember;
import com.pickle.backend.repository.OrgMemberRepository;

@Service
public class OrgMemberRegistrationService {
    private final OrgMemberRepository members;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;

    public OrgMemberRegistrationService(OrgMemberRepository members, JdbcTemplate jdbc,
            PasswordEncoder passwords) {
        this.members = members;
        this.jdbc = jdbc;
        this.passwords = passwords;
    }

    // 같은 DataSource/JpaTransactionManager에서 계정과 조직원을 함께 커밋합니다.
    @Transactional
    public OrgMemberAccountResponse create(OrgMemberWithAccountRequest request) {
        requireAdmin();
        if (request == null) throw bad("요청 본문은 필수입니다.");
        String name = required(request.name(), "이름", 100);
        String title = required(request.title(), "직급", 100);
        String email = email(request.email());
        String department = optional(request.department(), "부서", 100);
        validatePassword(request.password());
        if (members.existsByEmail(email)) {
            throw conflict("이미 등록된 조직원 이메일입니다. 기존 행에서 USER 계정 생성을 사용하세요.");
        }
        ensureNoAccount(email);
        var member = new OrgMember();
        member.setName(name);
        member.setTitle(title);
        member.setEmail(email);
        member.setDepartment(department);
        member.setActive(true);
        try {
            member.setUserId(insertUser(email, name, request.password()));
            members.saveAndFlush(member);
            return response(member, email);
        } catch (DataIntegrityViolationException ex) {
            // RuntimeException 재발생으로 users INSERT도 함께 롤백됩니다.
            throw conflict("이미 등록된 이메일 또는 계정입니다. 새로고침 후 기존 계정 연결을 확인하세요.");
        }
    }

    // 기존 조직원의 id/이름/부서/직급/이메일과 결재 참조는 유지하고 계정만 생성합니다.
    @Transactional
    public OrgMemberAccountResponse createAccount(Long memberId, OrgMemberAccountCreateRequest request) {
        requireAdmin();
        var member = members.findByIdForUpdate(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "조직원이 존재하지 않습니다."));
        if (!member.isActive()) throw conflict("비활성 조직원에게 계정을 생성할 수 없습니다.");
        if (member.getUserId() != null) throw conflict("이미 계정이 연결된 조직원입니다.");
        if (request == null) throw bad("요청 본문은 필수입니다.");
        validatePassword(request.password());
        String email = email(member.getEmail());
        String name = required(member.getName(), "이름", 100);
        ensureNoAccount(email);
        try {
            member.setUserId(insertUser(email, name, request.password()));
            members.saveAndFlush(member);
            return response(member, email);
        } catch (DataIntegrityViolationException ex) {
            throw conflict("이미 등록된 이메일 또는 계정입니다. 새로고침 후 기존 계정 연결을 확인하세요.");
        }
    }

    private Long insertUser(String email, String name, String password) {
        var key = new GeneratedKeyHolder();
        String hash = passwords.encode(password);
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(
                    "INSERT INTO users (email,password_hash,name,role,is_active) VALUES (?,?,?,'USER',TRUE)",
                    Statement.RETURN_GENERATED_KEYS);
            statement.setString(1, email);
            statement.setString(2, hash);
            statement.setString(3, name);
            return statement;
        }, key);
        Number id = key.getKey();
        if (id == null) throw new IllegalStateException("생성된 계정 ID를 확인할 수 없습니다.");
        return id.longValue();
    }

    private void ensureNoAccount(String email) {
        Long count = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email = ?", Long.class, email);
        if (count != null && count > 0) {
            throw conflict("이미 가입된 이메일입니다. 비밀번호는 변경하지 않았습니다. 기존 계정 연결을 사용하세요.");
        }
    }

    private static void validatePassword(String password) {
        if (password == null || password.isBlank()
                || password.codePointCount(0, password.length()) < 8
                || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw bad("비밀번호는 8자 이상, UTF-8 기준 72바이트 이하여야 합니다.");
        }
    }

    private static String email(String value) {
        String email = required(value, "이메일", 255).toLowerCase(Locale.ROOT);
        if (!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw bad("이메일 형식을 확인하세요.");
        return email;
    }

    private static String required(String value, String field, int max) {
        String result = optional(value, field, max);
        if (result == null) throw bad(field + "은 필수입니다.");
        return result;
    }

    private static String optional(String value, String field, int max) {
        String text = value == null ? "" : value.strip();
        if (text.codePointCount(0, text.length()) > max) throw bad(field + "은 " + max + "자 이하여야 합니다.");
        return text.isEmpty() ? null : text;
    }

    private static OrgMemberAccountResponse response(OrgMember m, String email) {
        return new OrgMemberAccountResponse(m.getId(), m.getName(), m.getTitle(), m.getEmail(),
                m.getDepartment(), m.isActive(), m.getCreatedAt(), m.getUpdatedAt(),
                m.getUserId(), email, "USER", true);
    }

    private static void requireAdmin() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()
                || auth.getAuthorities().stream().noneMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ADMIN만 계정을 생성할 수 있습니다.");
        }
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }
}
