# RushHour_Session.ts — 주석 아카이브

> 원본 스크립트: `RushHour_Session.ts`
> 걷어낸 주석 14건 / 1,870 B 절감 (18,001 B → 16,131 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Rush Hour Session - 라운드 / 제한시간 / 승패를 묶는 순수 상태 머신

PUZ_00 §7.4 가 요구하는 "실패/성공 판정, 남은 시간, 라운드 진행도를 외부에서 조회 가능한 API" 다.
모바일 사양의 드래그 조작은 `RushHour_DragController` 가 담당하고,
이 클래스는 그 결과를 받아 게임 진행에 반영한다.

진행 흐름
  IDLE -> ROUND_INTRO -> PLAYER_INPUT -> (MOVING) -> ROUND_CLEAR
       -> 다음 라운드가 남았으면 ROUND_INTRO, 아니면 QUEST_CLEAR
  제한 시간이 다하면 어느 상태에서든 GAME_OVER.

horizon/core 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `isTimeLimitPerRound?: boolean,`

> 원본 L35

 제한 시간을 라운드마다 리셋할지(기본 true) 퀘스트 전체에 한 번만 줄지

## `seed?: number,`

> 원본 L37

 레벨 생성기 시드. 지정하면 같은 배치가 재현된다

## `dragController?: RushHourDragController,`

> 원본 L39

 드래그 컨트롤러를 직접 주입하고 싶을 때 (테스트용)

## `private _fieldOrdinal: number | undefined = undefined;`

> 원본 L57

레벨 모드에서 이번 판의 순번 (그 난이도의 판 목록에서 0-based).
undefined 면 기존처럼 아직 안 낸 판 중에서 무작위로 고른다.

## `private _roundCountOverride: number | undefined = undefined;`

> 원본 L62

 레벨 모드는 1라운드 고정. undefined 면 퀘스트 테이블의 roundCount 를 쓴다

## `private _usedPuzzleIds: string[] = [];`

> 원본 L70

이번 퀘스트에서 이미 낸 필드 테이블 행.
기획 CSV 를 붙인 뒤 난이도당 판이 여러 개가 됐으므로, 라운드마다 다른 판을 낸다.

## `private _lastPublishedSecond: number = -1;`

> 원본 L77

 남은 시간 이벤트를 초 단위로만 쏘기 위한 직전 정수 초

## `public get state(): ERushHourState {`

> 원본 L80

#region External query API (PUZ_00 §7.4)

## `public get isActive(): boolean {`

> 원본 L98

 게임이 진행 중인지 (일시정지/종료/대기 상태가 아닌지)

## `public getHintMove(): RushHourMove | undefined {`

> 원본 L115

 솔버가 구한 최소 해의 다음 한 수 (힌트 기능용)

## `constructor(events: RushHourEvents, tables: RushHourTables, generator: RushHourLevelGenerator, solver: RushHo…`

> 원본 L124

#endregion

## `public startQuest(questId: string): boolean {`

> 원본 L136

#region Quest / round lifecycle

## `public startQuest(questId: string): boolean {`

> 원본 L138

 퀘스트를 시작한다. 메인 테이블에서 난이도/라운드/제한시간을 읽는다

