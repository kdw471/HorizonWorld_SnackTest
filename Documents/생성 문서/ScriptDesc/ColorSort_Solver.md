# ColorSort_Solver.ts — 주석 아카이브

> 원본 스크립트: `ColorSort_Solver.ts`
> 걷어낸 주석 14건 / 1,786 B 절감 (4,991 B → 3,205 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Color Sort Solver - 해가 존재하는지 판정하는 탐색기 (PUZ_03)

레벨 생성기가 만든 배치를 검증하는 데 쓴다 (PUZ_00 §7.3 "생성 후 솔버로 검증하고, 실패 시 재생성").

실제 보드의 `canMove()` / `move()` 를 그대로 호출해 탐색하므로,
블랙(미지) 건전지의 공개 타이밍과 "미공개는 빈 케이스로만" 규칙(§10.3)이 그대로 반영된다.
즉 솔버가 찾은 해는 플레이어가 실제로 둘 수 있는 수순이다.

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `exploredStates: number,`

> 원본 L24

 탐색한 상태 수

## `isExhausted: boolean,`

> 원본 L26

 노드 한도에 걸려 탐색을 중단했는지

## `maxStates?: number,`

> 원본 L31

 탐색 상태 수 상한

## `maxDepth?: number,`

> 원본 L33

 수순 길이 상한

## `private _visited = new Map<string, number>();`

> 원본 L44

 상태 -> 처음 확장했을 때의 깊이. 깊이 컷과 함께 쓰려면 Set 으로는 부족하다

## `public solve(board: ColorSortBoard, options: ColorSortSolverOptions = {}): ColorSortSolution {`

> 원본 L48

해가 존재하는지 깊이 우선으로 찾는다. 보드는 변경하지 않는다.
최단 수순을 보장하지는 않는다 (검증이 목적이다).

## `private search(board: ColorSortBoard, depth: number, steps: ColorSortSolutionStep[]): boolean {`

> 원본 L75

#region Internal

## `const key = board.getStateKey();`

> 원본 L89

깊이 한도(maxDepth) 때문에 실패한 상태를 무조건 가지치기하면,
같은 상태에 더 얕은 경로로 재도달했을 때 풀 수 있는 보드를 "해 없음"으로 오판한다.
그래서 "같거나 더 얕은 깊이로 이미 확장한" 경우에만 가지치기한다.

## `const next = board.clone();`

> 원본 L101

실제 보드 규칙으로 수를 두어야 공개 타이밍까지 정확히 반영된다.

## `private orderMoves(board: ColorSortBoard): { fromCaseIndex: number, toCaseIndex: number, count: number }[] {`

> 원본 L123

좋아 보이는 수를 먼저 본다.
색이 맞는 케이스로 합치는 수가 빈 케이스를 쓰는 수보다 대체로 낫다.

## `if (destination.batteries.length > 0) {`

> 원본 L140

빈 케이스가 아닌 곳에 합치면 케이스 하나를 아끼는 셈이다

## `if (source.batteries.length === move.count) {`

> 원본 L144

출발 케이스를 통째로 비우는 수는 자유도를 늘린다

## `}`

> 원본 L151

#endregion

