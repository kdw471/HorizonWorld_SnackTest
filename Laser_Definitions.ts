/**
 * Laser Hacking Puzzle - Core Definitions (PUZ_01)
 *
 * 사양: `Documents/Prompts/PUZ_01_레이저퍼즐.md` (+ PUZ_00 공통 기반)
 * 인터랙션: 모바일 터치 / 드래그 앤 드롭 (단일 터치 전용)
 *
 * 이 계층은 `horizon/core` 에 런타임 의존이 없는 순수 로직이다 (PUZ_00 §7.1).
 *
 * 좌표계
 * ------
 *   전체 그리드 7 x 7
 *    └ 바깥 테두리 1칸 = 발사체 / 수신체 / 중계체 배치 영역 (플레이어 이용 불가, §2 / §5.1)
 *    └ 중앙 5 x 5     = 크리스탈 배치 영역 (§5.0)
 *
 *   crystal.row / crystal.col  -> 배치 로컬 좌표 0..4
 *   gimmick.row / gimmick.col  -> 전체 그리드 좌표 0..6
 */

//#region Constants

/** 전체 그리드 한 변 (테두리 포함) */
export const LASER_FULL_GRID_SIZE = 7;
/** 크리스탈 배치 영역 한 변 - §5.0 "크리스탈 배치 영역은 5×5 고정" */
export const LASER_PLACEMENT_GRID_SIZE = 5;
/** 배치 영역이 시작되는 전체 그리드 인덱스 */
export const LASER_PLACEMENT_ORIGIN = 1;
export const LASER_PLACEMENT_MAX_INDEX = LASER_PLACEMENT_GRID_SIZE - 1;

/**
 * 인벤토리 슬롯 최대 개수.
 *
 * 기획서 §2 는 "최대 5개"로 적고 있으나, 실제 기획 데이터 테이블
 * `NPUZ_01_FieldData.csv` 는 슬롯 컬럼을 `sUseMoveObjectID1..10` 10개로 두고
 * 최대 9개까지 사용한다. 데이터 쪽이 더 최신이므로 상한을 10으로 맞춘다.
 * (절차적 생성기는 난이도 테이블 값에 따라 여전히 5개 이하만 만든다)
 */
export const LASER_MAX_INVENTORY_SLOTS = 10;

/** 기획서 §2 원문 상한. UI 슬롯 레이아웃 기준값으로만 참고한다 */
export const LASER_SPEC_INVENTORY_SLOTS = 5;

/** 광선 추적 시 허용하는 최대 세그먼트 수 (무한 루프 방어용 상한) */
export const LASER_MAX_TRACE_SEGMENTS = 4096;

//#endregion

//#region Enums

/**
 * 광선 진행 방향.
 * 팔각 크리스탈이 대각선 4방향으로 분배하므로 대각선도 필요하다 (§4.1).
 */
export enum ELaserDirection {
	UP = 'UP',
	DOWN = 'DOWN',
	LEFT = 'LEFT',
	RIGHT = 'RIGHT',
	UP_LEFT = 'UP_LEFT',
	UP_RIGHT = 'UP_RIGHT',
	DOWN_LEFT = 'DOWN_LEFT',
	DOWN_RIGHT = 'DOWN_RIGHT',
}

/**
 * 레이저 색상 - §3 2.1, §5.
 * 색이 곧 레이어(층)이므로, 색이 다른 광선끼리는 교차해도 간섭하지 않는다.
 */
export enum ELaserColor {
	RED = 'RED',
	GREEN = 'GREEN',
	BLUE = 'BLUE',
}

/** 크리스탈 5종 - §4.1 */
export enum ECrystalType {
	/** 직각 삼각형: 빗변으로 들어온 광선을 직각 반사. 평면(직각변)으로 들어오면 되돌아간다 */
	TRIANGLE = 'TRIANGLE',
	/** 팔각: 입사 방향과 무관하게 대각선 4방향으로 분배 */
	OCTAGON = 'OCTAGON',
	/** 십자: 입사 방향과 무관하게 직각 4방향으로 분배 */
	CROSS = 'CROSS',
	/** T자: 입사 방향과 무관하게 2~3방향으로 분배 */
	TEE = 'TEE',
	/** 꽃: 모든 방향의 광선을 흡수 */
	FLOWER = 'FLOWER',
}

/**
 * 직각 삼각형 크리스탈의 방향 4종 - §4.1.
 *
 * 사양은 "상/하/좌/우"로 적고 있으나 반사 계산에는 **직각 코너의 위치**가 필요하므로
 * 코너 기준으로 정의한다. 리소스 이름과의 매핑은 오브젝트 테이블에서 한다.
 *
 * 예) BOTTOM_LEFT = 직각이 좌하단. 직각변은 왼쪽/아래, 빗변은 좌상단→우하단 (`\`).
 *     오른쪽에서 들어온 광선(LEFT 진행)은 빗변에 맞아 UP 으로 꺾이고,
 *     왼쪽에서 들어온 광선(RIGHT 진행)은 직각변에 맞아 되돌아간다.
 */
export enum ETriangleCorner {
	TOP_LEFT = 'TOP_LEFT',
	TOP_RIGHT = 'TOP_RIGHT',
	BOTTOM_LEFT = 'BOTTOM_LEFT',
	BOTTOM_RIGHT = 'BOTTOM_RIGHT',
}

/**
 * T자 크리스탈의 방향 4종 - §4.1 (ㅓ/ㅗ/ㅜ/ㅏ).
 * 값은 T 의 "등"이 향하는 쪽이 아니라 **막힌 쪽**을 뜻한다.
 * 예) BLOCKED_DOWN = ㅗ 모양. 위/왼쪽/오른쪽 3방향으로 뻗는다.
 */
export enum ETeeBlockedSide {
	BLOCKED_UP = 'BLOCKED_UP',
	BLOCKED_DOWN = 'BLOCKED_DOWN',
	BLOCKED_LEFT = 'BLOCKED_LEFT',
	BLOCKED_RIGHT = 'BLOCKED_RIGHT',
}

/** 플레이어가 조작할 수 없는 기믹 - §4.2 / §4.3 */
export enum EGimmickType {
	/** 발사체 - 레이저 시작점 */
	EMITTER = 'EMITTER',
	/** 수신체 - 레이저 목표점 */
	RECEIVER = 'RECEIVER',
	/** 중계체 - 반드시 경유해야 하는 오브젝트 */
	RELAY = 'RELAY',
	/** 해골 크리스탈 - 닿으면 모든 수신체가 Fault */
	SKULL = 'SKULL',
	/** 고정 크리스탈 - 필드에 박혀 있어 유저가 옮길 수 없다 (§4.3) */
	FIXED_CRYSTAL = 'FIXED_CRYSTAL',
}

/** 공통 오브젝트 상태 - PUZ_00 §5 / §6 */
export enum EObjectState {
	ON = 'On',
	OFF = 'Off',
	FAULT = 'Fault',
}

/** 퍼즐 진행 상태 머신 */
export enum ELaserState {
	IDLE = 'idle',
	ROUND_INTRO = 'round_intro',
	PLAYER_INPUT = 'player_input',
	ROUND_CLEAR = 'round_clear',
	QUEST_CLEAR = 'quest_clear',
	PAUSED = 'paused',
	GAME_OVER = 'game_over',
}

export enum ELaserResult {
	WIN = 'win',
	LOSE = 'lose',
}

//#endregion

//#region Data types

export type LaserCell = {
	row: number,
	col: number,
}

/** 크리스탈 한 개. 방향은 배치 후 바꿀 수 없다 (§3 3.4) */
export type LaserCrystal = {
	id: string,
	type: ECrystalType,
	/** TRIANGLE 일 때만 의미가 있다 */
	corner?: ETriangleCorner,
	/** TEE 일 때만 의미가 있다 */
	blockedSide?: ETeeBlockedSide,
}

/** 필드에 놓인 크리스탈 (배치 로컬 좌표 0..4) */
export type LaserPlacedCrystal = LaserCrystal & {
	row: number,
	col: number,
	/** 고정 크리스탈이면 true - 유저가 회수할 수 없다 (§4.3) */
	isFixed: boolean,
}

/**
 * 테두리에 놓인 기믹 (전체 그리드 좌표 0..6).
 * 발사체는 필드 안쪽을 향해 쏘고, 수신체는 자기 칸에 도달한 광선을 받는다.
 */
export type LaserGimmick = {
	id: string,
	type: EGimmickType,
	row: number,
	col: number,
	/**
	 * 보유 색상.
	 * 발사체/수신체는 1개, 중계체는 여러 개를 가질 수 있다 (§3 4.1.1).
	 * 해골/고정 크리스탈은 색이 없으므로 빈 배열이다.
	 */
	colors: ELaserColor[],
	/** FIXED_CRYSTAL 일 때 어떤 크리스탈인지 */
	crystal?: LaserCrystal,
}

/** 광선 한 구간 - 연출/디버그용 */
export type LaserBeamSegment = {
	color: ELaserColor,
	/** 전체 그리드 좌표 */
	from: LaserCell,
	to: LaserCell,
	direction: ELaserDirection,
}

/** 광선 추적 결과 */
export type LaserTraceResult = {
	segments: LaserBeamSegment[],
	/** 올바른 색을 수신해 On 이 된 수신체 id */
	litReceiverIds: string[],
	/** 광선이 경유한 중계체 id (색이 맞는 경우만) */
	visitedRelayIds: string[],
	/** 해골에 광선이 닿았는지 - 닿으면 모든 수신체가 Fault (§3 4.2.1) */
	didHitSkull: boolean,
	/** 오브젝트별 상태 - 연출용 */
	objectStates: Map<string, EObjectState>,
}

/** 한 판의 배치 정보 */
export type LaserLevel = {
	puzzleId: string,
	difficulty: number,
	gimmicks: LaserGimmick[],
	/** 시작부터 필드에 놓여 있는 크리스탈 (고정 크리스탈 포함) */
	presetCrystals: LaserPlacedCrystal[],
	/** 플레이어에게 지급되는 크리스탈 (§3 3.2) */
	inventory: LaserCrystal[],
}

export type LaserResultData = {
	result: ELaserResult,
	roundsCleared: number,
	roundCount: number,
	remainingTimeSeconds: number,
}

export type LaserRoundProgress = {
	current: number,
	total: number,
	cleared: number,
}

export type LaserValidationResult = {
	isValid: boolean,
	violations: string[],
}

//#endregion

//#region Direction helpers

const DIRECTION_DELTAS: { [key: string]: LaserCell } = {
	[ELaserDirection.UP]: { row: -1, col: 0 },
	[ELaserDirection.DOWN]: { row: 1, col: 0 },
	[ELaserDirection.LEFT]: { row: 0, col: -1 },
	[ELaserDirection.RIGHT]: { row: 0, col: 1 },
	[ELaserDirection.UP_LEFT]: { row: -1, col: -1 },
	[ELaserDirection.UP_RIGHT]: { row: -1, col: 1 },
	[ELaserDirection.DOWN_LEFT]: { row: 1, col: -1 },
	[ELaserDirection.DOWN_RIGHT]: { row: 1, col: 1 },
};

const OPPOSITE_DIRECTIONS: { [key: string]: ELaserDirection } = {
	[ELaserDirection.UP]: ELaserDirection.DOWN,
	[ELaserDirection.DOWN]: ELaserDirection.UP,
	[ELaserDirection.LEFT]: ELaserDirection.RIGHT,
	[ELaserDirection.RIGHT]: ELaserDirection.LEFT,
	[ELaserDirection.UP_LEFT]: ELaserDirection.DOWN_RIGHT,
	[ELaserDirection.UP_RIGHT]: ELaserDirection.DOWN_LEFT,
	[ELaserDirection.DOWN_LEFT]: ELaserDirection.UP_RIGHT,
	[ELaserDirection.DOWN_RIGHT]: ELaserDirection.UP_LEFT,
};

export const ORTHOGONAL_DIRECTIONS: readonly ELaserDirection[] = [
	ELaserDirection.UP,
	ELaserDirection.DOWN,
	ELaserDirection.LEFT,
	ELaserDirection.RIGHT,
];

export const DIAGONAL_DIRECTIONS: readonly ELaserDirection[] = [
	ELaserDirection.UP_LEFT,
	ELaserDirection.UP_RIGHT,
	ELaserDirection.DOWN_LEFT,
	ELaserDirection.DOWN_RIGHT,
];

export function getDirectionDelta(direction: ELaserDirection): LaserCell {
	return DIRECTION_DELTAS[direction];
}

export function getOppositeDirection(direction: ELaserDirection): ELaserDirection {
	return OPPOSITE_DIRECTIONS[direction];
}

export function isDiagonal(direction: ELaserDirection): boolean {
	return DIAGONAL_DIRECTIONS.indexOf(direction) >= 0;
}

//#endregion

//#region Coordinate helpers

/** 배치 로컬 좌표 -> 전체 그리드 좌표 */
export function toFullGridIndex(localIndex: number): number {
	return localIndex + LASER_PLACEMENT_ORIGIN;
}

/** 전체 그리드 좌표 -> 배치 로컬 좌표 */
export function toPlacementLocalIndex(fullIndex: number): number {
	return fullIndex - LASER_PLACEMENT_ORIGIN;
}

/** 크리스탈 배치 영역(5x5) 안인지 - §5.1 "주변 1칸 테두리는 플레이어가 이용할 수 없다" */
export function isInsidePlacementArea(row: number, col: number): boolean {
	return row >= 0 && row < LASER_PLACEMENT_GRID_SIZE && col >= 0 && col < LASER_PLACEMENT_GRID_SIZE;
}

/** 전체 그리드(7x7) 안인지 */
export function isInsideFullGrid(row: number, col: number): boolean {
	return row >= 0 && row < LASER_FULL_GRID_SIZE && col >= 0 && col < LASER_FULL_GRID_SIZE;
}

/** 전체 그리드의 테두리 칸인지 (기믹 배치 구역) */
export function isBorderCell(row: number, col: number): boolean {
	if (isInsideFullGrid(row, col) === false) {
		return false;
	}
	const last = LASER_FULL_GRID_SIZE - 1;
	return row === 0 || row === last || col === 0 || col === last;
}

/**
 * 테두리에 놓인 발사체가 필드 안쪽을 향해 쏘는 방향.
 * 꼭짓점에 놓이면 안쪽 대각선을 향한다.
 */
export function getInwardDirection(row: number, col: number): ELaserDirection | undefined {
	const last = LASER_FULL_GRID_SIZE - 1;
	const isTop = row === 0;
	const isBottom = row === last;
	const isLeft = col === 0;
	const isRight = col === last;

	if (isTop && isLeft) { return ELaserDirection.DOWN_RIGHT; }
	if (isTop && isRight) { return ELaserDirection.DOWN_LEFT; }
	if (isBottom && isLeft) { return ELaserDirection.UP_RIGHT; }
	if (isBottom && isRight) { return ELaserDirection.UP_LEFT; }
	if (isTop) { return ELaserDirection.DOWN; }
	if (isBottom) { return ELaserDirection.UP; }
	if (isLeft) { return ELaserDirection.RIGHT; }
	if (isRight) { return ELaserDirection.LEFT; }
	return undefined;
}

//#endregion

//#region Crystal behaviour (§3 3.0 / §4.1)

/**
 * 직각 삼각형 크리스탈의 반사 - §4.1.
 *
 * 직각 코너에 붙어 있는 두 변이 "평면(직각변)"이고, 나머지 한 변이 빗변이다.
 * 빗변으로 들어온 광선은 직각으로 꺾이고, 평면으로 들어온 광선은 되돌아간다.
 *
 * 예) BOTTOM_LEFT (직각이 좌하단, 빗변은 `\` 방향):
 *     - 평면: 왼쪽 변, 아래쪽 변  -> 이쪽으로 들어오면 반대 방향으로 되돌아간다
 *     - 빗변: LEFT 진행 -> UP, DOWN 진행 -> RIGHT (그리고 그 역)
 */
export function reflectTriangle(corner: ETriangleCorner, incoming: ELaserDirection): ELaserDirection[] {
	// 대각선으로 들어온 광선은 빗변/평면 구분이 모호하므로 흡수한다.
	if (isDiagonal(incoming)) {
		return [];
	}

	// 각 코너에서 "평면(직각변)"이 마주보는 진행 방향.
	// 예) BOTTOM_LEFT 은 왼쪽 변과 아래쪽 변이 평면이므로,
	//     왼쪽에서 들어오는(RIGHT 진행) 광선과 아래에서 들어오는(UP 진행) 광선이 평면에 닿는다.
	const flatIncoming: { [key: string]: ELaserDirection[] } = {
		[ETriangleCorner.BOTTOM_LEFT]: [ELaserDirection.RIGHT, ELaserDirection.UP],
		[ETriangleCorner.BOTTOM_RIGHT]: [ELaserDirection.LEFT, ELaserDirection.UP],
		[ETriangleCorner.TOP_LEFT]: [ELaserDirection.RIGHT, ELaserDirection.DOWN],
		[ETriangleCorner.TOP_RIGHT]: [ELaserDirection.LEFT, ELaserDirection.DOWN],
	};

	if (flatIncoming[corner].indexOf(incoming) >= 0) {
		// §4.1 "평면 방향으로 들어오는 레이저는 되돌아간다"
		return [getOppositeDirection(incoming)];
	}

	// 빗변 반사. BOTTOM_LEFT / TOP_RIGHT 는 `\` 거울, BOTTOM_RIGHT / TOP_LEFT 는 `/` 거울이다.
	const isBackslash = corner === ETriangleCorner.BOTTOM_LEFT || corner === ETriangleCorner.TOP_RIGHT;
	const backslash: { [key: string]: ELaserDirection } = {
		[ELaserDirection.RIGHT]: ELaserDirection.DOWN,
		[ELaserDirection.DOWN]: ELaserDirection.RIGHT,
		[ELaserDirection.LEFT]: ELaserDirection.UP,
		[ELaserDirection.UP]: ELaserDirection.LEFT,
	};
	const slash: { [key: string]: ELaserDirection } = {
		[ELaserDirection.RIGHT]: ELaserDirection.UP,
		[ELaserDirection.UP]: ELaserDirection.RIGHT,
		[ELaserDirection.LEFT]: ELaserDirection.DOWN,
		[ELaserDirection.DOWN]: ELaserDirection.LEFT,
	};

	return [isBackslash ? backslash[incoming] : slash[incoming]];
}

/** T자 크리스탈이 뻗는 3방향 - §4.1 */
export function getTeeArms(blockedSide: ETeeBlockedSide): ELaserDirection[] {
	switch (blockedSide) {
		case ETeeBlockedSide.BLOCKED_UP:
			return [ELaserDirection.DOWN, ELaserDirection.LEFT, ELaserDirection.RIGHT];
		case ETeeBlockedSide.BLOCKED_DOWN:
			return [ELaserDirection.UP, ELaserDirection.LEFT, ELaserDirection.RIGHT];
		case ETeeBlockedSide.BLOCKED_LEFT:
			return [ELaserDirection.UP, ELaserDirection.DOWN, ELaserDirection.RIGHT];
		default:
			return [ELaserDirection.UP, ELaserDirection.DOWN, ELaserDirection.LEFT];
	}
}

/**
 * 크리스탈에 광선이 들어왔을 때 나가는 방향들 - §3 3.0.
 * 빈 배열이면 흡수된 것이다.
 */
export function getCrystalOutputs(crystal: LaserCrystal, incoming: ELaserDirection): ELaserDirection[] {
	switch (crystal.type) {
		case ECrystalType.FLOWER:
			// §4.1 "모든 방향에서 들어오는 레이저를 흡수"
			return [];

		case ECrystalType.OCTAGON:
			// §4.1 "입사 방향과 무관하게 대각선 4방향으로 분배"
			return DIAGONAL_DIRECTIONS.slice();

		case ECrystalType.CROSS:
			// §4.1 "입사 방향과 무관하게 직각 4방향으로 분배"
			return ORTHOGONAL_DIRECTIONS.slice();

		case ECrystalType.TEE: {
			// §4.1 "입사 방향과 무관하게 2~3방향으로 분배"
			// 3개의 팔 중, 들어온 쪽으로 되돌아가는 방향은 제외해 2~3방향이 된다.
			const arms = getTeeArms(crystal.blockedSide ?? ETeeBlockedSide.BLOCKED_DOWN);
			const backwards = getOppositeDirection(incoming);
			return arms.filter((arm) => arm !== backwards);
		}

		default:
			return reflectTriangle(crystal.corner ?? ETriangleCorner.BOTTOM_LEFT, incoming);
	}
}

//#endregion

//#region Misc helpers

export function cloneCrystal(crystal: LaserCrystal): LaserCrystal {
	return {
		id: crystal.id,
		type: crystal.type,
		corner: crystal.corner,
		blockedSide: crystal.blockedSide,
	};
}

export function clonePlacedCrystal(crystal: LaserPlacedCrystal): LaserPlacedCrystal {
	return {
		id: crystal.id,
		type: crystal.type,
		corner: crystal.corner,
		blockedSide: crystal.blockedSide,
		row: crystal.row,
		col: crystal.col,
		isFixed: crystal.isFixed,
	};
}

export function cloneGimmick(gimmick: LaserGimmick): LaserGimmick {
	return {
		id: gimmick.id,
		type: gimmick.type,
		row: gimmick.row,
		col: gimmick.col,
		colors: gimmick.colors.slice(),
		crystal: gimmick.crystal === undefined ? undefined : cloneCrystal(gimmick.crystal),
	};
}

export function cloneLevel(level: LaserLevel): LaserLevel {
	return {
		puzzleId: level.puzzleId,
		difficulty: level.difficulty,
		gimmicks: level.gimmicks.map(cloneGimmick),
		presetCrystals: level.presetCrystals.map(clonePlacedCrystal),
		inventory: level.inventory.map(cloneCrystal),
	};
}

/** 재현 가능한 난수 (mulberry32) */
export type RandomSource = () => number;

export function createSeededRandom(seed: number): RandomSource {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6D2B79F5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function randomInt(random: RandomSource, minInclusive: number, maxInclusive: number): number {
	return minInclusive + Math.floor(random() * (maxInclusive - minInclusive + 1));
}

export function pickRandom<T>(random: RandomSource, items: readonly T[]): T {
	return items[randomInt(random, 0, items.length - 1)];
}

export function shuffleInPlace<T>(random: RandomSource, items: T[]): T[] {
	for (let i = items.length - 1; i > 0; i--) {
		const j = randomInt(random, 0, i);
		const temp = items[i];
		items[i] = items[j];
		items[j] = temp;
	}
	return items;
}

//#endregion
