/**
 * Flow Solver - 모든 서브를 사용하는 해가 존재하는지 판정하는 탐색기 (PUZ_05)
 *
 * 이 퍼즐은 일반 Flow 와 달리 **모든 서브 오브젝트를 전부 사용**해야 클리어된다 (§5).
 * 따라서 "각 색이 START ~ END 로 이어졌는가" 만 보면 안 되고,
 * 색깔별 경로들이 **모든 SUB 칸을 빈틈없이 덮는가** 까지 봐야 한다 (§9.4).
 *
 * 즉 이 문제는 단순 경로 잇기가 아니라 **정점 서로소 경로 덮개(vertex-disjoint path cover)** 다.
 * 색을 하나씩 탐욕적으로 이어서는 안 된다. 앞 색이 뒤 색의 길을 막거나 서브를 남기기 때문이다.
 *
 * 탐색 전략
 *   - 색을 순서대로 처리하며, 각 색의 경로를 깊이 우선으로 늘린다.
 *   - 한 색이 도착하면 다음 색으로 넘어가고, 마지막 색까지 끝나면 남은 SUB 가 없는지 확인한다.
 *   - 막다른 칸(주변에 갈 곳이 없는 미착색 SUB)이 생기면 즉시 되돌린다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { FlowBoard } from 'Flow_Board';
import {
	EFlowColor,
	ENodeKind,
	ENodeRole,
	FLOW_GRID_SIZE,
	FlowCell,
	FlowNode,
	getOrthogonalNeighbors,
} from 'Flow_Definitions';

export type FlowSolution = {
	isSolvable: boolean,
	/** 색깔별 해 경로 */
	paths: { color: EFlowColor, cells: FlowCell[] }[],
	exploredStates: number,
	isExhausted: boolean,
}

export type FlowSolverOptions = {
	/** 탐색 확장 횟수 상한 */
	maxStates?: number,
}

const DEFAULT_MAX_STATES = 400000;

export class FlowSolver {
	private _explored: number = 0;
	private _maxStates: number = DEFAULT_MAX_STATES;
	private _isExhausted: boolean = false;

	/**
	 * 모든 서브를 사용하는 해가 존재하는지 찾는다. 보드는 변경하지 않는다.
	 * 최단 해를 보장하지는 않는다 (검증이 목적이다).
	 */
	public solve(board: FlowBoard, options: FlowSolverOptions = {}): FlowSolution {
		this._explored = 0;
		this._maxStates = options.maxStates ?? DEFAULT_MAX_STATES;
		this._isExhausted = false;

		const working = board.clone();
		working.clearAllPaths();

		// 색 순서를 고정해 결과가 재현되게 한다
		const colors = working.colors.slice().sort();
		const isSolvable = this.solveColor(working, colors, 0);

		const paths: { color: EFlowColor, cells: FlowCell[] }[] = [];
		if (isSolvable) {
			for (const color of colors) {
				paths.push({ color: color, cells: working.getPath(color).map((cell) => ({ row: cell.row, col: cell.col })) });
			}
		}

		return {
			isSolvable: isSolvable,
			paths: paths,
			exploredStates: this._explored,
			isExhausted: this._isExhausted,
		};
	}

	public isSolvable(board: FlowBoard, options: FlowSolverOptions = {}): boolean {
		return this.solve(board, options).isSolvable;
	}

	//#region Internal

	/** `colorIndex` 번째 색부터 차례로 이어 본다 */
	private solveColor(board: FlowBoard, colors: EFlowColor[], colorIndex: number): boolean {
		if (colorIndex >= colors.length) {
			// 모든 색이 이어졌다. 이제 서브가 하나도 남지 않아야 클리어다 (§9.4)
			return board.getUncoloredSubCount() === 0;
		}

		const color = colors[colorIndex];
		const end = board.getMain(color, ENodeRole.END);
		if (end === undefined) {
			return false;
		}
		if (board.beginPath(color) === false) {
			return false;
		}

		return this.extendPath(board, colors, colorIndex, end);
	}

	/** 현재 색의 경로를 한 칸씩 늘려 도착 지점을 찾는다 */
	private extendPath(board: FlowBoard, colors: EFlowColor[], colorIndex: number, end: FlowNode): boolean {
		if (this._explored >= this._maxStates) {
			this._isExhausted = true;
			return false;
		}
		this._explored++;

		const color = colors[colorIndex];
		const head = board.getPathHead(color);
		if (head === undefined) {
			return false;
		}

		// 도착했다면 다음 색으로 넘어간다
		if (head.row === end.row && head.col === end.col) {
			return this.solveColor(board, colors, colorIndex + 1);
		}

		// 갈 곳이 막힌 미착색 서브가 생겼다면 이 가지는 가망이 없다
		if (this.hasDeadEnd(board, colors, colorIndex)) {
			return false;
		}

		const candidates = getOrthogonalNeighbors(head).filter((cell) => {
			const check = board.canExtend(color, cell.row, cell.col);
			return check.isValid && check.isUndo === false;
		});

		// 선택지가 적은 칸부터 본다. 막다른 길을 먼저 소진해 가지치기를 빠르게 한다.
		candidates.sort((left, right) => this.countFreeNeighbors(board, left) - this.countFreeNeighbors(board, right));

		for (const candidate of candidates) {
			if (board.extend(color, candidate.row, candidate.col) === false) {
				continue;
			}
			if (this.extendPath(board, colors, colorIndex, end)) {
				return true;
			}
			board.popHead(color);

			if (this._explored >= this._maxStates) {
				this._isExhausted = true;
				return false;
			}
		}

		return false;
	}

	/**
	 * 아직 색을 받지 못한 서브 칸 중, 어떤 경로도 도달할 수 없게 갇힌 것이 있는지 본다.
	 *
	 * 미착색 서브는 최소 2개의 "열린 이웃"이 있어야 지나갈 수 있다.
	 * (들어오는 길 하나 + 나가는 길 하나. 서브는 입력 1 / 출력 1 뿐이다 - §4)
	 * 열린 이웃이란 미착색 서브이거나, 아직 쓰지 않은 메인 오브젝트이거나, 현재 경로의 머리다.
	 */
	private hasDeadEnd(board: FlowBoard, colors: EFlowColor[], colorIndex: number): boolean {
		const heads = new Set<string>();
		for (let index = colorIndex; index < colors.length; index++) {
			const head = board.getPathHead(colors[index]);
			if (head !== undefined) {
				heads.add(`${head.row},${head.col}`);
			}
		}

		for (let row = 0; row < FLOW_GRID_SIZE; row++) {
			for (let col = 0; col < FLOW_GRID_SIZE; col++) {
				const node = board.getNode(row, col);
				if (node === undefined || node.kind !== ENodeKind.SUB || node.color !== undefined) {
					continue;
				}

				let openings = 0;
				for (const neighbor of getOrthogonalNeighbors({ row: row, col: col })) {
					if (this.isOpenNeighbor(board, colors, colorIndex, neighbor, heads)) {
						openings++;
					}
				}
				if (openings < 2) {
					return true;
				}
			}
		}
		return false;
	}

	private isOpenNeighbor(board: FlowBoard, colors: EFlowColor[], colorIndex: number, cell: FlowCell, heads: Set<string>): boolean {
		if (board.hasTile(cell.row, cell.col) === false) {
			return false;
		}
		const node = board.getNode(cell.row, cell.col);
		if (node === undefined) {
			return false;
		}

		// 현재 진행 중인 경로의 머리는 여기서 뻗어 나올 수 있다
		if (heads.has(`${cell.row},${cell.col}`)) {
			return true;
		}

		if (node.kind === ENodeKind.SUB) {
			return node.color === undefined;
		}

		// 아직 처리하지 않은 색의 메인 오브젝트는 앞으로 경로가 시작/도착할 수 있다
		if (node.color === undefined) {
			return false;
		}
		const index = colors.indexOf(node.color);
		return index >= colorIndex;
	}

	private countFreeNeighbors(board: FlowBoard, cell: FlowCell): number {
		let count = 0;
		for (const neighbor of getOrthogonalNeighbors(cell)) {
			const node = board.getNode(neighbor.row, neighbor.col);
			if (node === undefined) {
				continue;
			}
			if (node.kind === ENodeKind.SUB && node.color === undefined) {
				count++;
			}
			else if (node.kind === ENodeKind.MAIN) {
				count++;
			}
		}
		return count;
	}

	//#endregion
}
