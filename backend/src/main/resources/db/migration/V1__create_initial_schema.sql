CREATE TABLE users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    INDEX idx_users_role (role),
    INDEX idx_users_active (is_active)
);


CREATE TABLE document_templates (
    id BIGINT NOT NULL AUTO_INCREMENT,
    template_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NULL,
    html_content LONGTEXT NOT NULL,
    description TEXT NULL,
    template_schema JSON NULL,
    placeholder_keys JSON NULL,
    template_fields JSON NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_document_templates_name (template_name),
    INDEX idx_document_templates_active (is_active)
);


CREATE TABLE org_members (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    title VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    department VARCHAR(100) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_org_members_email (email),
    INDEX idx_org_members_department (department),
    INDEX idx_org_members_active (is_active)
);


CREATE TABLE approval_rules (
    id BIGINT NOT NULL AUTO_INCREMENT,
    rule_name VARCHAR(255) NOT NULL,
    rule_text TEXT NOT NULL,
    template_id BIGINT NOT NULL,
    source_type VARCHAR(50) NOT NULL DEFAULT 'manual',
    source_name VARCHAR(255) NULL,
    source_excerpt TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_approval_rules_template
        FOREIGN KEY (template_id)
        REFERENCES document_templates(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_approval_rules_template (template_id),
    INDEX idx_approval_rules_active (is_active)
);


CREATE TABLE approval_rule_approvers (
    id BIGINT NOT NULL AUTO_INCREMENT,
    rule_id BIGINT NOT NULL,
    approver_member_id BIGINT NOT NULL,
    approval_order INT NOT NULL,
    approval_type VARCHAR(50) NOT NULL DEFAULT '결재',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_rule_approvers_rule
        FOREIGN KEY (rule_id)
        REFERENCES approval_rules(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_rule_approvers_member
        FOREIGN KEY (approver_member_id)
        REFERENCES org_members(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    UNIQUE KEY uq_rule_approver_member (
        rule_id,
        approver_member_id
    ),

    UNIQUE KEY uq_rule_approver_order (
        rule_id,
        approval_order
    ),

    INDEX idx_rule_approvers_rule (rule_id),
    INDEX idx_rule_approvers_member (approver_member_id)
);


CREATE TABLE generated_documents (
    id BIGINT NOT NULL AUTO_INCREMENT,

    owner_user_id BIGINT NOT NULL,
    template_id BIGINT NOT NULL,
    applied_rule_id BIGINT NULL,
    recipient_member_id BIGINT NULL,

    document_title VARCHAR(255) NULL,
    description TEXT NULL,
    receipt_file_name VARCHAR(500) NULL,
    receipt_content_type VARCHAR(100) NULL,

    extracted_json JSON NULL,
    html_content LONGTEXT NOT NULL,

    recipient_name VARCHAR(100) NULL,
    recipient_email VARCHAR(255) NULL,
    recipient_title VARCHAR(100) NULL,

    requester_name VARCHAR(100) NULL,
    requester_department VARCHAR(100) NULL,

    approval_line_text TEXT NULL,
    approval_line_json JSON NULL,

    is_sent BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_generated_documents_owner
        FOREIGN KEY (owner_user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_generated_documents_template
        FOREIGN KEY (template_id)
        REFERENCES document_templates(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_generated_documents_rule
        FOREIGN KEY (applied_rule_id)
        REFERENCES approval_rules(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT fk_generated_documents_recipient
        FOREIGN KEY (recipient_member_id)
        REFERENCES org_members(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    INDEX idx_generated_documents_owner (owner_user_id),
    INDEX idx_generated_documents_template (template_id),
    INDEX idx_generated_documents_active (is_active),
    INDEX idx_generated_documents_created (created_at),
    INDEX idx_generated_documents_owner_active (
        owner_user_id,
        is_active
    )
);