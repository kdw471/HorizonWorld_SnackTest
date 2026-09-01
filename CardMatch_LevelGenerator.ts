/**
 * Card Match Level Generator - 필드 생성 알고리즘 (PUZ_06 §9.1)
 *
 * 사양 §9.1:
 *   total   = sTileArrayX * sTileArrayY
 *   objects = total - iBombTile          // 반드시 짝수 (assert)
 *   pairs   = objects / 2
 *   -> iObjectGroupID 로 오브젝트 풀에서 pairs 종류를 뽑고 각 2개씩 생성
 *   -> 폭탄 iBombTile 개 추가
 *   -> 전체를 랜덤 셔플하여 타일에 배치
 *
 * `iObjectTile` 이 홀수가 되는 테이블 값은 데이터 검증 단계에서 에러로 처리한다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { CardMatchBoard } from 'CardMatch_Board';
import { CardFieldTableEntry, CardMatchDifficultyConfig, CardMatchTables, validateFieldData } from 'CardMatch_DataTables';
import {
	CardMatchLevel,
	CardMatchValidationResult,
	CardTile,
	ETileState,
	RandomSource,
	createSeededRandom,
	pickRandom,
	shuffleInPlace,
} from 'CardMatch_Definitions';

export type CardMatchGenerationOptions = {
	puzzleId?: string,
	difficulty: number,
	seed?: number,
	config?: CardMatchDifficultyConfig,
	/** 특정 필드 데이터를 지정하고 싶을 때 */
	fieldIndex?: number,
}

//#region Validator

export class CardMatchPlacementValidator {
	public validate(level: CardMatchLevel): CardMatchValidationResult {
		const violations: string[] = [];

		const total = level.rows * level.cols;
		if (level.tiles.length !== total) {
			violations.push(`Tile count is ${level.tiles.length} but should be ${level.rows} x ${level.cols} = ${total}.`);
		}

		let bombCount = 0;
		const objectCounts = new Map<string, number>();
		for (const tile of level.tiles) {
			if (tile.isBomb) {
				bombCount++;
				if (tile.objectId !== undefined) {
					violations.push(`Bomb tile ${tile.index} has an object assigned.`);
				}
				continue;
			}
			if (tile.objectId === undefined) {
				violations.push(`Tile ${tile.index} has no object assigned.`);
				continue;
			}
			objectCounts.set(tile.objectId, (objectCounts.get(tile.objectId) ?? 0) + 1);
		}

		if (bombCount !== level.bombCount) {
			violations.push(`Bomb count is ${bombCount} but should be ${level.bombCount}.`);
		}

		// §9.1 - 모든 오브젝트는 정확히 2개씩 (짝)
		for (const entry of Array.from(objectCounts.entries())) {
			if (entry[1] !== 2) {
				violations.push(`Object '${entry[0]}' appears ${entry[1]} times; exactly 2 are needed to form a pair.`);
			}
		}

		const objectTileCount = total - bombCount;
		if (objectTileCount % 2 !== 0) {
			violations.push(`Object tile count ${objectTileCount} is odd.`);
		}

		// 시작 시 모든 타일은 뒷면이어야 한다
		for (const tile of level.tiles) {
			if (tile.state !== ETileState.HIDDEN) {
				violations.push(`Tile ${tile.index} is not face-down at start.`);
			}
		}

		return { isValid: violations.length === 0, violations: violations };
	}
}

//#endregion

//#region Generator

export class CardMatchLevelGenerator {
	private readonly _tables: CardMatchTables;
	private readonly _validator: CardMatchPlacementValidator;

	constructor(tables: CardMatchTables, validator: CardMatchPlacementValidator = new CardMatchPlacementValidator()) {
		this._tables = tables;
		this._validator = validator;
	}

	public get validator(): CardMatchPlacementValidator {
		return this._validator;
	}

	public generate(options: CardMatchGenerationOptions): CardMatchLevel | undefined {
		const config = options.config ?? this._tables.getDifficultyConfig(options.difficulty);
		if (config === undefined) {
			console.warn(`[CardMatchLevelGenerator] No difficulty config for difficulty ${options.difficulty}`);
			return undefined;
		}

		const random = options.seed === undefined ? Math.random : createSeededRandom(options.seed);

		const fieldIndex = options.fieldIndex ?? (config.fieldIndexes.length > 0 ? pickRandom(random, config.fieldIndexes) : undefined);
		if (fieldIndex === undefined) {
			console.warn(`[CardMatchLevelGenerator] No field data linked to difficulty ${options.difficulty}.`);
			return undefined;
		}

		const field = this._tables.getField(fieldIndex);
		if (field === undefined) {
			console.warn(`[CardMatchLevelGenerator] Field data index ${fieldIndex} not found.`);
			return undefined;
		}

		// §9.1 - 데이터 검증 단계에서 에러로 처리한다. 조용히 재시도하지 않는다.
		const fieldViolations = validateFieldData(field, this._tables);
		if (fieldViolations.length > 0) {
			console.warn(`[CardMatchLevelGenerator] Field data error (index ${field.index}): ${fieldViolations.join(' / ')}`);
			return undefined;
		}

		const level = this.buildLevel(random, field, config);
		if (level === undefined) {
			return undefined;
		}
		if (options.puzzleId !== undefined) {
			level.puzzleId = options.puzzleId;
		}

		if (this._validator.validate(level).isValid === false) {
			return undefined;
		}
		return level;
	}

	public verify(level: CardMatchLevel): CardMatchValidationResult {
		const result = this._validator.validate(level);
		if (result.isValid === false) {
			return result;
		}

		// 폭탄이 아닌 타일이 하나도 없으면 클리어 조건이 성립하지 않는다
		const board = CardMatchBoard.fromLevel(level, createSeededRandom(1));
		if (board.isSolved()) {
			return { isValid: false, violations: ['Already cleared at start.'] };
		}
		return { isValid: true, violations: [] };
	}

	//#region Internal

	/** §9.1 의 절차를 그대로 따른다 */
	private buildLevel(random: RandomSource, field: CardFieldTableEntry, config: CardMatchDifficultyConfig): CardMatchLevel | undefined {
		const level = this._tables.buildEmptyLevel(field, config);

		const total = field.tileArrayX * field.tileArrayY;
		const objects = total - field.bombTile;
		const pairs = objects / 2;

		// 오브젝트 풀에서 pairs 종류를 뽑고 각 2개씩 만든다
		const pool = shuffleInPlace(random, this._tables.getObjectPool(field.objectGroupId).slice());
		if (pool.length < pairs) {
			return undefined;
		}

		const payloads: { objectId?: string, isBomb: boolean }[] = [];
		for (let index = 0; index < pairs; index++) {
			payloads.push({ objectId: pool[index].objectId, isBomb: false });
			payloads.push({ objectId: pool[index].objectId, isBomb: false });
		}
		for (let index = 0; index < field.bombTile; index++) {
			payloads.push({ objectId: undefined, isBomb: true });
		}

		// 전체를 랜덤 셔플하여 타일에 배치한다 - §8 "Bomb와 Object의 위치는 랜덤으로 변환된다"
		shuffleInPlace(random, payloads);
		if (payloads.length !== level.tiles.length) {
			return undefined;
		}

		for (let index = 0; index < level.tiles.length; index++) {
			const tile: CardTile = level.tiles[index];
			tile.objectId = payloads[index].objectId;
			tile.isBomb = payloads[index].isBomb;
			tile.state = ETileState.HIDDEN;
		}

		return level;
	}

	//#endregion
}

//#endregion

/** 생성 결과를 한 줄 요약으로 남기는 디버그 헬퍼 */
export function describeCardMatchLevel(level: CardMatchLevel): string {
	return `${level.puzzleId} D${level.difficulty} ${level.cols}x${level.rows} tiles=${level.tiles.length} bombs=${level.bombCount} objects=${level.objectTileCount} pairs=${level.objectTileCount / 2}`;
}
