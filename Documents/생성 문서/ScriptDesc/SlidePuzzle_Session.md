# SlidePuzzle_Session.ts — 주석 아카이브

> 원본 스크립트: `SlidePuzzle_Session.ts`
> 걷어낸 주석 10건 / 1,272 B 절감 (15,481 B → 14,209 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Slide Puzzle Session - 라운드 / 제한시간 / 승패를 묶는 순수 상태 머신 (PUZ_07)

PUZ_00 §7.4 가 요구하는 "실패/성공 판정, 남은 시간, 라운드 진행도를 외부에서 조회 가능한 API".

승패 - §2
  클리어: 제한 시간 안에 모든 조각을 초기 상태로 만들면 클리어
  실패:   제한 시간 동안 맞추지 못하면 실패

완성 판정은 §12.6 에 따라 **매 이동 완료 시점**에 한다.

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `isTimeLimitPerRound?: boolean,`

> 원본 L32

 제한 시간을 라운드마다 리셋할지(기본 true) 퀘스트 전체에 한 번만 줄지

## `private _fieldOrdinal: number | undefined = undefined;`

> 원본 L50

레벨 모드에서 이번 판의 순번 (그 난이도의 판 목록에서 0-based).
undefined 면 기존처럼 아직 안 낸 판 중에서 무작위로 고른다.

## `private _roundCountOverride: number | undefined = undefined;`

> 원본 L55

 레벨 모드는 1라운드 고정. undefined 면 퀘스트 테이블의 roundCount 를 쓴다

## `private _lastMovableKey: string = '';`

> 원본 L66

 직전에 알린 이동 가능 위치 - 바뀔 때만 이벤트를 낸다

## `public get state(): ESlidePuzzleState {`

> 원본 L69

#region External query API (PUZ_00 §7.4)

## `public getMisplacedPieceCount(): number {`

> 원본 L103

 아직 제자리가 아닌 조각 수 - 진행도 표시용

## `public getReferenceImagePath(): string | undefined {`

> 원본 L108

 사이드 패널에 표시할 원본 이미지 경로 - §10

## `constructor(events: SlidePuzzleEvents, tables: SlidePuzzleTables, generator: SlidePuzzleLevelGenerator, optio…`

> 원본 L113

#endregion

## `public startQuest(questId: string): boolean {`

> 원본 L123

#region Quest / round lifecycle

