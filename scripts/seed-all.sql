-- ============================================================
-- AssiAir: 테이블 생성 + 테스트 시드 데이터
-- Supabase Dashboard → SQL Editor에서 실행
-- ============================================================

-- ============================================================
-- PART 1: 테이블 생성
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app TEXT NOT NULL DEFAULT 'default',
  "user" TEXT NOT NULL DEFAULT 'anonymous',
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(app, "user")
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  app TEXT NOT NULL DEFAULT 'default',
  "user" TEXT NOT NULL DEFAULT 'anonymous',
  messages JSONB NOT NULL DEFAULT '[]',
  config_snapshot JSONB NOT NULL DEFAULT '{}',
  logs JSONB NOT NULL DEFAULT '[]',
  turn_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_app_user ON sessions(app, "user");
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS settings_updated_at ON settings;
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS sessions_updated_at ON sessions;
CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PART 2: 앱 기본 설정 (user='default')
-- ============================================================

INSERT INTO settings (app, "user", config) VALUES
-- App 1: AssiWorks 오프닝 이벤트
('assiworks', 'default', '{
  "theme": "light",
  "maxPlanSteps": 5,
  "maxChainDepth": 3,
  "activeSkills": ["greeting", "event-qa", "document-request", "user-lookup"],
  "systemPrompt": "AssiWorks 오프닝 이벤트 도우미입니다. 행사 안내, 부스 위치, 시간표 등을 안내합니다.",
  "activeTools": ["kb_search", "generate_document", "context_lookup", "user_lookup"],
  "activeWorkflows": ["greeting", "event-qa", "document-request"]
}'),
-- App 2: 교육 포털
('edu-portal', 'default', '{
  "theme": "light",
  "maxPlanSteps": 8,
  "maxChainDepth": 5,
  "activeSkills": ["greeting", "explain-code", "code-review", "test-writer"],
  "systemPrompt": "교육 포털 AI 튜터입니다. 프로그래밍 학습을 돕고, 코드 리뷰와 설명을 제공합니다.",
  "activeTools": ["js_sandbox", "python_sandbox", "kb_search"],
  "activeWorkflows": ["greeting", "code-review-and-fix", "explain-and-improve"]
}'),
-- App 3: 쇼핑몰 챗봇
('shop-bot', 'default', '{
  "theme": "dark",
  "maxPlanSteps": 4,
  "maxChainDepth": 3,
  "activeSkills": ["greeting", "intent-clarify"],
  "systemPrompt": "쇼핑몰 고객 상담 챗봇입니다. 주문 조회, 배송 추적, 교환/환불을 도와드립니다.",
  "activeTools": ["http_request", "fetch_data", "supabase_query"],
  "activeWorkflows": ["greeting"]
}')
ON CONFLICT (app, "user") DO UPDATE SET config = EXCLUDED.config;

-- ============================================================
-- PART 3: 사용자별 커스텀 설정
-- ============================================================

INSERT INTO settings (app, "user", config) VALUES
-- assiworks 사용자들
('assiworks', 'kim-mj',  '{"theme": "dark", "maxPlanSteps": 7}'),
('assiworks', 'lee-sh',  '{"activeSkills": ["greeting", "event-qa", "document-request", "user-lookup", "code-review"]}'),
('assiworks', 'park-jy', '{"theme": "light", "systemPrompt": "저는 VIP 참석자입니다. 우선 안내를 부탁합니다."}'),
('assiworks', 'choi-hy', '{"maxChainDepth": 5}'),
('assiworks', 'jung-wk', '{"activeWorkflows": ["greeting", "event-qa", "document-request", "code-review-and-fix"]}'),
-- edu-portal 사용자들
('edu-portal', 'student-01',  '{"maxPlanSteps": 3, "maxChainDepth": 2}'),
('edu-portal', 'student-02',  '{"theme": "dark"}'),
('edu-portal', 'teacher-kim', '{"maxPlanSteps": 10, "activeSkills": ["greeting", "explain-code", "code-review", "test-writer", "refactor"]}'),
('edu-portal', 'teacher-lee', '{"systemPrompt": "수학 전문 튜터입니다. 알고리즘과 수학적 사고를 돕습니다."}'),
('edu-portal', 'admin-park',  '{"theme": "dark", "maxPlanSteps": 12, "maxChainDepth": 8}'),
-- shop-bot 사용자들
('shop-bot', 'buyer-a',    '{"theme": "light"}'),
('shop-bot', 'buyer-b',    '{"maxPlanSteps": 6}'),
('shop-bot', 'buyer-c',    '{"theme": "light", "systemPrompt": "항상 친절하게 존댓말로 응대해 주세요."}'),
('shop-bot', 'seller-kim', '{"activeTools": ["http_request", "fetch_data", "supabase_query", "generate_document", "send_email"]}')
ON CONFLICT (app, "user") DO UPDATE SET config = EXCLUDED.config;

-- ============================================================
-- PART 4: 세션 데이터 (대화 + 로그)
-- ============================================================

INSERT INTO sessions (session_id, app, "user", turn_count, messages, logs, config_snapshot, created_at) VALUES

-- ── assiworks / kim-mj ──
('sess-aw-kim-001', 'assiworks', 'kim-mj', 2,
 '[{"role":"user","content":"안녕하세요, 행사 일정을 알고 싶습니다.","messageType":"text","timestamp":"2026-02-27T09:00:00Z"},
   {"role":"assistant","content":"AssiWorks 오프닝 이벤트에 오신 것을 환영합니다! 오늘 행사는 오전 10시 개회식, 11시 키노트, 오후 1시 부스 투어 순서로 진행됩니다.","messageType":"text","timestamp":"2026-02-27T09:00:05Z"},
   {"role":"user","content":"AI 부스는 어디에 있나요?","messageType":"text","timestamp":"2026-02-27T09:01:00Z"},
   {"role":"assistant","content":"AI 부스는 2층 B홀 B-12번 부스에 위치해 있습니다. 엘리베이터 바로 앞입니다.","messageType":"text","timestamp":"2026-02-27T09:01:04Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: 사용자 입력 수신","timestamp":"2026-02-27T09:00:00Z"},
   {"category":"executor","level":"info","message":"턴 1: 응답 생성 완료","timestamp":"2026-02-27T09:00:05Z"},
   {"category":"orchestrator","level":"info","message":"턴 2: 사용자 입력 수신","timestamp":"2026-02-27T09:01:00Z"},
   {"category":"executor","level":"info","message":"턴 2: 응답 생성 완료","timestamp":"2026-02-27T09:01:04Z"}]',
 '{"theme":"dark","maxPlanSteps":7}',
 '2026-02-27T09:00:00Z'),

('sess-aw-kim-002', 'assiworks', 'kim-mj', 3,
 '[{"role":"user","content":"참가 확인서를 발급받고 싶습니다.","messageType":"text","timestamp":"2026-02-27T14:00:00Z"},
   {"role":"assistant","content":"참가 확인서 발급을 도와드리겠습니다. 등록하신 이름과 소속을 알려주세요.","messageType":"text","timestamp":"2026-02-27T14:00:03Z"},
   {"role":"user","content":"김민준, AssiWorks입니다.","messageType":"text","timestamp":"2026-02-27T14:01:00Z"},
   {"role":"assistant","content":"김민준님의 참가 확인서를 PDF로 생성했습니다. 등록하신 이메일로 발송해 드렸습니다.","messageType":"text","timestamp":"2026-02-27T14:01:08Z"},
   {"role":"user","content":"감사합니다!","messageType":"text","timestamp":"2026-02-27T14:02:00Z"},
   {"role":"assistant","content":"도움이 되어 기쁩니다! 다른 문의사항이 있으시면 언제든 말씀해 주세요.","messageType":"text","timestamp":"2026-02-27T14:02:02Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: 스킬 매칭 → document-request","timestamp":"2026-02-27T14:00:01Z"},
   {"category":"executor","level":"info","message":"턴 2: generate_document 도구 호출","timestamp":"2026-02-27T14:01:05Z"},
   {"category":"executor","level":"info","message":"턴 2: PDF 생성 완료","timestamp":"2026-02-27T14:01:08Z"},
   {"category":"orchestrator","level":"info","message":"턴 3: 대화 종료","timestamp":"2026-02-27T14:02:02Z"}]',
 '{"theme":"dark","maxPlanSteps":7}',
 '2026-02-27T14:00:00Z'),

-- ── assiworks / lee-sh ──
('sess-aw-lee-001', 'assiworks', 'lee-sh', 2,
 '[{"role":"user","content":"키노트 발표자가 누구인가요?","messageType":"text","timestamp":"2026-02-27T10:30:00Z"},
   {"role":"assistant","content":"오늘 키노트는 AssiWorks CEO 이성현님이 \"AI와 함께하는 미래\"라는 주제로 발표합니다.","messageType":"text","timestamp":"2026-02-27T10:30:04Z"},
   {"role":"user","content":"발표 자료를 미리 볼 수 있나요?","messageType":"text","timestamp":"2026-02-27T10:31:00Z"},
   {"role":"assistant","content":"발표 자료는 키노트 종료 후 행사 홈페이지에서 다운로드 가능합니다.","messageType":"text","timestamp":"2026-02-27T10:31:03Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: event-qa 스킬 매칭","timestamp":"2026-02-27T10:30:01Z"},
   {"category":"executor","level":"info","message":"턴 1: kb_search 호출","timestamp":"2026-02-27T10:30:03Z"},
   {"category":"orchestrator","level":"info","message":"턴 2: 응답 생성","timestamp":"2026-02-27T10:31:03Z"}]',
 '{}', '2026-02-27T10:30:00Z'),

-- ── assiworks / park-jy ──
('sess-aw-park-001', 'assiworks', 'park-jy', 1,
 '[{"role":"user","content":"VIP 라운지는 어디인가요?","messageType":"text","timestamp":"2026-02-27T11:00:00Z"},
   {"role":"assistant","content":"VIP 라운지는 3층 A홀 끝 오른쪽에 위치해 있습니다. 등록증을 보여주시면 입장 가능합니다.","messageType":"text","timestamp":"2026-02-27T11:00:04Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: VIP 안내 처리","timestamp":"2026-02-27T11:00:01Z"}]',
 '{"theme":"light","systemPrompt":"저는 VIP 참석자입니다."}',
 '2026-02-27T11:00:00Z'),

-- ── assiworks / choi-hy ──
('sess-aw-choi-001', 'assiworks', 'choi-hy', 2,
 '[{"role":"user","content":"점심 메뉴가 뭔가요?","messageType":"text","timestamp":"2026-02-27T12:00:00Z"},
   {"role":"assistant","content":"오늘 점심은 한식 도시락(불고기 정식)과 샐러드 중 선택 가능합니다. 1층 로비에서 12시-13시 배부합니다.","messageType":"text","timestamp":"2026-02-27T12:00:05Z"},
   {"role":"user","content":"채식 메뉴도 있나요?","messageType":"text","timestamp":"2026-02-27T12:01:00Z"},
   {"role":"assistant","content":"네, 채식 도시락도 별도로 준비되어 있습니다. 안내 데스크에서 요청해 주세요.","messageType":"text","timestamp":"2026-02-27T12:01:03Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: event-qa","timestamp":"2026-02-27T12:00:01Z"},
   {"category":"orchestrator","level":"info","message":"턴 2: event-qa","timestamp":"2026-02-27T12:01:01Z"}]',
 '{}', '2026-02-27T12:00:00Z'),

-- ── assiworks / jung-wk ──
('sess-aw-jung-001', 'assiworks', 'jung-wk', 1,
 '[{"role":"user","content":"주차장 위치 알려주세요.","messageType":"text","timestamp":"2026-02-27T08:30:00Z"},
   {"role":"assistant","content":"지하 1~2층 주차장을 이용하실 수 있습니다. 행사 참석자는 4시간 무료 주차가 가능하며, 안내 데스크에서 주차권을 받으세요.","messageType":"text","timestamp":"2026-02-27T08:30:05Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: event-qa","timestamp":"2026-02-27T08:30:01Z"}]',
 '{}', '2026-02-27T08:30:00Z'),

-- ── edu-portal / student-01 ──
('sess-edu-s01-001', 'edu-portal', 'student-01', 2,
 '[{"role":"user","content":"Python에서 리스트 컴프리헨션이 뭔가요?","messageType":"text","timestamp":"2026-02-26T14:00:00Z"},
   {"role":"assistant","content":"리스트 컴프리헨션은 파이썬에서 리스트를 간결하게 생성하는 방법입니다.\n\n```python\nsquares = [x**2 for x in range(10)]\nevens = [x for x in range(20) if x % 2 == 0]\n```","messageType":"text","timestamp":"2026-02-26T14:00:06Z"},
   {"role":"user","content":"중첩도 가능한가요?","messageType":"text","timestamp":"2026-02-26T14:01:00Z"},
   {"role":"assistant","content":"네! ```python\nmatrix = [[1,2,3],[4,5,6]]\nflat = [num for row in matrix for num in row]\n``` 다만 3중 이상은 일반 for문을 추천합니다.","messageType":"text","timestamp":"2026-02-26T14:01:05Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: explain-code 스킬","timestamp":"2026-02-26T14:00:01Z"},
   {"category":"executor","level":"info","message":"턴 1: python_sandbox 호출","timestamp":"2026-02-26T14:00:04Z"},
   {"category":"orchestrator","level":"info","message":"턴 2: explain-code 스킬","timestamp":"2026-02-26T14:01:01Z"}]',
 '{"maxPlanSteps":3,"maxChainDepth":2}',
 '2026-02-26T14:00:00Z'),

('sess-edu-s01-002', 'edu-portal', 'student-01', 1,
 '[{"role":"user","content":"재귀함수 예제 보여주세요.","messageType":"text","timestamp":"2026-02-27T10:00:00Z"},
   {"role":"assistant","content":"피보나치 수열 예제입니다:\n```python\ndef fib(n):\n    if n <= 1: return n\n    return fib(n-1) + fib(n-2)\n```\n주의: n이 크면 매우 느립니다. 메모이제이션을 적용하면 O(n)으로 개선됩니다.","messageType":"text","timestamp":"2026-02-27T10:00:07Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: explain-code","timestamp":"2026-02-27T10:00:01Z"}]',
 '{"maxPlanSteps":3}',
 '2026-02-27T10:00:00Z'),

-- ── edu-portal / student-02 ──
('sess-edu-s02-001', 'edu-portal', 'student-02', 2,
 '[{"role":"user","content":"JavaScript에서 async/await 설명해 주세요.","messageType":"text","timestamp":"2026-02-26T16:00:00Z"},
   {"role":"assistant","content":"async/await는 비동기 코드를 동기적으로 읽히게 작성하는 문법입니다.\n```javascript\nasync function fetchData() {\n  const res = await fetch(\"/api/data\");\n  const json = await res.json();\n  return json;\n}\n```","messageType":"text","timestamp":"2026-02-26T16:00:06Z"},
   {"role":"user","content":"에러 처리는 어떻게 하나요?","messageType":"text","timestamp":"2026-02-26T16:01:00Z"},
   {"role":"assistant","content":"try/catch로 감싸면 됩니다:\n```javascript\ntry {\n  const data = await fetchData();\n} catch (err) {\n  console.error(err);\n}\n```","messageType":"text","timestamp":"2026-02-26T16:01:04Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: explain-code","timestamp":"2026-02-26T16:00:01Z"},
   {"category":"orchestrator","level":"info","message":"턴 2: explain-code","timestamp":"2026-02-26T16:01:01Z"}]',
 '{"theme":"dark"}',
 '2026-02-26T16:00:00Z'),

-- ── edu-portal / teacher-kim ──
('sess-edu-tk-001', 'edu-portal', 'teacher-kim', 3,
 '[{"role":"user","content":"이 코드를 리뷰해 주세요:\ndef calc(a,b): return a+b","messageType":"text","timestamp":"2026-02-25T09:00:00Z"},
   {"role":"assistant","content":"코드 리뷰:\n1. 함수명 calc → add_numbers로 변경 권장\n2. 타입 힌트 추가: def add_numbers(a: int, b: int) -> int\n3. 독스트링 추가 필요","messageType":"text","timestamp":"2026-02-25T09:00:05Z"},
   {"role":"user","content":"테스트 코드도 작성해 줘.","messageType":"text","timestamp":"2026-02-25T09:02:00Z"},
   {"role":"assistant","content":"```python\nimport pytest\ndef test_add_numbers():\n    assert add_numbers(2, 3) == 5\n    assert add_numbers(-1, 1) == 0\n    assert add_numbers(0, 0) == 0\n```","messageType":"text","timestamp":"2026-02-25T09:02:06Z"},
   {"role":"user","content":"edge case도 추가해 줘.","messageType":"text","timestamp":"2026-02-25T09:03:00Z"},
   {"role":"assistant","content":"```python\ndef test_add_large_numbers():\n    assert add_numbers(10**18, 10**18) == 2 * 10**18\n\ndef test_add_floats():\n    assert add_numbers(0.1, 0.2) == pytest.approx(0.3)\n```","messageType":"text","timestamp":"2026-02-25T09:03:05Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: code-review 스킬","timestamp":"2026-02-25T09:00:01Z"},
   {"category":"executor","level":"info","message":"턴 2: test-writer 스킬","timestamp":"2026-02-25T09:02:01Z"},
   {"category":"executor","level":"info","message":"턴 3: test-writer 보완","timestamp":"2026-02-25T09:03:01Z"}]',
 '{"maxPlanSteps":10}',
 '2026-02-25T09:00:00Z'),

-- ── edu-portal / teacher-lee ──
('sess-edu-tl-001', 'edu-portal', 'teacher-lee', 2,
 '[{"role":"user","content":"이진 탐색 알고리즘을 설명해 주세요.","messageType":"text","timestamp":"2026-02-26T11:00:00Z"},
   {"role":"assistant","content":"이진 탐색은 정렬된 배열에서 O(log n)으로 값을 찾는 알고리즘입니다.\n\n1. 중간값과 비교\n2. 작으면 왼쪽, 크면 오른쪽 절반으로\n3. 반복\n\n```python\ndef binary_search(arr, target):\n    lo, hi = 0, len(arr) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if arr[mid] == target: return mid\n        elif arr[mid] < target: lo = mid + 1\n        else: hi = mid - 1\n    return -1\n```","messageType":"text","timestamp":"2026-02-26T11:00:08Z"},
   {"role":"user","content":"시간복잡도 증명은?","messageType":"text","timestamp":"2026-02-26T11:02:00Z"},
   {"role":"assistant","content":"매 단계마다 탐색 범위가 절반으로 줄어듭니다. n → n/2 → n/4 → ... → 1\n\nk단계 후: n/2^k = 1 → k = log₂(n)\n\n따라서 시간복잡도는 O(log n)입니다.","messageType":"text","timestamp":"2026-02-26T11:02:05Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: explain-code","timestamp":"2026-02-26T11:00:01Z"},
   {"category":"orchestrator","level":"info","message":"턴 2: explain-code (수학)","timestamp":"2026-02-26T11:02:01Z"}]',
 '{}', '2026-02-26T11:00:00Z'),

-- ── edu-portal / admin-park ──
('sess-edu-ap-001', 'edu-portal', 'admin-park', 1,
 '[{"role":"user","content":"이번 주 학생 활동 통계를 보여주세요.","messageType":"text","timestamp":"2026-02-27T08:00:00Z"},
   {"role":"assistant","content":"이번 주 활동 통계:\n- 총 질문 수: 47건\n- 코드 리뷰 요청: 12건\n- 가장 활발한 학생: student-01 (15건)\n- 인기 주제: Python 기초 (23건)","messageType":"text","timestamp":"2026-02-27T08:00:06Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: supabase_query 호출","timestamp":"2026-02-27T08:00:02Z"}]',
 '{"theme":"dark","maxPlanSteps":12}',
 '2026-02-27T08:00:00Z'),

-- ── shop-bot / buyer-a ──
('sess-sb-ba-001', 'shop-bot', 'buyer-a', 2,
 '[{"role":"user","content":"주문번호 ORD-2024-1234 배송 상태를 확인해 주세요.","messageType":"text","timestamp":"2026-02-26T15:00:00Z"},
   {"role":"assistant","content":"주문 ORD-2024-1234 조회 결과:\n- 상품: 무선 블루투스 이어폰 Pro\n- 상태: 배송중\n- 택배사: CJ대한통운\n- 송장: 123456789012\n- 예상 도착: 3월 1일","messageType":"text","timestamp":"2026-02-26T15:00:06Z"},
   {"role":"user","content":"배송지를 변경할 수 있나요?","messageType":"text","timestamp":"2026-02-26T15:01:00Z"},
   {"role":"assistant","content":"이미 배송이 시작된 주문은 변경이 어렵습니다. CJ대한통운(1588-1255)에 직접 문의해 주세요.","messageType":"text","timestamp":"2026-02-26T15:01:04Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: http_request → 배송 API","timestamp":"2026-02-26T15:00:02Z"},
   {"category":"executor","level":"info","message":"턴 1: 배송 조회 완료","timestamp":"2026-02-26T15:00:05Z"},
   {"category":"orchestrator","level":"info","message":"턴 2: intent-clarify","timestamp":"2026-02-26T15:01:01Z"}]',
 '{"theme":"light"}',
 '2026-02-26T15:00:00Z'),

('sess-sb-ba-002', 'shop-bot', 'buyer-a', 1,
 '[{"role":"user","content":"포인트 잔액 확인해 주세요.","messageType":"text","timestamp":"2026-02-27T11:00:00Z"},
   {"role":"assistant","content":"현재 포인트 잔액은 12,500P입니다. 3월 31일 만료 예정 포인트: 2,000P","messageType":"text","timestamp":"2026-02-27T11:00:04Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: fetch_data → 포인트 조회","timestamp":"2026-02-27T11:00:01Z"}]',
 '{"theme":"light"}',
 '2026-02-27T11:00:00Z'),

-- ── shop-bot / buyer-b ──
('sess-sb-bb-001', 'shop-bot', 'buyer-b', 2,
 '[{"role":"user","content":"환불 절차를 알려주세요.","messageType":"text","timestamp":"2026-02-26T17:00:00Z"},
   {"role":"assistant","content":"환불 절차:\n1. 마이페이지 → 주문내역 → 교환/환불 신청\n2. 사유 선택 후 신청 완료\n3. 상품 수거 후 3-5영업일 내 환불\n\n단순 변심: 배송비 부담\n제품 하자: 무료 반품","messageType":"text","timestamp":"2026-02-26T17:00:06Z"},
   {"role":"user","content":"환불 기간이 지나면 어떻게 하나요?","messageType":"text","timestamp":"2026-02-26T17:01:00Z"},
   {"role":"assistant","content":"구매 후 7일 이내 환불 가능합니다. 기간 초과 시 고객센터(1588-0000)에 별도 문의 바랍니다. 제품 하자인 경우 기간 관계없이 교환/환불 가능합니다.","messageType":"text","timestamp":"2026-02-26T17:01:05Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: intent-clarify → 환불","timestamp":"2026-02-26T17:00:01Z"},
   {"category":"orchestrator","level":"info","message":"턴 2: kb_search → 환불정책","timestamp":"2026-02-26T17:01:01Z"}]',
 '{}', '2026-02-26T17:00:00Z'),

-- ── shop-bot / buyer-c ──
('sess-sb-bc-001', 'shop-bot', 'buyer-c', 3,
 '[{"role":"user","content":"추천 상품 있나요?","messageType":"text","timestamp":"2026-02-27T13:00:00Z"},
   {"role":"assistant","content":"고객님의 구매 이력 기반 추천 상품입니다:\n1. 삼성 갤럭시 버즈3 Pro - 189,000원\n2. 애플 에어팟 4세대 - 159,000원\n3. 소니 WF-1000XM6 - 279,000원","messageType":"text","timestamp":"2026-02-27T13:00:07Z"},
   {"role":"user","content":"2번 상품 상세 정보 보여줘.","messageType":"text","timestamp":"2026-02-27T13:01:00Z"},
   {"role":"assistant","content":"애플 에어팟 4세대:\n- 가격: 159,000원\n- 노이즈캔슬링: O\n- 배터리: 최대 30시간\n- 무게: 4.3g(개당)\n- 무료배송 / 내일 도착","messageType":"text","timestamp":"2026-02-27T13:01:05Z"},
   {"role":"user","content":"장바구니에 담아줘.","messageType":"text","timestamp":"2026-02-27T13:02:00Z"},
   {"role":"assistant","content":"애플 에어팟 4세대를 장바구니에 담았습니다. 현재 장바구니: 1개 상품, 총 159,000원","messageType":"text","timestamp":"2026-02-27T13:02:03Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: fetch_data → 추천","timestamp":"2026-02-27T13:00:02Z"},
   {"category":"executor","level":"info","message":"턴 2: fetch_data → 상품 상세","timestamp":"2026-02-27T13:01:02Z"},
   {"category":"executor","level":"info","message":"턴 3: http_request → 장바구니 추가","timestamp":"2026-02-27T13:02:01Z"}]',
 '{"theme":"light"}',
 '2026-02-27T13:00:00Z'),

-- ── shop-bot / seller-kim ──
('sess-sb-sk-001', 'shop-bot', 'seller-kim', 2,
 '[{"role":"user","content":"이번 달 판매 현황을 알려주세요.","messageType":"text","timestamp":"2026-02-27T09:00:00Z"},
   {"role":"assistant","content":"2월 판매 현황:\n- 총 주문: 342건 (+12% 전월 대비)\n- 매출액: 28,450,000원\n- 반품률: 3.2%\n- 베스트 상품: 무선 이어폰 Pro (89건)","messageType":"text","timestamp":"2026-02-27T09:00:08Z"},
   {"role":"user","content":"반품 사유 분석 리포트를 만들어줘.","messageType":"text","timestamp":"2026-02-27T09:02:00Z"},
   {"role":"assistant","content":"반품 사유 분석 리포트를 생성했습니다:\n- 단순 변심: 45%\n- 제품 불량: 22%\n- 오배송: 18%\n- 사이즈 불일치: 15%\n\nPDF 리포트가 이메일로 발송되었습니다.","messageType":"text","timestamp":"2026-02-27T09:02:10Z"}]',
 '[{"category":"orchestrator","level":"info","message":"턴 1: supabase_query → 판매 데이터","timestamp":"2026-02-27T09:00:02Z"},
   {"category":"executor","level":"info","message":"턴 2: generate_document → 리포트","timestamp":"2026-02-27T09:02:05Z"},
   {"category":"executor","level":"info","message":"턴 2: send_email → 발송","timestamp":"2026-02-27T09:02:09Z"}]',
 '{"activeTools":["http_request","fetch_data","supabase_query","generate_document","send_email"]}',
 '2026-02-27T09:00:00Z')

ON CONFLICT (session_id) DO UPDATE SET
  messages = EXCLUDED.messages,
  logs = EXCLUDED.logs,
  config_snapshot = EXCLUDED.config_snapshot,
  turn_count = EXCLUDED.turn_count;

-- ============================================================
-- 확인 쿼리
-- ============================================================
SELECT 'settings' AS "table", count(*) AS "rows" FROM settings
UNION ALL
SELECT 'sessions', count(*) FROM sessions;
