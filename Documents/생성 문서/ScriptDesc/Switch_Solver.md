# Switch_Solver.ts — 주석 아카이브

> 원본 스크립트: `Switch_Solver.ts`
> 걷어낸 주석 19건 / 2,459 B 절감 (6,755 B → 4,296 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Switch Solver - GF(2) 선형대수 솔버 (PUZ_08 §9.4 선택 항목)

Lights Out 계열은 다음 성질을 가진다.
  - 토글은 자기역원: 같은 칸을 두 번 누르면 상쇄된다
  - 누름 순서는 결과에 영향이 없다
따라서 "어떤 칸들을 (홀수 번) 누를 것인가"만 정하면 되고,
이는 GF(2) 위의 연립방정식 A·x = b 로 정확히 풀린다.

  변수 x_j  : FREE 가 아닌 칸 j 를 누를지 (0/1)
  방정식 i  : 칸 i 를 반전시키는 누름들의 합 ≡ b_i (mod 2)
  b_i       : 칸 i 가 지금 안 눌림(0)이면 1 (반전 필요), 눌림(1)이면 0

가우스 소거로 해의 존재를 판정하고, 자유 변수가 적으면(≤16) 전수 열거로
**최소 누름 해**를 찾는다. 역셔플 생성기의 결과 검증과 난이도 실측에 쓴다.

구현 노트: 변수·방정식이 최대 25개이므로 행 하나를 32비트 정수 비트마스크로
표현한다 (계수 25비트 + RHS 1비트).

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `isSolvable: boolean,`

> 원본 L30

 해가 존재하는지

## `pressPositions: number[],`

> 원본 L32

 눌러야 하는 칸들 (순서 무관). 해가 없으면 빈 배열

## `pressCount: number,`

> 원본 L34

 pressPositions.length 와 같다

## `isMinimal: boolean,`

> 원본 L36

 자유 변수 전수 열거로 최소성이 보장되었는지. false 면 "어떤 해"일 뿐이다

## `const MAX_FREE_VARIABLES_FOR_ENUMERATION = 16;`

> 원본 L40

 자유 변수가 이 수를 넘으면 최소 해 열거를 포기하고 특수해만 돌려준다

## `public solve(grid: readonly ESwitchCellState[], mask: readonly number[]): SwitchSolution {`

> 원본 L45

현재 격자를 "모든 키 눌림" 상태로 만드는 누름 집합을 찾는다.
이미 완성 상태면 빈 해(0회)를 돌려준다.

## `const varIndexByPosition = new Map<number, number>();`

> 원본 L56

칸 위치 -> 변수 번호

## `const rows: number[] = [];`

> 원본 L62

방정식 구성: rows[i] = (계수 비트마스크) | (b_i << cellCount)
"칸 j 를 누르면 칸 i 가 반전된다" ⇔ i ∈ getToggledPositions(j)

## `const pivotRowByColumn = new Array<number>(cellCount).fill(-1);`

> 원본 L80

가우스 소거 (전진 소거 + 피벗 기록)

## `const coefficientMask = rhsBit - 1;`

> 원본 L106

모순 검사: 계수가 전부 0인데 RHS 가 1인 행이 있으면 해가 없다

## `let particular = 0;`

> 원본 L114

특수해: 자유 변수 = 0. 완전 소거된 상태이므로 피벗 열 값 = 해당 행의 RHS

## `const freeColumns: number[] = [];`

> 원본 L123

커널 기저: 자유 변수 하나를 1로 두었을 때의 해 (RHS 없이 피벗 열만 채움)

## `let best = particular;`

> 원본 L142

최소 해: particular ⊕ (커널 기저의 부분합) 을 전수 열거

## `let current = particular;`

> 원본 L149

Gray 코드 순회로 조합마다 XOR 1회만 쓴다

## `public isSolvable(grid: readonly ESwitchCellState[], mask: readonly number[]): boolean {`

> 원본 L175

 해의 존재 여부만 빠르게 확인한다

## `function popCount(value: number): number {`

> 원본 L181

#region Bit helpers

## `function lowestSetBitIndex(value: number): number {`

> 원본 L193

 가장 낮은 1 비트의 인덱스 (value > 0 전제)

## `(파일 끝)`

> 원본 L204

#endregion

