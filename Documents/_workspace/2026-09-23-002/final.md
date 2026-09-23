두 번째 손가락으로 놓였다는 관찰이 원인을 좁혀 줬습니다. 그에 맞춰 패널을 고쳤고 타입 체크를 통과했습니다.

## 관찰이 말해 주는 것

- 다른 손가락으로 화면을 건드렸을 때 조각이 놓이는 경로는 Focused Interaction 의 뗌 안전망입니다. `onStreamRelease` 가 `pointerUp` 을 부르고 조각 누름이면 `onPieceCancel` 로 가서 좌표를 새로 넣지 않고 컨트롤러가 갖고 있던 `_currentValue` 로 바로 확정합니다. 이 경로에서 지금 자리에 놓였다는 것은 `_currentValue` 가 뗄 때까지 맞다는 뜻입니다.
- 손가락을 떼는 정상 경로만 `trackDragToLocal` 로 좌표를 한 번 더 넣고 확정합니다. 이 경로에서 원래 자리로 돌아가므로, 뗄 때 Noesis 가 주는 마지막 좌표가 Move 와 다른 기준으로 오는 것입니다. Up 인자의 좌표이거나, 뗄 때 딸려 오는 TouchMove 이거나 둘 중 하나입니다.
- 앞서 넣은 "마지막 Move 에서 한 칸 안이면 Up 좌표를 채택" 규칙은 이 두 경우를 막지 못했습니다. Up 좌표가 누른 지점으로 오면 한 칸 드래그는 검사를 통과해 원래 자리로 돌아가고 뗄 때 딸려 오는 Move 는 검사 대상 자체가 아니었습니다. PC 에서 정상인 것은 마우스의 Up 좌표가 Move 와 같은 기준이기 때문입니다.

## 바꾼 것

NoesisBoard_Panel.ts `onPointerUp` (933-961행): Up 인자의 좌표는 아예 읽지 않고 마지막으로 받아들인 Move 의 격자 좌표로 놓습니다. 실기에서 검증된 MoveLab 의 `onUp` 과 같은 방식입니다. 한 칸 안이면 채택하던 규칙과 `UP_POINT_MAX_DRIFT_CELLS` 는 지웠습니다.

NoesisBoard_Panel.ts `onPointerMove` (1002-1022행): 튐 검사를 넣었습니다. px 좌표가 루트 밖이거나, 직전에 받아들인 Move 에서 한 이벤트 만에 `MOVE_MAX_JUMP_CELLS`(3칸)보다 멀리 뛴 좌표는 버리고 직전 자리를 유지합니다. 손가락은 화면 밖으로 나갈 수 없고 화면 전체를 한 번에 긋는 빠른 스와이프도 이벤트당 한 칸 남짓이라 정상 드래그는 걸리지 않습니다.

NoesisBoard_Panel.ts `gridPointOf` (1053-1063행): 격자 환산을 순수 계산으로 분리해 검사와 로그가 `_lastGridRow/Col` 을 건드리지 않고 값을 볼 수 있게 했습니다.

NoesisBoard_Panel.md: "Up 의 좌표" 절을 이번 관찰과 규칙으로 다시 썼습니다.

## 실기에서 확인할 것

`logToConsole` 을 켜고 모바일에서 끌어 놓으면 두 줄이 찍힙니다. `move rejected ... jump` 또는 `outside-root` 가 뗄 때마다 한 번 찍히면 뗄 때 딸려 오는 Move 가 원인이고 찍히지 않는데 `up ... upGrid=(...)` 의 값이 `dropGrid` 와 크게 다르면 Up 인자의 좌표가 원인입니다. 어느 쪽이든 조각은 마지막으로 받아들인 Move 자리에 놓여야 합니다. `args=` 뒤의 원문을 알려 주시면 Up 인자의 실제 모양을 문서에 적어 두겠습니다.

원인 2(반 칸 어긋남으로 다른 조각을 잡는 문제)는 아직 손대지 않았습니다.

## 근거

- Noesis 문서: 처리되지 않은 터치 이벤트는 마우스 이벤트로 승격되고 이벤트 인자의 좌표는 어느 요소 기준으로 읽을지를 고르는 값입니다. Horizon 이 `PassEventArgsToCommand` 로 넘길 때 어느 요소 기준으로 직렬화하는지는 문서에 없습니다.
- 이 프로젝트의 `Puzzle_HorizonBridge.ts` `handleEnded`: Focused Interaction 의 뗌은 무장·배달 여부와 무관하게 `onStreamRelease` 를 부르므로, 다른 손가락의 터치가 끝나도 열려 있던 조각 누름이 닫힙니다. 두 번째 손가락으로 놓인 이유입니다.

<!-- HUMANIZE-SUMMARY v1.6.1
run_id: 2026-09-23-002
mode: light (single-call monolith) / 강도: 보수
metrics:
  char_in: 3367
  char_out: 3355
  edits: 7
  change_rate: 0.3%
  self_check: 6/6
  grade: A
categories:  # before → after
  C-11 연결어미 뒤 쉼표: 6 → 0
  A-16 지시관형사+명사 반복('그 관찰'): 1 → 0
  I-3 '~다는 뜻입니다' 결말: 1 → 1 (쿼터 2회 이하, 보존)
  D-10 '~한 이유입니다' 도치 결산: 1 → 1 (쿼터 1회 이하, 보존)
  J-2 따옴표 강조: 2 → 2 (임계 5회 미만, 보존)
  A-18 관형절 좌향 중첩: 1 → 1 (보존 — 아래 residual 참조)
self_check:
  - 고유명사·수치·인용·내용 앵커 100% 보존: OK (코드 식별자·행 번호·파일명·3칸·933-961 등 전수 일치)
  - 변경률 30% 이하: OK (0.3%)
  - 장르 이탈 없음: OK (기술 보고 유지)
  - register 보존: OK (전 문장 '~습니다/~합니다' 격식 종결 그대로, 상향 없음)
  - S1 잔존 0건: OK (C-11 6 → 0)
  - 인공 표현 추가 없음: OK (신규 어휘 0개, 삭제·치환만)
highlights:
  - id: C-11
    before: "`onStreamRelease` 가 `pointerUp` 을 부르고, 조각 누름이면"
    after: "`onStreamRelease` 가 `pointerUp` 을 부르고 조각 누름이면"
  - id: C-11
    before: "Up 인자의 좌표는 아예 읽지 않고, 마지막으로 받아들인 Move 의"
    after: "Up 인자의 좌표는 아예 읽지 않고 마지막으로 받아들인 Move 의"
  - id: C-11
    before: "손가락은 화면 밖으로 나갈 수 없고, 화면 전체를 한 번에 긋는"
    after: "손가락은 화면 밖으로 나갈 수 없고 화면 전체를 한 번에 긋는"
  - id: C-11
    before: "마우스 이벤트로 승격되고, 이벤트 인자의 좌표는"
    after: "마우스 이벤트로 승격되고 이벤트 인자의 좌표는"
  - id: A-16
    before: "그 관찰에 맞춰 패널을 고쳤고 타입 체크를 통과했습니다."
    after: "그에 맞춰 패널을 고쳤고 타입 체크를 통과했습니다."
residual_findings:
  - id: A-18
    severity: S2
    reason: "'직전에 받아들인 Move 에서 한 이벤트 만에 MOVE_MAX_JUMP_CELLS(3칸)보다 멀리 뛴' 좌향 수식 1건. 문장 분리하면 '버리고 직전 자리를 유지' 술부를 중복 생성해야 해 보수 강도에서 보류."
  - id: A-7(오탐)
    severity: -
    reason: "'컨트롤러가 갖고 있던 _currentValue' 는 구체 주어+구체 객체라 have 직역 패턴 아님. 미수정."
  - note: "'-거나,' '-므로,' 뒤 쉼표 4건은 C-11 대상 연결어미(-고/-며/-지만/-면서/-아서/-어서)가 아니므로 보존."
grade_reason: "A — 입력 risk_band low(score 0)·사전 점수 0의 이미 잘 쓴 보고문. S1(C-11) 6건을 전량 제거하고 S2 오탐은 손대지 않아 잔존 S2 1건, 변경률 0.3%로 과윤문 없음. 자체검증 6항 통과. 등급표의 '변경률 10~25%' 구간은 중증 입력 기준이라 본 건처럼 탐지량 자체가 적은 글에는 적용하지 않았다."
-->
