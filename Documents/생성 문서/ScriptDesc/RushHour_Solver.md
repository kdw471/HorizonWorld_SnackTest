# RushHour_Solver.ts — 주석 아카이브

> 원본 스크립트: `RushHour_Solver.ts`
> 걷어낸 주석 33건 / 4,241 B 절감 (16,523 B → 12,282 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Rush Hour Solver - BFS 기반 최소 이동 수 탐색기

기획서 PUZ_02 §11.2:
  "BFS 솔버를 구현하여 최소 이동 수를 구하고, 레벨 생성기는 해가 존재하고
   6번의 배치 제약을 모두 만족하는 레벨만 출력하도록 한다.
   난이도는 최소 이동 수와 방해 오브젝트 수로 스케일링한다."

한 번의 "이동"은 한 오브젝트를 한 방향으로 1칸 이상 미는 것 전체를 뜻한다.
(클래식 러시아워의 관례와 동일)

성능을 위해 RushHourBoard 를 매 상태마다 복제하지 않고,
위치 배열 + 문자열 인코딩으로 직접 탐색한다.

#### Horizon 에디터 컴파일 제약 (실측)

에디터의 TypeScript 는 `target < ES2015` 이고 lib 에 TypedArray 가 없다.
  - `Set` / `Map` 이터레이터를 `for...of` 로 **직접 순회할 수 없다** -> `Array.from(...)` 으로 감싼다
  - `Int8Array` 등 TypedArray 를 쓸 수 없다 -> 일반 `number[]` 를 쓴다
로컬 `tsc` 는 target ES2020 이라 이 오류를 잡지 못하므로, 검증 명령(§6.1)으로 함께 확인한다.

## `export type RushHourSolution = {`

> 원본 L35

 솔버 탐색 결과

## `minimumMoves: number,`

> 원본 L38

 최소 이동 수. 풀 수 없으면 -1

## `moves: RushHourMove[],`

> 원본 L40

 최소 해의 이동 순서

## `exploredStates: number,`

> 원본 L42

 탐색한 상태 수 (난이도 추정에 참고)

## `isExhausted: boolean,`

> 원본 L44

 노드 한도에 걸려 탐색을 중단했는지

## `maxStates?: number,`

> 원본 L49

 탐색 상태 수 상한. 초과하면 탐색을 중단하고 isExhausted = true

## `reconstructPath?: boolean,`

> 원본 L51

 최소 해의 이동 순서까지 복원할지 (레벨 검증만 할 때는 false 로 두면 빠르다)

## `export type RushHourReachableState = {`

> 원본 L55

 도달 가능한 한 상태와 그 상태에서 해까지의 최소 이동 수

## `distanceToGoal: number,`

> 원본 L58

 이 배치에서 클리어까지 필요한 최소 이동 수

## `maxStates?: number,`

> 원본 L63

 탐색할 상태 수 상한

## `distanceMin?: number,`

> 원본 L65

 돌려받고 싶은 최소 이동 수 범위

## `maxResults?: number,`

> 원본 L68

 돌려받을 상태 수 상한

## `type GoalTarget = {`

> 원본 L76

 목표 오브젝트의 클리어 조건을 축 단위 단일 비교로 미리 환산해 둔 것

## `comparesRow: boolean,`

> 원본 L79

 true 면 row 값을, false 면 col 값을 비교한다

## `targetValue: number,`

> 원본 L81

 도달 시 가져야 하는 값

## `fixedValue: number,`

> 원본 L89

 축이 고정된 좌표(H 는 row, V 는 col). FREE 는 사용하지 않는다

## `public solve(board: RushHourBoard, options: RushHourSolverOptions = {}): RushHourSolution {`

> 원본 L106

보드의 현재 배치에서 클리어까지의 최소 이동 수를 구한다.
보드는 변경하지 않는다.

## `public isSolvable(board: RushHourBoard, maxStates: number = DEFAULT_MAX_STATES): boolean {`

> 원본 L190

 해가 존재하는지만 빠르게 확인한다 (경로 복원 없음)

## `public exploreReachableStates(board: RushHourBoard, options: RushHourExploreOptions = {}): RushHourReachableS…`

> 원본 L195

현재 배치에서 도달 가능한 모든 상태를 훑고, 각 상태의 "해까지 최소 이동 수"를 구한다.

슬라이딩 이동은 가역적이다(A 를 왼쪽으로 k 칸 밀었으면 오른쪽으로 k 칸 되돌릴 수 있다).
따라서 상태 그래프는 무향이고, 클리어 상태들로부터의 BFS 거리가 곧 그 배치의 최소 이동 수다.

레벨 생성기는 이 결과에서 원하는 난이도(거리)의 상태를 골라 시작 배치로 삼는다.
배치마다 솔버를 새로 돌리는 것보다 훨씬 빠르고, 최소 이동 수를 정확히 지정할 수 있다.

## `const startKey = this.encode(this._rows, this._cols);`

> 원본 L217

1단계: 시작 배치에서 도달 가능한 상태들을 모은다.

## `const distances = new Map<string, number>();`

> 원본 L239

2단계: 클리어 상태들에서 역방향 다중 시작 BFS 로 거리를 매긴다.

## `const results: RushHourReachableState[] = [];`

> 원본 L269

3단계: 요청한 거리 범위의 상태만 추려서 돌려준다.

## `private load(board: RushHourBoard): boolean {`

> 원본 L291

#region Internal - setup

## `private load(board: RushHourBoard): boolean {`

> 원본 L293

보드를 솔버 내부 표현으로 옮긴다.
목표 오브젝트가 자신의 색 도착 포인트와 동일 선상에 있지 않으면(기획서 §5.1 위반)
애초에 풀 수 없는 배치이므로 false 를 돌려준다.

## `if (getEndPointLaneIndex(endPoint) < 0) {`

> 원본 L331

축이 고정되어 있으므로 "동일 선상" 여부는 이동 중 바뀌지 않는다.
따라서 클리어 판정은 이동 축 좌표 하나의 비교로 환산할 수 있다.

## `private encode(rows: number[], cols: number[]): string {`

> 원본 L356

#endregion

## `private encode(rows: number[], cols: number[]): string {`

> 원본 L358

#region Internal - state helpers

## `private buildOccupancy(rows: number[], cols: number[]): number[] {`

> 원본 L376

 occupancy[row * size + col] = pieceIndex | -1

## `let leadRow = rows[index];`

> 원본 L394

슬라이딩이므로 진행 방향의 "선두 칸" 앞을 한 칸씩 확인하면 충분하다.

## `private forEachNeighbor(rows: number[], cols: number[], occupancy: number[], callback: (key: string) => void)…`

> 원본 L449

한 상태에서 가능한 모든 다음 상태의 키를 순회한다.
이웃마다 배열을 복제하면 탐색 비용이 크므로, 좌표를 제자리에서 바꿨다가 되돌린다.

## `private isGoalState(rows: number[], cols: number[]): boolean {`

> 원본 L472

 기획서 §11.3 - 목표가 2개면 둘 다 도달해야 클리어

## `}`

> 원본 L499

#endregion

