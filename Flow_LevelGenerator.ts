/**
 * Flow Level Generator - 경로 분해 방식 생성기 (PUZ_05 §9.5)
 *
 * 사양 §9.5:
 *   "7x7 비트맵으로 타일 마스크를 정한 뒤, 그 위에서 해밀턴 경로 분해
 *    (모든 SUB 칸을 색깔별 단순 경로로 완전 분할)를 랜덤 생성한다.
 *    각 경로의 양 끝을 MAIN(START/END)으로, 중간을 SUB 로 확정한다.
 *    이 방식은 '모든 서브 사용' 조건을 자동으로 보장한다."
 *
 * 구현 절차
 *   1) 타일 마스크의 모든 칸을 지나는 **해밀턴 경로**를 하나 찾는다.
 *      (Warnsdorff 휴리스틱 + 백트래킹. 이분 그래프 불균형이 1을 넘으면 존재하지 않으므로 미리 걸러낸다)
 *   2) 그 경로를 색상 수만큼의 연속 구간으로 자른다. 각 구간은 최소 2칸이다.
 *   3) 구간의 양 끝을 MAIN(START/END), 중간을 SUB 로 확정한다.
 *
 * 해밀턴 경로 자체가 곧 하나의 해이므로 **항상 풀 수 있고, 모든 서브가 사용된다.**
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { FlowBoard } from 'Flow_Board';
import { FlowSolver } from 'Flow_Solver';
import { FlowDifficultyConfig, FlowTables, validateDifficultyConfig } from 'Flow_DataTables';
import {
	ALL_FLOW_COLORS,
	ENodeKind,
	ENodeRole,
	FLOW_GRID_SIZE,
	FlowCell,
	FlowLevel,
	FlowNode,
	FlowValidationResult,
	RandomSource,
	cellKey,
	countTiles,
	createSeededRandom,
	getOrthogonalNeighbors,
	pickRandom,
	randomInt,
	shuffleInPlace,
} from 'Flow_Definitions';

export type FlowGenerationOptions = {
	puzzleId: string,
	difficulty: number,
	seed?: number,
	maxAttempts?: number,
	config?: FlowDifficultyConfig,
}

const DEFAULT_MAX_ATTEMPTS = 40;
/** 해밀턴 경로 탐색의 확장 횟수 상한 */
const HAMILTONIAN_NODE_LIMIT = 200000;

//#region Validator

export class FlowPlacementValidator {
	public validate(level: FlowLevel): FlowValidationResult {
		const violations: string[] = [];

		const nodeByCell = new Map<string, FlowNode>();
		for (const node of level.nodes) {
			nodeByCell.set(cellKey(node.row, node.col), node);
		}

		// §3 - 오브젝트는 반드시 생성된 타일 위에만 존재한다
		for (const node of level.nodes) {
			if (level.tiles[node.row][node.col] === false) {
				violations.push(`Object (${node.row},${node.col}) is on a cell without a tile.`);
			}
		}

		// 타일마다 오브젝트가 하나씩 있어야 "모든 서브 사용" 조건이 성립한다
		for (let row = 0; row < FLOW_GRID_SIZE; row++) {
			for (let col = 0; col < FLOW_GRID_SIZE; col++) {
				if (level.tiles[row][col] && nodeByCell.has(cellKey(row, col)) === false) {
					violations.push(`Tile (${row},${col}) has no object on it.`);
				}
			}
		}

		// §4 - 색상마다 출발/도착 메인 오브젝트가 정확히 하나씩
		const startCount = new Map<string, number>();
		const endCount = new Map<string, number>();
		for (const node of level.nodes) {
			if (node.kind !== ENodeKind.MAIN) {
				continue;
			}
			if (node.color === undefined) {
				violations.push(`Main object (${node.row},${node.col}) has no color.`);
				continue;
			}
			if (node.role === ENodeRole.START) {
				startCount.set(node.color, (startCount.get(node.color) ?? 0) + 1);
			}
			else if (node.role === ENodeRole.END) {
				endCount.set(node.color, (endCount.get(node.color) ?? 0) + 1);
			}
			else {
				violations.push(`Main object (${node.row},${node.col}) has no role (START/END).`);
			}
		}

		for (const entry of Array.from(startCount.entries())) {
			if (entry[1] !== 1) {
				violations.push(`Color ${entry[0]} has ${entry[1]} start points; exactly 1 is required.`);
			}
		}
		for (const entry of Array.from(endCount.entries())) {
			if (entry[1] !== 1) {
				violations.push(`Color ${entry[0]} has ${entry[1]} end points; exactly 1 is required.`);
			}
		}
		if (startCount.size !== endCount.size) {
			violations.push(`Start color count ${startCount.size} differs from end color count ${endCount.size}.`);
		}
		if (startCount.size !== level.colorCount) {
			violations.push(`Color count declared as ${level.colorCount} but is actually ${startCount.size}.`);
		}

		// 서브 오브젝트는 시작 시 색이 없어야 한다 (§4)
		for (const node of level.nodes) {
			if (node.kind === ENodeKind.SUB && node.color !== undefined) {
				violations.push(`Sub object (${node.row},${node.col}) already has a color at start.`);
			}
		}

		return { isValid: violations.length === 0, violations: violations };
	}
}

//#endregion

//#region Generator

export class FlowLevelGenerator {
	private readonly _tables: FlowTables;
	private readonly _validator: FlowPlacementValidator;
	private readonly _solver: FlowSolver;

	constructor(tables: FlowTables, validator: FlowPlacementValidator = new FlowPlacementValidator(), solver: FlowSolver = new FlowSolver()) {
		this._tables = tables;
		this._validator = validator;
		this._solver = solver;
	}

	public get validator(): FlowPlacementValidator {
		return this._validator;
	}

	public generate(options: FlowGenerationOptions): FlowLevel | undefined {
		const config = options.config ?? this._tables.getDifficultyConfig(options.difficulty);
		if (config === undefined) {
			console.warn(`[FlowLevelGenerator] No difficulty config for difficulty ${options.difficulty}`);
			return undefined;
		}

		const configViolations = validateDifficultyConfig(config, this._tables);
		if (configViolations.length > 0) {
			console.warn(`[FlowLevelGenerator] Invalid config for difficulty ${options.difficulty}: ${configViolations.join(' / ')}`);
			return undefined;
		}

		const random = options.seed === undefined ? Math.random : createSeededRandom(options.seed);
		const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const maskName = pickRandom(random, config.tileMaskNames);
			const tiles = this._tables.getTileMask(maskName);
			if (tiles === undefined) {
				continue;
			}

			const path = this.findHamiltonianPath(tiles, random);
			if (path === undefined) {
				continue;
			}

			const nodes = this.cutIntoSegments(random, path, config.colorCount);
			if (nodes === undefined) {
				continue;
			}

			const level: FlowLevel = {
				puzzleId: options.puzzleId,
				difficulty: options.difficulty,
				tiles: tiles,
				nodes: nodes,
				colorCount: config.colorCount,
			};

			if (this._validator.validate(level).isValid === false) {
				continue;
			}
			// 해밀턴 경로 자체가 해이지만, 실제로 재생해 클리어되는지 확인한다
			if (this.isSolvableByConstruction(level, path) === false) {
				continue;
			}

			return level;
		}

		console.warn(`[FlowLevelGenerator] Failed to generate a level for difficulty ${options.difficulty} within ${maxAttempts} attempts`);
		return undefined;
	}

	public verify(level: FlowLevel): FlowValidationResult {
		const result = this._validator.validate(level);
		if (result.isValid === false) {
			return result;
		}

		const board = FlowBoard.fromLevel(level);
		if (board.isSolved()) {
			return { isValid: false, violations: ['Already cleared at start.'] };
		}
		if (this._solver.isSolvable(board) === false) {
			return { isValid: false, violations: ['No solution uses every sub object.'] };
		}
		return { isValid: true, violations: [] };
	}

	//#region Internal - Hamiltonian path

	/**
	 * 타일 마스크의 모든 칸을 정확히 한 번씩 지나는 경로를 찾는다.
	 *
	 * 격자 그래프는 이분 그래프다. 두 색의 칸 수 차이가 1을 넘으면 해밀턴 경로가 존재할 수 없으므로
	 * 탐색하기 전에 걸러낸다. 탐색은 Warnsdorff 휴리스틱(남은 이웃이 적은 칸부터)으로 진행하고
	 * 막히면 백트래킹한다.
	 */
	public findHamiltonianPath(tiles: readonly boolean[][], random: RandomSource): FlowCell[] | undefined {
		const total = countTiles(tiles);
		if (total === 0) {
			return undefined;
		}

		// 이분 그래프 불균형 확인
		let even = 0;
		let odd = 0;
		const cells: FlowCell[] = [];
		for (let row = 0; row < FLOW_GRID_SIZE; row++) {
			for (let col = 0; col < FLOW_GRID_SIZE; col++) {
				if (tiles[row][col] === false) {
					continue;
				}
				cells.push({ row: row, col: col });
				if ((row + col) % 2 === 0) {
					even++;
				}
				else {
					odd++;
				}
			}
		}
		if (Math.abs(even - odd) > 1) {
			// 해밀턴 경로가 존재할 수 없는 마스크다
			return undefined;
		}

		// 칸 수가 많은 쪽에서 출발해야 한다 (불균형이 1일 때)
		const preferEven = even > odd;
		const starts = shuffleInPlace(random, cells.filter((cell) =>
			even === odd || ((cell.row + cell.col) % 2 === 0) === preferEven));

		for (const start of starts) {
			const visited = new Set<string>();
			const path: FlowCell[] = [];
			const budget = { remaining: HAMILTONIAN_NODE_LIMIT };

			visited.add(cellKey(start.row, start.col));
			path.push(start);
			if (this.searchHamiltonian(tiles, random, visited, path, total, budget)) {
				return path;
			}
		}

		return undefined;
	}

	private searchHamiltonian(tiles: readonly boolean[][], random: RandomSource, visited: Set<string>, path: FlowCell[], total: number, budget: { remaining: number }): boolean {
		if (path.length === total) {
			return true;
		}
		if (budget.remaining <= 0) {
			return false;
		}
		budget.remaining--;

		const head = path[path.length - 1];
		const candidates = getOrthogonalNeighbors(head).filter((cell) =>
			tiles[cell.row][cell.col] && visited.has(cellKey(cell.row, cell.col)) === false);

		// Warnsdorff - 남은 이웃이 적은 칸부터 본다. 동점은 무작위로 섞는다.
		shuffleInPlace(random, candidates);
		candidates.sort((left, right) =>
			this.countFreeNeighbors(tiles, visited, left) - this.countFreeNeighbors(tiles, visited, right));

		for (const candidate of candidates) {
			visited.add(cellKey(candidate.row, candidate.col));
			path.push(candidate);
			if (this.searchHamiltonian(tiles, random, visited, path, total, budget)) {
				return true;
			}
			path.pop();
			visited.delete(cellKey(candidate.row, candidate.col));
		}

		return false;
	}

	private countFreeNeighbors(tiles: readonly boolean[][], visited: Set<string>, cell: FlowCell): number {
		let count = 0;
		for (const neighbor of getOrthogonalNeighbors(cell)) {
			if (tiles[neighbor.row][neighbor.col] && visited.has(cellKey(neighbor.row, neighbor.col)) === false) {
				count++;
			}
		}
		return count;
	}

	//#endregion

	//#region Internal - cutting

	/**
	 * 해밀턴 경로를 색상 수만큼의 연속 구간으로 자른다.
	 * 각 구간은 최소 2칸(출발 MAIN + 도착 MAIN)이어야 한다.
	 */
	private cutIntoSegments(random: RandomSource, path: FlowCell[], colorCount: number): FlowNode[] | undefined {
		if (colorCount < 1 || path.length < colorCount * 2) {
			return undefined;
		}

		// 각 구간에 2칸씩 배정하고, 남은 칸을 무작위로 나눠 준다
		const lengths: number[] = [];
		for (let index = 0; index < colorCount; index++) {
			lengths.push(2);
		}
		let remaining = path.length - colorCount * 2;
		while (remaining > 0) {
			lengths[randomInt(random, 0, colorCount - 1)]++;
			remaining--;
		}

		const colors = shuffleInPlace(random, ALL_FLOW_COLORS.slice()).slice(0, colorCount);
		const nodes: FlowNode[] = [];
		let cursor = 0;

		for (let index = 0; index < colorCount; index++) {
			const length = lengths[index];
			const color = colors[index];

			for (let offset = 0; offset < length; offset++) {
				const cell = path[cursor + offset];
				if (offset === 0) {
					nodes.push({ row: cell.row, col: cell.col, kind: ENodeKind.MAIN, color: color, role: ENodeRole.START });
				}
				else if (offset === length - 1) {
					nodes.push({ row: cell.row, col: cell.col, kind: ENodeKind.MAIN, color: color, role: ENodeRole.END });
				}
				else {
					nodes.push({ row: cell.row, col: cell.col, kind: ENodeKind.SUB });
				}
			}
			cursor += length;
		}

		return nodes;
	}

	/** 생성에 쓴 해밀턴 경로를 그대로 재생해 클리어되는지 확인한다 */
	private isSolvableByConstruction(level: FlowLevel, path: FlowCell[]): boolean {
		const board = FlowBoard.fromLevel(level);

		let cursor = 0;
		while (cursor < path.length) {
			const startCell = path[cursor];
			const startNode = board.getNode(startCell.row, startCell.col);
			if (startNode === undefined || startNode.kind !== ENodeKind.MAIN || startNode.color === undefined) {
				return false;
			}

			const color = startNode.color;
			board.beginPath(color);
			cursor++;

			while (cursor < path.length) {
				const cell = path[cursor];
				if (board.extend(color, cell.row, cell.col) === false) {
					return false;
				}
				cursor++;
				if (board.isPathComplete(color)) {
					break;
				}
			}
		}

		return board.isSolved();
	}

	//#endregion
}

//#endregion

/** 생성 결과를 한 줄 요약으로 남기는 디버그 헬퍼 */
export function describeFlowLevel(level: FlowLevel): string {
	let mains = 0;
	let subs = 0;
	for (const node of level.nodes) {
		if (node.kind === ENodeKind.MAIN) {
			mains++;
		}
		else {
			subs++;
		}
	}
	return `${level.puzzleId} D${level.difficulty} tiles=${countTiles(level.tiles)} colors=${level.colorCount} main=${mains} sub=${subs}`;
}
