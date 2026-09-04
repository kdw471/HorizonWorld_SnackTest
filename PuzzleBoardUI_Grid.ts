/**
 * Puzzle Board UI Grid - **본 격자**
 *
 * 8개 퍼즐이 전부 여기를 쓴다. 판 그림 · 정사각 판 · 칸 격자가 이 파일에 있고,
 * 패널은 `createNode()` 로 받아 화면 위쪽 7/10 자리에 끼우기만 한다.
 *
 * ## 왜 `DynamicList` 로 그리는가 - 패널 크기 한도 64kB
 *
 * 예전에는 최대 격자(9×9)의 칸 81개를 `initializeUI()` 에서 전부 만들어 두고 격자 밖은
 * `display: none` 으로 숨겼다. 그런데 `initializeUI()` 가 돌려주는 트리는 통째로
 * 직렬화되어 패널에 실리므로, 칸 하나의 트리(누름 껍데기·얼굴·글자·무늬·테두리·고리)가
 * 81벌 복제되어 86kB 가 되었고 **패널이 아예 만들어지지 않았다**
 * (`Failed to instantiate ... exceeds the maximum allowed size of 64kB`).
 *
 * `DynamicList` 는 `renderItem` 을 런타임에 부르므로 트리에는 **템플릿 한 벌만** 실린다.
 * 그래서 9×9 를 유지하면서도 패널 크기가 한도 아래로 내려간다.
 *
 * 칸의 내용은 여전히 `_cellBindings[슬롯]` 이 나른다. 목록이 나르는 것은 자리 번호뿐이라
 * 칸 하나가 바뀔 때 목록을 다시 그리지 않는다 - 드래그 중의 갱신 비용은 예전과 같다.
 * 목록의 길이가 곧 격자의 크기이므로 **행·칸의 `display` 숨김이 필요 없어졌다.**
 *
 * 그래서 **UI 트리의 자리(슬롯)와 퍼즐의 칸 번호가 다르다.**
 *
 *   슬롯 번호 = row * PUZZLE_BOARD_MAX_COLS + col      (고정 9열 기준, Binding 배열의 색인)
 *   칸  번호 = row * 현재 colCount        + col        (퍼즐 로직이 쓰는 row-major)
 *
 * 칸 번호를 다루는 쪽(입력·프레젠터)은 패널이고, 여기서는 슬롯 번호만 쓴다.
 */

import { Color } from 'horizon/core';
import { Bindable, Binding, DynamicList, Image, Pressable, Text, UINode, View } from 'horizon/ui';
import {
	EBoardCellAccent,
	NO_TEXTURE,
	PUZZLE_BOARD_MAX_CELLS,
	PUZZLE_BOARD_MAX_COLS,
	PUZZLE_BOARD_MAX_ROWS,
	PuzzleBoardCellView,
	PuzzleBoardGridView,
	PuzzleTextureKey,
	createCellView,
	getGlyphRotation,
} from 'PuzzleBoardUI_Definitions';
import { cellFraction, computeGridBox, percentText } from 'PuzzleUI_RelativeLayout';
import { clampNumber, fitFontSize } from 'PuzzleUI_Layout';
import { PuzzleTextureLibrary } from 'PuzzleBoardUI_TextureLibrary';
import {
	BoardMetrics,
	CELL_CORNER_RADIUS,
	NO_PRESSED_SLOT,
	createBorderOverlay,
	createGlyphFrame,
	createGrabRing,
	createLabelVisibility,
	createSlotBindings,
	createTextureLayer,
	getAccentBorderColor,
	getAccentBorderWidth,
	getAccentOpacity,
	getAccentScale,
	indexRange,
	mergePressAccent,
	toColor,
} from 'PuzzleBoardUI_Parts';

//#region Style constants

/** 판 배경 그림의 모서리 둥글기 (px) */
const BOARD_CORNER_RADIUS = 12;
/** 보드 메인 패널의 모서리 둥글기 (px) */
const BOARD_PANEL_CORNER_RADIUS = 18;
/**
 * 보드 메인 패널의 바탕 - 화면 배경과 보조 레이아웃 사이의 밝기다.
 *
 * 정사각 판(러시아워 9×9)은 직사각 패널 안에서 가운데로 모이므로 좌우가 남는다.
 * 그 남는 자리가 화면 배경과 같은 색이면 판의 경계가 사라져 "어디까지가 판인지" 가
 * 보이지 않는다. 그래서 패널에 자기 바탕을 준다.
 */
const COLOR_BOARD_PANEL = new Color(0.1, 0.11, 0.16);

//#endregion

/** 격자가 패널에 되돌려 주는 입력 - 전부 **슬롯 좌표(row, col)** 로 온다 */
export type BoardGridHandlers = {
	onCellPress(row: number, col: number): void,
	onCellEnter(row: number, col: number): void,
	onCellExit(row: number, col: number): void,
	onCellRelease(): void,
};

/** 본 격자 한 벌. 패널이 하나 만들어 두고 `createNode()` 로 트리에 끼운다 */
export class BoardGridRenderer {
	private readonly _metrics: BoardMetrics;
	private readonly _handlers: BoardGridHandlers;
	/** 칸 사이 간격 (칸 대비 %) - 패널 prop 에서 온다 */
	private readonly _cellGapValue: number;

	private readonly _cellBindings: Binding<PuzzleBoardCellView>[] =
		createSlotBindings(PUZZLE_BOARD_MAX_CELLS, createCellView);
	private readonly _rowIndices: Binding<number[]> = new Binding<number[]>([]);
	private readonly _colIndices: Binding<number[]> = new Binding<number[]>([]);

	/**
	 * 손가락이 지금 짚고 있는지를 **자리마다 하나씩** 든 Binding.
	 *
	 * 칸의 스냅샷과 **따로** 둔다. 그래야 세션이 칸을 다시 칠해도 누름 표시가 지워지지 않고,
	 * 반대로 누름 표시가 퍼즐이 준 강조를 덮어쓰지도 않는다 - 둘은 렌더 시점에 합쳐진다.
	 *
	 * **전역 슬롯 번호 Binding 하나로 두면 안 된다.** 모든 칸이 그 하나에서 파생하므로,
	 * 짚은 자리가 한 칸 옮겨질 때마다 81칸 × 파생 속성 여러 개가 전부 다시 계산되어
	 * 탭·드래그마다 조작이 끊겼다. 자리마다 나누면 바뀐 두 자리만 다시 그린다.
	 */
	private readonly _pressedFlags: Binding<boolean>[] =
		createSlotBindings(PUZZLE_BOARD_MAX_CELLS, () => false);

	/** 격자 상자의 크기 - **정사각 판 대비 %** (`computeGridBox`) */
	private readonly _gridWidth: Binding<string> = new Binding<string>('0%');
	private readonly _gridHeight: Binding<string> = new Binding<string>('0%');
	/**
	 * 지금 판의 칸 한 변 (좌표 단위). **글자 크기와 띄우기 거리에만 쓴다** -
	 * 칸의 크기 자체는 상대 배치가 정한다 (`computeGridBox`).
	 */
	private readonly _cellSide: Binding<number> = new Binding<number>(0);
	/** 집은 조각을 손가락 위로 띄우는 거리 (px) - 칸 크기 × 퍼즐이 준 배수 */
	private readonly _grabLift: Binding<number> = new Binding<number>(0);
	/** 집은 조각을 띄울지 - **퍼즐이 정한다** (`PuzzleBoardLayoutSpec.liftGrabbedPiece`) */
	private readonly _liftEnabled: Binding<boolean> = new Binding<boolean>(false);
	/** 판 배경 그림의 키 */
	private readonly _boardTexture: Binding<PuzzleTextureKey> = new Binding<PuzzleTextureKey>(NO_TEXTURE);

	/**
	 * 칸 글자 크기 - **파생 하나를 모든 칸이 나눠 쓴다.**
	 *
	 * 예전에는 칸을 만들 때마다 `_cellSide.derive(...)` 를 불러 파생 바인딩이 81개
	 * 등록되었다. 값은 전부 같으므로 하나면 된다 - 패널 데이터 모델에 등록되는 키 수가
	 * 곧 재렌더 비용이다.
	 *
	 * **필드 초기화가 아니라 생성자에서 만든다.** `derive()` 는 파생 함수를 그 자리에서
	 * 한 번 부르는데, 필드 초기화 시점에는 `_metrics` 가 아직 대입되지 않아 그 안에서
	 * `metrics.auxHeightUnits()` 를 타면 터진다 (패널에서 `this.props` 를 필드 초기화 때
	 * 읽어 컴포넌트가 통째로 만들어지지 않았던 것과 같은 함정이다).
	 */
	private _cellFontSize: Bindable<number> = 0;

	/** 띄우기 배수 - 레벨이 올라올 때 규격에서 받는다 */
	private _grabLiftRatio: number = 0;
	private _pressedSlot: number = NO_PRESSED_SLOT;
	/** 디버그 표시가 읽는 마지막 계산값 - 화면에 그려지는 것과 대조하는 용도다 */
	private _lastCellSide: number = 0;
	private _gridBoxLabel: string = '-';

	/**
	 * `DynamicList.renderItem` 이 돌려줄 노드를 자리마다 한 번만 만들어 재사용한다.
	 *
	 * `renderItem` 은 목록 데이터가 바뀔 때마다(레벨 로드/퍼즐 전환) 다시 불리는데,
	 * 그때마다 칸 트리를 새로 만들면 공유 Binding 에서 파생한 Binding 이 판 갈이마다
	 * 새로 쌓인다. 자리·내용 Binding 은 처음부터 고정이므로 노드도 한 번 만든 것을
	 * 그대로 돌려주면 된다 - 갱신은 Binding 이 알아서 한다.
	 */
	private readonly _rowNodeCache: (UINode | undefined)[] = new Array(PUZZLE_BOARD_MAX_ROWS);
	private readonly _cellNodeCache: (UINode | undefined)[] = new Array(PUZZLE_BOARD_MAX_CELLS);

	constructor(metrics: BoardMetrics, handlers: BoardGridHandlers, cellGapPercent: number) {
		this._metrics = metrics;
		this._handlers = handlers;
		this._cellGapValue = clampNumber(cellGapPercent, 0, 20);
		// `_metrics` 를 대입한 **뒤에** 파생을 만든다 (`_cellFontSize` 주석)
		this._cellFontSize = this._cellSide.derive((side) => this.cellFontSize(side));
	}

	//#region Panel-facing API

	/** 레벨이 올라왔다 - 격자 크기와 칸 내용을 전부 다시 잡는다 */
	public applyView(
		grid: PuzzleBoardGridView,
		boardTexture: PuzzleTextureKey,
		liftGrabbedPiece: boolean,
		grabLiftCellRatio: number,
	): void {
		this._boardTexture.set(boardTexture);
		this._liftEnabled.set(liftGrabbedPiece);

		// 격자 상자를 **정사각형 판 대비 %** 로 앉힌다. 판이 정사각형이라 가로 %와 세로 %가
		// 같은 길이 단위이고, 그래서 행·칸을 `flex: 1` 로 나누면 칸이 정확히 정사각형이 된다
		// (`PuzzleUI_RelativeLayout` 머리말 §2). 픽셀 계산이 사라진 자리다.
		const box = computeGridBox(grid.rowCount, grid.colCount);
		this._gridWidth.set(percentText(box.widthPercent));
		this._gridHeight.set(percentText(box.heightPercent));

		// 칸 한 변을 좌표 단위로도 담아 둔다 - 글자 크기와 띄우기 거리는 숫자여야 한다
		const cell = this._metrics.units(cellFraction(
			this._metrics.layout(), this._metrics.screenAspect(), grid.rowCount, grid.colCount).ofHeight);
		this._cellSide.set(cell);
		// 띄우기 배수는 퍼즐이 정한다 - 환산보다 먼저 받아 둔다
		this._grabLiftRatio = grabLiftCellRatio;
		this._grabLift.set(this.grabLiftPixels(cell));

		this._lastCellSide = cell;
		this._gridBoxLabel = `${grid.rowCount}x${grid.colCount} `
			+ `${Math.round(box.widthPercent)}%x${Math.round(box.heightPercent)}%`;

		// **새 격자 안의 자리만 채운다.** 격자 밖 자리는 목록이 짧아지며 트리에서 내려가므로
		// 값이 낡아 있어도 그려지지 않고, 나중에 더 큰 격자가 올라오면 그 레벨 로드가
		// 자기 격자 안의 자리를 전부 다시 채운다. 예전처럼 최대 격자(81칸)를 매번 돌면
		// 레벨 로드마다 안 쓰는 자리까지 Binding 갱신이 나가 판 갈이가 무거워진다.
		const rowLimit = Math.min(grid.rowCount, PUZZLE_BOARD_MAX_ROWS);
		const colLimit = Math.min(grid.colCount, PUZZLE_BOARD_MAX_COLS);
		for (let row = 0; row < rowLimit; row++) {
			for (let col = 0; col < colLimit; col++) {
				const slot = row * PUZZLE_BOARD_MAX_COLS + col;
				const cellView = grid.cells[row * grid.colCount + col];
				this._cellBindings[slot].set(cellView === undefined ? createCellView() : cellView);
			}
		}

		// 목록의 길이가 곧 격자의 크기다. **칸의 내용을 먼저 채운 뒤에** 목록을 늘린다 -
		// 반대로 하면 새 격자가 앞 레벨의 칸을 한 프레임 보여 준다.
		this._rowIndices.set(indexRange(rowLimit));
		this._colIndices.set(indexRange(colLimit));
	}

	/** 칸 하나가 바뀌었다. `slot` 은 고정 9열 기준 자리 번호다 */
	public applyCell(slot: number, cell: PuzzleBoardCellView): void {
		const binding = this._cellBindings[slot];
		if (binding === undefined) {
			return;
		}
		binding.set(cell);
	}

	/** 짚고 있는 자리를 옮긴다 - **바뀐 두 자리의 Binding 만** 갱신한다 (필드 주석 참고) */
	public setPressed(slot: number): void {
		if (slot === this._pressedSlot) {
			return;
		}
		const previous = this._pressedSlot;
		this._pressedSlot = slot;
		if (previous !== NO_PRESSED_SLOT) {
			this._pressedFlags[previous]?.set(false);
		}
		if (slot !== NO_PRESSED_SLOT) {
			this._pressedFlags[slot]?.set(true);
		}
	}

	/** 보드가 내려갔다 */
	public reset(): void {
		this._rowIndices.set([]);
		this._colIndices.set([]);
		this._gridWidth.set('0%');
		this._gridHeight.set('0%');
		this._cellSide.set(0);
		this._liftEnabled.set(false);
		this._lastCellSide = 0;
		this._gridBoxLabel = '-';
		this.setPressed(NO_PRESSED_SLOT);
	}

	/** 디버그 표시(`showLayoutDebug`)가 읽는 값 - 지금 칸 한 변 (좌표 단위) */
	public get cellSideUnits(): number {
		return this._lastCellSide;
	}

	/** 디버그 표시가 읽는 값 - 지금 격자 상자의 규격 문자열 */
	public get gridBoxLabel(): string {
		return this._gridBoxLabel;
	}

	//#endregion

	//#region Sizing helpers

	/** 지금 격자에서 칸 글자의 크기 (px). 칸이 정사각형이라 한 변만 있으면 된다 */
	private cellFontSize(cellSide: number): number {
		// 판이 아직 없으면 보조 레이아웃 높이를 기준으로 둔다 - 어차피 그려지지 않는 값이다
		const side = cellSide > 0 ? cellSide : this._metrics.auxHeightUnits();
		return fitFontSize(side, {
			ratio: 0.5, minimum: 12, maximum: 44,
			scale: this._metrics.fontScale(), pixelScale: this._metrics.pixelScale(),
		});
	}

	/**
	 * 집은 조각을 띄울 거리 (px) - **칸 한 변 × 퍼즐이 준 배수** 그대로다.
	 *
	 * 칸 크기는 이미 실제 해상도 픽셀이므로 해상도 배율을 따로 곱하지 않는다.
	 * 예전의 상·하한 클램프(64~150 기준픽셀)는 버렸다 - 배수가 에디터에서 조정하는
	 * 파라미터가 되면서, 클램프가 조정값을 조용히 무시하는 함정이 되기 때문이다.
	 */
	private grabLiftPixels(cellSide: number): number {
		const side = cellSide > 0 ? cellSide : this._metrics.auxHeightUnits();
		return Math.round(Math.max(0, side * this._grabLiftRatio));
	}

	//#endregion

	//#region Nodes

	/**
	 * 보드 메인 패널 - **본 격자 영역 안에서 가장 큰 정사각형**이다.
	 *
	 * 세로로 긴 폰에서는 `boardWidthPercent`(화면 가로) 가, 가로로 긴 화면에서는
	 * `boardHeightPercent`(영역 세로) 가 크기를 정한다. 둘 중 작은 쪽이 자동으로 이기므로
	 * 화면 방향을 보고 분기할 필요가 없다 (`PuzzleUI_RelativeLayout` 머리말 §1).
	 *
	 * 격자는 이 안에 판 비율대로 앉는다. 정사각형이 아닌 판(정렬 퍼즐의 4행 8열)은 위아래에
	 * 자리가 남는데, 패널 바탕이 없으면 그 남는 자리가 화면 배경과 구분되지 않아 판의
	 * 경계가 사라진다. 그래서 패널을 격자와 따로 그린다.
	 */
	public createNode(): UINode {
		const layout = this._metrics.layout();
		return View({
			children: [this.createGrid()],
			style: {
				// **정사각형을 만드는 한 줄.** 세로를 꽉 채우되 가로가 모자라면 가로에 맞춘다 -
				// CSS 의 `min(가로, 세로)` 와 같고, 실기 프로브에서 확인한 동작이다
				// (`PuzzleUI_RelativeLayout` 머리말 §1). 화면 방향에 따른 분기가 필요 없다.
				height: percentText(layout.boardHeightPercent),
				aspectRatio: 1,
				maxWidth: percentText(layout.boardWidthPercent),
				borderRadius: this._metrics.px(BOARD_PANEL_CORNER_RADIUS),
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: COLOR_BOARD_PANEL,
			},
		});
	}

	/**
	 * 격자 상자.
	 *
	 * **칸은 언제나 정사각형이다.** 격자 상자를 판의 비율대로 잡는 것이 그 방법이다 -
	 * 4행 8열이면 가로 100% · 세로 50%, 9행 3열이면 세로 100% · 가로 33% 다
	 * (`computeGridBox`). 판이 정사각형이라 두 퍼센트가 같은 길이 단위이므로, 그 안에서
	 * 행·칸을 `flex: 1` 로 나누면 칸이 정확한 정사각형으로 떨어진다.
	 *
	 * 예전에는 격자 상자를 판과 같은 정사각형으로 두고 행·열을 `flex: 1` 로 나눴다.
	 * 그러면 4행 8열(정렬)이나 5행 6열(색 채우기) 같은 판에서 칸이 눌리거나 늘어나
	 * 연결 퍼즐의 경로와 러시아워의 차량 비율이 실제 판과 달라 보였다.
	 */
	private createGrid(): UINode {
		const rows = DynamicList<number>({
			data: this._rowIndices,
			renderItem: (row: number) => this.getRowNode(row),
			style: {
				width: '100%',
				height: '100%',
				flexDirection: 'column',
			},
		});

		// 판 그림은 격자 **뒤에** 깔린다. 칸 사이 간격으로 비쳐 보이므로 나무판·회로기판처럼
		// 판 전체의 재질을 표현할 때 쓴다 (칸마다 다른 그림은 `cell.texture` 다).
		return View({
			children: [this.createBoardTextureLayer(), rows],
			style: {
				width: this._gridWidth,
				height: this._gridHeight,
			},
		});
	}

	private createBoardTextureLayer(): UINode {
		const library = PuzzleTextureLibrary.instance;
		const source = Binding.derive(
			[this._boardTexture, this._metrics.textureEpoch],
			(key: PuzzleTextureKey, _epoch: number) => library.resolve(key),
		);
		const hasTexture = Binding.derive(
			[this._boardTexture, this._metrics.textureEpoch],
			(key: PuzzleTextureKey, _epoch: number) => library.resolve(key) !== null,
		);
		// 그림이 없으면 노드를 올리지 않는다 - `createTextureLayer()` 와 같은 이유다
		return UINode.if(hasTexture, Image({
			source: source,
			style: {
				position: 'absolute',
				width: '100%',
				height: '100%',
				borderRadius: this._metrics.px(BOARD_CORNER_RADIUS),
				resizeMode: 'cover',
			},
		}));
	}

	/** 행 노드를 자리마다 한 번만 만든다 - 이유는 `_rowNodeCache` 주석 참고 */
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
		const slot = row * PUZZLE_BOARD_MAX_COLS + col;
		let node = this._cellNodeCache[slot];
		if (node === undefined) {
			node = this.createCell(this._cellBindings[slot], row, col);
			this._cellNodeCache[slot] = node;
		}
		return node;
	}

	/**
	 * 칸 하나.
	 *
	 * ## 왜 `Pressable` 과 "얼굴" 을 나누는가
	 *
	 * `Pressable` 에는 **크기를 바꾸는 스타일을 절대 걸지 않는다.** 예전에는 집은 칸을
	 * `transform: scale` 로 1.1배 키웠는데, 커진 칸이 이웃 칸을 덮어 이웃의 `onEnter` 가
	 * 늦게 떴다. 손가락은 이미 옆 칸에 가 있는데 조각이 따라오지 않아 **드래그가 끈적하게**
	 * 느껴지는 원인이었다.
	 *
	 * 그래서 `Pressable` 은 격자 한 칸의 자리만 지키는 투명한 껍데기로 두고, 색·테두리·그림자·
	 * 확대는 그 안에 겹쳐 놓은 층들이 맡는다. 입력 판정 영역은 언제나 칸 하나 그대로다.
	 *
	 * ## 왜 테두리와 무늬를 얼굴에서 떼어 냈는가
	 *
	 * 조작 강조(집음/놓을 자리/길)는 칸마다 테두리 두께를 0 -> 3 / 4 / 5 px 로 바꿔 놓는다.
	 * 이것을 **얼굴 자신의 `borderWidth` 로 주면 얼굴의 내용 상자가 그만큼 줄어든다.**
	 * 드래그 한 번에 여러 칸의 테두리가 켜졌다 꺼지면서 칸 안의 글자와 무늬가 매번 다시
	 * 자리를 잡았고, 그것이 "드래그 중에 판 격자가 조금씩 어긋난다" 로 보였다.
	 *
	 * 지금은 테두리와 무늬를 **`position: absolute` 층**으로 따로 그린다. 절대 배치된 층은
	 * 형제의 배치에 영향을 주지 않으므로, 드래그 내내 격자의 기하는 한 픽셀도 움직이지 않는다.
	 */
	private createCell(binding: Binding<PuzzleBoardCellView>, row: number, col: number): UINode {
		const metrics = this._metrics;
		const slot = row * PUZZLE_BOARD_MAX_COLS + col;

		/**
		 * 칸의 스냅샷과 "짚고 있는가" 를 렌더 시점에 합친다.
		 *
		 * 둘을 따로 두는 이유는 서로 덮어쓰지 않게 하기 위해서다 - 세션이 칸을 다시 칠해도
		 * 누름 표시는 지워지지 않고, 누름 표시가 퍼즐이 준 강조를 가리지도 않는다.
		 * 누름은 **이 자리의 플래그**에서만 파생한다 - 전역 슬롯 번호에서 파생하면
		 * 짚은 자리가 옮겨질 때마다 81칸 전부가 다시 계산된다 (필드 주석 참고).
		 */
		const pressedFlag = this._pressedFlags[slot];
		const fromAccent = <T>(map: (accent: EBoardCellAccent) => T) => Binding.derive(
			[binding, pressedFlag],
			(cell: PuzzleBoardCellView, isPressed: boolean) => map(mergePressAccent(cell.accent, isPressed)),
		);

		const scale = fromAccent(getAccentScale);
		const inset = percentText(this._cellGapValue);

		// 집은 조각을 손가락 위로 띄운다 - 이유와 거리 규칙은 `PuzzleBoardUI_Parts` 머리말 참고.
		// **띄우기는 퍼즐이 켠 경우에만 한다** (`_liftEnabled` - 지금은 레이저만 켠다).
		// 나머지 퍼즐은 예전처럼 확대·테두리·고리로만 강조한다.
		// `_grabLift`/`_liftEnabled` 는 레벨 로드 때만 바뀌므로 드래그 중 전체 재계산은 없다.
		const lift = Binding.derive(
			[binding, pressedFlag, this._grabLift, this._liftEnabled],
			(cell: PuzzleBoardCellView, isPressed: boolean, liftPixels: number, isLiftEnabled: boolean) =>
				(isLiftEnabled && mergePressAccent(cell.accent, isPressed) === EBoardCellAccent.GRABBED
					? -liftPixels
					: 0),
		);

		const face = View({
			children: [
				// 그림이 색 위에 온다. **그림이 있으면 글자는 물러난다** (`createLabelVisibility`)
				createTextureLayer<PuzzleBoardCellView>(
					metrics, binding, (cell) => cell.texture, (cell) => cell.fill, (cell) => cell.tint,
					CELL_CORNER_RADIUS),
				// 글자가 없는 칸은 Text 노드를 올리지 않는다 - 대부분의 퍼즐에서 대부분의 칸이
				// 빈 라벨이라, 상시 마운트하면 81개의 Text 가 렌더·글자 배치 비용만 낸다
				UINode.if(
					createLabelVisibility<PuzzleBoardCellView>(
						metrics, binding, (cell) => cell.label, (cell) => cell.texture),
					Text({
						text: binding.derive((cell) => cell.label),
						style: {
							color: binding.derive((cell) => toColor(cell.labelColor)),
							// 글자는 칸 크기를 따라간다 - 판이 작을수록 작게, 클수록 크게.
							// 파생 하나를 모든 칸이 나눠 쓴다 (`_cellFontSize` 주석).
							fontSize: this._cellFontSize,
							fontWeight: 'bold',
							textAlign: 'center',
							width: '100%',
							// 방향이 있는 부품은 글자를 돌려 그린다 - `L` 은 직각 코너를, `T` 는 막힌 변을
							// 그대로 본뜬 모양이라 돌리는 것만으로 네 방향이 구분된다
							transform: [{ rotate: binding.derive((cell) => getGlyphRotation(cell.glyph)) }],
						},
					}),
				),
			],
			style: {
				width: '100%',
				height: '100%',
				borderRadius: metrics.px(CELL_CORNER_RADIUS),
				alignItems: 'center',
				justifyContent: 'center',
				opacity: Binding.derive(
					[binding, pressedFlag],
					(cell: PuzzleBoardCellView, isPressed: boolean) =>
						getAccentOpacity(cell.isVisible, mergePressAccent(cell.accent, isPressed)),
				),
				backgroundColor: binding.derive((cell) => toColor(cell.fill)),
				// 집은 조각은 위로 떠오르고 살짝 커져서 손가락에 가리지 않는다.
				// 입력 판정은 바깥 Pressable 이 하므로 여기서 아무리 움직여도 안전하다.
				transform: [{ translateY: lift }, { scale: scale }],
				// 그림자는 쓰지 않는다 - 부드러운 그림자는 모바일에서 가장 비싼 스타일이라
				// 81칸이 저마다 선언하면 판 전체가 무거워진다. 집은 조각의 강조는
				// 확대(scale)·굵은 테두리·고리로 충분하다.
			},
		});

		return Pressable({
			children: [
				face,
				createGlyphFrame(metrics, binding, scale, CELL_CORNER_RADIUS, inset),
				createBorderOverlay(
					metrics,
					Binding.derive(
						[binding, pressedFlag],
						// 테두리 두께는 기준 캔버스 픽셀로 튜닝한 값이라 실제 해상도로 환산한다
						(cell: PuzzleBoardCellView, isPressed: boolean) => metrics.scaleBorderWidth(
							getAccentBorderWidth(mergePressAccent(cell.accent, isPressed), cell.isHighlighted)),
					),
					Binding.derive(
						[binding, pressedFlag],
						(cell: PuzzleBoardCellView, isPressed: boolean) =>
							getAccentBorderColor(mergePressAccent(cell.accent, isPressed), cell.isHighlighted),
					),
					scale,
					CELL_CORNER_RADIUS,
					inset,
				),
				createGrabRing(
					metrics,
					fromAccent((accent) => (accent === EBoardCellAccent.GRABBED ? 'flex' : 'none')),
					this._cellGapValue),
			],
			onPress: () => this._handlers.onCellPress(row, col),
			onEnter: () => this._handlers.onCellEnter(row, col),
			onExit: () => this._handlers.onCellExit(row, col),
			onRelease: () => this._handlers.onCellRelease(),
			// **전파를 막지 않는다.** 손가락이 누른 칸을 벗어나면 그 칸은 뗌을 받지 못하는데,
			// 전파까지 끊어 두면 조상도 못 받아 **놓기 판정이 통째로 사라진다**
			// (`onCellRelease()` 주석 - "한 번 더 눌러야 놓인다" 의 정체).
			// 조상(격자 상자·전면 캐처)은 손가락이 벗어날 수 없는 크기라 뗌을 확실히 받는다.
			// 여러 번 올라와도 `pointerUp()` 은 한 번만 일한다.
			style: {
				flex: 1,
				// 칸 사이 간격은 `margin` 이 아니라 `padding` 으로 낸다.
				//
				// margin 이면 간격이 **어느 칸에도 속하지 않는 죽은 영역**이 되어, 옆 칸으로
				// 끌고 갈 때 손가락이 그 위를 지나는 동안 "판 밖" 으로 읽힌다. 그 순간 끌던
				// 조각이 사라졌다 나타나 깜빡였다. padding 이면 간격까지 칸의 입력 영역이라
				// 이웃 칸끼리 맞닿고, 손가락은 언제나 어느 한 칸 위에 있다.
				//
				// %로 주는 이유: 칸이 정사각형이라 네 방향이 같은 길이가 되고, 겹쳐 놓는
				// 층들도 같은 %를 쓰면 얼굴에 정확히 맞는다.
				padding: inset,
				alignItems: 'center',
				justifyContent: 'center',
			},
		});
	}

	//#endregion
}
