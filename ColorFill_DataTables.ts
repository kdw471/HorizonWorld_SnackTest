/**
 * Color Fill Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_04 §7)
 *
 *   [PUZ 메인 테이블]       난이도별 제한시간 / 라운드 수 / 소속 퍼즐 ID
 *   [색 채우기 필드 테이블]  퍼즐별 정화 / 오염 영역 값
 *   [오브젝트 테이블]       오브젝트 ID / 리소스 / 상태별 연출
 *
 * PUZ_00 §7.2 에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.
 */

import {
	ColorFillLevel,
	DIAL_SLOT_COUNT,
	DialSlot,
	ESlotState,
	cloneSlot,
} from 'ColorFill_Definitions';

//#region Table types

/** 난이도별 기본 룰 - §4 다이얼 영역 테이블 */
export type ColorFillDifficultyConfig = {
	difficulty: number,
	timeLimitSeconds: number,
	/** 퍼즐 퀘스트당 1~3 라운드 - PUZ_00 §3 */
	roundCount: number,
	/** 활성화 영역의 칸 수 - §4 */
	activeSlotCount: number,
	/**
	 * 오염 덩어리(그룹) 각각의 칸 수 - §4.
	 * 예) [5, 5] 는 5칸짜리 오염 덩어리 2개. 덩어리끼리는 서로 붙지 않게 배치된다.
	 */
	contaminationGroupSizes: number[],
	/** 바늘 회전 속도 (도/초) - §6 "난이도별로 다른 회전 속도" */
	needleSpeedDegPerSec: number,
	/** 방향 전환 딜레이 (초) - §6 */
	reverseDelaySeconds: number,
}

export type ColorFillMainTableEntry = {
	questId: string,
	questName: string,
	difficulty: number,
	timeLimitSeconds: number,
	roundCount: number,
	puzzleIds: string[],
}

/** 필드 테이블 한 행 - §7 "정화 / 오염 영역 값" */
export type ColorFillFieldTableEntry = {
	puzzleId: string,
	difficulty: number,
	/** 18칸 전체의 초기 상태 */
	slots: DialSlot[],
	needleSpeedDegPerSec: number,
	reverseDelaySeconds: number,
	startAngleDeg: number,
	/** 오염 칸 총 개수 */
	contaminatedCount: number,
}

export type ColorFillResourceInfo = {
	meshPath: string,
	/** 정화 머티리얼 - §5 "MI_NPUZ_04_Safescale, Set - MainColor (0 -> 1)" */
	materialId: string,
	/** 애니메이션 대상 파라미터 이름 */
	scalarParameterName: string,
}

export type ColorFillStateVisual = {
	materialId: string,
	/** MainColor 스칼라 값 - §5 (오염 0 -> 정화 1) */
	mainColor: number,
	vfxId: string,
	sfxId: string,
}

export type ColorFillObjectTableEntry = {
	objectId: string,
	description: string,
	resource: ColorFillResourceInfo,
	stateVisuals: { [state: string]: ColorFillStateVisual },
}

//#endregion

//#region Default data

/** 정화 머티리얼 - §5 */
const PURIFY_MATERIAL_ID = 'MI_NPUZ_04_Safescale';
const PURIFY_SCALAR_PARAMETER = 'MainColor';

export const DEFAULT_COLOR_FILL_OBJECT_TABLE: ColorFillObjectTableEntry[] = [
	{
		objectId: 'DIAL_SLOT',
		description: '다이얼 한 칸 (20도). 오염이면 붉은 색으로 표시한다 (§3)',
		resource: { meshPath: 'ColorFill/DialSlot', materialId: PURIFY_MATERIAL_ID, scalarParameterName: PURIFY_SCALAR_PARAMETER },
		stateVisuals: {
			// §5 - Set MainColor (0 -> 1)
			[ESlotState.CONTAMINATED]: { materialId: PURIFY_MATERIAL_ID, mainColor: 0, vfxId: '', sfxId: '' },
			[ESlotState.CLEAN]: { materialId: PURIFY_MATERIAL_ID, mainColor: 1, vfxId: 'Purify', sfxId: 'Purify' },
			Inactive: { materialId: PURIFY_MATERIAL_ID, mainColor: 1, vfxId: '', sfxId: '' },
		},
	},
	{
		objectId: 'DIAL_NEEDLE',
		description: '회전 바늘. 터치하면 방향이 반전된다 (§6)',
		resource: { meshPath: 'ColorFill/Needle', materialId: 'MI_NPUZ_04_Needle', scalarParameterName: '' },
		stateVisuals: {
			Clockwise: { materialId: 'MI_NPUZ_04_Needle', mainColor: 1, vfxId: '', sfxId: '' },
			CounterClockwise: { materialId: 'MI_NPUZ_04_Needle', mainColor: 1, vfxId: '', sfxId: '' },
			Reversing: { materialId: 'MI_NPUZ_04_Needle', mainColor: 1, vfxId: 'NeedleReverse', sfxId: 'NeedleReverse' },
		},
	},
	{
		objectId: 'TOUCH_BUTTON',
		description: '터치 버튼 - §3 "레벨에는 제한시간 / 정화영역 / 오염영역 / 터치 버튼이 존재한다"',
		resource: { meshPath: 'ColorFill/TouchButton', materialId: 'MI_NPUZ_04_Button', scalarParameterName: '' },
		stateVisuals: {
			Idle: { materialId: 'MI_NPUZ_04_Button', mainColor: 0, vfxId: '', sfxId: '' },
			Pressed: { materialId: 'MI_NPUZ_04_Button', mainColor: 1, vfxId: 'ButtonPress', sfxId: 'ButtonPress' },
			Locked: { materialId: 'MI_NPUZ_04_Button', mainColor: 0, vfxId: '', sfxId: '' },
		},
	},
];

/**
 * 난이도 테이블 초기값.
 *
 * ## 사양 §4 표의 모순과 그 처리
 *
 * 원본 §4 표는 다음과 같다.
 *
 * | 난이도 | 1 | 2 | 3 | 4 | 5 | 6 |
 * | 활성 칸 | 12 | 10 | 8 | 8 | 6 | 6 |
 * | 오염 칸 | 12-13 | 10 | 12-14 | 5/5 | 3/3/3 | 2/2/2/2 |
 *
 * 오염 영역은 활성 영역의 부분집합이어야 하는데 아래 난이도에서 오염이 활성보다 많다.
 *
 *   - 난이도 1: 활성 12 < 오염 13
 *   - 난이도 3: 활성 8  < 오염 12~14
 *   - 난이도 4: 활성 8  < 오염 5+5 = 10
 *   - 난이도 5: 활성 6  < 오염 3+3+3 = 9
 *   - 난이도 6: 활성 6  < 오염 2+2+2+2 = 8
 *
 * 원본 PDF 표가 옮겨지며 어긋난 것으로 보인다.
 * 여기서는 난이도 곡선을 결정하는 **오염 덩어리 구성(그룹 수와 크기)을 정본으로 삼고**,
 * 활성 칸 수는 그것을 담을 수 있도록 맞췄다. 덩어리가 많아질수록 어려워지는 의도는 그대로다.
 * 실제 표 값이 확인되면 이 테이블만 교체하면 된다.
 *
 * ## 제한 시간은 실측으로 잡았다
 *
 * 사양에 제한 시간 수치가 없어 자동 플레이 봇으로 재서 정했다.
 * 이 퍼즐은 **한 번의 터치가 오염 덩어리를 통째로 정화**하므로 필요한 터치가 덩어리 수만큼뿐이고,
 * 다이얼 한 바퀴가 2~4초라 놓쳐도 곧 다시 기회가 온다. 그래서 소요 시간이 본질적으로 짧다.
 *
 * 봇 실측(레벨 30개, 90퍼센타일): D1 0.8초 ~ D6 4.1초.
 * 반응 지연을 0.6초까지 늘려도 전부 클리어했다.
 * 사람은 좁은 타이밍 창을 여러 번 놓치므로 실측의 5~7배를 제한 시간으로 잡았다.
 * 처음에 60~100초로 잡았던 값은 근거 없이 헐거웠다.
 */
export const DEFAULT_COLOR_FILL_DIFFICULTY_TABLE: ColorFillDifficultyConfig[] = [
	{
		difficulty: 1,
		timeLimitSeconds: 15,
		roundCount: 1,
		activeSlotCount: 12,
		contaminationGroupSizes: [12],
		needleSpeedDegPerSec: 90,
		reverseDelaySeconds: 0.3,
	},
	{
		difficulty: 2,
		timeLimitSeconds: 15,
		roundCount: 1,
		activeSlotCount: 10,
		contaminationGroupSizes: [10],
		needleSpeedDegPerSec: 110,
		reverseDelaySeconds: 0.3,
	},
	{
		difficulty: 3,
		timeLimitSeconds: 18,
		roundCount: 2,
		activeSlotCount: 8,
		contaminationGroupSizes: [8],
		needleSpeedDegPerSec: 130,
		reverseDelaySeconds: 0.35,
	},
	{
		difficulty: 4,
		timeLimitSeconds: 22,
		roundCount: 2,
		// 원본은 활성 8 / 오염 5+5. 오염을 담을 수 있도록 활성을 10으로 올렸다.
		activeSlotCount: 10,
		contaminationGroupSizes: [5, 5],
		needleSpeedDegPerSec: 130,
		reverseDelaySeconds: 0.35,
	},
	{
		difficulty: 5,
		timeLimitSeconds: 26,
		roundCount: 3,
		// 원본은 활성 6 / 오염 3+3+3. 활성을 9로 올렸다.
		activeSlotCount: 9,
		contaminationGroupSizes: [3, 3, 3],
		needleSpeedDegPerSec: 150,
		reverseDelaySeconds: 0.4,
	},
	{
		difficulty: 6,
		timeLimitSeconds: 30,
		roundCount: 3,
		// 원본은 활성 6 / 오염 2+2+2+2. 활성을 8로 올렸다.
		activeSlotCount: 8,
		contaminationGroupSizes: [2, 2, 2, 2],
		needleSpeedDegPerSec: 160,
		reverseDelaySeconds: 0.4,
	},
];

/** 필드 테이블 초기값. 비어 있으면 레벨 생성기가 런타임에 만든다 (PUZ_00 §7.3) */
export const DEFAULT_COLOR_FILL_FIELD_TABLE: ColorFillFieldTableEntry[] = [];

export const DEFAULT_COLOR_FILL_MAIN_TABLE: ColorFillMainTableEntry[] = DEFAULT_COLOR_FILL_DIFFICULTY_TABLE.map((config) => ({
	questId: `QUEST_COLORFILL_D${config.difficulty}`,
	questName: `금고 풀기 D${config.difficulty}`,
	difficulty: config.difficulty,
	timeLimitSeconds: config.timeLimitSeconds,
	roundCount: config.roundCount,
	puzzleIds: DEFAULT_COLOR_FILL_FIELD_TABLE
		.filter((field) => field.difficulty === config.difficulty)
		.map((field) => field.puzzleId),
}));

//#endregion

//#region Table access

export class ColorFillTables {
	private _mainTable: ColorFillMainTableEntry[] = DEFAULT_COLOR_FILL_MAIN_TABLE;
	private _difficultyTable: ColorFillDifficultyConfig[] = DEFAULT_COLOR_FILL_DIFFICULTY_TABLE;
	private _fieldTable: ColorFillFieldTableEntry[] = DEFAULT_COLOR_FILL_FIELD_TABLE;
	private _objectTable: ColorFillObjectTableEntry[] = DEFAULT_COLOR_FILL_OBJECT_TABLE;

	public loadMainTable(entries: ColorFillMainTableEntry[]): void {
		this._mainTable = entries;
	}

	public loadDifficultyTable(entries: ColorFillDifficultyConfig[]): void {
		this._difficultyTable = entries;
	}

	public loadFieldTable(entries: ColorFillFieldTableEntry[]): void {
		this._fieldTable = entries;
	}

	public loadObjectTable(entries: ColorFillObjectTableEntry[]): void {
		this._objectTable = entries;
	}

	public get mainTable(): readonly ColorFillMainTableEntry[] {
		return this._mainTable;
	}

	public get difficultyTable(): readonly ColorFillDifficultyConfig[] {
		return this._difficultyTable;
	}

	public get fieldTable(): readonly ColorFillFieldTableEntry[] {
		return this._fieldTable;
	}

	public get objectTable(): readonly ColorFillObjectTableEntry[] {
		return this._objectTable;
	}

	public getQuest(questId: string): ColorFillMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.questId === questId);
	}

	public getQuestByDifficulty(difficulty: number): ColorFillMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.difficulty === difficulty);
	}

	public getDifficultyConfig(difficulty: number): ColorFillDifficultyConfig | undefined {
		return this._difficultyTable.find((entry) => entry.difficulty === difficulty);
	}

	public getField(puzzleId: string): ColorFillFieldTableEntry | undefined {
		return this._fieldTable.find((entry) => entry.puzzleId === puzzleId);
	}

	public getFieldsForDifficulty(difficulty: number): ColorFillFieldTableEntry[] {
		return this._fieldTable.filter((entry) => entry.difficulty === difficulty);
	}

	public getObject(objectId: string): ColorFillObjectTableEntry | undefined {
		return this._objectTable.find((entry) => entry.objectId === objectId);
	}

	/** 칸 상태별 연출 정보 - §5 (MainColor 0 -> 1) */
	public getSlotStateVisual(state: ESlotState): ColorFillStateVisual | undefined {
		return this.getObject('DIAL_SLOT')?.stateVisuals[state];
	}

	public buildLevel(field: ColorFillFieldTableEntry): ColorFillLevel {
		return {
			puzzleId: field.puzzleId,
			difficulty: field.difficulty,
			slots: field.slots.map(cloneSlot),
			needleSpeedDegPerSec: field.needleSpeedDegPerSec,
			reverseDelaySeconds: field.reverseDelaySeconds,
			startAngleDeg: field.startAngleDeg,
		};
	}

	public toFieldEntry(level: ColorFillLevel): ColorFillFieldTableEntry {
		let contaminatedCount = 0;
		for (const slot of level.slots) {
			if (slot.state === ESlotState.CONTAMINATED) {
				contaminatedCount++;
			}
		}

		return {
			puzzleId: level.puzzleId,
			difficulty: level.difficulty,
			slots: level.slots.map(cloneSlot),
			needleSpeedDegPerSec: level.needleSpeedDegPerSec,
			reverseDelaySeconds: level.reverseDelaySeconds,
			startAngleDeg: level.startAngleDeg,
			contaminatedCount: contaminatedCount,
		};
	}
}

/**
 * 난이도 설정이 다이얼 규격에 맞는지 확인한다.
 * 위반하면 생성기가 어떤 레벨도 만들지 못하므로 미리 걸러낸다.
 */
export function validateDifficultyConfig(config: ColorFillDifficultyConfig): string[] {
	const violations: string[] = [];

	let contaminatedTotal = 0;
	for (const size of config.contaminationGroupSizes) {
		if (size <= 0) {
			violations.push(`Contamination cluster size must be 1 or more (got ${size}).`);
		}
		contaminatedTotal += size;
	}

	if (config.activeSlotCount <= 0 || config.activeSlotCount > DIAL_SLOT_COUNT) {
		violations.push(`Active slot count must be within 1~${DIAL_SLOT_COUNT} (got ${config.activeSlotCount}).`);
	}

	// 오염 영역은 활성 영역의 부분집합이다
	if (contaminatedTotal > config.activeSlotCount) {
		violations.push(`Contaminated slots (${contaminatedTotal}) exceed active slots (${config.activeSlotCount}).`);
	}

	// 덩어리끼리 붙지 않으려면 사이마다 최소 1칸의 여백이 필요하다 - §8.5
	const groupCount = config.contaminationGroupSizes.length;
	if (groupCount > 1 && contaminatedTotal + groupCount > DIAL_SLOT_COUNT) {
		violations.push(`Contaminated ${contaminatedTotal} + gap ${groupCount} slots exceed the dial's ${DIAL_SLOT_COUNT} slots.`);
	}

	if (config.needleSpeedDegPerSec <= 0) {
		violations.push('Needle speed must be greater than 0.');
	}
	if (config.reverseDelaySeconds < 0) {
		violations.push('Reverse delay must be 0 or more.');
	}

	return violations;
}

//#endregion
