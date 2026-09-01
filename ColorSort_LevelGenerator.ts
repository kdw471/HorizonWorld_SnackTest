/**
 * Color Sort Level Generator - 항상 풀 수 있는 배치만 출력하는 생성기 (PUZ_03 §10.4)
 *
 * 사양 §10.4:
 *   "완성 상태(각 케이스가 같은 색 4개로 채워짐)에서 역방향으로 유효 이동을 N회 수행해 셔플한다.
 *    이렇게 하면 항상 해가 존재한다.
 *    블랙 오브젝트는 셔플 완료 후, 최상단이 아닌 위치의 건전지들 중 일부를 UNKNOWN 으로 마스킹해 생성한다."
 *
 * ## 주의: "유효 이동을 역방향으로" 를 그대로 하면 안 된다
 *
 * 이 퍼즐의 이동은 **가역적이지 않다**. 최상단 동일색 런이 통째로 움직이므로,
 * A 에서 B 로 옮긴 뒤 B 에서 A 로 되돌리는 수가 규칙상 불가능한 경우가 많다.
 * 따라서 완성 상태에서 "정방향 유효 이동"을 아무거나 반복하면
 * 완성 상태로 되돌아올 수 없는 배치가 나올 수 있다.
 *
 * 그래서 이 생성기는 **역이동(reverse move)** 을 직접 정의해 적용한다.
 * 역이동은 "그것을 되돌리는 정방향 이동이 반드시 합법이 되도록" 조건을 걸고 수행한다.
 *
 *   B 에서 k 개(색 c)를 꺼내 A 위에 올린다. 단,
 *     - k <= min(3, B 의 최상단 런 길이)                      … 정방향 이동 개수 제한 (§6)
 *     - k < 런 길이  또는  k == B 의 전체 개수                 … 꺼낸 뒤에도 B 의 최상단이 c 이거나 B 가 빈다
 *     - A 는 비어 있거나 A 의 최상단 색 != c                    … 올린 뒤 A 의 최상단 런이 정확히 k 가 된다
 *     - A 의 잔여 공간 >= k                                     … §6
 *
 *   이 조건이면 역이동 직후의 상태에서 정방향 이동 A -> B 가 항상 합법이고,
 *   그 결과가 역이동 직전 상태이므로 완성 상태까지의 경로가 보장된다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { ColorSortBoard, createCases } from 'ColorSort_Board';
import { ColorSortDifficultyConfig, ColorSortTables, validateDifficultyConfig } from 'ColorSort_DataTables';
import { ColorSortSolver } from 'ColorSort_Solver';
import {
	ALL_BATTERY_COLORS,
	Battery,
	BatteryCase,
	CASE_CAPACITY,
	ColorSortLevel,
	ColorSortValidationResult,
	EBatteryColor,
	MAX_MOVE_RUN,
	MAX_SPARE_CASE_COUNT,
	MIN_SPARE_CASE_COUNT,
	RandomSource,
	TOTAL_CASE_COUNT,
	createSeededRandom,
	getTopBattery,
	isCaseComplete,
	randomInt,
	shuffleInPlace,
} from 'ColorSort_Definitions';

export type ColorSortGenerationOptions = {
	puzzleId: string,
	difficulty: number,
	seed?: number,
	maxAttempts?: number,
	config?: ColorSortDifficultyConfig,
}

const DEFAULT_MAX_ATTEMPTS = 60;

//#region Validator

export class ColorSortPlacementValidator {
	public validate(level: ColorSortLevel): ColorSortValidationResult {
		const violations: string[] = [];

		if (level.cases.length !== TOTAL_CASE_COUNT) {
			violations.push(`There must be ${TOTAL_CASE_COUNT} cases (got ${level.cases.length}).`);
		}

		let activeCount = 0;
		let emptyActiveCount = 0;
		const colorCounts = new Map<EBatteryColor, number>();

		for (const batteryCase of level.cases) {
			if (batteryCase.isActive === false) {
				if (batteryCase.batteries.length > 0) {
					violations.push(`Inactive case '${batteryCase.id}' contains batteries.`);
				}
				continue;
			}

			activeCount++;
			if (batteryCase.batteries.length === 0) {
				emptyActiveCount++;
			}
			if (batteryCase.batteries.length > batteryCase.capacity) {
				violations.push(`Case '${batteryCase.id}' exceeds its capacity of ${batteryCase.capacity}.`);
			}

			for (const battery of batteryCase.batteries) {
				colorCounts.set(battery.color, (colorCounts.get(battery.color) ?? 0) + 1);
			}

			// §7 - 블랙 건전지는 최상단에 위치할 수 없다
			const top = getTopBattery(batteryCase);
			if (top !== undefined && top.isRevealed === false) {
				violations.push(`Black battery '${top.id}' is on top of case '${batteryCase.id}'.`);
			}
		}

		// §4 - 여분(빈) 케이스는 최소 1개, 최대 6개
		if (emptyActiveCount < MIN_SPARE_CASE_COUNT || emptyActiveCount > MAX_SPARE_CASE_COUNT) {
			violations.push(`Spare cases must be ${MIN_SPARE_CASE_COUNT}~${MAX_SPARE_CASE_COUNT} (got ${emptyActiveCount}).`);
		}

		// 색상별 개수는 정확히 정원(4)의 배수여야 정렬이 끝날 수 있다
		for (const entry of Array.from(colorCounts.entries())) {
			if (entry[1] !== CASE_CAPACITY) {
				violations.push(`Color ${entry[0]} has ${entry[1]} batteries; exactly ${CASE_CAPACITY} are required.`);
			}
		}

		if (activeCount === 0) {
			violations.push('There are no active cases.');
		}

		return { isValid: violations.length === 0, violations: violations };
	}
}

//#endregion

//#region Generator

export class ColorSortLevelGenerator {
	private readonly _tables: ColorSortTables;
	private readonly _solver: ColorSortSolver;
	private readonly _validator: ColorSortPlacementValidator;

	constructor(tables: ColorSortTables, solver: ColorSortSolver = new ColorSortSolver(), validator: ColorSortPlacementValidator = new ColorSortPlacementValidator()) {
		this._tables = tables;
		this._solver = solver;
		this._validator = validator;
	}

	public get validator(): ColorSortPlacementValidator {
		return this._validator;
	}

	public generate(options: ColorSortGenerationOptions): ColorSortLevel | undefined {
		const config = options.config ?? this._tables.getDifficultyConfig(options.difficulty);
		if (config === undefined) {
			console.warn(`[ColorSortLevelGenerator] No difficulty config for difficulty ${options.difficulty}`);
			return undefined;
		}

		// 설정 자체가 사양을 위반하면 조용히 재시도하지 말고 바로 알린다
		const configViolations = validateDifficultyConfig(config);
		if (configViolations.length > 0) {
			console.warn(`[ColorSortLevelGenerator] Invalid config for difficulty ${options.difficulty}: ${configViolations.join(' / ')}`);
			return undefined;
		}

		const random = options.seed === undefined ? Math.random : createSeededRandom(options.seed);
		const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const cases = this.buildSolvedState(config);
			this.applyReverseShuffle(random, cases, config.shuffleMoveCount);

			// 셔플이 아무 효과가 없었으면 (이미 완성 상태) 버린다
			const board = new ColorSortBoard(cases);
			if (board.isSolved()) {
				continue;
			}

			this.maskUnknownBatteries(random, cases, config.unknownBatteryCount);

			const level: ColorSortLevel = {
				puzzleId: options.puzzleId,
				difficulty: options.difficulty,
				cases: cases,
				colorCount: config.colorCount,
			};

			if (this._validator.validate(level).isValid === false) {
				continue;
			}

			// 마스킹이 시작부터 데드락을 만들 수 있으므로 확인한다 - §2 / §10.3
			const maskedBoard = ColorSortBoard.fromLevel(level);
			if (maskedBoard.isSolved() || maskedBoard.isDeadlocked()) {
				continue;
			}

			// 마스킹으로 런이 끊겨 해가 사라졌을 수 있으므로 솔버로 최종 확인한다
			if (this._solver.isSolvable(maskedBoard) === false) {
				continue;
			}

			return level;
		}

		console.warn(`[ColorSortLevelGenerator] Failed to generate a level for difficulty ${options.difficulty} within ${maxAttempts} attempts`);
		return undefined;
	}

	public verify(level: ColorSortLevel): ColorSortValidationResult {
		const result = this._validator.validate(level);
		if (result.isValid === false) {
			return result;
		}

		const board = ColorSortBoard.fromLevel(level);
		if (board.isSolved()) {
			return { isValid: false, violations: ['Already sorted at start.'] };
		}
		if (board.isDeadlocked()) {
			return { isValid: false, violations: ['No battery can move at start (deadlock).'] };
		}
		if (this._solver.isSolvable(board) === false) {
			return { isValid: false, violations: ['No solution exists (solver search failed).'] };
		}
		return { isValid: true, violations: [] };
	}

	//#region Internal

	/** 완성 상태 - 활성 케이스마다 같은 색 4개, 여분 케이스는 빈 상태 */
	private buildSolvedState(config: ColorSortDifficultyConfig): BatteryCase[] {
		const activeCount = config.colorCount + config.spareCaseCount;
		const cases = createCases(activeCount, TOTAL_CASE_COUNT, CASE_CAPACITY);

		for (let colorIndex = 0; colorIndex < config.colorCount; colorIndex++) {
			const color = ALL_BATTERY_COLORS[colorIndex];
			for (let slot = 0; slot < CASE_CAPACITY; slot++) {
				const battery: Battery = {
					id: `BAT_${color}_${slot}`,
					color: color,
					isRevealed: true,
				};
				cases[colorIndex].batteries.push(battery);
			}
		}

		return cases;
	}

	/**
	 * 역이동을 N회 적용해 흐트러뜨린다.
	 * 각 역이동은 그것을 되돌리는 정방향 이동이 합법임을 보장하므로, 결과는 반드시 풀 수 있다.
	 */
	private applyReverseShuffle(random: RandomSource, cases: BatteryCase[], moveCount: number): void {
		for (let step = 0; step < moveCount; step++) {
			const candidates = this.collectReverseMoves(cases);
			if (candidates.length === 0) {
				return;
			}
			const chosen = candidates[randomInt(random, 0, candidates.length - 1)];
			const moved = cases[chosen.fromIndex].batteries.splice(
				cases[chosen.fromIndex].batteries.length - chosen.count, chosen.count);
			for (const battery of moved) {
				cases[chosen.toIndex].batteries.push(battery);
			}
		}
	}

	/** 지금 적용할 수 있는 역이동 목록 */
	private collectReverseMoves(cases: BatteryCase[]): { fromIndex: number, toIndex: number, count: number }[] {
		const moves: { fromIndex: number, toIndex: number, count: number }[] = [];

		for (const source of cases) {
			if (source.isActive === false || source.batteries.length === 0) {
				continue;
			}

			const top = source.batteries[source.batteries.length - 1];
			let runLength = 1;
			for (let index = source.batteries.length - 2; index >= 0; index--) {
				if (source.batteries[index].color !== top.color) {
					break;
				}
				runLength++;
			}

			const maxCount = Math.min(runLength, MAX_MOVE_RUN);
			for (let count = 1; count <= maxCount; count++) {
				// 꺼낸 뒤에도 출발 케이스의 최상단이 같은 색이거나, 출발 케이스가 완전히 비어야 한다.
				// 그래야 되돌리는 정방향 이동의 목적지 조건(비었거나 최상단 색 동일)이 성립한다.
				const emptiesSource = count === source.batteries.length;
				if (count >= runLength && emptiesSource === false) {
					continue;
				}

				for (const destination of cases) {
					if (destination.isActive === false || destination.index === source.index) {
						continue;
					}
					if (destination.capacity - destination.batteries.length < count) {
						continue;
					}
					// 올린 뒤 목적지의 최상단 런이 정확히 count 가 되어야 한다.
					// (되돌리는 정방향 이동이 정확히 count 개를 옮기도록)
					const destinationTop = getTopBattery(destination);
					if (destinationTop !== undefined && destinationTop.color === top.color) {
						continue;
					}

					moves.push({ fromIndex: source.index, toIndex: destination.index, count: count });
				}
			}
		}

		return moves;
	}

	/**
	 * 최상단이 아닌 건전지 일부를 블랙(미지)으로 마스킹한다 - §7 / §10.4.
	 * 완성되어 닫힌 케이스는 건드리지 않는다.
	 */
	private maskUnknownBatteries(random: RandomSource, cases: BatteryCase[], unknownCount: number): void {
		if (unknownCount <= 0) {
			return;
		}

		const candidates: Battery[] = [];
		for (const batteryCase of cases) {
			if (batteryCase.isActive === false || isCaseComplete(batteryCase)) {
				continue;
			}
			// 최상단(마지막 원소)은 제외한다 - 블랙은 최상단에 위치할 수 없다
			for (let index = 0; index < batteryCase.batteries.length - 1; index++) {
				candidates.push(batteryCase.batteries[index]);
			}
		}

		shuffleInPlace(random, candidates);
		const count = Math.min(unknownCount, candidates.length);
		for (let index = 0; index < count; index++) {
			candidates[index].isRevealed = false;
		}
	}

	//#endregion
}

//#endregion

/** 생성 결과를 한 줄 요약으로 남기는 디버그 헬퍼 */
export function describeColorSortLevel(level: ColorSortLevel): string {
	let batteries = 0;
	let unknowns = 0;
	let active = 0;
	let empty = 0;

	for (const batteryCase of level.cases) {
		if (batteryCase.isActive === false) {
			continue;
		}
		active++;
		if (batteryCase.batteries.length === 0) {
			empty++;
		}
		for (const battery of batteryCase.batteries) {
			batteries++;
			if (battery.isRevealed === false) {
				unknowns++;
			}
		}
	}

	return `${level.puzzleId} D${level.difficulty} colors=${level.colorCount} active=${active} spare=${empty} batteries=${batteries} unknown=${unknowns}`;
}
