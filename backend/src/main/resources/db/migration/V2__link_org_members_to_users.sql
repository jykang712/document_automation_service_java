ALTER TABLE org_members
    ADD COLUMN user_id BIGINT NULL AFTER id,
    ADD CONSTRAINT uq_org_members_user_id
        UNIQUE (user_id),
    ADD CONSTRAINT fk_org_members_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT;