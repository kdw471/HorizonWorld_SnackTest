# Laser_Solver.ts — 주석 아카이브

> 원본 스크립트: `Laser_Solver.ts`
> 걷어낸 주석 16건 / 2,263 B 절감 (6,160 B → 3,897 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Laser Solver - 남은 크리스탈 배치 조합 탐색 (PUZ_01 §8.3)

사양 §8.3:
  "남은 크리스탈 조합을 5×5 빈 칸에 배치하는 탐색으로 해가 존재하는지 판정한다.
   레벨 생성기는 이 솔버로 검증된 레벨만 출력한다.
   (규칙 3.3에 따라 여분 크리스탈을 남기는 해도 정답으로 인정)"

따라서 **사용하는 크리스탈 수를 0개부터 하나씩 늘려가며** 탐색한다.
대부분의 레벨은 적은 수로 풀리므로 가장 얕은 해를 빠르게 찾는다.

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `export type LaserSolutionStep = {`

> 원본 L23

 해 한 개 - 어떤 크리스탈을 어디에 놓으면 되는지

## `steps: LaserSolutionStep[],`

> 원본 L32

 해를 이루는 배치. 빈 배열이면 아무것도 놓지 않아도 이미 풀린 상태다

## `usedCrystalCount: number,`

> 원본 L34

 해가 사용한 크리스탈 수 (난이도 스케일링에 쓴다)

## `exploredPlacements: number,`

> 원본 L36

 탐색한 배치 수

## `isExhausted: boolean,`

> 원본 L38

 노드 한도에 걸려 탐색을 중단했는지

## `maxPlacements?: number,`

> 원본 L43

 살펴볼 배치 조합 수 상한

## `maxCrystalsToUse?: number,`

> 원본 L45

 사용할 크리스탈 수 상한. 지정하지 않으면 인벤토리 전부

## `private _cells: LaserCell[] = [];`

> 원본 L56

탐색 대상 빈 칸 목록. 탐색 시작 시 한 번만 만들고 고정한다.
재귀 중에 다시 계산하면 크리스탈을 놓을 때마다 인덱스가 밀려
"칸 인덱스 단조 증가" 로 순열 중복을 없애는 최적화가 깨진다.

## `public solve(board: LaserBoard, options: LaserSolverOptions = {}): LaserSolution {`

> 원본 L67

현재 배치에서 인벤토리 크리스탈을 놓아 클리어할 수 있는지 판정한다.
보드는 변경하지 않는다 (내부에서 복제해 탐색한다).

## `if (this._tracer.traceAndCheck(working).isSolved) {`

> 원본 L80

아무것도 놓지 않아도 풀린 상태일 수 있다 (§3 3.3)

## `for (let useCount = 1; useCount <= maxToUse; useCount++) {`

> 원본 L85

사용 개수를 0 -> maxToUse 로 늘려가며 가장 얕은 해를 찾는다.

## `public isSolvable(board: LaserBoard, options: LaserSolverOptions = {}): boolean {`

> 원본 L105

 해가 존재하는지만 빠르게 확인한다

## `private search(board: LaserBoard, remaining: number, minCellIndex: number, steps: LaserSolutionStep[]): boole…`

> 원본 L110

#region Internal

## `private search(board: LaserBoard, remaining: number, minCellIndex: number, steps: LaserSolutionStep[]): boole…`

> 원본 L112

정확히 `remaining` 개를 더 놓아 클리어할 수 있는지 깊이 우선 탐색한다.

같은 종류·같은 방향의 크리스탈은 서로 구분할 필요가 없으므로 중복 조합을 건너뛴다.
또 배치 순서는 결과에 영향을 주지 않으므로 칸 인덱스를 단조 증가시켜 순열 중복을 없앤다.

## `const signature = this.getCrystalSignature(crystal);`

> 원본 L134

같은 종류·같은 방향이면 어느 것을 써도 결과가 같다

