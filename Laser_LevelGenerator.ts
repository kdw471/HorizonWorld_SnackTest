/**
 * Laser Level Generator - 항상 풀 수 있는 레벨만 출력하는 생성기 (PUZ_01 §8.3)
 *
 * PUZ_00 §7.3 / README "레벨 생성 시 공통 원칙":
 *   무작위 배치 대신 **완성 상태에서 역방향으로 흐트러뜨리는** 방식을 우선한다.
 *
 * 생성 절차
 *   1) 발사체를 테두리에 놓고 필드 안쪽으로 광선을 쏜다
 *   2) 광선이 지나갈 경로를 직접 그리면서, 꺾이는 칸마다 삼각형 크리스탈을 놓는다
 *   3) 경로가 테두리로 빠져나가는 칸에 같은 색 수신체를 놓는다  -> 이 시점에 해가 완성된다
 *   4) 경로 위에 중계체를, 경로 밖에 해골을 배치한다
 *   5) 광선 추적기로 실제로 클리어되는지 확인한다
 *   6) 해를 이루던 크리스탈을 **인벤토리로 되돌린다** (플레이어가 다시 놓아야 한다)
 *   7) 여분 크리스탈을 섞어 넣는다 (§3 3.3 - 모두 사용하지 않아도 클리어 가능)
 *   8) 솔버로 해가 존재함을 최종 검증한다
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 *
 * ## Horizon 에디터 컴파일 제약 (실측)
 *
 * 에디터의 TypeScript 는 `target < ES2015` 이고 lib 에 TypedArray 가 없다.
 *   - `Set` / `Map` 이터레이터를 `for...of` 로 **직접 순회할 수 없다** -> `Array.from(...)` 으로 감싼다
 *   - `Int8Array` 등 TypedArray 를 쓸 수 없다 -> 일반 `number[]` 를 쓴다
 * 로컬 `tsc` 는 target ES2020 이라 이 오류를 잡지 못하므로, 검증 명령(§6.1)으로 함께 확인한다.
 */

import { LaserBoard } from 'Laser_Board';
import { LaserBeamTracer } from 'Laser_BeamTracer';
import { LaserDifficultyConfig, LaserTables } from 'Laser_DataTables';
import { LaserSolver } from 'Laser_Solver';
import {
	ECrystalType,
	EGimmickType,
	ELaserColor,
	ELaserDirection,
	ETeeBlockedSide,
	ETriangleCorner,
	LASER_MAX_INVENTORY_SLOTS,
	LASER_PLACEMENT_GRID_SIZE,
	LaserCell,
	LaserCrystal,
	LaserGimmick,
	LaserLevel,
	LaserPlacedCrystal,
	LaserValidationResult,
	ORTHOGONAL_DIRECTIONS,
	RandomSource,
	createSeededRandom,
	getDirectionDelta,
	getInwardDirection,
	isBorderCell,
	isInsideFullGrid,
	isInsidePlacementArea,
	pickRandom,
	randomInt,
	reflectTriangle,
	shuffleInPlace,
	toFullGridIndex,
	toPlacementLocalIndex,
} from 'Laser_Definitions';

export type LaserGenerationOptions = {
	puzzleId: string,
	difficulty: number,
	seed?: number,
	maxAttempts?: number,
	config?: LaserDifficultyConfig,
}

const DEFAULT_MAX_ATTEMPTS = 200;
const BEAM_COLORS: readonly ELaserColor[] = [ELaserColor.RED, ELaserColor.GREEN, ELaserColor.BLUE];

/** 경로를 구성하는 도중의 광선 상태 */
type PathNode = {
	row: number,
	col: number,
	direction: ELaserDirection,
}

//#region Validator

/** 생성 결과가 사양의 배치 규칙을 지키는지 확인한다 */
export class LaserPlacementValidator {
	public validate(level: LaserLevel): LaserValidationResult {
		const violations: string[] = [];

		const emitters = level.gimmicks.filter((gimmick) => gimmick.type === EGimmickType.EMITTER);
		const receivers = level.gimmicks.filter((gimmick) => gimmick.type === EGimmickType.RECEIVER);

		if (emitters.length === 0) {
			violations.push('There are no emitters.');
		}
		if (receivers.length === 0) {
			violations.push('There are no receivers.');
		}

		// §2 / §5.1 - 발사체·수신체는 테두리, 나머지 기믹은 5x5 안
		for (const gimmick of level.gimmicks) {
			const mustBeOnBorder = gimmick.type === EGimmickType.EMITTER || gimmick.type === EGimmickType.RECEIVER;
			const onBorder = isBorderCell(gimmick.row, gimmick.col);
			if (mustBeOnBorder && onBorder === false) {
				violations.push(`${gimmick.type} '${gimmick.id}' is not on the border.`);
			}
			if (mustBeOnBorder === false && onBorder) {
				violations.push(`${gimmick.type} '${gimmick.id}' is outside the placement area.`);
			}
			if (mustBeOnBorder && getInwardDirection(gimmick.row, gimmick.col) === undefined) {
				violations.push(`Cannot determine the inward direction of ${gimmick.type} '${gimmick.id}'.`);
			}
		}

		// §3 2.1 - 발사체 색과 짝이 맞는 수신체가 있어야 한다
		for (const receiver of receivers) {
			const hasMatchingEmitter = emitters.some((emitter) =>
				emitter.colors.some((color) => receiver.colors.indexOf(color) >= 0));
			if (hasMatchingEmitter === false) {
				violations.push(`No emitter matches the color of receiver '${receiver.id}'.`);
			}
		}

		// §5.0 / §5.1 - 크리스탈은 5x5 안에만
		for (const crystal of level.presetCrystals) {
			if (isInsidePlacementArea(crystal.row, crystal.col) === false) {
				violations.push(`Crystal '${crystal.id}' is outside the placement area (5x5).`);
			}
		}

		// §2 - 인벤토리 슬롯은 최대 5개
		if (level.inventory.length > LASER_MAX_INVENTORY_SLOTS) {
			violations.push(`Inventory exceeds ${LASER_MAX_INVENTORY_SLOTS} slots (got ${level.inventory.length}).`);
		}

		return { isValid: violations.length === 0, violations: violations };
	}
}

//#endregion

//#region Generator

export class LaserLevelGenerator {
	private readonly _tables: LaserTables;
	private readonly _tracer: LaserBeamTracer;
	private readonly _solver: LaserSolver;
	private readonly _validator: LaserPlacementValidator;

	constructor(tables: LaserTables, tracer: LaserBeamTracer = new LaserBeamTracer(), solver: LaserSolver = new LaserSolver(tracer), validator: LaserPlacementValidator = new LaserPlacementValidator()) {
		this._tables = tables;
		this._tracer = tracer;
		this._solver = solver;
		this._validator = validator;
	}

	public get validator(): LaserPlacementValidator {
		return this._validator;
	}

	/** 해가 존재하는 레벨을 생성한다. 실패하면 undefined */
	public generate(options: LaserGenerationOptions): LaserLevel | undefined {
		const config = options.config ?? this._tables.getDifficultyConfig(options.difficulty);
		if (config === undefined) {
			console.warn(`[LaserLevelGenerator] No difficulty config for difficulty ${options.difficulty}`);
			return undefined;
		}

		// §2 - 인벤토리 슬롯은 최대 5개. 설정이 이를 넘으면 어떤 배치도 검증을 통과할 수 없으므로,
		// 조용히 재시도하지 말고 바로 알린다.
		const requiredSlots = config.beamCount * config.solutionCrystalCount;
		if (requiredSlots > LASER_MAX_INVENTORY_SLOTS) {
			console.warn(`[LaserLevelGenerator] difficulty ${options.difficulty}: the solution needs ${requiredSlots} crystals, exceeding the inventory slot cap of ${LASER_MAX_INVENTORY_SLOTS}. Check the difficulty table.`);
			return undefined;
		}

		const random = options.seed === undefined ? Math.random : createSeededRandom(options.seed);
		const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const level = this.buildCandidate(random, config, options);
			if (level === undefined) {
				continue;
			}
			if (this._validator.validate(level).isValid === false) {
				continue;
			}

			// 인벤토리를 비운 상태에서 이미 풀려 있으면 퍼즐이 성립하지 않는다.
			const board = LaserBoard.fromLevel(level);
			if (this._tracer.traceAndCheck(board).isSolved) {
				continue;
			}

			// §8.3 - 솔버로 검증된 레벨만 출력한다
			if (this._solver.isSolvable(board) === false) {
				continue;
			}

			return level;
		}

		console.warn(`[LaserLevelGenerator] Failed to generate a level for difficulty ${options.difficulty} within ${maxAttempts} attempts`);
		return undefined;
	}

	/** 이미 만들어진 레벨이 배치 규칙과 해의 존재를 만족하는지 확인한다 */
	public verify(level: LaserLevel): LaserValidationResult {
		const result = this._validator.validate(level);
		if (result.isValid === false) {
			return result;
		}

		const board = LaserBoard.fromLevel(level);
		if (this._tracer.traceAndCheck(board).isSolved) {
			return { isValid: false, violations: ['Already cleared before placing any crystal.'] };
		}
		if (this._solver.isSolvable(board) === false) {
			return { isValid: false, violations: ['No solution exists (solver search failed).'] };
		}
		return { isValid: true, violations: [] };
	}

	//#region Internal

	/** 경로를 그려 해를 만들고, 그 크리스탈을 인벤토리로 되돌린다 */
	private buildCandidate(random: RandomSource, config: LaserDifficultyConfig, options: LaserGenerationOptions): LaserLevel | undefined {
		const gimmicks: LaserGimmick[] = [];
		const solutionCrystals: LaserPlacedCrystal[] = [];
		// 기믹/크리스탈이 이미 차지한 칸
		const occupied = new Set<string>();
		// 광선이 지나가는 칸. 여기에 크리스탈을 놓으면 다른 빔의 궤도가 꺾여 해가 깨지므로
		// 크리스탈 배치에서는 제외하지만, 중계체는 이 위에 놓아야 한다 (§3 4.1).
		const pathKeys = new Set<string>();
		const pathCells: LaserCell[] = [];

		const colors = shuffleInPlace(random, BEAM_COLORS.slice());
		const beamCount = Math.max(1, Math.min(config.beamCount, colors.length));

		for (let beamIndex = 0; beamIndex < beamCount; beamIndex++) {
			const built = this.buildBeamPath(random, config, colors[beamIndex], beamIndex, occupied, pathKeys);
			if (built === undefined) {
				return undefined;
			}
			gimmicks.push(built.emitter, built.receiver);
			for (const crystal of built.crystals) {
				solutionCrystals.push(crystal);
			}
			for (const cell of built.pathCells) {
				const key = `${cell.row},${cell.col}`;
				if (pathKeys.has(key) === false) {
					pathKeys.add(key);
					pathCells.push(cell);
				}
			}
		}

		this.placeRelays(random, config, gimmicks, pathCells, occupied);
		this.placeSkulls(random, config, gimmicks, occupied);

		// 해가 실제로 성립하는지 광선 추적으로 확인한다
		const solvedBoard = new LaserBoard(gimmicks.map((gimmick) => gimmick), solutionCrystals.map((crystal) => crystal), []);
		if (this._tracer.traceAndCheck(solvedBoard).isSolved === false) {
			return undefined;
		}

		// 해를 이루던 크리스탈을 인벤토리로 되돌린다 (역방향으로 흐트러뜨리기)
		const inventory: LaserCrystal[] = solutionCrystals.map((crystal) => ({
			id: crystal.id,
			type: crystal.type,
			corner: crystal.corner,
			blockedSide: crystal.blockedSide,
		}));

		// §3 3.3 - 여분 크리스탈. 슬롯 상한(5개)을 넘지 않게 채운다
		const spareCount = Math.min(config.spareCrystalCount, LASER_MAX_INVENTORY_SLOTS - inventory.length);
		for (let index = 0; index < spareCount; index++) {
			inventory.push(this.makeSpareCrystal(random, index));
		}
		shuffleInPlace(random, inventory);

		return {
			puzzleId: options.puzzleId,
			difficulty: options.difficulty,
			gimmicks: gimmicks,
			presetCrystals: [],
			inventory: inventory,
		};
	}

	/**
	 * 발사체에서 시작해 꺾어가며 수신체까지 이어지는 경로를 만든다.
	 * 꺾이는 칸마다 그 꺾임을 만들어내는 삼각형 크리스탈을 놓는다.
	 */
	private buildBeamPath(random: RandomSource, config: LaserDifficultyConfig, color: ELaserColor, beamIndex: number, occupied: Set<string>, pathKeys: Set<string>): { emitter: LaserGimmick, receiver: LaserGimmick, crystals: LaserPlacedCrystal[], pathCells: LaserCell[] } | undefined {
		const start = this.pickEmitterCell(random, occupied, pathKeys);
		if (start === undefined) {
			return undefined;
		}

		const direction = getInwardDirection(start.row, start.col);
		if (direction === undefined) {
			return undefined;
		}

		const crystals: LaserPlacedCrystal[] = [];
		const pathCells: LaserCell[] = [];
		// 다른 빔의 경로도 막아 둔다. 그 위에 크리스탈을 놓으면 그 빔의 궤도가 꺾여 해가 깨진다.
		const localOccupied = new Set<string>(occupied);
		for (const key of Array.from(pathKeys)) {
			localOccupied.add(key);
		}
		localOccupied.add(`${start.row},${start.col}`);

		let node: PathNode = { row: start.row, col: start.col, direction: direction };

		for (let turn = 0; turn < config.solutionCrystalCount; turn++) {
			const turnCell = this.pickTurnCell(random, node, localOccupied, pathCells);
			if (turnCell === undefined) {
				return undefined;
			}

			// 꺾일 방향은 현재 진행 방향과 수직인 두 방향 중 하나
			const perpendicular = shuffleInPlace(random, ORTHOGONAL_DIRECTIONS.filter((candidate) =>
				this.isPerpendicular(candidate, node.direction)));

			let placed = false;
			for (const outgoing of perpendicular) {
				const corner = this.findTriangleCorner(node.direction, outgoing);
				if (corner === undefined) {
					continue;
				}

				crystals.push({
					id: `SOL_${beamIndex}_${turn}`,
					type: ECrystalType.TRIANGLE,
					corner: corner,
					row: toPlacementLocalIndex(turnCell.row),
					col: toPlacementLocalIndex(turnCell.col),
					isFixed: false,
				});
				localOccupied.add(`${turnCell.row},${turnCell.col}`);
				node = { row: turnCell.row, col: turnCell.col, direction: outgoing };
				placed = true;
				break;
			}

			if (placed === false) {
				return undefined;
			}
		}

		// 마지막 꺾임 이후 직진해 테두리로 빠져나가는 칸이 수신체 자리다
		const exit = this.walkToBorder(node, localOccupied, pathCells);
		if (exit === undefined) {
			return undefined;
		}

		const emitter: LaserGimmick = {
			id: `EMIT_${color}_${beamIndex}`,
			type: EGimmickType.EMITTER,
			row: start.row,
			col: start.col,
			colors: [color],
		};
		const receiver: LaserGimmick = {
			id: `RECV_${color}_${beamIndex}`,
			type: EGimmickType.RECEIVER,
			row: exit.row,
			col: exit.col,
			colors: [color],
		};

		occupied.add(`${start.row},${start.col}`);
		occupied.add(`${exit.row},${exit.col}`);
		for (const crystal of crystals) {
			occupied.add(`${toFullGridIndex(crystal.row)},${toFullGridIndex(crystal.col)}`);
		}

		return { emitter: emitter, receiver: receiver, crystals: crystals, pathCells: pathCells };
	}

	/** 꼭짓점을 제외한 테두리에서 아직 비어 있는 칸 하나 */
	private pickEmitterCell(random: RandomSource, occupied: Set<string>, pathKeys: Set<string>): LaserCell | undefined {
		const candidates: LaserCell[] = [];
		const last = LASER_PLACEMENT_GRID_SIZE + 1;
		for (let index = 1; index < last; index++) {
			candidates.push({ row: 0, col: index });
			candidates.push({ row: last, col: index });
			candidates.push({ row: index, col: 0 });
			candidates.push({ row: index, col: last });
		}

		shuffleInPlace(random, candidates);
		return candidates.find((cell) => {
			const key = `${cell.row},${cell.col}`;
			return occupied.has(key) === false && pathKeys.has(key) === false;
		});
	}

	/** 현재 진행 방향으로 1칸 이상 나아간 지점 중, 크리스탈을 놓을 수 있는 칸 */
	private pickTurnCell(random: RandomSource, node: PathNode, occupied: Set<string>, pathCells: LaserCell[]): LaserCell | undefined {
		const delta = getDirectionDelta(node.direction);
		const candidates: LaserCell[] = [];
		const walked: LaserCell[] = [];

		let row = node.row + delta.row;
		let col = node.col + delta.col;
		while (isInsideFullGrid(row, col)) {
			if (isInsidePlacementArea(toPlacementLocalIndex(row), toPlacementLocalIndex(col)) === false) {
				break;
			}
			if (occupied.has(`${row},${col}`)) {
				break;
			}
			candidates.push({ row: row, col: col });
			row += delta.row;
			col += delta.col;
		}

		if (candidates.length === 0) {
			return undefined;
		}

		const chosen = pickRandom(random, candidates);
		// 꺾임 지점 앞까지 지나온 칸들을 경로로 기록한다 (중계체 후보)
		row = node.row + delta.row;
		col = node.col + delta.col;
		while (row !== chosen.row || col !== chosen.col) {
			walked.push({ row: row, col: col });
			row += delta.row;
			col += delta.col;
		}
		for (const cell of walked) {
			pathCells.push(cell);
		}
		return chosen;
	}

	/** 현재 방향으로 직진해 테두리에 닿는 칸을 찾는다 */
	private walkToBorder(node: PathNode, occupied: Set<string>, pathCells: LaserCell[]): LaserCell | undefined {
		const delta = getDirectionDelta(node.direction);
		let row = node.row + delta.row;
		let col = node.col + delta.col;

		while (isInsideFullGrid(row, col)) {
			if (isBorderCell(row, col)) {
				if (occupied.has(`${row},${col}`)) {
					return undefined;
				}
				// 꼭짓점은 수신체 자리로 쓰지 않는다
				if (getInwardDirection(row, col) === undefined) {
					return undefined;
				}
				return { row: row, col: col };
			}
			if (occupied.has(`${row},${col}`)) {
				return undefined;
			}
			pathCells.push({ row: row, col: col });
			row += delta.row;
			col += delta.col;
		}
		return undefined;
	}

	/** 중계체는 광선이 지나가는 빈 칸 위에 놓는다 - §3 4.1 */
	private placeRelays(random: RandomSource, config: LaserDifficultyConfig, gimmicks: LaserGimmick[], pathCells: LaserCell[], occupied: Set<string>): void {
		const candidates = shuffleInPlace(random, pathCells.filter((cell) =>
			occupied.has(`${cell.row},${cell.col}`) === false && isBorderCell(cell.row, cell.col) === false));

		const emitterColors = gimmicks
			.filter((gimmick) => gimmick.type === EGimmickType.EMITTER)
			.map((gimmick) => gimmick.colors[0]);

		let placed = 0;
		for (const cell of candidates) {
			if (placed >= config.relayCount) {
				break;
			}
			// pathCells 는 중복될 수 있으므로 배치 직전에 다시 확인한다
			if (occupied.has(`${cell.row},${cell.col}`)) {
				continue;
			}
			const index = placed;
			placed++;
			gimmicks.push({
				id: `RELAY_${index}`,
				type: EGimmickType.RELAY,
				row: cell.row,
				col: cell.col,
				// §4.1.1 - 중계체는 여러 색을 지닐 수 있다. 모든 발사체 색을 인정한다.
				colors: emitterColors.slice(),
			});
			occupied.add(`${cell.row},${cell.col}`);
		}
	}

	/** 해골은 광선 경로 밖에 놓는다 - §3 4.2 */
	private placeSkulls(random: RandomSource, config: LaserDifficultyConfig, gimmicks: LaserGimmick[], occupied: Set<string>): void {
		const candidates: LaserCell[] = [];
		for (let row = 0; row < LASER_PLACEMENT_GRID_SIZE; row++) {
			for (let col = 0; col < LASER_PLACEMENT_GRID_SIZE; col++) {
				const fullRow = toFullGridIndex(row);
				const fullCol = toFullGridIndex(col);
				if (occupied.has(`${fullRow},${fullCol}`) === false) {
					candidates.push({ row: fullRow, col: fullCol });
				}
			}
		}

		shuffleInPlace(random, candidates);
		for (let index = 0; index < config.skullCount && index < candidates.length; index++) {
			const cell = candidates[index];
			gimmicks.push({
				id: `SKULL_${index}`,
				type: EGimmickType.SKULL,
				row: cell.row,
				col: cell.col,
				colors: [],
			});
			occupied.add(`${cell.row},${cell.col}`);
		}
	}

	/** 여분 크리스탈 - 해에 필요 없지만 인벤토리에 섞여 들어간다 (§3 3.3) */
	private makeSpareCrystal(random: RandomSource, index: number): LaserCrystal {
		const types = [ECrystalType.TRIANGLE, ECrystalType.TEE, ECrystalType.FLOWER, ECrystalType.CROSS, ECrystalType.OCTAGON];
		const type = pickRandom(random, types);

		if (type === ECrystalType.TRIANGLE) {
			const corners = [ETriangleCorner.TOP_LEFT, ETriangleCorner.TOP_RIGHT, ETriangleCorner.BOTTOM_LEFT, ETriangleCorner.BOTTOM_RIGHT];
			return { id: `SPARE_${index}`, type: type, corner: pickRandom(random, corners) };
		}
		if (type === ECrystalType.TEE) {
			const sides = [ETeeBlockedSide.BLOCKED_UP, ETeeBlockedSide.BLOCKED_DOWN, ETeeBlockedSide.BLOCKED_LEFT, ETeeBlockedSide.BLOCKED_RIGHT];
			return { id: `SPARE_${index}`, type: type, blockedSide: pickRandom(random, sides) };
		}
		return { id: `SPARE_${index}`, type: type };
	}

	/**
	 * `incoming` 으로 들어온 광선을 `outgoing` 으로 내보내는 삼각형 방향을 찾는다.
	 * 4가지 방향을 직접 대입해 확인하므로 기하 계산과 항상 일치한다.
	 */
	private findTriangleCorner(incoming: ELaserDirection, outgoing: ELaserDirection): ETriangleCorner | undefined {
		const corners = [ETriangleCorner.TOP_LEFT, ETriangleCorner.TOP_RIGHT, ETriangleCorner.BOTTOM_LEFT, ETriangleCorner.BOTTOM_RIGHT];
		for (const corner of corners) {
			const outputs = reflectTriangle(corner, incoming);
			if (outputs.length === 1 && outputs[0] === outgoing) {
				return corner;
			}
		}
		return undefined;
	}

	private isPerpendicular(left: ELaserDirection, right: ELaserDirection): boolean {
		const leftDelta = getDirectionDelta(left);
		const rightDelta = getDirectionDelta(right);
		return leftDelta.row * rightDelta.row + leftDelta.col * rightDelta.col === 0;
	}

	//#endregion
}

//#endregion

/** 생성 결과를 한 줄 요약으로 남기는 디버그 헬퍼 */
export function describeLaserLevel(level: LaserLevel): string {
	const emitters = level.gimmicks.filter((gimmick) => gimmick.type === EGimmickType.EMITTER).length;
	const relays = level.gimmicks.filter((gimmick) => gimmick.type === EGimmickType.RELAY).length;
	const skulls = level.gimmicks.filter((gimmick) => gimmick.type === EGimmickType.SKULL).length;
	return `${level.puzzleId} D${level.difficulty} beams=${emitters} relays=${relays} skulls=${skulls} inventory=${level.inventory.length}`;
}
