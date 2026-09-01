/**
 * Switch Puzzle Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_08 §8)
 *
 *   [PUZ 메인 테이블]       난이도별 제한시간 / 라운드 수 / 소속 퍼즐 ID
 *   [NPUZ_08_FieldData]     스위치 영역 ID / 키 캡 레이아웃(5×5, FREE 포함) / 역셔플 누름 횟수 K
 *   [NPUZ_08_ObjectData]    스위치 영역 ID / sSwitchArray (3×3 마스크)
 *
 * PUZ_00 §7.2 에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.
 *
 * §5 상태 표기 노트: 문서 도식의 라벨과 텍스트 정의가 상이하므로,
 * 구현은 **1 = 눌림(녹색/목표), 0 = 안 눌림(빨강)** 으로 통일한다.
 * 외부 데이터가 반대 표기라면 임포터에서 한 번만 매핑한다.
 */

import {
	getMaskViolations,
	parseKeyLayout,
	parseSwitchMask,
} from 'Switch_Definitions';

//#region Table types

/** NPUZ_08_ObjectData 한 행 - §8. 라운드마다 다른 스위치 영역을 제공한다 (§6) */
export type SwitchObjectTableEntry = {
	/** 스위치 영역 ID */
	switchAreaId: string,
	/** 표시용 이름 */
	name: string,
	/** sSwitchArray - 3×3 마스크 ('0'/'1' 3행). 중앙은 항상 '1' (§6) */
	maskRows: string[],
}

/** NPUZ_08_FieldData 한 행 - §8 */
export type SwitchFieldTableEntry = {
	index: number,
	puzzleId: string,
	difficulty: number,
	/** 이 필드가 쓰는 스위치 영역 ID */
	switchAreaId: string,
	/** 키 캡 배치 (5행 × 5글자). 'O' = 키 캡, '.' = FREE (§4) */
	layoutRows: string[],
	/** 역셔플 누름 횟수 K - §9.4. 난이도의 1차 결정 요소 */
	shuffleCount: number,
}

export type SwitchDifficultyConfig = {
	difficulty: number,
	timeLimitSeconds: number,
	/** 퍼즐 퀘스트당 1~3 라운드 - PUZ_00 §3 */
	roundCount: number,
	/** 사용할 필드 데이터 index 들 */
	fieldIndexes: number[],
}

export type SwitchMainTableEntry = {
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
 * 오브젝트 테이블 초기값 - 스위치 영역(sSwitchArray) 카탈로그.
 * 모든 마스크는 중앙 '1' 을 포함한다 (§6). 마스크가 복잡할수록 어렵다 (§9.4).
 */
export const DEFAULT_SWITCH_OBJECT_TABLE: SwitchObjectTableEntry[] = [
	{ switchAreaId: 'SW_AREA_PLUS', name: '십자', maskRows: ['010', '111', '010'] },
	{ switchAreaId: 'SW_AREA_X', name: '대각', maskRows: ['101', '010', '101'] },
	{ switchAreaId: 'SW_AREA_ROW', name: '가로줄', maskRows: ['000', '111', '000'] },
	{ switchAreaId: 'SW_AREA_COL', name: '세로줄', maskRows: ['010', '010', '010'] },
	{ switchAreaId: 'SW_AREA_CORNER', name: '꺾쇠', maskRows: ['011', '010', '110'] },
	{ switchAreaId: 'SW_AREA_FULL', name: '전체', maskRows: ['111', '111', '111'] },
];

/** 5×5 전체 사용 레이아웃 - §4 도식 좌측 */
const LAYOUT_FULL_5X5 = [
	'OOOOO',
	'OOOOO',
	'OOOOO',
	'OOOOO',
	'OOOOO',
];

/** 중앙 3×3 만 사용 - §4 도식 우측 예시 */
const LAYOUT_CENTER_3X3 = [
	'.....',
	'.OOO.',
	'.OOO.',
	'.OOO.',
	'.....',
];

/** FREE 구멍이 있는 변형 레이아웃 - 난이도용 (§9.4 "FREE 비율로 조절") */
const LAYOUT_DIAMOND = [
	'..O..',
	'.OOO.',
	'OOOOO',
	'.OOO.',
	'..O..',
];

/**
 * 필드 테이블 초기값.
 * 난이도는 K(역셔플 누름 횟수), 사용 칸 수(FREE 비율), 마스크 복잡도로 조절한다 (§9.4).
 * K 는 사용 칸 수 이하여야 한다 - 역셔플이 서로 다른 칸만 누르기 때문이다.
 */
export const DEFAULT_SWITCH_FIELD_TABLE: SwitchFieldTableEntry[] = [
	{ index: 1, puzzleId: 'SW_D1_001', difficulty: 1, switchAreaId: 'SW_AREA_PLUS', layoutRows: LAYOUT_CENTER_3X3, shuffleCount: 3 },
	{ index: 2, puzzleId: 'SW_D2_001', difficulty: 2, switchAreaId: 'SW_AREA_X', layoutRows: LAYOUT_CENTER_3X3, shuffleCount: 5 },
	{ index: 3, puzzleId: 'SW_D3_001', difficulty: 3, switchAreaId: 'SW_AREA_PLUS', layoutRows: LAYOUT_FULL_5X5, shuffleCount: 7 },
	{ index: 4, puzzleId: 'SW_D4_001', difficulty: 4, switchAreaId: 'SW_AREA_CORNER', layoutRows: LAYOUT_FULL_5X5, shuffleCount: 10 },
	{ index: 5, puzzleId: 'SW_D5_001', difficulty: 5, switchAreaId: 'SW_AREA_FULL', layoutRows: LAYOUT_DIAMOND, shuffleCount: 12 },
];

export const DEFAULT_SWITCH_DIFFICULTY_TABLE: SwitchDifficultyConfig[] = [
	{ difficulty: 1, timeLimitSeconds: 60, roundCount: 1, fieldIndexes: [1] },
	{ difficulty: 2, timeLimitSeconds: 90, roundCount: 2, fieldIndexes: [2] },
	{ difficulty: 3, timeLimitSeconds: 120, roundCount: 2, fieldIndexes: [3] },
	{ difficulty: 4, timeLimitSeconds: 150, roundCount: 3, fieldIndexes: [4] },
	{ difficulty: 5, timeLimitSeconds: 180, roundCount: 3, fieldIndexes: [5] },
];

export const DEFAULT_SWITCH_MAIN_TABLE: SwitchMainTableEntry[] = DEFAULT_SWITCH_DIFFICULTY_TABLE.map((config) => ({
	questId: `QUEST_SWITCH_D${config.difficulty}`,
	questName: `스위치 퍼즐 D${config.difficulty}`,
	difficulty: config.difficulty,
	timeLimitSeconds: config.timeLimitSeconds,
	roundCount: config.roundCount,
	puzzleIds: DEFAULT_SWITCH_FIELD_TABLE
		.filter((field) => config.fieldIndexes.indexOf(field.index) >= 0)
		.map((field) => field.puzzleId),
}));

//#endregion

//#region Table access

export class SwitchPuzzleTables {
	private _mainTable: SwitchMainTableEntry[] = DEFAULT_SWITCH_MAIN_TABLE;
	private _difficultyTable: SwitchDifficultyConfig[] = DEFAULT_SWITCH_DIFFICULTY_TABLE;
	private _fieldTable: SwitchFieldTableEntry[] = DEFAULT_SWITCH_FIELD_TABLE;
	private _objectTable: SwitchObjectTableEntry[] = DEFAULT_SWITCH_OBJECT_TABLE;

	public loadMainTable(entries: SwitchMainTableEntry[]): void {
		this._mainTable = entries;
	}

	public loadDifficultyTable(entries: SwitchDifficultyConfig[]): void {
		this._difficultyTable = entries;
	}

	public loadFieldTable(entries: SwitchFieldTableEntry[]): void {
		this._fieldTable = entries;
	}

	public loadObjectTable(entries: SwitchObjectTableEntry[]): void {
		this._objectTable = entries;
	}

	public get mainTable(): readonly SwitchMainTableEntry[] {
		return this._mainTable;
	}

	public get difficultyTable(): readonly SwitchDifficultyConfig[] {
		return this._difficultyTable;
	}

	public get fieldTable(): readonly SwitchFieldTableEntry[] {
		return this._fieldTable;
	}

	public get objectTable(): readonly SwitchObjectTableEntry[] {
		return this._objectTable;
	}

	public getQuest(questId: string): SwitchMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.questId === questId);
	}

	public getQuestByDifficulty(difficulty: number): SwitchMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.difficulty === difficulty);
	}

	public getDifficultyConfig(difficulty: number): SwitchDifficultyConfig | undefined {
		return this._difficultyTable.find((entry) => entry.difficulty === difficulty);
	}

	public getField(index: number): SwitchFieldTableEntry | undefined {
		return this._fieldTable.find((entry) => entry.index === index);
	}

	public getFieldByPuzzleId(puzzleId: string): SwitchFieldTableEntry | undefined {
		return this._fieldTable.find((entry) => entry.puzzleId === puzzleId);
	}

	public getFieldsForDifficulty(difficulty: number): SwitchFieldTableEntry[] {
		return this._fieldTable.filter((entry) => entry.difficulty === difficulty);
	}

	public getSwitchArea(switchAreaId: string): SwitchObjectTableEntry | undefined {
		return this._objectTable.find((entry) => entry.switchAreaId === switchAreaId);
	}

	/** 스위치 영역 ID 의 마스크를 파싱해 돌려준다 - §6 / §8 */
	public getMask(switchAreaId: string): number[] | undefined {
		const entry = this.getSwitchArea(switchAreaId);
		if (entry === undefined) {
			return undefined;
		}
		return parseSwitchMask(entry.maskRows);
	}
}

//#endregion

//#region Validation

/**
 * 필드 데이터가 §4 / §6 / §9 의 규격을 지키는지 확인한다.
 * 위반하면 생성기가 레벨을 만들지 않고 바로 알린다.
 */
export function validateFieldData(field: SwitchFieldTableEntry, tables: SwitchPuzzleTables): string[] {
	const violations: string[] = [];

	// §4 - 키 캡 레이아웃은 5×5, 'O'/'.' 만 허용
	const usable = parseKeyLayout(field.layoutRows);
	if (usable === undefined) {
		violations.push(`Layout must be 5 rows x 5 chars ('O'/'.').`);
	}
	else {
		const usableCount = usable.filter((flag) => flag === true).length;
		if (usableCount < 2) {
			violations.push(`At least 2 key caps are required for a valid puzzle (got ${usableCount}).`);
		}
		// 역셔플은 서로 다른 칸만 누르므로 K 는 사용 칸 수를 넘을 수 없다
		if (field.shuffleCount > usableCount) {
			violations.push(`Reverse-shuffle press count ${field.shuffleCount} exceeds the usable cell count ${usableCount}.`);
		}
	}

	if (field.shuffleCount < 1) {
		violations.push(`Reverse-shuffle press count must be 1 or more (got ${field.shuffleCount}).`);
	}

	// §6 - 스위치 영역이 존재하고 마스크가 유효해야 한다
	const areaEntry = tables.getSwitchArea(field.switchAreaId);
	if (areaEntry === undefined) {
		violations.push(`Switch area '${field.switchAreaId}' is not in the object table.`);
	}
	else {
		const mask = parseSwitchMask(areaEntry.maskRows);
		if (mask === undefined) {
			violations.push(`Cannot parse the mask of switch area '${field.switchAreaId}'.`);
		}
		else {
			violations.push(...getMaskViolations(mask));
		}
	}

	return violations;
}

/** 오브젝트 테이블 전체를 검사한다 - 중앙 미포함 마스크를 데이터 단계에서 걸러낸다 (§6) */
export function validateObjectTable(entries: readonly SwitchObjectTableEntry[]): string[] {
	const violations: string[] = [];
	const seen = new Set<string>();
	for (const entry of entries) {
		if (seen.has(entry.switchAreaId)) {
			violations.push(`Duplicate switch area ID '${entry.switchAreaId}'.`);
		}
		seen.add(entry.switchAreaId);

		const mask = parseSwitchMask(entry.maskRows);
		if (mask === undefined) {
			violations.push(`'${entry.switchAreaId}': mask must be 3 rows x 3 chars ('0'/'1').`);
			continue;
		}
		for (const violation of getMaskViolations(mask)) {
			violations.push(`'${entry.switchAreaId}': ${violation}`);
		}
	}
	return violations;
}

//#endregion
