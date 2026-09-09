# Horizon 공식 "CPU and TypeScript optimization" 가이드 분석과 프로젝트 적용

> 대상: 성능 작업을 하기 전에 공식 기준선을 알아야 하는 사람
> 원문: [CPU and TypeScript optimization and best practices](https://developers.meta.com/horizon-worlds/learn/documentation/performance-best-practices-and-tooling/performance-best-practices/cpu-and-typescript-optimization-best-practices) (Meta Horizon Worlds 문서, 2026-09-07 열람)
> 적용 이력: §6-1 리페인트 배치 커밋 → `../구현 사항/작업기록_2026-09-07_리페인트_배치_커밋_레이저_적용.md` (레이저 적용, 인월드 실측 전)
> 관련 문서: `격자_보드게임_구현과_최적화_방법론.md` (장르 공통 원칙), `2026-09-04_드래그_반응속도_개선_제안.md` (릴리즈 리페인트 코얼레싱), `../구현 사항/작업기록_2026-09-04_릴리즈_리페인트_통합과_드래그_스트림_실험.md`

**한 줄 요약.** 공식 가이드가 Custom UI 에 두는 기준은 **로컬 클라이언트에서 프레임당 바인딩 set 10회 이하, UI 전체 CPU 0.5 ms 이하**다. 레이저 퍼즐의 드롭 프레임은 Perfetto 실측으로 **set 462회, 약 10 ms** 라 두 기준을 각각 약 46배, 20배 넘는다. 가이드가 지목하는 원인("모든 prop 에 편의상 바인딩을 만드는 래퍼 계층", "값이 안 바뀌었는데 set 하는 것")이 우리 보드 UI 의 구조와 정확히 일치한다.

---

## §1 원문의 구성

원문은 월드 전반의 CPU 권고와 TypeScript 권고를 한 페이지에 담고 있다. 절 구성과 요지는 다음과 같다.

| 절 | 요지 | 우리 프로젝트 관련도 |
|---|---|---|
| General recommendations | 햅틱(활성 시 프레임당 ~7.8 ms 사례), Trimesh 월드에 SubD 금지(비활성이어도 Sunlight 비용), 2D 오브젝트는 필요한 설정만(Motion=Animated 가 Rigidbody 등을 자동 추가), 애니메이터 수 최소화 | 낮음 - 월드 편집 항목. 보드가 Custom UI 라 3D 오브젝트가 거의 없다 |
| Implement LOD | 먼 오브젝트의 폴리곤·에셋 단계 축소 | 낮음 |
| TypeScript optimization › Deep profiling | Deep trace 를 떠서 **브리지 호출**을 찾고 코드에 대응시킨다. 코드 라인 자동 대응은 없다 | **높음** - 이번 Perfetto 분석이 이 절차 그대로다 |
| › Optimizing bridge calls | 대부분의 API 가 브리지를 탄다. 꼭 필요할 때만 부르고 결과를 캐시한다. 체인의 get/set 마다 브리지 1회. **값이 바뀌었는지 확인한 뒤에 set 한다** | **높음** |
| › Calculating versus getting | forward/up 은 rotation 에서 계산하면 get 을 아낀다 | 낮음 - 카메라 셋업 1회뿐 |
| › Networking and events | 네트워크 동기화되는 부작용은 여러 프레임에 분산한다. 순수 로컬이면 CodeBlockEvent 대신 TS 이벤트. Broadcast 구독은 안 쓰면 해제 | 중간 |
| › Attachments / Raycasts | TS 로 직접 붙이지 말고 attachment 시스템. 레이캐스트는 짧게·드물게 | 없음 - 둘 다 쓰지 않는다 |
| Audio playback | 오디오는 CPU 비쌈. Play and Forget, .wav, 전역 사운드, 동시 재생 10~12개 이하(하드 리밋 32) | 낮음 - 카운트다운 효과음 1개 |
| Concurrent players | 아바타 1명당 약 0.5 ms. 24명이면 12 ms | 중간 - 게시 시 동시 접속 수 결정에 쓴다 |
| Spawning objects | 동적 스폰은 서버 1.5 s+, 클라이언트 280 ms 급 끊김. 플레이 전 스폰, 프리웜, 상한, 풀링 | 없음 - 런타임 스폰이 없다 |
| **Custom UI optimization** | 프레임당 CPU 0.5 ms(클라이언트)/1.5 ms(서버), **set 횟수 축소**, 목적 없는 바인딩 금지, 주기적 set 애니메이션 지양 | **가장 높음** - §3 에서 정독 |
| › Profiling UI | 바인딩 set/콜백에 대응하는 트레이스 마커 목록. 5초 구간 wall time ÷ 360 으로 프레임당 비용 추정 | **높음** |
| › Frequency Limits | set ≤ 10/frame(로컬), ≤ 20/frame(서버, 전원 합), 콜백 ≤ 1/2frame | **가장 높음** |
| › Network latency | 패널(클라이언트)과 스크립트(서버) 사이 RPC 왕복이 hover 스타일·TS 구동 애니메이션을 지연시킨다 | 중간 - 우리는 Local 실행이라 완화된다 (§4) |
| › Memory usage | UI 엔티티당 ReactVR 렌더 텍스처 ~40 MB + 참조 텍스처 사본. **visibility 토글이 텍스처를 해제·재할당하므로 켠 채로 둔다** | 중간 |

---

## §2 기억해야 할 수치

| 항목 | 값 | 출처 절 |
|---|---|---|
| Custom UI 총 CPU (로컬 클라이언트) | ≤ 0.5 ms / frame | Custom UI optimization |
| Custom UI 총 CPU (서버) | ≤ 1.5 ms / frame | 〃 |
| 바인딩 set (로컬 클라이언트, 1인) | ≤ 10 회 / frame | Frequency Limits |
| 바인딩 set (서버, 전원 합) | ≤ 20 회 / frame | 〃 |
| UI 콜백 | ≤ 1 회 / 2 frame | 〃 |
| UI 엔티티 고정 메모리 | 약 40 MB (렌더 텍스처) | Memory usage |
| 아바타 1명 CPU | 약 0.5 ms | Concurrent players |
| 동시 오디오 | 10~12개 권장 (하드 리밋 32) | Audio playback |
| 햅틱 사례 | 약 7.8 ms / frame | Haptic feedback |

> 원문의 표 바로 위 문장은 "이 한도를 넘으면 위에서 말한 **1 ms** per frame 한도를 넘을 것"이라고 적혀 있어 0.5/1.5 ms 와 어긋난다. 원문의 불일치이므로 보수적으로 0.5 ms 를 기준으로 본다.

---

## §3 Custom UI 절 정독

가장 중요한 절이라 원문의 다섯 항목을 그대로 옮기고 해석을 붙인다.

### 3.1 "Reduce the number of binding set calls"

바인딩 set 한 번이 곧 브리지 호출 한 번이고, 스크립트가 서버에서 돌 때는 네트워크 RPC 한 번이다. Deep trace 에서 UI 의 **모든 메인 스레드 동기 비용은 set 과 콜백 두 종류로만** 구성된다고 명시한다. 따라서 UI 최적화의 단위는 "set 횟수" 하나로 환원된다.

### 3.2 "Do not define bindings without a concrete purpose"

원문을 그대로 옮긴다.

> This may happen by writing a custom abstract API layer wrapping the base UI components (View, Image, Pressable, etc.), and defining bindings for every prop as a convenience to consumers. **On the local client, a binding set operation passes the entire key-value store to ReactVR. So the bigger this gets, the greater the CPU cost to perform a single binding set.**

두 가지 함의가 있다.

1. **바인딩(키)의 개수 자체가 set 1회의 비용을 키운다.** set 은 바뀐 키 하나만 보내는 것이 아니라 패널의 키-값 저장소 전체를 넘긴다. 키가 1,000개인 패널의 set 은 키가 100개인 패널의 set 보다 비싸다.
2. "기본 컴포넌트를 감싸는 추상 계층이 모든 prop 에 바인딩을 만든다" 는 것을 **대표적인 오용 사례**로 든다. 우리 `PuzzleBoardUI_Grid.createCell()` / `PuzzleBoardUI_Tray.createSlot()` 이 정확히 이 형태다 (§4).

### 3.3 "Animations, by way of periodic binding updates, should be implemented with care or not at all"

주기적 set 으로 만드는 애니메이션은 브리지 빈도 한도와 네트워크 지연 두 가지에 동시에 걸린다. `Animation` API 를 쓰라고 한다. 우리는 시작 배너 페이드에 `Animation.timing` 을 쓰고(`PuzzleBoardUI_Panel`), 집은 조각의 고리는 애니메이션을 걸지 않는다(`PuzzleBoardUI_Parts.createGrabRing` 주석). 유일한 주기 set 은 허브의 초읽기 점멸(`PuzzleUI_MainPanel.startCountdownBlink`, `setInterval` 로 boolean 1개)이며, 초당 2회 수준이라 한도 안이다.

### 3.4 Profiling UI - 마커 대응표

원문이 "서버"/"클라이언트" 로 나눈 마커를 옮긴다. 우리 스크립트는 **Local 실행 모드**라 스크립트 VM 이 클라이언트에서 돌므로, 원문이 "서버" 라고 적은 스크립트 측 마커가 클라이언트 트레이스에 나타난다. 레이저 트레이스에서 실제로 잡힌 이름을 오른쪽에 적었다.

| 용도 | 원문 마커 (서버 측 = 스크립트 호스트) | 원문 마커 (클라이언트 측 = 패널) | 레이저 트레이스에서 잡힌 이름 |
|---|---|---|---|
| 바인딩 set | `ScriptingRuntime::Bridge::SetUIBindings`, `CustomUI::UpdateBinding::Send` | `Verts::PollDriver::PreFrame`, `Verts::PollDriver::Rpc`, `CustomUI::UpdateBinding` | `ScriptingRuntime::Bridge` (462), `CustomUI::UpdateBinding::Send` (462) |
| UI 콜백 | `ScriptingRuntime::HandleEvent::customuicallbackinternal` | `Verts::Update` | `ScriptEvent::customuicallbackinternal` (1), `Verts::Update` (1) |
| 그 밖에 | `CustomUI::UpdateImage::Send`, `CustomUI::InitializeState::Send` | `CustomUI::UpdateImage`, `CustomUI::InitializeState` | (이번 구간에는 없음) |

집계 요령도 원문에 있다. 메인 스레드에서 5초 구간을 드래그해 마커의 wall time 합을 360(72 fps × 5 s)으로 나누면 프레임당 평균 비용이 된다. 원문 예시는 `Verts::PollDriver::Rpc` 90.03 ms ÷ 360 = 0.25 ms.

### 3.5 Network latency / Memory

- 스크립트가 서버에 있을 때 패널과의 왕복 지연이 hover 스타일과 TS 구동 애니메이션을 늦춘다. 우리는 보드·허브 패널과 CoreAPI 를 모두 Local 로 돌리므로 (`Puzzle_LocalOwnership`), 이 왕복은 같은 클라이언트 안에서 끝난다. 다만 **브리지 비용 자체는 사라지지 않는다** - 레이저 트레이스의 462회가 그 증거다.
- UI 엔티티 하나당 약 40 MB 의 렌더 텍스처가 고정으로 붙는다. 보드 패널과 허브 패널이 별도 gizmo 이므로 클라이언트당 약 80 MB + 참조 텍스처다. **엔티티 `visible` 을 끄면 텍스처가 해제되고 다시 켤 때 재할당**되므로 켠 채로 두고 내용만 숨기라고 한다. 우리는 엔티티 visibility 를 건드리지 않고 `display: none` 과 마운트 게이팅으로 숨긴다 - 권고와 일치한다.

---

## §4 이 프로젝트와의 대조

| 권고 | 현재 상태 | 판정 | 조치 |
|---|---|---|---|
| Deep trace 로 브리지 호출을 찾아 코드에 대응 | 레이저 드롭 프레임 실측: `Bridge` 462회 전부 `UpdateBinding::Send` | 완료 | - |
| set 은 로컬 클라이언트 프레임당 10회 이하 | 드롭·집기 프레임 462회 (약 46배). 드래그 이동 프레임은 2칸 × 22 = 44회 (약 4배) | **위반** | §6 1·2번 |
| UI 총 CPU 0.5 ms 이하 | 드롭 프레임 `HandleEvent` 10.03 ms (브리지 6.67 + JS 3.37) + `CustomUIStateService::Update` 1.06 ms | **위반** | §6 1·2번 |
| 콜백 ≤ 1 / 2 frame | 칸마다 `Pressable` 의 onPress/onEnter/onExit/onRelease. 드래그 중 칸 경계를 지날 때 enter+exit 2회가 한 프레임에 올 수 있다 | 경계 | 연속 드래그 스트림(`continuousDrag`)을 쓰면 칸 콜백이 줄어든다 - 실험 문서 참고 |
| 값이 바뀌었는지 확인한 뒤 set | 프레젠터는 칸 단위로 확인한다(`applyCellPatch`). 그러나 칸 하나가 바뀌면 파생 21개가 값과 무관하게 전부 set 된다 | **부분 위반** | §6 2번 |
| 목적 없는 바인딩을 만들지 않는다 (래퍼 계층이 모든 prop 에 바인딩) | 칸마다 원본 1 + 파생 21 키. 레이저가 아닌 퍼즐에서도 무늬 테두리 5키·띄우기 1키가 만들어진다 | **위반** | §6 2·3번 |
| 키-값 저장소가 클수록 set 1회가 비싸다 | 보드 패널 키 수 = 보이는 칸 수 × 22 + 트레이 슬롯 × 약 25 + 패널 18. 7×7 이면 약 1,300개 | 주의 | §6 2·3번으로 키 수도 줄어든다 |
| 주기적 set 애니메이션 지양, `Animation` API 사용 | 배너 페이드 = `Animation.timing`. 고리 = 고정값. 초읽기 점멸만 `setInterval`(초당 2회) | 준수 | - |
| 브리지 get 을 캐시 (`owner.get()` 등) | `owner.get()` 은 `start()`/소유권 이전 시점에만. `position/forward.get()` 은 카메라 셋업 1회 | 준수 | - |
| 순수 로컬 이벤트는 TS 이벤트로 | 세션↔CoreAPI 는 `Utility_Events.EventPublisher`(순수 TS). `CodeBlockEvent` 는 소유권 이전(`Puzzle_LocalOwnership`)에만 | 준수 | - |
| 네트워크 부작용을 여러 프레임에 분산 | 드롭 시 판 49칸 + 트레이 7슬롯을 한 이벤트 턴에 갱신 | 개선 여지 | §6 4번 |
| Broadcast 구독은 안 쓰면 해제 | `World.onUpdate` 를 CoreAPI 마다 연결(`connectPuzzleUpdate`). 세션이 비활성이면 즉시 return | 허용 | 8개 퍼즐이 한 월드에 있으면 구독 8개. 비용은 JS 측 분기 하나라 실측 전에는 건드리지 않는다 |
| Attachment / Raycast / 동적 스폰 회피 | 셋 다 쓰지 않는다 | 준수 | - |
| 오디오 최소화 | 초읽기 효과음 1개 | 준수 | - |
| UI 엔티티 visibility 토글 금지 | 토글하지 않는다. `display`/마운트 게이팅으로 숨긴다 | 준수 | - |
| 동시 접속 = 아바타당 0.5 ms | 미정 | 결정 필요 | 게시 시 최대 인원을 정할 때 "24명 = 12 ms" 를 기준으로 삼는다 |

---

## §5 레이저 Perfetto 트레이스와의 연결

2026-09-07 에 뜬 드롭 프레임 트레이스(단위 ns → ms 환산)를 원문 기준에 대응시킨다.

| 마커 | 횟수 | 합계 | 원문 기준 | 배율 |
|---|---|---|---|---|
| `ScriptingRuntime::HandleEvent` | 1 | 10.03 ms | UI 총 0.5 ms | 약 20배 |
| ㄴ `ScriptingRuntime::Bridge` | 462 | 6.67 ms (self 5.12) | - | 호출당 약 14 µs |
| ㄴ `CustomUI::UpdateBinding::Send` | 462 | 1.55 ms | set ≤ 10 / frame | 약 46배 |
| ㄴ JS 실행 (self) | - | 3.37 ms | - | 패치 객체 생성·파생 함수 441회 |
| `CustomUIStateService::Update` | 1 | 1.06 ms | - | 패널 상태 반영 |
| `PlayerLoop::PostLateUpdate` | 1 | 3.95 ms | - | 렌더 마무리 (UI 레이아웃 포함 추정) |

462회의 구성은 다음 두 곱이다.

- **곱하는 수 22** = 칸 하나의 키 수. `PuzzleBoardUI_Grid.createCell()` 이 칸 Binding 하나에서 파생 21개(scale, lift, 텍스처 4, 라벨 판정 1, Text 3, opacity, 배경색, 무늬 5, 테두리 2, 고리 1)를 만든다. 원본 `set()` 한 번에 원본 1 + 파생 21 이 각각 `Send` 된다. 원문 3.2 의 "모든 prop 에 바인딩" 오용 사례가 이것이다.
- **곱해지는 수 21** = 이 프레임에 프레젠터가 낸 `CELL_CHANGED` 횟수. `Laser_CoreAPI.applyBoardVisuals()` 가 바탕 → 광선 → 기믹 → 크리스탈 순서로 **프레젠터에 직접 덧칠**하므로, 최종값이 그대로인 기믹·광선·크리스탈 칸도 "바탕이 됐다 → 다시 원래대로" 두 번 갱신된다. 실제로 바뀐 칸은 한두 개인데 21번이 나가는 이유다.

> 22 는 코드에서 센 값이고 21 은 462 ÷ 22 로 역산한 값이다. 런타임이 값이 같은 파생을 걸러 준다면 배수가 22 로 떨어질 이유가 없으므로 "파생은 값과 무관하게 전부 나간다" 를 전제로 했다. 확정 절차는 §7 에 있다.

---

## §6 적용 우선순위

원문 기준(set ≤ 10 / frame)에 맞추려면 곱하는 수와 곱해지는 수를 둘 다 줄여야 한다. 순서는 위험이 낮고 효과가 큰 것부터다.

1. **리페인트 배치 커밋 (곱해지는 수 21 → 실제 변화 수).** `PuzzleBoardPresenter` 에 `beginBatch()` / `endBatch()` 를 두고, 배치 중 패치는 스냅샷에만 적용했다가 끝에 "배치 시작 시점과 최종값이 다른 칸" 만 `CELL_CHANGED` 를 낸다. 레이저 `applyBoardVisuals()` 를 통째로 감싼다. 덧칠 로직(바탕 리셋 → 층 겹치기)은 그대로 둔다 - 앞 프레임의 광선·실루엣을 지우는 데 필요한 로직이고, 문제는 중간 결과가 프레젠터 밖으로 새는 것뿐이다. 예상: 집기 프레임 462 → 약 23(트레이 슬롯 1 + 칸 0~1), 드롭 프레임 → 광선이 바뀐 칸 수 × 22. 프레젠터는 순수 계층이라 `PuzzleBoardUI_Tests` 로 검증한다.
2. **칸·슬롯의 파생 바인딩을 속성별 Binding + JS 측 diff 로 교체 (곱하는 수 22 → 바뀐 속성 수).** 칸마다 최종 스타일 값(fill, tint, source, hasTexture, label, labelVisible, rotation, edge×4, hasGlyph, scale, lift, opacity, borderWidth, borderColor, ringDisplay)을 일반 `Binding` 으로 두고, `applyCell()` / `setPressed()` 가 마지막 전송값과 비교해 바뀐 것만 `set()` 한다. 광선 칸은 22 → 2(fill, tint), 누름 표시는 7 → 3~5. `textureEpoch` 파생은 패널이 `grid.refreshTextures()` 를 부르는 방식으로 바꾼다. 원문 3.2 의 "값이 바뀌었는지 확인한 뒤 set" 을 키 단위로 지키는 것이다.
3. **퍼즐이 쓰지 않는 층은 바인딩을 만들지 않는다 (키 수 축소).** 무늬 테두리(레이저 전용 5키)와 띄우기(레이저 전용 1키)는 `PuzzleBoardLayoutSpec` 이 켠 퍼즐에서만 만든다. 나머지 7개 퍼즐에서 칸당 6키가 사라져 set 1회의 비용(키-값 저장소 크기)도 줄어든다. "퍼즐 전용 UI 는 그 퍼즐만 마운트한다" 는 기존 규칙과 같은 방향이다.
4. **드롭 갱신을 두 프레임에 분산.** 원문 "Spreading events" 대로, 드롭 프레임에는 판만 갱신하고 트레이 갱신은 다음 프레임(`async.setTimeout(…, 0)`)으로 미룬다. 1·2번 뒤에도 10회를 넘는 경우에만 검토한다.
5. **동시 접속 상한 결정.** 게시 설정 항목이라 코드 밖이지만, 아바타당 0.5 ms 기준으로 인원을 정한다.

1·2번을 함께 적용하면 드롭 프레임의 스크립트 이벤트 10 ms 는 1~2 ms 수준이 될 것으로 본다. 2번은 `createCell` / `createSlot` 재작성이라 인월드 확인이 필수다.

---

## §7 검증 방법

1. **파생 팬아웃 확정.** `PuzzleBoardUIPanel.applyGridCell()` 에 프레임당 카운터를 두어 `CELL_CHANGED` 횟수를 로그로 찍고, 같은 프레임의 Perfetto `CustomUI::UpdateBinding::Send` 횟수와 비교한다. 22배면 §5 의 전제가 맞다. 작으면 런타임이 일부를 걸러 주는 것이므로 2번의 예상 효과를 다시 계산한다.
2. **프레임당 set 횟수.** 원문 요령대로 Perfetto 에서 5초 구간을 잡아 `CustomUI::UpdateBinding::Send` 의 횟수를 360 으로 나눈다. 드래그를 계속하는 5초 구간에서 프레임당 10회 이하가 목표다.
3. **프레임당 UI CPU.** 같은 구간에서 `ScriptingRuntime::HandleEvent` + `CustomUIStateService::Update` 의 wall time 합 ÷ 360 이 0.5 ms 이하인지 본다.
4. **키 수.** 패널 생성 직후 `Binding` 생성 횟수를 세어 로그로 남긴다. 3번 적용 전후로 레이저가 아닌 퍼즐에서 칸당 6개가 줄어야 한다.
5. 회귀: `가이드/타입체크와_테스트_실행.md` 의 §1~§3 을 통과해야 한다. 특히 2번은 `Bindable<T>` 반환 타입을 명시해야 `TS4058` 을 피한다 (`PuzzleBoardUI_Parts.createLabelVisibility` 주석).

---

## 부록 - 원문에서 우리와 무관해 생략한 내용

- 오브젝트 풀 코드 예시 두 벌 (`EntityPool`, `PoolSpawnManager`). 런타임 스폰을 하지 않으므로 옮기지 않았다.
- 무기 발사를 5프레임에 나누는 예시. 원리는 §6 4번에 반영했다.
- Trimesh/SubD, 햅틱, 애니메이터, LOD 는 월드 편집 항목이라 §1 표에만 남겼다.
