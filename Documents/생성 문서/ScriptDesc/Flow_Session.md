# Flow_Session.ts — 주석 아카이브

> 원본 스크립트: `Flow_Session.ts`
> 걷어낸 주석 11건 / 1,521 B 절감 (17,348 B → 15,827 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Flow Session - 라운드 / 제한시간 / 승패를 묶는 순수 상태 머신 (PUZ_05)

PUZ_00 §7.4 가 요구하는 "실패/성공 판정, 남은 시간, 라운드 진행도를 외부에서 조회 가능한 API".

승패 - §2
  클리어: 제한시간 동안 필드 위의 모든 전구에 불을 밝히면 클리어
  실패:   제한시간 안에 밝히지 못하면 실패

실패 시 §7 에 따라 유저 입력을 즉시 막는다. 불이 서서히 꺼지는 연출은 어댑터의 몫이다.

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `isTimeLimitPerRound?: boolean,`

> 원본 L35

 제한 시간을 라운드마다 리셋할지(기본 true) 퀘스트 전체에 한 번만 줄지

## `private _fieldOrdinal: number | undefined = undefined;`

> 원본 L54

레벨 모드에서 이번 판의 순번 (그 난이도의 판 목록에서 0-based).
undefined 면 기존처럼 아직 안 낸 판 중에서 무작위로 고른다.

## `private _roundCountOverride: number | undefined = undefined;`

> 원본 L59

 레벨 모드는 1라운드 고정. undefined 면 퀘스트 테이블의 roundCount 를 쓴다

## `private _usedPuzzleIds: string[] = [];`

> 원본 L66

이번 퀘스트에서 이미 낸 필드 테이블 행.
기획 CSV 를 붙인 뒤 난이도당 판이 여러 개가 됐으므로, 라운드마다 다른 판을 낸다.

## `private _completedColors = new Set<EFlowColor>();`

> 원본 L75

 직전에 완결되어 있던 색들 - 완결/해제 이벤트를 내기 위해 기억한다

## `public get state(): EFlowState {`

> 원본 L78

#region External query API (PUZ_00 §7.4)

## `public getRemainingSubCount(): number {`

> 원본 L112

 아직 불이 들어오지 않은 서브 오브젝트 수 - §5 진행도 표시용

## `public getSolutionPaths(): { color: EFlowColor, cells: FlowCell[] }[] {`

> 원본 L117

 솔버가 찾은 해 - 힌트 기능용

## `constructor(events: FlowEvents, tables: FlowTables, generator: FlowLevelGenerator, solver: FlowSolver = new F…`

> 원본 L126

#endregion

## `public startQuest(questId: string): boolean {`

> 원본 L137

#region Quest / round lifecycle

