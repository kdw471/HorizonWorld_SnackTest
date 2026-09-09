# PuzzleUI_Model.ts — 주석 아카이브

> 원본 스크립트: `PuzzleUI_Model.ts`
> 걷어낸 주석 40건 / 6,587 B 절감 (17,472 B → 10,885 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Puzzle UI Model - 메인 UI(퍼즐 허브)의 순수 상태 머신

화면 흐름 (EPuzzleHubScreen)

  MAIN_MENU ──selectPuzzle()──▶ PUZZLE_DETAIL ──startNewGame()───▶ IN_GAME
  (2열×4행 격자)     │              (꽉 찬 상세)  └continueGame()──▶ IN_GAME
      ▲             │returnToMenu()                                  │
      │             ▼                                     pause/resume ⇄ PAUSED
      │◀────────────────────────────────────────┐                    │
      │                                         │        (퀘스트 종료 이벤트)
      └──────────quitToMenu()──── RESULT ◀──────┴─────────────────────┘
                                    │retry()    ──▶ IN_GAME (같은 레벨 재도전)
                                    │nextLevel()──▶ IN_GAME (다음 레벨)

#### 레벨

**레벨 하나 = 퀘스트 라운드 하나 = 기획 판 하나.** 난이도 오름차순으로 판을 이어 붙인
것이 레벨 목록이며(`buildPuzzleLevelTable`), 상세 화면의 두 버튼이 그 위를 움직인다.

  Start    -> 1레벨
  Continue -> 마지막으로 클리어한 레벨의 다음 (기록이 없으면 잠김)

진행도는 `PuzzleProgressTracker` 가 들고 있고, 클리어할 때마다 여기서 기록한다.

#### 규칙

  - 레지스트리에 핸들이 없는 퍼즐(아직 *_CoreAPI 미등록)은 선택할 수 없다 -> "준비 중"
  - 인게임 구독은 시작 시 걸고 **메뉴로 돌아갈 때** 해제한다 (retry 는 구독을 유지)
  - 레벨 생성 실패로 시작 즉시 QUEST_FAILED 가 오는 경로도 결과 화면으로 수렴한다
    (세션이 fail() 을 경유해 이벤트를 보장한다)
  - **진행도 기록은 승리했을 때만.** 실패는 진행도를 건드리지 않는다

`horizon/core` 에 런타임 의존이 없어 Node 테스트(PuzzleUI_Tests.ts)로 전 화면 전이를 검증한다.

## `export class PuzzleHubEvents {`

> 원본 L57

#region Events

## `export class PuzzleHubEvents {`

> 원본 L59

 표현 계층(PuzzleUI_MainPanel)이 구독하는 뷰 갱신 이벤트

## `public readonly CATALOG_CHANGED = new EventPublisher<PuzzleCatalogView[]>();`

> 원본 L62

 핸들 등록 또는 진행도 변화로 격자 표시가 바뀌었다

## `public readonly DETAIL_CHANGED = new EventPublisher<PuzzleDetailView>();`

> 원본 L64

 상세 화면의 표시 내용이 바뀌었다 (퍼즐 선택, 진행도 갱신)

## `public readonly HUD_CHANGED = new EventPublisher<PuzzleHudView>();`

> 원본 L66

 인게임 HUD 갱신 (시간은 세션이 초 단위로 이미 스로틀한다)

## `public readonly RESULT_READY = new EventPublisher<PuzzleUIQuestResult>();`

> 원본 L68

 결과 화면 데이터가 준비됐다

## `public readonly START_FAILED = new EventPublisher<EPuzzleId>();`

> 원본 L70

 시작에 실패했다 (레벨 범위 밖 등) - 토스트 표시용

## `public readonly LOCKED_PUZZLE_TAPPED = new EventPublisher<EPuzzleId>();`

> 원본 L72

 준비 중(미등록) 퍼즐을 눌렀다 - 토스트 표시용

## `export class PuzzleHubModel {`

> 원본 L76

#endregion

## `private _currentLevel: number = 0;`

> 원본 L87

 지금 플레이 중이거나 막 끝낸 레벨 번호 (1-based). 0 이면 플레이한 적 없음

## `private _activeHandle: IPuzzleGameHandle | undefined = undefined;`

> 원본 L90

 인게임 중인 퍼즐의 핸들. RESULT 화면까지 유지한다 (retry / nextLevel 용)

## `public get events(): PuzzleHubEvents {`

> 원본 L114

#region View queries (표현 계층의 초기 렌더용)

## `public get currentLevel(): number {`

> 원본 L128

 지금 플레이 중인 레벨 번호 (1-based). 0 이면 없음

## `public canPlayNextLevel(): boolean {`

> 원본 L199

 결과 화면에서 "다음 레벨" 을 누를 수 있는지 - 이겼고 마지막 레벨이 아닐 때

## `public selectPuzzle(puzzleId: EPuzzleId): boolean {`

> 원본 L208

#endregion

## `public selectPuzzle(puzzleId: EPuzzleId): boolean {`

> 원본 L210

#region Actions (표현 계층의 버튼이 부른다)

## `public selectPuzzle(puzzleId: EPuzzleId): boolean {`

> 원본 L212

 메인 메뉴에서 퍼즐을 골랐다 → 상세 화면(꽉 찬 퍼즐 UI)으로

## `this._events.LOCKED_PUZZLE_TAPPED.publish(puzzleId);`

> 원본 L218

아직 Horizon 통합이 없는 퍼즐 - "준비 중"

## `public returnToMenu(): boolean {`

> 원본 L229

 상세 화면 → 메인 메뉴 (Return 버튼)

## `public startNewGame(): boolean {`

> 원본 L239

 Start - 1레벨부터 시작한다

## `public continueGame(): boolean {`

> 원본 L247

Continue - 마지막으로 클리어한 레벨의 다음 레벨부터 시작한다.
클리어 기록이 없으면 아무 일도 하지 않는다 (버튼이 잠겨 있어야 한다).

## `public retry(): boolean {`

> 원본 L262

 결과 화면에서 같은 레벨 재도전

## `public playNextLevel(): boolean {`

> 원본 L270

 결과 화면에서 다음 레벨로 (이겼을 때만)

## `public resetLevel(): boolean {`

> 원본 L278

지금 판을 풀기 전 상태로 되돌린다 (보조 레이아웃의 Reset 버튼).

보드 패널의 Reset 버튼은 프레젠터를 통해 CoreAPI 로 바로 가지만, 메인 UI 쪽에도
같은 경로를 열어 둔다 - 일시정지 화면 등에서 리셋을 붙일 자리이자,
화면 상태와 무관하게 리셋이 새는 일이 없는지 검증할 지점이다.

## `this._activeHandle?.pause();`

> 원본 L296

화면 전환은 onPaused 이벤트에서 한다 - 세션이 비활성이면 무시되는 것까지 세션 규칙을 따른다

## `public restartLevel(): boolean {`

> 원본 L307

지금 레벨을 처음부터 다시 시작한다 - 일시정지 화면의 **Restart Level**.

보조 레이아웃의 Reset 버튼(`resetLevel()`)과 다르다.
  Reset         판만 되돌리고 **남은 시간은 그대로** 둔다
  Restart Level 레벨을 다시 열어 **타이머까지 초기화**한다

일시정지 중에도 동작해야 한다 - 그 버튼이 떠 있는 곳이 바로 일시정지 화면이다.
세션은 `startLevel()` 에서 상태를 통째로 다시 잡으므로 멈춰 있는 상태도 그대로 풀린다.

## `public resetToMainMenu(): void {`

> 원본 L327

어떤 화면에 있든 메인 메뉴로 되돌리고 돌던 퍼즐을 전부 정리한다.

허브가 새로 시작할 때(재입장 포함) 부른다. `quitToMenu()` 가 인게임·결과 화면에서만
동작하는 것과 달리, 여기는 **무조건** 메인 메뉴로 맞춘다. 진행도는 건드리지 않는다 -
저장된 클리어 기록은 `PuzzleProgressTracker` 가 따로 들고 있기 때문이다.

## `this._registry.abortAll();`

> 원본 L336

레지스트리는 싱글턴이라 앞선 생의 핸들이 남아 있을 수 있다.
_activeHandle 하나만 끊으면 그들이 그대로 화면에 남는다.

## `public quitToMenu(): boolean {`

> 원본 L348

 인게임(일시정지 포함)·결과 화면에서 메인 메뉴로 돌아간다

## `public backToDetail(): boolean {`

> 원본 L362

 결과 화면에서 이 퍼즐의 상세 화면으로 돌아간다

## `private getSelectedHandle(): IPuzzleGameHandle | undefined {`

> 원본 L378

#endregion

## `private getSelectedHandle(): IPuzzleGameHandle | undefined {`

> 원본 L380

#region Internal

## `private startLevel(level: number): boolean {`

> 원본 L386

 Start / Continue / retry / nextLevel 이 모두 거치는 단 하나의 시작 경로

## `if (this._activeHandle !== handle) {`

> 원본 L397

시작 전에 구독부터 건다 - 레벨 생성 실패 시 QUEST_FAILED 가
startLevel() 안에서 동기적으로 발행되기 때문이다

## `return false;`

> 원본 L419

시작 도중 동기적으로 실패가 확정됐다 (레벨 생성 실패 등) → 이미 RESULT 화면이다

## `this._events.START_FAILED.publish(handle.puzzleId);`

> 원본 L423

이벤트 없이 거절됐다 - 화면을 유지하고 알린다

## `this._activeHandle?.abort();`

> 원본 L436

진행 중이던 퀘스트는 버려지고, 이미 끝난 퀘스트(RESULT 경유)에도 abort 는
세션을 IDLE 로 되돌리고 보드를 화면에서 내리는 정리 역할이라 안전하다.

## `if (result.isWin && this._currentLevel > 0) {`

> 원본 L456

이겼을 때만 진행도를 올린다. 이미 더 앞서 있으면 tracker 가 뒤로 물리지 않는다.

## `}`

> 원본 L495

#endregion

