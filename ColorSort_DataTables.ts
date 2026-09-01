/**
 * Color Sort Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_03 §9)
 *
 *   [PUZ 메인 테이블]        난이도별 제한시간 / 라운드 수 / 소속 퍼즐 ID
 *   [정렬 퍼즐 필드 테이블]   퍼즐별 오브젝트 배치 좌표 / 종류 / 개수 / 활성 케이스 수량
 *   [오브젝트 테이블]        오브젝트 ID / 리소스 / 상태별 연출
 *
 * PUZ_00 §7.2 에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.
 */

import {
	ALL_BATTERY_COLORS,
	BatteryCase,
	CASE_CAPACITY,
	ColorSortLevel,
	EBatteryColor,
	ECaseState,
	MAX_SPARE_CASE_COUNT,
	MIN_SPARE_CASE_COUNT,
	TOTAL_CASE_COUNT,
	cloneCase,
} from 'ColorSort_Definitions';

//#region Table types

/** 난이도별 기본 룰 */
export type ColorSortDifficultyConfig = {
	difficulty: number,
	timeLimitSeconds: number,
	/** 퍼즐 퀘스트당 1~3 라운드 - PUZ_00 §3 */
	roundCount: number,
	/** 사용할 색상 수. 색상 하나당 케이스 하나를 채운다 */
	colorCount: number,
	/** 여분(빈) 케이스 수 - §4 (1~6) */
	spareCaseCount: number,
	/** 완성 상태에서 역방향으로 섞는 횟수. 클수록 어렵다 */
	shuffleMoveCount: number,
	/** 블랙(미지) 건전지 수 - §7 */
	unknownBatteryCount: number,
}

export type ColorSortMainTableEntry = {
	questId: string,
	questName: string,
	difficulty: number,
	timeLimitSeconds: number,
	roundCount: number,
	puzzleIds: string[],
}

/** 필드 테이블 한 행 */
export type ColorSortFieldTableEntry = {
	puzzleId: string,
	difficulty: number,
	/** 케이스별 배치. 배열 순서가 케이스 index 이며, 각 배열은 아래 -> 위 순서다 */
	cases: BatteryCase[],
	/** 활성화된 케이스의 수량 - §3 */
	activeCaseCount: number,
	/** 배치된 건전지 종류(색상) 수 */
	colorCount: number,
	/** 배치된 건전지 총 개수 */
	batteryCount: number,
}

export type ColorSortResourceInfo = {
	meshPath: string,
	scale: number,
}

export type ColorSortStateVisual = {
	materialId: string,
	vfxId: string,
	sfxId: string,
}

export type ColorSortObjectTableEntry = {
	objectId: string,
	description: string,
	resource: ColorSortResourceInfo,
	/** 상태별 연출 정보 - PUZ_00 §5 / §4 케이스 상태 4종 */
	stateVisuals: { [state: string]: ColorSortStateVisual },
}

//#endregion

//#region Default data

function makeCaseVisuals(prefix: string): { [state: string]: ColorSortStateVisual } {
	const visuals: { [state: string]: ColorSortStateVisual } = {};
	visuals[ECaseState.OPEN] = { materialId: `${prefix}_Open`, vfxId: '', sfxId: '' };
	visuals[ECaseState.CLOSED_COMPLETE] = { materialId: `${prefix}_Closed`, vfxId: `${prefix}_Complete`, sfxId: `${prefix}_Complete` };
	visuals[ECaseState.DISABLED] = { materialId: `${prefix}_Disabled`, vfxId: '', sfxId: '' };
	visuals[ECaseState.LOCKED] = { materialId: `${prefix}_Locked`, vfxId: '', sfxId: `${prefix}_Locked` };
	return visuals;
}

function makeBatteryVisuals(color: EBatteryColor): { [state: string]: ColorSortStateVisual } {
	const visuals: { [state: string]: ColorSortStateVisual } = {};
	visuals['Revealed'] = { materialId: `Battery_${color}`, vfxId: '', sfxId: '' };
	visuals['Unknown'] = { materialId: 'Battery_Unknown', vfxId: '', sfxId: '' };
	visuals['Reveal'] = { materialId: `Battery_${color}`, vfxId: 'Battery_Reveal', sfxId: 'Battery_Reveal' };
	return visuals;
}

/** 오브젝트 테이블 초기값 - 케이스 1종 + 건전지 10색 + 블랙 건전지 */
export const DEFAULT_COLOR_SORT_OBJECT_TABLE: ColorSortObjectTableEntry[] = [
	{
		objectId: 'CASE',
		description: '건전지 4개가 들어가는 케이스. 종류는 1가지 (§3)',
		resource: { meshPath: 'ColorSort/Case', scale: 1 },
		stateVisuals: makeCaseVisuals('Case'),
	},
	{
		objectId: 'CASE_LID',
		description: '케이스 덮개. 같은 색으로 가득 차면 닫힌다 (§4)',
		resource: { meshPath: 'ColorSort/CaseLid', scale: 1 },
		stateVisuals: makeCaseVisuals('CaseLid'),
	},
	{
		objectId: 'BATTERY_UNKNOWN',
		description: '색상을 알 수 없는 블랙 건전지. 최상단에 노출되면 공개된다 (§7)',
		resource: { meshPath: 'ColorSort/Battery_Unknown', scale: 1 },
		stateVisuals: makeBatteryVisuals(EBatteryColor.GRAY),
	},
].concat(ALL_BATTERY_COLORS.map((color) => ({
	objectId: `BATTERY_${color}`,
	description: `${color} 건전지 (§5 - 색상은 총 10가지)`,
	resource: { meshPath: `ColorSort/Battery_${color}`, scale: 1 },
	stateVisuals: makeBatteryVisuals(color),
})));

/**
 * 난이도 테이블 초기값.
 *
 * 주의: `colorCount + spareCaseCount` 는 전체 케이스 수(8, §3)를 넘을 수 없고,
 * `spareCaseCount` 는 1~6 범위여야 한다 (§4).
 * 여분 케이스가 적을수록 자유도가 낮아 어려워진다.
 */
export const DEFAULT_COLOR_SORT_DIFFICULTY_TABLE: ColorSortDifficultyConfig[] = [
	{
		difficulty: 1,
		timeLimitSeconds: 120,
		roundCount: 1,
		colorCount: 3,
		spareCaseCount: 2,
		shuffleMoveCount: 12,
		unknownBatteryCount: 0,
	},
	{
		difficulty: 2,
		timeLimitSeconds: 150,
		roundCount: 2,
		colorCount: 4,
		spareCaseCount: 2,
		shuffleMoveCount: 20,
		unknownBatteryCount: 1,
	},
	{
		difficulty: 3,
		timeLimitSeconds: 180,
		roundCount: 2,
		colorCount: 5,
		spareCaseCount: 2,
		shuffleMoveCount: 30,
		unknownBatteryCount: 2,
	},
	{
		difficulty: 4,
		timeLimitSeconds: 210,
		roundCount: 3,
		colorCount: 6,
		spareCaseCount: 2,
		shuffleMoveCount: 40,
		unknownBatteryCount: 3,
	},
	{
		difficulty: 5,
		timeLimitSeconds: 240,
		roundCount: 3,
		colorCount: 6,
		// 여분 케이스를 최소치로 줄여 자유도를 크게 낮춘다
		spareCaseCount: MIN_SPARE_CASE_COUNT,
		shuffleMoveCount: 50,
		unknownBatteryCount: 3,
	},
];

/** 필드 테이블 초기값. 비어 있으면 레벨 생성기가 런타임에 만든다 (PUZ_00 §7.3) */
export const DEFAULT_COLOR_SORT_FIELD_TABLE: ColorSortFieldTableEntry[] = [];

export const DEFAULT_COLOR_SORT_MAIN_TABLE: ColorSortMainTableEntry[] = DEFAULT_COLOR_SORT_DIFFICULTY_TABLE.map((config) => ({
	questId: `QUEST_COLORSORT_D${config.difficulty}`,
	questName: `건전지 정렬 D${config.difficulty}`,
	difficulty: config.difficulty,
	timeLimitSeconds: config.timeLimitSeconds,
	roundCount: config.roundCount,
	puzzleIds: DEFAULT_COLOR_SORT_FIELD_TABLE
		.filter((field) => field.difficulty === config.difficulty)
		.map((field) => field.puzzleId),
}));

//#endregion

//#region Table access

export class ColorSortTables {
	private _mainTable: ColorSortMainTableEntry[] = DEFAULT_COLOR_SORT_MAIN_TABLE;
	private _difficultyTable: ColorSortDifficultyConfig[] = DEFAULT_COLOR_SORT_DIFFICULTY_TABLE;
	private _fieldTable: ColorSortFieldTableEntry[] = DEFAULT_COLOR_SORT_FIELD_TABLE;
	private _objectTable: ColorSortObjectTableEntry[] = DEFAULT_COLOR_SORT_OBJECT_TABLE;

	public loadMainTable(entries: ColorSortMainTableEntry[]): void {
		this._mainTable = entries;
	}

	public loadDifficultyTable(entries: ColorSortDifficultyConfig[]): void {
		this._difficultyTable = entries;
	}

	public loadFieldTable(entries: ColorSortFieldTableEntry[]): void {
		this._fieldTable = entries;
	}

	public loadObjectTable(entries: ColorSortObjectTableEntry[]): void {
		this._objectTable = entries;
	}

	public get mainTable(): readonly ColorSortMainTableEntry[] {
		return this._mainTable;
	}

	public get difficultyTable(): readonly ColorSortDifficultyConfig[] {
		return this._difficultyTable;
	}

	public get fieldTable(): readonly ColorSortFieldTableEntry[] {
		return this._fieldTable;
	}

	public get objectTable(): readonly ColorSortObjectTableEntry[] {
		return this._objectTable;
	}

	public getQuest(questId: string): ColorSortMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.questId === questId);
	}

	public getQuestByDifficulty(difficulty: number): ColorSortMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.difficulty === difficulty);
	}

	public getDifficultyConfig(difficulty: number): ColorSortDifficultyConfig | undefined {
		return this._difficultyTable.find((entry) => entry.difficulty === difficulty);
	}

	public getField(puzzleId: string): ColorSortFieldTableEntry | undefined {
		return this._fieldTable.find((entry) => entry.puzzleId === puzzleId);
	}

	public getFieldsForDifficulty(difficulty: number): ColorSortFieldTableEntry[] {
		return this._fieldTable.filter((entry) => entry.difficulty === difficulty);
	}

	public getObject(objectId: string): ColorSortObjectTableEntry | undefined {
		return this._objectTable.find((entry) => entry.objectId === objectId);
	}

	public getBatteryObject(color: EBatteryColor, isRevealed: boolean): ColorSortObjectTableEntry | undefined {
		return this.getObject(isRevealed ? `BATTERY_${color}` : 'BATTERY_UNKNOWN');
	}

	/** 케이스 상태별 연출 정보 - §4 */
	public getCaseStateVisual(state: ECaseState): ColorSortStateVisual | undefined {
		return this.getObject('CASE')?.stateVisuals[state];
	}

	public buildLevel(field: ColorSortFieldTableEntry): ColorSortLevel {
		return {
			puzzleId: field.puzzleId,
			difficulty: field.difficulty,
			cases: field.cases.map(cloneCase),
			colorCount: field.colorCount,
		};
	}

	public toFieldEntry(level: ColorSortLevel): ColorSortFieldTableEntry {
		let batteryCount = 0;
		let activeCaseCount = 0;
		for (const batteryCase of level.cases) {
			batteryCount += batteryCase.batteries.length;
			if (batteryCase.isActive) {
				activeCaseCount++;
			}
		}

		return {
			puzzleId: level.puzzleId,
			difficulty: level.difficulty,
			cases: level.cases.map(cloneCase),
			activeCaseCount: activeCaseCount,
			colorCount: level.colorCount,
			batteryCount: batteryCount,
		};
	}
}

/**
 * 난이도 설정이 사양의 케이스 규격을 지키는지 확인한다.
 * 위반하면 생성기가 어떤 레벨도 만들지 못하므로 미리 걸러낸다.
 */
export function validateDifficultyConfig(config: ColorSortDifficultyConfig): string[] {
	const violations: string[] = [];

	if (config.spareCaseCount < MIN_SPARE_CASE_COUNT || config.spareCaseCount > MAX_SPARE_CASE_COUNT) {
		violations.push(`Spare cases must be ${MIN_SPARE_CASE_COUNT}~${MAX_SPARE_CASE_COUNT} (got ${config.spareCaseCount}).`);
	}
	if (config.colorCount + config.spareCaseCount > TOTAL_CASE_COUNT) {
		violations.push(`Colors ${config.colorCount} + spares ${config.spareCaseCount} exceed the total case count ${TOTAL_CASE_COUNT}.`);
	}
	if (config.colorCount < 1 || config.colorCount > ALL_BATTERY_COLORS.length) {
		violations.push(`Color count must be within 1~${ALL_BATTERY_COLORS.length} (got ${config.colorCount}).`);
	}

	// 블랙 건전지는 최상단에 놓을 수 없으므로(§7), 케이스당 최대 capacity-1 개까지만 숨길 수 있다
	const maxHideable = config.colorCount * (CASE_CAPACITY - 1);
	if (config.unknownBatteryCount > maxHideable) {
		violations.push(`Black battery count ${config.unknownBatteryCount} exceeds the hideable maximum ${maxHideable}.`);
	}

	return violations;
}

//#endregion
