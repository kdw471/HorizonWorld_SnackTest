/**
 * Switch Board - 5×5 키 판의 순수 상태 머신 (PUZ_08)
 *
 * 사양 §5 키 캡 / §6 스위치 영역 / §7 조작 연출 / §9 구현 요구사항.
 *
 * 누름 연출 상태 (§7)
 *   IDLE -> SEQUENCE(0.4초, 전체 입력 잠금) -> IDLE,  완성 시 LOCKED_CLEARED
 *   0.0초 중앙 누름 → 0.2초 영역 연출 → 0.4초 종료.
 *   토글 자체(논리 상태)는 누르는 즉시 반영하고, 타이머는 연출 잠금에만 쓴다.
 *   클리어 판정은 연출이 끝나는 시점(0.4초)에 한다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import {
	ESwitchCellState,
	ESwitchInputState,
	ESwitchPressOutcome,
	ESwitchRejection,
	PRESS_AREA_DELAY_SECONDS,
	PRESS_SEQUENCE_SECONDS,
	RandomSource,
	SWITCH_CELL_COUNT,
	SwitchLevel,
	SwitchPressResult,
	countUnpressed,
	getMaskViolations,
	getToggledPositions,
	getUsablePositions,
	isGridSolved,
	shuffleInPlace,
	toCoordLabel,
} from 'Switch_Definitions';

/** update() 진행 결과. 연출 단계 도달 여부를 세션이 이벤트로 옮긴다 */
export type SwitchBoardProgress = {
	/** 0.2초 - 영역 연출을 시작할 시점에 도달했다 (§7) */
	didReachAreaPhase: boolean,
	/** 0.4초 - 모든 연출이 끝났다 (§7) */
	didFinishSequence: boolean,
	/** 연출 종료 시점의 클리어 판정 - §9.3 */
	didClear: boolean,
}

export class SwitchBoard {
	private _grid: ESwitchCellState[];
	private readonly _mask: number[];
	private readonly _sequenceSeconds: number;
	private readonly _areaDelaySeconds: number;

	private _inputState: ESwitchInputState = ESwitchInputState.IDLE;
	/** 연출 시작 후 경과 시간 */
	private _sequenceElapsed: number = 0;
	/** 0.2초 영역 연출 신호를 아직 안 보냈는지 */
	private _isAreaPhasePending: boolean = false;

	/** 마지막 누름 정보 - 연출 계층이 참조한다 */
	private _lastPressPosition: number = -1;
	private _lastToggledPositions: number[] = [];

	public get grid(): readonly ESwitchCellState[] {
		return this._grid;
	}

	public get mask(): readonly number[] {
		return this._mask;
	}

	public get inputState(): ESwitchInputState {
		return this._inputState;
	}

	/** 지금 입력을 받을 수 있는지 - §7 */
	public get isInputAccepted(): boolean {
		return this._inputState === ESwitchInputState.IDLE;
	}

	public get lastPressPosition(): number {
		return this._lastPressPosition;
	}

	public get lastToggledPositions(): readonly number[] {
		return this._lastToggledPositions;
	}

	public get sequenceSeconds(): number {
		return this._sequenceSeconds;
	}

	constructor(grid: ESwitchCellState[], mask: number[], sequenceSeconds: number = PRESS_SEQUENCE_SECONDS, areaDelaySeconds: number = PRESS_AREA_DELAY_SECONDS) {
		this._grid = grid.slice();
		this._mask = mask.slice();
		this._sequenceSeconds = Math.max(0, sequenceSeconds);
		this._areaDelaySeconds = Math.max(0, Math.min(areaDelaySeconds, this._sequenceSeconds));

		const maskViolations = getMaskViolations(this._mask);
		if (maskViolations.length > 0) {
			console.warn(`[SwitchBoard] Mask error: ${maskViolations.join(' / ')}`);
		}

		if (isGridSolved(this._grid)) {
			this._inputState = ESwitchInputState.LOCKED_CLEARED;
		}
	}

	public static fromLevel(level: SwitchLevel, sequenceSeconds: number = PRESS_SEQUENCE_SECONDS, areaDelaySeconds: number = PRESS_AREA_DELAY_SECONDS): SwitchBoard {
		return new SwitchBoard(level.grid, level.mask, sequenceSeconds, areaDelaySeconds);
	}

	//#region Query

	public getCellAt(position: number): ESwitchCellState | undefined {
		if (position < 0 || position >= this._grid.length) {
			return undefined;
		}
		return this._grid[position];
	}

	/** 지금 누를 수 있는 칸들 - FREE 가 아닌 모든 칸. 연출/완성 중에는 빈 목록 */
	public getPressablePositions(): number[] {
		if (this.isInputAccepted === false) {
			return [];
		}
		return getUsablePositions(this._grid);
	}

	/** 이 칸을 하이라이트할 수 있는지 - PUZ_00 §8.2 상시 표시 */
	public canHighlight(position: number): boolean {
		if (this.isInputAccepted === false) {
			return false;
		}
		if (position < 0 || position >= this._grid.length) {
			return false;
		}
		return this._grid[position] !== ESwitchCellState.FREE;
	}

	public isSolved(): boolean {
		return isGridSolved(this._grid);
	}

	public getUnpressedCount(): number {
		return countUnpressed(this._grid);
	}

	//#endregion

	//#region Press (§6 / §7 / §9.2)

	/**
	 * 키 캡을 눌러 스위치 영역을 반전시킨다.
	 * 연출(0.4초) 동안 모든 입력이 막히고, 완성 후에는 영구히 막힌다.
	 */
	public press(position: number): SwitchPressResult {
		const rejected = (rejection: ESwitchRejection): SwitchPressResult => ({
			outcome: ESwitchPressOutcome.REJECTED,
			rejection: rejection,
			position: position,
			toggledPositions: [],
		});

		if (this._inputState === ESwitchInputState.LOCKED_CLEARED) {
			return rejected(ESwitchRejection.ALREADY_CLEARED);
		}
		if (this._inputState === ESwitchInputState.SEQUENCE) {
			// §7 - 연출이 재생되는 동안 추가 입력은 무시한다
			return rejected(ESwitchRejection.SEQUENCE_IN_PROGRESS);
		}
		if (position < 0 || position >= this._grid.length) {
			return rejected(ESwitchRejection.INVALID_POSITION);
		}
		if (this._grid[position] === ESwitchCellState.FREE) {
			// §4 / §9.2 - FREE 좌표에는 키 캡이 없다
			return rejected(ESwitchRejection.FREE_CELL);
		}

		const toggled = this.applyToggle(position);

		this._inputState = ESwitchInputState.SEQUENCE;
		this._sequenceElapsed = 0;
		this._isAreaPhasePending = true;
		this._lastPressPosition = position;
		this._lastToggledPositions = toggled.slice();

		if (this._sequenceSeconds <= 0) {
			this.finishSequence();
		}

		return {
			outcome: ESwitchPressOutcome.PRESSED,
			rejection: ESwitchRejection.NONE,
			position: position,
			toggledPositions: toggled,
		};
	}

	/**
	 * 연출 타이머를 진행시킨다.
	 * 0.2초에 영역 연출 신호, 0.4초에 종료 + 클리어 판정 (§7 / §9.3).
	 */
	public update(deltaSeconds: number): SwitchBoardProgress {
		if (this._inputState !== ESwitchInputState.SEQUENCE) {
			return { didReachAreaPhase: false, didFinishSequence: false, didClear: false };
		}

		this._sequenceElapsed += deltaSeconds;

		let didReachAreaPhase = false;
		if (this._isAreaPhasePending && this._sequenceElapsed >= this._areaDelaySeconds) {
			this._isAreaPhasePending = false;
			didReachAreaPhase = true;
		}

		if (this._sequenceElapsed < this._sequenceSeconds) {
			return { didReachAreaPhase: didReachAreaPhase, didFinishSequence: false, didClear: false };
		}

		const didClear = this.finishSequence();
		return { didReachAreaPhase: didReachAreaPhase, didFinishSequence: true, didClear: didClear };
	}

	/** 연출을 즉시 끝낸다 */
	public flushSequence(): boolean {
		if (this._inputState !== ESwitchInputState.SEQUENCE) {
			return false;
		}
		return this.finishSequence();
	}

	private finishSequence(): boolean {
		this._sequenceElapsed = 0;
		this._isAreaPhasePending = false;

		if (this.isSolved()) {
			this._inputState = ESwitchInputState.LOCKED_CLEARED;
			return true;
		}
		this._inputState = ESwitchInputState.IDLE;
		return false;
	}

	/** 마스크에 따라 스위치 영역을 XOR 반전한다 - §6 / §9.2 */
	private applyToggle(position: number): number[] {
		const toggled = getToggledPositions(this._grid, this._mask, position);
		for (const target of toggled) {
			this._grid[target] = this._grid[target] === ESwitchCellState.PRESSED
				? ESwitchCellState.UNPRESSED
				: ESwitchCellState.PRESSED;
		}
		return toggled;
	}

	//#endregion

	//#region Shuffle (§9.4)

	/**
	 * 목표 상태(모두 눌림)에서 역방향으로 흐트러뜨린다 - §9.4.
	 *
	 * 토글은 자기역원(involution)이고 누름 순서는 결과에 영향이 없으므로,
	 * **서로 다른 칸 K개**를 골라 한 번씩 누른다. 같은 칸을 두 번 누르면 서로
	 * 상쇄되어 실질 난이도가 K 아래로 내려가기 때문이다.
	 * 이렇게 만든 배치는 같은 칸들을 다시 누르면 풀리므로 **항상 K수 이내로 풀 수 있다.**
	 *
	 * 무작위 0/1 배열은 마스크·판 형태에 따라 해가 없을 수 있으므로 금지 (§9.4).
	 *
	 * 실제로 누른 위치들을 돌려준다. 사용 칸이 K보다 적으면 사용 칸 수만큼만 누른다.
	 */
	public shuffleFromSolved(random: RandomSource, pressCount: number): number[] {
		for (let index = 0; index < SWITCH_CELL_COUNT; index++) {
			if (this._grid[index] !== ESwitchCellState.FREE) {
				this._grid[index] = ESwitchCellState.PRESSED;
			}
		}
		this._inputState = ESwitchInputState.IDLE;
		this._sequenceElapsed = 0;
		this._isAreaPhasePending = false;

		const usable = getUsablePositions(this._grid);
		shuffleInPlace(random, usable);

		const presses = usable.slice(0, Math.min(pressCount, usable.length));
		for (const position of presses) {
			this.applyToggle(position);
		}

		this._inputState = this.isSolved() ? ESwitchInputState.LOCKED_CLEARED : ESwitchInputState.IDLE;
		return presses;
	}

	//#endregion

	//#region Serialization

	public clone(): SwitchBoard {
		const copy = new SwitchBoard(this._grid, this._mask, this._sequenceSeconds, this._areaDelaySeconds);
		copy._inputState = this._inputState;
		copy._sequenceElapsed = this._sequenceElapsed;
		copy._isAreaPhasePending = this._isAreaPhasePending;
		copy._lastPressPosition = this._lastPressPosition;
		copy._lastToggledPositions = this._lastToggledPositions.slice();
		return copy;
	}

	public toLevel(puzzleId: string, difficulty: number, switchAreaId: string, shuffleCount: number, shuffledPresses: number[]): SwitchLevel {
		return {
			puzzleId: puzzleId,
			difficulty: difficulty,
			grid: this._grid.slice(),
			mask: this._mask.slice(),
			switchAreaId: switchAreaId,
			shuffleCount: shuffleCount,
			shuffledPresses: shuffledPresses.slice(),
		};
	}

	/** 디버그용 격자 덤프. 눌림 = G, 안 눌림 = r, FREE = 점 */
	public toDebugString(): string {
		const rows: string[] = [];
		for (let row = 0; row < 5; row++) {
			const cells: string[] = [];
			for (let col = 0; col < 5; col++) {
				const cell = this._grid[row * 5 + col];
				cells.push(cell === ESwitchCellState.FREE ? '.' : (cell === ESwitchCellState.PRESSED ? 'G' : 'r'));
			}
			rows.push(cells.join(' '));
		}
		return rows.join('\n');
	}

	/** 마지막 누름의 좌표 라벨 (예: 'C3') - 디버그/로그용 */
	public getLastPressLabel(): string {
		return this._lastPressPosition >= 0 ? toCoordLabel(this._lastPressPosition) : '';
	}

	//#endregion
}
