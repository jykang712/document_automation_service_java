package com.pickle.backend.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.pickle.backend.dto.OrgMemberEditRequest;

@Service
public class OrgMemberProfileService {
    private final JdbcTemplate jdbc;
    public OrgMemberProfileService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional
    public void update(Long id, OrgMemberEditRequest request) {
        ManagementSupport.admin();
        if (request == null) throw ManagementSupport.error(HttpStatus.BAD_REQUEST, "조직원 정보를 입력하세요.");
        String name = ManagementSupport.required(request.name(), "이름", 100);
        String title = ManagementSupport.required(request.title(), "직급", 100);
        String email = ManagementSupport.email(request.email());
        String department = ManagementSupport.optional(request.department(), "부서", 100);
        var active = jdbc.query("SELECT is_active FROM org_members WHERE id=? FOR UPDATE",
                (rs, n) -> rs.getBoolean(1), id);
        if (active.isEmpty()) throw ManagementSupport.error(HttpStatus.NOT_FOUND, "조직원이 존재하지 않습니다.");
        if (!active.get(0)) throw ManagementSupport.error(HttpStatus.CONFLICT, "비활성 조직원은 수정할 수 없습니다.");
        Long duplicates = jdbc.queryForObject("SELECT COUNT(*) FROM org_members WHERE email=? AND id<>?", Long.class, email, id);
        if (duplicates != null && duplicates > 0) throw ManagementSupport.error(HttpStatus.CONFLICT, "이미 등록된 조직원 이메일입니다.");
        try {
            jdbc.update("UPDATE org_members SET name=?,title=?,email=?,department=? WHERE id=?", name, title, email, department, id);
        } catch (DataIntegrityViolationException ex) {
            throw ManagementSupport.error(HttpStatus.CONFLICT, "이미 등록된 조직원 이메일입니다.");
        }
        // user_id와 users의 이름/이메일/권한/비밀번호는 변경하지 않습니다.
    }
}
