# Flow_Board.ts — 주석 아카이브

> 원본 스크립트: `Flow_Board.ts`
> 걷어낸 주석 38건 / 3,837 B 절감 (12,768 B → 8,931 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Flow Board - 타일 비트맵 + 노드 + 색깔별 경로의 순수 상태 머신 (PUZ_05)

사양 §4 오브젝트 제약 / §5 핵심 플레이 규칙 / §9.2~§9.4 구현.

클리어 판정은 반드시 두 조건을 모두 본다 (§9.4).
  (a) 모든 색 경로가 START ~ END 로 완결
  (b) 모든 SUB 노드가 색을 부여받아 활성화

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

#### Horizon 에디터 컴파일 제약 (실측)

에디터의 TypeScript 는 `target < ES2015` 이고 lib 에 TypedArray 가 없다.
  - `Set` / `Map` 이터레이터를 `for...of` 로 **직접 순회할 수 없다** -> `Array.from(...)` 으로 감싼다
  - `Int8Array` 등 TypedArray 를 쓸 수 없다 -> 일반 `number[]` 를 쓴다
로컬 `tsc` 는 target ES2020 이라 이 오류를 잡지 못하므로, 검증 명령(§6.1)으로 함께 확인한다.

## `private readonly _paths = new Map<EFlowColor, FlowCell[]>();`

> 원본 L40

 색깔별 현재 경로 (출발 MAIN 부터 순서대로)

## `for (const node of Array.from(this._nodes.values())) {`

> 원본 L61

색깔별 경로를 비워 둔 채로 준비한다

## `public hasTile(row: number, col: number): boolean {`

> 원본 L75

#region Lookup

## `public getPath(color: EFlowColor): readonly FlowCell[] {`

> 원본 L88

 해당 색의 현재 경로

## `public getPathHead(color: EFlowColor): FlowCell | undefined {`

> 원본 L93

 경로의 머리(마지막으로 연결된 칸)

## `public getMain(color: EFlowColor, role: ENodeRole): FlowNode | undefined {`

> 원본 L102

 해당 색의 출발 / 도착 메인 오브젝트

## `public isPathComplete(color: EFlowColor): boolean {`

> 원본 L112

 경로가 START ~ END 로 완결되었는지

## `public getUncoloredSubCount(): number {`

> 원본 L125

 아직 색을 받지 못한 서브 오브젝트 수 - §5 "모든 서브 오브젝트가 활성화되어야 한다"

## `public canBeginAt(row: number, col: number): boolean {`

> 원본 L136

 이 칸에서 그리기를 시작할 수 있는지

## `public getBeginColor(row: number, col: number): EFlowColor | undefined {`

> 원본 L141

이 칸에서 그리기를 시작한다면 어떤 색이 되는지.
  - 아직 그리지 않은 색의 출발 메인 오브젝트
  - 이미 그린 경로의 머리 (이어 그리거나 되돌아가기)

## `for (const entry of Array.from(this._paths.entries())) {`

> 원본 L152

이미 그린 경로의 머리에서 이어 잡는다 - §6 지우기

## `if (node.kind === ENodeKind.MAIN && node.role === ENodeRole.START && node.color !== undefined) {`

> 원본 L164

§6 - 상호작용 가능한 오브젝트는 색상별로 하나뿐이며 게임 시작 시 출발점에 생성된다

## `public beginPath(color: EFlowColor): boolean {`

> 원본 L173

#endregion

## `public beginPath(color: EFlowColor): boolean {`

> 원본 L175

#region Path drawing (§5 / §9.2)

## `public beginPath(color: EFlowColor): boolean {`

> 원본 L177

 출발 메인 오브젝트에서 경로를 시작한다

## `return true;`

> 원본 L189

이미 그리는 중이면 그대로 이어 쓴다

## `public canExtend(color: EFlowColor, row: number, col: number): ExtendCheck {`

> 원본 L197

경로 확장 유효성 - §9.2.
  상하좌우 인접 AND 타일 존재 AND 대상이 SUB 이고 아직 색이 없음
  (도착 노드가 같은 색 MAIN(END) 이면 해당 색 경로 완성)

직전 칸으로 되돌아가는 이동은 되돌아가기(Undo)로 본다 - §6 / §9.3.

## `return { isValid: false, rejection: EExtendRejection.NOT_ADJACENT, isUndo: false };`

> 원본 L214

대각선이거나 떨어진 칸 - §5 "대각선 연결 불가"

## `if (path.length >= 2) {`

> 원본 L218

직전 칸으로 되돌아가면 지우기다 - §9.3

## `return { isValid: false, rejection: EExtendRejection.PATH_COMPLETE, isUndo: false };`

> 원본 L227

END 에 도달한 경로는 더 늘릴 수 없다

## `for (const cell of path) {`

> 원본 L240

자기 경로와 교차 금지 - §4 "서브는 단 하나의 입력과 하나의 출력만"

## `if (node.color === color && node.role === ENodeRole.END) {`

> 원본 L248

같은 색의 도착 지점이면 완성

## `if (node.color !== undefined) {`

> 원본 L255

§5 - 이미 다른 색상이 활성화된 영역은 지나갈 수 없다

## `public extend(color: EFlowColor, row: number, col: number): boolean {`

> 원본 L263

경로를 한 칸 확장하거나 되돌아간다.
성공하면 true. 되돌아간 경우에도 true 다 (`canExtend().isUndo` 로 구분한다).

## `const node = this.getNode(row, col);`

> 원본 L285

지나간 서브 오브젝트에 색을 부여한다 - §4

## `public popHead(color: EFlowColor): boolean {`

> 원본 L293

 경로의 머리를 하나 되돌린다 - §9.3 (스택 구조)

## `const node = this.getNode(removed.row, removed.col);`

> 원본 L305

서브 오브젝트였다면 색을 거둔다 (비활성화)

## `public clearPath(color: EFlowColor): void {`

> 원본 L313

 해당 색의 경로를 전부 지운다

## `public clearAllPaths(): void {`

> 원본 L324

 모든 경로를 지운다 (리셋)

## `public isSolved(): boolean {`

> 원본 L331

#endregion

## `public isSolved(): boolean {`

> 원본 L333

#region Clear condition (§9.4)

## `public isSolved(): boolean {`

> 원본 L335

클리어 판정 - §9.4. 두 조건을 모두 확인한다.
  (a) 모든 색 경로가 START ~ END 로 완결
  (b) 모든 SUB 노드의 color != null

남은 서브 오브젝트가 하나라도 있으면 클리어 불가다 (§5).

## `public getClearStatus(): { completedColors: EFlowColor[], incompleteColors: EFlowColor[], uncoloredSubCount: …`

> 원본 L356

 클리어 조건을 항목별로 돌려준다 - UI 표시용

## `public clone(): FlowBoard {`

> 원본 L375

#endregion

## `public clone(): FlowBoard {`

> 원본 L377

#region Serialization

## `public toDebugString(): string {`

> 원본 L397

디버그/2D 프로토타입용 덤프.
대문자 = 메인 오브젝트, 소문자 = 색을 받은 서브, `o` = 색 없는 서브, `.` = 타일 없음

## `}`

> 원본 L438

#endregion

