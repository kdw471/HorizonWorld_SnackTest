/**
 * Slide Puzzle Board - 조각 배치와 이동 잠금의 순수 상태 머신 (PUZ_07)
 *
 * 사양 §5 인터랙션 / §6 이동 연출 / §8 섞는 로직 / §12 구현 요구사항.
 *
 * 입력 잠금 상태 (§12.3)
 *   IDLE -> MOVING(0.25초, 전체 입력 잠금) -> IDLE,  완성 시 LOCKED_CLEARED
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import {
	ESlideInputState,
	ESlideMoveOutcome,
	ESlideRejection,
	PIECE_MOVE_SECONDS,
	RandomSource,
	SlideMoveResult,
	SlidePuzzleLevel,
	areAdjacent,
	countMisplaced,
	createSolvedBoard,
	findBlankPosition,
	getBlankTileIndex,
	getMovablePositions,
	isBoardSolved,
	randomInt,
} from 'SlidePuzzle_Definitions';

export class SlidePuzzleBoard {
	private readonly _divideNum: number;
	private _board: number[];
	private readonly _moveSeconds: number;

	private _inputState: ESlideInputState = ESlideInputState.IDLE;
	/** 이동 연출이 끝나기까지 남은 시간 */
	private _moveRemaining: number = 0;
	/** 이동 연출 중인 조각 정보 - 연출 계층이 참조한다 */
	private _movingFrom: number = -1;
	private _movingTo: number = -1;

	public get divideNum(): number {
		return this._divideNum;
	}

	public get board(): readonly number[] {
		return this._board;
	}

	public get inputState(): ESlideInputState {
		return this._inputState;
	}

	/** 지금 입력을 받을 수 있는지 - §5 / §6 */
	public get isInputAccepted(): boolean {
		return this._inputState === ESlideInputState.IDLE;
	}

	public get movingFrom(): number {
		return this._movingFrom;
	}

	public get movingTo(): number {
		return this._movingTo;
	}

	public get moveSeconds(): number {
		return this._moveSeconds;
	}

	constructor(divideNum: number, board?: number[], moveSeconds: number = PIECE_MOVE_SECONDS) {
		this._divideNum = divideNum;
		this._board = board !== undefined ? board.slice() : createSolvedBoard(divideNum);
		this._moveSeconds = Math.max(0, moveSeconds);
		if (isBoardSolved(this._board)) {
			this._inputState = ESlideInputState.LOCKED_CLEARED;
		}
	}

	public static fromLevel(level: SlidePuzzleLevel, moveSeconds: number = PIECE_MOVE_SECONDS): SlidePuzzleBoard {
		return new SlidePuzzleBoard(level.divideNum, level.board.slice(), moveSeconds);
	}

	//#region Query

	public getTileAt(position: number): number | undefined {
		if (position < 0 || position >= this._board.length) {
			return undefined;
		}
		return this._board[position];
	}

	public getBlankPosition(): number {
		return findBlankPosition(this._board, this._divideNum);
	}

	/** 지금 움직일 수 있는 조각들의 위치 - §5 "사방에 비어있는 칸이 존재하는 경우에만" */
	public getMovablePositions(): number[] {
		if (this.isInputAccepted === false) {
			return [];
		}
		return getMovablePositions(this._board, this._divideNum);
	}

	/**
	 * 이 조각에 호버 Emissive 를 켤 수 있는지 - §5.
	 * 인접한 빈 칸이 없으면 켜지 않는다.
	 */
	public canHover(position: number): boolean {
		if (this.isInputAccepted === false) {
			return false;
		}
		return this.getMovablePositions().indexOf(position) >= 0;
	}

	public isSolved(): boolean {
		return isBoardSolved(this._board);
	}

	public getMisplacedCount(): number {
		return countMisplaced(this._board, this._divideNum);
	}

	//#endregion

	//#region Move (§5 / §6 / §12.3)

	/**
	 * 조각을 눌러 빈 칸으로 미끄러뜨린다.
	 * 이동 중에는 모든 칸의 입력이 막히고, 완성 후에는 영구히 막힌다.
	 */
	public press(position: number): SlideMoveResult {
		const rejected = (rejection: ESlideRejection): SlideMoveResult => ({
			outcome: ESlideMoveOutcome.REJECTED,
			rejection: rejection,
			fromPosition: position,
			toPosition: -1,
			tileIndex: -1,
		});

		if (this._inputState === ESlideInputState.LOCKED_CLEARED) {
			// §5 - 퍼즐이 완성 판정되면 즉시 모든 인터랙션이 불가능해진다
			return rejected(ESlideRejection.ALREADY_CLEARED);
		}
		if (this._inputState === ESlideInputState.MOVING) {
			// §6 - 조각이 이동하는 동안에는 모든 칸의 인터랙션이 불가하다
			return rejected(ESlideRejection.MOVE_IN_PROGRESS);
		}
		if (position < 0 || position >= this._board.length) {
			return rejected(ESlideRejection.INVALID_POSITION);
		}

		const blank = this.getBlankPosition();
		if (position === blank) {
			return rejected(ESlideRejection.IS_BLANK);
		}
		if (areAdjacent(position, blank, this._divideNum) === false) {
			return rejected(ESlideRejection.NOT_ADJACENT_TO_BLANK);
		}

		const tileIndex = this._board[position];
		this._board[blank] = tileIndex;
		this._board[position] = getBlankTileIndex(this._divideNum);

		this._inputState = ESlideInputState.MOVING;
		this._moveRemaining = this._moveSeconds;
		this._movingFrom = position;
		this._movingTo = blank;

		if (this._moveSeconds <= 0) {
			this.finishMove();
		}

		return {
			outcome: ESlideMoveOutcome.MOVING,
			rejection: ESlideRejection.NONE,
			fromPosition: position,
			toPosition: blank,
			tileIndex: tileIndex,
		};
	}

	/**
	 * 이동 연출 타이머를 진행시킨다.
	 * 연출이 끝나면 완성 여부를 판정한다 - §12.6 "매 이동 완료 시점에 검사".
	 */
	public update(deltaSeconds: number): { didFinishMove: boolean, didClear: boolean } {
		if (this._inputState !== ESlideInputState.MOVING) {
			return { didFinishMove: false, didClear: false };
		}

		this._moveRemaining -= deltaSeconds;
		if (this._moveRemaining > 0) {
			return { didFinishMove: false, didClear: false };
		}

		const didClear = this.finishMove();
		return { didFinishMove: true, didClear: didClear };
	}

	/** 이동 연출을 즉시 끝낸다 */
	public flushMove(): boolean {
		if (this._inputState !== ESlideInputState.MOVING) {
			return false;
		}
		return this.finishMove();
	}

	private finishMove(): boolean {
		this._moveRemaining = 0;
		this._movingFrom = -1;
		this._movingTo = -1;

		if (this.isSolved()) {
			this._inputState = ESlideInputState.LOCKED_CLEARED;
			return true;
		}
		this._inputState = ESlideInputState.IDLE;
		return false;
	}

	//#endregion

	//#region Shuffle (§8 / §12.2)

	/**
	 * 완성 상태에서 역순으로 섞는다 - §8.
	 *
	 * **직전 이동을 그대로 되돌리는 수는 배제한다.** 그래야 제자리걸음 없이 잘 섞인다.
	 * 이 방식은 합법 이동만 사용하므로 **항상 풀 수 있는 배치**를 보장한다.
	 * 무작위 순열 셔플은 절반이 풀 수 없는 배치가 되므로 절대 쓰면 안 된다 (§8).
	 *
	 * 실제로 몇 번 움직였는지 돌려준다.
	 */
	public shuffle(random: RandomSource, shuffleNum: number): number {
		this._board = createSolvedBoard(this._divideNum);
		this._inputState = ESlideInputState.IDLE;

		// 직전 이동에서 조각이 들어간 자리. 그 자리를 다시 고르면 되돌리는 수가 된다.
		let previousPosition = -1;
		let moved = 0;

		for (let step = 0; step < shuffleNum; step++) {
			const blank = this.getBlankPosition();
			const all = getMovablePositions(this._board, this._divideNum);
			const candidates = all.filter((position) => position !== previousPosition);

			// 되돌리기를 빼고 나면 후보가 없을 수 있다. 그때만 제약을 푼다.
			const pool = candidates.length > 0 ? candidates : all;
			if (pool.length === 0) {
				break;
			}

			const pick = pool[randomInt(random, 0, pool.length - 1)];
			this._board[blank] = this._board[pick];
			this._board[pick] = getBlankTileIndex(this._divideNum);

			// 조각이 방금 이동해 들어간 자리 = 이전 빈 칸. 다음에 그 자리를 고르면 되돌리는 수다.
			previousPosition = blank;
			moved++;
		}

		this._inputState = this.isSolved() ? ESlideInputState.LOCKED_CLEARED : ESlideInputState.IDLE;
		return moved;
	}

	//#endregion

	//#region Serialization

	public clone(): SlidePuzzleBoard {
		const copy = new SlidePuzzleBoard(this._divideNum, this._board.slice(), this._moveSeconds);
		copy._inputState = this._inputState;
		copy._moveRemaining = this._moveRemaining;
		copy._movingFrom = this._movingFrom;
		copy._movingTo = this._movingTo;
		return copy;
	}

	public toLevel(puzzleId: string, difficulty: number, shuffleNum: number, imagePath: string): SlidePuzzleLevel {
		return {
			puzzleId: puzzleId,
			difficulty: difficulty,
			divideNum: this._divideNum,
			board: this._board.slice(),
			shuffleNum: shuffleNum,
			imagePath: imagePath,
		};
	}

	/** 디버그용 격자 덤프. 빈 칸은 점으로 표시한다 */
	public toDebugString(): string {
		const blank = getBlankTileIndex(this._divideNum);
		const rows: string[] = [];
		for (let row = 0; row < this._divideNum; row++) {
			const cells: string[] = [];
			for (let col = 0; col < this._divideNum; col++) {
				const value = this._board[row * this._divideNum + col];
				// padStart 는 ES2017 이라 Horizon 에디터 lib 에 없을 수 있다. 폭 2 고정이므로 직접 채운다.
				const text = String(value);
				cells.push(value === blank ? ' .' : (text.length >= 2 ? text : ' ' + text));
			}
			rows.push(cells.join(' '));
		}
		return rows.join('\n');
	}

	//#endregion
}
