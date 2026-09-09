/**
 * Switch Input Controller - 모바일 단일 터치 입력 (PUZ_08)
 *
 * 원본 §7 은 VR 기준으로 다음을 정한다. 모바일 대체는 이렇다.
 *
 *   - "먼저 들어간 손만 인식" → **터치 하나가 진행 중이면 추가 터치 다운은 완전히 무시**한다
 *     (PUZ_00 §8.1 단일 터치 전용).
 *   - "완전히 눌렸을 때만 토글 / 부분 누름은 미반응" → 모바일에는 누름 깊이가 없으므로
 *     **눌렀던 키 캡 위에서 손을 떼는 순간에만 눌림을 확정**한다.
 *     손가락을 키 캡 밖으로 끌고 나가서 떼면 취소된다 (부분 누름의 모바일 대체).
 *   - 같은 프레임에 여러 다운이 들어오면 **타임스탬프가 빠른 하나만** 채택한다 (PUZ_00 §8.1).
 *
 * 히트박스는 칸(6cm)보다 넉넉한 조작 콜리전(7cm)을 쓴다 - §3 / PUZ_00 §8.2.
 * 화면 좌표 → 칸 변환은 어댑터(Horizon 계층)가 하고, 여기는 칸 번호만 받는다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { SwitchBoard } from 'Switch_Board';
import {
	ESwitchPressOutcome,
	ESwitchRejection,
	SwitchPressResult,
} from 'Switch_Definitions';

/** 같은 프레임에 들어온 터치 다운 하나 */
export type SwitchTouchInput = {
	/** 키 캡의 칸 위치 */
	position: number,
	/** 입력 시각 (ms). 작을수록 먼저 눌린 것이다 */
	timestampMs: number,
}

export class SwitchInputController {
	private readonly _board: SwitchBoard;

	/** 지금 손가락이 내려가 있는 칸. undefined 면 진행 중인 터치가 없다 */
	private _activeDownPosition: number | undefined = undefined;
	/** 드래그로 이동한 현재 위치 (뗄 때 다운 위치와 비교한다) */
	private _currentPosition: number | undefined = undefined;

	/** 이번 프레임에 모인 터치 다운들 */
	private _pendingInputs: SwitchTouchInput[] = [];

	constructor(board: SwitchBoard) {
		this._board = board;
	}

	//#region Highlight (PUZ_00 §8.2)

	/** 이 키 캡을 하이라이트할 수 있는지. FREE 칸/연출 중/완성 후에는 켜지 않는다 */
	public canHighlight(position: number): boolean {
		return this._board.canHighlight(position);
	}

	/** 지금 누를 수 있는 키 캡들 - UI 가 한 번에 표시할 때 쓴다 */
	public getHighlightablePositions(): number[] {
		return this._board.getPressablePositions();
	}

	//#endregion

	//#region Touch down / up (§7 부분 누름의 모바일 대체)

	/**
	 * 터치 다운. 이미 다른 터치가 진행 중이면 무시한다 - §7 "먼저 들어간 손만 인식".
	 * 접수 여부를 돌려준다.
	 */
	public touchDown(position: number): boolean {
		if (this._activeDownPosition !== undefined) {
			return false;
		}
		if (this._board.isInputAccepted === false) {
			// M3 - 연출(0.4초)·완성 후에는 다운 자체를 받지 않는다.
			// 다운을 허용하면 연출이 끝난 뒤 손을 떼는 순간 눌림이 확정되어
			// 사실상 잠금 중 입력을 1개 버퍼링하는 셈이 된다.
			return false;
		}
		this._activeDownPosition = position;
		this._currentPosition = position;
		return true;
	}

	/** 터치 유지 중 이동. 진행 중인 터치가 없으면 무시한다 */
	public touchMove(position: number): void {
		if (this._activeDownPosition === undefined) {
			return;
		}
		this._currentPosition = position;
	}

	/**
	 * 터치 업. **다운했던 키 캡 위에서 뗀 경우에만** 눌림을 확정한다.
	 * 밖에서 떼면 RELEASED_OUTSIDE 로 취소된다 - §7 부분 누름 미반응의 모바일 대체.
	 */
	public touchUp(): SwitchPressResult {
		const down = this._activeDownPosition;
		const current = this._currentPosition;
		this._activeDownPosition = undefined;
		this._currentPosition = undefined;

		if (down === undefined) {
			return {
				outcome: ESwitchPressOutcome.REJECTED,
				rejection: ESwitchRejection.NO_ACTIVE_TOUCH,
				position: -1,
				toggledPositions: [],
			};
		}
		if (current !== down) {
			return {
				outcome: ESwitchPressOutcome.REJECTED,
				rejection: ESwitchRejection.RELEASED_OUTSIDE,
				position: down,
				toggledPositions: [],
			};
		}
		return this._board.press(down);
	}

	/** 진행 중인 터치를 취소한다 (시스템 인터럽트, 일시정지 등) */
	public cancelActiveTouch(): void {
		this._activeDownPosition = undefined;
		this._currentPosition = undefined;
	}

	/** 진행 중인 터치가 있는지 */
	public get hasActiveTouch(): boolean {
		return this._activeDownPosition !== undefined;
	}

	//#endregion

	//#region Same-frame queue (PUZ_00 §8.1)

	/**
	 * 터치를 접수한다. 즉시 처리하지 않고 이번 프레임의 후보로 모아 둔다.
	 * `flush()` 에서 가장 먼저 눌린 하나만 채택한다.
	 */
	public queueTouch(position: number, timestampMs: number): void {
		this._pendingInputs.push({ position: position, timestampMs: timestampMs });
	}

	/**
	 * 모인 입력 중 **타임스탬프가 가장 빠른 하나만** 탭(다운+업)으로 처리하고
	 * 나머지는 폐기한다. 처리할 입력이 없으면 undefined 를 돌려준다.
	 */
	public flush(): SwitchPressResult | undefined {
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

		return this.touch(earliest.position);
	}

	/**
	 * 터치를 즉시 하나만 처리한다 (단일 터치가 보장되는 경우의 간편 경로).
	 * 진행 중이던 터치와 큐를 버린다.
	 */
	public touch(position: number): SwitchPressResult {
		this._pendingInputs = [];
		this._activeDownPosition = undefined;
		this._currentPosition = undefined;
		return this._board.press(position);
	}

	/** 모아 둔 입력과 진행 중 터치를 모두 버린다 (일시정지, 라운드 전환 등) */
	public clearPending(): void {
		this._pendingInputs = [];
		this.cancelActiveTouch();
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
	public peekRejection(position: number): ESwitchRejection {
		if (this._board.isInputAccepted === false) {
			return ESwitchRejection.SEQUENCE_IN_PROGRESS;
		}
		if (this._board.canHighlight(position)) {
			return ESwitchRejection.NONE;
		}
		return ESwitchRejection.FREE_CELL;
	}

	/** 마지막 결과가 실제 눌림이었는지 판별하는 편의 함수 */
	public static didPress(result: SwitchPressResult | undefined): boolean {
		return result !== undefined && result.outcome === ESwitchPressOutcome.PRESSED;
	}
}
