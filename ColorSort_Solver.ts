/**
 * Color Sort Solver - 해가 존재하는지 판정하는 탐색기 (PUZ_03)
 *
 * 레벨 생성기가 만든 배치를 검증하는 데 쓴다 (PUZ_00 §7.3 "생성 후 솔버로 검증하고, 실패 시 재생성").
 *
 * 실제 보드의 `canMove()` / `move()` 를 그대로 호출해 탐색하므로,
 * 블랙(미지) 건전지의 공개 타이밍과 "미공개는 빈 케이스로만" 규칙(§10.3)이 그대로 반영된다.
 * 즉 솔버가 찾은 해는 플레이어가 실제로 둘 수 있는 수순이다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { ColorSortBoard } from 'ColorSort_Board';

export type ColorSortSolutionStep = {
	fromCaseIndex: number,
	toCaseIndex: number,
	count: number,
}

export type ColorSortSolution = {
	isSolvable: boolean,
	steps: ColorSortSolutionStep[],
	/** 탐색한 상태 수 */
	exploredStates: number,
	/** 노드 한도에 걸려 탐색을 중단했는지 */
	isExhausted: boolean,
}

export type ColorSortSolverOptions = {
	/** 탐색 상태 수 상한 */
	maxStates?: number,
	/** 수순 길이 상한 */
	maxDepth?: number,
}

const DEFAULT_MAX_STATES = 200000;
const DEFAULT_MAX_DEPTH = 120;

export class ColorSortSolver {
	private _explored: number = 0;
	private _maxStates: number = DEFAULT_MAX_STATES;
	private _maxDepth: number = DEFAULT_MAX_DEPTH;
	/** 상태 -> 처음 확장했을 때의 깊이. 깊이 컷과 함께 쓰려면 Set 으로는 부족하다 */
	private _visited = new Map<string, number>();
	private _isExhausted: boolean = false;

	/**
	 * 해가 존재하는지 깊이 우선으로 찾는다. 보드는 변경하지 않는다.
	 * 최단 수순을 보장하지는 않는다 (검증이 목적이다).
	 */
	public solve(board: ColorSortBoard, options: ColorSortSolverOptions = {}): ColorSortSolution {
		this._explored = 0;
		this._maxStates = options.maxStates ?? DEFAULT_MAX_STATES;
		this._maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
		this._visited = new Map<string, number>();
		this._isExhausted = false;

		const working = board.clone();
		const steps: ColorSortSolutionStep[] = [];
		const isSolvable = this.search(working, 0, steps);

		return {
			isSolvable: isSolvable,
			steps: isSolvable ? steps.slice() : [],
			exploredStates: this._explored,
			isExhausted: this._isExhausted,
		};
	}

	public isSolvable(board: ColorSortBoard, options: ColorSortSolverOptions = {}): boolean {
		return this.solve(board, options).isSolvable;
	}

	//#region Internal

	private search(board: ColorSortBoard, depth: number, steps: ColorSortSolutionStep[]): boolean {
		if (board.isSolved()) {
			return true;
		}
		if (depth >= this._maxDepth) {
			return false;
		}
		if (this._explored >= this._maxStates) {
			this._isExhausted = true;
			return false;
		}

		// 깊이 한도(maxDepth) 때문에 실패한 상태를 무조건 가지치기하면,
		// 같은 상태에 더 얕은 경로로 재도달했을 때 풀 수 있는 보드를 "해 없음"으로 오판한다.
		// 그래서 "같거나 더 얕은 깊이로 이미 확장한" 경우에만 가지치기한다.
		const key = board.getStateKey();
		const seenDepth = this._visited.get(key);
		if (seenDepth !== undefined && seenDepth <= depth) {
			return false;
		}
		this._visited.set(key, depth);
		this._explored++;

		for (const candidate of this.orderMoves(board)) {
			// 실제 보드 규칙으로 수를 두어야 공개 타이밍까지 정확히 반영된다.
			const next = board.clone();
			const move = next.move(candidate.fromCaseIndex, candidate.toCaseIndex);
			if (move === undefined) {
				continue;
			}

			steps.push({ fromCaseIndex: candidate.fromCaseIndex, toCaseIndex: candidate.toCaseIndex, count: move.count });
			if (this.search(next, depth + 1, steps)) {
				return true;
			}
			steps.pop();

			if (this._explored >= this._maxStates) {
				this._isExhausted = true;
				return false;
			}
		}

		return false;
	}

	/**
	 * 좋아 보이는 수를 먼저 본다.
	 * 색이 맞는 케이스로 합치는 수가 빈 케이스를 쓰는 수보다 대체로 낫다.
	 */
	private orderMoves(board: ColorSortBoard): { fromCaseIndex: number, toCaseIndex: number, count: number }[] {
		const moves = board.getValidMoves();
		return moves.sort((left, right) => this.scoreMove(board, right) - this.scoreMove(board, left));
	}

	private scoreMove(board: ColorSortBoard, move: { fromCaseIndex: number, toCaseIndex: number, count: number }): number {
		const destination = board.getCase(move.toCaseIndex);
		const source = board.getCase(move.fromCaseIndex);
		if (destination === undefined || source === undefined) {
			return 0;
		}

		let score = 0;
		// 빈 케이스가 아닌 곳에 합치면 케이스 하나를 아끼는 셈이다
		if (destination.batteries.length > 0) {
			score += 10 + move.count;
		}
		// 출발 케이스를 통째로 비우는 수는 자유도를 늘린다
		if (source.batteries.length === move.count) {
			score += 5;
		}
		return score;
	}

	//#endregion
}
