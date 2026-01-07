-- 기존 rooms 테이블에 capacity 컬럼 추가
-- 이미 테이블이 있는 경우 실행하세요

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 10;

-- 기존 회의실에 기본 수용 인원 설정
UPDATE rooms SET capacity = 10 WHERE capacity IS NULL;


