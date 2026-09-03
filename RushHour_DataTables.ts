/**
 * Rush Hour Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_02 §10)
 *
 *   [PUZ 메인 테이블]      기본 룰(라운드, 제한 시간), 난이도 그룹과 소속 퍼즐 관리
 *   [러시아워 필드 테이블]  개별 퍼즐의 오브젝트 배치 좌표 / 개수
 *   [오브젝트 테이블]      기믹/오브젝트의 기능, 리소스, 상태별 연출
 *
 * PUZ_00 §7.2 요구사항에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.
 * 아래 DEFAULT_* 데이터는 초기값이며, 실제 운영 데이터는
 * `RushHourTables.load*()` 로 교체할 수 있다.
 */

import {
	EEdge,
	EObjectState,
	EOrientation,
	EPieceColor,
	GOAL_OBJECT_LENGTH,
	MAX_GOAL_OBJECTS,
	MULTI_GOAL_MIN_DIFFICULTY,
	RushHourEndPoint,
	RushHourLevel,
	RushHourPiece,
} from 'RushHour_Definitions';
import { RUSHHOUR_CSV_FIELD_TABLE, RUSHHOUR_CSV_OBJECT_ROWS } from 'RushHour_FieldData';

/** 기획 CSV 에서 생성한 필드 테이블을 그대로 재수출한다 (테스트/툴에서 참조) */
export { RUSHHOUR_CSV_FIELD_TABLE };

//#region Table types

/** 난이도별 기본 룰 - PUZ 메인 테이블 (PUZ_02 §10) */
export type RushHourDifficultyConfig = {
	difficulty: number,
	/** 난이도별 제한시간 (초) */
	timeLimitSeconds: number,
	/** 난이도별 라운드 개수 (퍼즐 퀘스트당 1~3 라운드, PUZ_00 §3) */
	roundCount: number,
	/** 목표 오브젝트 개수. 난이도 3 이상부터 2개 (§5.1) */
	goalCount: number,
	/** 방해 오브젝트 최소/최대 개수 (§5.2 "수량은 난이도에 따라 달라진다") */
	blockerCountMin: number,
	blockerCountMax: number,
	/** 사용할 방해 오브젝트 길이 (1x1 ~ 4x1) */
	blockerLengths: readonly number[],
	/** 채택 기준이 되는 BFS 최소 이동 수 범위 (§11.2 난이도 스케일링) */
	minimumMovesMin: number,
	minimumMovesMax: number,
}

/** PUZ 메인 테이블 한 행 */
export type PuzMainTableEntry = {
	/** 러시아워 퀘스트 ID */
	questId: string,
	questName: string,
	/** 퍼즐의 난이도 */
	difficulty: number,
	/** 난이도별 제한시간 / 라운드 개수 */
	timeLimitSeconds: number,
	roundCount: number,
	/** 난이도에 속한 퍼즐 ID */
	puzzleIds: string[],
}

/** 필드 테이블의 오브젝트 배치 한 건 */
export type RushHourPlacement = {
	/** 오브젝트 테이블의 오브젝트 ID */
	objectId: string,
	/** 오브젝트 배치 좌표 값 (플레이 로컬 좌표 0..6, 좌측·상단 칸) */
	row: number,
	col: number,
	orientation: EOrientation,
	color: EPieceColor,
	isGoal: boolean,
}

/** 러시아워 필드 테이블 한 행 */
export type RushHourFieldTableEntry = {
	/** 퍼즐 ID */
	puzzleId: string,
	difficulty: number,
	/** 도착 포인트 (전체 9x9 그리드 좌표, 꼭짓점 제외) - §4 */
	endPoints: RushHourEndPoint[],
	/** 배치된 오브젝트 좌표 값 */
	placements: RushHourPlacement[],
	/** 배치된 오브젝트의 개수 */
	objectCount: number,
	/** 사전 검증된 BFS 최소 이동 수. 미검증이면 -1 */
	minimumMoves: number,
}

/** 오브젝트 리소스 정보 */
export type RushHourResourceInfo = {
	/** 스태틱 메쉬 경로 또는 Horizon Asset Id */
	meshPath: string,
	/** 1칸 기준 스케일 배수 */
	scale: number,
}

/** 상태별 연출 정보 */
export type RushHourStateVisual = {
	/** 머티리얼 / 색상 프리셋 이름 */
	materialId: string,
	/** 파티클 뱅크 id (없으면 빈 문자열) */
	vfxId: string,
	/** 사운드 뱅크 id (없으면 빈 문자열) */
	sfxId: string,
}

/** 오브젝트 테이블 한 행 */
export type RushHourObjectTableEntry = {
	/** 오브젝트 ID */
	objectId: string,
	/** 길이(칸 수) 1~4 */
	size: number,
	/** 기본 이동 축. 1x1 은 FREE */
	defaultOrientation: EOrientation,
	isGoal: boolean,
	/** 리소스 정보 */
	resource: RushHourResourceInfo,
	/** 상태별 연출 정보 - PUZ_00 §5 (On / Off / Fault) */
	stateVisuals: { [state: string]: RushHourStateVisual },
}

//#endregion

//#region Default data

const NO_VFX = '';
const NO_SFX = '';

function makeStateVisuals(prefix: string): { [state: string]: RushHourStateVisual } {
	const visuals: { [state: string]: RushHourStateVisual } = {};
	visuals[EObjectState.OFF] = { materialId: `${prefix}_Off`, vfxId: NO_VFX, sfxId: NO_SFX };
	visuals[EObjectState.ON] = { materialId: `${prefix}_On`, vfxId: `${prefix}_Activate`, sfxId: `${prefix}_Activate` };
	visuals[EObjectState.FAULT] = { materialId: `${prefix}_Fault`, vfxId: `${prefix}_Fault`, sfxId: `${prefix}_Fault` };
	return visuals;
}

/** 오브젝트 테이블 초기값 - USB 목표 2종 + 방해 블록 4종 (§5.1, §5.2) */
export const DEFAULT_RUSH_HOUR_OBJECT_TABLE: RushHourObjectTableEntry[] = [
	{
		objectId: 'USB_RED',
		size: GOAL_OBJECT_LENGTH,
		defaultOrientation: EOrientation.HORIZONTAL,
		isGoal: true,
		resource: { meshPath: 'RushHour/USB_Red', scale: 1 },
		stateVisuals: makeStateVisuals('USB_Red'),
	},
	{
		objectId: 'USB_BLUE',
		size: GOAL_OBJECT_LENGTH,
		defaultOrientation: EOrientation.HORIZONTAL,
		isGoal: true,
		resource: { meshPath: 'RushHour/USB_Blue', scale: 1 },
		stateVisuals: makeStateVisuals('USB_Blue'),
	},
	{
		objectId: 'BLOCK_1x1',
		size: 1,
		defaultOrientation: EOrientation.FREE,
		isGoal: false,
		resource: { meshPath: 'RushHour/Block_1x1', scale: 1 },
		stateVisuals: makeStateVisuals('Block_1x1'),
	},
	{
		objectId: 'BLOCK_2x1',
		size: 2,
		defaultOrientation: EOrientation.HORIZONTAL,
		isGoal: false,
		resource: { meshPath: 'RushHour/Block_2x1', scale: 1 },
		stateVisuals: makeStateVisuals('Block_2x1'),
	},
	{
		objectId: 'BLOCK_3x1',
		size: 3,
		defaultOrientation: EOrientation.HORIZONTAL,
		isGoal: false,
		resource: { meshPath: 'RushHour/Block_3x1', scale: 1 },
		stateVisuals: makeStateVisuals('Block_3x1'),
	},
	{
		objectId: 'BLOCK_4x1',
		size: 4,
		defaultOrientation: EOrientation.HORIZONTAL,
		isGoal: false,
		resource: { meshPath: 'RushHour/Block_4x1', scale: 1 },
		stateVisuals: makeStateVisuals('Block_4x1'),
	},
];

/**
 * 기획 CSV(`NPUZ_02_ObjectData.csv`) 23행을 오브젝트 테이블 행으로 변환한 것.
 *
 * 위의 종류별 기본 행과 달리 **실제 오브젝트 ID와 스태틱 메쉬 경로**를 들고 있다.
 * 기본 행 뒤에 붙이므로 `getObject('BLOCK_2x1')` 같은 기존 조회는 그대로 동작하고,
 * `getObject('4122120010')` 처럼 기획 ID 로도 찾을 수 있다.
 */
export const RUSH_HOUR_CSV_OBJECT_TABLE: RushHourObjectTableEntry[] = RUSHHOUR_CSV_OBJECT_ROWS.map((row) => ({
	objectId: row.objectId,
	size: row.size,
	defaultOrientation: row.axis === 1
		? EOrientation.VERTICAL
		: (row.axis === 2 ? EOrientation.HORIZONTAL : EOrientation.FREE),
	isGoal: row.kind === '1',
	resource: { meshPath: row.meshPath, scale: 1 },
	stateVisuals: makeStateVisuals(`Obj_${row.objectId}`),
}));

/**
 * 난이도 테이블 초기값.
 *
 * 난이도 3 이상에서 목표 오브젝트가 2개가 된다 (§5.1) - MULTI_GOAL_MIN_DIFFICULTY 로 계산.
 *
 * `minimumMovesMin/Max` 는 실측으로 잡은 값이다.
 * §6 [필수] "모든 오브젝트는 최소 1칸 이상 움직일 수 있어야 한다" 가 촘촘한 배치를 걸러내기 때문에
 * 7x7 필드에서 실제로 얻을 수 있는 최소 이동 수는 대체로 2~6 수 범위이며,
 * 방해 오브젝트를 늘릴수록 오히려 끼는 조각이 생겨 깊이가 낮아진다.
 * 따라서 난이도는 최소 이동 수만이 아니라 **방해 오브젝트 수 / 목표 개수 / 제한시간**으로 함께 스케일링한다
 * (§11.2 "난이도는 최소 이동 수와 방해 오브젝트 수로 스케일링한다").
 * 상한은 넉넉히 두어, 더 깊은 배치가 발견되면 그대로 채택되게 한다.
 */
export const DEFAULT_RUSH_HOUR_DIFFICULTY_TABLE: RushHourDifficultyConfig[] = [
	{
		difficulty: 1,
		timeLimitSeconds: 120,
		roundCount: 1,
		goalCount: 1,
		blockerCountMin: 3,
		blockerCountMax: 4,
		blockerLengths: [1, 2, 3],
		minimumMovesMin: 2,
		minimumMovesMax: 4,
	},
	{
		difficulty: 2,
		timeLimitSeconds: 150,
		roundCount: 2,
		goalCount: 1,
		blockerCountMin: 5,
		blockerCountMax: 6,
		blockerLengths: [1, 2, 3],
		minimumMovesMin: 3,
		minimumMovesMax: 6,
	},
	{
		difficulty: 3,
		timeLimitSeconds: 180,
		roundCount: 2,
		goalCount: MAX_GOAL_OBJECTS,
		blockerCountMin: 5,
		blockerCountMax: 7,
		blockerLengths: [1, 2, 3, 4],
		minimumMovesMin: 3,
		minimumMovesMax: 8,
	},
	{
		difficulty: 4,
		timeLimitSeconds: 210,
		roundCount: 3,
		goalCount: MAX_GOAL_OBJECTS,
		blockerCountMin: 6,
		blockerCountMax: 8,
		blockerLengths: [1, 2, 3, 4],
		minimumMovesMin: 4,
		minimumMovesMax: 10,
	},
	{
		difficulty: 5,
		timeLimitSeconds: 240,
		roundCount: 3,
		goalCount: MAX_GOAL_OBJECTS,
		blockerCountMin: 7,
		blockerCountMax: 9,
		blockerLengths: [1, 2, 3, 4],
		minimumMovesMin: 4,
		minimumMovesMax: 12,
	},
	{
		// 기획 CSV 최고 난이도. 필드 테이블에 10판이 들어 있고, 그 실측값에 맞춰 잡았다
		// (방해물 12~17개, 최소 이동 8~15수, 목표 2개).
		difficulty: 6,
		timeLimitSeconds: 270,
		roundCount: 3,
		goalCount: MAX_GOAL_OBJECTS,
		blockerCountMin: 10,
		blockerCountMax: 14,
		blockerLengths: [1, 2, 3, 4],
		minimumMovesMin: 5,
		minimumMovesMax: 16,
	},
];

/**
 * 필드 테이블 초기값 - 손으로 배치하고 솔버로 검증한 튜토리얼용 한 판.
 * 도착 포인트는 오른쪽 변 중앙(전체 좌표 row 4, col 8), 목표 USB 는 동일 선상(로컬 row 3).
 */
export const DEFAULT_RUSH_HOUR_FIELD_TABLE: RushHourFieldTableEntry[] = [
	{
		puzzleId: 'RH_D1_001',
		difficulty: 1,
		endPoints: [
			{ id: 'END_RED', edge: EEdge.RIGHT, row: 4, col: 8, color: EPieceColor.RED },
		],
		placements: [
			{ objectId: 'USB_RED', row: 3, col: 0, orientation: EOrientation.HORIZONTAL, color: EPieceColor.RED, isGoal: true },
			{ objectId: 'BLOCK_3x1', row: 1, col: 3, orientation: EOrientation.VERTICAL, color: EPieceColor.NEUTRAL, isGoal: false },
			{ objectId: 'BLOCK_2x1', row: 2, col: 5, orientation: EOrientation.VERTICAL, color: EPieceColor.NEUTRAL, isGoal: false },
			{ objectId: 'BLOCK_2x1', row: 0, col: 0, orientation: EOrientation.HORIZONTAL, color: EPieceColor.NEUTRAL, isGoal: false },
			{ objectId: 'BLOCK_1x1', row: 5, col: 2, orientation: EOrientation.FREE, color: EPieceColor.NEUTRAL, isGoal: false },
			{ objectId: 'BLOCK_2x1', row: 4, col: 1, orientation: EOrientation.VERTICAL, color: EPieceColor.NEUTRAL, isGoal: false },
		],
		objectCount: 6,
		minimumMoves: 3,
	},
];

/**
 * 실제로 쓰는 필드 테이블.
 *
 * 기획 CSV(`RushHour_FieldData.ts`)가 있으면 그것을 쓰고, 없으면 위의 손 배치 한 판으로 떨어진다.
 * 난이도에 해당하는 행이 하나도 없으면 세션이 절차적 생성기로 폴백한다.
 */
export const RUSH_HOUR_FIELD_TABLE: RushHourFieldTableEntry[] =
	RUSHHOUR_CSV_FIELD_TABLE.length > 0 ? RUSHHOUR_CSV_FIELD_TABLE : DEFAULT_RUSH_HOUR_FIELD_TABLE;

/** PUZ 메인 테이블 초기값 */
export const DEFAULT_PUZ_MAIN_TABLE: PuzMainTableEntry[] = DEFAULT_RUSH_HOUR_DIFFICULTY_TABLE.map((config) => ({
	questId: `QUEST_RUSHHOUR_D${config.difficulty}`,
	questName: `러시아워 D${config.difficulty}`,
	difficulty: config.difficulty,
	timeLimitSeconds: config.timeLimitSeconds,
	roundCount: config.roundCount,
	puzzleIds: RUSH_HOUR_FIELD_TABLE
		.filter((field) => field.difficulty === config.difficulty)
		.map((field) => field.puzzleId),
}));

//#endregion

//#region Table access

/**
 * 3계층 테이블 조회 진입점.
 * 필드 테이블에 사전 배치가 없는 난이도는 레벨 생성기가 런타임에 채운다 (PUZ_00 §7.3).
 */
export class RushHourTables {
	private _mainTable: PuzMainTableEntry[] = DEFAULT_PUZ_MAIN_TABLE;
	private _difficultyTable: RushHourDifficultyConfig[] = DEFAULT_RUSH_HOUR_DIFFICULTY_TABLE;
	private _fieldTable: RushHourFieldTableEntry[] = RUSH_HOUR_FIELD_TABLE;
	private _objectTable: RushHourObjectTableEntry[] = DEFAULT_RUSH_HOUR_OBJECT_TABLE.concat(RUSH_HOUR_CSV_OBJECT_TABLE);

	public loadMainTable(entries: PuzMainTableEntry[]): void {
		this._mainTable = entries;
	}

	public loadDifficultyTable(entries: RushHourDifficultyConfig[]): void {
		this._difficultyTable = entries;
	}

	public loadFieldTable(entries: RushHourFieldTableEntry[]): void {
		this._fieldTable = entries;
	}

	public loadObjectTable(entries: RushHourObjectTableEntry[]): void {
		this._objectTable = entries;
	}

	public get mainTable(): readonly PuzMainTableEntry[] {
		return this._mainTable;
	}

	public get difficultyTable(): readonly RushHourDifficultyConfig[] {
		return this._difficultyTable;
	}

	public get fieldTable(): readonly RushHourFieldTableEntry[] {
		return this._fieldTable;
	}

	public get objectTable(): readonly RushHourObjectTableEntry[] {
		return this._objectTable;
	}

	public getQuest(questId: string): PuzMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.questId === questId);
	}

	public getQuestByDifficulty(difficulty: number): PuzMainTableEntry | undefined {
		return this._mainTable.find((entry) => entry.difficulty === difficulty);
	}

	public getDifficultyConfig(difficulty: number): RushHourDifficultyConfig | undefined {
		return this._difficultyTable.find((entry) => entry.difficulty === difficulty);
	}

	public getField(puzzleId: string): RushHourFieldTableEntry | undefined {
		return this._fieldTable.find((entry) => entry.puzzleId === puzzleId);
	}

	public getFieldsForDifficulty(difficulty: number): RushHourFieldTableEntry[] {
		return this._fieldTable.filter((entry) => entry.difficulty === difficulty);
	}

	public getObject(objectId: string): RushHourObjectTableEntry | undefined {
		return this._objectTable.find((entry) => entry.objectId === objectId);
	}

	/** 길이/축 조건에 맞는 방해 오브젝트 테이블 행을 찾는다 (레벨 생성기가 사용) */
	public findBlockerObject(size: number): RushHourObjectTableEntry | undefined {
		return this._objectTable.find((entry) => entry.isGoal === false && entry.size === size);
	}

	public findGoalObject(color: EPieceColor): RushHourObjectTableEntry | undefined {
		const objectId = color === EPieceColor.BLUE ? 'USB_BLUE' : 'USB_RED';
		return this._objectTable.find((entry) => entry.objectId === objectId) ??
			this._objectTable.find((entry) => entry.isGoal);
	}

	/** 상태별 연출 정보 조회 - PUZ_00 §5 */
	public getStateVisual(objectId: string, state: EObjectState): RushHourStateVisual | undefined {
		return this.getObject(objectId)?.stateVisuals[state];
	}

	/**
	 * 필드 테이블 한 행을 플레이 가능한 레벨로 변환한다.
	 * 오브젝트의 길이(size)는 오브젝트 테이블에서 읽어 온다 (PUZ_00 §7.2).
	 */
	public buildLevel(field: RushHourFieldTableEntry): RushHourLevel {
		const pieces: RushHourPiece[] = [];
		for (let index = 0; index < field.placements.length; index++) {
			const placement = field.placements[index];
			const objectEntry = this.getObject(placement.objectId);
			if (objectEntry === undefined) {
				console.warn(`[RushHourTables] Unknown objectId '${placement.objectId}' in field '${field.puzzleId}'`);
				continue;
			}
			pieces.push({
				id: `${placement.objectId}#${index}`,
				size: objectEntry.size,
				orientation: placement.orientation,
				row: placement.row,
				col: placement.col,
				color: placement.color,
				isGoal: placement.isGoal,
			});
		}

		return {
			puzzleId: field.puzzleId,
			difficulty: field.difficulty,
			pieces: pieces,
			endPoints: field.endPoints.slice(),
			minimumMoves: field.minimumMoves,
		};
	}

	/** 레벨을 필드 테이블 행으로 되돌린다 (생성기 결과를 데이터로 저장할 때 사용) */
	public toFieldEntry(level: RushHourLevel): RushHourFieldTableEntry {
		return {
			puzzleId: level.puzzleId,
			difficulty: level.difficulty,
			endPoints: level.endPoints.slice(),
			placements: level.pieces.map((piece) => ({
				objectId: piece.id.split('#')[0],
				row: piece.row,
				col: piece.col,
				orientation: piece.orientation,
				color: piece.color,
				isGoal: piece.isGoal,
			})),
			objectCount: level.pieces.length,
			minimumMoves: level.minimumMoves,
		};
	}
}

/** 난이도에 따른 목표 오브젝트 개수 - §5.1 */
export function getGoalCountForDifficulty(difficulty: number): number {
	return difficulty >= MULTI_GOAL_MIN_DIFFICULTY ? MAX_GOAL_OBJECTS : 1;
}

//#endregion
