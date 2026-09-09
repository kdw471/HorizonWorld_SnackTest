# PuzzleBoardUI_Side.ts — 주석 아카이브

> 원본 스크립트: `PuzzleBoardUI_Side.ts`
> 걷어낸 주석 19건 / 1,914 B 절감 (6,299 B → 4,385 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Puzzle Board UI Side - 보조 레이아웃의 **정보 미니 격자**

판을 푸는 데 필요한 정보를 작은 격자로 보여 준다 - 스위치 퍼즐의 동시 눌림 영역
(PUZ_08 §9.5)이 지금 유일한 사용처다. **표시 전용이라 누를 수 없다** - 조작은 언제나
본 격자와 트레이에서만 일어난다.

규격에 `side` 를 적은 퍼즐만 이 화면을 갖는다 (`PuzzleBoardLayoutSpec.side`).
나머지 퍼즐에서는 패널이 이 노드를 마운트하지 않는다
(`PuzzleBoardUIPanel.createAuxContent()` 의 `UINode.if`).

## `const SIDE_GRID_HEIGHT_USAGE = 0.6;`

> 원본 L32

 미니 격자가 보조 레이아웃 높이에서 차지하는 몫 - 글자 크기를 뽑는 데 쓴다

## `const HIDDEN_CELL_OPACITY = 0;`

> 원본 L34

 숨긴 칸의 불투명도 - 0 이면 자리는 차지하되 보이지 않는다 (격자 모양이 유지된다)

## `export class BoardSideRenderer {`

> 원본 L37

 정보 미니 격자 한 벌. 패널이 하나 만들어 두고 `createNode()` 로 트리에 끼운다

## `private _colCount: number = 0;`

> 원본 L47

 지금 미니 격자의 열 수. 칸 번호를 슬롯 번호로 바꾸는 데 쓴다

## `public applyView(side: PuzzleBoardSideView | undefined): void {`

> 원본 L57

#region Panel-facing API

## `public applyView(side: PuzzleBoardSideView | undefined): void {`

> 원본 L59

 레벨이 올라왔다. `side` 가 없는 퍼즐이면 `undefined` 가 온다

## `const rowLimit = side === undefined ? 0 : Math.min(side.rowCount, PUZZLE_BOARD_SIDE_MAX_ROWS);`

> 원본 L64

본 격자와 같은 이유로 실제 크기만큼만 채운다

## `this._rowIndices.set(indexRange(rowLimit));`

> 원본 L75

본 격자와 같은 이유로 **내용을 먼저 채운 뒤에** 목록을 늘린다

## `public applyCell(index: number, cell: PuzzleBoardCellView): void {`

> 원본 L80

 미니 격자의 칸 하나가 바뀌었다

## `public reset(): void {`

> 원본 L94

 보드가 내려갔다

## `public createNode(): UINode {`

> 원본 L102

#endregion

## `public createNode(): UINode {`

> 원본 L104

#region Nodes

## `const sideSide = metrics.units(auxAreaFraction(metrics.layout()) * SIDE_GRID_HEIGHT_USAGE);`

> 원본 L108

글자 크기에만 쓰는 좌표 단위 - 상자 자체는 아래에서 퍼센트로 잡는다

## `const grid = DynamicList<number>({`

> 원본 L111

본 격자와 같은 이유로 `DynamicList` 다 (`BoardGridRenderer.createNode()` 주석)

## `style: { height: '82%', aspectRatio: 1, flexDirection: 'column', marginTop: '2%' },`

> 원본 L115

미니 격자도 정사각형이다 - 세로를 채우고 가로를 거기에 맞춘다

## `private getRowNode(row: number): UINode {`

> 원본 L143

 행/칸 노드도 본 격자와 같은 이유로 자리마다 한 번만 만든다

## `private createCell(binding: Binding<PuzzleBoardCellView>): UINode {`

> 원본 L167

 미니 격자의 칸 하나 - 표시 전용이라 색과 진하기만 있다

## `}`

> 원본 L181

#endregion

