수정을 마쳤고 두 파일 모두 strict·ES5 타입 체크를 통과했습니다.

## 바꾼 것

NoesisBoard_Panel.ts `onPointerUp` (938-970행): 놓는 자리를 마지막 Move 의 격자 좌표로 정합니다. Up 인자의 좌표는 환산해 보되, 마지막 Move 에서 한 칸(`UP_POINT_MAX_DRIFT_CELLS`, 133행) 안에 있을 때만 더 정확한 값으로 채택하고 그보다 멀면 버립니다. 실기에서 검증된 MoveLab 의 `onUp` 이 Up 좌표를 읽지 않는 것과 같은 규칙입니다. Move 는 입력 해상도로 오므로 마지막 Move 와 실제 뗀 자리의 차이는 몇 px 안입니다. 진단 로그는 `logToConsole` 이 켜졌을 때만 `[NoesisBoardPanel] up ...` 으로 찍히며 두 좌표와 채택 여부(`usedUpPoint`), Up 인자 원문을 담습니다.

RushHour_CoreAPI.ts `onPieceDrop` (413-423행): 앞서 넣었던 진단 로그를 걷어내고 주석 처리돼 있던 `applyPieceVisuals()` 를 되살렸습니다. 이 호출이 없으면 놓은 뒤 보드 자리가 조각에 그려지지 않아 다음 드래그부터 화면과 보드가 어긋납니다. `onPieceGrab` 의 진단 로그도 지웠습니다.

NoesisBoard_Panel.md: 입력 표의 Up 행과 새로 넣은 "Up 의 좌표" 절에 이 규칙과 실기 근거를 적었습니다.

## 남은 것

- 실기에서 한 번 더 확인이 필요합니다. `logToConsole` 을 켜고 놓았을 때 `usedUpPoint=false` 가 찍히면 Up 좌표가 버려지고 마지막 Move 로 놓인 것입니다.
- 원인 2(반 칸 어긋남으로 다른 조각을 잡는 문제)는 이번에 손대지 않았습니다. `onPieceGrab/Drag/Drop` 의 변환에 0.5 를 빼는 짧은 수정이라 원하시면 이어서 반영하겠습니다.
- 스크래치패드의 재현 하네스는 그대로 있고 아직 정식 테스트로 옮기지 않았습니다.

## 근거

- Noesis 문서에 따르면 처리되지 않은 터치 이벤트는 마우스 이벤트로 승격되고 Move 인자의 좌표는 `GetPosition()` 으로 "어느 요소 기준인지"를 골라 읽는 값입니다. Horizon 이 `PassEventArgsToCommand` 로 넘기는 인자가 어느 요소 기준인지는 문서에 없어, 실기에서 찍은 값이 유일한 근거입니다.
- 프로젝트 안의 근거는 MoveLab 실기 통과 기록(작업기록 2026-09-21 "실기에서 확인된 사실" 표)과 스텁 재현(Up 좌표만 어긋나게 넣었을 때 제자리 복귀)입니다.

<!-- HUMANIZE-SUMMARY v1.6.1
run_id: 2026-09-23-001
route: light (risk_band low / score 0) · 강도: 보수
metrics:
  char_in: 1304
  char_out: 1301
  change_rate: 0.8%
  self_check: 6/6
  grade: A
categories:  # before -> after
  C-11 연결어미 뒤 쉼표: 4 -> 0
  A-18 관형절 중첩 장문: 1 -> 0
  D-1~D-4 결산·hype 어휘: 0 -> 0
  H-1/H-3 문두 접속사·메타 진입: 0 -> 0
  I-1 '~한 것이다' 연속: 0 -> 0 (1회 고립, 기본 보존)
self_check:
  - 고유명사·수치·인용·내용 앵커 100% 보존: OK (코드 식별자·행번호·0.5·2026-09-21·px 전부 원형)
  - 변경률 30% 이하: OK (0.8%)
  - 장르 이탈 없음: OK (개발 보고 리포트 유지)
  - register 보존: OK (합니다체 그대로, 상향·하향 없음)
  - S1 잔존 0건: OK
  - 인공 표현 추가 없음: OK (삽입 0, 삭제·분리만)
highlights:
  - id: C-11 + A-18
    before: "...읽지 않는 것과 같은 규칙이고, Move 는 입력 해상도로 오므로..."
    after: "...읽지 않는 것과 같은 규칙입니다. Move 는 입력 해상도로 오므로..."
  - id: C-11
    before: "...`[NoesisBoardPanel] up ...` 으로 찍히며 두 좌표와..."
    after: "...`[NoesisBoardPanel] up ...` 으로 찍히며 두 좌표와..."
  - id: C-11
    before: "앞서 넣었던 진단 로그를 걷어내고 주석 처리돼 있던..."
    after: "앞서 넣었던 진단 로그를 걷어내고 주석 처리돼 있던..."
  - id: C-11
    before: "...터치 이벤트는 마우스 이벤트로 승격되고 Move 인자의 좌표는..."
    after: "...터치 이벤트는 마우스 이벤트로 승격되고 Move 인자의 좌표는..."
residual_findings: (없음)
untouched_by_design:
  - "환산해 보되," — 대조 연결어미 '-되'는 C-11 대상 어미 목록 밖, 쉼표가 가독성을 담당하므로 보존
  - lexical_diversity z=+3.33 (S1 트리거) — 코드 식별자·API명이 어휘 다양성을 끌어올린 것으로 Do-NOT 대상, 윤문 없음
grade_reason: "A — S1 잔존 0, S2 잔존 0, 자체검증 6항 통과. 입력이 이미 risk_band low(score 0)라 변경률은 A 밴드(10~25%)보다 낮은 0.8%이며 이는 과윤문 금지 원칙(철칙 5·8)에 따른 의도된 최소 개입이다."
-->
