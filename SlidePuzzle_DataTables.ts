/**
 * Slide Puzzle Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_07 §11)
 *
 *   [PUZ 메인 테이블]       난이도별 제한시간 / 라운드 수 / 소속 퍼즐 ID
 *   [NPUZ_07_FieldData]     이미지 그룹 ID / 분할 개수 / 섞는 횟수
 *   [NPUZ_07_ObjectData]    인덱스 / 이미지 경로
 *
 * PUZ_00 §7.2 에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.
 */

import {
	COMPLETED_IMAGE_SIZE_CM,
	PieceMetrics,
	getLayoutTotalCm,
	getPieceMetrics,
} from 'SlidePuzzle_Definitions';

import { SLIDEPUZZLE_CSV_FIELD_TABLE, SLIDEPUZZLE_CSV_OBJECT_TABLE } from 'SlidePuzzle_FieldData';

/** 기획 CSV 에서 생성한 필드 테이블을 그대로 재수출한다 (테스트/툴에서 참조) */
export { SLIDEPUZZLE_CSV_FIELD_TABLE };

//#region Table types

/** NPUZ_07_ObjectData 한 행 - §11 */
export type SlideObjectTableEntry = {
	index: number,
	/** 이미지 그룹 ID */
	puzzleObjectId: string,
	/** 이미지 경로 */
	imagePath: string,
}

/** NPUZ_07_FieldData 한 행 - §11 */
export type SlideFieldTableEntry = {
	index: number,
	puzzleId: string,
	difficulty: number,
	/** 이미지 그룹 ID */
	puzzleObjectId: string,
	/** 분할 개수 (3 또는 4) */
	divideNum: number,
	/** 섞는 횟수 */
	shuffleNum: number,
}

export type SlideDifficultyConfig = {
	difficulty: number,
	timeLimitSeconds: number,
	/** 퍼즐 퀘스트당 1~3 라운드 - PUZ_00 §3 */
	roundCount: number,
	/** 사용할 필드 데이터 index 들 */
	fieldIndexes: number[],
}

export type SlideMainTableEntry = {
	questId: string,
	questName: string,
	difficulty: number,
	timeLimitSeconds: number,
	roundCount: number,
	puzzleIds: string[],
}

//#endregion

//#region Default data

/** 오브젝트 테이블 초기값 - 퍼즐에 쓸 원본 이미지들 */
export const DEFAULT_SLIDE_OBJECT_TABLE: SlideObjectTableEntry[] = [
	{ index: 1, puzzleObjectId: 'IMG_GROUP_A', imagePath: 'SlidePuzzle/Blueprint_01' },
	{ index: 2, puzzleObjectId: 'IMG_GROUP_A', imagePath: 'SlidePuzzle/Blueprint_02' },
	{ index: 3, puzzleObjectId: 'IMG_GROUP_A', imagePath: 'SlidePuzzle/Blueprint_03' },
	{ index: 4, puzzleObjectId: 'IMG_GROUP_B', imagePath: 'SlidePuzzle/Circuit_01' },
	{ index: 5, puzzleObjectId: 'IMG_GROUP_B', imagePath: 'SlidePuzzle/Circuit_02' },
	{ index: 6, puzzleObjectId: 'IMG_GROUP_B', imagePath: 'SlidePuzzle/Circuit_03' },
];

/**
 * 필드 테이블 초기값.
 *
 * `iDivideNum` 은 3 또는 4 만 허용된다 (§11).
 * `iShuffleNum` 이 클수록 어려워진다. 다만 셔플은 합법 이동만 쓰므로 아무리 커도 항상 풀 수 있다 (§8).
 */
export const DEFAULT_SLIDE_FIELD_TABLE: SlideFieldTableEntry[] = [
	{ index: 1, puzzleId: 'SP_D1_001', difficulty: 1, puzzleObjectId: 'IMG_GROUP_A', divideNum: 3, shuffleNum: 20 },
	{ index: 2, puzzleId: 'SP_D2_001', difficulty: 2, puzzleObjectId: 'IMG_GROUP_A', divideNum: 3, shuffleNum: 60 },
	{ index: 3, puzzleId: 'SP_D3_001', difficulty: 3, puzzleObjectId: 'IMG_GROUP_B', divideNum: 4, shuffleNum: 60 },
	{ index: 4, puzzleId: 'SP_D4_001', difficulty: 4, puzzleObjectId: 'IMG_GROUP_B', divideNum: 4, shuffleNum: 120 },
	{ index: 5, puzzleId: 'SP_D5_001', difficulty: 5, puzzleObjectId: 'IMG_GROUP_B', divideNum: 4, shuffleNum: 200 },
];

/**
 * 실제로 쓰는 필드 / 오브젝트 테이블.
 *
 * 기획 CSV(`SlidePuzzle_FieldData.ts`)가 있으면 그것을 쓰고, 없으면 위의 손 배치 행으로 떨어진다.
 */
export const SLIDE_FIELD_TABLE: SlideFieldTableEntry[] =
	SLIDEPUZZLE_CSV_FIELD_TABLE.length > 0 ? SLIDEPUZZLE_CSV_FIELD_TABLE : DEFAULT_SLIDE_FIELD_TABLE;

export const SLIDE_OBJECT_TABLE: SlideObjectTableEntry[] =
	DEFAULT_SLIDE_OBJECT_TABLE.concat(SLIDEPUZZLE_CSV_OBJECT_TABLE);

/** 해당 난이도가 쓰는 필드 행의 index 목록 */
function fieldIndexesFor(difficulty: number): number[] {
	return SLIDE_FIELD_TABLE
		.filter((field) => field.difficulty === difficulty)
		.map((field) => field.index);
}

export const DEFAULT_SLIDE_DIFFICULTY_TABLE: SlideDifficultyConfig[] = [
	{ difficulty: 1, timeLimitSeconds: 90, roundCount: 1, fieldIndexes: fieldIndexesFor(1) },
	{ difficulty: 2, timeLimitSeconds: 120, roundCount: 2, fieldIndexes: fieldIndexesFor(2) },
	{ difficulty: 3, timeLimitSeconds: 180, roundCount: 2, fieldIndexes: fieldIndexesFor(3) },
	{ difficulty: 4, timeLimitSeconds: 240, roundCount: 3, fieldIndexes: fieldIndexesFor(4) },
	{ difficulty: 5, timeLimitSeconds: 300, roundCount: 3, fieldIndexes: fieldIndexesFor(5) },
	// 기획 CSV 최고 난이도. 4분할 55회 셔플 10판이 들어 있다
	{ difficulty: 6, timeLimitSeconds: 330, roundCount: 3, fieldIndexes: fieldIndexesFor(6) },
];

export const DEFAULT_SLIDE_MAIN_TABLE: SlideMainTableEntry[] = DEFAULT_SLIDE_DIFFICULTY_TABLE.map((config) => ({
	questId: `QUEST_SLIDE_D${config.difficulty}`,
	questName: `슬라이드 퍼즐 D${config.difficulty}`,
	difficulty: config.difficulty,
	timeLimitSeconds: config.timeLimitSeconds,
	roundCount: config.roundCount,
	puzzleIds: SLIDE_FIELD_TABLE
		.filter((field) => field.difficulty === config.difficulty)
		.map((field) => field.puzzleId),
}));

//#endregion

//#region Table access

export class SlidePuzzleTables {
	private _mainTable: SlideMainTableEntry[] = DEFAULT_SLIDE_MAIN_TABLE;
	private _difficultyTable: SlideDifficultyConfig[] = DEFAULT_SLIDE_DIFFICULTY_TABLE;
	private _fieldTable: SlideFieldTableEntry[] = SLIDE_FIELD_TABLE;
	private _objectTable: SlideObjectTableEntry[] = SLIDE_OBJECT_TABLE;

	public loadMainTable(entries: SlideMainTableEntry[]): void {
		this._mainTable = entries;
	}

	public loadDifficultyTable(entries: SlideDifficultyConfig[]): void {
		this._difficultyTable = entries;
	}

	public loadFieldTable(entries: SlideFieldTableEntry[]): void {
		this._fieldTable = entries;
	}

	public loadObjectTable(entries: SlideObjectTableEntry[]): void {
		this._objectTable = entries;
	}

	public get mainTable(): readonly SlideMainTableEntry[] {
		return this._mainTable;
	}

	public get difficultyTable(): readonly SlideDifficultyConfig[] {
		return this._difficultyTable;
	}

	public get fieldTable(): readonly SlideFieldTableEntry[] {
		return this._fieldTable;
	}

	public get objectTable(): readonly SlideObjectTableEntry[] {
		return this._objectTable;
	}

	public getQuest(questId: string): SlideMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.questId === questId);
	}

	public getQuestByDifficulty(difficulty: number): SlideMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.difficulty === difficulty);
	}

	public getDifficultyConfig(difficulty: number): SlideDifficultyConfig | undefined {
		return this._difficultyTable.find((entry) => entry.difficulty === difficulty);
	}

	public getField(index: number): SlideFieldTableEntry | undefined {
		return this._fieldTable.find((entry) => entry.index === index);
	}

	public getFieldByPuzzleId(puzzleId: string): SlideFieldTableEntry | undefined {
		return this._fieldTable.find((entry) => entry.puzzleId === puzzleId);
	}

	public getFieldsForDifficulty(difficulty: number): SlideFieldTableEntry[] {
		return this._fieldTable.filter((entry) => entry.difficulty === difficulty);
	}

	/** 이미지 그룹의 원본 이미지 목록 - §11 */
	public getImagePool(puzzleObjectId: string): SlideObjectTableEntry[] {
		return this._objectTable.filter((entry) => entry.puzzleObjectId === puzzleObjectId);
	}

	/** 분할 수에 맞는 조각 규격 - §4 */
	public getPieceMetrics(divideNum: number): PieceMetrics | undefined {
		return getPieceMetrics(divideNum);
	}
}

//#endregion

//#region Validation

/**
 * 필드 데이터가 §4 / §11 의 규격을 지키는지 확인한다.
 * 위반하면 생성기가 레벨을 만들지 않고 바로 알린다.
 */
export function validateFieldData(field: SlideFieldTableEntry, tables: SlidePuzzleTables): string[] {
	const violations: string[] = [];

	// §11 - iDivideNum 은 3 또는 4
	if (field.divideNum !== 3 && field.divideNum !== 4) {
		violations.push(`Divide count must be 3 or 4 (got ${field.divideNum}).`);
	}
	else {
		// §4 - 조각 규격이 완성 이미지 크기(35cm)와 맞아야 한다
		const total = getLayoutTotalCm(field.divideNum);
		if (total === undefined) {
			violations.push(`No piece spec defined for divide count ${field.divideNum}.`);
		}
		else if (Math.abs(total - COMPLETED_IMAGE_SIZE_CM) > 1e-6) {
			violations.push(`Sum of the ${field.divideNum}x${field.divideNum} piece spec is ${total}cm, which differs from the completed image size ${COMPLETED_IMAGE_SIZE_CM}cm.`);
		}
	}

	if (field.shuffleNum < 1) {
		violations.push(`Shuffle count must be 1 or more (got ${field.shuffleNum}).`);
	}

	if (tables.getImagePool(field.puzzleObjectId).length === 0) {
		violations.push(`Image group '${field.puzzleObjectId}' has no images.`);
	}

	return violations;
}

//#endregion
