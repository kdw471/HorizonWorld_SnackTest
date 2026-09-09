# CardMatch_Session.ts — 주석 아카이브

> 원본 스크립트: `CardMatch_Session.ts`
> 걷어낸 주석 9건 / 1,260 B 절감 (14,786 B → 13,526 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Card Match Session - 라운드 / 제한시간 / 승패를 묶는 순수 상태 머신 (PUZ_06)

PUZ_00 §7.4 가 요구하는 "실패/성공 판정, 남은 시간, 라운드 진행도를 외부에서 조회 가능한 API".

이 퍼즐만의 특수 사항
  - **폭탄 셔플 중에는 제한 시간이 멈추고 입력이 잠긴다** (§4)
  - **리셋 버튼은 동작하지 않는다.** 폭탄이 리셋의 역할을 대신하기 때문이다 (§1 / §9.5)
    버튼 자체는 UI 에 남기되 입력은 무시하고 `RESET_IGNORED` 만 알린다.

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `isTimeLimitPerRound?: boolean,`

> 원본 L31

 제한 시간을 라운드마다 리셋할지(기본 true) 퀘스트 전체에 한 번만 줄지

## `private _fieldOrdinal: number | undefined = undefined;`

> 원본 L49

레벨 모드에서 이번 판의 순번 (그 난이도의 판 목록에서 0-based).
undefined 면 기존처럼 아직 안 낸 판 중에서 무작위로 고른다.

## `private _roundCountOverride: number | undefined = undefined;`

> 원본 L54

 레벨 모드는 1라운드 고정. undefined 면 퀘스트 테이블의 roundCount 를 쓴다

## `public get state(): ECardMatchState {`

> 원본 L64

#region External query API (PUZ_00 §7.4)

## `public get isInputLocked(): boolean {`

> 원본 L82

 폭탄 셔플 중에는 입력을 받지 않는다 - §4

## `public getRemainingObjectTileCount(): number {`

> 원본 L99

 아직 맞추지 못한 오브젝트 타일 수

## `constructor(events: CardMatchEvents, tables: CardMatchTables, generator: CardMatchLevelGenerator, options: Ca…`

> 원본 L104

#endregion

## `public startQuest(questId: string): boolean {`

> 원본 L114

#region Quest / round lifecycle

