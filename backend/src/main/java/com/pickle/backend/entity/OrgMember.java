package com.pickle.backend.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

/**
 * 결재 대상 조직원. 서비스 로그인 사용자(User)와 구분합니다.
 * 테이블 생성/변경과 외래키 삭제 정책은 Flyway SQL이 관리합니다.
 */
@Entity
@Table(
    name = "org_members",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_org_members_email", columnNames = {"email"}),
        @UniqueConstraint(name = "uq_org_members_user_id", columnNames = {"user_id"})
    },
    indexes = {
        @Index(name = "idx_org_members_department", columnList = "department"),
        @Index(name = "idx_org_members_active", columnList = "is_active")
    }
)
public class OrgMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;
    
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Column(name = "email", nullable = false, length = 255)
    private String email;

    @Column(name = "department", nullable = true, length = 100)
    private String department;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, columnDefinition = "datetime", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "updated_at", nullable = false, columnDefinition = "datetime", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public OrgMember() {
    }

    public Long getId() {
        return id;
    }
    
    public Long getUserId() {
        return userId;
    }
    
    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean isActive) {
        this.isActive = isActive;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

}
