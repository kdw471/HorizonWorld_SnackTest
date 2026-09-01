/**
 * Flow Drag Controller - 모바일 단일 터치 그리기 (PUZ_05)
 *
 * 원본 §6 은 VR 기준이지만 이미 "양손을 동시에 사용할 수 없다" 고 못박고 있어
 * 모바일 단일 터치와 자연스럽게 맞는다. 모바일에서는 이렇게 구현한다.
 *
 *   - **단일 터치 전용.** 조작 중 들어오는 추가 터치는 완전히 무시한다 (§6 양손 금지).
 *   - 메인 오브젝트(출발점) 또는 이미 그린 경로의 **머리**를 눌러 그리기를 시작한다.
 *   - 손가락을 끌면 지나간 칸이 순서대로 이어진다. 대각선은 이어지지 않는다 (§5).
 *   - 그렸던 길을 그대로 되짚으면 서브 오브젝트가 꺼진다 (§6 지우기 / §9.3).
 *   - **손을 떼도 그린 경로는 그대로 남는다** (§6 그랩 해제).
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { FlowBoard } from 'Flow_Board';
import {
	EExtendRejection,
	EFlowColor,
	FlowCell,
} from 'Flow_Definitions';

//#region Types

export type FlowDragBeginResult = {
	isAccepted: boolean,
	color?: EFlowColor,
	/** 이어 그리기인지 (이미 그린 경로의 머리를 잡았는지) */
	isResuming?: boolean,
	reason?: string,
}

/** 드래그 중 특정 칸 위에 있을 때의 미리보기 */
export type FlowDragPreview = {
	color: EFlowColor,
	/** 지금 가리키고 있는 칸 */
	cell: FlowCell,
	/** 이어질 수 있는지 */
	canExtend: boolean,
	/** 이 이동이 지우기인지 - §6 */
	isUndo: boolean,
	rejection: EExtendRejection,
	/** 이번 드래그에서 실제로 이어진 칸 수 */
	extendedCount: number,
}

export type FlowDragEndResult = {
	color: EFlowColor,
	/** 이번 드래그에서 새로 이어진 칸 수 */
	extendedCount: number,
	/** 이번 드래그에서 지운 칸 수 */
	undoneCount: number,
	/** 경로가 도착 지점까지 완결되었는지 */
	isPathComplete: boolean,
}

//#endregion

export class FlowDragController {
	private readonly _board: FlowBoard;

	private _color: EFlowColor | undefined = undefined;
	private _extendedCount: number = 0;
	private _undoneCount: number = 0;

	public get isDrawing(): boolean {
		return this._color !== undefined;
	}

	public get drawingColor(): EFlowColor | undefined {
		return this._color;
	}

	constructor(board: FlowBoard) {
		this._board = board;
	}

	//#region Drag lifecycle

	/**
	 * 그리기를 시작한다.
	 * 출발 메인 오브젝트이거나 이미 그린 경로의 머리여야 한다 (§6).
	 */
	public begin(row: number, col: number): FlowDragBeginResult {
		if (this._color !== undefined) {
			// 단일 터치 전용 - 양손 동시 사용 금지 (§6)
			return { isAccepted: false, reason: 'already-drawing' };
		}

		const color = this._board.getBeginColor(row, col);
		if (color === undefined) {
			return { isAccepted: false, reason: 'not-interactable' };
		}

		const existingPath = this._board.getPath(color);
		const isResuming = existingPath.length > 0;
		if (isResuming === false && this._board.beginPath(color) === false) {
			return { isAccepted: false, reason: 'cannot-begin-path' };
		}

		this._color = color;
		this._extendedCount = 0;
		this._undoneCount = 0;
		return { isAccepted: true, color: color, isResuming: isResuming };
	}

	/**
	 * 손가락이 지나가는 칸을 알린다.
	 * 이어질 수 있으면 잇고, 되짚는 이동이면 지운다.
	 */
	public moveTo(row: number, col: number): FlowDragPreview | undefined {
		const color = this._color;
		if (color === undefined) {
			return undefined;
		}

		const head = this._board.getPathHead(color);
		if (head !== undefined && head.row === row && head.col === col) {
			// 머리 위에 그대로 있는 경우 - 아무 일도 일어나지 않는다
			return {
				color: color,
				cell: { row: row, col: col },
				canExtend: false,
				isUndo: false,
				rejection: EExtendRejection.NONE,
				extendedCount: this._extendedCount,
			};
		}

		const check = this._board.canExtend(color, row, col);
		if (check.isValid) {
			this._board.extend(color, row, col);
			if (check.isUndo) {
				this._undoneCount++;
			}
			else {
				this._extendedCount++;
			}
		}

		return {
			color: color,
			cell: { row: row, col: col },
			canExtend: check.isValid && check.isUndo === false,
			isUndo: check.isUndo,
			rejection: check.rejection,
			extendedCount: this._extendedCount,
		};
	}

	/**
	 * 손을 뗀다 - §6 그랩 해제.
	 * 그린 경로는 그대로 남고, 손과의 연결만 끊어진다.
	 */
	public end(): FlowDragEndResult | undefined {
		const color = this._color;
		if (color === undefined) {
			return undefined;
		}

		const result: FlowDragEndResult = {
			color: color,
			extendedCount: this._extendedCount,
			undoneCount: this._undoneCount,
			isPathComplete: this._board.isPathComplete(color),
		};

		this._color = undefined;
		this._extendedCount = 0;
		this._undoneCount = 0;
		return result;
	}

	/** 그리기를 취소한다. 경로는 그대로 남는다 (§6 과 동일) */
	public cancel(): void {
		this._color = undefined;
		this._extendedCount = 0;
		this._undoneCount = 0;
	}

	//#endregion
}
