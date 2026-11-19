package com.pickle.backend.repository;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import com.pickle.backend.entity.OrgMember;

public interface OrgMemberRepository extends JpaRepository<OrgMember, Long> {
    // 비활성 조직원에 연결된 계정도 중복 연결할 수 없습니다.
    boolean existsByUserIdAndIdNot(Long userId, Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from OrgMember m where m.id = :id")
    Optional<OrgMember> findByIdForUpdate(@Param("id") Long id);
    // 비활성 조직원도 DB 이메일 UNIQUE 제약 대상입니다.
    boolean existsByEmail(String email);

    // JPQL은 SQL 컬럼명 대신 Entity의 필드명을 사용합니다.
    @Query("select m from OrgMember m where m.isActive = true order by m.id asc")
    List<OrgMember> findActiveMembers();
}
