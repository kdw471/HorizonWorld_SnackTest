/**
 * Flow Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_05 §8)
 *
 *   [PUZ 메인 테이블]      난이도별 제한시간 / 라운드 수 / 소속 퍼즐 ID
 *   [연결 퍼즐 필드 테이블]  퍼즐별 타일 생성 좌표 / 오브젝트 배치 좌표 / 수량
 *   [오브젝트 테이블]      메인 / 서브 오브젝트 ID 와 리소스
 *
 * PUZ_00 §7.2 에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.
 */

import {
	ALL_FLOW_COLORS,
	ENodeKind,
	FlowLevel,
	FlowNode,
	cloneNode,
	cloneTiles,
	countTiles,
	formatTileBitmap,
	parseTileBitmap,
} from 'Flow_Definitions';

//#region Tile masks (§3)

/**
 * 사양 §3 에 예시로 제시된 타일 비트맵들.
 * 1 = 타일 있음, 0 = 없음. 각 마스크는 7줄 x 7글자다.
 */
export const FLOW_TILE_MASKS: { [name: string]: string[] } = {
	/** 전체 49칸 */
	FULL: [
		'1111111',
		'1111111',
		'1111111',
		'1111111',
		'1111111',
		'1111111',
		'1111111',
	],
	/**
	 * 네 귀퉁이 안쪽에 구멍이 뚫린 형태 (§3 예시 1).
	 *
	 * 주의: 이 마스크는 이분 그래프 불균형이 3이라 **해밀턴 경로가 존재할 수 없다**
	 * (45칸 = 21 / 24). 그래서 경로 분해 방식 생성기가 쓸 수 없어 난이도 설정에서 제외했다.
	 * 손으로 배치한 필드 테이블에서는 쓸 수 있다.
	 */
	HOLES: [
		'1111111',
		'1011101',
		'1111111',
		'1111111',
		'1111111',
		'1011101',
		'1111111',
	],
	/** 십자 형태 (§3 예시 2) */
	CROSS: [
		'0011100',
		'0011100',
		'1111111',
		'1111111',
		'1111111',
		'0011100',
		'0011100',
	],
	/** 계단 형태 (§3 예시 3) */
	STAIR: [
		'0000111',
		'0000111',
		'1111111',
		'1111100',
		'1111100',
		'1111100',
		'1111100',
	],
	/** 가운데가 갈라진 형태 (§3 예시 4) */
	SPLIT: [
		'1111111',
		'1111111',
		'1100011',
		'1100011',
		'1100011',
		'1111111',
		'1111111',
	],
};

//#endregion

//#region Table types

export type FlowDifficultyConfig = {
	difficulty: number,
	timeLimitSeconds: number,
	/** 퍼즐 퀘스트당 1~3 라운드 - PUZ_00 §3 */
	roundCount: number,
	/** 사용할 타일 마스크 이름들. 생성 시 하나를 고른다 */
	tileMaskNames: string[],
	/** 색상 수 (= 메인 오브젝트 쌍의 수 = 경로 개수) */
	colorCount: number,
}

export type FlowMainTableEntry = {
	questId: string,
	questName: string,
	difficulty: number,
	timeLimitSeconds: number,
	roundCount: number,
	puzzleIds: string[],
}

/** 필드 테이블 한 행 - §8 */
export type FlowFieldTableEntry = {
	puzzleId: string,
	difficulty: number,
	/** 퍼즐 타일 생성 좌표 값 - 0/1 비트맵 7줄 */
	tileBitmap: string[],
	/** 오브젝트 배치 좌표 값 */
	nodes: FlowNode[],
	/** 오브젝트 수량 값 */
	mainCount: number,
	subCount: number,
	colorCount: number,
}

export type FlowResourceInfo = {
	meshPath: string,
	scale: number,
}

export type FlowStateVisual = {
	materialId: string,
	vfxId: string,
	sfxId: string,
}

export type FlowObjectTableEntry = {
	objectId: string,
	kind: ENodeKind,
	description: string,
	resource: FlowResourceInfo,
	stateVisuals: { [state: string]: FlowStateVisual },
}

//#endregion

//#region Default data

function makeBulbVisuals(prefix: string): { [state: string]: FlowStateVisual } {
	return {
		Off: { materialId: `${prefix}_Off`, vfxId: '', sfxId: '' },
		On: { materialId: `${prefix}_On`, vfxId: `${prefix}_Light`, sfxId: `${prefix}_Light` },
		/** 상호작용 가능한 상태 - §6 "빛을 내는 상태를 유지" */
		Interactable: { materialId: `${prefix}_Ready`, vfxId: `${prefix}_Glow`, sfxId: '' },
	};
}

/** 오브젝트 테이블 초기값 - §8 (메인 / 서브 오브젝트) */
export const DEFAULT_FLOW_OBJECT_TABLE: FlowObjectTableEntry[] = [
	{
		objectId: 'MAIN_BULB',
		kind: ENodeKind.MAIN,
		description: '색상을 가진 전구. 출발 / 도착 지점으로 존재한다 (§4)',
		resource: { meshPath: 'Flow/MainBulb', scale: 1 },
		stateVisuals: makeBulbVisuals('MainBulb'),
	},
	{
		objectId: 'SUB_BULB',
		kind: ENodeKind.SUB,
		description: '색상이 없는 회색 전구. 연결된 메인의 색을 하나만 부여받는다 (§4)',
		resource: { meshPath: 'Flow/SubBulb', scale: 1 },
		stateVisuals: makeBulbVisuals('SubBulb'),
	},
];

/**
 * 난이도 테이블 초기값.
 *
 * 색상 수가 많을수록 경로가 짧게 쪼개져 어려워진다.
 * 타일 마스크가 복잡할수록(구멍이 많을수록) 지나갈 수 있는 길이 제한되어 어려워진다.
 */
export const DEFAULT_FLOW_DIFFICULTY_TABLE: FlowDifficultyConfig[] = [
	{
		difficulty: 1,
		timeLimitSeconds: 90,
		roundCount: 1,
		tileMaskNames: ['CROSS'],
		colorCount: 2,
	},
	{
		difficulty: 2,
		timeLimitSeconds: 110,
		roundCount: 2,
		tileMaskNames: ['CROSS', 'SPLIT'],
		colorCount: 3,
	},
	{
		difficulty: 3,
		timeLimitSeconds: 130,
		roundCount: 2,
		tileMaskNames: ['SPLIT', 'STAIR'],
		colorCount: 4,
	},
	{
		difficulty: 4,
		timeLimitSeconds: 150,
		roundCount: 3,
		tileMaskNames: ['FULL', 'SPLIT'],
		colorCount: 5,
	},
	{
		difficulty: 5,
		timeLimitSeconds: 170,
		roundCount: 3,
		tileMaskNames: ['FULL', 'SPLIT', 'STAIR'],
		colorCount: 6,
	},
];

/** 필드 테이블 초기값. 비어 있으면 레벨 생성기가 런타임에 만든다 (PUZ_00 §7.3) */
export const DEFAULT_FLOW_FIELD_TABLE: FlowFieldTableEntry[] = [];

export const DEFAULT_FLOW_MAIN_TABLE: FlowMainTableEntry[] = DEFAULT_FLOW_DIFFICULTY_TABLE.map((config) => ({
	questId: `QUEST_FLOW_D${config.difficulty}`,
	questName: `전선 연결 D${config.difficulty}`,
	difficulty: config.difficulty,
	timeLimitSeconds: config.timeLimitSeconds,
	roundCount: config.roundCount,
	puzzleIds: DEFAULT_FLOW_FIELD_TABLE
		.filter((field) => field.difficulty === config.difficulty)
		.map((field) => field.puzzleId),
}));

//#endregion

//#region Table access

export class FlowTables {
	private _mainTable: FlowMainTableEntry[] = DEFAULT_FLOW_MAIN_TABLE;
	private _difficultyTable: FlowDifficultyConfig[] = DEFAULT_FLOW_DIFFICULTY_TABLE;
	private _fieldTable: FlowFieldTableEntry[] = DEFAULT_FLOW_FIELD_TABLE;
	private _objectTable: FlowObjectTableEntry[] = DEFAULT_FLOW_OBJECT_TABLE;
	private _tileMasks: { [name: string]: string[] } = FLOW_TILE_MASKS;

	public loadMainTable(entries: FlowMainTableEntry[]): void {
		this._mainTable = entries;
	}

	public loadDifficultyTable(entries: FlowDifficultyConfig[]): void {
		this._difficultyTable = entries;
	}

	public loadFieldTable(entries: FlowFieldTableEntry[]): void {
		this._fieldTable = entries;
	}

	public loadObjectTable(entries: FlowObjectTableEntry[]): void {
		this._objectTable = entries;
	}

	public loadTileMasks(masks: { [name: string]: string[] }): void {
		this._tileMasks = masks;
	}

	public get mainTable(): readonly FlowMainTableEntry[] {
		return this._mainTable;
	}

	public get difficultyTable(): readonly FlowDifficultyConfig[] {
		return this._difficultyTable;
	}

	public get fieldTable(): readonly FlowFieldTableEntry[] {
		return this._fieldTable;
	}

	public get objectTable(): readonly FlowObjectTableEntry[] {
		return this._objectTable;
	}

	public getQuest(questId: string): FlowMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.questId === questId);
	}

	public getQuestByDifficulty(difficulty: number): FlowMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.difficulty === difficulty);
	}

	public getDifficultyConfig(difficulty: number): FlowDifficultyConfig | undefined {
		return this._difficultyTable.find((entry) => entry.difficulty === difficulty);
	}

	public getField(puzzleId: string): FlowFieldTableEntry | undefined {
		return this._fieldTable.find((entry) => entry.puzzleId === puzzleId);
	}

	public getFieldsForDifficulty(difficulty: number): FlowFieldTableEntry[] {
		return this._fieldTable.filter((entry) => entry.difficulty === difficulty);
	}

	public getObject(objectId: string): FlowObjectTableEntry | undefined {
		return this._objectTable.find((entry) => entry.objectId === objectId);
	}

	public getObjectForKind(kind: ENodeKind): FlowObjectTableEntry | undefined {
		return this._objectTable.find((entry) => entry.kind === kind);
	}

	/** 이름으로 타일 마스크를 가져와 비트맵으로 변환한다 */
	public getTileMask(name: string): boolean[][] | undefined {
		const lines = this._tileMasks[name];
		if (lines === undefined) {
			return undefined;
		}
		return parseTileBitmap(lines);
	}

	public getTileMaskNames(): string[] {
		return Object.keys(this._tileMasks);
	}

	public buildLevel(field: FlowFieldTableEntry): FlowLevel | undefined {
		const tiles = parseTileBitmap(field.tileBitmap);
		if (tiles === undefined) {
			console.warn(`[FlowTables] Invalid tile bitmap in field '${field.puzzleId}'`);
			return undefined;
		}

		return {
			puzzleId: field.puzzleId,
			difficulty: field.difficulty,
			tiles: tiles,
			nodes: field.nodes.map(cloneNode),
			colorCount: field.colorCount,
		};
	}

	public toFieldEntry(level: FlowLevel): FlowFieldTableEntry {
		let mainCount = 0;
		let subCount = 0;
		for (const node of level.nodes) {
			if (node.kind === ENodeKind.MAIN) {
				mainCount++;
			}
			else {
				subCount++;
			}
		}

		return {
			puzzleId: level.puzzleId,
			difficulty: level.difficulty,
			tileBitmap: formatTileBitmap(level.tiles),
			nodes: level.nodes.map(cloneNode),
			mainCount: mainCount,
			subCount: subCount,
			colorCount: level.colorCount,
		};
	}
}

/**
 * 난이도 설정이 필드 규격에 맞는지 확인한다.
 * 위반하면 생성기가 어떤 레벨도 만들지 못하므로 미리 걸러낸다.
 */
export function validateDifficultyConfig(config: FlowDifficultyConfig, tables: FlowTables): string[] {
	const violations: string[] = [];

	if (config.colorCount < 1 || config.colorCount > ALL_FLOW_COLORS.length) {
		violations.push(`Color count must be within 1~${ALL_FLOW_COLORS.length} (got ${config.colorCount}).`);
	}
	if (config.tileMaskNames.length === 0) {
		violations.push('No tile masks specified.');
	}

	for (const name of config.tileMaskNames) {
		const mask = tables.getTileMask(name);
		if (mask === undefined) {
			violations.push(`Tile mask '${name}' not found.`);
			continue;
		}

		// 경로마다 최소 2칸(출발 MAIN + 도착 MAIN)이 필요하다
		const tileCount = countTiles(mask);
		if (tileCount < config.colorCount * 2) {
			violations.push(`Mask '${name}' has only ${tileCount} tiles - cannot hold ${config.colorCount} colors (needs at least ${config.colorCount * 2} tiles).`);
		}
	}

	return violations;
}

//#endregion
