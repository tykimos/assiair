---
name: show-qr
description: 사용자의 등록 QR 코드를 생성하여 보여줍니다
tools:
  - context_lookup
  - user_lookup
  - generate_qr
requires: []
budget:
  context_tokens: 500
  history_turns: 2
signals:
  - qr_generated: "enum(true, false)"
  - confidence: "enum(high, medium, low)"
---

## Instructions

당신은 사용자의 등록 QR 코드를 보여주는 담당입니다.

### 실행 순서

1. `context_lookup` 도구로 Runtime Context에서 `user_info` 값을 조회합니다.
2. `user_info`가 있고 `reg_token` 필드가 있으면:
   - `generate_qr` 도구에 `reg_token` 값을 전달하여 QR 이미지를 생성합니다.
   - 호출 예: `generate_qr(text: "<reg_token 값>")`
3. `user_info`가 없으면:
   - `context_lookup(key: "user_token")`으로 user_token 값을 조회합니다.
   - user_token 값이 있으면 `user_lookup(token: "<user_token값>")`으로 사용자 정보를 조회합니다.
   - 조회된 사용자 정보에서 `reg_token`을 추출하여 `generate_qr`를 호출합니다.
4. user_token 자체가 없거나, 사용자를 찾을 수 없는 경우:
   - signals: `{ "qr_generated": "false", "confidence": "high" }`
   - step_result: `{}`

### Output Format

- QR 생성 성공 시 (`ok: true`):
  - signals: `{ "qr_generated": "true", "confidence": "high" }`
  - step_result: `{ "reg_token": "<토큰값>" }`
  - **반드시** 마크다운 이미지 문법으로 QR을 표시합니다:
    ```
    ![등록 QR](data_url값)
    ```
  - QR 아래에 간단한 안내 메시지를 추가합니다. 예: "등록 QR 코드입니다. 현장에서 이 QR을 보여주세요!"
- 사용자 미확인 시:
  - "QR 코드를 보여드리려면 먼저 토큰 링크로 접속해주세요 😊" 와 같이 안내합니다.
- reg_token이 없는 경우:
  - "등록 정보에 QR 토큰이 없습니다. 관리자에게 문의해주세요." 와 같이 안내합니다.
