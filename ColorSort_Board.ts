/**
 * Color Sort Board - 케이스 스택의 순수 상태 머신 (PUZ_03)
 *
 * 사양 §6 핵심 이동 규칙 / §10.2 유효성 검사 순서 / §10.3 데드락 감지 / §10.5 클리어 판정.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import {
	Battery,
	BatteryCase,
	CASE_CAPACITY,
	ColorSortLevel,
	ColorSortMove,
	EBatteryColor,
	ECaseState,
	EMoveRejection,
	MoveCheck,
	cloneCase,
	getMovableCount,
	getRemainingSpace,
	getTopBattery,
	isCaseComplete,
} from 'ColorSort_Definitions';

export class ColorSortBoard {
	private readonly _cases: BatteryCase[] = [];
	/** 드래그 중이거나 리스폰 대기 중이라 잠긴 케이스 - §8 드랍 */
	private readonly _lockedCaseIndexes = new Set<number>();

	public get cases(): readonly BatteryCase[] {
		return this._cases;
	}

	public get caseCount(): number {
		return this._cases.length;
	}

	constructor(cases: BatteryCase[] = []) {
		this._cases = cases.map(cloneCase);
		// 시작 시점에 노출된 미공개 건전지를 공개한다 - §7
		this.revealExposedBatteries();
	}

	public static fromLevel(level: ColorSortLevel): ColorSortBoard {
		return new ColorSortBoard(level.cases.map(cloneCase));
	}

	//#region Lookup

	public getCase(index: number): BatteryCase | undefined {
		if (index < 0 || index >= this._cases.length) {
			return undefined;
		}
		return this._cases[index];
	}

	/** 케이스 상태 4종 - §4 */
	public getCaseState(index: number): ECaseState {
		const batteryCase = this.getCase(index);
		if (batteryCase === undefined || batteryCase.isActive === false) {
			return ECaseState.DISABLED;
		}
		if (this._lockedCaseIndexes.has(index)) {
			return ECaseState.LOCKED;
		}
		if (isCaseComplete(batteryCase)) {
			return ECaseState.CLOSED_COMPLETE;
		}
		return ECaseState.OPEN;
	}

	/** 조작 가능한 상태인지 (열림) */
	public isCaseOperable(index: number): boolean {
		return this.getCaseState(index) === ECaseState.OPEN;
	}

	public getTop(index: number): Battery | undefined {
		const batteryCase = this.getCase(index);
		return batteryCase === undefined ? undefined : getTopBattery(batteryCase);
	}

	/** 이 케이스에서 함께 집히는 개수 - §8 그랩 "같은 색상이 연속될 때는 같이 잡힌다" */
	public getGrabCount(index: number): number {
		const batteryCase = this.getCase(index);
		if (batteryCase === undefined || this.isCaseOperable(index) === false) {
			return 0;
		}
		return getMovableCount(batteryCase);
	}

	//#endregion

	//#region Lock (§8 드랍 - 리스폰될 때까지 케이스는 잠금 상태)

	public lockCase(index: number): void {
		this._lockedCaseIndexes.add(index);
	}

	public unlockCase(index: number): void {
		this._lockedCaseIndexes.delete(index);
	}

	public isCaseLocked(index: number): boolean {
		return this._lockedCaseIndexes.has(index);
	}

	public unlockAll(): void {
		this._lockedCaseIndexes.clear();
	}

	//#endregion

	//#region Move validation (§10.2)

	/**
	 * 이동 유효성 검사 - §10.2 가 지정한 순서를 그대로 따른다.
	 *   (a) 출발 케이스가 비어있지 않은가
	 *   (b) 최상단 동일색 런의 길이 k(1~3) 산출
	 *   (c) 목적지가 비었거나 최상단 색이 동일한가
	 *   (d) 목적지 잔여 공간 >= k 인가
	 * 하나라도 실패하면 이동 불가 + 미리보기 비활성.
	 */
	public canMove(fromIndex: number, toIndex: number): MoveCheck {
		if (fromIndex === toIndex) {
			return { isValid: false, count: 0, rejection: EMoveRejection.SAME_CASE };
		}

		const source = this.getCase(fromIndex);
		const destination = this.getCase(toIndex);
		if (source === undefined || destination === undefined) {
			return { isValid: false, count: 0, rejection: EMoveRejection.SOURCE_NOT_OPEN };
		}

		// 닫힘 / 비활성 / 잠금 케이스는 손댈 수 없다 - §4, §8
		if (this.isCaseOperable(fromIndex) === false) {
			return { isValid: false, count: 0, rejection: EMoveRejection.SOURCE_NOT_OPEN };
		}
		if (this.isCaseOperable(toIndex) === false) {
			return { isValid: false, count: 0, rejection: EMoveRejection.DESTINATION_NOT_OPEN };
		}

		// (a)
		if (source.batteries.length === 0) {
			return { isValid: false, count: 0, rejection: EMoveRejection.SOURCE_EMPTY };
		}

		// (b)
		const count = getMovableCount(source);
		const top = getTopBattery(source);
		if (top === undefined || count <= 0) {
			return { isValid: false, count: 0, rejection: EMoveRejection.SOURCE_EMPTY };
		}

		// (c)
		const destinationTop = getTopBattery(destination);
		if (destinationTop !== undefined) {
			// §10.3 - 미공개 건전지는 색 비교가 불가능하므로 빈 케이스로만 이동할 수 있다
			if (top.isRevealed === false) {
				return { isValid: false, count: count, rejection: EMoveRejection.UNKNOWN_NEEDS_EMPTY };
			}
			if (destinationTop.isRevealed === false || destinationTop.color !== top.color) {
				return { isValid: false, count: count, rejection: EMoveRejection.COLOR_MISMATCH };
			}
		}

		// (d) - §6 "옮겨지는 수가 남은 공간을 넘으면 이동되지 않는다"
		if (getRemainingSpace(destination) < count) {
			return { isValid: false, count: count, rejection: EMoveRejection.NOT_ENOUGH_SPACE };
		}

		return { isValid: true, count: count, rejection: EMoveRejection.NONE };
	}

	/**
	 * 이동을 수행한다. 유효하지 않으면 undefined 를 돌려주고 보드를 바꾸지 않는다.
	 * 이동 후 노출된 미공개 건전지를 공개하고(§7), 완성된 케이스를 닫는다(§4).
	 */
	public move(fromIndex: number, toIndex: number): ColorSortMove | undefined {
		const check = this.canMove(fromIndex, toIndex);
		if (check.isValid === false) {
			return undefined;
		}

		// 이동 전에 이미 완성돼 있던 케이스를 기억해 둔다.
		// closedCaseIndexes 는 "이번 이동으로 새로 닫힌" 케이스만 담아야
		// 닫힘 연출/SFX 가 매 이동마다 반복 재생되지 않는다.
		const completedBefore = new Set<number>();
		for (const batteryCase of this._cases) {
			if (isCaseComplete(batteryCase)) {
				completedBefore.add(batteryCase.index);
			}
		}

		const source = this._cases[fromIndex];
		const destination = this._cases[toIndex];
		const moved = source.batteries.splice(source.batteries.length - check.count, check.count);
		for (const battery of moved) {
			destination.batteries.push(battery);
		}

		const revealedBatteryIds = this.revealExposedBatteries();
		const closedCaseIndexes: number[] = [];
		for (const batteryCase of this._cases) {
			if (isCaseComplete(batteryCase) && completedBefore.has(batteryCase.index) === false) {
				closedCaseIndexes.push(batteryCase.index);
			}
		}

		return {
			fromCaseIndex: fromIndex,
			toCaseIndex: toIndex,
			count: check.count,
			color: moved[0].color,
			revealedBatteryIds: revealedBatteryIds,
			closedCaseIndexes: closedCaseIndexes,
		};
	}

	//#endregion

	//#region Reveal (§7 블랙 건전지)

	/**
	 * 최상단에 노출된 미공개 건전지를 공개한다 - §7.
	 * 공개된 건전지 id 목록을 돌려준다.
	 */
	public revealExposedBatteries(): string[] {
		const revealed: string[] = [];
		for (const batteryCase of this._cases) {
			const top = getTopBattery(batteryCase);
			if (top !== undefined && top.isRevealed === false) {
				top.isRevealed = true;
				revealed.push(top.id);
			}
		}
		return revealed;
	}

	//#endregion

	//#region Deadlock & clear (§10.3 / §10.5)

	/** 지금 가능한 모든 이동 */
	public getValidMoves(): { fromCaseIndex: number, toCaseIndex: number, count: number }[] {
		const moves: { fromCaseIndex: number, toCaseIndex: number, count: number }[] = [];
		for (let from = 0; from < this._cases.length; from++) {
			for (let to = 0; to < this._cases.length; to++) {
				const check = this.canMove(from, to);
				if (check.isValid) {
					moves.push({ fromCaseIndex: from, toCaseIndex: to, count: check.count });
				}
			}
		}
		return moves;
	}

	/**
	 * 데드락 감지 - §2 / §10.3.
	 * 유효한 이동이 하나도 없으면 즉시 실패 처리한다.
	 * 이미 클리어된 상태는 데드락이 아니다.
	 */
	public isDeadlocked(): boolean {
		if (this.isSolved()) {
			return false;
		}
		return this.getValidMoves().length === 0;
	}

	/**
	 * 클리어 판정 - §2 / §4.
	 * "건전지가 들어 있는 모든 케이스가 같은 색으로 가득 차 닫혔는가"
	 *
	 * 같은 색이 두 케이스에 나뉘어 있어도 각각 가득 찼다면 클리어다.
	 * 기획 데이터(NPUZ_03)에는 한 색을 8개 쓰는 판이 13개 있어서,
	 * 색마다 케이스 하나씩이라고 가정하면 그 판들은 애초에 끝낼 수 없다.
	 */
	public isSolved(): boolean {
		let completeCount = 0;

		for (const batteryCase of this._cases) {
			if (batteryCase.isActive === false) {
				continue;
			}
			if (batteryCase.batteries.length === 0) {
				continue;
			}
			if (isCaseComplete(batteryCase) === false) {
				return false;
			}
			completeCount++;
		}

		return completeCount > 0;
	}

	//#endregion

	//#region Serialization

	public clone(): ColorSortBoard {
		return new ColorSortBoard(this._cases.map(cloneCase));
	}

	public toLevel(puzzleId: string, difficulty: number, colorCount: number): ColorSortLevel {
		return {
			puzzleId: puzzleId,
			difficulty: difficulty,
			cases: this._cases.map(cloneCase),
			colorCount: colorCount,
		};
	}

	/** 솔버/중복 상태 판정용 키. 케이스 순서는 의미가 없으므로 정렬해 정규화한다 */
	public getStateKey(): string {
		const parts: string[] = [];
		for (const batteryCase of this._cases) {
			if (batteryCase.isActive === false) {
				continue;
			}
			// 숨겨진 색까지 구분해야 솔버가 서로 다른 상태를 뭉뚱그리지 않는다.
			// 미공개 건전지는 색 뒤에 '*' 를 붙여 표시한다.
			const stack = batteryCase.batteries
				.map((battery) => (battery.isRevealed ? battery.color : `${battery.color}*`))
				.join(',');
			parts.push(stack);
		}
		parts.sort();
		return parts.join('|');
	}

	/** 디버그/2D 프로토타입용 덤프 (아래 -> 위) */
	public toDebugString(): string {
		const rows: string[] = [];
		for (const batteryCase of this._cases) {
			const state = this.getCaseState(batteryCase.index);
			const stack = batteryCase.batteries
				.map((battery) => (battery.isRevealed ? battery.color.charAt(0) : '?'))
				.join(' ');
			const padding = '. '.repeat(Math.max(0, batteryCase.capacity - batteryCase.batteries.length)).trim();
			rows.push(`[${batteryCase.index}] ${stack}${stack.length > 0 && padding.length > 0 ? ' ' : ''}${padding}  (${state})`);
		}
		return rows.join('\n');
	}

	//#endregion
}

/** 케이스 배열을 만드는 헬퍼 - 레벨 생성기와 테이블이 함께 쓴다 */
export function createCases(activeCount: number, totalCount: number, capacity: number = CASE_CAPACITY): BatteryCase[] {
	const cases: BatteryCase[] = [];
	for (let index = 0; index < totalCount; index++) {
		cases.push({
			id: `CASE_${index}`,
			index: index,
			capacity: capacity,
			batteries: [],
			isActive: index < activeCount,
		});
	}
	return cases;
}
