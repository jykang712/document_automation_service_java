package com.pickle.backend.entity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "document_templates")
public class DocumentTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(
        name = "template_name",
        nullable = false,
        length = 255
    )
    private String templateName;

    @Column(
        name = "file_name",
        length = 255
    )
    private String fileName;

    @Column(
        name = "html_content",
        nullable = false,
        columnDefinition = "LONGTEXT"
    )
    private String htmlContent;

@JdbcTypeCode(SqlTypes.JSON)
    @Column(
        name = "template_schema",
        columnDefinition = "JSON"
    )
    private Map<String, Object> templateSchema;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(
        name = "placeholder_keys",
        columnDefinition = "JSON"
    )
    private List<String> placeholderKeys;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(
        name = "template_fields",
        columnDefinition = "JSON"
    )
    private List<Map<String, Object>> templateFields;

    @Column(
        name = "is_active",
        nullable = false
    )
    private boolean active = true;

    @CreationTimestamp
    @Column(
        name = "created_at",
        nullable = false,
        updatable = false
    )
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(
        name = "updated_at",
        nullable = false
    )
    private LocalDateTime updatedAt;


    public DocumentTemplate() {
    }


    public Long getId() {
        return id;
    }


    public void setId(Long id) {
        this.id = id;
    }


    public String getTemplateName() {
        return templateName;
    }


    public void setTemplateName(String templateName) {
        this.templateName = templateName;
    }


    public String getFileName() {
        return fileName;
    }


    public void setFileName(String fileName) {
        this.fileName = fileName;
    }


    public String getHtmlContent() {
        return htmlContent;
    }


    public void setHtmlContent(String htmlContent) {
        this.htmlContent = htmlContent;
    }


    public Map<String, Object> getTemplateSchema() {
        return templateSchema;
    }


    public void setTemplateSchema(Map<String, Object> templateSchema) {
        this.templateSchema = templateSchema;
    }


    public List<String> getPlaceholderKeys() {
        return placeholderKeys;
    }


    public void setPlaceholderKeys(List<String> placeholderKeys) {
        this.placeholderKeys = placeholderKeys;
    }


    public List<Map<String, Object>> getTemplateFields() {
        return templateFields;
    }


    public void setTemplateFields(
        List<Map<String, Object>> templateFields
    ) {
        this.templateFields = templateFields;
    }


    public boolean isActive() {
        return active;
    }


    public void setActive(boolean active) {
        this.active = active;
    }


    public LocalDateTime getCreatedAt() {
        return createdAt;
    }


    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
