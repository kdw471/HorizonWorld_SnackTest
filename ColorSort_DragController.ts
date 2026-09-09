/**
 * Color Sort Drag Controller - 모바일 단일 터치 드래그 앤 드롭 (PUZ_03)
 *
 * 원본 사양 §8 은 VR 기준(양손 그랩)이다. 모바일에서는 다음과 같이 대체한다.
 *
 *   - **단일 터치 전용.** 동시에 한 뭉치만 집는다. 조작 중 추가 터치는 완전히 무시한다.
 *     따라서 §8 의 "양손 그랩" 과 "같은 케이스의 오브젝트를 2개 이상 잡을 수 없다" 는
 *     구조적으로 성립하지 않으므로 별도 처리가 필요 없다.
 *   - 그랩 시 **최상위 오브젝트만** 집힌다. 단 같은 색이 연속되면 함께 집힌다 (최대 3개, §6).
 *   - 드래그 중 올바른 케이스 위에 있으면 **미리보기가 활성화**되고, 놓을 수 없으면 비활성이다.
 *   - **영역 밖에서 드랍하면 2초 후 이전 위치에 리스폰**되며, 그때까지 해당 케이스는 잠금이다 (§8 드랍).
 *
 * 구현상 드래그 중에도 건전지는 케이스에 그대로 둔다. 화면에서 손에 붙어 보이는 것은 연출이며,
 * 로직상으로는 드랍이 확정될 때 한 번에 이동한다. 이렇게 하면 드래그 도중 상태가 갈라지지 않는다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { ColorSortBoard } from 'ColorSort_Board';
import {
	Battery,
	ColorSortMove,
	EMoveRejection,
	MoveCheck,
	OUT_OF_BOUNDS_RESPAWN_SECONDS,
} from 'ColorSort_Definitions';

//#region Types

export type ColorSortDragBeginResult = {
	isAccepted: boolean,
	fromCaseIndex?: number,
	/** 함께 집힌 개수 (1~3) */
	count?: number,
	/** 집힌 건전지들 - 연출용 */
	batteries?: Battery[],
	reason?: string,
}

/** 드래그 중 특정 케이스 위에 있을 때의 미리보기 - §8 드랍 */
export type ColorSortDragPreview = {
	fromCaseIndex: number,
	/** 지금 가리키고 있는 케이스. 영역 밖이면 undefined */
	hoverCaseIndex?: number,
	count: number,
	/** 미리보기 활성 여부. 놓을 수 없는 위치에서는 false */
	isPreviewActive: boolean,
	rejection: EMoveRejection,
}

export type ColorSortDragEndResult = {
	fromCaseIndex: number,
	toCaseIndex?: number,
	/** 이동이 성사되었는지 */
	didMove: boolean,
	move?: ColorSortMove,
	/** 영역 밖/무효 위치에 놓아 리스폰 대기에 들어갔는지 - §8 */
	isRespawning: boolean,
	rejection: EMoveRejection,
}

/** 리스폰이 끝났을 때 알려줄 정보 */
export type ColorSortRespawnResult = {
	caseIndex: number,
}

//#endregion

export class ColorSortDragController {
	private readonly _board: ColorSortBoard;
	private readonly _respawnSeconds: number;

	private _fromCaseIndex: number | undefined = undefined;
	private _grabCount: number = 0;
	private _hoverCaseIndex: number | undefined = undefined;

	/**
	 * 리스폰 대기 중인 케이스들과 남은 시간.
	 * 앞선 리스폰이 끝나기 전에 다른 케이스를 또 영역 밖에 드랍할 수 있으므로
	 * 슬롯 하나가 아니라 목록으로 관리한다. 각 드랍은 자기만의 2초를 온전히 기다린다 (§8).
	 */
	private _respawns: { caseIndex: number, remaining: number }[] = [];

	public get isDragging(): boolean {
		return this._fromCaseIndex !== undefined;
	}

	public get grabbedCaseIndex(): number | undefined {
		return this._fromCaseIndex;
	}

	public get isRespawning(): boolean {
		return this._respawns.length > 0;
	}

	constructor(board: ColorSortBoard, respawnSeconds: number = OUT_OF_BOUNDS_RESPAWN_SECONDS) {
		this._board = board;
		this._respawnSeconds = respawnSeconds;
	}

	//#region Drag lifecycle

	/**
	 * 케이스의 최상단 뭉치를 집는다 - §8 그랩.
	 * 닫힘/비활성/잠금 케이스에서는 집을 수 없다.
	 */
	public begin(caseIndex: number): ColorSortDragBeginResult {
		if (this._fromCaseIndex !== undefined) {
			// 단일 터치 전용 - 조작 중 추가 터치는 무시
			return { isAccepted: false, reason: 'already-dragging' };
		}

		const batteryCase = this._board.getCase(caseIndex);
		if (batteryCase === undefined) {
			return { isAccepted: false, reason: 'no-such-case' };
		}
		if (this._board.isCaseOperable(caseIndex) === false) {
			return { isAccepted: false, reason: 'case-not-open' };
		}

		const count = this._board.getGrabCount(caseIndex);
		if (count <= 0) {
			return { isAccepted: false, reason: 'case-empty' };
		}

		this._fromCaseIndex = caseIndex;
		this._grabCount = count;
		this._hoverCaseIndex = undefined;

		return {
			isAccepted: true,
			fromCaseIndex: caseIndex,
			count: count,
			batteries: batteryCase.batteries.slice(batteryCase.batteries.length - count),
		};
	}

	/**
	 * 드래그 중 가리키는 케이스를 갱신한다 - §8 드랍 미리보기.
	 * `caseIndex` 가 undefined 면 퍼즐 영역 밖을 가리키는 중이다.
	 */
	public hover(caseIndex: number | undefined): ColorSortDragPreview | undefined {
		const fromCaseIndex = this._fromCaseIndex;
		if (fromCaseIndex === undefined) {
			return undefined;
		}

		this._hoverCaseIndex = caseIndex;

		if (caseIndex === undefined) {
			return {
				fromCaseIndex: fromCaseIndex,
				hoverCaseIndex: undefined,
				count: this._grabCount,
				isPreviewActive: false,
				rejection: EMoveRejection.NONE,
			};
		}

		const check: MoveCheck = this._board.canMove(fromCaseIndex, caseIndex);
		return {
			fromCaseIndex: fromCaseIndex,
			hoverCaseIndex: caseIndex,
			count: this._grabCount,
			// 놓을 수 없는 위치에서는 미리보기가 활성화되지 않는다
			isPreviewActive: check.isValid,
			rejection: check.rejection,
		};
	}

	/**
	 * 손을 뗀다.
	 *   - 유효한 케이스 위면 이동을 확정한다.
	 *   - 영역 밖이거나 놓을 수 없는 위치면 **2초 뒤 이전 위치로 리스폰**하며,
	 *     그때까지 출발 케이스를 잠근다 (§8 드랍).
	 */
	public end(dropCaseIndex?: number): ColorSortDragEndResult | undefined {
		const fromCaseIndex = this._fromCaseIndex;
		if (fromCaseIndex === undefined) {
			return undefined;
		}

		// NaN(평면 뒤 릴리즈 등 좌표를 만들 수 없는 드랍)은 명시적인 "영역 밖 드랍"으로 취급한다.
		// undefined(인자 생략)와 달리 마지막 hover 케이스로 폴백하지 않는다 - 폴백하면
		// 케이스 위를 지나던 드래그가 평면 뒤에서 끝났을 때 의도치 않은 이동이 확정된다.
		const target = dropCaseIndex === undefined
			? this._hoverCaseIndex
			: (isNaN(dropCaseIndex) ? undefined : dropCaseIndex);
		this._fromCaseIndex = undefined;
		this._grabCount = 0;
		this._hoverCaseIndex = undefined;

		if (target === fromCaseIndex) {
			// 집었던 케이스 위에 그대로 놓은 경우 - 이동도 벌점도 없다.
			// 건전지가 이미 "이전 위치"에 있으므로 리스폰 대기(2초 잠금)를 걸 이유가 없다.
			return {
				fromCaseIndex: fromCaseIndex,
				toCaseIndex: target,
				didMove: false,
				isRespawning: false,
				rejection: EMoveRejection.SAME_CASE,
			};
		}

		if (target !== undefined) {
			const check = this._board.canMove(fromCaseIndex, target);
			if (check.isValid) {
				const move = this._board.move(fromCaseIndex, target);
				return {
					fromCaseIndex: fromCaseIndex,
					toCaseIndex: target,
					didMove: move !== undefined,
					move: move,
					isRespawning: false,
					rejection: EMoveRejection.NONE,
				};
			}

			this.beginRespawn(fromCaseIndex);
			return {
				fromCaseIndex: fromCaseIndex,
				toCaseIndex: target,
				didMove: false,
				isRespawning: true,
				rejection: check.rejection,
			};
		}

		// 영역 밖에 드랍
		this.beginRespawn(fromCaseIndex);
		return {
			fromCaseIndex: fromCaseIndex,
			toCaseIndex: undefined,
			didMove: false,
			isRespawning: true,
			rejection: EMoveRejection.NONE,
		};
	}

	/** 드래그를 취소한다 (일시정지 등). 리스폰 대기 없이 즉시 놓아준다 */
	public cancel(): void {
		this._fromCaseIndex = undefined;
		this._grabCount = 0;
		this._hoverCaseIndex = undefined;
	}

	//#endregion

	//#region Respawn timer (§8 드랍)

	/**
	 * 리스폰 타이머를 진행시킨다. 매 프레임 세션이 호출한다.
	 * 이번 프레임에 리스폰이 끝난 케이스들을 돌려주고 잠금을 푼다.
	 */
	public update(deltaSeconds: number): ColorSortRespawnResult[] {
		if (this._respawns.length === 0) {
			return [];
		}

		const finished: ColorSortRespawnResult[] = [];
		const pending: { caseIndex: number, remaining: number }[] = [];
		for (const respawn of this._respawns) {
			respawn.remaining -= deltaSeconds;
			if (respawn.remaining > 0) {
				pending.push(respawn);
			}
			else {
				this._board.unlockCase(respawn.caseIndex);
				finished.push({ caseIndex: respawn.caseIndex });
			}
		}
		this._respawns = pending;
		return finished;
	}

	/** 리스폰까지 남은 시간(초). 여러 건이면 가장 오래 남은 시간 */
	public getRespawnRemainingSeconds(): number {
		let longest = 0;
		for (const respawn of this._respawns) {
			longest = Math.max(longest, respawn.remaining);
		}
		return longest;
	}

	/** 대기 중인 리스폰을 전부 즉시 끝낸다 (라운드 전환 등) */
	public flushRespawn(): void {
		for (const respawn of this._respawns) {
			this._board.unlockCase(respawn.caseIndex);
		}
		this._respawns = [];
	}

	private beginRespawn(caseIndex: number): void {
		// 잠긴 케이스는 다시 집을 수 없으므로 같은 케이스가 중복 등록될 일은 없다
		this._respawns.push({ caseIndex: caseIndex, remaining: this._respawnSeconds });
		this._board.lockCase(caseIndex);
	}

	//#endregion
}
