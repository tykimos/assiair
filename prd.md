# PRD: AssiAir — Orchestrator-Executor 기반 경량 웹 에이전트

> **v2.0** | Orchestrator-Executor 이중 아키텍처
> ref: `ce-tyriunnie` (컨텍스트 윈도우 구성), `aicosci-paper` (버튼식 액션 메시지)

---

## 0. 문서 개요

이 PRD는 **AssiAir**의 핵심 아키텍처를 정의한다.
AssiAir는 웹에서 가볍게 구동되는 AI 에이전트로, **Orchestrator**(계획 수립)와 **Executor**(스킬 실행)라는 두 개의 독립 LLM 호출 단위를 중심으로 동작한다.

핵심 설계 원칙:
- Orchestrator와 Executor는 **각각 다른 시스템 프롬프트**를 갖는다
- Orchestrator는 **Workflow + Skill 정보를 기반으로 Plan**을 수립한다
- Executor는 **하나의 Skill만 탑재**하여 실행하며, 필요 시 tool calling을 수행한다
- Executor 완료 시 **Post-Orch**가 Plan을 체크하고 다음 Executor를 연쇄 호출한다

---

## 1. 문제 정의

기존 단일 에이전트 루프 방식의 한계:

1. **모든 스킬이 하나의 시스템 프롬프트에 혼재** — 컨텍스트 윈도우 낭비, 스킬 간 간섭
2. **멀티스텝 작업의 계획 부재** — 복잡한 워크플로우를 순차 실행할 메커니즘 없음
3. **트리거 기반 자동 실행 불가** — webhook이나 이벤트에 의한 자동 작업 흐름 미지원
4. **스킬 전환 시 컨텍스트 손실** — 한 스킬에서 다른 스킬로 넘어갈 때 정보 유실

---

## 2. 목표

| # | 목표 | 설명 |
|---|------|------|
| G1 | **이중 LLM 구조** | Orchestrator(계획) + Executor(실행)로 역할 분리 |
| G2 | **Workflow 기반 Planning** | 정의된 워크플로우로부터 실행 계획을 자동 생성 |
| G3 | **단일 스킬 탑재** | Executor는 한 번에 하나의 스킬만 시스템 프롬프트에 로드 |
| G4 | **Plan 기반 연쇄 실행** | Executor 완료 → Post-Orch → 다음 Executor 자동 호출 |
| G5 | **트리거 기반 동작** | Webhook, 사용자 메시지, 이벤트 등 다양한 트리거 지원 |
| G6 | **버튼식 액션** | 메시지 내 인라인 버튼으로 사용자 인터랙션 제공 |

---

## 3. 비목표

- 영구 메모리/장기 저장소 설계 (최소한의 세션 상태만 포함)
- 멀티모달(이미지/음성) 입력 지원 (v1 범위 밖)
- 사용자 인증/결제/멀티테넌시
- 복수 Executor 병렬 실행 (v1은 순차만)

---

## 4. 핵심 개념 및 용어

```
┌─────────────────────────────────────────────────────┐
│                    Trigger                           │
│   (Webhook / 사용자 메시지 / 이벤트)                  │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│              ORCHESTRATOR (LLM Call 1)               │
│                                                     │
│  시스템 프롬프트: Orchestrator Prompt                  │
│  입력: Trigger + Workflow 정의 + Skill Registry       │
│  출력: Plan (ordered skill steps + context)           │
│                                                     │
│  ┌──────────────────────────────────┐               │
│  │ Plan                             │               │
│  │  step[0]: skill_a ✅ (current)    │               │
│  │  step[1]: skill_b ⬜              │               │
│  │  step[2]: skill_c ⬜              │               │
│  │  context: { ... }                │               │
│  └──────────────────────────────────┘               │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│              EXECUTOR (LLM Call 2+)                  │
│                                                     │
│  시스템 프롬프트: Executor Base + 선택된 Skill 1개     │
│  입력: Plan + CONTEXT_PACK + User Message             │
│  수행: Skill 지침 따라 실행 (tool calling 포함)        │
│  출력: 응답 + Signals + Prompt Buttons + Post-Orch     │
│                                                     │
│  ┌──────────────┐  ┌───────────────┐                │
│  │ Tool Calling │  │ Post-Orch     │                │
│  │ (옵션)       │  │ plan 체크     │                │
│  │              │  │ step 완료 마킹│                │
│  │ - vfs_read   │  │ 다음 step 판단│                │
│  │ - js_sandbox │  │               │                │
│  │ - http_req   │  │ action:       │                │
│  │ - python     │  │  continue/stop│                │
│  └──────────────┘  └───────┬───────┘                │
└────────────────────────────┼────────────────────────┘
                             ▼
                    ┌────────────────┐
                    │ action==continue│──▶ 다음 Executor 호출
                    │ action==stop    │──▶ 최종 응답 반환
                    │ action==ask_user│──▶ 사용자 확인 대기
                    └────────────────┘
```

### 용어 정리

| 용어 | 설명 |
|------|------|
| **Trigger** | Orchestrator를 가동시키는 이벤트. 사용자 메시지, webhook, 시스템 이벤트 등 |
| **Orchestrator** | Workflow와 Skill 정보를 읽고, Plan을 수립하는 LLM 호출 |
| **Workflow** | 특정 목적을 달성하기 위한 스킬 조합 패턴 정의 |
| **Skill** | 하나의 구체적 작업 단위. 마크다운으로 정의, 도구 목록 포함 |
| **Plan** | Orchestrator가 생성한 실행 계획. 순서가 있는 skill step 배열 |
| **Executor** | 하나의 Skill을 시스템 프롬프트에 탑재하고 실행하는 LLM 호출 |
| **Post-Orch** | Executor 완료 후 Plan 상태를 검사하고 다음 동작을 결정하는 로직 |
| **CONTEXT_PACK** | Executor에 전달되는 구조화된 컨텍스트 블록 |
| **Signals** | Executor가 응답과 함께 출력하는 상태 메타데이터 |
| **Prompt Buttons** | 메시지 내 버튼식 액션 (사용자 클릭 시 새 메시지로 전송) |

---

## 5. 시스템 아키텍처

### 5.1 전체 구성도

#### 5.1.1 모듈화 원칙 (ref: aicosci-paper)

AssiAir의 웹 UI는 **어디서든 임베드 가능한 자립형(self-contained) 위젯**으로 설계한다.
aicosci-paper의 컴포지셔널 아키텍처를 참고하여, 글로벌 상태 의존 없이 **props + callback** 패턴으로 부모와 통신한다.

```
임베딩 예시:
┌─────────────────────────────┐  ┌─────────────────────────────┐
│  호스트 A (독립 페이지)       │  │  호스트 B (대시보드 위젯)     │
│                             │  │                             │
│  <AssiAirWidget             │  │  <AssiAirWidget             │
│    apiEndpoint="/api"       │  │    apiEndpoint="https://…"  │
│    theme="light"            │  │    theme="dark"             │
│    defaultTab="chat"        │  │    defaultTab="logs"        │
│    onEvent={handleEvent}    │  │    height="400px"           │
│  />                         │  │  />                         │
└─────────────────────────────┘  └─────────────────────────────┘
```

**모듈화 규칙:**

| 규칙 | 설명 |
|------|------|
| **자립형 위젯** | 글로벌 context/store 불필요. 모든 상태는 위젯 내부에서 관리 |
| **Props 기반 설정** | apiEndpoint, theme, defaultTab 등 외부에서 주입 |
| **Callback 통신** | onEvent, onMessage 등 콜백으로 호스트에 이벤트 전달 |
| **CSS 격리** | Tailwind prefix 또는 CSS Module로 호스트 스타일과 충돌 방지 |
| **크기 적응** | width/height를 부모 컨테이너에 맞추거나 props로 지정 |

#### 5.1.2 탭 기반 UI

채팅 외에 **설정(Settings)**과 **로그(Logs)** 기능을 별도 창이 아닌 **탭**으로 제공한다.

```
┌──────────────────────────────────────────────────────────────┐
│  AssiAir Widget                                              │
│  ┌──────────┬──────────┬──────────┐                          │
│  │  💬 Chat │  ⚙ Sett │  📋 Logs │  ← 탭 네비게이션          │
│  └──────────┴──────────┴──────────┘                          │
│                                                              │
│  [Chat 탭 활성 시]                                             │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  Messages                                                ││
│  │  ┌─────────────────────────────┐                         ││
│  │  │ 🤖 안녕하세요! 무엇을 도와   │                         ││
│  │  │    드릴까요?                 │                         ││
│  │  │  [코드 리뷰] [설명해줘]      │  ← Prompt Buttons       ││
│  │  └─────────────────────────────┘                         ││
│  │                                                          ││
│  │  Plan Tracker (펼침/접힘)                                  ││
│  │  ┌─────────────────────────────┐                         ││
│  │  │ step[0] ✅ code-review      │                         ││
│  │  │ step[1] 🔄 code-fix        │                         ││
│  │  └─────────────────────────────┘                         ││
│  │                                                          ││
│  │  ┌──────────────────────────────────┐ ┌────┐             ││
│  │  │ 메시지를 입력하세요...            │ │ ▶  │             ││
│  │  └──────────────────────────────────┘ └────┘             ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  [Settings 탭 활성 시]                                         │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  API 설정                                                ││
│  │  ├─ LLM Provider: [Anthropic ▼]                          ││
│  │  ├─ Model: [claude-sonnet-4-20250514 ▼]                            ││
│  │  ├─ API Key: [••••••••••]                                ││
│  │  │                                                       ││
│  │  Orchestrator 설정                                        ││
│  │  ├─ 경량 모델 사용: [✓]                                   ││
│  │  ├─ Max Plan Steps: [5]                                  ││
│  │  │                                                       ││
│  │  Skill 관리                                               ││
│  │  ├─ 활성 스킬 목록: [code-review ✓] [greeting ✓] ...     ││
│  │  ├─ 커스텀 스킬 추가: [+ 추가]                             ││
│  │  │                                                       ││
│  │  테마                                                     ││
│  │  ├─ 다크 모드: [○ Light ● Dark]                           ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  [Logs 탭 활성 시]                                             │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  필터: [All ▼] [Orch ▼] [Exec ▼] [Tool ▼]  🔍 검색      ││
│  │  ────────────────────────────────────────────────────────││
│  │  14:32:01 [ORCH] Plan 생성: code-review → code-fix       ││
│  │  14:32:01 [EXEC] Skill 탑재: code-review                 ││
│  │  14:32:03 [TOOL] vfs_read("/workspace/main.ts") → 200    ││
│  │  14:32:05 [SIGNAL] coverage:enough confidence:high        ││
│  │  14:32:05 [POST] action:continue → next: code-fix        ││
│  │  14:32:06 [EXEC] Skill 탑재: code-fix                    ││
│  │  14:32:08 [TOOL] vfs_write("/workspace/main.ts") → 200   ││
│  │  14:32:09 [SIGNAL] coverage:enough confidence:high        ││
│  │  14:32:09 [POST] action:stop → 최종 응답 반환              ││
│  │  ────────────────────────────────────────────────────────││
│  │  [로그 지우기]                          [JSON 내보내기]    ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

**탭 설계 원칙:**

| 탭 | 역할 | 주요 기능 |
|----|------|----------|
| **Chat** | 사용자 인터랙션 | 메시지, 스트리밍, Prompt Buttons, Plan Tracker |
| **Settings** | 에이전트 설정 | LLM 설정, Orchestrator 파라미터, Skill 관리, 테마 |
| **Logs** | 실행 관측 | 실시간 로그 스트림, 필터, 검색, JSON 내보내기 |

#### 5.1.3 서버 구성도

```
┌──────────────────────────────────────────────────────────────┐
│  AssiAir Widget (Browser)                                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Tab Controller                                         │ │
│  │  ┌──────────┬──────────┬──────────┐                     │ │
│  │  │ Chat Tab │ Settings │ Logs Tab │                     │ │
│  │  └────┬─────┴────┬─────┴────┬─────┘                     │ │
│  │       │          │          │                            │ │
│  │  ┌────▼────┐ ┌───▼────┐ ┌──▼──────┐                    │ │
│  │  │Chat View│ │Config  │ │Log View │                    │ │
│  │  │+Buttons │ │Panel   │ │+Filter  │                    │ │
│  │  │+Plan    │ │        │ │+Search  │                    │ │
│  │  │+Stream  │ │        │ │+Export  │                    │ │
│  │  └────┬────┘ └───┬────┘ └────┬────┘                    │ │
│  └───────┼──────────┼───────────┼──────────────────────────┘ │
│          │          │           │                             │
│  ┌───────▼──────────▼───────────▼──────────────────────────┐ │
│  │          Agent Controller                               │ │
│  │  - Trigger 수신 / Orchestrator 호출 / Executor 호출       │ │
│  │  - Post-Orch 판단 / 연쇄 실행                             │ │
│  │  - 로그 이벤트 발행 (EventEmitter → Logs 탭)              │ │
│  │  - 설정값 적용 (Settings 탭 → Controller 반영)            │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │ API Call (SSE)                      │
└─────────────────────────┼────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────┐
│              Server (Next.js API Routes)                      │
│                                                              │
│  POST /api/orchestrate   →  Orchestrator LLM 호출             │
│  POST /api/execute       →  Executor LLM 호출 (SSE 스트리밍)   │
│  POST /api/webhook       →  외부 Webhook 수신 → Trigger 변환   │
│  GET  /api/config        →  설정 조회/저장                      │
│                                                              │
│  ├─ Rate Limit (IP 기반)                                      │
│  ├─ Auth (Bearer Token)                                      │
│  ├─ LLM API Key (서버 전용)                                    │
│  └─ Audit Logging                                            │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 데이터 흐름 (1턴)

```
1. Trigger 수신 (사용자 메시지 / webhook / 이벤트)
   │
2. Agent Controller: Workflow + Skill Registry 로드
   │
3. POST /api/orchestrate
   │  입력: trigger_info + workflow_defs + skill_summaries + conversation_state
   │  Orchestrator 시스템 프롬프트로 LLM 호출
   │  출력: Plan JSON
   │
4. Plan에서 첫 번째 pending step의 skill_id 추출
   │
5. Composer: CONTEXT_PACK 조립
   │  - Trigger 정보 (required)
   │  - User Input (required)
   │  - Plan 정보
   │  - Skill의 requires에 따른 context_modules 로드
   │
6. POST /api/execute (SSE 스트리밍)
   │  시스템 프롬프트: Executor Base + Skill Prompt (1개)
   │  입력: CONTEXT_PACK + history + user_message
   │  Executor가 skill 수행 (tool calling 가능)
   │  출력: 스트리밍 응답 + signals + prompt_buttons
   │
7. Post-Orch 판단
   │  - signals 분석
   │  - plan step 완료 마킹
   │  - 다음 action 결정: continue / stop / ask_user
   │
8-a. action == continue → step 4로 (다음 skill)
8-b. action == stop → 최종 응답 반환
8-c. action == ask_user → 사용자 확인 대기 (버튼 포함)
```

---

## 6. Trigger 시스템

### 6.1 Trigger 유형

| 유형 | 소스 | 예시 |
|------|------|------|
| `user_message` | 채팅 입력 | 사용자가 텍스트를 입력 |
| `button_click` | 프롬프트 버튼 | 메시지 내 액션 버튼 클릭 |
| `webhook` | 외부 서비스 | GitHub PR, Slack 메시지, CI 결과 등 |
| `system_event` | 내부 이벤트 | 세션 시작, 타이머, 파일 변경 감지 등 |
| `schedule` | 스케줄러 | cron 기반 주기적 실행 |

### 6.2 Trigger 데이터 구조

```typescript
interface Trigger {
  type: 'user_message' | 'button_click' | 'webhook' | 'system_event' | 'schedule';
  source: string;            // 트리거 소스 식별자
  payload: {
    message?: string;        // 사용자 메시지 또는 버튼 라벨
    event_kind?: string;     // 이벤트 종류
    data?: Record<string, unknown>;  // 추가 데이터
  };
  timestamp: number;
  session_id: string;
}
```

---

## 7. Workflow 정의

Workflow는 **특정 목적을 달성하기 위한 스킬 조합 패턴**을 정의한다. Orchestrator는 이 정보를 읽고 상황에 맞는 Plan을 수립한다.

### 7.1 Workflow 파일 형식

```yaml
# workflows/code-review-and-fix.yaml
name: code-review-and-fix
description: 코드를 리뷰하고 발견된 문제를 자동으로 수정
trigger_patterns:
  - "코드 리뷰해줘"
  - "이 코드 검토해"
  - webhook:github:pull_request

steps:
  - skill_id: code-review
    description: 코드의 버그, 보안, 스타일 문제를 검토
    required: true
    outputs: [review_result, issues_found]

  - skill_id: code-fix
    description: 발견된 문제를 수정
    condition: "issues_found > 0"
    required: false
    inputs: [review_result]
    outputs: [fix_result]

  - skill_id: test-writer
    description: 수정된 코드에 대한 테스트 작성
    condition: "fix_result != null"
    required: false
    inputs: [fix_result]

completion_message: "코드 리뷰 및 수정이 완료되었습니다."
```

### 7.2 Workflow Registry

```typescript
interface WorkflowStep {
  skill_id: string;
  description: string;
  required: boolean;
  condition?: string;        // step 실행 조건 (이전 step 결과 기반)
  inputs?: string[];         // 이전 step에서 받을 데이터 키
  outputs?: string[];        // 다음 step에 넘길 데이터 키
}

interface WorkflowDefinition {
  name: string;
  description: string;
  trigger_patterns: string[];
  steps: WorkflowStep[];
  completion_message?: string;
  max_chain_depth?: number;  // 기본값: 5
}
```

---

## 8. Skill 정의

### 8.1 Skill 파일 형식

Skill은 마크다운 파일로 정의한다. YAML 프론트매터에 메타데이터, 본문에 실행 지침을 기술한다.

```markdown
---
name: code-review
description: 코드의 버그, 보안 취약점, 스타일 문제를 검토하고 개선점을 제안
tools:
  - vfs_read
  - vfs_list
signals:
  - issues_found: number
  - severity: enum(critical, warning, info)
  - review_complete: boolean
---

## Instructions

당신은 코드 리뷰 전문가입니다. 제공된 코드를 다음 관점에서 검토하세요:

1. **버그 및 논리 오류**: 잠재적 런타임 에러, 엣지케이스 미처리
2. **보안 취약점**: 인젝션, XSS, 인증 우회 등
3. **코드 스타일**: 네이밍 컨벤션, 가독성, 일관성
4. **성능**: 불필요한 연산, N+1 쿼리, 메모리 누수

### Output Format
- 각 이슈를 심각도(critical/warning/info)와 함께 나열
- 수정 방안을 코드 예시와 함께 제시
- 전체 요약을 마지막에 포함

<signals>
{
  "issues_found": <발견된 이슈 수>,
  "severity": "<가장 높은 심각도>",
  "review_complete": true,
  "next_action_hint": "stop"
}
</signals>

<prompt_buttons>
["수정해줘", "더 자세히 설명해줘", "다른 파일도 검토해줘"]
</prompt_buttons>
```

### 8.2 Skill Registry

```typescript
interface SkillMeta {
  skill_id: string;
  description: string;
  tools: string[];           // 이 스킬이 사용 가능한 도구 목록
  requires: string[];        // 필요한 context_modules
  budget: {
    context_tokens: number;
    history_turns: number;
  };
  signals_schema: Record<string, {
    type: string;
    values?: string[];
    required: boolean;
  }>;
}

// skills/registry.json
interface SkillRegistry {
  version: string;
  skills: SkillMeta[];
  context_modules: ContextModule[];
}
```

### 8.3 Skill 내 Tool Calling

Executor에 탑재된 Skill이 tool calling을 필요로 하면, 해당 Skill의 `tools` 필드에 명시된 도구만 Executor에 등록된다.

```
Skill: code-review
  tools: [vfs_read, vfs_list]

→ Executor 호출 시:
  시스템 프롬프트: Executor Base + code-review Skill Prompt
  사용 가능 도구: vfs_read, vfs_list (만)

  LLM → tool_call(vfs_read, {path: "/workspace/main.ts"})
      ← tool_result({ok: true, data: "..."})
      → 최종 응답 생성
```

---

## 9. Orchestrator 상세

### 9.1 Orchestrator 시스템 프롬프트 구성

```
[Orchestrator System Prompt]

당신은 AssiAir의 Orchestrator입니다.
사용자의 요청(Trigger)을 분석하고, 제공된 Workflow와 Skill 정보를 기반으로
실행 계획(Plan)을 수립합니다.

## 역할
- Trigger를 분석하여 적절한 Workflow를 선택 (또는 단일 Skill 직접 선택)
- Workflow의 steps를 참고하여 Plan을 생성
- 각 step에 필요한 context 정보를 명시

## 입력
- [Trigger]: 이번 동작을 유발한 트리거 정보
- [Workflows]: 사용 가능한 워크플로우 목록과 정의
- [Skills]: 사용 가능한 스킬 목록 (id, description만)
- [Conversation State]: 최근 대화 요약

## 출력 형식
반드시 아래 JSON 형식으로만 출력하세요:
{
  "workflow_id": "string | null",
  "plan": {
    "goal": "string",
    "steps": [
      {
        "step_index": 0,
        "skill_id": "string",
        "description": "string",
        "inputs": {},
        "condition": "string | null",
        "status": "pending"
      }
    ],
    "context": {}
  },
  "reason": "string"
}

## 규칙
1. Workflow가 매칭되면 그 steps를 기반으로 Plan을 구성
2. 매칭되는 Workflow가 없으면 가장 적합한 단일 Skill로 Plan 생성
3. 사용자 의도가 불명확하면 intent_clarify Skill을 첫 step으로
4. Plan의 steps는 최대 5개를 초과하지 않음
5. 각 step의 condition은 이전 step의 outputs를 참조 가능
```

### 9.2 Orchestrator 출력 (Plan)

```typescript
interface PlanStep {
  step_index: number;
  skill_id: string;
  description: string;
  inputs: Record<string, unknown>;   // 이전 step에서 전달받을 데이터
  condition: string | null;          // 실행 조건 (null이면 항상 실행)
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

interface Plan {
  goal: string;                      // 전체 목표 요약
  steps: PlanStep[];
  context: Record<string, unknown>;  // 공유 컨텍스트 (step 간 데이터 전달)
}

interface OrchestratorOutput {
  workflow_id: string | null;
  plan: Plan;
  reason: string;
}
```

---

## 10. Executor 상세

### 10.1 Executor 시스템 프롬프트 구성

Executor의 시스템 프롬프트는 **3개 블록**으로 구성된다:

```
┌─────────────────────────────┐
│ [1] Executor Base Prompt    │  ← 공통. 모든 Executor 호출에 동일
│     - 역할 정의              │
│     - 출력 규칙              │
│     - signals 출력 형식      │
│     - prompt_buttons 규칙    │
│     - post-orch 출력 규칙    │
├─────────────────────────────┤
│ [2] Skill Prompt (1개)      │  ← 선택된 스킬의 instruction
│     - 스킬별 지침            │
│     - 출력 포맷              │
│     - 도구 사용 안내          │
├─────────────────────────────┤
│ [3] CONTEXT_PACK            │  ← Composer가 조립
│     - Trigger 정보           │
│     - User Input             │
│     - Plan 정보              │
│     - Context Modules        │
│     - Constraints            │
└─────────────────────────────┘
```

### 10.2 Executor Base Prompt

```
[Executor Base Prompt]

당신은 AssiAir의 Executor입니다.
주어진 스킬 지침에 따라 작업을 수행하고, 사용자에게 최종 응답을 생성합니다.

## 규칙
1. CONTEXT_PACK 안의 정보만 근거로 사용
2. 스킬 지침의 Output Format을 준수
3. 필요 시 제공된 도구를 사용하여 정보를 수집/처리
4. 응답 마지막에 반드시 signals와 post-orch를 출력

## 응답 구조

[사용자에게 보이는 응답 내용]

<signals>
{
  "coverage": "enough|partial|none",
  "confidence": "high|medium|low",
  ... (스킬별 추가 signals)
  "next_action_hint": "stop|reroute",
  "suggested_skill_id": "string|null"
}
</signals>

<prompt_buttons>
["버튼1", "버튼2", "버튼3"]
</prompt_buttons>

<post_orch>
{
  "current_step_completed": true|false,
  "step_result": { ... },
  "action": "continue|stop|ask_user",
  "reason": "string"
}
</post_orch>
```

### 10.3 Executor 입력 구조

```typescript
interface ExecutorInput {
  // 시스템 프롬프트 (서버에서 조립)
  system_prompt: string;  // Base + Skill Prompt

  // 메시지 배열
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;

  // 사용 가능한 도구 (Skill의 tools 필드 기반)
  tools: ToolDefinition[];

  // 스트리밍 옵션
  stream: boolean;
}
```

### 10.4 Executor 출력 파싱

Executor의 LLM 응답에서 3가지 태그를 파싱한다:

```typescript
// 1. Signals: 실행 상태 메타데이터
interface ExecutionSignals {
  coverage: 'enough' | 'partial' | 'none';
  confidence: 'high' | 'medium' | 'low';
  next_action_hint: 'stop' | 'reroute';
  suggested_skill_id?: string;
  [key: string]: unknown;  // 스킬별 추가 signals
}

// 2. Prompt Buttons: 사용자 액션 버튼
// string[] — 예: ["수정해줘", "다음으로", "취소"]

// 3. Post-Orch: 다음 동작 결정
interface PostOrchOutput {
  current_step_completed: boolean;
  step_result: Record<string, unknown>;  // 다음 step에 전달할 데이터
  action: 'continue' | 'stop' | 'ask_user';
  reason: string;
}
```

---

## 11. CONTEXT_PACK (Composer가 생성)

### 11.1 표준 골격

```
[CONTEXT_PACK v2]

[Trigger] (required)
- type: user_message
- source: chat_input
- message: "이 코드 리뷰해줘"
- timestamp: 1708900000

[Plan] (required)
- goal: "코드를 리뷰하고 발견된 문제를 수정"
- current_step: { index: 0, skill_id: "code-review" }
- total_steps: 3
- previous_results: {}

[User Input] (required)
- user_text: "이 코드 리뷰해줘"
- attached_files: ["main.ts"]

[Conversation State]
- short_summary: "사용자가 main.ts 파일을 작성함"
- open_questions: []
- turn_count: 3

[Context Modules]
- UserState: { session_id: "...", visit_count: 1 }
- FileContext: { path: "/workspace/main.ts", language: "typescript" }

[Constraints]
- budget: { context_tokens: 1500 }
- max_tool_calls: 5
- policies: ["CONTEXT_PACK 밖 추측 금지"]

[/CONTEXT_PACK]
```

### 11.2 Composer 규칙

| 규칙 | 설명 |
|------|------|
| **필수 슬롯** | Trigger, Plan, User Input은 반드시 포함. 누락 시 에러 |
| **모듈 선택** | Skill의 `requires` 필드에 명시된 context_modules만 로드 |
| **토큰 예산** | context_module별 `max_tokens` 적용, 전체 budget 초과 시 요약/트림 |
| **이전 결과** | Plan의 previous_results에 앞선 step의 step_result를 누적 |
| **폴백** | skill_id가 registry에 없으면 greeting으로 폴백하고 reason 기록 |

---

## 12. Post-Orch 로직

### 12.1 판단 흐름

```typescript
function postOrchestrate(
  postOrchOutput: PostOrchOutput,
  signals: ExecutionSignals,
  plan: Plan,
  chainDepth: number
): PostOrchDecision {

  // 1. 무한 루프 방지
  const MAX_CHAIN_DEPTH = 5;
  if (chainDepth >= MAX_CHAIN_DEPTH) {
    return { action: 'stop', reason: 'max_chain_depth 도달' };
  }

  // 2. Executor가 ask_user를 요청한 경우
  if (postOrchOutput.action === 'ask_user') {
    return {
      action: 'ask_user',
      reason: postOrchOutput.reason,
      // prompt_buttons와 함께 사용자에게 응답 전달
    };
  }

  // 3. 현재 step 완료 처리
  if (postOrchOutput.current_step_completed) {
    plan.steps[currentIndex].status = 'completed';
    plan.context = { ...plan.context, ...postOrchOutput.step_result };
  }

  // 4. 다음 pending step 찾기
  const nextStep = plan.steps.find(s => s.status === 'pending');

  if (!nextStep) {
    return { action: 'stop', reason: '모든 step 완료' };
  }

  // 5. 조건 체크
  if (nextStep.condition && !evaluateCondition(nextStep.condition, plan.context)) {
    nextStep.status = 'skipped';
    // 그 다음 step 재탐색 (재귀)
    return postOrchestrate(postOrchOutput, signals, plan, chainDepth);
  }

  // 6. Signals 기반 재라우팅
  if (signals.next_action_hint === 'reroute' && signals.suggested_skill_id) {
    return {
      action: 'continue',
      next_skill_id: signals.suggested_skill_id,
      reason: `시그널 기반 재라우팅: ${signals.suggested_skill_id}`,
    };
  }

  // 7. 다음 step 실행
  return {
    action: 'continue',
    next_skill_id: nextStep.skill_id,
    reason: `Plan step ${nextStep.step_index} 실행`,
  };
}
```

### 12.2 사용자 확인 (ask_user) 흐름

Executor가 `action: 'ask_user'`를 반환하면:

1. 현재까지의 응답을 사용자에게 전달 (prompt_buttons 포함)
2. 사용자가 버튼을 클릭하거나 메시지를 입력
3. 새로운 Trigger(`button_click` 또는 `user_message`)로 처리
4. **Orchestrator를 다시 호출하지 않고**, 기존 Plan을 이어서 실행
5. 사용자 응답을 Plan.context에 추가하고 다음 step 진행

---

## 13. 버튼식 액션 (Prompt Buttons)

### 13.1 데이터 형식

LLM 응답에 `<prompt_buttons>` 태그로 포함:

```xml
<prompt_buttons>
["코드 수정해줘", "더 자세히 설명해줘", "다른 파일도 검토해줘"]
</prompt_buttons>
```

### 13.2 프론트엔드 메시지 모델

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;             // 태그가 제거된 순수 텍스트/마크다운
  promptButtons?: string[];    // 액션 버튼 배열
  signals?: ExecutionSignals;  // (디버그/어드민용)
  timestamp: Date;
  isStreaming?: boolean;
  skillId?: string;            // 이 메시지를 생성한 skill
}
```

### 13.3 스트리밍 프로토콜 (SSE)

```
data: {"type":"content","data":"코드를 검토한 결과..."}

data: {"type":"content","data":"3개의 이슈를 발견했습니다."}

data: {"type":"signals","data":{"coverage":"enough","confidence":"high",...}}

data: {"type":"buttons","data":["수정해줘","더 자세히","다른 파일 검토"]}

data: {"type":"post_orch","data":{"current_step_completed":true,"action":"continue",...}}

data: {"type":"done","data":{"content":"...","signals":{...},"promptButtons":[...],"postOrch":{...}}}
```

### 13.4 버튼 렌더링 규칙

- 버튼은 **마지막 assistant 메시지**에만 표시
- 스트리밍 중에는 버튼 숨김 (완료 후 표시)
- 버튼 클릭 → 버튼 라벨이 user 메시지로 전송 → 새 Trigger 생성
- 이전 메시지의 버튼은 비활성화 (회색 처리)

### 13.5 버튼 UI 스타일

```
┌─────────────────────────────────────────┐
│  🤖 코드를 검토한 결과, 3개의 이슈를     │
│  발견했습니다.                           │
│                                         │
│  1. ⚠️ SQL 인젝션 취약점 (critical)      │
│  2. ℹ️ 미사용 변수 (info)                │
│  3. ⚠️ 에러 핸들링 누락 (warning)        │
│                                         │
│  ┌──────────┐ ┌──────────────┐ ┌──────┐ │
│  │ 수정해줘  │ │ 더 자세히    │ │ 다음  │ │
│  └──────────┘ └──────────────┘ └──────┘ │
└─────────────────────────────────────────┘
```

---

## 14. API 엔드포인트

### 14.1 POST /api/orchestrate

Orchestrator LLM 호출.

**Request:**
```typescript
{
  trigger: Trigger;
  session_id: string;
  conversation_state?: {
    summary: string;
    turn_count: number;
  };
  existing_plan?: Plan;  // ask_user 복귀 시 기존 Plan 전달
}
```

**Response:**
```typescript
{
  success: boolean;
  data?: OrchestratorOutput;  // { workflow_id, plan, reason }
  error?: { code: string; message: string };
}
```

### 14.2 POST /api/execute

Executor LLM 호출 (SSE 스트리밍).

**Request:**
```typescript
{
  skill_id: string;
  context_pack: string;      // Composer가 조립한 CONTEXT_PACK
  plan: Plan;                // 현재 Plan 전체
  history?: ConversationMessage[];
  user_message?: string;
  stream: boolean;
}
```

**Response (SSE):**
```
data: {"type":"content","data":"..."}
data: {"type":"signals","data":{...}}
data: {"type":"buttons","data":[...]}
data: {"type":"post_orch","data":{...}}
data: {"type":"done","data":{...}}
```

### 14.3 POST /api/webhook

외부 Webhook 수신 → Trigger 변환.

**Request:** 외부 서비스의 webhook payload (자유 형식)

**Response:**
```typescript
{
  success: boolean;
  trigger_id: string;    // 생성된 Trigger ID
}
```

---

## 15. 프로젝트 구조

```
assiair/
├── package.json
├── next.config.ts
├── tsconfig.json
├── prd.md                              # 이 문서
│
├── app/                                 # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                         # 메인 채팅 페이지
│   ├── globals.css
│   └── api/
│       ├── orchestrate/
│       │   └── route.ts                 # Orchestrator API
│       ├── execute/
│       │   └── route.ts                 # Executor API (SSE)
│       └── webhook/
│           └── route.ts                 # Webhook 수신
│
├── src/
│   ├── orchestrator/
│   │   ├── orchestrator.ts              # Orchestrator LLM 호출
│   │   ├── orchestrator-prompt.ts       # Orchestrator 시스템 프롬프트
│   │   ├── plan.ts                      # Plan 타입 및 유틸리티
│   │   └── workflow-loader.ts           # Workflow 정의 로더
│   │
│   ├── executor/
│   │   ├── executor.ts                  # Executor LLM 호출 (스트리밍)
│   │   ├── executor-prompt.ts           # Executor Base 시스템 프롬프트
│   │   ├── composer.ts                  # CONTEXT_PACK 조립
│   │   └── parser.ts                    # 응답 파싱 (signals, buttons, post-orch)
│   │
│   ├── post-orch/
│   │   └── post-orch.ts                 # Post-Orch 판단 로직
│   │
│   ├── agent/
│   │   ├── controller.ts               # Agent Controller (전체 흐름 제어)
│   │   └── logger.ts                   # 로그 이벤트 발행 (EventEmitter)
│   │
│   ├── skills/
│   │   ├── registry.ts                  # Skill Registry 관리
│   │   ├── loader.ts                    # Skill 파일 로더 (YAML+MD 파싱)
│   │   └── builtin/                     # 내장 스킬 .md 파일
│   │       ├── code-review.md
│   │       ├── code-fix.md
│   │       ├── test-writer.md
│   │       ├── explain-code.md
│   │       ├── refactor.md
│   │       └── greeting.md
│   │
│   ├── workflows/
│   │   ├── loader.ts                    # Workflow 파일 로더
│   │   └── builtin/                     # 내장 워크플로우
│   │       ├── code-review-and-fix.yaml
│   │       ├── explain-and-improve.yaml
│   │       └── greeting.yaml
│   │
│   ├── trigger/
│   │   ├── trigger.ts                   # Trigger 타입 및 생성
│   │   └── webhook-adapter.ts           # Webhook → Trigger 변환
│   │
│   ├── tools/
│   │   ├── index.ts                     # 도구 팩토리
│   │   ├── vfs.ts                       # VFS (IndexedDB)
│   │   ├── js-sandbox.ts               # JS 실행 (Web Worker)
│   │   ├── python-sandbox.ts            # Python 실행 (Pyodide)
│   │   └── http-request.ts             # HTTP 요청 (allowlist)
│   │
│   ├── widget/                          # 모듈형 위젯 (임베드 가능)
│   │   ├── assiair-widget.tsx           # 최상위 위젯 컨테이너 (진입점)
│   │   ├── widget-provider.tsx          # 위젯 내부 상태 Provider (Context)
│   │   └── widget-types.ts             # 위젯 Props/Config 타입 정의
│   │
│   ├── ui/
│   │   ├── tabs/
│   │   │   ├── tab-navigation.tsx       # 탭 네비게이션 바 (Chat/Settings/Logs)
│   │   │   ├── tab-container.tsx        # 탭 콘텐츠 컨테이너 (상태 유지)
│   │   │   ├── chat-tab.tsx             # Chat 탭 (기존 chat-view 래퍼)
│   │   │   ├── settings-tab.tsx         # Settings 탭
│   │   │   └── logs-tab.tsx             # Logs 탭
│   │   ├── chat/
│   │   │   ├── chat-view.tsx            # 메인 채팅 UI
│   │   │   ├── chat-message.tsx         # 메시지 렌더링 (마크다운 + 버튼)
│   │   │   ├── prompt-buttons.tsx       # 프롬프트 버튼 컴포넌트
│   │   │   ├── plan-tracker.tsx         # Plan 진행 상태 표시
│   │   │   └── tool-trace.tsx           # 도구 실행 트레이스
│   │   ├── settings/
│   │   │   ├── llm-config.tsx           # LLM 프로바이더/모델/API Key 설정
│   │   │   ├── orch-config.tsx          # Orchestrator 파라미터 설정
│   │   │   ├── skill-manager.tsx        # Skill 활성화/비활성화/추가
│   │   │   └── theme-config.tsx         # 테마 (Light/Dark) 설정
│   │   └── logs/
│   │       ├── log-viewer.tsx           # 실시간 로그 스트림 뷰어
│   │       ├── log-filter.tsx           # 카테고리 필터 (Orch/Exec/Tool/Signal)
│   │       └── log-export.tsx           # JSON 내보내기/지우기
│   │
│   ├── proxy/
│   │   ├── rate-limit.ts
│   │   ├── validate.ts
│   │   └── audit-log.ts
│   │
│   ├── storage/
│   │   ├── session-store.ts             # 세션 상태 관리 (IndexedDB)
│   │   └── config-store.ts             # 설정 영속화 (localStorage)
│   │
│   └── types/
│       ├── index.ts                     # 전역 타입
│       ├── trigger.ts                   # Trigger 관련 타입
│       ├── plan.ts                      # Plan 관련 타입
│       ├── skill.ts                     # Skill 관련 타입
│       ├── workflow.ts                  # Workflow 관련 타입
│       ├── message.ts                   # 메시지/스트리밍 타입
│       ├── widget.ts                    # 위젯 Props/설정 타입
│       └── log.ts                       # 로그 엔트리 타입
│
├── skills/                              # 커스텀 스킬 (프로젝트 로컬)
│   └── my-custom-skill.md
│
├── workflows/                           # 커스텀 워크플로우 (프로젝트 로컬)
│   └── my-custom-workflow.yaml
│
├── public/
│   ├── favicon.svg
│   └── workers/
│       ├── js-worker.js
│       └── pyodide-worker.js
│
├── config/
│   ├── limits.ts                        # 리소스 제한 상수
│   └── http-allowlist.ts               # HTTP 도구 허용 도메인
│
└── ref/                                 # 참고 프로젝트 (빌드 제외)
    ├── ce-tyriunnie/
    └── aicosci-paper/
```

---

## 16. 기능 요구사항

### FR1: Orchestrator

| ID | 기능 | 설명 |
|----|------|------|
| FR1.1 | Trigger 수신 | 사용자 메시지, 버튼 클릭, webhook, 시스템 이벤트를 Trigger로 통합 수신 |
| FR1.2 | Workflow 매칭 | Trigger와 매칭되는 Workflow를 자동 선택 |
| FR1.3 | Plan 생성 | Workflow steps와 Skill 정보를 기반으로 실행 계획(Plan) 생성 |
| FR1.4 | 단일 Skill 직접 선택 | 매칭 Workflow가 없을 때 적합한 단일 Skill로 1-step Plan 생성 |
| FR1.5 | Plan 복귀 | ask_user 후 사용자 응답 시 기존 Plan을 이어서 처리 |

### FR2: Executor

| ID | 기능 | 설명 |
|----|------|------|
| FR2.1 | 단일 Skill 탑재 | 시스템 프롬프트에 선택된 Skill 1개만 로드 |
| FR2.2 | Tool Calling | Skill의 tools 필드에 명시된 도구만 등록, LLM이 호출 |
| FR2.3 | SSE 스트리밍 | 응답을 실시간 스트리밍으로 전달 |
| FR2.4 | Signals 출력 | 실행 상태를 signals 태그로 출력 |
| FR2.5 | Prompt Buttons 출력 | 사용자 액션 버튼을 prompt_buttons 태그로 출력 |
| FR2.6 | Post-Orch 출력 | Plan 기반 다음 동작 판단을 post_orch 태그로 출력 |

### FR3: Post-Orch

| ID | 기능 | 설명 |
|----|------|------|
| FR3.1 | Step 완료 처리 | 현재 step을 completed로 마킹, step_result를 Plan.context에 누적 |
| FR3.2 | 조건 평가 | 다음 step의 condition을 Plan.context 기반으로 평가 |
| FR3.3 | 연쇄 호출 | action이 continue이면 다음 Executor를 즉시 호출 |
| FR3.4 | 사용자 확인 대기 | action이 ask_user이면 응답 전달 후 대기 |
| FR3.5 | 체인 깊이 제한 | MAX_CHAIN_DEPTH(기본 5) 초과 시 강제 종료 |

### FR4: UI (모듈형 위젯 + 탭 구조)

| ID | 기능 | 설명 |
|----|------|------|
| FR4.1 | **위젯 컨테이너** | `<AssiAirWidget>` — 자립형 임베드 가능 컴포넌트. props로 apiEndpoint, theme, defaultTab, onEvent 등 주입 |
| FR4.2 | **탭 네비게이션** | Chat / Settings / Logs 3개 탭. 탭 전환 시 상태 유지 (unmount 하지 않음) |
| FR4.3 | 채팅 메시지 | 마크다운 렌더링 + 코드 하이라이팅 |
| FR4.4 | 프롬프트 버튼 | 마지막 assistant 메시지에 가로 스크롤 버튼 렌더링 |
| FR4.5 | Plan 트래커 | 현재 Plan의 진행 상태를 시각적으로 표시 (Chat 탭 내 펼침/접힘) |
| FR4.6 | 도구 트레이스 | Executor의 tool calling 과정을 펼침/접힘으로 표시 |
| FR4.7 | 스트리밍 표시 | SSE 청크를 실시간으로 렌더링 |
| FR4.8 | **Settings 탭** | LLM 프로바이더/모델 선택, API Key 입력, Orchestrator 파라미터, Skill 활성화/비활성화, 테마 설정 |
| FR4.9 | **Logs 탭** | 실시간 로그 스트림 (Orch/Exec/Tool/Signal/PostOrch 카테고리), 필터/검색, JSON 내보내기, 로그 지우기 |
| FR4.10 | **CSS 격리** | 호스트 사이트 스타일과 충돌 방지 (Tailwind prefix 또는 CSS Module) |

---

## 17. 비기능 요구사항

| 항목 | 요구사항 |
|------|---------|
| **성능** | Orchestrator는 경량 모델(Flash/Haiku)로 호출. Executor만 고품질 모델 사용 |
| **지연** | Orchestrator 응답 2초 이내. Executor는 스트리밍이므로 TTFT 1초 이내 |
| **안전** | Plan step 최대 5개, chain depth 최대 5, tool calls per step 최대 5 |
| **보안** | API 키 서버 전용, Rate Limit, Body size 제한, CORS |
| **관측성** | 매 턴 trace: trigger_type, workflow_id, skill_id, tool_count, signals, latency |
| **확장성** | 스킬/워크플로우 추가는 .md/.yaml 파일 추가만으로 가능 |

---

## 18. 리소스 제한

```typescript
// config/limits.ts
export const LIMITS = {
  // Orchestrator
  ORCH_MAX_TOKENS: 1024,           // Orchestrator 출력 토큰 제한
  ORCH_TIMEOUT_MS: 10_000,

  // Executor
  EXEC_MAX_TOKENS: 4096,           // Executor 출력 토큰 제한
  EXEC_TIMEOUT_MS: 30_000,

  // Plan
  MAX_PLAN_STEPS: 5,               // Plan의 최대 step 수
  MAX_CHAIN_DEPTH: 5,              // 연쇄 Executor 호출 최대 횟수
  MAX_TOOL_CALLS_PER_STEP: 5,     // step 당 최대 tool 호출

  // Tools
  JS_TIMEOUT_MS: 3_000,
  PY_TIMEOUT_MS: 5_000,
  VFS_MAX_FILE_BYTES: 1 * 1024 * 1024,
  HTTP_MAX_RESPONSE_BYTES: 100 * 1024,

  // Proxy
  PROXY_RATE_LIMIT: 20,            // req/min per IP
  PROXY_MAX_BODY_BYTES: 1 * 1024 * 1024,

  // Skills
  MAX_SKILL_INSTRUCTION_CHARS: 10_000,

  // Context
  CONTEXT_PACK_MAX_TOKENS: 3000,
  HISTORY_MAX_TURNS: 8,
} as const;
```

---

## 19. 구현 단계

### Phase 1: 핵심 파이프라인 (1주)

| # | 태스크 | 관련 |
|---|--------|------|
| 1 | 타입 시스템 정의 (Trigger, Plan, Skill, Workflow, Message) | types/ |
| 2 | Orchestrator 시스템 프롬프트 작성 + `/api/orchestrate` API | FR1 |
| 3 | Executor Base 프롬프트 작성 + `/api/execute` API (SSE) | FR2 |
| 4 | 응답 파서 구현 (signals, buttons, post_orch 태그 추출) | executor/parser.ts |
| 5 | Composer (CONTEXT_PACK 조립) | executor/composer.ts |
| 6 | Post-Orch 로직 구현 | post-orch/post-orch.ts |
| 7 | Agent Controller (전체 흐름 제어: trigger → orch → exec → post) | agent/controller.ts |

**완료 기준**: 사용자 메시지 → Orchestrator Plan → Executor 실행 → Post-Orch → 연쇄 실행 흐름 동작

### Phase 2: Skill & Workflow 시스템 (1주)

| # | 태스크 | 관련 |
|---|--------|------|
| 1 | Skill 로더 (YAML 프론트매터 + MD 파싱) | skills/loader.ts |
| 2 | Skill Registry (builtin + custom) | skills/registry.ts |
| 3 | Workflow 로더 (YAML 파싱) | workflows/loader.ts |
| 4 | 내장 스킬 작성 (greeting, code-review, explain-code, refactor, test-writer) | skills/builtin/ |
| 5 | 내장 워크플로우 작성 (greeting, code-review-and-fix, explain-and-improve) | workflows/builtin/ |
| 6 | Skill의 tools 필드 기반 Executor 도구 동적 등록 | executor/executor.ts |

**완료 기준**: 스킬/워크플로우 파일 추가 시 Orchestrator가 인식하고 Plan에 반영

### Phase 3: Tool System + 모듈형 UI (1주)

| # | 태스크 | 관련 |
|---|--------|------|
| 1 | VFS 도구 (IndexedDB) | tools/vfs.ts |
| 2 | JS Sandbox (Web Worker) | tools/js-sandbox.ts |
| 3 | Python Sandbox (Pyodide) | tools/python-sandbox.ts |
| 4 | HTTP 도구 (allowlist) | tools/http-request.ts |
| 5 | **AssiAirWidget 컨테이너** + WidgetProvider 구현 | widget/ |
| 6 | **탭 네비게이션** (Chat/Settings/Logs) + 탭 컨테이너 | ui/tabs/ |
| 7 | Chat 탭: 메시지 + 스트리밍 + Prompt Buttons + Plan Tracker | ui/chat/ |
| 8 | **Settings 탭**: LLM 설정, Orch 파라미터, Skill 관리, 테마 | ui/settings/ |
| 9 | **Logs 탭**: 실시간 로그 스트림 + 필터/검색 + JSON 내보내기 | ui/logs/ |
| 10 | Agent Logger (EventEmitter → Logs 탭 연동) | agent/logger.ts |
| 11 | Config Store (설정 영속화) | storage/config-store.ts |

**완료 기준**: `<AssiAirWidget>` 를 임의 호스트 페이지에 마운트하면 3개 탭(Chat/Settings/Logs)이 모두 동작, 브라우저에서 전체 파이프라인이 UI와 함께 동작, 버튼 클릭 → 후속 실행

### Phase 4: 고급 기능 + 배포 (1주)

| # | 태스크 | 관련 |
|---|--------|------|
| 1 | Webhook 수신 API + Trigger 변환 | api/webhook, trigger/ |
| 2 | 세션 관리 (대화 저장/불러오기) | storage/session-store.ts |
| 3 | Rate Limit + Auth + Audit Logging | proxy/ |
| 4 | ask_user 복귀 흐름 구현 | agent/controller.ts |
| 5 | 에러 핸들링 (LLM 실패, 도구 실패, JSON 파싱 실패) | 전체 |
| 6 | Vercel 배포 | — |

**완료 기준**: 프로덕션 배포 완료, webhook 트리거 동작, 안정적 에러 처리

---

## 20. 전체 시퀀스 다이어그램

### 20.1 기본 흐름 (사용자 메시지 → 멀티스텝 실행)

```
User          Frontend        Controller      Orchestrator    Executor(1)    Executor(2)
 │               │               │               │               │               │
 │─ "리뷰해줘" ─▶│               │               │               │               │
 │               │─ trigger ────▶│               │               │               │
 │               │               │─ POST orch ──▶│               │               │
 │               │               │               │─ Plan ───────▶│               │
 │               │               │◀─ Plan JSON ──│               │               │
 │               │               │               │               │               │
 │               │               │─ compose ─────────────────────▶│               │
 │               │               │  (skill: code-review)          │               │
 │               │◀─ SSE stream ─┼───────────────────────────────▶│               │
 │◀─ 스트리밍 ───│               │               │               │               │
 │  (코드 리뷰   │               │               │               │               │
 │   결과 + 버튼)│               │               │               │               │
 │               │               │◀─ post_orch ──┼──────(done)───│               │
 │               │               │  action:continue               │               │
 │               │               │                                │               │
 │               │               │─ compose ──────────────────────────────────────▶│
 │               │               │  (skill: code-fix)                              │
 │               │◀─ SSE stream ─┼─────────────────────────────────────────────────│
 │◀─ 스트리밍 ───│               │               │               │               │
 │  (수정 결과)  │               │               │               │               │
 │               │               │◀─ post_orch ──┼──────────────────────(done)────│
 │               │               │  action:stop                                    │
 │◀─ 최종 응답 ──│               │               │               │               │
```

### 20.2 사용자 확인 흐름 (ask_user)

```
User          Frontend        Controller      Executor
 │               │               │               │
 │               │               │─ execute ─────▶│
 │               │◀─ SSE stream ─┼───────────────▶│
 │◀─ 스트리밍 ───│               │               │
 │  "저장할까요?" │               │               │
 │  [예] [아니오] │               │               │
 │               │               │◀─ post_orch ──│
 │               │               │  action:ask_user
 │               │               │               │
 │─ [예] 클릭 ──▶│               │               │
 │               │─ trigger ────▶│               │
 │               │  (button_click)│               │
 │               │               │─ Plan 복귀 ───▶│ (기존 Plan 이어서)
 │               │               │  (다음 step)   │
 │               │◀─ SSE stream ─┼───────────────▶│
 │◀─ 스트리밍 ───│               │               │
 │  "저장 완료!" │               │               │
```

---

## 21. 리스크 및 대응

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| 2회+ LLM 호출 비용 | 높음 | Orchestrator는 경량 모델 사용, Plan 캐싱 검토 |
| Orchestrator JSON 파싱 실패 | 높음 | 1회 재시도 + 룰 기반 폴백 (greeting skill 단일 Plan) |
| 무한 체인 루프 | 높음 | MAX_CHAIN_DEPTH=5 강제, step 중복 감지 |
| Post-Orch 태그 누락 | 중간 | 태그 없으면 `{action:"stop"}` 기본값 |
| Skill tool calling 실패 | 중간 | 도구 에러 시 에러 메시지 포함하여 LLM에 재전달 (1회) |
| CONTEXT_PACK 토큰 초과 | 중간 | 모듈별 max_tokens + 전체 budget 트림 |
| 사용자 ask_user 무응답 | 낮음 | 세션 타임아웃 후 Plan 폐기 |

---

## 22. 성공 기준

### 기능
- [ ] 사용자 메시지로 Orchestrator가 Plan을 생성하고 Executor가 실행
- [ ] 멀티스텝 Plan이 Post-Orch를 통해 연쇄 실행
- [ ] Executor에 단일 스킬만 탑재되어 실행
- [ ] Skill 내 tool calling (VFS, JS, Python, HTTP) 동작
- [ ] Prompt Buttons가 메시지 내에 렌더링되고 클릭 시 동작
- [ ] ask_user 후 사용자 응답으로 Plan 복귀

### 모듈형 위젯 + 탭
- [ ] `<AssiAirWidget>` 를 외부 페이지에 임베드하면 독립적으로 동작
- [ ] Chat / Settings / Logs 3개 탭이 모두 동작하며 탭 전환 시 상태 유지
- [ ] Settings 탭에서 LLM 프로바이더/모델/API Key 변경 → 즉시 반영
- [ ] Logs 탭에서 Orch/Exec/Tool/Signal 카테고리별 실시간 로그 확인
- [ ] 위젯 props (theme, defaultTab, apiEndpoint)로 외부 설정 가능

### 확장성
- [ ] .md 파일 추가만으로 새 스킬 등록
- [ ] .yaml 파일 추가만으로 새 워크플로우 등록
- [ ] webhook으로 외부 트리거 수신 가능

### 보안
- [ ] API 키가 브라우저에 노출되지 않음
- [ ] Rate Limit, Body size 제한 동작
- [ ] Chain depth 제한으로 무한 루프 방지

---

## 23. 확장 로드맵

### v1.1
- Executor 병렬 실행 (독립적인 step들을 동시 호출)
- Skill 마켓플레이스 (커뮤니티 스킬 공유)
- Plan 시각화 에디터 (드래그&드롭으로 Workflow 편집)

### v2.0
- Multi-Agent (여러 Executor가 협업)
- 장기 메모리 (대화 이력 + 사용자 프로필 영속화)
- 멀티모달 입력 (이미지, 파일 첨부)
- 오프라인 모드 (WebLLM + Service Worker)
