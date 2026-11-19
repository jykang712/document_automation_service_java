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
 * 규칙에 속한 결재자와 순서. 순서/구성원 중복은 DB UNIQUE 제약으로 제한됩니다.
 * 테이블 생성/변경과 외래키 삭제 정책은 Flyway SQL이 관리합니다.
 */
@Entity
@Table(
    name = "approval_rule_approvers",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_rule_approver_member", columnNames = {"rule_id", "approver_member_id"}),
        @UniqueConstraint(name = "uq_rule_approver_order", columnNames = {"rule_id", "approval_order"})
    },
    indexes = {
        @Index(name = "idx_rule_approvers_rule", columnList = "rule_id"),
        @Index(name = "idx_rule_approvers_member", columnList = "approver_member_id")
    }
)
public class ApprovalRuleApprover {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    // FK ID: 실제 참조 존재/활성 여부는 Service에서 검증합니다.
    @Column(name = "rule_id", nullable = false)
    private Long ruleId;

    // FK ID: 실제 참조 존재/활성 여부는 Service에서 검증합니다.
    @Column(name = "approver_member_id", nullable = false)
    private Long approverMemberId;

    @Column(name = "approval_order", nullable = false)
    private Integer approvalOrder;

    @Column(name = "approval_type", nullable = false, length = 50)
    private String approvalType = "결재";

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, columnDefinition = "datetime", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public ApprovalRuleApprover() {
    }

    public Long getId() {
        return id;
    }

    public Long getRuleId() {
        return ruleId;
    }

    public void setRuleId(Long ruleId) {
        this.ruleId = ruleId;
    }

    public Long getApproverMemberId() {
        return approverMemberId;
    }

    public void setApproverMemberId(Long approverMemberId) {
        this.approverMemberId = approverMemberId;
    }

    public Integer getApprovalOrder() {
        return approvalOrder;
    }

    public void setApprovalOrder(Integer approvalOrder) {
        this.approvalOrder = approvalOrder;
    }

    public String getApprovalType() {
        return approvalType;
    }

    public void setApprovalType(String approvalType) {
        this.approvalType = approvalType;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

}
