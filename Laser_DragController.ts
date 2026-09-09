/**
 * Laser Drag Controller - 모바일 단일 터치 드래그 앤 드롭 (PUZ_01)
 *
 * 러시아워와 같은 조작 규격을 따른다.
 *   - 동시에 한 개의 크리스탈만 드래그한다. 조작 중 들어오는 추가 터치는 완전히 무시한다.
 *   - 터치 지점에 가장 가까운 대상 하나만 선택한다 (히트박스 보정).
 *   - 포인터가 영역 밖으로 나가도 드래그는 유지되고, 놓으면 원래 자리로 돌아간다.
 *   - 놓았을 때 중심이 위치한 칸으로 반올림 스냅한다.
 *
 * 러시아워와 다른 점: 크리스탈은 **인벤토리에서 필드로** 옮기거나
 * **필드에서 회수**할 수 있다. 방향은 배치 후 바꿀 수 없다 (§3 3.4).
 *
 * 좌표는 어댑터가 변환한 "배치 로컬 격자 좌표(실수)" 를 받는다.
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { LaserBoard } from 'Laser_Board';
import {
	LaserCrystal,
	isInsidePlacementArea,
} from 'Laser_Definitions';

//#region Types

/** 드래그가 어디에서 시작했는지 */
export enum EDragOrigin {
	/** 인벤토리 슬롯에서 꺼내는 중 */
	INVENTORY = 'INVENTORY',
	/** 이미 필드에 놓인 것을 옮기는 중 */
	BOARD = 'BOARD',
}

export type LaserDragBeginResult = {
	isAccepted: boolean,
	crystalId?: string,
	origin?: EDragOrigin,
	reason?: string,
}

/** 어댑터가 매 프레임 크리스탈을 그릴 때 쓰는 상태 */
export type LaserDragVisualState = {
	crystalId: string,
	origin: EDragOrigin,
	/** 현재 표시할 연속 좌표 (배치 로컬, 실수) */
	row: number,
	col: number,
	/** 놓으면 들어갈 칸. 놓을 수 없으면 undefined */
	targetRow?: number,
	targetCol?: number,
	/** 지금 놓아도 되는 자리인지 - 하이라이트 색 결정에 쓴다 */
	isValidTarget: boolean,
}

export type LaserDragEndResult = {
	crystalId: string,
	origin: EDragOrigin,
	/** 필드에 놓였는지 */
	didPlace: boolean,
	/** 인벤토리로 회수되었는지 */
	didReturnToInventory: boolean,
	/** 놓인 칸 (didPlace 일 때만) */
	row?: number,
	col?: number,
	reason?: string,
}

export type LaserDragControllerOptions = {
	/** 터치 지점에서 이 거리(칸 단위) 안의 크리스탈까지 선택 대상으로 본다 */
	selectionRadiusInCells?: number,
}

const DEFAULT_SELECTION_RADIUS = 0.75;

//#endregion

export class LaserDragController {
	private readonly _board: LaserBoard;
	private readonly _selectionRadius: number;

	private _crystalId: string | undefined = undefined;
	private _origin: EDragOrigin = EDragOrigin.INVENTORY;
	/** BOARD 에서 시작했을 때의 원래 칸 - 취소 시 되돌린다 */
	private _sourceRow: number = 0;
	private _sourceCol: number = 0;

	private _currentRow: number = 0;
	private _currentCol: number = 0;

	public get isDragging(): boolean {
		return this._crystalId !== undefined;
	}

	public get draggedCrystalId(): string | undefined {
		return this._crystalId;
	}

	constructor(board: LaserBoard, options: LaserDragControllerOptions = {}) {
		this._board = board;
		this._selectionRadius = options.selectionRadiusInCells ?? DEFAULT_SELECTION_RADIUS;
	}

	//#region Selection

	/** 터치 지점에서 가장 가까운, 필드에 놓인 크리스탈 */
	public findCrystalAt(gridRow: number, gridCol: number, movableOnly: boolean = false): LaserCrystal | undefined {
		let closest: LaserCrystal | undefined = undefined;
		let closestDistance = Number.MAX_VALUE;

		for (const placed of this._board.placedCrystals) {
			if (movableOnly && placed.isFixed) {
				continue;
			}
			const rowDelta = placed.row - gridRow;
			const colDelta = placed.col - gridCol;
			const distance = Math.sqrt(rowDelta * rowDelta + colDelta * colDelta);
			if (distance < closestDistance) {
				closestDistance = distance;
				closest = placed;
			}
		}

		if (closest === undefined || closestDistance > this._selectionRadius) {
			return undefined;
		}
		return closest;
	}

	//#endregion

	//#region Drag lifecycle

	/** 인벤토리 슬롯의 크리스탈을 집는다 */
	public beginFromInventory(crystalId: string): LaserDragBeginResult {
		if (this._crystalId !== undefined) {
			// 단일 터치 전용 - 조작 중 추가 터치는 무시
			return { isAccepted: false, reason: 'already-dragging' };
		}
		if (this._board.inventory.some((crystal) => crystal.id === crystalId) === false) {
			return { isAccepted: false, reason: 'not-in-inventory' };
		}

		this._crystalId = crystalId;
		this._origin = EDragOrigin.INVENTORY;
		this._sourceRow = -1;
		this._sourceCol = -1;
		this._currentRow = -1;
		this._currentCol = -1;
		return { isAccepted: true, crystalId: crystalId, origin: EDragOrigin.INVENTORY };
	}

	/**
	 * 필드에 놓인 크리스탈을 집어 옮긴다.
	 * 고정 크리스탈은 집을 수 없다 (§4.3).
	 */
	public beginFromBoard(gridRow: number, gridCol: number): LaserDragBeginResult {
		if (this._crystalId !== undefined) {
			return { isAccepted: false, reason: 'already-dragging' };
		}

		// 반경 안의 "움직일 수 있는" 크리스탈 중 최근접을 고른다.
		// 고정 크리스탈이 조금 더 가깝다는 이유로 드래그 전체가 거절되면 안 된다 (PUZ_00 §8.2).
		const crystal = this.findCrystalAt(gridRow, gridCol, true);
		if (crystal === undefined) {
			// 이동 가능 필터로 못 찾았는데 무필터로는 찾았다면 반경 안에 고정 크리스탈뿐이다
			if (this.findCrystalAt(gridRow, gridCol) !== undefined) {
				return { isAccepted: false, reason: 'crystal-is-fixed' };
			}
			return { isAccepted: false, reason: 'no-crystal-under-touch' };
		}

		const placed = this._board.placedCrystals.find((candidate) => candidate.id === crystal.id);
		if (placed === undefined) {
			return { isAccepted: false, reason: 'no-crystal-under-touch' };
		}
		if (placed.isFixed) {
			return { isAccepted: false, reason: 'crystal-is-fixed' };
		}

		this._crystalId = placed.id;
		this._origin = EDragOrigin.BOARD;
		this._sourceRow = placed.row;
		this._sourceCol = placed.col;
		this._currentRow = placed.row;
		this._currentCol = placed.col;
		return { isAccepted: true, crystalId: placed.id, origin: EDragOrigin.BOARD };
	}

	/** 드래그 위치를 갱신한다. 영역 밖으로 나가도 드래그는 유지된다 */
	public update(gridRow: number, gridCol: number): LaserDragVisualState | undefined {
		if (this._crystalId === undefined) {
			return undefined;
		}

		this._currentRow = gridRow;
		this._currentCol = gridCol;

		const targetRow = Math.round(gridRow);
		const targetCol = Math.round(gridCol);
		const isSameCell = this._origin === EDragOrigin.BOARD && targetRow === this._sourceRow && targetCol === this._sourceCol;
		const isValid = isSameCell || this._board.canPlaceAt(targetRow, targetCol).isPlaced;

		return {
			crystalId: this._crystalId,
			origin: this._origin,
			row: gridRow,
			col: gridCol,
			targetRow: isInsidePlacementArea(targetRow, targetCol) ? targetRow : undefined,
			targetCol: isInsidePlacementArea(targetRow, targetCol) ? targetCol : undefined,
			isValidTarget: isValid,
		};
	}

	/**
	 * 손을 뗀다.
	 *   - 배치 영역의 빈 칸 위면 그 칸에 스냅해 놓는다
	 *   - 그 밖이면: 인벤토리에서 꺼낸 것은 인벤토리로 돌아가고,
	 *     필드에서 집은 것은 인벤토리로 회수된다 (§3 3.3 - 다시 놓을 수 있다)
	 */
	public end(): LaserDragEndResult | undefined {
		const crystalId = this._crystalId;
		if (crystalId === undefined) {
			return undefined;
		}

		const origin = this._origin;
		const sourceRow = this._sourceRow;
		const sourceCol = this._sourceCol;
		const targetRow = Math.round(this._currentRow);
		const targetCol = Math.round(this._currentCol);
		this.reset();

		if (isInsidePlacementArea(targetRow, targetCol) === false) {
			// 영역 밖에 놓았다 - 필드에 있던 것은 인벤토리로 회수한다
			if (origin === EDragOrigin.BOARD) {
				const picked = this._board.pickUp(sourceRow, sourceCol);
				return {
					crystalId: crystalId,
					origin: origin,
					didPlace: false,
					didReturnToInventory: picked !== undefined,
				};
			}
			// 인벤토리에서 꺼낸 것은 그대로 인벤토리에 남는다
			return { crystalId: crystalId, origin: origin, didPlace: false, didReturnToInventory: true };
		}

		if (origin === EDragOrigin.INVENTORY) {
			const result = this._board.placeFromInventory(crystalId, targetRow, targetCol);
			return {
				crystalId: crystalId,
				origin: origin,
				didPlace: result.isPlaced,
				didReturnToInventory: result.isPlaced === false,
				row: result.isPlaced ? targetRow : undefined,
				col: result.isPlaced ? targetCol : undefined,
				reason: result.reason,
			};
		}

		const moved = this._board.moveCrystal(sourceRow, sourceCol, targetRow, targetCol);
		return {
			crystalId: crystalId,
			origin: origin,
			didPlace: moved.isPlaced,
			didReturnToInventory: false,
			row: moved.isPlaced ? targetRow : sourceRow,
			col: moved.isPlaced ? targetCol : sourceCol,
			reason: moved.reason,
		};
	}

	/** 드래그를 취소한다. 크리스탈은 원래 자리에 그대로 남는다 */
	public cancel(): void {
		this.reset();
	}

	//#endregion

	private reset(): void {
		this._crystalId = undefined;
		this._origin = EDragOrigin.INVENTORY;
	}
}
