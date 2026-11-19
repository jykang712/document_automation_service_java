-- V1/V2는 수정하지 않습니다. 백엔드를 중지하고 V3 대응 코드를 배포한 뒤 Flyway로 적용합니다.
-- 기존 계정에는 숫자 PK에 기반한 중복 없는 로그인 아이디를 부여합니다.
ALTER TABLE users
    ADD COLUMN login_id VARCHAR(50) NULL AFTER id;

UPDATE users
SET login_id = CONCAT('user_', id),
    updated_at = updated_at;

ALTER TABLE users
    MODIFY COLUMN login_id VARCHAR(50) NOT NULL,
    ADD CONSTRAINT uq_users_login_id UNIQUE (login_id),
    DROP INDEX uq_users_email,
    DROP COLUMN email;

-- users.id, password_hash, role 및 org_members.user_id는 변경하지 않습니다.
-- org_members.email을 복사하거나 외래키로 사용하지 않습니다.
