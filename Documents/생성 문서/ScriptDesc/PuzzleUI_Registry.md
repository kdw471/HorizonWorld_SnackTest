# PuzzleUI_Registry.ts — 주석 아카이브

> 원본 스크립트: `PuzzleUI_Registry.ts`
> 걷어낸 주석 21건 / 3,094 B 절감 (10,734 B → 7,640 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Puzzle UI Registry - 퍼즐 구동 핸들의 등록소 (메인 UI ↔ 각 퍼즐 CoreAPI 의 접점)

메인 UI 는 8개 퍼즐의 세션/이벤트 타입을 직접 알지 않는다. 대신 각 `*_CoreAPI` 가
자기 세션을 **정규화된 핸들(IPuzzleGameHandle)** 로 감싸 여기 등록하고,
메인 UI 는 핸들만 다룬다.

8개 퍼즐의 세션·이벤트 허브는 이미 같은 규약을 따르므로 (PUZ_00 §2.1 / §7.4 -
startQuestByDifficulty / pause / resume / abort / TIME_CHANGED / ROUND_PROGRESS_CHANGED /
QUEST_CLEAR / QUEST_FAILED / GAME_PAUSE / GAME_RESUME), 퍼즐별 어댑터 코드 없이
`createPuzzleHandle()` 팩토리 하나로 전부 감쌀 수 있다 (구조적 타이핑).

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

#### CoreAPI 쪽 등록 예 (Switch_CoreAPI.ts 참조)

  PuzzleHubRegistry.instance.register(createPuzzleHandle(
      EPuzzleId.SWITCH,
      { startQuestByDifficulty: (d) => this.startQuestByDifficulty(d), ... },
      this.events,
      buildPuzzleLevelTable(
          (d) => this.tables.getQuestByDifficulty(d),
          (d) => this.tables.getFieldsForDifficulty(d).length,
      ),
  ));

## `export type PuzzleQuestListener = {`

> 원본 L37

#region Handle interface

## `export type PuzzleQuestListener = {`

> 원본 L39

 메인 UI 가 인게임 중 구독하는 정규화 이벤트 묶음

## `onQuestEnded: (result: PuzzleUIQuestResult) => void,`

> 원본 L43

 퀘스트가 승패와 함께 끝났다 (클리어 또는 실패)

## `export interface IPuzzleGameHandle {`

> 원본 L49

 메인 UI 가 퍼즐 하나를 조작하는 유일한 창구

## `getLevels(): PuzzleLevelRef[];`

> 원본 L52

 이 퍼즐의 레벨 목록 (1번 레벨부터 오름차순)

## `getLevelCount(): number;`

> 원본 L54

 총 레벨 수

## `startLevel(level: number): boolean;`

> 원본 L56

레벨 하나를 시작한다 (1-based). 범위 밖이면 false.
메인 UI 의 Start(=1) / Continue(=마지막 클리어 + 1) 가 쓰는 경로다.

## `startQuestByDifficulty(difficulty: number): boolean;`

> 원본 L61

 난이도 전체(라운드 여러 판)를 한 번에 플레이한다. 퀘스트 트리거용 경로

## `resetLevel(): boolean;`

> 원본 L63

지금 판을 풀기 전 상태로 되돌린다 (보조 레이아웃의 Reset 버튼). 남은 시간은 유지된다.
플레이 중이 아니면 false.

## `abort(): void;`

> 원본 L70

 퀘스트를 버리고 대기 상태로 되돌린다 (메뉴 복귀 시)

## `subscribeQuestEvents(listener: PuzzleQuestListener): Subscription[];`

> 원본 L74

 정규화 이벤트 구독. 반환된 구독들은 호출자가 보관했다가 해제한다

## `export type PuzzleSessionControls = {`

> 원본 L78

#endregion

## `export type PuzzleSessionControls = {`

> 원본 L80

#region Structural types (각 퍼즐이 이미 갖춘 모양)

## `export type PuzzleSessionControls = {`

> 원본 L82

 CoreAPI 가 넘기는 조작 메서드 묶음 - 보통 CoreAPI 자신의 메서드를 화살표로 감싼다

## `startLevel(difficulty: number, fieldOrdinal: number): boolean,`

> 원본 L84

 지정한 난이도의 지정한 판을 1라운드로 연다 (레벨 하나 = 라운드 하나)

## `resetLevel(): boolean,`

> 원본 L87

 지금 판을 풀기 전 상태로 되돌린다 (남은 시간은 유지)

## `export type PuzzleQuestEventSources = {`

> 원본 L100

8개 퍼즐의 `*_GameEvents.ts` 이벤트 허브가 전부 만족하는 부분 형태.
(QUEST_CLEAR/QUEST_FAILED 의 페이로드는 퍼즐마다 다르지만
 전부 PuzzleQuestResultSource 필드를 포함하므로 그 부분만 읽는다)

## `export function createPuzzleHandle(`

> 원본 L114

#endregion

## `export function createPuzzleHandle(`

> 원본 L116

#region Handle factory

## `export function createPuzzleHandle(`

> 원본 L118

세션 조작 + 이벤트 허브를 정규화 핸들로 감싼다.
8개 퍼즐이 같은 규약을 따르므로 이 팩토리 하나면 된다 - 퍼즐별 어댑터를 만들지 않는다.

