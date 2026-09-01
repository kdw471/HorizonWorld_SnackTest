/**
 * Switch Level Generator - 역셔플 생성기 (PUZ_08 §9.4)
 *
 * 사양 §9.4 (반드시 이 방식):
 *   "목표 상태(모두 1)에서 시작해, 임의의 유효 칸을 K번 눌러 역방향으로 흐트러뜨린다.
 *    토글이 자기역원이므로 이렇게 만든 배치는 항상 K수 이내로 풀 수 있다.
 *    무작위 0/1 배열은 마스크·판 형태에 따라 해가 없을 수 있으므로 사용 금지."
 *
 * 셔플 자체는 `SwitchBoard.shuffleFromSolved()` 가 수행한다 (서로 다른 칸 K개).
 * 여기서는 테이블에서 값을 읽어 레벨을 만들고, GF(2) 솔버로 결과를 재검증한다.
 *
 * 주의: 누른 칸 집합이 토글 행렬의 커널(kernel)에 들어가면 K번 눌렀는데도
 * 완성 상태 그대로일 수 있다 (예: 가로줄 마스크로 한 줄의 세 칸을 모두 누름).
 * 그래서 생성 후 "이미 완성 아님 + 해 존재"를 확인하고 아니면 재시도한다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { SwitchBoard } from 'Switch_Board';
import { SwitchDifficultyConfig, SwitchFieldTableEntry, SwitchPuzzleTables, validateFieldData } from 'Switch_DataTables';
import { SwitchSolver } from 'Switch_Solver';
import {
	ESwitchCellState,
	RandomSource,
	SWITCH_CELL_COUNT,
	SwitchLevel,
	SwitchValidationResult,
	createGridFromLayout,
	createSeededRandom,
	getMaskViolations,
	getUsablePositions,
	isGridSolved,
	parseKeyLayout,
	pickRandom,
} from 'Switch_Definitions';

export type SwitchGenerationOptions = {
	puzzleId?: string,
	difficulty: number,
	seed?: number,
	config?: SwitchDifficultyConfig,
	/** 특정 필드 데이터를 지정하고 싶을 때 */
	fieldIndex?: number,
	/** 재시도 횟수 상한 (커널 상쇄로 완성 상태가 나온 경우 대비) */
	maxAttempts?: number,
}

const DEFAULT_MAX_ATTEMPTS = 20;

//#region Validator

export class SwitchPlacementValidator {
	private readonly _solver: SwitchSolver;

	constructor(solver: SwitchSolver = new SwitchSolver()) {
		this._solver = solver;
	}

	public validate(level: SwitchLevel): SwitchValidationResult {
		const violations: string[] = [];

		if (level.grid.length !== SWITCH_CELL_COUNT) {
			violations.push(`Grid length is ${level.grid.length} but should be 5x5 = ${SWITCH_CELL_COUNT}.`);
			return { isValid: false, violations: violations };
		}

		for (const cell of level.grid) {
			if (cell !== ESwitchCellState.FREE && cell !== ESwitchCellState.UNPRESSED && cell !== ESwitchCellState.PRESSED) {
				violations.push(`Grid contains a disallowed value ${cell}.`);
				break;
			}
		}

		violations.push(...getMaskViolations(level.mask));

		const usableCount = getUsablePositions(level.grid).length;
		if (usableCount < 2) {
			violations.push(`At least 2 key caps are required for a valid puzzle (got ${usableCount}).`);
		}

		// 시작부터 완성되어 있으면 퍼즐이 성립하지 않는다
		if (isGridSolved(level.grid)) {
			violations.push('Already completed at start.');
		}

		if (violations.length > 0) {
			return { isValid: false, violations: violations };
		}

		// §9.4 - 반드시 풀 수 있는 배치여야 한다 (GF(2) 솔버로 재검증)
		const solution = this._solver.solve(level.grid, level.mask);
		if (solution.isSolvable === false) {
			violations.push('Unsolvable layout. Random 0/1 arrays must not be used.');
		}
		else if (solution.isMinimal && solution.pressCount > level.shuffleCount) {
			// 역셔플 배치의 최소 해는 K 이하여야 한다 - 넘으면 셔플 로직이 깨진 것이다
			violations.push(`Minimum solution of ${solution.pressCount} presses exceeds the reverse-shuffle count K=${level.shuffleCount}.`);
		}

		return { isValid: violations.length === 0, violations: violations };
	}
}

//#endregion

//#region Generator

export class SwitchLevelGenerator {
	private readonly _tables: SwitchPuzzleTables;
	private readonly _validator: SwitchPlacementValidator;
	private readonly _solver: SwitchSolver;

	constructor(tables: SwitchPuzzleTables, validator?: SwitchPlacementValidator, solver: SwitchSolver = new SwitchSolver()) {
		this._tables = tables;
		this._solver = solver;
		this._validator = validator ?? new SwitchPlacementValidator(solver);
	}

	public get validator(): SwitchPlacementValidator {
		return this._validator;
	}

	public get solver(): SwitchSolver {
		return this._solver;
	}

	public generate(options: SwitchGenerationOptions): SwitchLevel | undefined {
		const config = options.config ?? this._tables.getDifficultyConfig(options.difficulty);
		if (config === undefined) {
			console.warn(`[SwitchLevelGenerator] No difficulty config for difficulty ${options.difficulty}`);
			return undefined;
		}

		const random: RandomSource = options.seed === undefined ? Math.random : createSeededRandom(options.seed);

		const fieldIndex = options.fieldIndex ?? (config.fieldIndexes.length > 0 ? pickRandom(random, config.fieldIndexes) : undefined);
		if (fieldIndex === undefined) {
			console.warn(`[SwitchLevelGenerator] No field data linked to difficulty ${options.difficulty}.`);
			return undefined;
		}

		const field = this._tables.getField(fieldIndex);
		if (field === undefined) {
			console.warn(`[SwitchLevelGenerator] Field data index ${fieldIndex} not found.`);
			return undefined;
		}

		// 설정이 규격을 위반하면 조용히 재시도하지 말고 바로 알린다
		const fieldViolations = validateFieldData(field, this._tables);
		if (fieldViolations.length > 0) {
			console.warn(`[SwitchLevelGenerator] Field data error (index ${field.index}): ${fieldViolations.join(' / ')}`);
			return undefined;
		}

		const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const level = this.buildLevel(random, field);
			if (level === undefined) {
				continue;
			}
			if (options.puzzleId !== undefined) {
				level.puzzleId = options.puzzleId;
			}

			// 커널 상쇄로 완성 상태가 나왔거나 해 검증에 실패하면 다시 섞는다
			if (this._validator.validate(level).isValid === false) {
				continue;
			}
			return level;
		}

		console.warn(`[SwitchLevelGenerator] Failed to generate a level for difficulty ${options.difficulty} within ${maxAttempts} attempts`);
		return undefined;
	}

	public verify(level: SwitchLevel): SwitchValidationResult {
		return this._validator.validate(level);
	}

	//#region Internal

	private buildLevel(random: RandomSource, field: SwitchFieldTableEntry): SwitchLevel | undefined {
		const usable = parseKeyLayout(field.layoutRows);
		const mask = this._tables.getMask(field.switchAreaId);
		if (usable === undefined || mask === undefined) {
			return undefined;
		}

		// §9.4 - 목표 상태(모두 눌림)에서 서로 다른 칸 K개를 눌러 역방향으로 흐트러뜨린다
		const grid = createGridFromLayout(usable, ESwitchCellState.PRESSED);
		const board = new SwitchBoard(grid, mask, 0, 0);
		const presses = board.shuffleFromSolved(random, field.shuffleCount);

		return board.toLevel(field.puzzleId, field.difficulty, field.switchAreaId, field.shuffleCount, presses);
	}

	//#endregion
}

//#endregion

/** 생성 결과를 한 줄 요약으로 남기는 디버그 헬퍼 */
export function describeSwitchLevel(level: SwitchLevel): string {
	const usableCount = getUsablePositions(level.grid).length;
	return `${level.puzzleId} D${level.difficulty} area=${level.switchAreaId} cells=${usableCount} K=${level.shuffleCount}`;
}
