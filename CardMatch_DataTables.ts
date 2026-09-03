/**
 * Card Match Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_06 §8)
 *
 *   [PUZ 메인 테이블]        난이도별 제한시간 / 라운드 수 / 소속 퍼즐 ID
 *   [NPUZ_06_FieldData]      필드 크기 / 폭탄 수 / 오브젝트 타일 수 / 오브젝트 그룹 ID
 *   [NPUZ_06_ObjectData]     오브젝트 ID / 타입 / 챕터 / 그룹 / 메쉬 경로 / 레벨 사이즈
 *
 * PUZ_00 §7.2 에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.
 *
 * ## 데이터 검증이 특히 중요하다
 *
 * §8 은 `iObjectTile = (sTileArrayX x sTileArrayY) - iBombTile` 이며 **반드시 짝수** 라고 못박고 있다.
 * 홀수면 짝을 맞출 수 없는 오브젝트가 하나 남아 클리어가 불가능해진다.
 * §9.1 에 따라 이 경우를 **데이터 검증 단계에서 에러로 처리**한다.
 */

import {
	CardMatchLevel,
	CardTile,
	DEFAULT_BOMB_SHUFFLE_SECONDS,
	DEFAULT_MISMATCH_REVEAL_SECONDS,
	ECardObjectType,
	ETileState,
	cloneTile,
} from 'CardMatch_Definitions';
import { CARDMATCH_CSV_FIELD_TABLE, CARDMATCH_CSV_OBJECT_ROWS } from 'CardMatch_FieldData';

/** 기획 CSV 에서 생성한 필드 테이블을 그대로 재수출한다 (테스트/툴에서 참조) */
export { CARDMATCH_CSV_FIELD_TABLE };

//#region Table types

/** NPUZ_06_ObjectData 한 행 - §8 */
export type CardObjectTableEntry = {
	objectId: string,
	/** 타입 (일반 / 함정) */
	type: ECardObjectType,
	/** 챕터 (1 / 2 / 3 / 4) */
	chapter: number,
	/** 퍼즐 오브젝트 그룹 ID */
	objectGroupId: string,
	/** 스태틱 메쉬 경로 */
	meshPath: string,
	/** 레벨 사이즈 */
	levelSize: number,
}

/** NPUZ_06_FieldData 한 행 - §8 */
export type CardFieldTableEntry = {
	index: number,
	puzzleId: string,
	difficulty: number,
	/** NPUZ_06_ObjectData 의 iObjectGroupID 를 참조 */
	objectGroupId: string,
	/** 필드의 X열 */
	tileArrayX: number,
	/** 필드의 Y열 */
	tileArrayY: number,
	/** 각 라운드에 등장하는 폭탄의 수 */
	bombTile: number,
	/** (X x Y) - bombTile. 반드시 짝수여야 한다 */
	objectTile: number,
}

export type CardMatchDifficultyConfig = {
	difficulty: number,
	timeLimitSeconds: number,
	/** 퍼즐 퀘스트당 1~3 라운드 - PUZ_00 §3 */
	roundCount: number,
	/** 사용할 필드 데이터 index 들 */
	fieldIndexes: number[],
	/** 짝이 틀렸을 때 보여 주는 시간(초) */
	mismatchRevealSeconds: number,
	/** 폭탄 셔플 연출 시간(초) */
	bombShuffleSeconds: number,
}

export type CardMatchMainTableEntry = {
	questId: string,
	questName: string,
	difficulty: number,
	timeLimitSeconds: number,
	roundCount: number,
	puzzleIds: string[],
}

//#endregion

//#region Default data

/**
 * 오브젝트 테이블 초기값 - 포탈에서 나오는 오브젝트들.
 *
 * 주의: 그룹별 종류 수가 그 그룹을 쓰는 필드의 **pairs 수 이상**이어야 한다.
 * (pairs = ((X x Y) - bomb) / 2). 모자라면 `validateFieldData()` 가 데이터 오류로 거부한다.
 *   GROUP_CH1 4종  -> 3x3 필드(pairs 4)까지
 *   GROUP_CH2 8종  -> 5x3 필드(pairs 7)까지
 *   GROUP_CH3 12종 -> 5x5 필드(pairs 12)까지
 */
export const DEFAULT_CARD_OBJECT_TABLE: CardObjectTableEntry[] = [
	{ objectId: 'OBJ_GEAR', type: ECardObjectType.NORMAL, chapter: 1, objectGroupId: 'GROUP_CH1', meshPath: 'CardMatch/Gear', levelSize: 1 },
	{ objectId: 'OBJ_CHIP', type: ECardObjectType.NORMAL, chapter: 1, objectGroupId: 'GROUP_CH1', meshPath: 'CardMatch/Chip', levelSize: 1 },
	{ objectId: 'OBJ_BATTERY', type: ECardObjectType.NORMAL, chapter: 1, objectGroupId: 'GROUP_CH1', meshPath: 'CardMatch/Battery', levelSize: 1 },
	{ objectId: 'OBJ_KEY', type: ECardObjectType.NORMAL, chapter: 1, objectGroupId: 'GROUP_CH1', meshPath: 'CardMatch/Key', levelSize: 1 },
	{ objectId: 'OBJ_LENS', type: ECardObjectType.NORMAL, chapter: 2, objectGroupId: 'GROUP_CH2', meshPath: 'CardMatch/Lens', levelSize: 1 },
	{ objectId: 'OBJ_COIL', type: ECardObjectType.NORMAL, chapter: 2, objectGroupId: 'GROUP_CH2', meshPath: 'CardMatch/Coil', levelSize: 1 },
	{ objectId: 'OBJ_VALVE', type: ECardObjectType.NORMAL, chapter: 2, objectGroupId: 'GROUP_CH2', meshPath: 'CardMatch/Valve', levelSize: 1 },
	{ objectId: 'OBJ_DISK', type: ECardObjectType.NORMAL, chapter: 2, objectGroupId: 'GROUP_CH2', meshPath: 'CardMatch/Disk', levelSize: 1 },
	{ objectId: 'OBJ_CORE', type: ECardObjectType.NORMAL, chapter: 2, objectGroupId: 'GROUP_CH2', meshPath: 'CardMatch/Core', levelSize: 1 },
	{ objectId: 'OBJ_ANTENNA', type: ECardObjectType.NORMAL, chapter: 2, objectGroupId: 'GROUP_CH2', meshPath: 'CardMatch/Antenna', levelSize: 1 },
	{ objectId: 'OBJ_FUSE', type: ECardObjectType.NORMAL, chapter: 2, objectGroupId: 'GROUP_CH2', meshPath: 'CardMatch/Fuse', levelSize: 1 },
	{ objectId: 'OBJ_SPRING', type: ECardObjectType.NORMAL, chapter: 2, objectGroupId: 'GROUP_CH2', meshPath: 'CardMatch/Spring', levelSize: 1 },
	{ objectId: 'OBJ_CIRCUIT', type: ECardObjectType.NORMAL, chapter: 3, objectGroupId: 'GROUP_CH3', meshPath: 'CardMatch/Circuit', levelSize: 1 },
	{ objectId: 'OBJ_CRYSTAL', type: ECardObjectType.NORMAL, chapter: 3, objectGroupId: 'GROUP_CH3', meshPath: 'CardMatch/Crystal', levelSize: 1 },
	{ objectId: 'OBJ_MODULE', type: ECardObjectType.NORMAL, chapter: 3, objectGroupId: 'GROUP_CH3', meshPath: 'CardMatch/Module', levelSize: 1 },
	{ objectId: 'OBJ_SENSOR', type: ECardObjectType.NORMAL, chapter: 3, objectGroupId: 'GROUP_CH3', meshPath: 'CardMatch/Sensor', levelSize: 1 },
	{ objectId: 'OBJ_CABLE', type: ECardObjectType.NORMAL, chapter: 3, objectGroupId: 'GROUP_CH3', meshPath: 'CardMatch/Cable', levelSize: 1 },
	{ objectId: 'OBJ_RELAY', type: ECardObjectType.NORMAL, chapter: 3, objectGroupId: 'GROUP_CH3', meshPath: 'CardMatch/Relay', levelSize: 1 },
	{ objectId: 'OBJ_PRISM', type: ECardObjectType.NORMAL, chapter: 3, objectGroupId: 'GROUP_CH3', meshPath: 'CardMatch/Prism', levelSize: 1 },
	{ objectId: 'OBJ_ROTOR', type: ECardObjectType.NORMAL, chapter: 3, objectGroupId: 'GROUP_CH3', meshPath: 'CardMatch/Rotor', levelSize: 1 },
	{ objectId: 'OBJ_MAGNET', type: ECardObjectType.NORMAL, chapter: 3, objectGroupId: 'GROUP_CH3', meshPath: 'CardMatch/Magnet', levelSize: 1 },
	{ objectId: 'OBJ_TURBINE', type: ECardObjectType.NORMAL, chapter: 3, objectGroupId: 'GROUP_CH3', meshPath: 'CardMatch/Turbine', levelSize: 1 },
	{ objectId: 'OBJ_BEACON', type: ECardObjectType.NORMAL, chapter: 3, objectGroupId: 'GROUP_CH3', meshPath: 'CardMatch/Beacon', levelSize: 1 },
	{ objectId: 'OBJ_CAPSULE', type: ECardObjectType.NORMAL, chapter: 3, objectGroupId: 'GROUP_CH3', meshPath: 'CardMatch/Capsule', levelSize: 1 },
	{ objectId: 'OBJ_BOMB', type: ECardObjectType.TRAP, chapter: 1, objectGroupId: 'GROUP_TRAP', meshPath: 'CardMatch/Bomb', levelSize: 1 },
];

/**
 * 필드 테이블 초기값 - §5 난이도별 타일 수.
 *
 *   난이도 1   : 9칸 (3x3)
 *   난이도 2~3 : 15칸 (3x5)
 *   난이도 4~5 : 25칸 (5x5)
 *
 * `objectTile` 은 반드시 짝수여야 하므로, 홀수 칸 배치에서는 폭탄 수를 홀수로 맞춘다.
 * 예) 9칸 - 폭탄 1개 = 8개(짝수) / 15칸 - 폭탄 1개 = 14개(짝수) / 25칸 - 폭탄 1개 = 24개(짝수)
 */
export const DEFAULT_CARD_FIELD_TABLE: CardFieldTableEntry[] = [
	{ index: 1, puzzleId: 'CM_D1_001', difficulty: 1, objectGroupId: 'GROUP_CH1', tileArrayX: 3, tileArrayY: 3, bombTile: 1, objectTile: 8 },
	{ index: 2, puzzleId: 'CM_D2_001', difficulty: 2, objectGroupId: 'GROUP_CH2', tileArrayX: 5, tileArrayY: 3, bombTile: 1, objectTile: 14 },
	{ index: 3, puzzleId: 'CM_D3_001', difficulty: 3, objectGroupId: 'GROUP_CH2', tileArrayX: 5, tileArrayY: 3, bombTile: 3, objectTile: 12 },
	{ index: 4, puzzleId: 'CM_D4_001', difficulty: 4, objectGroupId: 'GROUP_CH3', tileArrayX: 5, tileArrayY: 5, bombTile: 1, objectTile: 24 },
	{ index: 5, puzzleId: 'CM_D5_001', difficulty: 5, objectGroupId: 'GROUP_CH3', tileArrayX: 5, tileArrayY: 5, bombTile: 3, objectTile: 22 },
];

/**
 * 기획 CSV(`NPUZ_06_ObjectData.csv`) 65행을 오브젝트 테이블 행으로 변환한 것.
 * GROUP_0 은 폭탄(함정) 한 종, GROUP_1~4 는 챕터별 오브젝트 세트다.
 */
export const CARD_MATCH_CSV_OBJECT_TABLE: CardObjectTableEntry[] = CARDMATCH_CSV_OBJECT_ROWS.map((row) => ({
	objectId: row.objectId,
	type: row.groupId === 'GROUP_0' ? ECardObjectType.TRAP : ECardObjectType.NORMAL,
	chapter: parseInt(row.groupId.substring('GROUP_'.length), 10),
	objectGroupId: row.groupId,
	meshPath: row.meshPath,
	levelSize: row.levelSize,
}));

/**
 * 실제로 쓰는 필드 테이블.
 *
 * 기획 CSV 는 난이도 1 / 3 / 5 만 채워져 있고 2 / 4 / 6 행은 값이 전부 0(미작성)이다.
 * 그래서 CSV 행을 먼저 놓고, **CSV 가 다루지 않는 난이도**만 기존 손 배치 행으로 메운다.
 */
export const CARD_FIELD_TABLE: CardFieldTableEntry[] = CARDMATCH_CSV_FIELD_TABLE
	.concat(DEFAULT_CARD_FIELD_TABLE.filter((field) =>
		CARDMATCH_CSV_FIELD_TABLE.some((csv) => csv.difficulty === field.difficulty) === false));

/** 해당 난이도가 쓰는 필드 행의 index 목록 */
function fieldIndexesFor(difficulty: number): number[] {
	return CARD_FIELD_TABLE
		.filter((field) => field.difficulty === difficulty)
		.map((field) => field.index);
}

export const DEFAULT_CARD_MATCH_DIFFICULTY_TABLE: CardMatchDifficultyConfig[] = [
	{ difficulty: 1, timeLimitSeconds: 90, roundCount: 1, fieldIndexes: fieldIndexesFor(1), mismatchRevealSeconds: DEFAULT_MISMATCH_REVEAL_SECONDS, bombShuffleSeconds: DEFAULT_BOMB_SHUFFLE_SECONDS },
	{ difficulty: 2, timeLimitSeconds: 120, roundCount: 2, fieldIndexes: fieldIndexesFor(2), mismatchRevealSeconds: DEFAULT_MISMATCH_REVEAL_SECONDS, bombShuffleSeconds: DEFAULT_BOMB_SHUFFLE_SECONDS },
	{ difficulty: 3, timeLimitSeconds: 140, roundCount: 2, fieldIndexes: fieldIndexesFor(3), mismatchRevealSeconds: 0.7, bombShuffleSeconds: DEFAULT_BOMB_SHUFFLE_SECONDS },
	{ difficulty: 4, timeLimitSeconds: 180, roundCount: 3, fieldIndexes: fieldIndexesFor(4), mismatchRevealSeconds: 0.7, bombShuffleSeconds: DEFAULT_BOMB_SHUFFLE_SECONDS },
	{ difficulty: 5, timeLimitSeconds: 200, roundCount: 3, fieldIndexes: fieldIndexesFor(5), mismatchRevealSeconds: 0.6, bombShuffleSeconds: DEFAULT_BOMB_SHUFFLE_SECONDS },
];
export const DEFAULT_CARD_MATCH_MAIN_TABLE: CardMatchMainTableEntry[] = DEFAULT_CARD_MATCH_DIFFICULTY_TABLE.map((config) => ({
	questId: `QUEST_CARDMATCH_D${config.difficulty}`,
	questName: `포탈 타일 D${config.difficulty}`,
	difficulty: config.difficulty,
	timeLimitSeconds: config.timeLimitSeconds,
	roundCount: config.roundCount,
	puzzleIds: CARD_FIELD_TABLE
		.filter((field) => field.difficulty === config.difficulty)
		.map((field) => field.puzzleId),
}));

//#endregion

//#region Table access

export class CardMatchTables {
	private _mainTable: CardMatchMainTableEntry[] = DEFAULT_CARD_MATCH_MAIN_TABLE;
	private _difficultyTable: CardMatchDifficultyConfig[] = DEFAULT_CARD_MATCH_DIFFICULTY_TABLE;
	private _fieldTable: CardFieldTableEntry[] = CARD_FIELD_TABLE;
	private _objectTable: CardObjectTableEntry[] = DEFAULT_CARD_OBJECT_TABLE.concat(CARD_MATCH_CSV_OBJECT_TABLE);

	public loadMainTable(entries: CardMatchMainTableEntry[]): void {
		this._mainTable = entries;
	}

	public loadDifficultyTable(entries: CardMatchDifficultyConfig[]): void {
		this._difficultyTable = entries;
	}

	public loadFieldTable(entries: CardFieldTableEntry[]): void {
		this._fieldTable = entries;
	}

	public loadObjectTable(entries: CardObjectTableEntry[]): void {
		this._objectTable = entries;
	}

	public get mainTable(): readonly CardMatchMainTableEntry[] {
		return this._mainTable;
	}

	public get difficultyTable(): readonly CardMatchDifficultyConfig[] {
		return this._difficultyTable;
	}

	public get fieldTable(): readonly CardFieldTableEntry[] {
		return this._fieldTable;
	}

	public get objectTable(): readonly CardObjectTableEntry[] {
		return this._objectTable;
	}

	public getQuest(questId: string): CardMatchMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.questId === questId);
	}

	public getQuestByDifficulty(difficulty: number): CardMatchMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.difficulty === difficulty);
	}

	public getDifficultyConfig(difficulty: number): CardMatchDifficultyConfig | undefined {
		return this._difficultyTable.find((entry) => entry.difficulty === difficulty);
	}

	public getField(index: number): CardFieldTableEntry | undefined {
		return this._fieldTable.find((entry) => entry.index === index);
	}

	public getFieldByPuzzleId(puzzleId: string): CardFieldTableEntry | undefined {
		return this._fieldTable.find((entry) => entry.puzzleId === puzzleId);
	}

	public getFieldsForDifficulty(difficulty: number): CardFieldTableEntry[] {
		return this._fieldTable.filter((entry) => entry.difficulty === difficulty);
	}

	public getObject(objectId: string): CardObjectTableEntry | undefined {
		return this._objectTable.find((entry) => entry.objectId === objectId);
	}

	/** 그룹 ID 로 일반 오브젝트 풀을 가져온다 - §8 */
	public getObjectPool(objectGroupId: string): CardObjectTableEntry[] {
		return this._objectTable.filter((entry) =>
			entry.objectGroupId === objectGroupId && entry.type === ECardObjectType.NORMAL);
	}

	/** 필드 테이블 행을 그대로 레벨로 옮긴다 (타일 배정은 생성기가 한다) */
	public buildEmptyLevel(field: CardFieldTableEntry, config: CardMatchDifficultyConfig): CardMatchLevel {
		const tiles: CardTile[] = [];
		for (let row = 0; row < field.tileArrayY; row++) {
			for (let col = 0; col < field.tileArrayX; col++) {
				tiles.push({
					index: row * field.tileArrayX + col,
					row: row,
					col: col,
					state: ETileState.HIDDEN,
					isBomb: false,
				});
			}
		}

		return {
			puzzleId: field.puzzleId,
			difficulty: field.difficulty,
			rows: field.tileArrayY,
			cols: field.tileArrayX,
			tiles: tiles,
			bombCount: field.bombTile,
			objectTileCount: field.objectTile,
			mismatchRevealSeconds: config.mismatchRevealSeconds,
			bombShuffleSeconds: config.bombShuffleSeconds,
		};
	}

	public cloneLevelTiles(level: CardMatchLevel): CardTile[] {
		return level.tiles.map(cloneTile);
	}
}

//#endregion

//#region Validation (§9.1)

/**
 * 필드 데이터가 §8 / §9.1 의 규격을 지키는지 확인한다.
 *
 * 가장 중요한 것은 **iObjectTile 이 짝수** 인지다.
 * 홀수면 짝이 없는 오브젝트가 하나 남아 클리어가 불가능해지므로,
 * §9.1 에 따라 데이터 검증 단계에서 에러로 처리한다.
 */
export function validateFieldData(field: CardFieldTableEntry, tables: CardMatchTables): string[] {
	const violations: string[] = [];

	if (field.tileArrayX <= 0 || field.tileArrayY <= 0) {
		violations.push(`Invalid field size (${field.tileArrayX} x ${field.tileArrayY}).`);
		return violations;
	}

	const total = field.tileArrayX * field.tileArrayY;

	if (field.bombTile < 0) {
		violations.push(`Bomb count must be 0 or more (got ${field.bombTile}).`);
	}
	if (field.bombTile >= total) {
		violations.push(`Bomb count ${field.bombTile} is not below the total tile count ${total}.`);
	}

	// §8 - iObjectTile = (X x Y) - iBombTile
	const expectedObjectTile = total - field.bombTile;
	if (field.objectTile !== expectedObjectTile) {
		violations.push(`iObjectTile is ${field.objectTile} but should be (${field.tileArrayX} x ${field.tileArrayY}) - ${field.bombTile} = ${expectedObjectTile}.`);
	}

	// §8 / §9.1 - 반드시 짝수
	if (expectedObjectTile % 2 !== 0) {
		violations.push(`Object tile count ${expectedObjectTile} is odd; pairs cannot be formed - data error.`);
	}
	if (expectedObjectTile <= 0) {
		violations.push('There are no object tiles.');
	}

	// 오브젝트 풀이 필요한 종류 수를 감당할 수 있는지
	const pairs = Math.floor(expectedObjectTile / 2);
	const pool = tables.getObjectPool(field.objectGroupId);
	if (pool.length === 0) {
		violations.push(`Object group '${field.objectGroupId}' has no normal objects.`);
	}
	else if (pool.length < pairs) {
		violations.push(`Object group '${field.objectGroupId}' has ${pool.length} kinds but ${pairs} are required.`);
	}

	return violations;
}

//#endregion
