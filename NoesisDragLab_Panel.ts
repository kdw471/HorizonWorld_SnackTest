/**
 * NoesisDragLab_Panel — Noesis UI 격자 보드 드래그 앤 드롭 실험 (테스트 전용)
 *
 * Custom UI 의 `UIComponent` 가 아니라 일반 `Component` 다. 화면은 XAML 이 그리고, 이 스크립트는
 * `NoesisGizmo.dataContext` 로 값과 명령(함수)만 넘긴다. 짝이 되는 XAML 은
 * `Documents/NoesisSample/NoesisDragLab/` 에 있다.
 *
 * - A 장 (`DragLabA_CellEvents.xaml`): 칸마다 Down/Enter/Up 이벤트를 명령으로 받아 **칸 단위로** 끈다.
 * - B 장 (`DragLabB_NativeDrag.xaml`): `MouseDragElementBehavior` 가 네이티브로 끌고, 놓을 때만
 *   TwoWay 로 돌아온 X/Y 를 읽어 칸에 스냅한다.
 *
 * 두 장이 같은 dataContext 를 쓰므로 Root XAML 만 바꿔 끼우면 된다. 다른 프로젝트 파일을
 * import 하지 않는다.
 */
import { Component, PropTypes } from 'horizon/core';
import { IUiViewModelObject, NoesisGizmo } from 'horizon/noesis';

const GRID_SIZE = 4;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const CELL_PX = 64;
const PIECE_INSET_PX = 4;
// B 장 XAML 의 격자 좌상단(Canvas.Left/Top)과 같아야 한다
const BOARD_B_LEFT = 20;
const BOARD_B_TOP = 130;
const LOG_LINES = 7;
const DUPLICATE_WINDOW_MS = 80;
// 같은 값을 다시 넣으면 바인딩이 변경으로 보지 않을 수 있어, 스냅 때마다 번갈아 더한다
const NUDGE_PX = 0.01;

const PIECES = ['red', 'blue', 'green'];
const START_CELLS = [0, 5, 10];

const SRC_MOUSE = 'mouse';
const SRC_TOUCH = 'touch';
const SRC_CAPTURE = 'capture';

const KIND_DOWN = 'down';
const KIND_ENTER = 'enter';
const KIND_UP = 'up';

const MARK_NONE = 'none';
const MARK_ORIGIN = 'origin';
const MARK_HOVER = 'hover';
const MARK_BLOCKED = 'blocked';
const MARK_SELECTED = 'selected';

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function cellName(index: number): string {
	return `${String.fromCharCode(65 + (index % GRID_SIZE))}${Math.floor(index / GRID_SIZE) + 1}`;
}

export class NoesisDragLabPanel extends Component<typeof NoesisDragLabPanel> {
	public static propsDefinition = {
		startWithMutate: { type: PropTypes.Boolean, default: false },
		logToConsole: { type: PropTypes.Boolean, default: true },
	};

	private _gizmo: NoesisGizmo | undefined = undefined;
	private _vm: IUiViewModelObject = {};
	private _isMutate: boolean = false;

	private readonly _boardA: string[] = [];
	private _dragFrom: number = -1;
	private _hover: number = -1;
	private _hasMoved: boolean = false;
	private _selected: number = -1;

	private readonly _boardB: number[] = [];
	private readonly _pushed: { [key: string]: number } = {};
	private _nudgeFlip: number = 0;
	private _dropCount: number = 0;
	private _twoWaySource: string = '?';
	private _lastDropPiece: number = -1;
	private _lastDropMs: number = 0;

	private readonly _counts: { [key: string]: number } = {};
	private _lastKind: string = '';
	private _lastIndex: number = -1;
	private _lastSrc: string = '';
	private _lastEventMs: number = 0;

	private readonly _logs: string[] = [];
	private _logSerial: number = 0;

	//#region Lifecycle

	public start(): void {
		this._gizmo = this.entity.as(NoesisGizmo);
		// 런타임은 숨긴 gizmo 를 기기별로 기억한다. 앞서 붙어 있던 스크립트(NoesisBoard_Panel 등)가
		// 숨긴 채 끝나면 이 패널도 그대로 안 보인다. 그래서 패널마다 자기가 켜고 시작한다
		this._gizmo.setLocalEntityVisibility(true);
		this._isMutate = this.props.startWithMutate === true;
		this.resetBoards();
		this._vm = this.buildContext();
		this.log('ready - drag a piece');
		this.applyTo(this._vm);
		// 첫 대입은 갱신 방식과 무관하게 항상 한다
		this._gizmo.dataContext = this._vm;
	}

	//#endregion

	//#region Context

	private buildContext(): IUiViewModelObject {
		const cells: IUiViewModelObject[] = [];
		for (let i = 0; i < CELL_COUNT; i++) {
			cells.push({
				Label: '',
				State: 'empty',
				Mark: MARK_NONE,
				OnMouseDown: () => this.onCellDown(i, SRC_MOUSE),
				OnMouseEnter: () => this.onCellEnter(i, SRC_MOUSE),
				OnMouseUp: () => this.onCellUp(i, SRC_MOUSE),
				OnTouchDown: () => this.onCellDown(i, SRC_TOUCH),
				OnTouchEnter: () => this.onCellEnter(i, SRC_TOUCH),
				OnTouchUp: () => this.onCellUp(i, SRC_TOUCH),
			});
		}

		const context: IUiViewModelObject = {
			Status: '',
			Log: '',
			UpdateLabel: '',
			Cells: cells,
			OnRootUp: () => this.onRootUp(),
			OnReset: () => this.onReset(),
			OnToggleUpdate: () => this.onToggleUpdate(),
		};
		for (let k = 0; k < PIECES.length; k++) {
			const name = `P${k + 1}`;
			context[`${name}X`] = 0;
			context[`${name}Y`] = 0;
			context[`On${name}MouseUp`] = () => this.onPieceUp(k, SRC_MOUSE);
			context[`On${name}TouchUp`] = () => this.onPieceUp(k, SRC_TOUCH);
			context[`On${name}LostCapture`] = () => this.onPieceUp(k, SRC_CAPTURE);
		}
		return context;
	}

	private applyTo(target: IUiViewModelObject): void {
		target.Status = this.statusText();
		target.Log = this._logs.join('\n');
		target.UpdateLabel = this._isMutate === true ? 'update: mutate' : 'update: reassign';

		const cells = target.Cells as IUiViewModelObject[];
		for (let i = 0; i < CELL_COUNT; i++) {
			const piece = this._boardA[i];
			cells[i].State = piece === '' ? 'empty' : piece;
			cells[i].Label = piece === '' ? '' : piece.charAt(0).toUpperCase();
			cells[i].Mark = this.markOf(i);
		}
		for (const key of Object.keys(this._pushed)) {
			target[key] = this._pushed[key];
		}
	}

	/**
	 * reassign = 같은 객체를 dataContext 에 다시 대입한다 (API 가 보장하는 길).
	 * mutate = 대입 없이 속성만 바꾼다. 이 방식으로도 화면이 따라오면 런타임이 변경을 추적한다는 뜻이다.
	 */
	private push(): void {
		const gizmo = this._gizmo;
		if (gizmo === undefined) {
			return;
		}
		this.applyTo(this._vm);
		try {
			if (this._isMutate === true) {
				const live = gizmo.dataContext;
				if (live !== undefined && live !== null && live !== this._vm) {
					this.applyTo(live);
				}
			} else {
				gizmo.dataContext = this._vm;
			}
		} catch (error) {
			console.error(`[NoesisDragLab] push 실패: ${error}`);
		}
	}

	private statusText(): string {
		const count = (key: string): number => this._counts[key] ?? 0;
		const triple = (src: string): string =>
			`${count(`${KIND_DOWN}.${src}`)}/${count(`${KIND_ENTER}.${src}`)}/${count(`${KIND_UP}.${src}`)}`;
		const lineA = `A down/enter/up  mouse ${triple(SRC_MOUSE)}  touch ${triple(SRC_TOUCH)}`;
		const lineB = `B drops ${this._dropCount}  up mouse/touch/capture ${count(`drop.${SRC_MOUSE}`)}/${count(`drop.${SRC_TOUCH}`)}/${count(`drop.${SRC_CAPTURE}`)}  two-way via ${this._twoWaySource}`;
		return `${lineA}\n${lineB}`;
	}

	private log(message: string): void {
		this._logSerial++;
		this._logs.push(`${this._logSerial}. ${message}`);
		while (this._logs.length > LOG_LINES) {
			this._logs.shift();
		}
		if (this.props.logToConsole === true) {
			console.log(`[NoesisDragLab] ${message}`);
		}
	}

	private bump(key: string): void {
		this._counts[key] = (this._counts[key] ?? 0) + 1;
	}

	//#endregion

	//#region Board A - cell events

	private markOf(index: number): string {
		if (this._dragFrom >= 0) {
			if (index === this._hover && index !== this._dragFrom) {
				return this._boardA[index] === '' ? MARK_HOVER : MARK_BLOCKED;
			}
			if (index === this._dragFrom) {
				return MARK_ORIGIN;
			}
		}
		return index === this._selected ? MARK_SELECTED : MARK_NONE;
	}

	/** 터치가 마우스 이벤트로도 승격되어 같은 입력이 두 번 오는 경우를 거른다 */
	private isDuplicate(kind: string, index: number, src: string): boolean {
		const now = Date.now();
		const isRepeat = this._lastKind === kind
			&& this._lastIndex === index
			&& this._lastSrc !== src
			&& now - this._lastEventMs < DUPLICATE_WINDOW_MS;
		if (isRepeat === false) {
			this._lastKind = kind;
			this._lastIndex = index;
			this._lastSrc = src;
			this._lastEventMs = now;
		}
		return isRepeat;
	}

	private onCellDown(index: number, src: string): void {
		this.bump(`${KIND_DOWN}.${src}`);
		if (this.isDuplicate(KIND_DOWN, index, src) === true) {
			this.push();
			return;
		}

		if (this._selected >= 0 && this._boardA[index] === '') {
			// Enter 이벤트가 오지 않는 환경의 대안: 조각을 누른 뒤 빈 칸을 누르면 옮긴다
			this.movePieceA(this._selected, index, 'tap');
			this._selected = -1;
		} else if (this._boardA[index] !== '') {
			this._selected = -1;
			this._dragFrom = index;
			this._hover = index;
			this._hasMoved = false;
			this.log(`${src} down ${cellName(index)} - drag start`);
		} else {
			this._selected = -1;
		}
		this.push();
	}

	private onCellEnter(index: number, src: string): void {
		if (this._dragFrom < 0 || index === this._hover) {
			return;
		}
		this.bump(`${KIND_ENTER}.${src}`);
		this._hover = index;
		this._hasMoved = true;
		this.log(`${src} enter ${cellName(index)}`);
		this.push();
	}

	private onCellUp(index: number, src: string): void {
		this.bump(`${KIND_UP}.${src}`);
		if (this._dragFrom < 0 || this.isDuplicate(KIND_UP, index, src) === true) {
			this.push();
			return;
		}

		const from = this._dragFrom;
		// 누른 칸이 입력을 붙잡는(capture) 환경에서는 Up 이 출발 칸으로 온다. 그때는 마지막 hover 를 쓴다
		const target = index === from && this._hover !== from ? this._hover : index;
		this._dragFrom = -1;
		this._hover = -1;

		if (target === from) {
			if (this._hasMoved === false) {
				this._selected = from;
				this.log(`${src} up ${cellName(from)} - selected, tap an empty cell`);
			} else {
				this.log(`${src} up ${cellName(from)} - back to origin`);
			}
		} else if (this._boardA[target] === '') {
			this.movePieceA(from, target, src);
		} else {
			this.log(`${src} up ${cellName(target)} - blocked, reverted`);
		}
		this.push();
	}

	private onRootUp(): void {
		// 칸의 Up 이 먼저 처리되므로, 여기까지 드래그가 남아 있으면 보드 밖에서 놓은 것이다
		if (this._dragFrom < 0) {
			return;
		}
		this.log(`released outside - cancelled ${cellName(this._dragFrom)}`);
		this._dragFrom = -1;
		this._hover = -1;
		this.push();
	}

	private movePieceA(from: number, to: number, how: string): void {
		this._boardA[to] = this._boardA[from];
		this._boardA[from] = '';
		this.log(`${how} move ${cellName(from)} -> ${cellName(to)}`);
	}

	//#endregion

	//#region Board B - native drag + snap

	private placePieceB(piece: number, cell: number): void {
		this._boardB[piece] = cell;
		this._nudgeFlip = this._nudgeFlip === 0 ? 1 : 0;
		const nudge = this._nudgeFlip * NUDGE_PX;
		const name = `P${piece + 1}`;
		this._pushed[`${name}X`] = BOARD_B_LEFT + (cell % GRID_SIZE) * CELL_PX + PIECE_INSET_PX + nudge;
		this._pushed[`${name}Y`] = BOARD_B_TOP + Math.floor(cell / GRID_SIZE) * CELL_PX + PIECE_INSET_PX + nudge;
	}

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

	private onPieceUp(piece: number, src: string): void {
		this.bump(`drop.${src}`);
		const now = Date.now();
		if (this._lastDropPiece === piece && now - this._lastDropMs < DUPLICATE_WINDOW_MS) {
			this.push();
			return;
		}
		this._lastDropPiece = piece;
		this._lastDropMs = now;
		this._dropCount++;

		const name = `P${piece + 1}`;
		const x = this.readTwoWay(`${name}X`);
		const y = this.readTwoWay(`${name}Y`);
		const source = x.source !== 'none' ? x.source : y.source;
		const previous = this._boardB[piece];

		if (source === 'none') {
			this.log(`${name} ${src} up - no X/Y change (not moved, or two-way not received)`);
			this.placePieceB(piece, previous);
			this.push();
			return;
		}
		this._twoWaySource = source;

		const column = clamp(Math.round((x.value - BOARD_B_LEFT - PIECE_INSET_PX) / CELL_PX), 0, GRID_SIZE - 1);
		const row = clamp(Math.round((y.value - BOARD_B_TOP - PIECE_INSET_PX) / CELL_PX), 0, GRID_SIZE - 1);
		const cell = row * GRID_SIZE + column;
		const occupant = this._boardB.indexOf(cell);
		const at = `x ${x.value.toFixed(0)} y ${y.value.toFixed(0)}`;

		if (occupant >= 0 && occupant !== piece) {
			this.log(`${name} ${src} up ${at} -> ${cellName(cell)} blocked, reverted`);
			this.placePieceB(piece, previous);
		} else {
			this.log(`${name} ${src} up ${at} -> snap ${cellName(cell)}`);
			this.placePieceB(piece, cell);
		}
		this.push();
	}

	//#endregion

	//#region Buttons

	private resetBoards(): void {
		for (let i = 0; i < CELL_COUNT; i++) {
			this._boardA[i] = '';
		}
		for (let k = 0; k < PIECES.length; k++) {
			this._boardA[START_CELLS[k]] = PIECES[k];
			this.placePieceB(k, START_CELLS[k]);
		}
		this._dragFrom = -1;
		this._hover = -1;
		this._selected = -1;
	}

	private onReset(): void {
		this.resetBoards();
		for (const key of Object.keys(this._counts)) {
			this._counts[key] = 0;
		}
		this._dropCount = 0;
		this._twoWaySource = '?';
		this.log('reset');
		this.push();
	}

	private onToggleUpdate(): void {
		this._isMutate = this._isMutate === false;
		this.log(this._isMutate === true
			? 'update = mutate: if the screen stops updating, mutation is not tracked'
			: 'update = reassign');
		// 전환 자체는 어느 방식이든 보이도록 한 번은 대입한다
		this.applyTo(this._vm);
		if (this._gizmo !== undefined) {
			this._gizmo.dataContext = this._vm;
		}
	}

	//#endregion
}
Component.register(NoesisDragLabPanel);
