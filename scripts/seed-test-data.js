#!/usr/bin/env node
/**
 * Seed script: 3 apps × 4+ users each, with sessions and custom settings
 * Usage: node scripts/seed-test-data.js [base_url]
 * Default base_url: http://localhost:3001
 */

const BASE = process.argv[2] || 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Test data definitions
// ---------------------------------------------------------------------------

const APPS = [
  { id: 'assiworks', label: 'AssiWorks 오프닝 이벤트' },
  { id: 'edu-portal', label: '교육 포털' },
  { id: 'shop-bot', label: '쇼핑몰 챗봇' },
];

const USERS_PER_APP = {
  'assiworks': ['kim-mj', 'lee-sh', 'park-jy', 'choi-hy', 'jung-wk'],
  'edu-portal': ['student-01', 'student-02', 'teacher-kim', 'teacher-lee', 'admin-park'],
  'shop-bot': ['buyer-a', 'buyer-b', 'buyer-c', 'seller-kim'],
};

// App-level default settings (admin sets these)
const APP_DEFAULT_CONFIGS = {
  'assiworks': {
    theme: 'light',
    maxPlanSteps: 5,
    maxChainDepth: 3,
    activeSkills: ['greeting', 'event-qa', 'document-request', 'user-lookup'],
    systemPrompt: 'AssiWorks 오프닝 이벤트 도우미입니다. 행사 안내, 부스 위치, 시간표 등을 안내합니다.',
    activeTools: ['kb_search', 'generate_document', 'context_lookup', 'user_lookup'],
    activeWorkflows: ['greeting', 'event-qa', 'document-request'],
  },
  'edu-portal': {
    theme: 'light',
    maxPlanSteps: 8,
    maxChainDepth: 5,
    activeSkills: ['greeting', 'explain-code', 'code-review', 'test-writer'],
    systemPrompt: '교육 포털 AI 튜터입니다. 프로그래밍 학습을 돕고, 코드 리뷰와 설명을 제공합니다.',
    activeTools: ['js_sandbox', 'python_sandbox', 'kb_search'],
    activeWorkflows: ['greeting', 'code-review-and-fix', 'explain-and-improve'],
  },
  'shop-bot': {
    theme: 'dark',
    maxPlanSteps: 4,
    maxChainDepth: 3,
    activeSkills: ['greeting', 'intent-clarify'],
    systemPrompt: '쇼핑몰 고객 상담 챗봇입니다. 주문 조회, 배송 추적, 교환/환불을 도와드립니다.',
    activeTools: ['http_request', 'fetch_data', 'supabase_query'],
    activeWorkflows: ['greeting'],
  },
};

// User-specific custom settings (overrides on top of app defaults)
const USER_CUSTOM_CONFIGS = {
  'assiworks': {
    'kim-mj': { theme: 'dark', maxPlanSteps: 7 },
    'lee-sh': { activeSkills: ['greeting', 'event-qa', 'document-request', 'user-lookup', 'code-review'] },
    'park-jy': { theme: 'light', systemPrompt: '저는 VIP 참석자입니다. 우선 안내를 부탁합니다.' },
  },
  'edu-portal': {
    'student-01': { maxPlanSteps: 3, maxChainDepth: 2 },
    'teacher-kim': { maxPlanSteps: 10, activeSkills: ['greeting', 'explain-code', 'code-review', 'test-writer', 'refactor'] },
    'admin-park': { theme: 'dark' },
  },
  'shop-bot': {
    'buyer-a': { theme: 'light' },
    'seller-kim': { activeTools: ['http_request', 'fetch_data', 'supabase_query', 'generate_document', 'send_email'] },
  },
};

// Session conversation templates
function makeMessages(app, user, turnCount) {
  const now = new Date();
  const conversations = {
    'assiworks': [
      [
        { role: 'user', content: '안녕하세요, 행사 일정을 알고 싶습니다.', messageType: 'text' },
        { role: 'assistant', content: 'AssiWorks 오프닝 이벤트에 오신 것을 환영합니다! 오늘 행사는 오전 10시 개회식, 11시 키노트, 오후 1시 부스 투어 순서로 진행됩니다.', messageType: 'text' },
        { role: 'user', content: 'AI 부스는 어디에 있나요?', messageType: 'text' },
        { role: 'assistant', content: 'AI 부스는 2층 B홀 B-12번 부스에 위치해 있습니다. 엘리베이터 바로 앞입니다.', messageType: 'text' },
      ],
      [
        { role: 'user', content: '참가 확인서를 발급받고 싶습니다.', messageType: 'text' },
        { role: 'assistant', content: '참가 확인서 발급을 도와드리겠습니다. 등록하신 이름과 소속을 알려주세요.', messageType: 'text' },
        { role: 'user', content: '김민준, AssiWorks입니다.', messageType: 'text' },
        { role: 'assistant', content: '김민준님의 참가 확인서를 PDF로 생성했습니다. 등록하신 이메일로 발송해 드렸습니다.', messageType: 'text' },
        { role: 'user', content: '감사합니다!', messageType: 'text' },
        { role: 'assistant', content: '도움이 되어 기쁩니다! 다른 문의사항이 있으시면 언제든 말씀해 주세요.', messageType: 'text' },
      ],
    ],
    'edu-portal': [
      [
        { role: 'user', content: 'Python에서 리스트 컴프리헨션이 뭔가요?', messageType: 'text' },
        { role: 'assistant', content: '리스트 컴프리헨션은 파이썬에서 리스트를 간결하게 생성하는 방법입니다.\n\n```python\n# 기본 형태\nsquares = [x**2 for x in range(10)]\n\n# 조건 포함\nevens = [x for x in range(20) if x % 2 == 0]\n```\n\nfor 루프보다 간결하고 빠릅니다.', messageType: 'text' },
        { role: 'user', content: '중첩 리스트 컴프리헨션도 가능한가요?', messageType: 'text' },
        { role: 'assistant', content: '네! 중첩도 가능합니다.\n\n```python\nmatrix = [[1,2,3],[4,5,6],[7,8,9]]\nflat = [num for row in matrix for num in row]\n# [1, 2, 3, 4, 5, 6, 7, 8, 9]\n```\n\n다만 3중 이상은 가독성이 떨어지니 일반 for문을 추천합니다.', messageType: 'text' },
      ],
      [
        { role: 'user', content: '이 코드를 리뷰해 주세요:\ndef calc(a,b): return a+b', messageType: 'text' },
        { role: 'assistant', content: '코드 리뷰 결과입니다:\n\n1. **함수명**: `calc`보다 `add_numbers` 같은 명확한 이름 사용\n2. **타입 힌트**: `def add_numbers(a: int, b: int) -> int:` 추가 권장\n3. **독스트링**: 함수 설명을 추가하면 좋습니다\n\n개선 코드:\n```python\ndef add_numbers(a: int, b: int) -> int:\n    """두 숫자를 더한 결과를 반환합니다."""\n    return a + b\n```', messageType: 'text' },
      ],
    ],
    'shop-bot': [
      [
        { role: 'user', content: '주문번호 ORD-2024-1234 배송 상태를 확인해 주세요.', messageType: 'text' },
        { role: 'assistant', content: '주문번호 ORD-2024-1234 조회 결과입니다:\n\n- 상품: 무선 블루투스 이어폰 Pro\n- 상태: **배송중**\n- 택배사: CJ대한통운\n- 송장번호: 123456789012\n- 예상 도착: 2024년 3월 15일', messageType: 'text' },
        { role: 'user', content: '배송지를 변경할 수 있나요?', messageType: 'text' },
        { role: 'assistant', content: '죄송합니다. 이미 배송이 시작된 주문은 배송지 변경이 어렵습니다. CJ대한통운 고객센터(1588-1255)로 직접 문의하시면 변경 가능할 수 있습니다.', messageType: 'text' },
      ],
      [
        { role: 'user', content: '환불 절차를 알려주세요.', messageType: 'text' },
        { role: 'assistant', content: '환불 절차 안내입니다:\n\n1. **마이페이지** → 주문내역에서 해당 주문 선택\n2. **교환/환불 신청** 버튼 클릭\n3. 사유 선택 후 **신청 완료**\n4. 상품 수거 후 영업일 기준 3-5일 내 환불 처리\n\n단순 변심은 배송비 부담이 있으며, 제품 하자 시 무료 반품됩니다.', messageType: 'text' },
      ],
    ],
  };

  const templates = conversations[app] || conversations['assiworks'];
  const chosen = templates[Math.floor(Math.random() * templates.length)];

  return chosen.slice(0, turnCount * 2).map((msg, i) => ({
    ...msg,
    timestamp: new Date(now.getTime() - (chosen.length - i) * 60000).toISOString(),
  }));
}

function makeLogs(app, turnCount) {
  const now = new Date();
  const logs = [];
  for (let i = 0; i < turnCount; i++) {
    logs.push(
      { category: 'orchestrator', level: 'info', message: `턴 ${i + 1}: 사용자 입력 수신`, timestamp: new Date(now.getTime() - (turnCount - i) * 120000).toISOString() },
      { category: 'orchestrator', level: 'info', message: `턴 ${i + 1}: 스킬 매칭 완료`, timestamp: new Date(now.getTime() - (turnCount - i) * 120000 + 500).toISOString() },
      { category: 'executor', level: 'info', message: `턴 ${i + 1}: 응답 생성 완료`, timestamp: new Date(now.getTime() - (turnCount - i) * 120000 + 2000).toISOString() },
    );
  }
  return logs;
}

// ---------------------------------------------------------------------------
// API call helpers
// ---------------------------------------------------------------------------

async function apiPut(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.error) throw new Error(`PUT ${path}: ${json.error}`);
  return json.data;
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.error) throw new Error(`POST ${path}: ${json.error}`);
  return json.data;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed() {
  console.log(`Seeding test data to ${BASE}...\n`);

  let settingsCount = 0;
  let sessionsCount = 0;

  // 1. App-level default settings (user='default')
  console.log('=== App Default Settings ===');
  for (const app of APPS) {
    const config = APP_DEFAULT_CONFIGS[app.id];
    await apiPut('/api/settings', { app: app.id, user: 'default', config });
    console.log(`  [settings] ${app.id} / default → OK`);
    settingsCount++;
  }

  // 2. User-specific custom settings
  console.log('\n=== User Custom Settings ===');
  for (const app of APPS) {
    const overrides = USER_CUSTOM_CONFIGS[app.id] || {};
    for (const [userId, config] of Object.entries(overrides)) {
      await apiPut('/api/settings', { app: app.id, user: userId, config });
      console.log(`  [settings] ${app.id} / ${userId} → OK`);
      settingsCount++;
    }
  }

  // 3. Sessions with conversations
  console.log('\n=== Sessions ===');
  let sessionNum = 0;
  for (const app of APPS) {
    const users = USERS_PER_APP[app.id];
    for (const userId of users) {
      // Each user gets 1-3 sessions
      const numSessions = 1 + Math.floor(Math.random() * 3);
      for (let si = 0; si < numSessions; si++) {
        sessionNum++;
        const sessionId = `sess-${app.id}-${userId}-${String(sessionNum).padStart(3, '0')}`;
        const turnCount = 1 + Math.floor(Math.random() * 3);
        const messages = makeMessages(app.id, userId, turnCount);
        const logs = makeLogs(app.id, turnCount);

        await apiPost('/api/sessions', {
          session_id: sessionId,
          app: app.id,
          user: userId,
          messages,
          config_snapshot: APP_DEFAULT_CONFIGS[app.id],
          logs,
          turn_count: turnCount,
        });
        console.log(`  [session] ${sessionId} (${turnCount} turns, ${messages.length} msgs) → OK`);
        sessionsCount++;
      }
    }
  }

  console.log(`\n✅ Done! ${settingsCount} settings + ${sessionsCount} sessions inserted.`);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
