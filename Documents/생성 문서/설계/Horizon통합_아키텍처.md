# 설계 — Horizon 통합 아키텍처 (브리지 · CoreAPI · 메인 UI)

> 대상: `Puzzle_HorizonBridge.ts`, `*_CoreAPI.ts`, `PuzzleUI_*`
> 목적: 순수 로직을 실제 월드에서 돌리는 **표현 계층**의 구조와 확장 방법
> 관련 문서: `../가이드/에디터_퍼즐_셋업.md` (에디터 절차), `2026-09-02_퍼즐_시작흐름과_게임플로우_제안.md` (호출 흐름),
> `2026-09-02_멀티플레이_플랫폼에서_싱글플레이_구현_방안.md` (플레이어별 보드),
> `../구현 사항/작업기록_2026-09-02_보드_CustomUI_전환.md` (3D 보드 → Custom UI 전환 이력)

> **보드는 Custom UI 로 그린다 (2026-09-02~).** 아래 [2]·[3] 이 그때 바뀌었다.
> 3D 오브젝트 배치·틴트와 터치 ray 변환은 더 이상 쓰지 않는다. 자세한 내용은 §1.7.

---

# 1. 실제 월드에서 실행하기

순수 로직은 `horizon/core` 를 전혀 모르므로, 그것만으로는 게임이 돌지 않는다.
**Horizon `Component` 를 하나 붙여 3가지를 연결하면 그때부터 실제로 플레이된다.**

```
[1] 프레임 구동   World.onUpdate  ->  session.update(deltaTime)
[2] 입력          Custom UI Pressable  ->  칸 번호  ->  session 의 입력 진입점
[3] 연출          session 이벤트       ->  보드 프레젠터의 칸 패치  ->  Custom UI Binding
```

셋 중 **[1]을 빠뜨리는 것이 가장 흔한 실수**다. 제한 시간이 흐르지 않고,
슬라이드의 0.25초 이동·스위치의 0.4초 누름·카드의 폭탄 셔플이 영원히 끝나지 않아
"눌러도 아무 반응이 없는" 상태가 된다.

## 1.1 공통 브리지 — `Puzzle_HorizonBridge.ts`

8개 퍼즐이 공유한다. 퍼즐마다 다시 만들지 않는다.

| 클래스 / 함수 | 역할 |
|---|---|
| `PuzzleBoardMapper` | 격자 좌표 ↔ 월드 좌표. `getGridFromRay()` 가 터치 ray 를 **연속 격자 좌표**로 바꾼다 |
| `PuzzleTouchRouter` | `Basics_Input_Screen` 의 터치를 받아 격자 좌표로 변환해 콜백. **단일 터치 강제** (PUZ_00 §8.1) |
| `connectPuzzleUpdate()` | `World.onUpdate` 에 세션의 `update(dt)` 를 건다 |
| `enterPuzzleInteraction()` | Focused Interaction 진입 + 카메라 자동 배치. **없으면 터치가 오지 않는다** |
| `collectChildEntities()` | 루트 엔티티의 자식을 이름순으로 모은다. 격자 오브젝트를 하나씩 연결하지 않아도 된다 |

> **지금 쓰이는 것은 `connectPuzzleUpdate()` 와 `enterPuzzleInteraction()` 둘뿐이다.**
> 보드가 Custom UI 가 되면서 `PuzzleBoardMapper` / `PuzzleTouchRouter` / `collectChildEntities()`
> 는 호출자가 없어졌다. 3D 표현이 필요한 퍼즐이 생길 때를 위해 남겨 두었고,
> 아래 §1.1 의 평면 교차 설명도 그때를 위한 기록이다.

**콜라이더 레이캐스트가 아니라 보드 평면과의 교차를 쓴다.** PUZ_00 §8.4 가
"포인터가 영역 밖으로 나가도 드래그 입력은 유지된다" 를 요구하는데, 타일 콜라이더에
레이캐스트하면 보드 밖을 가리키는 순간 히트가 사라져 이 규칙을 지킬 수 없다.
평면 교차는 보드 밖이든 칸 사이든 항상 좌표를 돌려준다.
드래그 컨트롤러들이 요구하는 **소수 좌표**(예: `col + 0.6`)도 이 방식이라야 나온다.

> 이 선택은 멀티플레이 구조에서도 이점이 된다 — 플레이어별 보드를 같은 자리에 겹쳐 놓아도
> 서로의 입력을 가로채지 않는다. `2026-09-02_멀티플레이_플랫폼에서_싱글플레이_구현_방안.md` §1.4 참조.

좌표 규약은 보드 중심 엔티티의 축을 그대로 쓴다.

```
right = +col 방향 / up = -row 방향 (row 0 이 위) / forward = 평면의 법선
```

## 1.2 레퍼런스 구현 — `Switch_CoreAPI.ts`

PUZ_08 을 실제로 구동하는 완성된 컴포넌트다. 탭 전용이라 구조가 가장 짧아 템플릿으로 삼는다.

월드에 붙이는 구체적 절차와 props 값은 `../가이드/에디터_퍼즐_셋업.md` 를 본다.
여기서는 **왜 그렇게 붙이는지**만 정리한다.

| 요구 | 이유 |
|---|---|
| 실행 모드 **Local** | 플레이어마다 자기 세션·자기 UI 를 돌려야 한다 |
| `Puzzle_LocalOwnership` 의 `targets` 에 등록 | Local 스크립트는 소유자가 지정되어야 실행된다 |
| 같은 월드에 `PuzzleBoardUI_Panel` 이 붙은 Custom UI gizmo 필요 | 보드를 그리는 곳이자 입력이 나오는 곳 |
| `focusCamera` 는 기본 꺼짐 | Custom UI 입력에는 Focused Interaction 이 필요 없다 |
| `boardCentre` 선택 | `focusCamera` 를 켰을 때 카메라가 바라볼 대상 |

`autoStart` 를 끄면 시작을 메뉴에 맡긴다. 퍼즐 트리거에서 직접 시작하려면
`SwitchCoreAPI.instance?.startQuestByDifficulty(n)` 을 호출한다.

## 1.3 8종의 입력 배선

`Switch_CoreAPI.ts` 를 복제하고 **입력 배선만** 퍼즐 성격에 맞게 바꾼다. 나머지는 동일하다.
§2.2 의 허브 등록 블록과 §3 의 dispose / 포커스 수명주기도 함께 복제한다.

> **8종 모두 작성이 끝났다** (2026-09-02). 아래는 그 배선의 요약이고,
> 퍼즐별로 왜 그렇게 얹었는지는
> `../구현 사항/작업기록_2026-09-02_나머지7종_CoreAPI_구현.md` §2 에 있다.

**탭 퍼즐** (슬라이드 / 카드 맞추기) — 가장 단순하다.

```ts
{ onCellTap: (cell) => { session.pressPiece(cell); } }
```

**드래그 퍼즐** (러시아워 / 레이저 / 연결) — down/move/up 을 그대로 넘긴다.
칸 밖으로 나가면 `PUZZLE_BOARD_CELL_OUTSIDE`(-1) 가 온다.

```ts
{
    onCellDown: (cell) => session.beginDrag(cell),
    onCellMove: (cell) => session.updateDrag(cell),   // -1 = 보드 밖
    onCellUp:   ()     => session.endDrag(),
}
```

> **소수 좌표가 사라졌다.** Custom UI 는 칸 단위로만 입력을 준다. 각 드래그 컨트롤러가
> `(row, col)` 소수를 요구하면 칸 중심 좌표(`cell / colCount`, `cell % colCount`)를 넣는다.
> 칸 안에서의 미세한 위치가 판정에 필요한 퍼즐이 있다면 그 퍼즐만 3D 표현으로 남기거나
> 칸을 더 잘게 쪼갠 격자로 그린다 — `../구현 사항/작업기록_2026-09-02_보드_CustomUI_전환.md` §6.3.
>
> 정렬 퍼즐은 케이스 인덱스를 받으므로 **열 하나 = 케이스 하나**로 얹는다.
> 연결 퍼즐은 칸을 건너뛴 입력을 거절하므로, 어댑터가 이전 칸과 새 칸 사이를 **보간**해
> 중간 칸을 순서대로 호출해야 한다 (PUZ_05 문서 M3). 이 보간은 Custom UI 에서 더 중요하다 —
> 빠른 스와이프는 중간 칸의 `onEnter` 를 건너뛸 수 있다.

**색 채우기**는 격자가 없다. 전용 UI 를 만드는 대신 **5행 × 6열 격자의 테두리 18칸**을
다이얼로 썼다 (테두리 칸 수 `2 × (5 + 6) - 4` 가 다이얼 칸 수 18 과 정확히 같다).
어느 칸을 눌러도 결과가 같으므로 `onCellTap` 에서 칸 번호를 버리고 `session.touch()` 만 부른다.

**러시아워는 테두리 링까지 그린다.** 결합(§9)이 슬롯 쪽으로 더 끌기인데 보이지 않는 칸은
눌리지 않으므로, 링을 감추면 USB 를 꽂을 수 없다. **레이저는 인벤토리를 본 격자의 마지막 열**에
둔다 — 보조 격자(`side`)는 표시 전용이라 누를 수 없기 때문이다.

## 1.4 연출 붙이기

각 `*_GameEvents.ts` 를 구독한다. 로직 클래스를 직접 참조하지 않는다.
예를 들어 스위치는 기획서 §7 연출 타이밍이 이벤트로 그대로 나온다.

```
KEY_PRESSED(0.0초)  ->  AREA_TOGGLED(0.2초)  ->  PRESS_SEQUENCE_FINISHED(0.4초)
```

## 1.5 보드 표현 — Custom UI 계층 (`PuzzleBoardUI_*`)

8개 퍼즐이 전부 2D 격자이므로 보드를 3D 오브젝트가 아니라 Custom UI 패널에 그린다.
결정 근거는 `2026-09-02_멀티플레이_플랫폼에서_싱글플레이_구현_방안.md` §3.2 다.

| 파일 | 계층 | 역할 |
|---|---|---|
| `PuzzleBoardUI_Definitions.ts` | 순수 | 칸/격자 스냅샷 타입, 색(RGB), 최대 격자(9×9), 규격 검증 |
| `PuzzleBoardUI_Presenter.ts` | 순수 | 보드 상태 보관 + 입력 정규화 + `PuzzleBoardStage`(마운트 지점) |
| `PuzzleBoardUI_Panel.ts` | 표현 | `UIComponent`. 격자를 그리고 `Pressable` 입력을 프레젠터에 넘긴다 |

```
CoreAPI  --setCell()-->  Presenter  --CELL_CHANGED-->  Panel(Binding)
CoreAPI  <--onCellUp--   Presenter  <--pointerUp()---  Panel(Pressable)
```

**패널은 퍼즐을 모른다.** CoreAPI 가 `PuzzleBoardStage.instance.mount(presenter)` 를 부르면
그 보드를 그리고, `unmount()` 하면 내린다. 한 번에 하나만 올라간다 (메인 UI 가 퍼즐 하나만
돌리므로 충분하다).

세 가지 규칙이 프레젠터에 있다. 3D 시절 `PuzzleTouchRouter` 가 하던 것과 같다.

| 규칙 | 근거 |
|---|---|
| 단일 터치 강제 — 진행 중 다른 칸의 down 은 무시 | PUZ_00 §8.1 |
| 누른 칸 밖에서 떼면 확정되지 않음 | PUZ_08 M2 |
| 보이지 않는 칸은 누를 수 없고, 그 칸에 들어가면 보드 밖 취급 | PUZ_08 §4 (FREE 좌표) |

**enter/exit 순서를 신뢰하지 않는다.** 칸 A→B 이동 시 UI 가 내는 `onExit(A)` 와 `onEnter(B)` 의
순서가 보장되지 않으므로, `pointerExit(cell)` 은 **지금 올라가 있는 칸이 그 칸일 때만**
밖으로 처리한다. 두 순서 모두 검증했다.

## 1.6 기존 승패 흐름에 얹기 (선택)

`*_ObjectiveValidator.ts` 로 `IObjectiveValidator`(`Basics_Definitions.ts`)를 구현해
`Basics_ObjectiveManager` 에 등록하면 기존 팡파레·포스트게임 흐름을 재사용할 수 있다.
매치3 개념 위에 얹혀 있으므로 필수는 아니다 — 퍼즐 세션의 `QUEST_CLEAR` / `QUEST_FAILED` 를
직접 구독해도 된다.

## 1.7 브리지 검증 결과

`horizon/core` / `horizon/camera` 런타임 스텁을 만들어 Node 에서 실측했다.
Horizon Component 자체는 검증할 수 없지만, **좌표 계산과 배선 로직은 전부 순수 함수**라 검증 가능하다.

| 대상 | 결과 | 검증 항목 |
|---|---|---|
| 좌표 변환 | **12 PASS** | 격자↔월드 왕복 일치(축정렬 및 **회전된 보드**), ray→격자 정확도, 보드 밖에서도 좌표가 나오는지(§8.4), 평행·역방향 ray 거절 |
| 터치 통합 | **11 PASS** | 화면 터치 ray 만으로 D1~D5 전 난이도 클리어, 두 번째 손가락 무시(§8.1), 밖에서 떼면 취소되는 부분 누름(M2), `update()` 미배선 시 연출이 안 끝나 입력이 막히는 것 |
| 카메라 자동 배치 | **4 PASS** | 보드-카메라 거리, 카메라가 보드 **앞쪽**에 있는지, 시선이 보드 중심을 향하는지, 부호 반전 대조군 |
| 자식 수집 | **7 PASS** | 이름 오름차순 정렬, 25개 row-major, **자리수 미맞춤 시 순서가 깨지는 것**(경고의 근거), 정렬 끄기, 루트 미지정, 개수 불일치 경고, 원본 배열 미변형 |

> 회전된 보드로 검증하는 것이 중요하다. 축정렬 보드만 쓰면 `up` 부호 실수를 놓친다.

---

# 2. 메인 UI (퍼즐 허브) — `PuzzleUI_*`

8개 퍼즐을 고르고(난이도 포함), 플레이 중 HUD 를 띄우고, 승패 결과를 보여 주는 메인 UI.
기존 매치3 UI(`UI_MainMenu` 등)는 매치3 CoreAPI 4종에 강결합이라 재사용하지 않고
**신규 `PuzzleUI_` 레이어**로 만들었다. `Basics_*`/`UI_*` 는 여전히 한 줄도 수정하지 않았다.

## 2.1 구조 (로직·표현 분리 그대로)

```
PuzzleUI_Definitions.ts   카탈로그(8종 이름·부제)·화면 enum·뷰 타입·시계 라벨   ← 순수
PuzzleUI_Registry.ts      IPuzzleGameHandle + createPuzzleHandle() + 레지스트리  ← 순수
PuzzleUI_Model.ts         화면 상태 머신 (모든 전이 규칙이 여기에만 있다)        ← 순수
PuzzleUI_Tests.ts         54건 검증 하네스                                       ← 순수
PuzzleUI_MainPanel.ts     horizon/ui UIComponent — Binding·Pressable 배선만      ← 표현
```

화면 흐름:

```
MAIN_MENU(퍼즐 8칸 격자, 2열×4행) → PUZZLE_DETAIL → IN_GAME(상단 HUD만) ⇄ PAUSED
        ▲                          │(Start/Continue)      │(퀘스트 종료 이벤트)
        │                          │                      │
        └── quitToMenu ────────────┴─ RESULT(다음 레벨/재도전/메뉴로) ──┘
```

`PUZZLE_DETAIL` 은 고른 퍼즐이 화면을 꽉 채운 화면이고, **Start / Continue / Return**
세 버튼만 세로로 놓는다. Start 는 1레벨, Continue 는 마지막으로 클리어한 레벨의 다음이다
(`../구현 사항/작업기록_2026-09-02_메인UI_레벨진행_전환.md`).

- 미등록 퍼즐(CoreAPI 미구현)은 메인 메뉴에 어둡게 + "준비 중" 으로 표시되고 눌러도 토스트만 뜬다.
- 인게임에서는 **상단 바(일시정지·퍼즐명·남은 시간·라운드)만** 그려 보드와 손가락을 가리지 않는다 (PUZ_00 §8.5).
- 레벨 생성 실패로 시작 즉시 `QUEST_FAILED` 가 동기 발행되는 경로도 결과 화면으로 수렴한다.
- 버튼은 화면 폭 40%+ / 세로 8%+ 로 잡아 엄지 조작에 넉넉하다.

## 2.2 CoreAPI ↔ 메인 UI 의 접점 — 정규화 핸들

8개 퍼즐의 세션·이벤트 허브가 이미 같은 규약(`../구현 사항/퍼즐_구현_현황.md` §2.1)이라, 메인 UI 는
퍼즐별 타입을 모른 채 **구조적 타이핑**으로 전부 받는다. 퍼즐별 어댑터 코드가 없다.

```ts
// 각 *_CoreAPI 의 constructSystems() 에 이 블록만 추가하면 메뉴에 나타난다 (Switch_CoreAPI 참조)
PuzzleHubRegistry.instance.register(createPuzzleHandle(
    EPuzzleId.SWITCH,                                      // ← 퍼즐 id 만 바꾼다
    {
        startQuestByDifficulty: (d) => this.startQuestByDifficulty(d),
        pause: () => this.pause(),
        resume: () => this.resume(),
        abort: () => this.abort(),
        getRemainingTimeSeconds: () => this.session.getRemainingTimeSeconds(),
        getRoundProgress: () => this.session.getRoundProgress(),
    },
    this.events,                                           // TIME_CHANGED 등은 구조적으로 호환
    probePuzzleDifficulties((d) => this.tables.getQuestByDifficulty(d)),
));
```

- `QUEST_CLEAR`/`QUEST_FAILED` 페이로드는 퍼즐마다 다르지만 전부
  `{roundsCleared, roundCount, remainingTimeSeconds}` 를 포함하므로 그 부분만 읽어 승패를 정규화한다.
- 핸들의 `abort()` 는 CoreAPI 의 `abort()` 로 배선한다 — 세션 정리에 더해
  **Focused Interaction 해제(§3)** 까지 한 경로로 묶인다.

## 2.3 월드에 붙이는 법

1. **Custom UI gizmo** 를 만들어 `PuzzleUI_MainPanel` 을 붙이고 Display Mode 를 **Screen Overlay** 로 둔다.
2. 실행 모드 **Local** + `Puzzle_LocalOwnership` 의 `targets` 에 추가
   (`../가이드/에디터_퍼즐_셋업.md` §1.2 와 동일한 이유).
3. 각 퍼즐 `*_CoreAPI` 의 **`autoStart` 를 끈다** — 시작은 메뉴가 한다.
   (autoStart 를 켠 단독 구동 모드도 그대로 동작한다. 그때 메뉴는 쓰지 않는다.)
4. CoreAPI 가 §2.2 블록으로 핸들을 등록하면 해당 퍼즐이 메뉴에서 "준비 중" 이 풀린다.
   등록 순서는 무관하다 (패널이 늦게 떠도 초기 카탈로그를 다시 읽고, CoreAPI 가 늦으면
   `HANDLE_REGISTERED` 이벤트로 갱신된다).

## 2.4 검증 (54 PASS)

- 시계 라벨·카탈로그 무결성·난이도 탐침 / 핸들 팩토리의 승패 매핑·구독 해제 / 레지스트리 등록·교체
- 모델 전 화면 전이 + 잘못된 화면에서의 액션 거절(가드) + 미등록 퍼즐 잠금
- 시작 실패 2경로: 이벤트 없는 거절(난이도 화면 유지 + START_FAILED) / 동기 QUEST_FAILED(결과 화면 수렴)
- **실제 SwitchSession 통합**: GF(2) 솔버가 시키는 대로 눌러 실제 클리어 → 승리 결과,
  재도전 → 시간 초과 → 패배 결과, 메뉴 복귀 → 세션 IDLE 확인

---

# 3. 포커스·카메라 수명주기 (선택 기능)

> **보드가 Custom UI 가 된 뒤로 이 절은 선택 사항이다.** 터치 입력에 Focused Interaction 이
> 필요 없어졌기 때문에 `Switch_CoreAPI` 의 `focusCamera` 는 기본 꺼짐이다.
> **켰다면** 아래 규칙을 그대로 지켜야 한다.

**이 절의 규칙을 어기면 플레이어가 고정 카메라에 영구히 갇힌다.**
`enterPuzzleInteraction()` 이 탈출 버튼을 숨기기 때문이다 (`disableFocusExitButton: true`).

```
메뉴/난이도/결과 화면   → 포커스 밖 (아바타 카메라, 화면은 오버레이가 덮음)
퀘스트 시작             → CoreAPI.enterInteraction() — 고정 카메라 + Focused Interaction
그만두기/메뉴로         → model.quitToMenu() → handle.abort() → CoreAPI.releaseInteraction()
```

결과 화면에서 "다시 도전" 은 포커스를 유지한 채 같은 난이도로 재시작한다 (재진입 없음).

**8종 CoreAPI 가 모두 지키는 것** (새 퍼즐을 추가할 때도 그대로 따른다)

| 항목 | 내용 |
|---|---|
| 포커스 진입 시점 | `start()` 가 아니라 **퀘스트 시작 시점**(`enterInteraction()`). 시작 전에는 메뉴를 써야 한다 |
| 해제 경로 | `abort()` → `releaseInteraction()` → `exitPuzzleInteraction()` (3인칭 카메라·FOV 복원 포함) |
| `dispose()` 오버라이드 | `PuzzleBoardStage.unmount()` + 포커스 해제 + 정적 `instance` 클리어. 보드를 내리지 않으면 죽은 세션의 판이 화면에 남는다 |
| 멱등성 | `_isInteractionActive` 가드로 중복 진입·중복 해제를 막는다 |

---

## 4. 어댑터 작성 시 지킬 인터랙션 규약

- **NaN 은 더 이상 나오지 않는다** — 칸 번호가 정수이거나 `PUZZLE_BOARD_CELL_OUTSIDE`(-1) 뿐이다.
  3D 표현을 쓰는 어댑터를 새로 쓴다면 예전 규격(① onEnd 콜백이 좌표를 쓰지 않는다,
  ② 컨트롤러의 `end()` 가 좌표 인자를 받지 않는다)을 그대로 지킨다.
- **연결(Flow) 어댑터는 셀 경계 보간 필수** — 빠른 스와이프로 칸을 건너뛰면
  로직이 거절하므로, 어댑터가 중간 칸을 순서대로 `moveTo()` 해야 한다.
- **카드 맞추기는 모바일 입력 계층이 없다** — 프레젠터의 `onCellTap` 이 단일 터치와
  정수 칸 번호를 함께 보장하므로 그것만 `revealTile()` 에 넘긴다 (`revealTileAt` 은 정수 전제).
- 연결(Flow)의 begin 히트박스는 정확한 셀 반올림(0.5칸)뿐이다. 러시아워·레이저처럼 0.75칸
  최근접 보정을 원하면 어댑터에서 주변 셀을 함께 검사한다.
- 빈 영역을 먼저 짚은 손가락이 라우터를 선점한다(설계상 단일 터치). 체감 문제가 되면
  onBegin 거절 시 라우터 점유를 풀어 주는 개선을 검토한다.
