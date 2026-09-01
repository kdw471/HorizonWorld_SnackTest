/**
 * Rush Hour Drag Controller - 모바일 단일 터치 드래그 앤 드롭 조작
 *
 * 모바일 사양 `Documents/Prompts/Rush_Hour_Mobile_Specification.md` §7 / §8 / §9 구현.
 *
 *   §8 단일 터치 전용 : 동시에 한 오브젝트만 드래그. 조작 중 들어오는 추가 터치는 완전히 무시.
 *   §8 히트박스 보정  : 터치 지점 중심부에 가장 가까운 오브젝트 하나만 선택.
 *   §8 화면 이탈      : 포인터가 영역 밖으로 나가도 드래그는 유지되고 최외곽 경계에 고정.
 *   §7 스냅           : 드래그 종료 시 중심이 위치한 칸으로 반올림 스냅. 막히면 막히기 직전 칸.
 *   §9 USB 결합       : 도착 포인트 전면(READY)에서 슬롯 방향으로 더 끌면 꽂히고,
 *                       반대로 끌면 다시 뽑힌다. 꽂힌 상태는 3칸을 점유한다.
 *
 * 이 클래스는 horizon/core 에 의존하지 않는 순수 로직이다 (PUZ_00 §7.1).
 * 화면 좌표 -> 보드 격자 좌표(실수) 변환은 어댑터 계층의 책임이며,
 * 이 컨트롤러는 이미 변환된 "플레이 로컬 격자 좌표(실수)"만 받는다.
 */

import { RushHourBoard } from 'RushHour_Board';
import {
	EGoalStatus,
	EMoveDirection,
	EOrientation,
	RushHourMove,
	RushHourPiece,
	getDirectionTowardsEdge,
	getPieceCells,
} from 'RushHour_Definitions';

//#region Types

/** 드래그가 움직이는 축 */
export enum EDragAxis {
	/** 세로 이동 - row 값이 변한다 */
	ROW = 'ROW',
	/** 가로 이동 - col 값이 변한다 */
	COL = 'COL',
	/** 1x1(FREE) 오브젝트가 아직 축을 확정하지 않은 상태 */
	UNDECIDED = 'UNDECIDED',
}

export type DragBeginResult = {
	isAccepted: boolean,
	pieceId?: string,
	/** 거절 사유 (디버그/로그용) */
	reason?: string,
}

/** 어댑터가 매 프레임 오브젝트를 그릴 때 쓰는 상태 */
export type DragVisualState = {
	pieceId: string,
	/** 현재 표시할 연속 좌표 (플레이 로컬, 실수). 좌측·상단 블록 중심 기준 */
	row: number,
	col: number,
	axis: EDragAxis,
	/** 슬롯으로 밀어 넣은 정도 0..1 (§9). 1 에 가까울수록 결합 직전 */
	dockProgress: number,
	/** 현재 꽂혀 있는지 */
	isDocked: boolean,
}

/** 드래그 종료 결과 */
export type DragEndResult = {
	pieceId: string,
	/** 실제로 칸을 이동했다면 그 이동 내용 */
	move?: RushHourMove,
	/** 이번 드래그로 USB 가 꽂혔는지 (§9) */
	didDock: boolean,
	/** 이번 드래그로 USB 가 뽑혔는지 (§9) */
	didUndock: boolean,
	/** 스냅이 끝난 최종 격자 좌표 */
	row: number,
	col: number,
}

export type DragControllerOptions = {
	/**
	 * 터치 지점에서 이 거리(칸 단위) 안에 있는 오브젝트까지 선택 대상으로 본다 - §8 히트박스 보정.
	 * 0.5 면 칸 경계까지, 그보다 크면 살짝 빗나간 터치도 잡아준다.
	 */
	selectionRadiusInCells?: number,
	/**
	 * 1x1(FREE) 오브젝트의 축을 확정하는 데 필요한 최소 이동량(칸 단위).
	 * 이보다 적게 움직이면 아직 축을 정하지 않는다.
	 */
	axisLockThresholdInCells?: number,
	/**
	 * 결합/분리를 확정하는 슬롯 진입 비율 (0..1) - §9.
	 * 0.5 면 슬롯 쪽으로 반 칸 이상 밀어 넣었을 때 꽂힌다.
	 */
	dockThreshold?: number,
}

const DEFAULT_SELECTION_RADIUS = 0.75;
const DEFAULT_AXIS_LOCK_THRESHOLD = 0.25;
const DEFAULT_DOCK_THRESHOLD = 0.5;

/** 결합 시 USB 가 슬롯 안으로 더 들어가는 칸 수 (§9 - 총 3칸 점유) */
const DOCK_TRAVEL_IN_CELLS = 1;

//#endregion

export class RushHourDragController {
	private readonly _board: RushHourBoard;
	private readonly _selectionRadius: number;
	private readonly _axisLockThreshold: number;
	private readonly _dockThreshold: number;

	private _pieceId: string | undefined = undefined;
	private _axis: EDragAxis = EDragAxis.UNDECIDED;

	/** 드래그를 시작한 시점의 오브젝트 격자 좌표 */
	private _originRow: number = 0;
	private _originCol: number = 0;
	/** 드래그를 시작한 시점의 터치 격자 좌표 */
	private _touchOriginRow: number = 0;
	private _touchOriginCol: number = 0;

	/** 축 방향 이동 가능 범위 (오브젝트 좌표 기준, 결합 슬롯 포함) */
	private _minValue: number = 0;
	private _maxValue: number = 0;
	/** 결합이 가능한 경우의 슬롯 좌표. 불가능하면 undefined */
	private _dockValue: number | undefined = undefined;
	/** 결합 판정에 쓰는 밀착 좌표 */
	private _flushValue: number = 0;

	/** 현재 표시 중인 연속 축 좌표 */
	private _currentValue: number = 0;
	/**
	 * 드래그 시작 시점의 축 좌표. update() 의 기준점이다.
	 * 결합된 USB 는 저장 좌표(밀착)가 아니라 슬롯 좌표에서 드래그가 시작되므로,
	 * 저장 좌표를 기준으로 삼으면 첫 update 만으로 반 칸 이상 이동한 셈이 되어
	 * 탭 수준의 지터에도 분리가 확정돼 버린다 (§9 반 칸 드래그 규칙 위반).
	 */
	private _beginValue: number = 0;
	/** 드래그 시작 시점의 결합 여부 */
	private _wasDockedOnBegin: boolean = false;

	public get isDragging(): boolean {
		return this._pieceId !== undefined;
	}

	public get draggedPieceId(): string | undefined {
		return this._pieceId;
	}

	constructor(board: RushHourBoard, options: DragControllerOptions = {}) {
		this._board = board;
		this._selectionRadius = options.selectionRadiusInCells ?? DEFAULT_SELECTION_RADIUS;
		this._axisLockThreshold = options.axisLockThresholdInCells ?? DEFAULT_AXIS_LOCK_THRESHOLD;
		this._dockThreshold = options.dockThreshold ?? DEFAULT_DOCK_THRESHOLD;
	}

	//#region Selection

	/**
	 * 터치 지점에서 가장 가까운 선택 가능 오브젝트를 찾는다 - §8.
	 * 오브젝트가 점유한 각 칸의 중심까지의 거리를 재고, 가장 가까운 하나만 돌려준다.
	 */
	public findPieceAt(gridRow: number, gridCol: number): RushHourPiece | undefined {
		let closest: RushHourPiece | undefined = undefined;
		let closestDistance = Number.MAX_VALUE;

		for (const piece of this._board.pieces) {
			for (const cell of getPieceCells(piece)) {
				const rowDelta = cell.row - gridRow;
				const colDelta = cell.col - gridCol;
				const distance = Math.sqrt(rowDelta * rowDelta + colDelta * colDelta);
				if (distance < closestDistance) {
					closestDistance = distance;
					closest = piece;
				}
			}
		}

		if (closest === undefined || closestDistance > this._selectionRadius) {
			return undefined;
		}
		return closest;
	}

	//#endregion

	//#region Drag lifecycle

	/**
	 * 드래그를 시작한다 - §8.
	 * 이미 다른 오브젝트를 조작 중이면 추가 터치를 완전히 무시한다 (단일 터치 전용).
	 */
	public begin(gridRow: number, gridCol: number): DragBeginResult {
		if (this._pieceId !== undefined) {
			// 멀티터치 차단 - §8
			return { isAccepted: false, reason: 'already-dragging' };
		}

		const piece = this.findPieceAt(gridRow, gridCol);
		if (piece === undefined) {
			return { isAccepted: false, reason: 'no-piece-under-touch' };
		}

		this._pieceId = piece.id;
		this._originRow = piece.row;
		this._originCol = piece.col;
		this._touchOriginRow = gridRow;
		this._touchOriginCol = gridCol;
		this._wasDockedOnBegin = this._board.isDocked(piece.id);

		if (piece.orientation === EOrientation.HORIZONTAL) {
			this._axis = EDragAxis.COL;
		}
		else if (piece.orientation === EOrientation.VERTICAL) {
			this._axis = EDragAxis.ROW;
		}
		else {
			this._axis = EDragAxis.UNDECIDED;
		}

		this.recomputeRange();
		this._currentValue = this._wasDockedOnBegin && this._dockValue !== undefined
			? this._dockValue
			: this.getOriginValue();
		this._beginValue = this._currentValue;

		return { isAccepted: true, pieceId: piece.id };
	}

	/**
	 * 드래그 위치를 갱신한다 - §7 / §8.
	 * 포인터가 퍼즐 영역 밖으로 나가도 드래그는 유지되며, 이동 가능한 최외곽에 고정된다.
	 */
	public update(gridRow: number, gridCol: number): DragVisualState | undefined {
		if (this._pieceId === undefined) {
			return undefined;
		}
		if (isNaN(gridRow) || isNaN(gridCol)) {
			// NaN 좌표(평면 뒤 ray 등)는 경계 클램프를 통과해 _currentValue 를 오염시키므로 무시한다
			return this.buildVisualState();
		}

		const rowDelta = gridRow - this._touchOriginRow;
		const colDelta = gridCol - this._touchOriginCol;

		if (this._axis === EDragAxis.UNDECIDED) {
			// 1x1(FREE) 은 처음 유의미하게 움직인 방향으로 축을 확정한다 - §7 "허용된 축 값만 유지"
			const absRow = Math.abs(rowDelta);
			const absCol = Math.abs(colDelta);
			if (Math.max(absRow, absCol) < this._axisLockThreshold) {
				return this.buildVisualState();
			}
			this._axis = absRow >= absCol ? EDragAxis.ROW : EDragAxis.COL;
			this.recomputeRange();
			// 축이 정해지면 기준 좌표의 의미(행/열)가 바뀌므로 다시 잡는다 (1x1 은 결합이 없다)
			this._beginValue = this.getOriginValue();
		}

		const delta = this._axis === EDragAxis.ROW ? rowDelta : colDelta;
		const desired = this._beginValue + delta;

		// 영역 밖으로 나가도 경계에 고정 - §8
		this._currentValue = Math.min(this._maxValue, Math.max(this._minValue, desired));

		return this.buildVisualState();
	}

	/**
	 * 드래그를 끝내고 스냅한다 - §7.
	 * 결합/분리 판정도 여기서 확정한다 - §9.
	 */
	public end(): DragEndResult | undefined {
		if (this._pieceId === undefined) {
			return undefined;
		}

		const pieceId = this._pieceId;
		const axis = this._axis;
		const value = this._currentValue;
		const dockValue = this._dockValue;
		const flushValue = this._flushValue;
		const wasDocked = this._wasDockedOnBegin;
		this.reset();

		let didDock = false;
		let didUndock = false;

		// 슬롯 진입 판정 - §9
		if (dockValue !== undefined) {
			const towardsSlot = dockValue - flushValue;
			const progress = (value - flushValue) / towardsSlot;

			if (wasDocked === false && progress >= this._dockThreshold) {
				// 먼저 밀착 위치까지 이동시킨 뒤 꽂는다
				this.snapPieceToAxisValue(pieceId, axis, flushValue);
				didDock = this._board.dock(pieceId);
			}
			else if (wasDocked === true && progress < this._dockThreshold) {
				didUndock = this._board.undock(pieceId);
			}
		}

		let move: RushHourMove | undefined = undefined;
		if (didDock === false && this._board.isDocked(pieceId) === false) {
			move = this.snapPieceToAxisValue(pieceId, axis, Math.round(value));
		}

		const piece = this._board.getPiece(pieceId);
		return {
			pieceId: pieceId,
			move: move,
			didDock: didDock,
			didUndock: didUndock,
			row: piece?.row ?? 0,
			col: piece?.col ?? 0,
		};
	}

	/** 드래그를 취소하고 오브젝트를 원래 칸에 그대로 둔다 */
	public cancel(): void {
		this.reset();
	}

	//#endregion

	//#region Internal

	private getOriginValue(): number {
		return this._axis === EDragAxis.ROW ? this._originRow : this._originCol;
	}

	/**
	 * 현재 축에서 이동 가능한 연속 범위를 다시 계산한다.
	 * 드래그 중에는 다른 오브젝트가 움직이지 않으므로 시작 시점에 한 번 구해두면 된다.
	 */
	private recomputeRange(): void {
		const pieceId = this._pieceId;
		if (pieceId === undefined) {
			return;
		}

		const origin = this.getOriginValue();
		if (this._axis === EDragAxis.UNDECIDED) {
			this._minValue = origin;
			this._maxValue = origin;
			this._dockValue = undefined;
			this._flushValue = origin;
			return;
		}

		const negative = this._axis === EDragAxis.ROW ? EMoveDirection.UP : EMoveDirection.LEFT;
		const positive = this._axis === EDragAxis.ROW ? EMoveDirection.DOWN : EMoveDirection.RIGHT;

		this._minValue = origin - this._board.getMaxSteps(pieceId, negative);
		this._maxValue = origin + this._board.getMaxSteps(pieceId, positive);

		this.recomputeDockRange(pieceId, origin);
	}

	/**
	 * 목표 USB 가 이번 드래그로 슬롯까지 갈 수 있으면, 이동 범위를 슬롯 쪽으로 1칸 더 넓힌다 - §9.
	 * 이미 꽂혀 있는 경우에도 범위를 넓혀 두어야 반대 방향으로 끌어 뽑을 수 있다.
	 */
	private recomputeDockRange(pieceId: string, origin: number): void {
		this._dockValue = undefined;
		this._flushValue = origin;

		const piece = this._board.getPiece(pieceId);
		if (piece === undefined || piece.isGoal === false) {
			return;
		}

		const endPoint = this._board.getEndPointForPiece(pieceId);
		if (endPoint === undefined) {
			return;
		}

		const towardsSlot = getDirectionTowardsEdge(endPoint.edge);
		const isRowAxis = towardsSlot === EMoveDirection.UP || towardsSlot === EMoveDirection.DOWN;
		if ((isRowAxis && this._axis !== EDragAxis.ROW) || (isRowAxis === false && this._axis !== EDragAxis.COL)) {
			return;
		}

		const isNegative = towardsSlot === EMoveDirection.UP || towardsSlot === EMoveDirection.LEFT;
		const flush = isNegative ? this._minValue : this._maxValue;

		// 이번 드래그로 밀착 위치까지 갈 수 있어야 결합 후보가 된다.
		const status = this._board.getGoalStatus(pieceId);
		const canReachFlush = status === EGoalStatus.DOCKED || this.isFlushPosition(piece, flush, isNegative);
		if (canReachFlush === false) {
			return;
		}

		this._flushValue = status === EGoalStatus.DOCKED ? origin : flush;
		this._dockValue = this._flushValue + (isNegative ? -DOCK_TRAVEL_IN_CELLS : DOCK_TRAVEL_IN_CELLS);

		if (isNegative) {
			this._minValue = this._dockValue;
		}
		else {
			this._maxValue = this._dockValue;
		}
	}

	/** 주어진 축 좌표가 도착 포인트에 밀착한 위치인지 */
	private isFlushPosition(piece: RushHourPiece, value: number, isNegative: boolean): boolean {
		if (isNegative) {
			return value === 0;
		}
		return value + piece.size - 1 === this._board.size - 1;
	}

	/** 축 좌표를 실제 보드 이동으로 옮긴다 */
	private snapPieceToAxisValue(pieceId: string, axis: EDragAxis, value: number): RushHourMove | undefined {
		const piece = this._board.getPiece(pieceId);
		if (piece === undefined || axis === EDragAxis.UNDECIDED) {
			return undefined;
		}

		const before = axis === EDragAxis.ROW ? piece.row : piece.col;
		const targetRow = axis === EDragAxis.ROW ? value : piece.row;
		const targetCol = axis === EDragAxis.COL ? value : piece.col;

		const result = this._board.snapToCell(pieceId, targetRow, targetCol);
		if (result.steps <= 0) {
			return undefined;
		}

		const after = axis === EDragAxis.ROW ? piece.row : piece.col;
		const isPositive = after > before;
		const direction = axis === EDragAxis.ROW
			? (isPositive ? EMoveDirection.DOWN : EMoveDirection.UP)
			: (isPositive ? EMoveDirection.RIGHT : EMoveDirection.LEFT);

		return { pieceId: pieceId, direction: direction, steps: result.steps };
	}

	private buildVisualState(): DragVisualState | undefined {
		const pieceId = this._pieceId;
		if (pieceId === undefined) {
			return undefined;
		}

		const piece = this._board.getPiece(pieceId);
		if (piece === undefined) {
			return undefined;
		}

		let dockProgress = 0;
		if (this._dockValue !== undefined) {
			const towardsSlot = this._dockValue - this._flushValue;
			const raw = (this._currentValue - this._flushValue) / towardsSlot;
			dockProgress = Math.min(1, Math.max(0, raw));
		}

		return {
			pieceId: pieceId,
			row: this._axis === EDragAxis.ROW ? this._currentValue : piece.row,
			col: this._axis === EDragAxis.COL ? this._currentValue : piece.col,
			axis: this._axis,
			dockProgress: dockProgress,
			isDocked: this._board.isDocked(pieceId),
		};
	}

	private reset(): void {
		this._pieceId = undefined;
		this._axis = EDragAxis.UNDECIDED;
		this._wasDockedOnBegin = false;
		this._dockValue = undefined;
	}

	//#endregion
}
