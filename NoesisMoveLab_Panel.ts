/**
 * NoesisMoveLab_Panel — `PassEventArgsToCommand` 로 **포인터 좌표를 받아** 스크립트가 직접 끄는 러시아워 (테스트 전용)
 *
 * 공식 문서의 MouseMove 예제(`InvokeCommandAction PassEventArgsToCommand="True"` -> `args.position`)를
 * 쓴다. 짝이 되는 XAML 은 `Documents/NoesisSample/NoesisMoveLab/MoveLab.xaml` 이다.
 *
 * ## `NoesisRushHour_Panel` 과 무엇이 다른가 - 같은 판, 같은 화면, 끄는 방식만 다르다
 *
 *   | | NoesisRushHour (네이티브) | 이 패널 (스크립트) |
 *   |---|---|---|
 *   | 끄는 주체 | `MouseDragElementBehavior` | 스크립트가 Move 마다 `TranslateTransform` 의 X/Y 를 쓴다 |
 *   | 끄는 동안 스크립트 | 0회 | Move 이벤트마다 1회 (주기는 `rate` 버튼으로 바꿔 본다) |
 *   | 다른 조각에 막힘 | 놓을 때만 반영 (끄는 동안 지나간다) | **끄는 동안 막힌다** (잡을 때 갈 수 있는 구간을 재 둔다) |
 *   | 놓을 때 | 순간 스냅 | 짧게 미끄러져 들어간다 (스크립트 트윈) |
 *   | 좌표 읽기 | TwoWay 로 돌아온 X/Y | 이벤트 인자의 `position` |
 *
 * 그래서 두 패널을 같은 기기에서 번갈아 끌어 보면 "좌표를 받아 스크립트가 끄는 방식이 네이티브만큼
 * 부드러운가" 가 바로 보인다. 부드럽다면 막힘·미리보기·스냅 연출을 전부 스크립트로 자유롭게 짤 수 있다.
 *
 * ## 이 패널이 같이 알아내는 것
 *
 *   - Move 이벤트가 **모바일 터치에서도** 오는가 (`MouseMove` 승격 / `TouchMove`)
 *   - 이벤트 인자의 실제 모양 - 종류별로 처음 받은 인자를 화면 아래에 찍는다
 *   - `position` 이 무엇 기준인가 - 루트 px 라고 가정하고 짰다. 잡는 자리가 어긋나면 그 가정이 틀린 것이다
 *   - 초당 Move 이벤트 수
 *
 * 조각과 보드는 입력을 받지 않는 그림이다. 입력은 루트 하나가 다 받고, 어느 조각을 집었는지는
 * 스크립트가 좌표로 판정한다 (`RushHourBoard.getPieceAt`).
 */
import { Component, PropTypes } from 'horizon/core';
import { IUiViewModelObject, NoesisGizmo } from 'horizon/noesis';
import { RushHourBoard } from 'RushHour_Board';
import { RushHourTables } from 'RushHour_DataTables';
import {
	EEdge,
	EGoalStatus,
	EMoveDirection,
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

// XAML 에 만들어 둔 자리 수와 같아야 한다 (`Documents/Tools/build_noesis_movelab_xaml.js`)
const PIECE_SLOTS = 12;
const END_POINT_SLOTS = 2;
const DEFAULT_PUZZLE_ID = '8000202001';

const GRID = RUSH_HOUR_PLAY_GRID_SIZE;
const PIECE_GAP_RATIO = 0.06;
const DOCK_TRAVEL_IN_CELLS = 0.5;
const SNAP_TWEEN_MS = 90;
const SNAP_TWEEN_STEP_MS = 16;
/** Move 를 화면에 반영하는 최소 간격(ms). 0 = 이벤트마다 */
const RATE_STEPS_MS = [0, 16, 33, 50];
const ARGS_PREVIEW_LENGTH = 90;

const PHASE_INTRO = 0;
const PHASE_PLAY = 1;
const PHASE_CLEAR = 2;

const SRC_MOUSE = 'mouse';
const SRC_TOUCH = 'touch';

type ScreenPoint = { x: number; y: number };

type DragState = {
	slot: number;
	source: string;
	isVertical: boolean;
	/** 집은 점과 조각 좌상단의 차이 (이동 축) */
	grabOffset: number;
	/** 출발 자리와 갈 수 있는 구간 (이동 축, 루트 px) */
	startAxis: number;
	minAxis: number;
	maxAxis: number;
	currentAxis: number;
	lastApplyMs: number;
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function cellName(row: number, col: number): string {
	return `${String.fromCharCode(65 + row)}${col + 1}`;
}

export class NoesisMoveLabPanel extends Component<typeof NoesisMoveLabPanel> {
	public static propsDefinition = {
		puzzleId: { type: PropTypes.String, default: DEFAULT_PUZZLE_ID },
		logToConsole: { type: PropTypes.Boolean, default: true },
	};

	private _vm: IUiViewModelObject = {};
	private readonly _tables = new RushHourTables();
	private _level: RushHourLevel | undefined = undefined;
	private _board: RushHourBoard = new RushHourBoard();
	private _pieceIds: string[] = [];

	private _phase: number = PHASE_INTRO;
	private _moves: number = 0;
	private _drag: DragState | undefined = undefined;
	private _tweenId: number | undefined = undefined;
	private _rateIndex: number = 0;

	private _rootWidth: number = 0;
	private _rootHeight: number = 0;
	private _boardX: number = 0;
	private _boardY: number = 0;
	private _boardSize: number = 0;
	private _cell: number = 0;
	private _gap: number = 0;

	private readonly _argShapes: { [kind: string]: string } = {};
	private _moveCount: number = 0;
	private _movesPerSecond: number = 0;
	private _lastPoint: ScreenPoint = { x: 0, y: 0 };
	private _lastEvent: string = '';
	private _statsTimer: number | undefined = undefined;

	//#region Lifecycle

	public start(): void {
		// 서버에서 도는 인스턴스는 건너뛴다. 소유자가 아니라 "지금 어느 기기에서 도는가" 로 가르므로
		// Local · Shared 어느 모드에 두어도 된다
		if (this.world.getLocalPlayer().id === this.world.getServerPlayer().id) {
			return;
		}
		const gizmo = this.entity.as(NoesisGizmo);
		// 런타임은 숨긴 gizmo 를 기기별로 기억한다. 앞서 붙어 있던 스크립트(NoesisBoard_Panel 등)가
		// 숨긴 채 끝나면 이 패널도 그대로 안 보인다. 그래서 패널마다 자기가 켜고 시작한다
		gizmo.setLocalEntityVisibility(true);
		this._vm = this.buildContext();
		this.loadLevel();
		this.refreshTexts();
		gizmo.dataContext = this._vm;
		this._statsTimer = this.async.setInterval(() => this.tickStats(), 1000);
	}

	public dispose(): void {
		if (this._statsTimer !== undefined) {
			this.async.clearInterval(this._statsTimer);
		}
		this.stopTween();
	}

	//#endregion

	//#region Context

	/** 첫 대입 때 없던 키는 바인딩되지 않으므로, 쓸 키를 전부 여기서 만든다 */
	private buildContext(): IUiViewModelObject {
		const context: IUiViewModelObject = {
			TitleText: '',
			MovesText: '',
			HintText: '',
			DiagText: '',
			BannerText: '',
			RateLabel: '',
			FontLarge: 22,
			FontMedium: 16,
			FontSmall: 12,
			BoardX: 0,
			BoardY: 0,
			BoardSize: 0,
			BannerSize: 0,
			OnRootWidth: (parameter?: unknown) => this.onRootSize(parameter, true),
			OnRootHeight: (parameter?: unknown) => this.onRootSize(parameter, false),
			OnMouseDown: (args?: unknown) => this.onDown(args, SRC_MOUSE),
			OnMouseMove: (args?: unknown) => this.onMove(args, SRC_MOUSE),
			OnMouseUp: (args?: unknown) => this.onUp(args, SRC_MOUSE),
			OnTouchDown: (args?: unknown) => this.onDown(args, SRC_TOUCH),
			OnTouchMove: (args?: unknown) => this.onMove(args, SRC_TOUCH),
			OnTouchUp: (args?: unknown) => this.onUp(args, SRC_TOUCH),
			OnReset: () => this.onReset(),
			OnRate: () => this.onRate(),
		};
		for (let n = 1; n <= END_POINT_SLOTS; n++) {
			for (const field of ['X', 'Y', 'Size', 'Red', 'Blue']) {
				context[`E${n}${field}`] = 0;
			}
		}
		for (let n = 1; n <= PIECE_SLOTS; n++) {
			for (const field of ['X', 'Y', 'W', 'H', 'Red', 'Blue', 'Hot']) {
				context[`P${n}${field}`] = 0;
			}
			context[`P${n}Label`] = '';
		}
		return context;
	}

	private set(key: string, value: string | number): void {
		if (this._vm[key] !== value) {
			this._vm[key] = value;
		}
	}

	private refreshTexts(): void {
		const level = this._level;
		this.set('TitleText', level === undefined ? 'Move Lab' : `Move Lab  D${level.difficulty}  #${level.puzzleId.slice(-3)}`);
		this.set('MovesText', `MOVES ${this._moves}`);
		const rate = RATE_STEPS_MS[this._rateIndex];
		this.set('RateLabel', rate === 0 ? 'rate: every move' : `rate: ${rate}ms`);

		if (this._rootWidth <= 0) {
			this.set('HintText', 'Measuring the screen...  tap anywhere');
		} else if (this._phase === PHASE_CLEAR) {
			this.set('HintText', `Cleared in ${this._moves} moves`);
		} else {
			this.set('HintText', 'Script-driven drag: pieces stop at blockers WHILE you drag');
		}
		this.set('BannerText', this._phase === PHASE_INTRO ? 'TAP TO START' : (this._phase === PHASE_CLEAR ? 'CLEAR!' : ''));
		this.set('BannerSize', this._phase === PHASE_PLAY ? 0 : this._boardSize);

		const shapes = Object.keys(this._argShapes).map((kind) => `${kind} ${this._argShapes[kind]}`).join('\n');
		this.set('DiagText', `root ${this._rootWidth.toFixed(0)}x${this._rootHeight.toFixed(0)}  moves/s ${this._movesPerSecond}  `
			+ `last ${this._lastPoint.x.toFixed(0)},${this._lastPoint.y.toFixed(0)}  ${this._lastEvent}\n${shapes}`);
	}

	private note(message: string): void {
		this._lastEvent = message;
		if (this.props.logToConsole === true) {
			console.log(`[NoesisMoveLab] ${message}`);
		}
	}

	private tickStats(): void {
		this._movesPerSecond = this._moveCount;
		this._moveCount = 0;
		this.refreshTexts();
	}

	//#endregion

	//#region Level / layout

	private loadLevel(): void {
		let field = this._tables.getField(this.props.puzzleId);
		if (field !== undefined && field.placements.length > PIECE_SLOTS) {
			field = undefined;
		}
		if (field === undefined) {
			field = this._tables.getField(DEFAULT_PUZZLE_ID);
		}
		if (field === undefined) {
			console.error('[NoesisMoveLab] 필드 테이블에서 판을 찾지 못했다');
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
		this.stopTween();
		this._drag = undefined;
		this._board = RushHourBoard.fromLevel(level);
		this._pieceIds = this._board.pieces.map((piece) => piece.id);
		this._moves = 0;
		this.placeEverything();
	}

	private onRootSize(parameter: unknown, isWidth: boolean): void {
		const value = typeof parameter === 'number' ? parameter : parseFloat(String(parameter));
		if (isNaN(value) || value <= 0) {
			return;
		}
		if (isWidth === true) {
			if (Math.abs(value - this._rootWidth) < 0.5) {
				return;
			}
			this._rootWidth = value;
		} else {
			if (Math.abs(value - this._rootHeight) < 0.5) {
				return;
			}
			this._rootHeight = value;
		}
		if (this._rootWidth <= 0 || this._rootHeight <= 0) {
			return;
		}

		// `PuzzleUI_RelativeLayout` 과 같은 비율로 보드 정사각형을 잡는다
		const width = this._rootWidth;
		const height = this._rootHeight;
		const top = height * BOARD_TOP_INSET_PERCENT / 100;
		const bottom = height * BOARD_BOTTOM_INSET_PERCENT / 100;
		const areaHeight = (height - top - bottom) * BOARD_AREA_FLEX / (BOARD_AREA_FLEX + AUX_AREA_FLEX);
		this._boardSize = Math.min(width * BOARD_WIDTH_PERCENT / 100, areaHeight * BOARD_HEIGHT_PERCENT / 100);
		this._boardX = (width - this._boardSize) / 2;
		this._boardY = top + (areaHeight - this._boardSize) / 2;
		this._cell = this._boardSize / GRID;
		this._gap = Math.max(2, this._cell * PIECE_GAP_RATIO);

		this.set('BoardX', this._boardX);
		this.set('BoardY', this._boardY);
		this.set('BoardSize', this._boardSize);
		this.set('FontLarge', clamp(height * 0.026, 12, 64));
		this.set('FontMedium', clamp(height * 0.019, 10, 48));
		this.set('FontSmall', clamp(height * 0.012, 8, 28));
		this.placeEverything();
		this.refreshTexts();
	}

	private pieceOfSlot(slot: number): RushHourPiece | undefined {
		const id = this._pieceIds[slot];
		return id === undefined ? undefined : this._board.getPiece(id);
	}

	private placeEverything(): void {
		const level = this._level;
		if (level === undefined || this._cell <= 0) {
			return;
		}
		for (let n = 1; n <= END_POINT_SLOTS; n++) {
			const endPoint = level.endPoints[n - 1];
			const isUsed = endPoint !== undefined;
			this.set(`E${n}X`, isUsed ? this._boardX + toPlayLocalIndex(endPoint.col) * this._cell : 0);
			this.set(`E${n}Y`, isUsed ? this._boardY + toPlayLocalIndex(endPoint.row) * this._cell : 0);
			this.set(`E${n}Size`, isUsed ? this._cell : 0);
			this.set(`E${n}Red`, isUsed && endPoint.color === EPieceColor.RED ? 1 : 0);
			this.set(`E${n}Blue`, isUsed && endPoint.color === EPieceColor.BLUE ? 1 : 0);
		}

		const inner = this._cell - this._gap * 2;
		for (let slot = 0; slot < PIECE_SLOTS; slot++) {
			const name = `P${slot + 1}`;
			const piece = this.pieceOfSlot(slot);
			if (piece === undefined) {
				this.set(`${name}W`, 0);
				this.set(`${name}H`, 0);
				this.set(`${name}Label`, '');
				continue;
			}
			const isVertical = piece.orientation === EOrientation.VERTICAL;
			const length = piece.size * this._cell - this._gap * 2;
			this.set(`${name}W`, isVertical ? inner : length);
			this.set(`${name}H`, isVertical ? length : inner);
			this.set(`${name}Red`, piece.color === EPieceColor.RED ? 1 : 0);
			this.set(`${name}Blue`, piece.color === EPieceColor.BLUE ? 1 : 0);
			this.set(`${name}Hot`, 0);
			this.set(`${name}Label`, piece.isGoal === true ? 'USB' : '');
			const home = this.homeOf(piece);
			this.set(`${name}X`, home.x);
			this.set(`${name}Y`, home.y);
		}
	}

	/** 보드의 칸 좌표 -> 루트 px. 꽂힌 USB 는 슬롯 쪽으로 반 칸 들어가 보인다 */
	private homeOf(piece: RushHourPiece): ScreenPoint {
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
		return { x: x, y: y };
	}

	//#endregion

	//#region Pointer events

	/**
	 * 이벤트 인자에서 좌표를 꺼낸다. 문서의 MouseMove 예제는 `{ position: { x, y } }` 다.
	 * 다른 종류(터치 등)의 인자는 모양을 모르므로 그럴듯한 이름을 차례로 본다 - 처음 받은 인자는
	 * 종류별로 화면 아래에 찍어 두므로, 못 읽으면 그 글자를 보고 고치면 된다.
	 */
	private readPoint(kind: string, args: unknown): ScreenPoint | undefined {
		if (this._argShapes[kind] === undefined) {
			let text = '';
			try {
				text = JSON.stringify(args);
			} catch (error) {
				text = `unserializable ${typeof args}`;
			}
			this._argShapes[kind] = (text === undefined ? String(args) : text).slice(0, ARGS_PREVIEW_LENGTH);
			this.note(`first ${kind} args: ${this._argShapes[kind]}`);
		}
		if (typeof args !== 'object' || args === null) {
			return undefined;
		}
		const bag = args as { [key: string]: unknown };
		for (const key of ['position', 'touchPoint', 'touchPosition', 'point']) {
			const candidate = bag[key] as { x?: unknown; y?: unknown } | undefined;
			if (candidate !== undefined && candidate !== null && typeof candidate.x === 'number' && typeof candidate.y === 'number') {
				return { x: candidate.x, y: candidate.y };
			}
		}
		if (typeof bag.x === 'number' && typeof bag.y === 'number') {
			return { x: bag.x, y: bag.y };
		}
		return undefined;
	}

	private onDown(args: unknown, source: string): void {
		const point = this.readPoint(`${source}Down`, args);
		if (point !== undefined) {
			this._lastPoint = point;
		}
		if (this._phase === PHASE_INTRO) {
			if (this._rootWidth > 0) {
				this._phase = PHASE_PLAY;
				this.note('start');
			}
			this.refreshTexts();
			return;
		}
		// 터치가 마우스로도 승격되어 오면 먼저 온 쪽이 이 드래그를 몬다
		if (this._phase !== PHASE_PLAY || this._drag !== undefined || point === undefined || this._cell <= 0) {
			return;
		}

		const col = Math.floor((point.x - this._boardX) / this._cell);
		const row = Math.floor((point.y - this._boardY) / this._cell);
		const piece = this._board.getPieceAt(row, col);
		const slot = piece === undefined ? -1 : this._pieceIds.indexOf(piece.id);
		if (piece === undefined || slot < 0) {
			return;
		}
		this.stopTween();
		if (this._board.isDocked(piece.id) === true) {
			this._board.undock(piece.id);
		}

		// **갈 수 있는 구간을 잡는 순간에 재 둔다** - 끄는 동안에는 이 두 값으로 자르기만 하면 된다
		const isVertical = piece.orientation === EOrientation.VERTICAL;
		const back = this._board.getMaxSteps(piece.id, isVertical ? EMoveDirection.UP : EMoveDirection.LEFT);
		const forward = this._board.getMaxSteps(piece.id, isVertical ? EMoveDirection.DOWN : EMoveDirection.RIGHT);
		const home = this.homeOf(piece);
		// 미끄러져 들어가던 중에 다시 잡혔을 수 있다 - 제자리에 놓고 시작한다
		this.set(`P${slot + 1}X`, home.x);
		this.set(`P${slot + 1}Y`, home.y);
		const startAxis = isVertical ? home.y : home.x;
		this._drag = {
			slot: slot,
			source: source,
			isVertical: isVertical,
			grabOffset: (isVertical ? point.y : point.x) - startAxis,
			startAxis: startAxis,
			minAxis: startAxis - back * this._cell,
			maxAxis: startAxis + forward * this._cell,
			currentAxis: startAxis,
			lastApplyMs: 0,
		};
		this.set(`P${slot + 1}Hot`, 1);
		this.note(`${source} grab P${slot + 1} at ${cellName(piece.row, piece.col)}  free -${back} +${forward}`);
	}

	private onMove(args: unknown, source: string): void {
		const point = this.readPoint(`${source}Move`, args);
		this._moveCount++;
		if (point === undefined) {
			return;
		}
		this._lastPoint = point;
		const drag = this._drag;
		if (drag === undefined || drag.source !== source) {
			return;
		}
		drag.currentAxis = clamp((drag.isVertical ? point.y : point.x) - drag.grabOffset, drag.minAxis, drag.maxAxis);

		const now = Date.now();
		if (now - drag.lastApplyMs < RATE_STEPS_MS[this._rateIndex]) {
			return;
		}
		drag.lastApplyMs = now;
		this.set(`P${drag.slot + 1}${drag.isVertical ? 'Y' : 'X'}`, drag.currentAxis);
	}

	private onUp(args: unknown, source: string): void {
		this.readPoint(`${source}Up`, args);
		const drag = this._drag;
		if (drag === undefined || drag.source !== source) {
			return;
		}
		this._drag = undefined;
		const piece = this.pieceOfSlot(drag.slot);
		if (piece === undefined) {
			return;
		}

		const fromRow = piece.row;
		const fromCol = piece.col;
		const steps = Math.round((drag.currentAxis - drag.startAxis) / this._cell);
		if (steps !== 0) {
			const direction = drag.isVertical
				? (steps < 0 ? EMoveDirection.UP : EMoveDirection.DOWN)
				: (steps < 0 ? EMoveDirection.LEFT : EMoveDirection.RIGHT);
			if (this._board.slide(piece.id, direction, Math.abs(steps)).steps > 0) {
				this._moves++;
			}
		}
		let didDock = false;
		if (piece.isGoal === true && this._board.getGoalStatus(piece.id) === EGoalStatus.READY) {
			didDock = this._board.dock(piece.id);
		}
		if (this._board.isSolved() === true) {
			this._phase = PHASE_CLEAR;
		}

		this.set(`P${drag.slot + 1}Hot`, 0);
		this.note(`${source} drop P${drag.slot + 1}  ${cellName(fromRow, fromCol)} -> ${cellName(piece.row, piece.col)}${didDock === true ? '  docked' : ''}`);
		this.tweenHome(drag.slot, piece, drag.isVertical, drag.currentAxis);
		this.refreshTexts();
	}

	//#endregion

	//#region Snap tween

	/** 놓은 자리에서 칸까지 짧게 미끄러져 들어간다 - 스크립트가 프레임마다 값을 쓰는 트윈이다 */
	private tweenHome(slot: number, piece: RushHourPiece, isVertical: boolean, fromAxis: number): void {
		this.stopTween();
		const home = this.homeOf(piece);
		const key = `P${slot + 1}${isVertical ? 'Y' : 'X'}`;
		const toAxis = isVertical ? home.y : home.x;
		const startMs = Date.now();
		this._tweenId = this.async.setInterval(() => {
			const progress = clamp((Date.now() - startMs) / SNAP_TWEEN_MS, 0, 1);
			// ease-out
			const eased = 1 - (1 - progress) * (1 - progress);
			this.set(key, fromAxis + (toAxis - fromAxis) * eased);
			if (progress >= 1) {
				this.stopTween();
				// 꽂힘은 이동 축이 아닌 쪽도 바꿀 수 있으므로 끝에서 두 축을 다 맞춘다
				this.set(`P${slot + 1}X`, home.x);
				this.set(`P${slot + 1}Y`, home.y);
			}
		}, SNAP_TWEEN_STEP_MS);
	}

	private stopTween(): void {
		if (this._tweenId !== undefined) {
			this.async.clearInterval(this._tweenId);
			this._tweenId = undefined;
		}
	}

	//#endregion

	//#region Buttons

	private onReset(): void {
		this.resetBoard();
		if (this._phase === PHASE_CLEAR) {
			this._phase = PHASE_PLAY;
		}
		this.note('reset');
		this.refreshTexts();
	}

	private onRate(): void {
		this._rateIndex = (this._rateIndex + 1) % RATE_STEPS_MS.length;
		this.refreshTexts();
	}

	//#endregion
}
Component.register(NoesisMoveLabPanel);
