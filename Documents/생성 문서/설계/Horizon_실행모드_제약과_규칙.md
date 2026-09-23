# 설계 — Horizon 실행 모드(Local / Default) 제약과 지켜야 할 규칙

> 대상: 실행 모드가 **Local** 인 모든 스크립트 (`*_CoreAPI`, `PuzzleBoardUI_Panel`, `PuzzleUI_MainPanel`,
> 실험용 `DragLab_Panel` · `FocusDragDemo_Panel`) 와 그 짝인 서버 스크립트
> (`Puzzle_LocalOwnership`, `Puzzle_ProgressServer`)
> 목적: **플랫폼이 막아 놓은 것**과 그것을 우회하는 배선 규칙을 한곳에 모은다.
> 출처: Meta Horizon Worlds 공식 문서 "Local scripting mode" 의 주의사항 + 이 프로젝트의 실측 이력
> + Meta 강연 "Create Performant Custom UIs" (§7 의 Custom UI 한도)
> 관련 문서: `Horizon통합_아키텍처.md` (구조), `../가이드/에디터_퍼즐_셋업.md` §1.1 (붙이는 절차),
> `2026-09-18_Meta_강연_Create_Performant_Custom_UIs_정리.md` (§7 한도의 근거가 되는 내부 구조),
> `../구현 사항/작업기록_2026-09-02_재입장과_시스템메뉴.md` (소유권 전환 후 정리),
> `../구현 사항/작업기록_2026-09-18_실행모드_제약_점검과_적용.md` (§8 체크리스트를 전 스크립트에 대조한 기록),
> `../가이드/타입체크와_테스트_실행.md` §3.1 (에디터가 파일을 지우는 문제)

> **이 문서는 "왜 안 되는지" 가 아니라 "무엇이 금지인지" 를 적는다.**
> 구조 설명은 `Horizon통합_아키텍처.md` 에 있고, 여기 있는 것은 어기면 인월드에서
> 조용히 깨지는 항목들이다. 새 스크립트를 Local 로 두기 전에 §8 체크리스트를 먼저 본다.

---

## 1. 로컬 실행은 "소유권" 을 따라간다

실행 모드를 Local 로 두었다고 바로 클라이언트에서 도는 것이 아니다. **엔티티의 소유권이
플레이어에게 넘어간 순간부터** 그 플레이어의 기기에서 돈다. 소유권이 바뀌는 경우는 넷이다.

| 계기 | 이 프로젝트에서 쓰는가 |
|---|---|
| 스크립트가 CodeBlock 이벤트로 소유권을 넘긴다 | **쓴다** — `Puzzle_LocalOwnership` 이 `entity.owner.set(player)` |
| 플레이어가 엔티티를 잡는다(grab) | 안 쓴다 (보드가 Custom UI 라 잡을 것이 없다) |
| 엔티티가 플레이어와 충돌한다 | 안 쓴다 |
| 엔티티가 그 플레이어에게 로컬로 도는 다른 엔티티와 충돌한다 | 안 쓴다 |

**월드가 처음 로드될 때는 Local 스크립트도 서버에서 먼저 돈다.** 그 뒤 소유권이 넘어가면서
클라이언트로 옮겨 간다. 그래서 모든 Local 컴포넌트는 진입점에서 서버 인스턴스를 가려낸다.

```ts
// Switch_CoreAPI.start() / PuzzleBoardUI_Panel.initializeUI() / PuzzleUI_MainPanel.initializeUI()
if (this.entity.owner.get() === this.world.getServerPlayer()) {
    console.log('[SwitchCoreAPI] Server instance. Waiting for ownership transfer.');
    return;                       // 서버 생에서는 아무것도 만들지 않는다
}
```

이 가드가 없으면 세션이 서버에서 한 벌, 클라이언트에서 한 벌 만들어져 이벤트가 두 번 돈다.

---

## 2. 소유권이 넘어갈 때 일어나는 일

### 2.1 `start()` 가 다시 불린다

소유권이 바뀌면 로컬 런타임이 그 엔티티에 붙은 Local 스크립트의 `start()` 를 **다시** 부른다.
컴포넌트는 이 시점에 자기 자신을 리셋할 수 있어야 한다.

그 직전에 `dispose()` 가 불린다 (`horizon/core` 의 `DisposableObject` 주석 - "소유권이
클라이언트 사이에서 넘어갈 때" 도 포함). **런타임이 스스로 끊어 주는 것과 아닌 것**을 가려야
`dispose()` 에 무엇을 써야 하는지 정해진다.

| 만든 것 | `dispose()` 때 런타임이 | 우리가 할 일 |
|---|---|---|
| `connectCodeBlockEvent` · `connectLocalEvent` · `connectLocalBroadcastEvent` · `this.async` 타이머 | **스스로 끊는다** (`Component.dispose()` 문서) | 없음. 다만 이 프로젝트는 타이머 id 를 담아 두고 명시적으로 지우는 규약이다 |
| `connectNetworkEvent` · `connectNetworkBroadcastEvent` | 문서에 언급이 없다 | `SubscriptionBag` 에 담아 끊는다 (`PuzzleUI_MainPanel._networkSubscriptions`) |
| `PlayerControls.connectLocalInput` 의 `PlayerInput` | 끊지 않는다 | `disconnect()` |
| `horizon/mobile_gestures` 의 `Gestures` | 끊지 않는다 | `dispose()` |
| Focused Interaction 모드 진입 | 끊지 않는다 | `exitFocusedInteractionMode()`. 안 하면 **플레이어가 고정 화면에 갇힌다** |
| `AnimatedBinding` 의 `Animation.repeat` | 끊지 않는다 | `stopAnimation()` |
| 모듈 싱글턴에 얹은 것 | 끊지 않는다 (§2.4) | 다음 생의 진입점에서 정리 |

`*_CoreAPI.dispose()` 의 `releaseInteraction()`, `PuzzleUI_MainPanel.dispose()`,
실험용 패널 2종의 `dispose()` 가 이 표대로 되어 있다
(`../구현 사항/작업기록_2026-09-18_실행모드_제약_점검과_적용.md` §2.2).

### 2.2 그 사이에 발행된 이벤트는 사라진다

전환 중에 발행된 이벤트는 **지연 발행한 것까지 포함해 전부 유실된다.**
따라서 전환 직후의 상태를 이벤트 도착에 의존해 복원하면 안 된다. 필요한 값은 다시 읽어 온다.

**이 프로젝트에서 걸리는 자리는 진행도 `REQUEST` 다.** `PuzzleUI_MainPanel.initializeUI()` 가
보내는 첫 요청이 정확히 전환 시점에 나간다. 그래서 응답 타이머(5초)가 울리면 **먼저 다시
묻고**, 3회까지 없을 때만 서버 스크립트 부재로 판단해 경고한다
(`PROGRESS_REQUEST_MAX_ATTEMPTS`, 2026-09-18). 응답이 두 번 와도 `hydrate()` 가 큰 쪽을
남기므로 진행도가 뒤로 가지 않는다.

### 2.3 엔티티 prop 과 스크립트 변수가 기본값으로 돌아간다

전환 시점에 **엔티티 속성과 스크립트 변수는 기본값으로 되돌아간다.** 남은 사용 횟수처럼
플레이어별로 누적되는 값을 컴포넌트 필드에만 담아 두면 그때 사라진다.
그런 값은 **따로 보관해 두었다가 전환 시 이벤트로 다시 넣어 준다.**

### 2.4 모듈 싱글턴은 반대로 살아남는다 — 이 프로젝트의 실측

컴포넌트 필드는 초기화되지만 **모듈 스코프의 싱글턴은 초기화되지 않는다.**
`PuzzleHubRegistry.instance` 와 `PuzzleBoardStage.instance` 가 그렇다. 그래서 플레이어가
나갔다 다시 들어오면 직전 생에서 올려 둔 보드가 그대로 다시 그려졌다.

**규칙 — 새 Local 컴포넌트가 모듈 싱글턴에 무언가를 얹는다면, 자기 진입점에서 한 번
정리하고 시작한다.** 지금은 `PuzzleUI_MainPanel.initializeUI()` 끝의 `bootToMainMenu()` 가
`PuzzleHubModel.resetToMainMenu()` + `PuzzleBoardStage.reset()` 으로 그 일을 한다.
자세한 경위는 `../구현 사항/작업기록_2026-09-02_재입장과_시스템메뉴.md` §1 에 있다.

---

## 3. 로컬 스크립트에 오지 않는 이벤트

**전부 서버(Default) 스크립트가 대신 받아 로컬로 중계해야 한다.**

| 이벤트 | 오지 않는 상황 |
|---|---|
| `OnPlayerExitWorld` | **그 스크립트를 소유한 플레이어가 나갈 때.** 정작 필요한 그 순간에 오지 않는다 |
| `OnPlayerEnterWorld` / `OnPlayerExitWorld` | 플레이어가 World Builder 의 **프리뷰 ↔ 빌드 모드를 오갈 때** |
| `OnGrabEnd` / `OnAttachEnd` | 로컬 엔티티를 **든 채로** 플레이어가 월드를 나갔을 때 |

> 플레이어가 월드를 나가면 그 플레이어의 로컬 스크립트는 서버에서 도는 상태로 돌아간다.

**이 프로젝트는 이미 맞게 되어 있다.** `OnPlayerEnterWorld` / `OnPlayerExitWorld` 를 구독하는
곳은 `Puzzle_LocalOwnership` 하나뿐이고, 그것은 실행 모드가 **Default(서버)** 다.
잡기·부착을 쓰는 곳은 없다.

> **다만 중계는 아직 없다.** `Puzzle_LocalOwnership.onPlayerExitWorld()` 는 `_assignedPlayer`
> 를 비우기만 하고 로컬 쪽에 알리지 않는다. 지금은 재입장 시 §2.4 의 정리가 대신 덮어 주므로
> 문제가 드러나지 않는다. **퇴장 시점에 반드시 해야 할 일(예: 진행도 마지막 저장)이 생기면
> 그때는 이 스크립트에 중계를 붙여야 한다** — 로컬에서 퇴장을 알 방법이 없기 때문이다.

---

## 4. 로컬 스크립트가 쓸 수 없는 API

| 금지 | 대신 |
|---|---|
| **Persistent Variables API** (`world.persistentStorage`) | Default 스크립트가 읽고 쓰고, 로컬과는 이벤트로 주고받는다 |
| **에셋 스폰** (`world.spawnAsset`, `SpawnController`) | 보안·무결성 이유로 서버에서만. 로컬은 스폰을 요청만 한다 |
| **텍스처 에셋 접근** | UI 최적화 텍스처를 엔티티에 물리려면 Default 스크립트에 이벤트를 보내 그쪽에서 호출한다 |

### 4.1 이 규칙에 걸렸던 것 — 진행도 영구 저장 (2026-09-10 해결)

`PuzzleUI_MainPanel` 은 실행 모드가 **Local** 인데 `world.persistentStorage` 를 직접 불렀다.
`PuzzleUI_PersistentProgress.ts` 가 `try/catch` 로 감싸고 있어 터지지는 않았고, 실패하면
메모리 저장소로 떨어져 **그 세션 안에서는 Continue 가 멀쩡히 동작했다.** 그래서 증상이
크래시가 아니라 **"월드를 나가면 진행도가 사라진다"** 로만 드러났다.

**해결** — 영구 변수 호출만 서버로 옮겼다. 순수 계층(`PuzzleUI_Progress.ts` 의
`IPuzzleProgressStorage`)이 이미 인터페이스로 분리되어 있어 허브 모델은 손대지 않았다.

```
[Local] MainPanel  --REQUEST(브로드캐스트)-->  [Default] Puzzle_ProgressServer --> persistentStorage
[Local] MainPanel  <--LOADED(그 플레이어에게)-  [Default] Puzzle_ProgressServer
[Local] MainPanel  --SAVE(브로드캐스트)----->  [Default] Puzzle_ProgressServer
```

| 파일 | 역할 |
|---|---|
| `Puzzle_ProgressServer.ts` (신규) | Default(서버)에서 영구 변수를 읽고 쓴다. 받은 문자열은 파싱해서 검증한 뒤 쓴다 |
| `PuzzleUI_PersistentProgress.ts` | `NetworkEvent` 3종 정의 + 로컬용 `RelayProgressStorage`. `HorizonProgressStorage` 는 이제 **서버 전용** |
| `PuzzleUI_Progress.ts` | `PuzzleProgressTracker.hydrate()` 추가 — 뒤늦게 온 진행도를 합친다 |
| `PuzzleUI_MainPanel.ts` | 요청·응답 배선. 5초 안에 응답이 없으면 서버 스크립트가 없다고 콘솔에 경고 |

세 가지가 이 배선의 핵심이다.

- **읽기가 비동기가 되므로 허브는 진행도가 도착하기 전에 그려진다.** 트래커는 빈 진행도로
  시작하고, 응답이 오면 `hydrate()` 로 합친 뒤 값이 실제로 바뀐 경우에만 메뉴를 다시 그린다.
- **기다리는 사이에 한 판을 깨면 그 기록이 이긴다.** `hydrate()` 는 퍼즐마다 큰 쪽을 남기고,
  로컬이 앞서 있으면 저장소에 되돌려 쓴다.
- **서버가 클라이언트가 보낸 문자열을 그대로 쓰지 않는다.** `parseProgressSnapshot()` 으로
  한 번 걸러서 형식이 어긋난 값이 영구 변수에 들어가지 않게 한다.

에디터 설정은 `../가이드/에디터_퍼즐_셋업.md` §4.1 에 있다. **`Puzzle_ProgressServer` 가 붙은
엔티티는 `Puzzle_LocalOwnership` 의 `targets` 에 넣지 않는다** — 넣으면 소유권이 넘어가
같은 문제로 돌아간다.

### 4.2 확인이 필요한 것 — 보드 텍스처

`PuzzleBoardUI_TextureLibrary` 는 Local 로 도는 패널 안에서
`ImageSource.fromTextureAsset(asset.as(TextureAsset))` 을 부른다.
실험용 `FocusDragDemo_Panel.resolveTexture()` 도 같은 호출을 Local 에서 한다 - 판정이 나면
두 곳을 같은 방식으로 고친다.

공식 주의사항의 문장은 "**엔티티에 새 UI 최적화 텍스처를 물리려면**" 을 예로 들고 있어
Custom UI 의 `ImageSource` 경로까지 막는 것인지 분명하지 않다. **인월드에서 그림이 실제로
뜨는지 눈으로 확인하기 전까지는 미확정으로 둔다.**

막히는 것으로 판명되면 대응은 §4.1 과 같은 모양이다 — Default 스크립트가 에셋을 들고
`ImageSource` 를 만들어 넘기거나, 텍스처를 쓰지 않는 색·글자 표현으로 되돌린다
(`../구현 사항/작업기록_2026-09-04_보드_텍스처_틴트와_방향회전.md` 이전 상태).

---

## 5. 이벤트가 건너갈 수 있는 경계

| 보내는 쪽 → 받는 쪽 | 되나 | 써야 하는 것 |
|---|---|---|
| Local → 같은 소유자의 Local | ○ | Local 이벤트 |
| Local → Default(서버) | ✕ | **CodeBlock / 네트워크 이벤트** |
| Default → Local | ✕ | **CodeBlock / 네트워크 이벤트** |
| Local(플레이어 A) → Local(플레이어 B) | ✕ | **CodeBlock / 네트워크 이벤트** |

정리하면 **로컬 이벤트는 소유자가 같은 것끼리만 오간다.** 서로 다른 스크립트가 같은
오브젝트의 이벤트를 듣고 있어도, 실행 모드가 다르면 서로의 로컬 이벤트를 듣지 못한다.

> **퍼즐 8종의 이벤트 허브(`*_GameEvents.ts`)는 이 경계와 무관하다.** Horizon 의
> `LocalEvent` / `NetworkEvent` 가 아니라 `Utility_Events.ts` 의 자체 `EventPublisher` 이고,
> 같은 클라이언트의 같은 JS 컨텍스트 안에서만 돌기 때문에 플랫폼 이벤트 시스템을 타지 않는다.
>
> **바꿔 말하면 그 구조는 경계를 넘을 수 없다.** 경계를 넘는 통신은 지금 진행도 중계
> 하나뿐이고(§4.1), 그래서 그것만 `NetworkEvent` 를 쓴다. 브로드캐스트(`sendNetworkBroadcastEvent`)
> 는 **호스트(서버)만 받고**, 서버가 특정 플레이어에게 되돌려 줄 때는 `sendNetworkEvent(player, ...)`
> 로 주소를 찍는다 — 로컬 쪽은 `connectNetworkEvent(this.entity.owner.get(), ...)` 로 자기 것만 듣는다.

---

## 6. 현재 프로젝트 점검표

> 2026-09-18 에 §8 체크리스트를 Local 스크립트 전부에 대조했다. 그때 고친 것과 판단 근거는
> `../구현 사항/작업기록_2026-09-18_실행모드_제약_점검과_적용.md` 에 있다.

| 규칙 | 상태 |
|---|---|
| 서버 인스턴스 가드 (§1) | ✅ CoreAPI 8종 · 패널 4종(보드·허브·실험용 2종) 전부. `Puzzle_ProgressServer` 는 반대 방향 가드로 서버 전용을 지킨다 |
| 소유권 전환 시 `dispose()` 정리 (§2.1) | ✅ 2026-09-18 — 실험용 패널 2종에 `dispose()` 가 없어 `Gestures` · 커스텀 입력 · 포커스 모드 · 반복 애니메이션이 남았다. 추가했다 |
| 전환 중 이벤트 유실 (§2.2) | ✅ 2026-09-18 — 진행도 `REQUEST` 를 응답이 없으면 3회까지 다시 보낸다 |
| 소유권 전환 후 싱글턴 정리 (§2.4) | ✅ `bootToMainMenu()` |
| `OnPlayerEnterWorld` / `OnPlayerExitWorld` 는 서버에서만 (§3) | ✅ `Puzzle_LocalOwnership` 하나뿐, Default |
| 퇴장 시점 중계 (§3) | ➖ 없음. 진행도 `SAVE` 가 클리어마다 즉시 나가므로 아직 필요 없다 |
| 에셋 스폰 (§4) | ✅ 쓰는 곳이 없다 |
| Persistent Variables (§4.1) | ✅ 2026-09-10 해결 — `Puzzle_ProgressServer` 로 중계. `HorizonProgressStorage` 를 만드는 곳이 그 스크립트뿐임을 2026-09-18 재확인. 에디터에 그 엔티티를 추가해야 실제로 저장된다 |
| 텍스처 에셋 (§4.2) | ❓ 미확정 — 인월드 확인 필요. 호출처는 `PuzzleBoardUI_TextureLibrary` 와 `FocusDragDemo_Panel` 두 곳 |
| 이벤트 경계 (§5) | ✅ 경계를 넘는 유일한 통신인 진행도 중계가 `NetworkEvent` 를 쓴다 |
| Custom UI 트리 64 kB (§7) | ✅ 보드 패널 86 kB → `DynamicList` 로 칸 복제 제거 |
| 바인딩 `set` 예산 (§7) | ❌ 레이저 드롭 프레임 462회/frame. `runBatch` 배치 커밋 적용 중, 인월드 실측 전 |
| 커스텀 애니메이션 2초 이내 (§7) | ✅ 2026-09-18 — 인게임 패널의 `Animation.timing` 은 전부 유한(기본 0.3초 이하). 실험용 패널 2종의 무한 반복 펄스(`showNativePulse`)는 **기본값을 끔으로** 바꿨다. `DragLab` 의 프레임당 `set` 렌더 모드는 한도 초과를 재는 실험이라 그대로 둔다 |
| 보이는 패널 10개 (§7) | ✅ 플레이어 1인 기준 보드 + 허브. 선택 조각은 `UINode.if` 로 마운트를 가른다. 실험용 패널은 같은 월드에 함께 두지 않는다 |
| 바인딩 총수 1,000~1,500 (§7) | ❓ 미측정 — 칸당 파생 22키 × 칸 수 × **동시 접속 수**. 실시간 지표로 재야 한다 |
| 루트 폴더·미등록 파일 (§7) | ✅ 2026-09-18 — 루트 `.ts` 는 전부 `.editor` 에 등록. 루트에 있던 `_workspace/` 폴더를 `Documents/` 아래로 옮겼다 |

---

## 7. 실행 모드와 무관하게 걸리는 플랫폼 한도

같이 지켜야 하는데 성격이 달라 자주 잊는 것들이다. 각 항목의 근거 문서를 함께 적는다.

| 한도 | 값 | 어기면 | 근거 |
|---|---|---|---|
| Custom UI 트리 크기 | **패널 하나당 64 kB** | 컴포넌트가 아예 만들어지지 않는다 (86 kB 로 실측) | `../구현 사항/버그수정_2026-09-02_보드패널_64kB_한도초과.md` |
| 바인딩 `set` 횟수 | **로컬 프레임당 10회 이하** (서버 20회) | 드롭 프레임이 흔들린다 (레이저 실측 462회) | `2026-09-07_Horizon_CPU_TypeScript_최적화_가이드_분석.md` |
| 바인딩 `set` **지속 평균** | **4~5 프레임당 1회 이하** | UI 스레드 큐가 계속 길어져 화면이 입력보다 점점 밀린다 | `2026-09-18_Meta_강연_Create_Performant_Custom_UIs_정리.md` §4.5 |
| Custom UI 총 CPU | **프레임당 0.5 ms 이하** (로컬) | 위와 같다 (실측 약 10 ms) | `2026-09-07_...가이드_분석.md` |
| UI 콜백 빈도 | **2~4 프레임당 1회 이하** | 콜백 하나가 서버 왕복 RPC 하나. 원격 실행 시 약 10 ms 체감 지연 | 강연 정리 §4.2 |
| 동시에 **보이는** 패널 수 | **10개 이하** (하드 리밋 없음) | 리렌더 시간이 보이는 패널 수에 **선형**으로 늘어난다 | 강연 정리 §4.4 |
| 월드 전체 바인딩 총수 | **1,000~1,500개 이하** | 초기화 RPC 가 63 kB 를 넘어 패널이 뜨지 않는다. **플레이어별 복제분이 전부 합산**된다 | 강연 정리 §4.3 |
| 커스텀 애니메이션 지속 | **2초 이내** (권장은 쓰지 않기) | 두 스레드가 5~6초 어긋난다. 애니메이션은 출시 예정 UI 애니메이션 API 로 | 강연 정리 §4.5 |
| 스크립트 카탈로그 | **카탈로그(클라우드)가 원본** | `.editor` 에 없는 루트의 `.ts` 는 에디터가 조용히 지운다. 루트에 만든 폴더는 폴더째 사라진다 | `../가이드/타입체크와_테스트_실행.md` §3.1 |

> 마지막 항목 때문에 **인월드에서 돌 필요가 없는 것(테스트·도구)은 `Documents/` 아래**에 둔다.
> 새 `.ts` 를 루트에 추가할 때는 에디터 UI 의 스크립트 목록에서 등록까지 해야 살아남는다.

### 7.1 위 한도가 나오는 자리 — UI 스레드

이 문서는 원래 "무엇이 금지인가" 만 적지만, Custom UI 한도만은 **구조를 모르면 지킬 수 없다.**
근거는 Meta 강연(`2026-09-18_Meta_강연_Create_Performant_Custom_UIs_정리.md` §4)이고 요지는 넷이다.

1. **UI 는 Unity 메인 스레드와 별개의 스레드에서 그린다.** UI 가 막혀도 월드 FPS 는 유지된다.
   바꿔 말하면 **FPS 가 멀쩡해도 UI 는 이미 밀려 있을 수 있다.** FPS 로 UI 성능을 판단하지 않는다.
2. **리렌더 한 번이 30~50 ms 로 메인 프레임(13~14 ms)의 약 4배다.** "4~5 프레임당 set 1회"
   라는 지속 평균은 여기서 나온다. 순간적으로 몰아 쓰는 것은 괜찮고, **평균이 넘으면 큐가
   영원히 줄지 않는다.**
3. **바인딩 하나가 바뀌면 그것을 쓰지 않는 패널까지 보이는 패널 전부가 알림을 받는다.**
   각 컴포넌트가 "나는 이 바인딩을 안 쓴다" 고 거절하지만 알림을 보내는 일 자체가 비용이다.
   그래서 한도가 "패널당" 이 아니라 **"동시에 보이는 패널 수"** 로 걸린다.
4. **1st party UI(PUI · 2D 에디터)와 같은 JS 스레드를 쓴다.** 우리 UI 가 스레드를 막으면
   **에디터의 시뮬레이션 정지 버튼조차 눌리지 않는다.** 인월드 테스트 중 에디터가 먹통이
   되면 월드 문제가 아니라 우리 패널의 바인딩 폭주를 먼저 의심한다.

여기서 나오는 설계 규칙 셋.

| 규칙 | 이유 |
|---|---|
| **바인딩으로 애니메이션을 만들지 않는다** | 매 프레임 `set` 이 곧 2번의 위반이다. 반복 연출이 필요하면 출시 예정 애니메이션 API 를 기다리거나 2초 안에 끝낸다 |
| **바인딩은 필요할 때 만든다** | "나중에 바꿀지 모르니" 만든 바인딩도 초기화 RPC 에 전부 실린다. 칸당 파생 키가 늘면 플레이어 수만큼 곱해진다 |
| **패널 가시성을 자주 토글하지 않는다** | 끄기는 공짜지만 **켜기는 비용**이다(렌더 텍스처 재할당). 자주 껐다 켤 것은 켠 채로 두고 내용만 바꾼다 |

> **Local 실행이 주는 덤.** 로컬 바인딩 갱신은 **로컬 스코프의 패널만** 리렌더한다(강연 Q&A).
> §1~§5 의 제약을 감수하고 Local 을 쓰는 대가로 3번 항목의 부담이 줄어든다.

### 7.2 재는 법 — 실시간 지표 4종

위 넷은 전부 에디터의 실시간 지표(real-time metrics)에 계기판이 있다.
**추측하지 말고 이 네 값을 본다.**

| 지표 | 보는 한도 |
|---|---|
| 보이는 패널 수 | 10개 |
| 바인딩 총수 | 1,000~1,500개 |
| 바인딩 총 데이터 크기 | 63 kB |
| 프레임당 바인딩 갱신 횟수 | 10회 (지속 평균은 4~5 프레임당 1회) |

프레임 단위로 원인을 짚어야 하면 Perfetto 트레이스를 뜬다
(마커 대응표는 `2026-09-07_Horizon_CPU_TypeScript_최적화_가이드_분석.md`).

---

## 8. 새 스크립트를 Local 로 둘 때 체크리스트

1. **진입점에 서버 가드**를 넣었는가 (§1). 없으면 세션이 두 벌 돈다.
2. `Puzzle_LocalOwnership` 의 `targets` 에 그 엔티티를 넣었는가. 넣지 않으면 아예 돌지 않는다.
3. `start()` 가 **여러 번 불려도 안전한가** (§2.1). 소유권이 바뀔 때마다 다시 불린다.
4. 컴포넌트 필드에만 담아 둔 값 중 **전환 후에도 살아야 하는 것**이 있는가 (§2.3).
   있다면 서버 쪽에 보관하고 전환 시 이벤트로 받는다.
5. 모듈 싱글턴에 무언가를 얹는가. 얹는다면 **진입점에서 앞선 생의 잔재를 정리**하는가 (§2.4).
6. `OnPlayerExitWorld` · `OnGrabEnd` · `OnAttachEnd` 에 의존하는가 (§3).
   의존한다면 그 구독은 **Default 스크립트**에 두고 중계한다.
7. `persistentStorage` · 에셋 스폰 · 텍스처 에셋을 부르는가 (§4). 부른다면 서버로 옮긴다.
8. 다른 실행 모드나 다른 플레이어의 스크립트와 이벤트를 주고받는가 (§5).
   주고받는다면 `EventPublisher` 가 아니라 CodeBlock / 네트워크 이벤트다.
9. Custom UI 라면 **64 kB** 와 **프레임당 set 10회**를 넘지 않는가 (§7).
10. 그 패널이 **화면에 몇 개까지 동시에 뜨는가** (§7). 새로 띄우는 패널이 기존 10개 예산에
    들어가는지, 안 쓸 때 숨기는 경로가 있는지 확인한다. 바인딩 하나만 바뀌어도 **보이는
    패널 전부가 리렌더 알림을 받는다** (§7.1).
11. 새로 만드는 **바인딩 개수를 세었는가** (§7). 칸·항목마다 파생 키를 두는 구조라면
    개수 × 플레이어 수가 월드 총량에 그대로 더해진다. "나중에 쓸지 몰라서" 만든 것은 지운다.
12. **반복 연출을 바인딩 `set` 으로 돌리고 있지 않은가** (§7.1). 돌린다면 2초 안에 끝내거나
    연출을 뺀다.
13. 루트에 새 파일을 만들었다면 **에디터 스크립트 목록에 등록**했는가 (§7).
