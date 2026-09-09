# Laser_Session.ts — 주석 아카이브

> 원본 스크립트: `Laser_Session.ts`
> 걷어낸 주석 10건 / 1,884 B 절감 (17,627 B → 15,743 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Laser Session - 라운드 / 제한시간 / 승패를 묶는 순수 상태 머신 (PUZ_01)

PUZ_00 §7.4 가 요구하는 "실패/성공 판정, 남은 시간, 라운드 진행도를 외부에서 조회 가능한 API".
§8.2 에 따라 배치가 바뀔 때마다 광선을 즉시 재계산하고 BEAM_UPDATED 로 알린다.

플레이 플로우 (§8.5):
  퍼즐 시작 -> 크리스탈 지급 -> 배치/회수 반복 -> 실시간 광선 갱신 -> 클리어 판정 -> 라운드 진행(1~3회)

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `isTimeLimitPerRound?: boolean,`

> 원본 L32

 제한 시간을 라운드마다 리셋할지(기본 true) 퀘스트 전체에 한 번만 줄지

## `hintMaxPlacements?: number,`

> 원본 L35

 힌트 1회당 살펴볼 배치 조합 상한. 클라이언트가 멈추지 않을 정도로 묶어 둔다

## `const DEFAULT_HINT_MAX_PLACEMENTS = 50000;`

> 원본 L41

 힌트 탐색 기본 예산. 인벤토리 9개짜리 기획 레벨에서도 대략 0.3초 안에 끝난다

## `private _fieldOrdinal: number | undefined = undefined;`

> 원본 L58

레벨 모드에서 이번 판의 순번 (그 난이도의 판 목록에서 0-based).
undefined 면 기존처럼 아직 안 낸 판 중에서 무작위로 고른다.

## `private _roundCountOverride: number | undefined = undefined;`

> 원본 L63

 레벨 모드는 1라운드 고정. undefined 면 퀘스트 테이블의 roundCount 를 쓴다

## `private _usedPuzzleIds: string[] = [];`

> 원본 L71

이번 퀘스트에서 이미 낸 필드 테이블 행.
기획 CSV 를 붙인 뒤 난이도당 판이 여러 개가 됐으므로, 라운드마다 다른 판을 낸다.

## `public get state(): ELaserState {`

> 원본 L80

#region External query API (PUZ_00 §7.4)

## `public get lastTrace(): LaserTraceResult | undefined {`

> 원본 L98

 가장 최근 광선 추적 결과 - 연출 계층이 다시 계산할 필요가 없다

## `public getHintStep(): LaserSolutionStep | undefined {`

> 원본 L119

솔버가 찾은 해의 다음 한 수 (힌트 기능용).

기획 CSV 레벨은 인벤토리가 최대 9개라 완전 탐색이 수백만 조합으로 폭발한다.
힌트는 클라이언트에서 동기로 도는 만큼 탐색량을 묶어 두고,
예산 안에 못 찾으면 그냥 힌트 없음으로 처리한다.

