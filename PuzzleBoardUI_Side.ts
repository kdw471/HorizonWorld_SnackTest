/**
 * Puzzle Board UI Side - 보조 레이아웃의 **정보 미니 격자**
 *
 * 판을 푸는 데 필요한 정보를 작은 격자로 보여 준다 - 스위치 퍼즐의 동시 눌림 영역
 * (PUZ_08 §9.5)이 지금 유일한 사용처다. **표시 전용이라 누를 수 없다** - 조작은 언제나
 * 본 격자와 트레이에서만 일어난다.
 *
 * 규격에 `side` 를 적은 퍼즐만 이 화면을 갖는다 (`PuzzleBoardLayoutSpec.side`).
 * 나머지 퍼즐에서는 패널이 이 노드를 마운트하지 않는다
 * (`PuzzleBoardUIPanel.createAuxContent()` 의 `UINode.if`).
 */

import { Binding, DynamicList, Text, UINode, View } from 'horizon/ui';
import {
	PUZZLE_BOARD_SIDE_MAX_CELLS,
	PUZZLE_BOARD_SIDE_MAX_COLS,
	PUZZLE_BOARD_SIDE_MAX_ROWS,
	PuzzleBoardCellView,
	PuzzleBoardSideView,
	createCellView,
} from 'PuzzleBoardUI_Definitions';
import { auxAreaFraction } from 'PuzzleUI_RelativeLayout';
import { fitFontSize } from 'PuzzleUI_Layout';
import {
	BoardMetrics,
	COLOR_TEXT,
	createSlotBindings,
	indexRange,
	toColor,
} from 'PuzzleBoardUI_Parts';

/** 미니 격자가 보조 레이아웃 높이에서 차지하는 몫 - 글자 크기를 뽑는 데 쓴다 */
const SIDE_GRID_HEIGHT_USAGE = 0.6;
/** 숨긴 칸의 불투명도 - 0 이면 자리는 차지하되 보이지 않는다 (격자 모양이 유지된다) */
const HIDDEN_CELL_OPACITY = 0;

/** 정보 미니 격자 한 벌. 패널이 하나 만들어 두고 `createNode()` 로 트리에 끼운다 */
export class BoardSideRenderer {
	private readonly _metrics: BoardMetrics;

	private readonly _label: Binding<string> = new Binding<string>('');
	private readonly _cellBindings: Binding<PuzzleBoardCellView>[] =
		createSlotBindings(PUZZLE_BOARD_SIDE_MAX_CELLS, createCellView);
	private readonly _rowIndices: Binding<number[]> = new Binding<number[]>([]);
	private readonly _colIndices: Binding<number[]> = new Binding<number[]>([]);

	/** 지금 미니 격자의 열 수. 칸 번호를 슬롯 번호로 바꾸는 데 쓴다 */
	private _colCount: number = 0;

	private readonly _rowNodeCache: (UINode | undefined)[] = new Array(PUZZLE_BOARD_SIDE_MAX_ROWS);
	private readonly _cellNodeCache: (UINode | undefined)[] = new Array(PUZZLE_BOARD_SIDE_MAX_CELLS);

	constructor(metrics: BoardMetrics) {
		this._metrics = metrics;
	}

	//#region Panel-facing API

	/** 레벨이 올라왔다. `side` 가 없는 퍼즐이면 `undefined` 가 온다 */
	public applyView(side: PuzzleBoardSideView | undefined): void {
		this._colCount = side === undefined ? 0 : side.colCount;
		this._label.set(side === undefined ? '' : side.label);

		// 본 격자와 같은 이유로 실제 크기만큼만 채운다
		const rowLimit = side === undefined ? 0 : Math.min(side.rowCount, PUZZLE_BOARD_SIDE_MAX_ROWS);
		const colLimit = side === undefined ? 0 : Math.min(side.colCount, PUZZLE_BOARD_SIDE_MAX_COLS);
		for (let row = 0; row < rowLimit; row++) {
			for (let col = 0; col < colLimit; col++) {
				const slot = row * PUZZLE_BOARD_SIDE_MAX_COLS + col;
				const cell = side === undefined ? undefined : side.cells[row * side.colCount + col];
				this._cellBindings[slot].set(cell === undefined ? createCellView() : cell);
			}
		}

		// 본 격자와 같은 이유로 **내용을 먼저 채운 뒤에** 목록을 늘린다
		this._rowIndices.set(indexRange(rowLimit));
		this._colIndices.set(indexRange(colLimit));
	}

	/** 미니 격자의 칸 하나가 바뀌었다 */
	public applyCell(index: number, cell: PuzzleBoardCellView): void {
		if (this._colCount <= 0) {
			return;
		}
		const row = Math.floor(index / this._colCount);
		const col = index % this._colCount;
		const binding = this._cellBindings[row * PUZZLE_BOARD_SIDE_MAX_COLS + col];
		if (binding === undefined) {
			return;
		}
		binding.set(cell);
	}

	/** 보드가 내려갔다 */
	public reset(): void {
		this._colCount = 0;
		this._label.set('');
		this._rowIndices.set([]);
		this._colIndices.set([]);
	}

	//#endregion

	//#region Nodes

	public createNode(): UINode {
		const metrics = this._metrics;
		// 글자 크기에만 쓰는 좌표 단위 - 상자 자체는 아래에서 퍼센트로 잡는다
		const sideSide = metrics.units(auxAreaFraction(metrics.layout()) * SIDE_GRID_HEIGHT_USAGE);

		// 본 격자와 같은 이유로 `DynamicList` 다 (`BoardGridRenderer.createNode()` 주석)
		const grid = DynamicList<number>({
			data: this._rowIndices,
			renderItem: (row: number) => this.getRowNode(row),
			// 미니 격자도 정사각형이다 - 세로를 채우고 가로를 거기에 맞춘다
			style: { height: '82%', aspectRatio: 1, flexDirection: 'column', marginTop: '2%' },
		});

		const label = Text({
			text: this._label,
			style: {
				color: COLOR_TEXT,
				fontSize: fitFontSize(sideSide, {
					ratio: 0.14, minimum: 11, maximum: 20,
					scale: metrics.fontScale(), pixelScale: metrics.pixelScale(),
				}),
				textAlign: 'center',
				width: '100%',
				opacity: 0.8,
			},
		});

		return View({
			children: [label, grid],
			style: {
				height: '84%',
				marginLeft: '3%',
				alignItems: 'center',
			},
		});
	}

	/** 행/칸 노드도 본 격자와 같은 이유로 자리마다 한 번만 만든다 */
	private getRowNode(row: number): UINode {
		let node = this._rowNodeCache[row];
		if (node === undefined) {
			node = DynamicList<number>({
				data: this._colIndices,
				renderItem: (col: number) => this.getCellNode(row, col),
				style: { flex: 1, width: '100%', flexDirection: 'row' },
			});
			this._rowNodeCache[row] = node;
		}
		return node;
	}

	private getCellNode(row: number, col: number): UINode {
		const slot = row * PUZZLE_BOARD_SIDE_MAX_COLS + col;
		let node = this._cellNodeCache[slot];
		if (node === undefined) {
			node = this.createCell(this._cellBindings[slot]);
			this._cellNodeCache[slot] = node;
		}
		return node;
	}

	/** 미니 격자의 칸 하나 - 표시 전용이라 색과 진하기만 있다 */
	private createCell(binding: Binding<PuzzleBoardCellView>): UINode {
		return View({
			children: [],
			style: {
				flex: 1,
				margin: '4%',
				borderRadius: this._metrics.px(6),
				opacity: binding.derive((cell) => (cell.isVisible ? 1 : HIDDEN_CELL_OPACITY)),
				backgroundColor: binding.derive((cell) => toColor(cell.fill)),
			},
		});
	}

	//#endregion
}
