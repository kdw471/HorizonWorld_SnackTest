# Switch_Session.ts — 주석 아카이브

> 원본 스크립트: `Switch_Session.ts`
> 걷어낸 주석 10건 / 1,393 B 절감 (17,446 B → 16,053 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Switch Session - 라운드 / 제한시간 / 승패를 묶는 순수 상태 머신 (PUZ_08)

PUZ_00 §7.4 가 요구하는 "실패/성공 판정, 남은 시간, 라운드 진행도를 외부에서 조회 가능한 API".

승패 - §2
  클리어: 제한 시간 안에 모든 키를 눌린 상태(녹색)로 만들면 클리어
  실패:   제한 시간 동안 모든 키를 누르지 못하면 실패

클리어 판정은 §7 연출이 끝나는 시점(0.4초)에 한다.

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `isTimeLimitPerRound?: boolean,`

> 원본 L36

 제한 시간을 라운드마다 리셋할지(기본 true) 퀘스트 전체에 한 번만 줄지

## `private _fieldOrdinal: number | undefined = undefined;`

> 원본 L54

레벨 모드에서 이번 판의 순번 (그 난이도의 판 목록에서 0-based).
undefined 면 기존처럼 아직 안 낸 판 중에서 무작위로 고른다.

## `private _roundCountOverride: number | undefined = undefined;`

> 원본 L59

 레벨 모드는 1라운드 고정. undefined 면 퀘스트 테이블의 roundCount 를 쓴다

## `private _usedFieldIndexes: number[] = [];`

> 원본 L66

이번 퀘스트에서 이미 낸 필드 데이터 index.
기획 CSV 를 붙인 뒤 난이도당 판이 14~23개가 됐으므로, 라운드마다 다른 판을 낸다.

## `public get state(): ESwitchPuzzleState {`

> 원본 L76

#region External query API (PUZ_00 §7.4)

## `public getUnpressedKeyCount(): number {`

> 원본 L110

 아직 눌리지 않은 키 캡 수 - 진행도 표시용

## `public getMask(): readonly number[] | undefined {`

> 원본 L115

 우측 미니 UI 에 표시할 스위치 영역 마스크 - §6 / §9.5

## `constructor(events: SwitchPuzzleEvents, tables: SwitchPuzzleTables, generator: SwitchLevelGenerator, options:…`

> 원본 L120

#endregion

## `public startQuest(questId: string): boolean {`

> 원본 L130

#region Quest / round lifecycle

