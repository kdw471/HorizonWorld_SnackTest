/**
 * Laser Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_01 §7)
 *
 *   [레이저 메인 테이블]    난이도별 제한시간 / 라운드 수 / 소속 퍼즐 ID
 *   [레이저 필드 테이블]    퍼즐별 기믹 배치 좌표 + 지급 크리스탈 종류와 개수
 *   [레이저 오브젝트 테이블] 크리스탈/기믹의 기능·리소스·상태별 연출
 *
 * PUZ_00 §7.2 에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.
 */

import {
	ECrystalType,
	EGimmickType,
	ELaserColor,
	EObjectState,
	ETeeBlockedSide,
	ETriangleCorner,
	LaserCrystal,
	LaserGimmick,
	LaserLevel,
	LaserPlacedCrystal,
	cloneCrystal,
	cloneGimmick,
	clonePlacedCrystal,
} from 'Laser_Definitions';
import { LASER_CSV_FIELD_TABLE, LASER_CSV_OBJECT_ROWS } from 'Laser_FieldData';

/** 기획 CSV 에서 생성한 필드 테이블을 그대로 재수출한다 (테스트/툴에서 참조) */
export { LASER_CSV_FIELD_TABLE };

//#region Table types

/** 난이도별 기본 룰 */
export type LaserDifficultyConfig = {
	difficulty: number,
	timeLimitSeconds: number,
	/** 퍼즐 퀘스트당 1~3 라운드 - PUZ_00 §3 */
	roundCount: number,
	/** 해를 이루는 크리스탈 수 (레벨 생성기의 경로 꺾임 횟수) */
	solutionCrystalCount: number,
	/** 해에 필요 없는 여분 크리스탈 수 - §3 3.3 "모두 사용하지 않아도 클리어 가능" */
	spareCrystalCount: number,
	/** 반드시 경유해야 하는 중계체 수 - §3 4.1 */
	relayCount: number,
	/** 피해야 하는 해골 수 - §3 4.2 */
	skullCount: number,
	/** 발사체-수신체 쌍의 수 */
	beamCount: number,
}

/** 메인 테이블 한 행 */
export type LaserMainTableEntry = {
	questId: string,
	questName: string,
	difficulty: number,
	timeLimitSeconds: number,
	roundCount: number,
	puzzleIds: string[],
}

/** 필드 테이블 한 행 */
export type LaserFieldTableEntry = {
	puzzleId: string,
	difficulty: number,
	/** 기본 기믹 배치 좌표값 (전체 7x7 좌표) */
	gimmicks: LaserGimmick[],
	/** 시작부터 필드에 놓여 있는 크리스탈 (배치 로컬 5x5 좌표) */
	presetCrystals: LaserPlacedCrystal[],
	/** 지급되는 크리스탈 종류와 개수 */
	inventory: LaserCrystal[],
}

export type LaserResourceInfo = {
	meshPath: string,
	scale: number,
}

export type LaserStateVisual = {
	materialId: string,
	vfxId: string,
	sfxId: string,
}

/** 오브젝트 테이블 한 행 */
export type LaserObjectTableEntry = {
	objectId: string,
	/** 크리스탈이면 종류, 기믹이면 종류 */
	crystalType?: ECrystalType,
	gimmickType?: EGimmickType,
	/** 기능 설명 (기획 참조용) */
	description: string,
	resource: LaserResourceInfo,
	/** 상태별 연출 정보 - PUZ_00 §5 (On / Off / Fault) */
	stateVisuals: { [state: string]: LaserStateVisual },
}

//#endregion

//#region Default data

function makeStateVisuals(prefix: string): { [state: string]: LaserStateVisual } {
	const visuals: { [state: string]: LaserStateVisual } = {};
	visuals[EObjectState.OFF] = { materialId: `${prefix}_Off`, vfxId: '', sfxId: '' };
	visuals[EObjectState.ON] = { materialId: `${prefix}_On`, vfxId: `${prefix}_Activate`, sfxId: `${prefix}_Activate` };
	visuals[EObjectState.FAULT] = { materialId: `${prefix}_Fault`, vfxId: `${prefix}_Fault`, sfxId: `${prefix}_Fault` };
	return visuals;
}

/**
 * 오브젝트 테이블 초기값.
 * 크리스탈 5종(§4.1) + 기믹 5종(§4.2 / §4.3).
 */
export const DEFAULT_LASER_OBJECT_TABLE: LaserObjectTableEntry[] = [
	{
		objectId: 'CRYSTAL_TRIANGLE',
		crystalType: ECrystalType.TRIANGLE,
		description: '빗변으로 들어온 광선을 직각 반사. 평면으로 들어오면 되돌아간다. 방향 4종',
		resource: { meshPath: 'Laser/Crystal_Triangle', scale: 1 },
		stateVisuals: makeStateVisuals('Crystal_Triangle'),
	},
	{
		objectId: 'CRYSTAL_OCTAGON',
		crystalType: ECrystalType.OCTAGON,
		description: '입사 방향과 무관하게 대각선 4방향으로 분배',
		resource: { meshPath: 'Laser/Crystal_Octagon', scale: 1 },
		stateVisuals: makeStateVisuals('Crystal_Octagon'),
	},
	{
		objectId: 'CRYSTAL_CROSS',
		crystalType: ECrystalType.CROSS,
		description: '입사 방향과 무관하게 직각 4방향으로 분배',
		resource: { meshPath: 'Laser/Crystal_Cross', scale: 1 },
		stateVisuals: makeStateVisuals('Crystal_Cross'),
	},
	{
		objectId: 'CRYSTAL_TEE',
		crystalType: ECrystalType.TEE,
		description: '2~3방향으로 분배. 방향 4종 (ㅓ/ㅗ/ㅜ/ㅏ)',
		resource: { meshPath: 'Laser/Crystal_Tee', scale: 1 },
		stateVisuals: makeStateVisuals('Crystal_Tee'),
	},
	{
		objectId: 'CRYSTAL_FLOWER',
		crystalType: ECrystalType.FLOWER,
		description: '모든 방향의 광선을 흡수',
		resource: { meshPath: 'Laser/Crystal_Flower', scale: 1 },
		stateVisuals: makeStateVisuals('Crystal_Flower'),
	},
	{
		objectId: 'GIMMICK_EMITTER',
		gimmickType: EGimmickType.EMITTER,
		description: '레이저 시작점. 발사체 색 == 레이저 색',
		resource: { meshPath: 'Laser/Emitter', scale: 1 },
		stateVisuals: makeStateVisuals('Emitter'),
	},
	{
		objectId: 'GIMMICK_RECEIVER',
		gimmickType: EGimmickType.RECEIVER,
		description: '레이저 목표점. 같은 색 레이저를 받으면 On',
		resource: { meshPath: 'Laser/Receiver', scale: 1 },
		stateVisuals: makeStateVisuals('Receiver'),
	},
	{
		objectId: 'GIMMICK_RELAY',
		gimmickType: EGimmickType.RELAY,
		description: '반드시 경유해야 하는 오브젝트. 여러 색을 지닐 수 있다',
		resource: { meshPath: 'Laser/Relay', scale: 1 },
		stateVisuals: makeStateVisuals('Relay'),
	},
	{
		objectId: 'GIMMICK_SKULL',
		gimmickType: EGimmickType.SKULL,
		description: '레이저가 닿으면 모든 수신체가 비활성화되어 클리어 불가',
		resource: { meshPath: 'Laser/SkullCrystal', scale: 1 },
		stateVisuals: makeStateVisuals('SkullCrystal'),
	},
	{
		objectId: 'GIMMICK_FIXED_CRYSTAL',
		gimmickType: EGimmickType.FIXED_CRYSTAL,
		description: '필드에 박혀 있어 유저가 옮길 수 없는 크리스탈',
		resource: { meshPath: 'Laser/Crystal_Fixed', scale: 1 },
		stateVisuals: makeStateVisuals('Crystal_Fixed'),
	},
];

function csvCrystalType(category: string): ECrystalType | undefined {
	switch (category) {
		case '05': return ECrystalType.TRIANGLE;
		case '06': return ECrystalType.CROSS;
		case '07': return ECrystalType.FLOWER;
		default: return undefined;
	}
}

function csvGimmickType(category: string, movable: boolean): EGimmickType | undefined {
	switch (category) {
		case '01': return EGimmickType.EMITTER;
		case '02': return EGimmickType.RECEIVER;
		case '03': return EGimmickType.RELAY;
		case '04': return EGimmickType.SKULL;
		// 필드에 박혀 있는 크리스탈은 유저가 옮길 수 없다 (§4.3)
		default: return movable ? undefined : EGimmickType.FIXED_CRYSTAL;
	}
}

/**
 * 기획 CSV(`NPUZ_01_ObjectData.csv`) 40행을 오브젝트 테이블 행으로 변환한 것.
 *
 * 위의 종류별 기본 행과 달리 **실제 오브젝트 ID와 스태틱 메쉬 경로**를 들고 있다.
 * 기본 행 뒤에 붙이므로 `getObjectForCrystal` / `getObjectForGimmick` 같은
 * 종류 기준 조회는 기존처럼 기본 행을 먼저 찾고, `getObject(실제ID)` 는 이쪽을 찾는다.
 */
export const LASER_CSV_OBJECT_TABLE: LaserObjectTableEntry[] = LASER_CSV_OBJECT_ROWS.map((row) => ({
	objectId: row.objectId,
	crystalType: csvCrystalType(row.category),
	gimmickType: csvGimmickType(row.category, row.movable),
	description: row.description,
	resource: { meshPath: row.meshPath, scale: 1 },
	stateVisuals: makeStateVisuals(`Obj_${row.objectId}`),
}));

/**
 * 난이도 테이블 초기값.
 *
 * 주의: `beamCount * solutionCrystalCount + spareCrystalCount` 는
 * 인벤토리 슬롯 상한(LASER_MAX_INVENTORY_SLOTS)을 넘을 수 없다.
 * 넘으면 생성기가 어떤 레벨도 만들지 못한다.
 *
 * 난이도는 기획 CSV 인덱스(80 0 01 [난이도2] [순서3])에 맞춰 1~6 을 모두 정의한다.
 */
export const DEFAULT_LASER_DIFFICULTY_TABLE: LaserDifficultyConfig[] = [
	{
		difficulty: 1,
		timeLimitSeconds: 120,
		roundCount: 1,
		solutionCrystalCount: 1,
		spareCrystalCount: 1,
		relayCount: 0,
		skullCount: 0,
		beamCount: 1,
	},
	{
		difficulty: 2,
		timeLimitSeconds: 150,
		roundCount: 2,
		solutionCrystalCount: 2,
		spareCrystalCount: 1,
		relayCount: 0,
		skullCount: 1,
		beamCount: 1,
	},
	{
		difficulty: 3,
		timeLimitSeconds: 180,
		roundCount: 2,
		solutionCrystalCount: 2,
		spareCrystalCount: 2,
		relayCount: 1,
		skullCount: 1,
		beamCount: 1,
	},
	{
		// 빔 2개 x 해 크리스탈 2개 + 여분 1개 = 5슬롯
		difficulty: 4,
		timeLimitSeconds: 210,
		roundCount: 3,
		solutionCrystalCount: 2,
		spareCrystalCount: 1,
		relayCount: 1,
		skullCount: 1,
		beamCount: 2,
	},
	{
		// 슬롯은 D4 와 같고, 중계체를 늘리고 제한시간 대비 난도를 올린다
		difficulty: 5,
		timeLimitSeconds: 240,
		roundCount: 3,
		solutionCrystalCount: 2,
		spareCrystalCount: 1,
		relayCount: 2,
		skullCount: 2,
		beamCount: 2,
	},
	{
		// 기획 CSV 최고 난이도. 필드 테이블에 10판이 들어 있다
		difficulty: 6,
		timeLimitSeconds: 270,
		roundCount: 3,
		solutionCrystalCount: 2,
		spareCrystalCount: 1,
		relayCount: 2,
		skullCount: 2,
		beamCount: 2,
	},
];

/**
 * 필드 테이블 초기값 - 손으로 배치하고 광선 추적기로 검증한 튜토리얼용 한 판.
 *
 * 전체 7x7. 발사체는 왼쪽 변 (3,0) 에서 오른쪽으로 쏘고,
 * 수신체는 위쪽 변 (0,3) 에 있다.
 * 배치 로컬 (2,2)(= 전체 (3,3)) 에 `/` 반사가 되는 삼각형을 놓으면 RIGHT -> UP 으로 꺾여 도달한다.
 */
export const DEFAULT_LASER_FIELD_TABLE: LaserFieldTableEntry[] = [
	{
		puzzleId: 'LZ_D1_001',
		difficulty: 1,
		gimmicks: [
			{ id: 'EMIT_RED', type: EGimmickType.EMITTER, row: 3, col: 0, colors: [ELaserColor.RED] },
			{ id: 'RECV_RED', type: EGimmickType.RECEIVER, row: 0, col: 3, colors: [ELaserColor.RED] },
		],
		presetCrystals: [],
		inventory: [
			{ id: 'INV_TRI_0', type: ECrystalType.TRIANGLE, corner: ETriangleCorner.BOTTOM_RIGHT },
			{ id: 'INV_TEE_0', type: ECrystalType.TEE, blockedSide: ETeeBlockedSide.BLOCKED_DOWN },
		],
	},
];

/**
 * 실제로 쓰는 필드 테이블.
 *
 * 기획 CSV(`Laser_FieldData.ts`)가 있으면 그것을 쓰고, 없으면 위의 손 배치 한 판으로 떨어진다.
 * 난이도에 해당하는 행이 하나도 없으면 세션이 절차적 생성기로 폴백한다 (`Laser_Session.loadLevel`).
 */
export const LASER_FIELD_TABLE: LaserFieldTableEntry[] =
	LASER_CSV_FIELD_TABLE.length > 0 ? LASER_CSV_FIELD_TABLE : DEFAULT_LASER_FIELD_TABLE;

/** 메인 테이블 초기값 */
export const DEFAULT_LASER_MAIN_TABLE: LaserMainTableEntry[] = DEFAULT_LASER_DIFFICULTY_TABLE.map((config) => ({
	questId: `QUEST_LASER_D${config.difficulty}`,
	questName: `레이저 해킹 D${config.difficulty}`,
	difficulty: config.difficulty,
	timeLimitSeconds: config.timeLimitSeconds,
	roundCount: config.roundCount,
	puzzleIds: LASER_FIELD_TABLE
		.filter((field) => field.difficulty === config.difficulty)
		.map((field) => field.puzzleId),
}));

//#endregion

//#region Table access

export class LaserTables {
	private _mainTable: LaserMainTableEntry[] = DEFAULT_LASER_MAIN_TABLE;
	private _difficultyTable: LaserDifficultyConfig[] = DEFAULT_LASER_DIFFICULTY_TABLE;
	private _fieldTable: LaserFieldTableEntry[] = LASER_FIELD_TABLE;
	private _objectTable: LaserObjectTableEntry[] = DEFAULT_LASER_OBJECT_TABLE.concat(LASER_CSV_OBJECT_TABLE);

	public loadMainTable(entries: LaserMainTableEntry[]): void {
		this._mainTable = entries;
	}

	public loadDifficultyTable(entries: LaserDifficultyConfig[]): void {
		this._difficultyTable = entries;
	}

	public loadFieldTable(entries: LaserFieldTableEntry[]): void {
		this._fieldTable = entries;
	}

	public loadObjectTable(entries: LaserObjectTableEntry[]): void {
		this._objectTable = entries;
	}

	public get mainTable(): readonly LaserMainTableEntry[] {
		return this._mainTable;
	}

	public get difficultyTable(): readonly LaserDifficultyConfig[] {
		return this._difficultyTable;
	}

	public get fieldTable(): readonly LaserFieldTableEntry[] {
		return this._fieldTable;
	}

	public get objectTable(): readonly LaserObjectTableEntry[] {
		return this._objectTable;
	}

	public getQuest(questId: string): LaserMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.questId === questId);
	}

	public getQuestByDifficulty(difficulty: number): LaserMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.difficulty === difficulty);
	}

	public getDifficultyConfig(difficulty: number): LaserDifficultyConfig | undefined {
		return this._difficultyTable.find((entry) => entry.difficulty === difficulty);
	}

	public getField(puzzleId: string): LaserFieldTableEntry | undefined {
		return this._fieldTable.find((entry) => entry.puzzleId === puzzleId);
	}

	public getFieldsForDifficulty(difficulty: number): LaserFieldTableEntry[] {
		return this._fieldTable.filter((entry) => entry.difficulty === difficulty);
	}

	public getObject(objectId: string): LaserObjectTableEntry | undefined {
		return this._objectTable.find((entry) => entry.objectId === objectId);
	}

	public getObjectForCrystal(type: ECrystalType): LaserObjectTableEntry | undefined {
		return this._objectTable.find((entry) => entry.crystalType === type);
	}

	public getObjectForGimmick(type: EGimmickType): LaserObjectTableEntry | undefined {
		return this._objectTable.find((entry) => entry.gimmickType === type);
	}

	/** 상태별 연출 정보 - PUZ_00 §5 */
	public getStateVisual(objectId: string, state: EObjectState): LaserStateVisual | undefined {
		return this.getObject(objectId)?.stateVisuals[state];
	}

	/** 필드 테이블 한 행을 플레이 가능한 레벨로 변환한다 */
	public buildLevel(field: LaserFieldTableEntry): LaserLevel {
		return {
			puzzleId: field.puzzleId,
			difficulty: field.difficulty,
			gimmicks: field.gimmicks.map(cloneGimmick),
			presetCrystals: field.presetCrystals.map(clonePlacedCrystal),
			inventory: field.inventory.map(cloneCrystal),
		};
	}

	/** 생성기 결과를 필드 테이블 행으로 되돌린다 */
	public toFieldEntry(level: LaserLevel): LaserFieldTableEntry {
		return {
			puzzleId: level.puzzleId,
			difficulty: level.difficulty,
			gimmicks: level.gimmicks.map(cloneGimmick),
			presetCrystals: level.presetCrystals.map(clonePlacedCrystal),
			inventory: level.inventory.map(cloneCrystal),
		};
	}
}

//#endregion
