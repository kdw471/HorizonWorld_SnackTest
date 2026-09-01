/**
 * Slide Puzzle Level Generator - 역순 셔플 생성기 (PUZ_07 §8 / §12.2)
 *
 * 사양 §8:
 *   "이미지 조각은 완성 상태에서 역순으로 섞는다.
 *    직전에 이동한 위치로는 이동되지 않는다.
 *    섞는 횟수(N)는 테이블 변수(iShuffleNum)로 지정한다."
 *
 *   "이 방식은 항상 풀 수 있는(solvable) 배치를 보장한다.
 *    무작위 순열 셔플을 사용하면 절반이 풀 수 없는 배치가 되므로 절대 사용하지 말 것."
 *
 * 셔플 자체는 `SlidePuzzleBoard.shuffle()` 이 수행한다.
 * 여기서는 테이블에서 값을 읽어 레벨을 만들고, 결과가 실제로 풀 수 있는지 확인한다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { SlidePuzzleBoard } from 'SlidePuzzle_Board';
import { SlideDifficultyConfig, SlideFieldTableEntry, SlidePuzzleTables, validateFieldData } from 'SlidePuzzle_DataTables';
import {
	RandomSource,
	SlidePuzzleLevel,
	SlidePuzzleValidationResult,
	createSeededRandom,
	isBoardSolvable,
	isBoardSolved,
	pickRandom,
} from 'SlidePuzzle_Definitions';

export type SlideGenerationOptions = {
	puzzleId?: string,
	difficulty: number,
	seed?: number,
	config?: SlideDifficultyConfig,
	/** 특정 필드 데이터를 지정하고 싶을 때 */
	fieldIndex?: number,
	/** 재시도 횟수 상한 (섞었는데 완성 상태로 돌아온 경우 대비) */
	maxAttempts?: number,
}

const DEFAULT_MAX_ATTEMPTS = 20;

//#region Validator

export class SlidePlacementValidator {
	public validate(level: SlidePuzzleLevel): SlidePuzzleValidationResult {
		const violations: string[] = [];

		const expectedLength = level.divideNum * level.divideNum;
		if (level.board.length !== expectedLength) {
			violations.push(`Board length is ${level.board.length} but should be ${level.divideNum}x${level.divideNum} = ${expectedLength}.`);
			return { isValid: false, violations: violations };
		}

		// 0 부터 n*n-1 까지의 값이 정확히 한 번씩 있어야 한다
		const seen = new Set<number>();
		for (const value of level.board) {
			if (value < 0 || value >= expectedLength) {
				violations.push(`Board contains an out-of-range value ${value}.`);
				continue;
			}
			if (seen.has(value)) {
				violations.push(`Board contains a duplicated value ${value}.`);
			}
			seen.add(value);
		}
		if (seen.size !== expectedLength) {
			violations.push(`Board is missing values (${seen.size} / ${expectedLength}).`);
		}

		// 시작부터 완성되어 있으면 퍼즐이 성립하지 않는다
		if (isBoardSolved(level.board)) {
			violations.push('Already completed at start.');
		}

		// §8 - 반드시 풀 수 있는 배치여야 한다
		if (isBoardSolvable(level.board, level.divideNum) === false) {
			violations.push('Unsolvable layout. Random permutation shuffles must not be used.');
		}

		return { isValid: violations.length === 0, violations: violations };
	}
}

//#endregion

//#region Generator

export class SlidePuzzleLevelGenerator {
	private readonly _tables: SlidePuzzleTables;
	private readonly _validator: SlidePlacementValidator;

	constructor(tables: SlidePuzzleTables, validator: SlidePlacementValidator = new SlidePlacementValidator()) {
		this._tables = tables;
		this._validator = validator;
	}

	public get validator(): SlidePlacementValidator {
		return this._validator;
	}

	public generate(options: SlideGenerationOptions): SlidePuzzleLevel | undefined {
		const config = options.config ?? this._tables.getDifficultyConfig(options.difficulty);
		if (config === undefined) {
			console.warn(`[SlidePuzzleLevelGenerator] No difficulty config for difficulty ${options.difficulty}`);
			return undefined;
		}

		const random: RandomSource = options.seed === undefined ? Math.random : createSeededRandom(options.seed);

		const fieldIndex = options.fieldIndex ?? (config.fieldIndexes.length > 0 ? pickRandom(random, config.fieldIndexes) : undefined);
		if (fieldIndex === undefined) {
			console.warn(`[SlidePuzzleLevelGenerator] No field data linked to difficulty ${options.difficulty}.`);
			return undefined;
		}

		const field = this._tables.getField(fieldIndex);
		if (field === undefined) {
			console.warn(`[SlidePuzzleLevelGenerator] Field data index ${fieldIndex} not found.`);
			return undefined;
		}

		// 설정이 규격을 위반하면 조용히 재시도하지 말고 바로 알린다
		const fieldViolations = validateFieldData(field, this._tables);
		if (fieldViolations.length > 0) {
			console.warn(`[SlidePuzzleLevelGenerator] Field data error (index ${field.index}): ${fieldViolations.join(' / ')}`);
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

			// 우연히 완성 상태로 돌아왔으면 다시 섞는다
			if (this._validator.validate(level).isValid === false) {
				continue;
			}
			return level;
		}

		console.warn(`[SlidePuzzleLevelGenerator] Failed to generate a level for difficulty ${options.difficulty} within ${maxAttempts} attempts`);
		return undefined;
	}

	public verify(level: SlidePuzzleLevel): SlidePuzzleValidationResult {
		return this._validator.validate(level);
	}

	//#region Internal

	private buildLevel(random: RandomSource, field: SlideFieldTableEntry): SlidePuzzleLevel | undefined {
		const pool = this._tables.getImagePool(field.puzzleObjectId);
		if (pool.length === 0) {
			return undefined;
		}
		const image = pickRandom(random, pool);

		// §8 - 완성 상태에서 합법 이동만으로 역순 셔플한다
		const board = new SlidePuzzleBoard(field.divideNum);
		board.shuffle(random, field.shuffleNum);

		return board.toLevel(field.puzzleId, field.difficulty, field.shuffleNum, image.imagePath);
	}

	//#endregion
}

//#endregion

/** 생성 결과를 한 줄 요약으로 남기는 디버그 헬퍼 */
export function describeSlideLevel(level: SlidePuzzleLevel): string {
	return `${level.puzzleId} D${level.difficulty} ${level.divideNum}x${level.divideNum} shuffle=${level.shuffleNum} image=${level.imagePath}`;
}
