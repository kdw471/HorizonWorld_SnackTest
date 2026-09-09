/**
 * Color Fill Input Controller - 모바일 단일 터치 입력 (PUZ_04)
 *
 * 이 퍼즐은 배치가 아니라 타이밍 퍼즐이라 드래그가 없다. 조작은 **탭 하나**뿐이다.
 *   터치 = 방향 반전이 항상 발생하고, 바늘이 오염 칸 위에 있을 때만 추가로 정화가 발생한다 (§6).
 *
 * 모바일에서 추가로 지키는 것
 *   - **단일 터치 전용.** 같은 프레임에 여러 손가락이 닿아도 한 번만 처리한다.
 *   - **연타 방지.** 최소 간격보다 빨리 들어온 입력은 무시한다.
 *     방향 전환 딜레이 동안의 입력 잠금(§8.3)과는 별개의 안전장치다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { ColorFillDial } from 'ColorFill_Dial';
import { ETouchOutcome, TouchResult } from 'ColorFill_Definitions';

export type ColorFillInputOptions = {
	/**
	 * 연속 입력 사이의 최소 간격(초).
	 * 같은 프레임의 멀티터치와 의미 없는 연타를 걸러낸다.
	 */
	minTouchIntervalSeconds?: number,
}

const DEFAULT_MIN_TOUCH_INTERVAL_SECONDS = 0.05;

export class ColorFillInputController {
	private readonly _dial: ColorFillDial;
	private readonly _minTouchInterval: number;

	/** 마지막으로 입력을 받아들인 뒤 흐른 시간 */
	private _sinceLastTouch: number = Number.MAX_VALUE;

	public get canAcceptTouch(): boolean {
		return this._dial.isInputAccepted && this._sinceLastTouch >= this._minTouchInterval;
	}

	constructor(dial: ColorFillDial, options: ColorFillInputOptions = {}) {
		this._dial = dial;
		this._minTouchInterval = options.minTouchIntervalSeconds ?? DEFAULT_MIN_TOUCH_INTERVAL_SECONDS;
	}

	/** 매 프레임 호출 - 연타 방지 타이머를 진행시킨다 */
	public update(deltaSeconds: number): void {
		if (this._sinceLastTouch < Number.MAX_VALUE) {
			this._sinceLastTouch += deltaSeconds;
		}
	}

	/**
	 * 터치 한 번을 처리한다.
	 * 같은 프레임에 여러 번 불려도 최소 간격에 걸려 한 번만 통과한다 (단일 터치 전용).
	 */
	public touch(): TouchResult {
		if (this.canAcceptTouch === false) {
			return {
				outcome: ETouchOutcome.IGNORED,
				slotIndex: this._dial.getCurrentSlotIndex(),
				purifiedSlotIndexes: [],
				didScheduleReverse: false,
			};
		}

		const result = this._dial.touch();
		if (result.outcome !== ETouchOutcome.IGNORED) {
			this._sinceLastTouch = 0;
		}
		return result;
	}

	/** 라운드 전환 등으로 입력 상태를 초기화한다 */
	public reset(): void {
		this._sinceLastTouch = Number.MAX_VALUE;
	}
}
