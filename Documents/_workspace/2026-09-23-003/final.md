격자 안에서 뗄 때만 되돌아가고 격자 밖에서 떼면 정상이라는 관찰까지 더하면 그림이 하나로 모입니다. 정상 뗌 경로를 안전망 경로와 똑같이 만들어 고쳤고 로그 코드는 지웠습니다. 타입 체크(strict·ES5)는 통과했습니다.

## 관찰이 가리키는 곳

조각이 제대로 놓이는 경우는 셋 다 같은 경로입니다. 격자 밖에서 떼거나, 다른 손가락으로 화면을 건드리거나, PC 에서 마우스를 떼면 컨트롤러가 마지막 Move 까지 반영해 둔 값으로 바로 확정됩니다. 되돌아가는 경우는 격자 안의 칸 위에서 올라온 Up 하나뿐이고 이 경로만 놓는 순간 좌표를 한 번 더 컨트롤러에 넣었습니다. 두 경로의 차이가 그 한 번뿐이므로, 칸 위에서 올라오는 Up 인자의 좌표가 Move 와 다른 기준이라는 결론이 됩니다. 격자 밖은 칸이 없어 루트가 직접 Up 을 받고, 그 좌표는 Move 와 같은 기준이라 정상이었습니다.

## 바꾼 것

RushHour_CoreAPI.ts `onPieceDrop` (413-428행): 놓을 때 `trackDragToLocal` 을 부르지 않습니다. `finalizeDrag` 와 `applyPieceVisuals` 만 불러서 `onPieceCancel` 과 같은 경로가 됐습니다. 패널이 넘기는 좌표는 받기만 하고 쓰지 않습니다.

NoesisBoard_Panel.ts `onPointerUp` (923-945행): `logToConsole` 로그 블록과 Up 인자 읽기를 지웠습니다. 뗌은 "놓았다" 는 신호로만 쓰고 마지막으로 받아들인 Move 의 좌표를 넘깁니다.

NoesisBoard_Panel.ts `onPointerMove` (976-1000행): 튐 검사는 남기고 `move rejected` 로그만 지웠습니다. 루트 밖의 px 좌표나 한 이벤트에 3칸 넘게 뛴 좌표는 버리고 직전 자리를 유지합니다.

NoesisBoard_Panel.md: "Up 의 좌표" 절을 이번 관찰과 규칙으로 다시 썼습니다.

## 남은 것

- 원인 2(반 칸 어긋남으로 칸의 아래·오른쪽 절반에서 다른 조각을 잡거나 거절되는 문제)는 아직 손대지 않았습니다. `onPieceGrab/Drag` 의 변환에 0.5 를 빼는 짧은 수정이라 원하시면 이어서 반영하겠습니다.
- 스크래치패드의 재현 하네스는 옛 `onPieceDrop` 동작을 흉내 내고 있어 지금 코드와 다릅니다. 정식 테스트로 옮길 때 같이 맞추겠습니다.

## 근거

- 이 프로젝트의 `Puzzle_HorizonBridge.ts` `handleEnded`: Focused Interaction 의 뗌은 무장·배달 여부와 무관하게 `onStreamRelease` 를 부르므로 다른 손가락의 터치가 끝나도 열려 있던 조각 누름이 `onPieceCancel` 로 닫힙니다. 이것이 다른 손가락으로 놓였을 때 정상이었던 이유입니다.
- Noesis 문서: 처리되지 않은 터치 이벤트는 마우스 이벤트로 승격되고 이벤트 인자의 좌표는 어느 요소 기준으로 읽을지를 고르는 값입니다. Horizon 이 `PassEventArgsToCommand` 로 넘길 때 어느 요소 기준으로 직렬화하는지는 문서에 없습니다. 칸 위에서 올라온 Up 만 어긋난다는 실기 관찰이 근거입니다.

<!-- HUMANIZE-SUMMARY v1.6.1
run_id: 2026-09-23-003
route: light (single-call monolith, 보수 강도)
metrics:
  char_in: 1595
  char_out: 1596
  change_rate: 1.1%
  self_check: 6/6
  grade: A
categories:  # before -> after
  C-11 연결어미 뒤 쉼표(-고,/-어,): 4 -> 0
  A-18 관형절 중첩 장문: 2 -> 1
  '-(으)므로' 반복: 3 -> 2
  D-10 '~인 이유입니다' 도치 결산: 1 -> 1 (문서당 1회 허용, 보존)
  D-1 결산 lexicon / D-4 hype / C-5 이모지 / A-8 이중피동: 0 -> 0
self_check:
  - 고유명사·수치·인용·내용 앵커 100% 보존: OK (NoesisBoard, MoveLab 계열, CoreAPI, Horizon, Noesis, Focused Interaction, 행 번호·파일명·백틱 식별자 원형 유지)
  - 변경률 30% 이하: OK (1.1%)
  - 장르 이탈 없음: OK (기술 보고서 유지)
  - register 보존: OK (~입니다/~습니다 격식 종결 전량 유지, 상향 없음)
  - S1 잔존 0건: OK
  - 인공 표현 추가 없음: OK (원문에 없던 수사·상투구 삽입 0건)
highlights:
  - id: C-11
    before: "정상 뗌 경로를 안전망 경로와 똑같이 만들어 고쳤고, 로그 코드는 지웠습니다."
    after: "정상 뗌 경로를 안전망 경로와 똑같이 만들어 고쳤고 로그 코드는 지웠습니다."
  - id: C-11
    before: "Up 하나뿐이고, 이 경로만 놓는 순간 좌표를 한 번 더 컨트롤러에 넣었습니다."
    after: "Up 하나뿐이고 이 경로만 놓는 순간 좌표를 한 번 더 컨트롤러에 넣었습니다."
  - id: C-11 + A-18
    before: "...직렬화하는지는 문서에 없어, 칸 위에서 올라온 Up 만 어긋난다는 실기 관찰이 근거입니다."
    after: "...직렬화하는지는 문서에 없습니다. 칸 위에서 올라온 Up 만 어긋난다는 실기 관찰이 근거입니다."
  - id: rhythm
    before: "`finalizeDrag` 와 `applyPieceVisuals` 만 부르므로 `onPieceCancel` 과 같은 경로가 됐습니다."
    after: "`finalizeDrag` 와 `applyPieceVisuals` 만 불러서 `onPieceCancel` 과 같은 경로가 됐습니다."
  - id: C-11
    before: "마우스 이벤트로 승격되고 이벤트 인자의 좌표는..."
    after: "마우스 이벤트로 승격되고 이벤트 인자의 좌표는..."
residual_findings:
  - id: D-10
    severity: S2
    reason: "'정상이었던 이유입니다' 1건 — 문서당 1회 이하 쿼터 내, 원문 필자 문장이라 보존"
  - id: A-18
    severity: S2
    reason: "'handleEnded' 항목 장문 1건 — 분리하면 '그래서/이유' 접속 주입이 필요해 보수 강도상 원문 유지"
grade_reason: "A — S1 잔존 0, 자체검증 6항 통과. 입력이 risk_band low(사전 score 0)라 손댈 구간 자체가 적어 변경률이 A 기준 하한(10%)보다 낮음. 보수 강도 지시에 따라 억지 윤문 없이 근거 있는 5곳만 수정."
-->
