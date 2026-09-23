원인을 찾았습니다. 코드로 재현까지 확인한 뒤 고쳤습니다.

## 무엇이 문제였나

스위치 퍼즐은 규칙상 누른 키 캡 위에서 손을 떼야 눌림이 확정됩니다. 그래서 세션은 다운한 칸과 뗀 칸을 비교합니다.

그런데 모바일 Pressable은 손가락이 떨어질 때 onExit를 onRelease보다 먼저 보내는 경우가 있습니다. 그러면 제자리 탭 한 번에도 신호가 이렇게 들어옵니다.

onPress(C3) → touchDown(12), 다운 위치 12
onExit(C3) → touchMove(-1), 현재 위치가 판 밖으로 밀림
onRelease → touchUp(), -1과 12가 다르니 RELEASED_OUTSIDE로 취소

프레젠터는 이 문제를 이미 알고 있어서 스쳐 가는 exit에 지워지지 않는 "마지막으로 올라가 있던 진짜 칸"을 따로 기억해 뒀다가 뗄 때 onCellUp(12)로 정확히 돌려줍니다. 2026-09-02에 드래그 퍼즐들이 같은 문제로 고쳐졌던 부분입니다.

그런데 Switch_CoreAPI만 그 값을 버리고 있었습니다.

onCellUp: () => { this.session.touchUp(); }

레이저, 러시아워, 정렬, 연결은 전부 onCellUp: (cell) => ... 로 받고 있어서 멀쩡했습니다. 스위치 하나만 예외였습니다.

## 고친 것

Switch_CoreAPI.ts — onCellUp: (cell) => { this.session.touchUp(cell); }
Switch_Session.ts — touchUp(releasedPosition?) 으로 그대로 전달
Switch_InputController.ts — 넘어온 뗀 자리가 있으면 그것을 진실로 삼고 드래그 중 기록을 덮어씀

인자를 선택으로 받게 해서 기존 호출부는 그대로 둡니다. 취소 방향도 맞습니다. 판을 진짜로 벗어나면 프레젠터가 -1을 주므로 취소가 유지됩니다. 일시정지나 결과 화면의 cancelPress()도 -1이라 취소가 도리어 키 캡을 누르는 반대 방향 버그까지 막힙니다.

## 테스트가 못 잡은 이유

보드 UI 통합 테스트가 CoreAPI 배선을 재현한다면서 onCellUp의 칸 번호를 똑같이 버렸습니다. 게다가 "칸 밖에서 떼면 눌리지 않는다" 항목은 pointerExit로 판 밖을 흉내 냈는데 프레젠터 규약상 판을 벗어났다는 신호는 pointerLeaveBoard입니다. 즉 이 항목이 버그를 정답으로 고정하고 있었습니다. 배선을 맞추고 흉내를 pointerLeaveBoard로 바꿨습니다. 인월드와 같은 순서(onPress → onExit → onRelease)로 탭하는 회귀 항목도 넣었습니다. Switch_Tests에도 컨트롤러 단위 회귀 2건을 추가했습니다.

## 검증

고치기 전후를 같은 신호 순서로 돌린 재현 결과입니다.

old 배선(칸 번호를 버림): 탭 후 격자 변화 없음 ← 신고된 증상
new 배선(칸 번호를 넘김): 탭 후 격자 변화 있음

PUZ_08 스위치 136 PASS / 0 FAIL, 보드 UI 165 PASS / 0 FAIL, tsc --noEmit --skipLibCheck 오류 0건입니다.

경위는 Documents/생성 문서/구현 사항/버그수정_2026-09-23_스위치_터치_무반응.md 에 적었습니다. ScriptDesc 두 곳과 README 색인도 갱신했습니다.

<!-- HUMANIZE-SUMMARY v1.6.1
run_id: 2026-09-23-006
mode: monolith / 강도=보수 / route_hint=light (risk_band low, score 0)
metrics:
  char_in: 1665
  char_out: 1661
  change_rate: 4.4%
  self_check: 6/6
  grade: A
categories:  # before → after
  C-11 연결어미 뒤 쉼표: 4 → 0
  E-2 진행형 '~고 있었-' 반복: 5 → 2
  중복 동사 반복(고쳤다/수정했다, 둬서/둡니다): 2 → 0
  A-8 이중 피동: 0 → 0
  D-1~D-4 결산·hype 관용구: 0 → 0
self_check:
  - 고유명사·수치·인용·내용 앵커 100% 보존: OK (식별자 onExit/onRelease/onCellUp/touchUp/pointerExit/pointerLeaveBoard/cancelPress, 파일명 3종, 날짜 2026-09-02·2026-09-23, 수치 12/-1/136/165/0/2, PASS·FAIL, tsc 플래그, 신호 흐름·코드 블록 전부 원형)
  - 변경률 30% 이하: OK (4.4%)
  - 장르 이탈 없음: OK (개발자 간 기술 메모 유지, 헤딩 4개 구조 동일)
  - register 보존: OK ('-습니다' 합쇼체 유지, '-하였-' 상향 없음)
  - S1 잔존 0건: OK (C-11 0건, 증가 없음)
  - 인공 표현 추가 없음: OK (없던 수사·상투구 주입 0)
highlights:
  - id: 중복 동사
    before: "원인을 찾아서 고쳤습니다. 코드로 재현까지 확인한 뒤 수정했습니다."
    after: "원인을 찾았습니다. 코드로 재현까지 확인한 뒤 고쳤습니다."
  - id: C-11
    before: "…로 받고 있어서 멀쩡했고 스위치 하나만 예외였습니다."
    after: "…로 받고 있어서 멀쩡했습니다. 스위치 하나만 예외였습니다."
  - id: C-11 / E-1
    before: "판을 진짜로 벗어나면 프레젠터가 -1을 주므로 취소가 유지되고 일시정지나 결과 화면의 cancelPress()도 -1이라…"
    after: "판을 진짜로 벗어나면 프레젠터가 -1을 주므로 취소가 유지됩니다. 일시정지나 결과 화면의 cancelPress()도 -1이라…"
  - id: E-2
    before: "onCellUp의 칸 번호를 똑같이 버리고 있었습니다."
    after: "onCellUp의 칸 번호를 똑같이 버렸습니다."
  - id: C-11
    before: "배선을 맞추고 흉내를 pointerLeaveBoard로 바꾸고 인월드와 같은 순서로 탭하는 회귀 항목을 넣었습니다."
    after: "배선을 맞추고 흉내를 pointerLeaveBoard로 바꿨습니다. 인월드와 같은 순서로 탭하는 회귀 항목도 넣었습니다."
residual_findings: (없음) — E-2 '~고 있었-' 2건 잔존은 의도적 보존. "Switch_CoreAPI만 그 값을 버리고 있었습니다"·"버그를 정답으로 고정하고 있었습니다"는 '그동안 계속 그랬다'는 지속 상태가 핵심 정보라 단순 과거로 환원하면 의미가 약해짐.
over_polish_aborted: false
grade_reason: "A — S1 잔존 0, 자체검증 6항 통과, 변경률 4.4%. 입력이 risk_band low(score 0)인 데다 강도=보수 지정이라 손댈 곳 자체가 적었음. A 기준 변경률 밴드(10~25%)를 밑도는 것은 원문 품질이 이미 높았던 결과이지 미처리가 아님."
-->
