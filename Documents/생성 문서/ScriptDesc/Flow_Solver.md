# Flow_Solver.ts — 주석 아카이브

> 원본 스크립트: `Flow_Solver.ts`
> 걷어낸 주석 13건 / 2,349 B 절감 (7,507 B → 5,158 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Flow Solver - 모든 서브를 사용하는 해가 존재하는지 판정하는 탐색기 (PUZ_05)

이 퍼즐은 일반 Flow 와 달리 **모든 서브 오브젝트를 전부 사용**해야 클리어된다 (§5).
따라서 "각 색이 START ~ END 로 이어졌는가" 만 보면 안 되고,
색깔별 경로들이 **모든 SUB 칸을 빈틈없이 덮는가** 까지 봐야 한다 (§9.4).

즉 이 문제는 단순 경로 잇기가 아니라 **정점 서로소 경로 덮개(vertex-disjoint path cover)** 다.
색을 하나씩 탐욕적으로 이어서는 안 된다. 앞 색이 뒤 색의 길을 막거나 서브를 남기기 때문이다.

탐색 전략
  - 색을 순서대로 처리하며, 각 색의 경로를 깊이 우선으로 늘린다.
  - 한 색이 도착하면 다음 색으로 넘어가고, 마지막 색까지 끝나면 남은 SUB 가 없는지 확인한다.
  - 막다른 칸(주변에 갈 곳이 없는 미착색 SUB)이 생기면 즉시 되돌린다.

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `paths: { color: EFlowColor, cells: FlowCell[] }[],`

> 원본 L32

 색깔별 해 경로

## `maxStates?: number,`

> 원본 L39

 탐색 확장 횟수 상한

## `public solve(board: FlowBoard, options: FlowSolverOptions = {}): FlowSolution {`

> 원본 L50

모든 서브를 사용하는 해가 존재하는지 찾는다. 보드는 변경하지 않는다.
최단 해를 보장하지는 않는다 (검증이 목적이다).

## `const colors = working.colors.slice().sort();`

> 원본 L62

색 순서를 고정해 결과가 재현되게 한다

## `private solveColor(board: FlowBoard, colors: EFlowColor[], colorIndex: number): boolean {`

> 원본 L85

#region Internal

## `private solveColor(board: FlowBoard, colors: EFlowColor[], colorIndex: number): boolean {`

> 원본 L87

 `colorIndex` 번째 색부터 차례로 이어 본다

## `return board.getUncoloredSubCount() === 0;`

> 원본 L90

모든 색이 이어졌다. 이제 서브가 하나도 남지 않아야 클리어다 (§9.4)

## `private extendPath(board: FlowBoard, colors: EFlowColor[], colorIndex: number, end: FlowNode): boolean {`

> 원본 L106

 현재 색의 경로를 한 칸씩 늘려 도착 지점을 찾는다

## `if (head.row === end.row && head.col === end.col) {`

> 원본 L120

도착했다면 다음 색으로 넘어간다

## `if (this.hasDeadEnd(board, colors, colorIndex)) {`

> 원본 L125

갈 곳이 막힌 미착색 서브가 생겼다면 이 가지는 가망이 없다

## `candidates.sort((left, right) => this.countFreeNeighbors(board, left) - this.countFreeNeighbors(board, right)…`

> 원본 L135

선택지가 적은 칸부터 본다. 막다른 길을 먼저 소진해 가지치기를 빠르게 한다.

## `private hasDeadEnd(board: FlowBoard, colors: EFlowColor[], colorIndex: number): boolean {`

> 원본 L156

아직 색을 받지 못한 서브 칸 중, 어떤 경로도 도달할 수 없게 갇힌 것이 있는지 본다.

미착색 서브는 최소 2개의 "열린 이웃"이 있어야 지나갈 수 있다.
(들어오는 길 하나 + 나가는 길 하나. 서브는 입력 1 / 출력 1 뿐이다 - §4)
열린 이웃이란 미착색 서브이거나, 아직 쓰지 않은 메인 오브젝트이거나, 현재 경로의 머리다.

