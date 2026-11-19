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
 * 사용자 소유 생성 문서와 생성 당시 결재선/수신자 정보.
 * 테이블 생성/변경과 외래키 삭제 정책은 Flyway SQL이 관리합니다.
 */
@Entity
@Table(
    name = "generated_documents",
    indexes = {
        @Index(name = "idx_generated_documents_owner", columnList = "owner_user_id"),
        @Index(name = "idx_generated_documents_template", columnList = "template_id"),
        @Index(name = "idx_generated_documents_active", columnList = "is_active"),
        @Index(name = "idx_generated_documents_created", columnList = "created_at"),
        @Index(name = "idx_generated_documents_owner_active", columnList = "owner_user_id, is_active")
    }
)
public class GeneratedDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    // FK ID: 실제 참조 존재/활성 여부는 Service에서 검증합니다.
    @Column(name = "owner_user_id", nullable = false)
    private Long ownerUserId;

    // FK ID: 실제 참조 존재/활성 여부는 Service에서 검증합니다.
    @Column(name = "template_id", nullable = false)
    private Long templateId;

    // FK ID: 실제 참조 존재/활성 여부는 Service에서 검증합니다.
    @Column(name = "applied_rule_id", nullable = true)
    private Long appliedRuleId;

    // FK ID: 실제 참조 존재/활성 여부는 Service에서 검증합니다.
    @Column(name = "recipient_member_id", nullable = true)
    private Long recipientMemberId;

    @Column(name = "document_title", nullable = true, length = 255)
    private String documentTitle;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "description", nullable = true, columnDefinition = "text")
    private String description;

    @Column(name = "receipt_file_name", nullable = true, length = 500)
    private String receiptFileName;

    @Column(name = "receipt_content_type", nullable = true, length = 100)
    private String receiptContentType;

    // 유효한 JSON 문자열로 저장. 응답 DTO에서는 객체/배열로 변환합니다.
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "extracted_json", nullable = true, columnDefinition = "json")
    private String extractedJson;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "html_content", nullable = false, columnDefinition = "longtext")
    private String htmlContent;

    @Column(name = "recipient_name", nullable = true, length = 100)
    private String recipientName;

    @Column(name = "recipient_email", nullable = true, length = 255)
    private String recipientEmail;

    @Column(name = "recipient_title", nullable = true, length = 100)
    private String recipientTitle;

    @Column(name = "requester_name", nullable = true, length = 100)
    private String requesterName;

    @Column(name = "requester_department", nullable = true, length = 100)
    private String requesterDepartment;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "approval_line_text", nullable = true, columnDefinition = "text")
    private String approvalLineText;

    // 유효한 JSON 문자열로 저장. 응답 DTO에서는 객체/배열로 변환합니다.
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "approval_line_json", nullable = true, columnDefinition = "json")
    private String approvalLineJson;

    @Column(name = "is_sent", nullable = false)
    private boolean isSent = false;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, columnDefinition = "datetime", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "updated_at", nullable = false, columnDefinition = "datetime", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public GeneratedDocument() {
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerUserId() {
        return ownerUserId;
    }

    public void setOwnerUserId(Long ownerUserId) {
        this.ownerUserId = ownerUserId;
    }

    public Long getTemplateId() {
        return templateId;
    }

    public void setTemplateId(Long templateId) {
        this.templateId = templateId;
    }

    public Long getAppliedRuleId() {
        return appliedRuleId;
    }

    public void setAppliedRuleId(Long appliedRuleId) {
        this.appliedRuleId = appliedRuleId;
    }

    public Long getRecipientMemberId() {
        return recipientMemberId;
    }

    public void setRecipientMemberId(Long recipientMemberId) {
        this.recipientMemberId = recipientMemberId;
    }

    public String getDocumentTitle() {
        return documentTitle;
    }

    public void setDocumentTitle(String documentTitle) {
        this.documentTitle = documentTitle;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getReceiptFileName() {
        return receiptFileName;
    }

    public void setReceiptFileName(String receiptFileName) {
        this.receiptFileName = receiptFileName;
    }

    public String getReceiptContentType() {
        return receiptContentType;
    }

    public void setReceiptContentType(String receiptContentType) {
        this.receiptContentType = receiptContentType;
    }

    public String getExtractedJson() {
        return extractedJson;
    }

    public void setExtractedJson(String extractedJson) {
        this.extractedJson = extractedJson;
    }

    public String getHtmlContent() {
        return htmlContent;
    }

    public void setHtmlContent(String htmlContent) {
        this.htmlContent = htmlContent;
    }

    public String getRecipientName() {
        return recipientName;
    }

    public void setRecipientName(String recipientName) {
        this.recipientName = recipientName;
    }

    public String getRecipientEmail() {
        return recipientEmail;
    }

    public void setRecipientEmail(String recipientEmail) {
        this.recipientEmail = recipientEmail;
    }

    public String getRecipientTitle() {
        return recipientTitle;
    }

    public void setRecipientTitle(String recipientTitle) {
        this.recipientTitle = recipientTitle;
    }

    public String getRequesterName() {
        return requesterName;
    }

    public void setRequesterName(String requesterName) {
        this.requesterName = requesterName;
    }

    public String getRequesterDepartment() {
        return requesterDepartment;
    }

    public void setRequesterDepartment(String requesterDepartment) {
        this.requesterDepartment = requesterDepartment;
    }

    public String getApprovalLineText() {
        return approvalLineText;
    }

    public void setApprovalLineText(String approvalLineText) {
        this.approvalLineText = approvalLineText;
    }

    public String getApprovalLineJson() {
        return approvalLineJson;
    }

    public void setApprovalLineJson(String approvalLineJson) {
        this.approvalLineJson = approvalLineJson;
    }

    public boolean isSent() {
        return isSent;
    }

    public void setSent(boolean isSent) {
        this.isSent = isSent;
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
