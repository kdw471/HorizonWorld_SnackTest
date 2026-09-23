/**
 * NoesisRushHour_Panel — Noesis UI 로 그린 퍼즐 보드판 + 러시아워 한 판 (테스트 전용)
 *
 * `NoesisDragLab_Panel` 의 B 방식(네이티브 드래그 + 놓을 때 스냅)이 실기에서 동작한 것을 받아,
 * 기존 `PuzzleBoardUI_Panel` 과 같은 화면 규격으로 옮긴 것이다. 짝이 되는 XAML 은
 * `Documents/NoesisSample/NoesisRushHour/RushHourBoard.xaml` 이다.
 *
 *      ┌──────────────────────────────┐
 *      │  위 여백 6%  (제목 · 이동 수)    │
 *      │ ┌──────────────────────────┐ │
 *      │ │   보드 (정사각형, 7x7)      │ │  남은 세로의 70%
 *      │ └──────────────────────────┘ │
 *      │ ┌──────────────────────────┐ │
 *      │ │  안내 글 · Reset            │ │  남은 세로의 30% (보조 레이아웃)
 *      │ └──────────────────────────┘ │
 *      │  아래 여백 8%  (진단 글 · Menu)  │
 *      └──────────────────────────────┘
 *
 * 비율은 `PuzzleUI_RelativeLayout` 의 상수를 그대로 가져다 쓴다. 띠(위·보조·아래)는 XAML 의
 * star 행이 네이티브로 나누고, **보드와 조각은 이 스크립트가 루트 px 로 계산해 바인딩으로 넘긴다.**
 *
 * ## 왜 보드만 스크립트가 계산하는가
 *
 * `MouseDragElementBehavior` 의 X/Y 는 **루트 기준 px** 이다 (NoesisGUI 소스: 읽을 때
 * `TransformToAncestor(root)`, 쓸 때 `PointFromScreen`). 놓인 X/Y 를 칸으로 바꾸려면 보드가
 * 루트의 어디에 몇 px 로 그려졌는지 스크립트가 알아야 하는데, 보드를 XAML 레이아웃에 맡기면
 * 그 값을 돌려받을 길이 없다. 그래서 거꾸로 했다 - 루트 크기만 XAML 에서 받아 오고
 * (`OnRootWidth` / `OnRootHeight`, `CommandParameter` 로 `ActualWidth` 를 넘긴다), 보드·칸·조각의
 * 위치와 크기는 전부 여기서 정한다. 격자와 조각이 같은 숫자를 쓰므로 서로 어긋날 수 없다.
 *
 * ## 끄는 동안 스크립트는 돌지 않는다
 *
 * 조각마다 **자기 줄 전체를 덮는 트랙**(Canvas)이 부모이고 `ConstrainToParentBounds` 가 켜져
 * 있다. 그래서 축 고정과 보드 밖 이탈 방지는 Noesis 가 네이티브로 한다. 다른 조각에 막히는 것은
 * 끄는 동안에는 반영되지 않고(조각 위를 지나갈 수 있다), 놓는 순간 `RushHourBoard` 가 막히기
 * 직전 칸으로 되돌린다. 트랙을 자유 구간만큼만 잡으면 네이티브로 막을 수 있지만, 트랙이 움직이면
 * 그 안의 조각도 같이 밀려서 쓰지 않았다.
 *
 * 퍼즐 규칙은 기존 순수 로직(`RushHour_Board` / `RushHour_DataTables`)을 그대로 쓴다.
 */
import { Component, PropTypes } from 'horizon/core';
import { IUiViewModelObject, NoesisGizmo } from 'horizon/noesis';
import { RushHourBoard } from 'RushHour_Board';
import { RushHourTables } from 'RushHour_DataTables';
import {
	EEdge,
	EGoalStatus,
	EOrientation,
	EPieceColor,
	RUSH_HOUR_PLAY_GRID_SIZE,
	RushHourLevel,
	RushHourPiece,
	toPlayLocalIndex,
} from 'RushHour_Definitions';
import {
	AUX_AREA_FLEX,
	BOARD_AREA_FLEX,
	BOARD_BOTTOM_INSET_PERCENT,
	BOARD_HEIGHT_PERCENT,
	BOARD_TOP_INSET_PERCENT,
	BOARD_WIDTH_PERCENT,
} from 'PuzzleUI_RelativeLayout';

// XAML 에 만들어 둔 자리 수와 같아야 한다 (`Documents/Tools/build_noesis_rushhour_xaml.js`)
const PIECE_SLOTS = 12;
const END_POINT_SLOTS = 2;
const DEFAULT_PUZZLE_ID = '8000202001';

const GRID = RUSH_HOUR_PLAY_GRID_SIZE;
/** 조각과 칸 테두리 사이의 틈 (칸 대비) */
const PIECE_GAP_RATIO = 0.06;
/** 꽂힌 USB 가 슬롯 쪽으로 들어가 보이는 깊이 (칸 대비) - 모바일 사양 §9 의 반 칸 */
const DOCK_TRAVEL_IN_CELLS = 0.5;
const DUPLICATE_WINDOW_MS = 80;
// 같은 값을 다시 넣으면 바인딩이 변경으로 보지 않으므로, 위치를 다시 밀어 넣을 때마다 번갈아 더한다
const NUDGE_PX = 0.01;
/** 트랙이 배치된 뒤에 X/Y 를 한 번 더 넣는 시점들 - 배치 전에 들어간 X/Y 는 어긋난 자리에 놓인다 */
const REASSERT_DELAYS_MS = [150, 600];
const SIZE_REPORT_TIMEOUT_MS = 400;

const PHASE_INTRO = 0;
const PHASE_PLAY = 1;
const PHASE_CLEAR = 2;

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function cellName(row: number, col: number): string {
	return `${String.fromCharCode(65 + row)}${col + 1}`;
}

export class NoesisRushHourPanel extends Component<typeof NoesisRushHourPanel> {
	public static propsDefinition = {
		puzzleId: { type: PropTypes.String, default: DEFAULT_PUZZLE_ID },
		// 0 이면 XAML 이 알려 주는 루트 크기를 쓴다. 그 보고가 오지 않는 환경에서만 직접 적는다
		rootWidth: { type: PropTypes.Number, default: 0 },
		rootHeight: { type: PropTypes.Number, default: 0 },
		logToConsole: { type: PropTypes.Boolean, default: true },
	};

	private _gizmo: NoesisGizmo | undefined = undefined;
	private _vm: IUiViewModelObject = {};
	private readonly _tables = new RushHourTables();
	private _level: RushHourLevel | undefined = undefined;
	private _board: RushHourBoard = new RushHourBoard();
	private _pieceIds: string[] = [];

	private _phase: number = PHASE_INTRO;
	private _moves: number = 0;

	private _rootWidth: number = 0;
	private _rootHeight: number = 0;
	private _pendingWidth: number = 0;
	private _pendingHeight: number = 0;
	private _sizeSource: string = 'unknown';
	private _boardX: number = 0;
	private _boardY: number = 0;
	private _boardSize: number = 0;
	private _cell: number = 0;
	private _gap: number = 0;

	private readonly _pushed: { [key: string]: number } = {};
	private _nudgeFlip: number = 0;
	private _twoWaySource: string = '?';
	private _lastDropSlot: number = -1;
	private _lastDropMs: number = 0;
	private _lastEvent: string = '';

	//#region Lifecycle

	public start(): void {
		this._gizmo = this.entity.as(NoesisGizmo);
		// 런타임은 숨긴 gizmo 를 기기별로 기억한다. 앞서 붙어 있던 스크립트(NoesisBoard_Panel 등)가
		// 숨긴 채 끝나면 이 패널도 그대로 안 보인다. 그래서 패널마다 자기가 켜고 시작한다
		this._gizmo.setLocalEntityVisibility(true);
		this._vm = this.buildContext();
		this.loadLevel();

		if (this.props.rootWidth > 0 && this.props.rootHeight > 0) {
			this.applyRootSize(this.props.rootWidth, this.props.rootHeight, 'props');
		}
		this.push();
	}

	//#endregion

	//#region Context

	private buildContext(): IUiViewModelObject {
		const context: IUiViewModelObject = {
			TitleText: '',
			MovesText: '',
			HintText: '',
			DiagText: '',
			BannerText: '',
			FontLarge: 22,
			FontMedium: 16,
			FontSmall: 12,
			BoardX: 0,
			BoardY: 0,
			BoardSize: 0,
			LockSize: 0,
			OnRootWidth: (parameter?: unknown) => this.onRootSize(parameter, true),
			OnRootHeight: (parameter?: unknown) => this.onRootSize(parameter, false),
			OnRootTap: () => this.onRootTap(),
			OnReset: () => this.onReset(),
			OnMenu: () => this.onMenu(),
		};
		for (let n = 1; n <= END_POINT_SLOTS; n++) {
			for (const field of ['X', 'Y', 'Size', 'Red', 'Blue']) {
				context[`E${n}${field}`] = 0;
			}
		}
		for (let n = 1; n <= PIECE_SLOTS; n++) {
			for (const field of ['TL', 'TT', 'TW', 'TH', 'W', 'H', 'X', 'Y', 'Red', 'Blue']) {
				context[`P${n}${field}`] = 0;
			}
			context[`P${n}Label`] = '';
			context[`OnP${n}Up`] = () => this.onPieceUp(n - 1);
		}
		return context;
	}

	private push(): void {
		const gizmo = this._gizmo;
		if (gizmo === undefined) {
			return;
		}
		this.refreshTexts();
		for (const key of Object.keys(this._pushed)) {
			this._vm[key] = this._pushed[key];
		}
		try {
			gizmo.dataContext = this._vm;
		} catch (error) {
			console.error(`[NoesisRushHour] push 실패: ${error}`);
		}
	}

	private refreshTexts(): void {
		const vm = this._vm;
		const level = this._level;
		vm.TitleText = level === undefined ? 'Rush Hour' : `Rush Hour  D${level.difficulty}  #${level.puzzleId.slice(-3)}`;
		vm.MovesText = `MOVES ${this._moves}`;

		if (this._rootWidth <= 0) {
			vm.HintText = 'Measuring the screen...  tap anywhere';
		} else if (this._phase === PHASE_CLEAR) {
			vm.HintText = `Cleared in ${this._moves} moves`;
		} else {
			vm.HintText = 'Slide the blocks away and push the USB into its port';
		}

		if (this._phase === PHASE_INTRO) {
			vm.BannerText = 'TAP TO START';
		} else {
			vm.BannerText = this._phase === PHASE_CLEAR ? 'CLEAR!' : '';
		}
		vm.LockSize = this._phase === PHASE_PLAY ? 0 : this._boardSize;

		const size = this._rootWidth > 0
			? `root ${this._rootWidth.toFixed(0)}x${this._rootHeight.toFixed(0)} (${this._sizeSource})  cell ${this._cell.toFixed(1)}`
			: `root size ${this._sizeSource}`;
		vm.DiagText = `${size}  two-way ${this._twoWaySource}\n${this._lastEvent}`;
	}

	private note(message: string): void {
		this._lastEvent = message;
		if (this.props.logToConsole === true) {
			console.log(`[NoesisRushHour] ${message}`);
		}
	}

	//#endregion

	//#region Level

	private loadLevel(): void {
		let field = this._tables.getField(this.props.puzzleId);
		if (field !== undefined && field.placements.length > PIECE_SLOTS) {
			console.warn(`[NoesisRushHour] '${field.puzzleId}' 는 조각이 ${field.placements.length}개라 자리(${PIECE_SLOTS})가 모자란다. 기본 판을 쓴다`);
			field = undefined;
		}
		if (field === undefined) {
			field = this._tables.getField(DEFAULT_PUZZLE_ID);
		}
		if (field === undefined) {
			console.error('[NoesisRushHour] 필드 테이블에서 판을 찾지 못했다');
			return;
		}
		this._level = this._tables.buildLevel(field);
		this.resetBoard();
	}

	private resetBoard(): void {
		const level = this._level;
		if (level === undefined) {
			return;
		}
		this._board = RushHourBoard.fromLevel(level);
		this._pieceIds = this._board.pieces.map((piece) => piece.id);
		this._moves = 0;
		this.placeEverything();
	}

	//#endregion

	//#region Root size

	/**
	 * XAML 이 루트의 ActualWidth / ActualHeight 를 따로따로 알려 준다 (`InvokeCommandAction` 하나에
	 * 값 하나). Loaded · SizeChanged · 화면을 누를 때 온다. 둘이 다 모이면 배치를 다시 한다.
	 */
	private onRootSize(parameter: unknown, isWidth: boolean): void {
		const value = typeof parameter === 'number' ? parameter : parseFloat(String(parameter));
		if (isNaN(value) || value <= 0) {
			this._sizeSource = `bad parameter (${typeof parameter}: ${String(parameter)})`;
			return;
		}
		if (isWidth === true) {
			this._pendingWidth = value;
		} else {
			this._pendingHeight = value;
		}
		if (this.props.rootWidth > 0 && this.props.rootHeight > 0) {
			return;
		}
		const isChanged = Math.abs(this._pendingWidth - this._rootWidth) > 0.5
			|| Math.abs(this._pendingHeight - this._rootHeight) > 0.5;
		if (this._pendingWidth > 0 && this._pendingHeight > 0 && isChanged === true) {
			this.applyRootSize(this._pendingWidth, this._pendingHeight, 'xaml');
			this.push();
		}
	}

	/** `PuzzleUI_RelativeLayout` 과 같은 비율로 보드 정사각형을 잡는다 */
	private applyRootSize(width: number, height: number, source: string): void {
		this._rootWidth = width;
		this._rootHeight = height;
		this._sizeSource = source;

		const top = height * BOARD_TOP_INSET_PERCENT / 100;
		const bottom = height * BOARD_BOTTOM_INSET_PERCENT / 100;
		const areaHeight = (height - top - bottom) * BOARD_AREA_FLEX / (BOARD_AREA_FLEX + AUX_AREA_FLEX);
		this._boardSize = Math.min(width * BOARD_WIDTH_PERCENT / 100, areaHeight * BOARD_HEIGHT_PERCENT / 100);
		this._boardX = (width - this._boardSize) / 2;
		this._boardY = top + (areaHeight - this._boardSize) / 2;
		this._cell = this._boardSize / GRID;
		this._gap = Math.max(2, this._cell * PIECE_GAP_RATIO);

		const vm = this._vm;
		vm.BoardX = this._boardX;
		vm.BoardY = this._boardY;
		vm.BoardSize = this._boardSize;
		vm.FontLarge = clamp(height * 0.026, 12, 64);
		vm.FontMedium = clamp(height * 0.019, 10, 48);
		vm.FontSmall = clamp(height * 0.013, 8, 32);

		this.note(`layout ${width.toFixed(0)}x${height.toFixed(0)} from ${source}`);
		this.placeEverything();

		// 트랙의 Canvas.Left/Top 이 실제로 배치된 뒤에 X/Y 를 다시 넣는다
		for (const delay of REASSERT_DELAYS_MS) {
			this.async.setTimeout(() => this.reassertPositions(), delay);
		}
	}

	private onRootTap(): void {
		if (this._phase !== PHASE_INTRO) {
			return;
		}
		if (this._rootWidth > 0) {
			this._phase = PHASE_PLAY;
			this.note('start');
			this.push();
			return;
		}
		// 같은 트리거가 크기 보고를 먼저 보낸다. 잠시 기다려도 없으면 그 경로가 막힌 것이다
		this.async.setTimeout(() => {
			if (this._rootWidth <= 0) {
				if (this._sizeSource === 'unknown') {
					this._sizeSource = 'not reported - set rootWidth / rootHeight props';
				}
				this.push();
			}
		}, SIZE_REPORT_TIMEOUT_MS);
	}

	//#endregion

	//#region Placement

	private placeEverything(): void {
		const vm = this._vm;
		const level = this._level;
		if (level === undefined || this._cell <= 0) {
			return;
		}

		for (let n = 1; n <= END_POINT_SLOTS; n++) {
			const endPoint = level.endPoints[n - 1];
			const isUsed = endPoint !== undefined;
			vm[`E${n}X`] = isUsed ? this._boardX + toPlayLocalIndex(endPoint.col) * this._cell : 0;
			vm[`E${n}Y`] = isUsed ? this._boardY + toPlayLocalIndex(endPoint.row) * this._cell : 0;
			vm[`E${n}Size`] = isUsed ? this._cell : 0;
			vm[`E${n}Red`] = isUsed && endPoint.color === EPieceColor.RED ? 1 : 0;
			vm[`E${n}Blue`] = isUsed && endPoint.color === EPieceColor.BLUE ? 1 : 0;
		}

		const inner = this._cell - this._gap * 2;
		const lane = this._boardSize - this._gap * 2;
		for (let slot = 0; slot < PIECE_SLOTS; slot++) {
			const name = `P${slot + 1}`;
			const piece = this.pieceOfSlot(slot);
			if (piece === undefined) {
				for (const field of ['TL', 'TT', 'TW', 'TH', 'W', 'H', 'Red', 'Blue']) {
					vm[`${name}${field}`] = 0;
				}
				vm[`${name}Label`] = '';
				continue;
			}

			const isVertical = piece.orientation === EOrientation.VERTICAL;
			const isFree = piece.orientation === EOrientation.FREE;
			const length = piece.size * this._cell - this._gap * 2;
			// 트랙 = 조각이 다닐 수 있는 줄 전체. 1x1(FREE)은 보드 전체다
			vm[`${name}TL`] = this._boardX + this._gap + (isVertical ? piece.col * this._cell : 0);
			vm[`${name}TT`] = this._boardY + this._gap + (isVertical || isFree ? 0 : piece.row * this._cell);
			vm[`${name}TW`] = isVertical ? inner : lane;
			vm[`${name}TH`] = isVertical || isFree ? lane : inner;
			vm[`${name}W`] = isVertical ? inner : length;
			vm[`${name}H`] = isVertical ? length : inner;
			vm[`${name}Red`] = piece.color === EPieceColor.RED ? 1 : 0;
			vm[`${name}Blue`] = piece.color === EPieceColor.BLUE ? 1 : 0;
			vm[`${name}Label`] = piece.isGoal === true ? 'USB' : '';
			this.placePiece(slot);
		}
	}

	private pieceOfSlot(slot: number): RushHourPiece | undefined {
		const id = this._pieceIds[slot];
		return id === undefined ? undefined : this._board.getPiece(id);
	}

	/** 보드의 칸 좌표를 루트 px 로 바꿔 X/Y 에 넣는다. 꽂힌 USB 는 슬롯 쪽으로 반 칸 들어가 보인다 */
	private placePiece(slot: number): void {
		const piece = this.pieceOfSlot(slot);
		if (piece === undefined) {
			return;
		}
		let x = this._boardX + piece.col * this._cell + this._gap;
		let y = this._boardY + piece.row * this._cell + this._gap;

		if (this._board.isDocked(piece.id) === true) {
			const endPoint = this._board.getEndPointForPiece(piece.id);
			const travel = this._cell * DOCK_TRAVEL_IN_CELLS;
			if (endPoint !== undefined) {
				switch (endPoint.edge) {
					case EEdge.TOP: y -= travel; break;
					case EEdge.BOTTOM: y += travel; break;
					case EEdge.LEFT: x -= travel; break;
					default: x += travel; break;
				}
			}
		}

		const nudge = this._nudgeFlip * NUDGE_PX;
		this._pushed[`P${slot + 1}X`] = x + nudge;
		this._pushed[`P${slot + 1}Y`] = y + nudge;
	}

	/** 모든 조각의 X/Y 를 (살짝 다른 값으로) 다시 넣어 Noesis 가 자리를 다시 계산하게 한다 */
	private reassertPositions(): void {
		this._nudgeFlip = this._nudgeFlip === 0 ? 1 : 0;
		for (let slot = 0; slot < this._pieceIds.length; slot++) {
			this.placePiece(slot);
		}
		this.push();
	}

	//#endregion

	//#region Drop

	/**
	 * TwoWay 로 돌아온 값을 읽는다. 런타임이 어디에 써 주는지 문서에 없어 두 곳을 다 본다 -
	 * `getter` = gizmo.dataContext 가 돌려준 객체, `object` = 우리가 대입했던 객체.
	 */
	private readTwoWay(key: string): { value: number; source: string } {
		const pushed = this._pushed[key];
		let live: unknown = undefined;
		try {
			live = this._gizmo?.dataContext?.[key];
		} catch (error) {
			live = undefined;
		}
		if (typeof live === 'number' && isFinite(live) && live !== pushed) {
			return { value: live, source: 'getter' };
		}
		const own = this._vm[key];
		if (typeof own === 'number' && isFinite(own) && own !== pushed) {
			return { value: own, source: 'object' };
		}
		return { value: pushed, source: 'none' };
	}

	private onPieceUp(slot: number): void {
		// MouseLeftButtonUp · TouchUp · LostMouseCapture 가 같은 놓기에 잇달아 온다
		const now = Date.now();
		if (this._lastDropSlot === slot && now - this._lastDropMs < DUPLICATE_WINDOW_MS) {
			return;
		}
		this._lastDropSlot = slot;
		this._lastDropMs = now;

		const piece = this.pieceOfSlot(slot);
		if (piece === undefined || this._phase !== PHASE_PLAY || this._cell <= 0) {
			return;
		}

		const name = `P${slot + 1}`;
		const x = this.readTwoWay(`${name}X`);
		const y = this.readTwoWay(`${name}Y`);
		const source = x.source !== 'none' ? x.source : y.source;
		if (source === 'none') {
			// 끌지 않고 눌렀다 뗀 것
			return;
		}
		this._twoWaySource = source;

		const wasDocked = this._board.isDocked(piece.id);
		if (wasDocked === true) {
			this._board.undock(piece.id);
		}

		const fromRow = piece.row;
		const fromCol = piece.col;
		const continuousRow = (y.value - this._boardY - this._gap) / this._cell;
		const continuousCol = (x.value - this._boardX - this._gap) / this._cell;
		const result = this._board.snapFromContinuous(piece.id, continuousRow, continuousCol);
		if (result.steps > 0) {
			this._moves++;
		}

		let didDock = false;
		if (piece.isGoal === true && this._board.getGoalStatus(piece.id) === EGoalStatus.READY) {
			// 밀착까지 끌어오면 결합을 확정한다 (`RushHour_DragController.end()` 와 같은 규칙)
			didDock = this._board.dock(piece.id);
		}

		this.note(`${name} x ${x.value.toFixed(0)} y ${y.value.toFixed(0)}  ${cellName(fromRow, fromCol)} -> ${cellName(piece.row, piece.col)}  steps ${result.steps}${didDock === true ? '  docked' : ''}`);

		if (this._board.isSolved() === true) {
			this._phase = PHASE_CLEAR;
		}
		this.reassertPositions();
	}

	//#endregion

	//#region Buttons

	private onReset(): void {
		this.resetBoard();
		if (this._phase === PHASE_CLEAR) {
			this._phase = PHASE_PLAY;
		}
		this.note('reset');
		this.reassertPositions();
	}

	private onMenu(): void {
		this.note('menu pressed (not wired in this sample)');
		this.push();
	}

	//#endregion
}
Component.register(NoesisRushHourPanel);
