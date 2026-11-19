package com.pickle.backend.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.hibernate.generator.EventType;

/**
 * 양식별 결재 규칙. 결재자 목록은 Repository에서 규칙 ID로 조회합니다.
 * 테이블 생성/변경과 외래키 삭제 정책은 Flyway SQL이 관리합니다.
 */
@Entity
@Table(
    name = "approval_rules",
    indexes = {
        @Index(name = "idx_approval_rules_template", columnList = "template_id"),
        @Index(name = "idx_approval_rules_active", columnList = "is_active")
    }
)
public class ApprovalRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "rule_name", nullable = false, length = 255)
    private String ruleName;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "rule_text", nullable = false, columnDefinition = "text")
    private String ruleText;

    // FK ID: 실제 참조 존재/활성 여부는 Service에서 검증합니다.
    @Column(name = "template_id", nullable = false)
    private Long templateId;

    @Column(name = "source_type", nullable = false, length = 50)
    private String sourceType = "manual";

    @Column(name = "source_name", nullable = true, length = 255)
    private String sourceName;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "source_excerpt", nullable = true, columnDefinition = "text")
    private String sourceExcerpt;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, columnDefinition = "datetime", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "updated_at", nullable = false, columnDefinition = "datetime", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public ApprovalRule() {
    }

    public Long getId() {
        return id;
    }

    public String getRuleName() {
        return ruleName;
    }

    public void setRuleName(String ruleName) {
        this.ruleName = ruleName;
    }

    public String getRuleText() {
        return ruleText;
    }

    public void setRuleText(String ruleText) {
        this.ruleText = ruleText;
    }

    public Long getTemplateId() {
        return templateId;
    }

    public void setTemplateId(Long templateId) {
        this.templateId = templateId;
    }

    public String getSourceType() {
        return sourceType;
    }

    public void setSourceType(String sourceType) {
        this.sourceType = sourceType;
    }

    public String getSourceName() {
        return sourceName;
    }

    public void setSourceName(String sourceName) {
        this.sourceName = sourceName;
    }

    public String getSourceExcerpt() {
        return sourceExcerpt;
    }

    public void setSourceExcerpt(String sourceExcerpt) {
        this.sourceExcerpt = sourceExcerpt;
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
