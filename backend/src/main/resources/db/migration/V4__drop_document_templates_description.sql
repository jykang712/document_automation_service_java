-- 백엔드를 중지하고 이 패치의 코드와 함께 적용합니다. 기존 양식 설명 값은 삭제됩니다.
-- V4가 이미 사용되었다면 아직 적용하지 않은 다음 버전으로 파일명을 변경하세요.
ALTER TABLE document_templates DROP COLUMN description;
