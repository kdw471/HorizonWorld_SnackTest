# ColorFill_Session.ts — 주석 아카이브

> 원본 스크립트: `ColorFill_Session.ts`
> 걷어낸 주석 11건 / 1,340 B 절감 (14,930 B → 13,590 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Color Fill Session - 라운드 / 제한시간 / 승패를 묶는 순수 상태 머신 (PUZ_04)

PUZ_00 §7.4 가 요구하는 "실패/성공 판정, 남은 시간, 라운드 진행도를 외부에서 조회 가능한 API".

승패 - §2
  클리어: 제한시간 내에 모든 오염 영역을 정화
  실패:   제한시간 내에 정화하지 못함

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `isTimeLimitPerRound?: boolean,`

> 원본 L31

 제한 시간을 라운드마다 리셋할지(기본 true) 퀘스트 전체에 한 번만 줄지

## `isInputLockedDuringReverse?: boolean,`

> 원본 L34

 방향 전환 딜레이 동안 입력을 잠글지 - §8.3

## `private _fieldOrdinal: number | undefined = undefined;`

> 원본 L52

레벨 모드에서 이번 판의 순번 (그 난이도의 판 목록에서 0-based).
undefined 면 기존처럼 아직 안 낸 판 중에서 무작위로 고른다.

## `private _roundCountOverride: number | undefined = undefined;`

> 원본 L57

 레벨 모드는 1라운드 고정. undefined 면 퀘스트 테이블의 roundCount 를 쓴다

## `private _usedPuzzleIds: string[] = [];`

> 원본 L64

이번 퀘스트에서 이미 낸 필드 테이블 행.
기획 CSV 를 붙인 뒤 난이도당 판이 여러 개가 됐으므로, 라운드마다 다른 판을 낸다.

## `private _lastSlotIndex: number = -1;`

> 원본 L73

 직전 프레임의 칸/방향 - 변화를 이벤트로 알리기 위해 기억한다

## `public get state(): EColorFillState {`

> 원본 L77

#region External query API (PUZ_00 §7.4)

## `public getRemainingContaminatedCount(): number {`

> 원본 L107

 남은 오염 칸 수 - UI 진행도 표시용

## `constructor(events: ColorFillEvents, tables: ColorFillTables, generator: ColorFillLevelGenerator, options: Co…`

> 원본 L112

#endregion

## `public startQuest(questId: string): boolean {`

> 원본 L123

#region Quest / round lifecycle

