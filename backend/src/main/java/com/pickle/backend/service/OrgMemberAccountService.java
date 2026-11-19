package com.pickle.backend.service;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.pickle.backend.dto.OrgMemberAccountResponse;
import com.pickle.backend.entity.OrgMember;
import com.pickle.backend.repository.OrgMemberRepository;

@Service
@Transactional(readOnly = true)
public class OrgMemberAccountService {
    private final OrgMemberRepository members;
    private final JdbcTemplate jdbc;

    public OrgMemberAccountService(OrgMemberRepository members, JdbcTemplate jdbc) {
        this.members = members;
        this.jdbc = jdbc;
    }

    private record Account(Long id, String email, String role, boolean active) {}

    public List<OrgMemberAccountResponse> list() {
        requireAdmin();
        var rows = members.findActiveMembers();
        var ids = rows.stream().map(OrgMember::getUserId).filter(java.util.Objects::nonNull)
                .distinct().toList();
        Map<Long, Account> accounts = new HashMap<>();
        if (!ids.isEmpty()) {
            String placeholders = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
            // 공개 정보만 조회합니다. 비밀번호 해시는 선택하지 않습니다.
            jdbc.query("SELECT id,email,role,is_active FROM users WHERE id IN (" + placeholders + ")",
                    (rs, n) -> new Account(rs.getLong("id"), rs.getString("email"),
                            rs.getString("role"), rs.getBoolean("is_active")), ids.toArray())
                    .forEach(a -> accounts.put(a.id(), a));
        }
        return rows.stream().map(m -> response(m, accounts.get(m.getUserId()))).toList();
    }

    @Transactional
    public OrgMemberAccountResponse link(Long memberId, Map<String, Object> body) {
        requireAdmin();
        if (body == null || !body.containsKey("user_id")) {
            throw error(HttpStatus.BAD_REQUEST, "user_id는 필수입니다. 연결 해제는 null을 보내세요.");
        }
        Object raw = body.get("user_id");
        if (raw != null && !(raw instanceof Integer || raw instanceof Long)) {
            throw error(HttpStatus.BAD_REQUEST, "user_id는 양의 정수 또는 null이어야 합니다.");
        }
        Long userId = raw == null ? null : ((Number) raw).longValue();
        if (userId != null && userId <= 0) {
            throw error(HttpStatus.BAD_REQUEST, "user_id는 양의 정수여야 합니다.");
        }
        var member = members.findByIdForUpdate(memberId)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "조직원이 존재하지 않습니다."));
        if (!member.isActive()) {
            throw error(HttpStatus.CONFLICT, "비활성 조직원의 계정 연결은 변경할 수 없습니다.");
        }
        Account account = null;
        if (userId != null) {
            // JpaTransactionManager와 동일 DataSource를 사용합니다.
            // 계정 행을 잠가 동시 연결/계정 변경을 직렬화합니다.
            var rows = jdbc.query("SELECT id,email,role,is_active FROM users WHERE id = ? FOR UPDATE",
                    (rs, n) -> new Account(rs.getLong("id"), rs.getString("email"),
                            rs.getString("role"), rs.getBoolean("is_active")), userId);
            if (rows.isEmpty()) throw error(HttpStatus.NOT_FOUND, "계정이 존재하지 않습니다.");
            account = rows.get(0);
            if (!account.active()) throw error(HttpStatus.CONFLICT, "비활성 계정은 연결할 수 없습니다.");
            if (members.existsByUserIdAndIdNot(userId, memberId)) {
                throw error(HttpStatus.CONFLICT, "이미 다른 조직원에게 연결된 계정입니다.");
            }
        }
        member.setUserId(userId);
        try {
            members.saveAndFlush(member);
        } catch (DataIntegrityViolationException ex) {
            throw error(HttpStatus.CONFLICT, "계정 연결 정보가 변경되었습니다. 새로고침 후 다시 시도하세요.");
        }
        return response(member, account);
    }

    private static OrgMemberAccountResponse response(OrgMember m, Account a) {
        return new OrgMemberAccountResponse(m.getId(), m.getName(), m.getTitle(), m.getEmail(),
                m.getDepartment(), m.isActive(), m.getCreatedAt(), m.getUpdatedAt(), m.getUserId(),
                a == null ? null : a.email(), a == null ? null : a.role(), a == null ? null : a.active());
    }

    private static void requireAdmin() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()
                || auth.getAuthorities().stream().noneMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))) {
            throw error(HttpStatus.FORBIDDEN, "ADMIN만 조직원 계정을 관리할 수 있습니다.");
        }
    }

    private static ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }
}
