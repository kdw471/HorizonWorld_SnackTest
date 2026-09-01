/**
 * Slide Puzzle Input Controller - 모바일 단일 터치 입력 (PUZ_07)
 *
 * 원본 §5 는 VR 양손 기준으로 "먼저 눌린 조각 하나만 이동되며 두 번째 인터랙션은 무시된다" 고 정한다.
 * 모바일에서도 멀티터치가 가능하므로 같은 규칙을 적용한다.
 *
 *   - **같은 프레임에 여러 조각이 눌리면 타임스탬프가 빠른 쪽만 채택**하고 나머지는 폐기한다 (§12.4).
 *   - 조각이 이동하는 0.25초 동안에는 모든 칸의 입력이 막힌다 (§6).
 *   - 완성 판정이 나면 즉시 모든 입력이 막힌다 (§5).
 *
 * 호버는 VR 개념이지만, 모바일에서도 "지금 누를 수 있는 조각"을 미리 표시하는 데 그대로 쓴다.
 * 인접한 빈 칸이 없는 조각에는 Emissive 를 켜지 않는다 (§5).
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { SlidePuzzleBoard } from 'SlidePuzzle_Board';
import {
	ESlideMoveOutcome,
	ESlideRejection,
	SlideMoveResult,
} from 'SlidePuzzle_Definitions';

/** 같은 프레임에 들어온 입력 하나 */
export type SlideTouchInput = {
	/** 조각의 보드 위치 */
	position: number,
	/** 입력 시각 (ms). 작을수록 먼저 눌린 것이다 */
	timestampMs: number,
}

export class SlidePuzzleInputController {
	private readonly _board: SlidePuzzleBoard;

	/** 이번 프레임에 모인 입력들 */
	private _pendingInputs: SlideTouchInput[] = [];

	constructor(board: SlidePuzzleBoard) {
		this._board = board;
	}

	//#region Hover (§5)

	/**
	 * 이 조각에 호버 Emissive(#FF5C41)를 켤 수 있는지 - §5.
	 * 인접한 빈 칸이 없거나 입력이 잠긴 상태면 켜지 않는다.
	 */
	public canHighlight(position: number): boolean {
		return this._board.canHover(position);
	}

	/** 지금 누를 수 있는 조각들 - UI 가 한 번에 표시할 때 쓴다 */
	public getHighlightablePositions(): number[] {
		return this._board.getMovablePositions();
	}

	//#endregion

	//#region Touch

	/**
	 * 터치를 접수한다. 즉시 처리하지 않고 이번 프레임의 후보로 모아 둔다.
	 * `flush()` 에서 가장 먼저 눌린 하나만 채택한다 (§5 / §12.4).
	 */
	public queueTouch(position: number, timestampMs: number): void {
		this._pendingInputs.push({ position: position, timestampMs: timestampMs });
	}

	/**
	 * 모인 입력 중 **타임스탬프가 가장 빠른 하나만** 처리하고 나머지는 폐기한다 - §12.4.
	 * 처리할 입력이 없으면 undefined 를 돌려준다.
	 */
	public flush(): SlideMoveResult | undefined {
		if (this._pendingInputs.length === 0) {
			return undefined;
		}

		const inputs = this._pendingInputs;
		this._pendingInputs = [];

		let earliest = inputs[0];
		for (const input of inputs) {
			if (input.timestampMs < earliest.timestampMs) {
				earliest = input;
			}
		}

		return this._board.press(earliest.position);
	}

	/**
	 * 터치를 즉시 하나만 처리한다 (단일 터치가 보장되는 경우의 간편 경로).
	 * 큐에 남아 있던 입력은 버린다.
	 */
	public touch(position: number): SlideMoveResult {
		this._pendingInputs = [];
		return this._board.press(position);
	}

	/** 모아 둔 입력을 버린다 (일시정지, 라운드 전환 등) */
	public clearPending(): void {
		this._pendingInputs = [];
	}

	/** 이번 프레임에 모인 입력 수 - 디버그/테스트용 */
	public get pendingCount(): number {
		return this._pendingInputs.length;
	}

	//#endregion

	/** 지금 입력을 받을 수 있는지 */
	public get isInputAccepted(): boolean {
		return this._board.isInputAccepted;
	}

	/** 거절 사유만 미리 확인한다 (UI 피드백용) */
	public peekRejection(position: number): ESlideRejection {
		if (this._board.isInputAccepted === false) {
			return ESlideRejection.MOVE_IN_PROGRESS;
		}
		if (this._board.canHover(position)) {
			return ESlideRejection.NONE;
		}
		return ESlideRejection.NOT_ADJACENT_TO_BLANK;
	}

	/** 마지막 결과가 실제 이동이었는지 판별하는 편의 함수 */
	public static didMove(result: SlideMoveResult | undefined): boolean {
		return result !== undefined && result.outcome === ESlideMoveOutcome.MOVING;
	}
}
