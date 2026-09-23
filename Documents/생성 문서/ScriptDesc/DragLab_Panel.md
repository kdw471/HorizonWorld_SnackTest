# DragLab_Panel — Custom UI 드래그 이동 방식 비교 실험실 (테스트 전용)

> 원본: `DragLab_Panel.ts` (클래스 `DragLabPanel`)
> 관련: `FocusDragDemo_Panel.ts` (이 실험실의 R2 와 같은 방식의 단일 데모),
> `../설계/2026-09-07_Horizon_CPU_TypeScript_최적화_가이드_분석.md` (set 한도),
> `../설계/Horizon_실행모드_제약과_규칙.md` §7 (64 kB 한도)

## 목적

드래그 도중 상자가 **주기적으로 멈췄다가 따라잡는** 현상이 우리 로직 탓인지, Custom UI 자체의
부하 탓인지 가르기 위한 실험 패널이다. **입력 경로 4종 × 렌더 경로 13종 × 놓기 방식 3종**을 월드를 다시 올리지
않고 화면 버튼으로 바꿔 가며, 같은 계측(입력 공백·VM 공백·프레임 공백·set 횟수)으로 비교한다.

퍼즐 로직과 무관하다. 다른 프로젝트 파일을 import 하지 않으므로 파일 하나만 지우면 흔적이 없다.

## 에디터에 붙이는 법

`FocusDragDemo_Panel` 과 같다.

1. **Custom UI gizmo** 를 만들고 Display Mode 를 **Screen Overlay** 로 둔다.
2. 이 스크립트를 붙이고 **Execution Mode 를 Local** 로 바꾼다.
3. 빈 엔티티에 `Puzzle_LocalOwnership`(Default 실행 모드)을 붙이고 `targets` 에 이 gizmo 를 넣는다.
4. 스크립트 설정의 API 목록에서 **`horizon/mobile_gestures` 가 켜져 있어야** 컴파일된다
   (I2 입력이 쓴다). `Cannot find module 'horizon/mobile_gestures'` 가 나오면 그것을 켠다.
5. 다른 드래그 패널(FocusDragDemo 등)은 **같은 월드에서 꺼 둔다** — 같은 터치 스트림을 두 패널이
   함께 받으면 측정이 섞인다.

## 화면

| 위치 | 내용 |
|---|---|
| 맨 위 초록 막대 | **네이티브 펄스** (`showNativePulse`, **기본 끔**). 시작 때 `Animation.repeat` 를 한 번 걸고 스크립트가 다시 손대지 않는다. 이 막대가 멈추면 스크립트가 아니라 렌더(네이티브) 쪽이 멈춘 것이다. 끝나지 않는 커스텀 애니메이션은 UI 스레드와 메인 스레드를 어긋나게 하므로(`../설계/Horizon_실행모드_제약과_규칙.md` §7) 정지 원인을 가를 때만 켠다 |
| 위 글자 | 1·2줄 = 현재 입력·렌더 방식과 **적용 중인 설정**, 3·4줄 = 직전 드래그(또는 자동 구간)의 결과 |
| 상자 | 끌고 다니는 대상. **색과 글자로 바인딩 계열을 표시한다** — `S` 파랑 = 문자열 Binding, `L` 보라 = AnimatedBinding→left/top, `T` 주황 = AnimatedBinding→transform, `O` 청록 = 객체 Binding + derive, `P` 진홍 = px 숫자 Binding(브라우저 데모 이식). 잡고 있으면 테두리가 노랗다 |
| 격자 / 존 | `drop mode` 가 `grid snap` 이면 5열 격자(칸 = 상자 크기), `zone drop` 이면 좌우에 `Zone A`/`Zone B`. 입력을 받지 않는 그림일 뿐이다 — 브라우저 데모의 2·3번 탭 |
| 버튼 1행 (위) | `◀` 이전 렌더 방식 / 가운데 = 현재 렌더 방식(누르면 다음) |
| 버튼 2행 | 입력 방식 순환 / 자동 원운동 켜기·끄기 / 요약(콘솔 출력) / Focus 모드 토글 |
| 버튼 3행 | **스로틀(갱신 주기).** `slower ◀` / `throttle 20Hz = 50ms` / `▶ faster`. 가운데를 눌러도 한 칸 올라간다 |
| 버튼 4행 (아래) | **그 밖의 값.** 왼쪽을 누르면 조절할 항목이 바뀌고, `−` / `+` 로 값을 바꾼다 |

위 글자 첫 줄에는 지금 적용 중인 설정(`settingTag`)이 함께 나온다 — 스로틀이 걸리지 않는
방식에서는 `no throttle` 로 표시되므로, **지금 화면에 보이는 움직임이 어떤 설정의 결과인지**
항상 확인할 수 있다.

상자는 화면 위쪽 70% 안에서만 움직인다 (아래 버튼 4행을 피한다).

화면 문자열은 전부 **영어**다. Horizon 의 Custom UI 글꼴(Anton·Roboto 등)이 라틴 계열이라
한글은 기기에서 깨질 수 있다. 콘솔 로그와 이 문서만 한글이다.

## 입력 경로 (I)

| # | 이름 | 동작 | API | 근거 |
|---|---|---|---|---|
| I0 | FI 절대좌표 | `screenPosition` + 잡은 순간의 오프셋 | `PlayerControls.onFocusedInteractionInput{Started,Moved,Ended}` | 공식 Focused Interaction 가이드 |
| I1 | FI 델타누적 | 직전 좌표와의 차이만 더한다. 가장자리에 막히면 손가락과 어긋난다(누적 방식의 특성) | 위와 같음 | 공식 튜토리얼 Module 7B 의 `dragDelta` |
| I2 | Gestures.onPan | 공식 제스처 헬퍼. `touch.start` 로 잡기 판정, `touch.current` 로 이동, `phase === 'end'` 로 놓기. `touch.current.time` 으로 **이벤트 전달 지연**도 잰다 | `horizon/mobile_gestures` 의 `Gestures.onPan` | 공식 Gestures 문서 |
| I3 | Pressable 격자 | 좌표 없이 투명 Pressable 격자의 `onPress`/`onEnter`/`onRelease` 로 칸 단위 추적 | `Pressable` | 이 프로젝트의 초기 퍼즐 방식. UI 콜백 경로(`customuicallbackinternal`)를 탄다 |

- I2 는 입력 방식을 I2 로 바꿀 때만 `Gestures` 를 만들고, 다른 방식으로 바꾸면 `dispose()` 한다.
  `pan end` 가 오지 않는 경우에 대비해 FI `ended` 후 120 ms 안에 `pan end` 가 없으면 대신 마감하고
  결과 줄에 `pan end 대체 N회` 로 남긴다.
- I3 는 격자가 터치를 소비하므로 FI 스트림이 오지 않는다. Focus 모드와 무관하게 동작한다.
  release 가 유실되면 다음 `onPress` 가 이전 드래그를 마감한다.

## 렌더 경로 (R)

| # | 이름 | 계열 | 무엇을 하는가 | 확인하려는 것 |
|---|---|---|---|---|
| R0 | Binding<string> 즉시 | S | 입력마다 `'12.34%'` 문자열 set | 가장 흔한 예제 방식. 문자열 직렬화 비용 |
| R1 | AnimatedBinding 즉시 | L | 입력마다 숫자 set, `%` 변환은 `interpolate` 로 네이티브에서 | R0 대비 숫자 바인딩의 이득 |
| R2 | 스로틀 + 네이티브 보간 | L | `uiUpdateHz` 간격으로만 `Animation.timing(목표, 간격)` | **현재 FocusDragDemo 방식** |
| R3 | transform 즉시 | T | left/top 대신 `translateX/Y`(px) | 레이아웃 재계산 회피 효과 (RN 권장, Horizon 문서엔 근거 없음) |
| R4 | transform 스로틀 + 보간 | T | R2 를 transform 으로 | R2·R3 의 조합 |
| R5 | onUpdate 프레임당 1회 | L | 입력은 좌표만 기록, `World.onUpdate` 에서 바뀌었으면 1회 set | 게임 루프/rAF 패턴. 문서상 onUpdate 안의 변경은 다음 프레임에 반영(다른 콜백은 최대 2프레임) |
| R6 | onUpdate 지수 스무딩 | L | `x += (목표-x)·(1-e^(-k·dt))` 를 매 프레임 set | 스크립트 보간. set 이 많아진다 |
| R7 | 고정 타이머 flush | L | `async.setInterval(uiUpdateHz)` 로 즉시 set | 입력·프레임과 무관한 고정 주기 |
| R8 | 격자 칸 넘을 때만 | L | `snapStepPercent` 칸을 넘을 때만 60 ms 트윈 | **set 을 극단적으로 줄였을 때도 멈추는가** |
| R9 | 객체 Binding + derive | O | `{x,y}` 한 개를 set, left/top 은 derive 2개 | set 1회가 파생 2개로 퍼질 때의 비용 |
| R10 | 기준선: 갱신 없음 | L | 드래그 중 set 0회, 놓을 때 1회 | **대조군.** 여기서도 멈추면 우리 바인딩과 무관하다 |
| R11 | 스로틀 + 예측 보간 | L | 속도를 추정해 `간격 × 속도` 만큼 앞(최대 `predictLeadPercent`)을 목표로 트윈 | dead reckoning. R2 의 한 간격 지연을 상쇄 |
| R12 | web port: px Binding<number> | P | 브라우저 데모의 `style.left = \`${x}px\`` 를 그대로 — 입력마다 **정수 px** 를 `Binding<number>` 로 set (`_pixelsPerScreenX` 로 환산) | **브라우저와 로직이 완전히 같은 조합**(I0 + R12 + drop free). 여기서도 멈추면 로직이 아니라 파이프라인이다 |

모든 방식에 공통으로:

- 값은 `quantizePercent`(기본 0.1%) 단위로 반올림하고, **축별로 값이 바뀐 경우만 set** 한다
  (공식 가이드 "값이 바뀌었는지 확인한 뒤 set").
- `setOwnerOnly` 를 켜면 모든 set 에 `players = [소유자]` 를 넘긴다 (AnimatedBinding 은 3번째 인자).
- 계열이 바뀔 때만 상자 노드를 `UINode.if` 로 갈아 끼운다. 방식 전환 순간의 set 은 측정에 넣지 않는다.

## 실행 중 조절 (버튼 3·4행)

값은 **미리 정해진 눈금(step)** 을 오르내린다. 임의의 숫자를 입력할 방법은 Custom UI 에 없기 때문이다.
`props` 의 값은 **시작값**일 뿐이고, 가장 가까운 눈금으로 맞춰서 들어온다.

| 항목 (화면 표시) | 눈금 | 무엇에 쓰이나 |
|---|---|---|
| `throttle` | `every input`(제한 없음), 5, 8, 10, 12, 15, 20, 24, 30, 40, 60, 72, 90, 120 Hz | **R2·R4·R7·R11 의 갱신 주기.** `20Hz = 50ms` 처럼 주기도 함께 보여 준다 |
| `R11 predict lead` | 0, 2, 4, 6, 8, 12, 16, 20, 30 % | R11 이 앞질러 보낼 최대 거리 |
| `R6 smooth rate` | 4 ~ 60 /s | R6 의 스무딩 속도 k |
| `R8 snap step` | 1 ~ 20 % | R8 의 칸 크기 |
| `round step` | `off`, 0.05, 0.1, 0.2, 0.5, 1 % | 위치 반올림 단위. 크게 줄수록 set 이 덜 나간다 |
| `owner-only set` | `off` / `on` | 모든 set 에 `players=[소유자]` 를 넘긴다 |
| `drop mode` | `free` / `grid snap` / `zone drop` | **놓을 때 무엇을 하나** (브라우저 데모의 세 탭). `free` = 놓은 자리 그대로. `grid snap` = 가장 가까운 격자 칸 중심으로 200 ms ease-out 트윈. `zone drop` = 상자 **중심**이 존 안이면 존 중심으로, 아니면 **잡은 자리로 되돌아간다** (200 ms 트윈) |

- 값을 바꾸면 **진행 중이던 측정 구간을 먼저 마감**하고(`setting changed`) 새 구간을 시작한다.
  그래서 하나의 구간 기록에는 한 가지 설정만 섞이지 않고 들어간다.
- 바뀐 값은 콘솔에 `[DragLab][setting] throttle = 30Hz = 33ms` 로 한 줄 남는다.
- **누적 요약의 키에 설정이 함께 들어간다** — 예: `I0 FI absolute loc / R2 Throttle + native interp @ 20Hz = 50ms / round 0.1%`.
  같은 방식을 Hz 만 바꿔 가며 여러 번 돌리면 **Hz 별로 줄이 갈려서** 비교된다.
- `throttle` 을 바꾸면 R7 의 타이머는 즉시 새 주기로 다시 걸린다.
- `owner-only set` 을 끄면 플레이어 전용 값이 지워지고 전역 값으로 돌아간다 (`Binding.set` 규약).
- `drop mode` 의 트윈은 **AnimatedBinding 계열(L·T)에서만** 걸린다. S·O·P 계열은 `Animation` 을 받을 수
  없는 일반 `Binding` 이라 놓는 순간 바로 뛴다 — 브라우저의 CSS `transition` 에 해당하는 것이 그쪽에는 없다.
  R6(스크립트 스무딩)은 자기 보간으로 목표까지 간다. 놓은 결과(`snapped to [col 2, row 1]`,
  `landed in Zone A`, `outside: returned to origin`)는 결과 줄과 콘솔에 `drop:` 으로 남는다.

### 브라우저 데모와 같은 조건으로 보기

브라우저 데모(`Documents/SampleHtml/DragModules/`)와 **산술이 완전히 같은 조합**은 다음이다.
차이는 파이프라인뿐이므로, 이 조합에서 멈춤이 나면 로직 탓이 아니다
(`../설계/2026-09-18_브라우저_드래그_데모_대비_CustomUI_파이프라인_비교.md`).

| 데모 탭 | DragLab 설정 |
|---|---|
| 1. 자유 드래그 | I0 + R12 + `drop mode: free` |
| 2. 격자 스냅 | I0 + R12 + `drop mode: grid snap` (트윈을 보려면 R1) |
| 3. 존 드롭 | I0 + R1 + `drop mode: zone drop` (R12 는 트윈 없이 즉시) |

### 스로틀을 보는 순서

1. R2 에서 `throttle` 을 `every input` → 60 → 30 → 20 → 12 → 8 Hz 로 내리며 각각 5초씩 끌어 본다.
2. 각 구간의 `set N/s` 와 `최대공백` 을 본다. **set 이 줄어드는데도 멈춤이 그대로면** 원인은 set 빈도가 아니다.
3. 멈춤이 사라지는 Hz 가 있으면 그 값이 이 기기의 한계선이다. 공식 기준(프레임당 set 10회, 72 fps 기준
   초당 720회)과 비교한다 — 우리 상자는 축 2개라 한 번 갱신에 set 이 최대 2회 나간다.

## 계측

| 항목 | 뜻 |
|---|---|
| `input N/s` | 받아들인 입력(또는 자동 원운동 프레임) 수. FI 입력이면 `raw` 로 거르기 전 콜백 수도 나온다 |
| `set N/s` | 우리가 부른 `set()` 횟수 (잡기·놓기 테두리 포함). R9 는 set 1회가 파생 2개로 전송될 수 있다 |
| 최대공백 `input` | 입력 콜백 사이의 최대 간격 |
| 최대공백 `vm` | 50 ms 타이머 콜백 사이의 최대 간격 — JS VM 정지(GC 등) |
| 최대공백 `frame` | `World.onUpdate` 콜백 사이의 최대 간격. onUpdate 를 쓰는 R5·R6·자동 원운동, 또는 `probeFrameGaps` 일 때만 |
| 정지 `a/b/c` | 위 세 공백이 `stallGapMs`(기본 100)를 넘은 횟수. 넘을 때마다 `[DragLab][input|VM|frame] gap` 한 줄도 남는다 |
| 최대지연 | I2 에서만. 터치 발생 시각(`touch.current.time`)과 스크립트가 받은 시각의 차 |

드래그를 놓을 때(또는 자동 원운동이면 `autoWindowSeconds` 마다) 콘솔에 한 줄, 화면 위에 요약 2줄이
나온다. **요약** 버튼은 지금까지의 조합별 누적(최악값)을 콘솔에 표로 찍는다.

## 권장 절차

1. **자동 원운동으로 렌더 경로만 먼저 본다.** 입력 흔들림이 없으므로 R0~R11 을 차례로 넘기며 각각
   10초 정도 둔다. 자동 원운동은 `World.onUpdate` 로 매 프레임 목표를 만든다.
2. 같은 순서를 **손가락(I0)** 으로 반복한다. 가능하면 같은 궤적(원 그리기)으로 5초씩.
3. 가장 나쁜/좋은 조합에서 입력만 I1·I2·I3 로 바꿔 본다.
4. **요약** 을 눌러 콘솔을 저장한다. 필요하면 Perfetto 로 5초 구간의 `CustomUI::UpdateBinding::Send`
   횟수 ÷ 360 을 같이 본다 (CPU 가이드 분석 문서 §3.4).

## 판정표

| 관찰 | 결론 |
|---|---|
| R10(갱신 없음)에서도 펄스 막대가 주기적으로 멈춘다 | **플랫폼/기기 렌더 히칭.** 우리 로직과 무관 |
| R10 에서 `[VM] gap` 이 주기적으로 찍힌다 | JS VM 정지(GC 등). 드래그 중 할당(객체·문자열 생성)을 줄일 곳을 찾는다 |
| R10 에서 `[input] gap` 만 찍힌다 | 입력 스트림 자체가 끊긴다. 입력 경로(I0~I3)를 바꿔 비교한다 |
| R10 은 깨끗한데 R0/R1(즉시)에서만 멈춘다, 펄스는 계속 움직인다 | **바인딩 갱신 큐 밀림.** set 빈도가 원인 → R2/R4/R8/R11 중 멈춤이 없는 것으로 간다 |
| R0 만 나쁘고 R1 은 괜찮다 | 문자열 바인딩 비용. 숫자 AnimatedBinding + interpolate 로 |
| R1 은 나쁘고 R3 은 괜찮다 | 레이아웃(left/top) 재계산 비용. transform 으로 |
| R8(set 최소)에서도 멈춘다, R10 은 깨끗하다 | set 횟수가 아니라 set 1회의 비용(패널 키-값 저장소 크기) 쪽. 이 패널은 키가 적으므로 실제 퍼즐 패널에서 키 수를 줄여야 한다 |
| 모든 R 에서 비슷하게 멈춘다 | CustomUI/기기 쪽 한계 |
| I2 의 `최대지연` 이 멈춤 시점에 커진다 | 입력 이벤트가 늦게 도착한다 (VM 이 바빴거나 입력 큐 밀림) |

## Props

아래 일곱 개(`uiUpdateHz`, `predictLeadPercent`, `snapStepPercent`, `lerpPerSecond`,
`quantizePercent`, `setOwnerOnly`, `startDropMode`)는 **시작값일 뿐이고 실행 중에 화면에서 바꾼다** (위 "실행 중 조절").
나머지는 에디터에서만 바꿀 수 있다.

| prop | 기본 | 뜻 |
|---|---|---|
| `startInputMode` | 0 | 시작 입력 방식 (0~3 = I0~I3) |
| `startRenderMode` | 2 | 시작 렌더 방식 (0~11 = R0~R11) |
| `itemSizePercent` | 18 | 상자 한 변 (화면 가로 대비 %) |
| `enterFocusOnStart` | true | 시작 시 Focused Interaction 진입 |
| `screenPositionYIsTopDown` | false | `screenPosition.y` 가 위가 0 인 기기면 켠다 (이 프로젝트 기기는 아래가 0) |
| `uiUpdateHz` | 20 | R2·R4·R7·R11 의 갱신 주기. **화면 3행에서 조절한다** (여기 값은 시작값) |
| `predictLeadPercent` | 8 | R11 이 앞질러 보낼 수 있는 최대 거리 (화면 %). **화면 4행에서 조절** |
| `snapStepPercent` | 4 | R8 의 칸 크기 (%). **화면 4행에서 조절** |
| `lerpPerSecond` | 18 | R6 의 스무딩 속도 k. **화면 4행에서 조절** |
| `quantizePercent` | 0.1 | 위치 반올림 단위 (%). 0 이면 반올림하지 않는다. **화면 4행에서 조절** |
| `setOwnerOnly` | false | 모든 set 에 `players=[소유자]`. **화면 4행에서 조절** |
| `startDropMode` | 0 | 시작 놓기 방식 (0 free / 1 grid snap / 2 zone drop). **화면 4행에서 조절** |
| `gridColumns` / `gridRows` | 8 / 12 | I3 격자 (상한 10 / 14 — 패널 트리 64 kB 한도 때문) |
| `autoPeriodSeconds` | 3 | 자동 원운동 한 바퀴 시간 |
| `autoRadiusPercent` | 25 | 자동 원운동 반지름 (화면 가로 %) |
| `autoWindowSeconds` | 5 | 자동 원운동 결과를 끊어 찍는 간격 |
| `showNativePulse` | true | 네이티브 펄스 막대 |
| `logStallGaps` | true | 공백이 기준을 넘을 때마다 콘솔 한 줄 |
| `stallGapMs` | 100 | 정지로 보는 공백 (ms) |
| `probeFrameGaps` | false | 모든 방식에서 `World.onUpdate` 로 프레임 공백을 잰다 (onUpdate 구독 자체가 부하가 되므로 기본 꺼짐) |
| `screenPixelRatio` | 2 | 읽기값→패널 좌표 배율. **T 계열(transform px) 이동량과 글자 크기에만** 쓴다 |
| `hudFontSize` | 14 | 글자 크기 기준 (× `screenPixelRatio`) |
| `drawBackdrop` | true | 어두운 배경 |
| `canvasWidth` / `canvasHeight` | 0 / 0 | 캔버스 크기 직접 지정 (0 이면 화면에서 읽는다) |

## 주의

- **T 계열은 px 로 옮긴다.** `translateX` 에 상대 단위가 없어서 `화면 비율 × 읽기값 × screenPixelRatio`
  로 환산한다. 상자가 손가락보다 빠르거나 느리게 움직이면 `screenPixelRatio` 가 그 기기에 맞지 않는
  것이다 (재는 법: 스크린샷 실제 가로 px ÷ 시작 로그의 읽기값 가로). 부드러움 비교에는 지장이 없다.
- 계측 자체도 비용이다. `console.log` 는 한 줄마다 브릿지를 건넌다 — 그래서 공백이 기준을 넘을 때와
  드래그를 놓을 때만 찍는다. 공백이 아주 잦은 기기에서는 `logStallGaps` 를 끄고 놓을 때의 결과 줄만 본다.
- 자동 원운동과 R5·R6 은 `World.onUpdate` 를 구독한다. 필요 없는 방식으로 넘어가면 구독을 끊는다.
- 방식을 바꾸면 진행 중인 드래그/자동 구간을 먼저 마감해 기록한다.
- **`dispose()` 가 있다** (2026-09-18). 소유권이 넘어가거나 플레이어가 나가면 런타임이 이 패널을
  내렸다가 `start()` 를 다시 부른다 (`../설계/Horizon_실행모드_제약과_규칙.md` §2.1). `connect*`
  구독과 `async` 타이머는 런타임이 스스로 끊지만 `Gestures` · Focused Interaction 모드 · 펄스의
  `Animation.repeat` 는 끊어 주지 않으므로 여기서 되돌린다. 포커스 모드를 켠 채로 내려가면
  플레이어가 고정 화면에 갇힌다. 정지 감지 타이머는 `_stallTimerId` 에 담아 두고 지운다.

## 참고한 자료

- Custom UI optimization (set ≤ 10/frame 로컬, 콜백 ≤ 1/2frame, "주기적 set 애니메이션은 조심하거나 쓰지 말 것", "set 1회가 키-값 저장소 전체를 넘긴다"):
  https://developers.meta.com/horizon-worlds/learn/documentation/performance-best-practices-and-tooling/performance-best-practices/custom-ui-optimization/
- Animations for Custom UI (애니메이션은 직렬화되어 렌더 쪽이 스크립트 없이 재생):
  https://developers.meta.com/horizon-worlds/learn/documentation/desktop-editor/custom-ui/animations-for-custom-ui
- Focused Interaction: https://developers.meta.com/horizon-worlds/learn/documentation/create-for-web-and-mobile/typescript-apis-for-mobile/focused-interaction/
- Gestures: https://developers.meta.com/horizon-worlds/learn/documentation/create-for-web-and-mobile/typescript-apis-for-mobile/gestures/
- 튜토리얼 Module 7B (드래그 델타): https://developers.meta.com/horizon-worlds/documentation/desktop-editor/tutorial-worlds/feature-samples/developing-for-web-and-mobile-players-tutorial/module-7b-use-drag-inputs-to-rotate-objects
- Local mode Custom UI: https://developers.meta.com/horizon-worlds/learn/documentation/desktop-editor/custom-ui/local-mode-custom-ui-scripts/
- Meta 공식 샘플 (변경분만·반올림·프레임당 상한 flush, 스로틀러): https://github.com/meta-quest/meta-horizon-worlds-sample-scripts (`OURO_Engine_Code/UtilsUI.ts`, `FrameDistributor.ts`, `Chop_N_Pop/Throttler.ts`)
- 포럼 "Laggy inputs" (입력을 NetworkEvent 로 중계하면 ~250 ms): https://communityforums.atmeta.com/discussions/Creator_Discussion/laggy-inputs-in-horizon-worlds/1346965

공식 문서·커뮤니티 어디에서도 **Custom UI 안의 요소를 드래그하는 완성 예제는 찾지 못했다.**
위 표의 방식은 문서화된 API 와 공식 샘플의 기법, 일반적인 게임/React Native 드래그 기법을 조합한 것이다.
