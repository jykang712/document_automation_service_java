package com.pickle.backend.service;

import java.util.List;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.annotation.JsonProperty;

@Service
@Transactional(readOnly = true)
public class UserManagementService {
    private final JdbcTemplate jdbc;
    public UserManagementService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record UserRow(Long id, @JsonProperty("login_id") String loginId, String name, String role, boolean active,
            @JsonProperty("org_member_id") Long memberId,
            @JsonProperty("org_member_name") String memberName,
            @JsonProperty("org_member_email") String memberEmail,
            @JsonProperty("org_member_active") Boolean memberActive) {}
    public record MemberOption(Long id, String name, String title, String email, String department,
            @JsonProperty("user_id") Long userId) {}
    private record LockedMember(Long id, Long userId, boolean active) {}

    public List<UserRow> list() {
        ManagementSupport.admin();
        return jdbc.query("""
                SELECT u.id,u.login_id,u.name,u.role,u.is_active,
                       o.id AS member_id,o.name AS member_name,o.email AS member_email,o.is_active AS member_active
                FROM users u LEFT JOIN org_members o ON o.user_id=u.id ORDER BY u.id
                """, (rs, n) -> new UserRow(rs.getLong("id"), rs.getString("login_id"), rs.getString("name"),
                        rs.getString("role"), rs.getBoolean("is_active"),
                        rs.getObject("member_id") == null ? null : rs.getLong("member_id"),
                        rs.getString("member_name"), rs.getString("member_email"),
                        rs.getObject("member_active") == null ? null : rs.getBoolean("member_active")));
    }
    public List<MemberOption> members() {
        ManagementSupport.admin();
        return jdbc.query("SELECT id,name,title,email,department,user_id FROM org_members WHERE is_active=TRUE ORDER BY id",
                (rs, n) -> new MemberOption(rs.getLong("id"), rs.getString("name"), rs.getString("title"),
                        rs.getString("email"), rs.getString("department"),
                        rs.getObject("user_id") == null ? null : rs.getLong("user_id")));
    }
    @Transactional
    public void link(Long userId, Map<String, Object> request) {
        ManagementSupport.admin();
        Long memberId = ManagementSupport.nullableId(request, "org_member_id");
        var users = jdbc.query("SELECT is_active FROM users WHERE id=? FOR UPDATE", (rs, n) -> rs.getBoolean(1), userId);
        if (users.isEmpty()) throw ManagementSupport.error(HttpStatus.NOT_FOUND, "계정이 존재하지 않습니다.");
        if (memberId != null && !users.get(0)) throw ManagementSupport.error(HttpStatus.CONFLICT, "비활성 계정은 연결할 수 없습니다.");
        // 같은 계정의 변경은 위 계정 잠금으로, 대상 조직원은 아래 잠금으로 보호합니다.
        // 이전 연결 해제와 새 연결을 한 트랜잭션에서 수행합니다.
        var rows = jdbc.query("SELECT id,user_id,is_active FROM org_members WHERE user_id=? OR id=? ORDER BY id FOR UPDATE",
                (rs, n) -> new LockedMember(rs.getLong("id"), rs.getObject("user_id") == null ? null : rs.getLong("user_id"),
                        rs.getBoolean("is_active")), userId, memberId);
        if (memberId != null) {
            var target = rows.stream().filter(m -> m.id().equals(memberId)).findFirst()
                    .orElseThrow(() -> ManagementSupport.error(HttpStatus.NOT_FOUND, "조직원이 존재하지 않습니다."));
            if (!target.active()) throw ManagementSupport.error(HttpStatus.CONFLICT, "비활성 조직원은 연결할 수 없습니다.");
            if (target.userId() != null && !target.userId().equals(userId)) {
                throw ManagementSupport.error(HttpStatus.CONFLICT, "다른 계정이 연결된 조직원입니다. 기존 연결부터 확인하세요.");
            }
        }
        try {
            jdbc.update("UPDATE org_members SET user_id=NULL WHERE user_id=?", userId);
            if (memberId != null) jdbc.update("UPDATE org_members SET user_id=? WHERE id=?", userId, memberId);
        } catch (DataIntegrityViolationException ex) {
            throw ManagementSupport.error(HttpStatus.CONFLICT, "연결 정보가 변경되었습니다. 새로고침 후 다시 시도하세요.");
        }
        // 이름/이메일이 같아도 자동 연결하지 않습니다. 권한과 비밀번호도 변경하지 않습니다.
    }
}
