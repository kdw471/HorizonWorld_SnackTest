/**
 * Laser Solver - 남은 크리스탈 배치 조합 탐색 (PUZ_01 §8.3)
 *
 * 사양 §8.3:
 *   "남은 크리스탈 조합을 5×5 빈 칸에 배치하는 탐색으로 해가 존재하는지 판정한다.
 *    레벨 생성기는 이 솔버로 검증된 레벨만 출력한다.
 *    (규칙 3.3에 따라 여분 크리스탈을 남기는 해도 정답으로 인정)"
 *
 * 따라서 **사용하는 크리스탈 수를 0개부터 하나씩 늘려가며** 탐색한다.
 * 대부분의 레벨은 적은 수로 풀리므로 가장 얕은 해를 빠르게 찾는다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { LaserBoard } from 'Laser_Board';
import { LaserBeamTracer } from 'Laser_BeamTracer';
import {
	LASER_PLACEMENT_GRID_SIZE,
	LaserCell,
	LaserCrystal,
} from 'Laser_Definitions';

/** 해 한 개 - 어떤 크리스탈을 어디에 놓으면 되는지 */
export type LaserSolutionStep = {
	crystalId: string,
	row: number,
	col: number,
}

export type LaserSolution = {
	isSolvable: boolean,
	/** 해를 이루는 배치. 빈 배열이면 아무것도 놓지 않아도 이미 풀린 상태다 */
	steps: LaserSolutionStep[],
	/** 해가 사용한 크리스탈 수 (난이도 스케일링에 쓴다) */
	usedCrystalCount: number,
	/** 탐색한 배치 수 */
	exploredPlacements: number,
	/** 노드 한도에 걸려 탐색을 중단했는지 */
	isExhausted: boolean,
}

export type LaserSolverOptions = {
	/** 살펴볼 배치 조합 수 상한 */
	maxPlacements?: number,
	/** 사용할 크리스탈 수 상한. 지정하지 않으면 인벤토리 전부 */
	maxCrystalsToUse?: number,
}

const DEFAULT_MAX_PLACEMENTS = 300000;

export class LaserSolver {
	private readonly _tracer: LaserBeamTracer;

	private _explored: number = 0;
	private _maxPlacements: number = DEFAULT_MAX_PLACEMENTS;
	/**
	 * 탐색 대상 빈 칸 목록. 탐색 시작 시 한 번만 만들고 고정한다.
	 * 재귀 중에 다시 계산하면 크리스탈을 놓을 때마다 인덱스가 밀려
	 * "칸 인덱스 단조 증가" 로 순열 중복을 없애는 최적화가 깨진다.
	 */
	private _cells: LaserCell[] = [];

	constructor(tracer: LaserBeamTracer = new LaserBeamTracer()) {
		this._tracer = tracer;
	}

	/**
	 * 현재 배치에서 인벤토리 크리스탈을 놓아 클리어할 수 있는지 판정한다.
	 * 보드는 변경하지 않는다 (내부에서 복제해 탐색한다).
	 */
	public solve(board: LaserBoard, options: LaserSolverOptions = {}): LaserSolution {
		this._explored = 0;
		this._maxPlacements = options.maxPlacements ?? DEFAULT_MAX_PLACEMENTS;

		const working = board.clone();
		this._cells = this.getEmptyCells(working);
		const inventory = working.inventory.slice();
		const maxToUse = Math.min(options.maxCrystalsToUse ?? inventory.length, inventory.length);

		// 아무것도 놓지 않아도 풀린 상태일 수 있다 (§3 3.3)
		if (this._tracer.traceAndCheck(working).isSolved) {
			return { isSolvable: true, steps: [], usedCrystalCount: 0, exploredPlacements: 1, isExhausted: false };
		}

		// 사용 개수를 0 -> maxToUse 로 늘려가며 가장 얕은 해를 찾는다.
		for (let useCount = 1; useCount <= maxToUse; useCount++) {
			const steps: LaserSolutionStep[] = [];
			if (this.search(working, useCount, 0, steps)) {
				return {
					isSolvable: true,
					steps: steps.slice(),
					usedCrystalCount: useCount,
					exploredPlacements: this._explored,
					isExhausted: false,
				};
			}
			if (this._explored >= this._maxPlacements) {
				return { isSolvable: false, steps: [], usedCrystalCount: 0, exploredPlacements: this._explored, isExhausted: true };
			}
		}

		return { isSolvable: false, steps: [], usedCrystalCount: 0, exploredPlacements: this._explored, isExhausted: false };
	}

	/** 해가 존재하는지만 빠르게 확인한다 */
	public isSolvable(board: LaserBoard, options: LaserSolverOptions = {}): boolean {
		return this.solve(board, options).isSolvable;
	}

	//#region Internal

	/**
	 * 정확히 `remaining` 개를 더 놓아 클리어할 수 있는지 깊이 우선 탐색한다.
	 *
	 * 같은 종류·같은 방향의 크리스탈은 서로 구분할 필요가 없으므로 중복 조합을 건너뛴다.
	 * 또 배치 순서는 결과에 영향을 주지 않으므로 칸 인덱스를 단조 증가시켜 순열 중복을 없앤다.
	 */
	private search(board: LaserBoard, remaining: number, minCellIndex: number, steps: LaserSolutionStep[]): boolean {
		if (remaining === 0) {
			this._explored++;
			return this._tracer.traceAndCheck(board).isSolved;
		}
		if (this._explored >= this._maxPlacements) {
			return false;
		}

		const usedSignatures = new Set<string>();

		for (let cellIndex = minCellIndex; cellIndex < this._cells.length; cellIndex++) {
			const cell = this._cells[cellIndex];
			usedSignatures.clear();

			for (const crystal of board.inventory.slice()) {
				// 같은 종류·같은 방향이면 어느 것을 써도 결과가 같다
				const signature = this.getCrystalSignature(crystal);
				if (usedSignatures.has(signature)) {
					continue;
				}
				usedSignatures.add(signature);

				if (board.placeFromInventory(crystal.id, cell.row, cell.col).isPlaced === false) {
					continue;
				}
				steps.push({ crystalId: crystal.id, row: cell.row, col: cell.col });

				if (this.search(board, remaining - 1, cellIndex + 1, steps)) {
					return true;
				}

				steps.pop();
				board.pickUp(cell.row, cell.col);

				if (this._explored >= this._maxPlacements) {
					return false;
				}
			}
		}

		return false;
	}

	private getCrystalSignature(crystal: LaserCrystal): string {
		return `${crystal.type}|${crystal.corner ?? '-'}|${crystal.blockedSide ?? '-'}`;
	}

	/** 크리스탈을 놓을 수 있는 빈 칸 목록 (배치 로컬 좌표) */
	private getEmptyCells(board: LaserBoard): LaserCell[] {
		const cells: LaserCell[] = [];
		for (let row = 0; row < LASER_PLACEMENT_GRID_SIZE; row++) {
			for (let col = 0; col < LASER_PLACEMENT_GRID_SIZE; col++) {
				if (board.canPlaceAt(row, col).isPlaced) {
					cells.push({ row: row, col: col });
				}
			}
		}
		return cells;
	}

	//#endregion
}
