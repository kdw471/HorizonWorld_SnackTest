/**
 * Color Fill Dial - 다이얼 + 회전 바늘의 순수 상태 머신 (PUZ_04)
 *
 * 사양 §5 정화 규칙 / §6 다이얼 바늘 / §8.1~§8.4 구현.
 *
 * 핵심은 §6 의 이중 효과다.
 *   **터치 = 방향 반전이 항상 발생하고, 바늘이 오염 칸 위에 있을 때만 추가로 정화가 발생한다.**
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import {
	ColorFillLevel,
	DEGREES_PER_SLOT,
	DIAL_SLOT_COUNT,
	DIRECTION_CLOCKWISE,
	DialNeedle,
	DialSlot,
	ESlotState,
	ETouchOutcome,
	TouchResult,
	cloneSlot,
	countContaminated,
	createSlots,
	getContaminatedGroups,
	getContiguousContaminatedRun,
	getSlotIndexFromAngle,
	wrapAngle,
} from 'ColorFill_Definitions';

export type ColorFillDialOptions = {
	/**
	 * 방향 전환 딜레이 동안 입력을 잠글지 - §8.3
	 * "reverseDelay 동안은 방향 전환 연출/입력 잠금 처리 여부를 파라미터로 둔다."
	 */
	isInputLockedDuringReverse?: boolean,
}

const DEFAULT_INPUT_LOCK_DURING_REVERSE = true;

export class ColorFillDial {
	private readonly _slots: DialSlot[];
	private readonly _needle: DialNeedle;
	private readonly _reverseDelaySeconds: number;
	private readonly _isInputLockedDuringReverse: boolean;

	/** 방향 반전까지 남은 시간. 0 이하면 대기 중인 반전이 없다 */
	private _pendingReverseSeconds: number = 0;
	private _hasPendingReverse: boolean = false;

	public get slots(): readonly DialSlot[] {
		return this._slots;
	}

	public get needle(): DialNeedle {
		return this._needle;
	}

	public get reverseDelaySeconds(): number {
		return this._reverseDelaySeconds;
	}

	/** 방향 반전 대기 중인지 - 연출에서 쓴다 */
	public get hasPendingReverse(): boolean {
		return this._hasPendingReverse;
	}

	/** 지금 입력을 받을 수 있는지 */
	public get isInputAccepted(): boolean {
		if (this._isInputLockedDuringReverse === false) {
			return true;
		}
		return this._hasPendingReverse === false;
	}

	constructor(slots: DialSlot[], needleSpeedDegPerSec: number, reverseDelaySeconds: number, startAngleDeg: number = 0, options: ColorFillDialOptions = {}) {
		if (slots.length !== DIAL_SLOT_COUNT) {
			// 전부 비활성 슬롯으로 대체되면 isSolved() 가 영원히 false 가 되어
			// 시간초과 패배만 가능해진다. 조용히 넘어가지 말고 알린다.
			console.warn(`[ColorFillDial] Slot array length is ${slots.length}; expected ${DIAL_SLOT_COUNT}. Falling back to default slots.`);
		}
		this._slots = slots.length === DIAL_SLOT_COUNT ? slots.map(cloneSlot) : createSlots();
		this._reverseDelaySeconds = Math.max(0, reverseDelaySeconds);
		this._isInputLockedDuringReverse = options.isInputLockedDuringReverse ?? DEFAULT_INPUT_LOCK_DURING_REVERSE;
		this._needle = {
			angleDeg: wrapAngle(startAngleDeg),
			// §6 - 퍼즐 시작 시 시계방향으로 회전을 시작한다
			direction: DIRECTION_CLOCKWISE,
			speedDegPerSec: needleSpeedDegPerSec,
		};
	}

	public static fromLevel(level: ColorFillLevel, options: ColorFillDialOptions = {}): ColorFillDial {
		return new ColorFillDial(
			level.slots.map(cloneSlot),
			level.needleSpeedDegPerSec,
			level.reverseDelaySeconds,
			level.startAngleDeg,
			options);
	}

	//#region Query

	public getSlot(index: number): DialSlot | undefined {
		if (index < 0 || index >= this._slots.length) {
			return undefined;
		}
		return this._slots[index];
	}

	/** 바늘이 현재 가리키는 칸 - §8.2 */
	public getCurrentSlotIndex(): number {
		return getSlotIndexFromAngle(this._needle.angleDeg);
	}

	public getCurrentSlot(): DialSlot {
		return this._slots[this.getCurrentSlotIndex()];
	}

	public getContaminatedCount(): number {
		return countContaminated(this._slots);
	}

	/** 남아 있는 오염 덩어리들 */
	public getContaminatedGroups(): number[][] {
		return getContaminatedGroups(this._slots);
	}

	/**
	 * 클리어 판정 - §8.4 "모든 active 슬롯이 CLEAN 이면 즉시 클리어".
	 * 비활성 칸은 판정에서 제외한다.
	 */
	public isSolved(): boolean {
		let activeCount = 0;
		for (const slot of this._slots) {
			if (slot.isActive === false) {
				continue;
			}
			activeCount++;
			if (slot.state !== ESlotState.CLEAN) {
				return false;
			}
		}
		return activeCount > 0;
	}

	//#endregion

	//#region Update (§8.2)

	/**
	 * 매 프레임 바늘을 회전시키고 방향 전환 딜레이를 진행시킨다.
	 * `angle += dir * speed * dt` (mod 360)
	 */
	public update(deltaSeconds: number): void {
		if (deltaSeconds <= 0) {
			return;
		}

		this._needle.angleDeg = wrapAngle(
			this._needle.angleDeg + this._needle.direction * this._needle.speedDegPerSec * deltaSeconds);

		if (this._hasPendingReverse === false) {
			return;
		}

		this._pendingReverseSeconds -= deltaSeconds;
		if (this._pendingReverseSeconds <= 0) {
			this._hasPendingReverse = false;
			this._pendingReverseSeconds = 0;
			this._needle.direction = -this._needle.direction;
		}
	}

	//#endregion

	//#region Touch (§5 / §6 / §8.3)

	/**
	 * 터치 처리 - §8.3.
	 *
	 *   - 바늘이 오염 칸 위에 있으면 **연속된 오염 덩어리 전체**를 한 번에 정화한다 (§5).
	 *     원형 배열이므로 17 <-> 0 을 넘나드는 구간도 하나의 덩어리로 본다.
	 *   - 정화 여부와 무관하게 **항상 방향 반전을 예약**한다 (§6).
	 *   - 이미 정화된 칸이나 비활성 영역을 터치해도 패널티는 없다 (§5, §6).
	 *
	 * 방향 전환 딜레이 중 재터치:
	 *   입력 잠금이 켜져 있으면(기본) 무시한다.
	 *   꺼져 있으면 정화는 그대로 일어나고 반전 타이머만 다시 시작한다.
	 *   (반전은 타이머가 끝날 때 한 번만 일어난다 - 연타로 방향이 여러 번 뒤집히지 않는다)
	 */
	public touch(): TouchResult {
		const slotIndex = this.getCurrentSlotIndex();

		if (this.isInputAccepted === false) {
			return {
				outcome: ETouchOutcome.IGNORED,
				slotIndex: slotIndex,
				purifiedSlotIndexes: [],
				didScheduleReverse: false,
			};
		}

		const purified = this.purifyAt(slotIndex);
		this.scheduleReverse();

		return {
			outcome: purified.length > 0 ? ETouchOutcome.PURIFY_AND_REVERSE : ETouchOutcome.REVERSE_ONLY,
			slotIndex: slotIndex,
			purifiedSlotIndexes: purified,
			didScheduleReverse: true,
		};
	}

	/** 방향 반전을 예약한다. 딜레이가 0이면 즉시 반전된다 */
	public scheduleReverse(): void {
		if (this._reverseDelaySeconds <= 0) {
			this._needle.direction = -this._needle.direction;
			this._hasPendingReverse = false;
			this._pendingReverseSeconds = 0;
			return;
		}

		this._hasPendingReverse = true;
		this._pendingReverseSeconds = this._reverseDelaySeconds;
	}

	/** 해당 칸이 오염이면 연속 덩어리를 통째로 정화한다 - §5 */
	private purifyAt(slotIndex: number): number[] {
		const run = getContiguousContaminatedRun(this._slots, slotIndex);
		for (const index of run) {
			this._slots[index].state = ESlotState.CLEAN;
		}
		return run;
	}

	//#endregion

	//#region Serialization

	public clone(): ColorFillDial {
		const copy = new ColorFillDial(
			this._slots.map(cloneSlot),
			this._needle.speedDegPerSec,
			this._reverseDelaySeconds,
			this._needle.angleDeg,
			{ isInputLockedDuringReverse: this._isInputLockedDuringReverse });
		copy._needle.direction = this._needle.direction;
		copy._hasPendingReverse = this._hasPendingReverse;
		copy._pendingReverseSeconds = this._pendingReverseSeconds;
		return copy;
	}

	public toLevel(puzzleId: string, difficulty: number): ColorFillLevel {
		return {
			puzzleId: puzzleId,
			difficulty: difficulty,
			slots: this._slots.map(cloneSlot),
			needleSpeedDegPerSec: this._needle.speedDegPerSec,
			reverseDelaySeconds: this._reverseDelaySeconds,
			startAngleDeg: this._needle.angleDeg,
		};
	}

	/** 디버그용 한 줄 덤프. `#` 오염 / `.` 정화 / `_` 비활성, 대괄호가 바늘 위치 */
	public toDebugString(): string {
		const current = this.getCurrentSlotIndex();
		const cells: string[] = [];
		for (const slot of this._slots) {
			let symbol = '_';
			if (slot.isActive) {
				symbol = slot.state === ESlotState.CONTAMINATED ? '#' : '.';
			}
			cells.push(slot.index === current ? `[${symbol}]` : ` ${symbol} `);
		}
		const direction = this._needle.direction > 0 ? 'CW' : 'CCW';
		return `${cells.join('')}  angle=${this._needle.angleDeg.toFixed(1)} dir=${direction}${this._hasPendingReverse ? ' (reverse-pending)' : ''}`;
	}

	//#endregion
}

/** 각도가 칸 경계에 정확히 걸리지 않도록 칸 중심으로 맞춘 시작 각도 */
export function getSafeStartAngle(slotIndex: number): number {
	return wrapAngle(slotIndex * DEGREES_PER_SLOT + DEGREES_PER_SLOT * 0.5);
}
