/**
 * Rush Hour Solver - BFS 기반 최소 이동 수 탐색기
 *
 * 기획서 PUZ_02 §11.2:
 *   "BFS 솔버를 구현하여 최소 이동 수를 구하고, 레벨 생성기는 해가 존재하고
 *    6번의 배치 제약을 모두 만족하는 레벨만 출력하도록 한다.
 *    난이도는 최소 이동 수와 방해 오브젝트 수로 스케일링한다."
 *
 * 한 번의 "이동"은 한 오브젝트를 한 방향으로 1칸 이상 미는 것 전체를 뜻한다.
 * (클래식 러시아워의 관례와 동일)
 *
 * 성능을 위해 RushHourBoard 를 매 상태마다 복제하지 않고,
 * 위치 배열 + 문자열 인코딩으로 직접 탐색한다.
 *
 * ## Horizon 에디터 컴파일 제약 (실측)
 *
 * 에디터의 TypeScript 는 `target < ES2015` 이고 lib 에 TypedArray 가 없다.
 *   - `Set` / `Map` 이터레이터를 `for...of` 로 **직접 순회할 수 없다** -> `Array.from(...)` 으로 감싼다
 *   - `Int8Array` 등 TypedArray 를 쓸 수 없다 -> 일반 `number[]` 를 쓴다
 * 로컬 `tsc` 는 target ES2020 이라 이 오류를 잡지 못하므로, 검증 명령(§6.1)으로 함께 확인한다.
 */

import { RushHourBoard } from 'RushHour_Board';
import {
	EEdge,
	EMoveDirection,
	EOrientation,
	RUSH_HOUR_PLAY_GRID_SIZE,
	RushHourMove,
	getEndPointLaneIndex,
	getOrientationForEdge,
	isOnEndPointLane,
} from 'RushHour_Definitions';

/** 솔버 탐색 결과 */
export type RushHourSolution = {
	isSolvable: boolean,
	/** 최소 이동 수. 풀 수 없으면 -1 */
	minimumMoves: number,
	/** 최소 해의 이동 순서 */
	moves: RushHourMove[],
	/** 탐색한 상태 수 (난이도 추정에 참고) */
	exploredStates: number,
	/** 노드 한도에 걸려 탐색을 중단했는지 */
	isExhausted: boolean,
}

export type RushHourSolverOptions = {
	/** 탐색 상태 수 상한. 초과하면 탐색을 중단하고 isExhausted = true */
	maxStates?: number,
	/** 최소 해의 이동 순서까지 복원할지 (레벨 검증만 할 때는 false 로 두면 빠르다) */
	reconstructPath?: boolean,
}

/** 도달 가능한 한 상태와 그 상태에서 해까지의 최소 이동 수 */
export type RushHourReachableState = {
	positions: { pieceId: string, row: number, col: number }[],
	/** 이 배치에서 클리어까지 필요한 최소 이동 수 */
	distanceToGoal: number,
}

export type RushHourExploreOptions = {
	/** 탐색할 상태 수 상한 */
	maxStates?: number,
	/** 돌려받고 싶은 최소 이동 수 범위 */
	distanceMin?: number,
	distanceMax?: number,
	/** 돌려받을 상태 수 상한 */
	maxResults?: number,
}

const DEFAULT_MAX_STATES = 200000;
const DEFAULT_EXPLORE_MAX_STATES = 15000;
const DEFAULT_MAX_RESULTS = 1500;

/** 목표 오브젝트의 클리어 조건을 축 단위 단일 비교로 미리 환산해 둔 것 */
type GoalTarget = {
	pieceIndex: number,
	/** true 면 row 값을, false 면 col 값을 비교한다 */
	comparesRow: boolean,
	/** 도달 시 가져야 하는 값 */
	targetValue: number,
}

type PieceMeta = {
	id: string,
	size: number,
	orientation: EOrientation,
	/** 축이 고정된 좌표(H 는 row, V 는 col). FREE 는 사용하지 않는다 */
	fixedValue: number,
}

const DIRECTIONS_BY_ORIENTATION: { [key: string]: EMoveDirection[] } = {
	[EOrientation.HORIZONTAL]: [EMoveDirection.LEFT, EMoveDirection.RIGHT],
	[EOrientation.VERTICAL]: [EMoveDirection.UP, EMoveDirection.DOWN],
	[EOrientation.FREE]: [EMoveDirection.UP, EMoveDirection.DOWN, EMoveDirection.LEFT, EMoveDirection.RIGHT],
};

export class RushHourSolver {
	private _size: number = RUSH_HOUR_PLAY_GRID_SIZE;
	private _meta: PieceMeta[] = [];
	private _goals: GoalTarget[] = [];
	private _rows: number[] = [];
	private _cols: number[] = [];

	/**
	 * 보드의 현재 배치에서 클리어까지의 최소 이동 수를 구한다.
	 * 보드는 변경하지 않는다.
	 */
	public solve(board: RushHourBoard, options: RushHourSolverOptions = {}): RushHourSolution {
		const maxStates = options.maxStates ?? DEFAULT_MAX_STATES;
		const reconstructPath = options.reconstructPath ?? true;

		if (this.load(board) === false) {
			return { isSolvable: false, minimumMoves: -1, moves: [], exploredStates: 0, isExhausted: false };
		}

		const startKey = this.encode(this._rows, this._cols);
		if (this.isGoalState(this._rows, this._cols)) {
			return { isSolvable: true, minimumMoves: 0, moves: [], exploredStates: 1, isExhausted: false };
		}

		const depths = new Map<string, number>();
		const parents = new Map<string, string>();
		const parentMoves = new Map<string, RushHourMove>();
		depths.set(startKey, 0);

		const queue: string[] = [startKey];
		let head = 0;
		let explored = 0;

		const rows: number[] = new Array(this._meta.length);
		const cols: number[] = new Array(this._meta.length);

		while (head < queue.length) {
			const currentKey = queue[head];
			head++;
			explored++;

			if (explored > maxStates) {
				return { isSolvable: false, minimumMoves: -1, moves: [], exploredStates: explored, isExhausted: true };
			}

			const depth = depths.get(currentKey) ?? 0;
			this.decode(currentKey, rows, cols);
			const occupancy = this.buildOccupancy(rows, cols);

			for (let index = 0; index < this._meta.length; index++) {
				const meta = this._meta[index];
				const directions = DIRECTIONS_BY_ORIENTATION[meta.orientation];

				for (const direction of directions) {
					const maxSteps = this.getMaxSteps(index, direction, rows, cols, occupancy);

					for (let steps = 1; steps <= maxSteps; steps++) {
						const nextRows = rows.slice();
						const nextCols = cols.slice();
						this.applyOffset(index, direction, steps, nextRows, nextCols);

						const nextKey = this.encode(nextRows, nextCols);
						if (depths.has(nextKey)) {
							continue;
						}

						depths.set(nextKey, depth + 1);
						if (reconstructPath) {
							parents.set(nextKey, currentKey);
							parentMoves.set(nextKey, { pieceId: meta.id, direction: direction, steps: steps });
						}

						if (this.isGoalState(nextRows, nextCols)) {
							return {
								isSolvable: true,
								minimumMoves: depth + 1,
								moves: reconstructPath ? this.buildPath(nextKey, startKey, parents, parentMoves) : [],
								exploredStates: explored,
								isExhausted: false,
							};
						}

						queue.push(nextKey);
					}
				}
			}
		}

		return { isSolvable: false, minimumMoves: -1, moves: [], exploredStates: explored, isExhausted: false };
	}

	/** 해가 존재하는지만 빠르게 확인한다 (경로 복원 없음) */
	public isSolvable(board: RushHourBoard, maxStates: number = DEFAULT_MAX_STATES): boolean {
		return this.solve(board, { maxStates: maxStates, reconstructPath: false }).isSolvable;
	}

	/**
	 * 현재 배치에서 도달 가능한 모든 상태를 훑고, 각 상태의 "해까지 최소 이동 수"를 구한다.
	 *
	 * 슬라이딩 이동은 가역적이다(A 를 왼쪽으로 k 칸 밀었으면 오른쪽으로 k 칸 되돌릴 수 있다).
	 * 따라서 상태 그래프는 무향이고, 클리어 상태들로부터의 BFS 거리가 곧 그 배치의 최소 이동 수다.
	 *
	 * 레벨 생성기는 이 결과에서 원하는 난이도(거리)의 상태를 골라 시작 배치로 삼는다.
	 * 배치마다 솔버를 새로 돌리는 것보다 훨씬 빠르고, 최소 이동 수를 정확히 지정할 수 있다.
	 */
	public exploreReachableStates(board: RushHourBoard, options: RushHourExploreOptions = {}): RushHourReachableState[] {
		const maxStates = options.maxStates ?? DEFAULT_EXPLORE_MAX_STATES;
		const distanceMin = options.distanceMin ?? 1;
		const distanceMax = options.distanceMax ?? Number.MAX_SAFE_INTEGER;
		const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;

		if (this.load(board) === false) {
			return [];
		}

		const rows: number[] = new Array(this._meta.length);
		const cols: number[] = new Array(this._meta.length);

		// 1단계: 시작 배치에서 도달 가능한 상태들을 모은다.
		const startKey = this.encode(this._rows, this._cols);
		const seen = new Set<string>([startKey]);
		const component: string[] = [];
		const queue: string[] = [startKey];
		let head = 0;

		while (head < queue.length && component.length < maxStates) {
			const key = queue[head];
			head++;
			component.push(key);

			this.decode(key, rows, cols);
			const occupancy = this.buildOccupancy(rows, cols);
			this.forEachNeighbor(rows, cols, occupancy, (neighborKey) => {
				if (seen.has(neighborKey) === false) {
					seen.add(neighborKey);
					queue.push(neighborKey);
				}
			});
		}

		// 2단계: 클리어 상태들에서 역방향 다중 시작 BFS 로 거리를 매긴다.
		const distances = new Map<string, number>();
		const goalQueue: string[] = [];
		for (const key of component) {
			this.decode(key, rows, cols);
			if (this.isGoalState(rows, cols)) {
				distances.set(key, 0);
				goalQueue.push(key);
			}
		}
		if (goalQueue.length === 0) {
			return [];
		}

		let goalHead = 0;
		while (goalHead < goalQueue.length) {
			const key = goalQueue[goalHead];
			goalHead++;
			const distance = distances.get(key) ?? 0;

			this.decode(key, rows, cols);
			const occupancy = this.buildOccupancy(rows, cols);
			this.forEachNeighbor(rows, cols, occupancy, (neighborKey) => {
				if (seen.has(neighborKey) && distances.has(neighborKey) === false) {
					distances.set(neighborKey, distance + 1);
					goalQueue.push(neighborKey);
				}
			});
		}

		// 3단계: 요청한 거리 범위의 상태만 추려서 돌려준다.
		const results: RushHourReachableState[] = [];
		for (const key of component) {
			if (results.length >= maxResults) {
				break;
			}
			const distance = distances.get(key);
			if (distance === undefined || distance < distanceMin || distance > distanceMax) {
				continue;
			}

			this.decode(key, rows, cols);
			const positions: { pieceId: string, row: number, col: number }[] = [];
			for (let index = 0; index < this._meta.length; index++) {
				positions.push({ pieceId: this._meta[index].id, row: rows[index], col: cols[index] });
			}
			results.push({ positions: positions, distanceToGoal: distance });
		}

		return results;
	}

	//#region Internal - setup

	/**
	 * 보드를 솔버 내부 표현으로 옮긴다.
	 * 목표 오브젝트가 자신의 색 도착 포인트와 동일 선상에 있지 않으면(기획서 §5.1 위반)
	 * 애초에 풀 수 없는 배치이므로 false 를 돌려준다.
	 */
	private load(board: RushHourBoard): boolean {
		this._size = board.size;
		this._meta = [];
		this._goals = [];
		this._rows = [];
		this._cols = [];

		const pieces = board.pieces;
		for (let index = 0; index < pieces.length; index++) {
			const piece = pieces[index];
			this._meta.push({
				id: piece.id,
				size: piece.size,
				orientation: piece.orientation,
				fixedValue: piece.orientation === EOrientation.HORIZONTAL ? piece.row : piece.col,
			});
			this._rows.push(piece.row);
			this._cols.push(piece.col);

			if (piece.isGoal === false) {
				continue;
			}

			const endPoint = board.getEndPointForPiece(piece.id);
			if (endPoint === undefined) {
				return false;
			}
			if (piece.orientation !== getOrientationForEdge(endPoint.edge)) {
				return false;
			}
			if (isOnEndPointLane(piece, endPoint) === false) {
				return false;
			}
			// 축이 고정되어 있으므로 "동일 선상" 여부는 이동 중 바뀌지 않는다.
			// 따라서 클리어 판정은 이동 축 좌표 하나의 비교로 환산할 수 있다.
			if (getEndPointLaneIndex(endPoint) < 0) {
				return false;
			}

			switch (endPoint.edge) {
				case EEdge.TOP:
					this._goals.push({ pieceIndex: index, comparesRow: true, targetValue: 0 });
					break;
				case EEdge.BOTTOM:
					this._goals.push({ pieceIndex: index, comparesRow: true, targetValue: this._size - piece.size });
					break;
				case EEdge.LEFT:
					this._goals.push({ pieceIndex: index, comparesRow: false, targetValue: 0 });
					break;
				default:
					this._goals.push({ pieceIndex: index, comparesRow: false, targetValue: this._size - piece.size });
					break;
			}
		}

		return this._goals.length > 0;
	}

	//#endregion

	//#region Internal - state helpers

	private encode(rows: number[], cols: number[]): string {
		let key = '';
		for (let index = 0; index < rows.length; index++) {
			key += String.fromCharCode(rows[index] * this._size + cols[index]);
		}
		return key;
	}

	private decode(key: string, rows: number[], cols: number[]): void {
		for (let index = 0; index < key.length; index++) {
			const packed = key.charCodeAt(index);
			rows[index] = Math.floor(packed / this._size);
			cols[index] = packed % this._size;
		}
	}

	/** occupancy[row * size + col] = pieceIndex | -1 */
	private buildOccupancy(rows: number[], cols: number[]): number[] {
		const occupancy = new Array<number>(this._size * this._size).fill(-1);
		for (let index = 0; index < this._meta.length; index++) {
			const meta = this._meta[index];
			for (let offset = 0; offset < meta.size; offset++) {
				const row = meta.orientation === EOrientation.VERTICAL ? rows[index] + offset : rows[index];
				const col = meta.orientation === EOrientation.HORIZONTAL ? cols[index] + offset : cols[index];
				occupancy[row * this._size + col] = index;
			}
		}
		return occupancy;
	}

	private getMaxSteps(index: number, direction: EMoveDirection, rows: number[], cols: number[], occupancy: number[]): number {
		const meta = this._meta[index];
		const size = this._size;

		// 슬라이딩이므로 진행 방향의 "선두 칸" 앞을 한 칸씩 확인하면 충분하다.
		let leadRow = rows[index];
		let leadCol = cols[index];
		let rowDelta = 0;
		let colDelta = 0;

		switch (direction) {
			case EMoveDirection.UP:
				rowDelta = -1;
				break;
			case EMoveDirection.DOWN:
				rowDelta = 1;
				leadRow = rows[index] + (meta.orientation === EOrientation.VERTICAL ? meta.size - 1 : 0);
				break;
			case EMoveDirection.LEFT:
				colDelta = -1;
				break;
			default:
				colDelta = 1;
				leadCol = cols[index] + (meta.orientation === EOrientation.HORIZONTAL ? meta.size - 1 : 0);
				break;
		}

		let steps = 0;
		while (steps < size) {
			const row = leadRow + rowDelta * (steps + 1);
			const col = leadCol + colDelta * (steps + 1);
			if (row < 0 || row >= size || col < 0 || col >= size) {
				break;
			}
			if (occupancy[row * size + col] !== -1) {
				break;
			}
			steps++;
		}
		return steps;
	}

	private applyOffset(index: number, direction: EMoveDirection, steps: number, rows: number[], cols: number[]): void {
		switch (direction) {
			case EMoveDirection.UP:
				rows[index] -= steps;
				break;
			case EMoveDirection.DOWN:
				rows[index] += steps;
				break;
			case EMoveDirection.LEFT:
				cols[index] -= steps;
				break;
			default:
				cols[index] += steps;
				break;
		}
	}

	/**
	 * 한 상태에서 가능한 모든 다음 상태의 키를 순회한다.
	 * 이웃마다 배열을 복제하면 탐색 비용이 크므로, 좌표를 제자리에서 바꿨다가 되돌린다.
	 */
	private forEachNeighbor(rows: number[], cols: number[], occupancy: number[], callback: (key: string) => void): void {
		for (let index = 0; index < this._meta.length; index++) {
			const meta = this._meta[index];
			const directions = DIRECTIONS_BY_ORIENTATION[meta.orientation];
			const originRow = rows[index];
			const originCol = cols[index];

			for (const direction of directions) {
				const maxSteps = this.getMaxSteps(index, direction, rows, cols, occupancy);
				for (let steps = 1; steps <= maxSteps; steps++) {
					this.applyOffset(index, direction, steps, rows, cols);
					callback(this.encode(rows, cols));
					rows[index] = originRow;
					cols[index] = originCol;
				}
			}
		}
	}

	/** 기획서 §11.3 - 목표가 2개면 둘 다 도달해야 클리어 */
	private isGoalState(rows: number[], cols: number[]): boolean {
		for (const goal of this._goals) {
			const value = goal.comparesRow ? rows[goal.pieceIndex] : cols[goal.pieceIndex];
			if (value !== goal.targetValue) {
				return false;
			}
		}
		return true;
	}

	private buildPath(endKey: string, startKey: string, parents: Map<string, string>, parentMoves: Map<string, RushHourMove>): RushHourMove[] {
		const moves: RushHourMove[] = [];
		let key = endKey;
		while (key !== startKey) {
			const move = parentMoves.get(key);
			const parent = parents.get(key);
			if (move === undefined || parent === undefined) {
				break;
			}
			moves.push(move);
			key = parent;
		}
		moves.reverse();
		return moves;
	}

	//#endregion
}
