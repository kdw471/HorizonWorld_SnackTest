# RushHour_Board.ts — 주석 아카이브

> 원본 스크립트: `RushHour_Board.ts`
> 걷어낸 주석 8건 / 1,972 B 절감 (19,565 B → 17,593 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Rush Hour Board - 9x9(플레이 7x7) 슬라이딩 블록 보드의 순수 상태 머신

기획서 PUZ_02 §3, §5, §7 을 구현한다.
 - 모든 오브젝트는 필드(7x7) 위에서만 이동하며 필드 밖으로 나갈 수 없다.
 - 오브젝트는 배치된 방향(H/V) 한 축으로만 이동한다. 1x1(FREE)만 전 방향 이동.
 - 오브젝트끼리 겹칠 수 없다. 한 영역에는 하나의 오브젝트만 들어갈 수 있다.
 - 슬라이딩이므로 다른 오브젝트를 통과할 수 없고, 가로막히면 그 직전 칸에서 멈춘다.

이 클래스는 horizon/core 에 의존하지 않는다 (PUZ_00 §7.1).
월드 좌표 <-> 격자 좌표 변환과 그랩/연출은 어댑터 계층의 책임이다.

#### Horizon 에디터 컴파일 제약 (실측)

에디터의 TypeScript 는 `target < ES2015` 이고 lib 에 TypedArray 가 없다.
  - `Set` / `Map` 이터레이터를 `for...of` 로 **직접 순회할 수 없다** -> `Array.from(...)` 으로 감싼다
  - `Int8Array` 등 TypedArray 를 쓸 수 없다 -> 일반 `number[]` 를 쓴다
로컬 `tsc` 는 target ES2020 이라 이 오류를 잡지 못하므로, 검증 명령(§6.1)으로 함께 확인한다.

## `export type RushHourSlideResult = {`

> 원본 L44

 슬라이드 시도 결과

## `steps: number,`

> 원본 L46

 실제로 이동한 칸 수. 0 이면 이동하지 못했다는 뜻

## `isRejected: boolean,`

> 원본 L48

 축이 맞지 않거나 대상이 없어 시도 자체가 불가능했는지

## `private readonly _blockedCells: string[] = [];`

> 원본 L57

 어떤 오브젝트도 들어갈 수 없는 칸 ("row,col" 로컬 좌표) - 필드 안쪽 도착 포인트

## `private readonly _dockedGoalIds = new Set<string>();`

> 원본 L59

 결합(삽입)된 목표 오브젝트 id - 모바일 사양 §9

## `private _occupancy: (string | null)[][] = [];`

> 원본 L62

 occupancy[row][col] = pieceId | null

## `for (const endPoint of this._endPoints) {`

> 원본 L85

기획 CSV 판은 도착 포인트가 7x7 안쪽 가장자리 칸에 있다.
그 칸은 USB 가 꽂히는 자리이므로 어떤 오브젝트도 들어갈 수 없다.
(생성기 판처럼 도착 포인트가 테두리 링에 있으면 애초에 닿지 않으므로 영향이 없다)

