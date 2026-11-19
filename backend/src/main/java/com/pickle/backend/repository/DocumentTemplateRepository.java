package com.pickle.backend.repository;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.pickle.backend.entity.DocumentTemplate;

public interface DocumentTemplateRepository extends JpaRepository<DocumentTemplate, Long> {
    List<DocumentTemplate> findAllByOrderByIdDesc();
    List<DocumentTemplate> findByActiveTrueOrderByIdDesc();
    Optional<DocumentTemplate> findByIdAndActiveTrue(Long id);

    // 문서 생성이 끝날 때까지 같은 양식의 비활성화/수정을 대기시킵니다.
    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select t from DocumentTemplate t where t.id = :id and t.active = true")
    Optional<DocumentTemplate> findActiveForUse(@Param("id") Long id);
}
