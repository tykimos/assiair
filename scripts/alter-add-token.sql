-- settings 테이블에 token 컬럼 추가 (app_token + user_token 모두 여기에 저장)
-- Supabase Dashboard → SQL Editor에서 실행

ALTER TABLE settings ADD COLUMN IF NOT EXISTS token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_token ON settings(token) WHERE token IS NOT NULL;

-- 기존 모든 설정에 6자리 토큰 자동 부여
UPDATE settings
SET token = substr(md5(random()::text || app || "user"), 1, 6)
WHERE token IS NULL;

NOTIFY pgrst, 'reload schema';

-- 확인: app_token = user='default' 행, user_token = user!='default' 행
SELECT app, "user",
  CASE WHEN "user" = 'default' THEN 'app_token' ELSE 'user_token' END AS token_type,
  token
FROM settings ORDER BY app, "user";
