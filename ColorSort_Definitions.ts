/**
 * Color Sort Puzzle - Core Definitions (PUZ_03 정렬 퍼즐 / 건전지 색 분류)
 *
 * 사양: `Documents/Prompts/PUZ_03_정렬퍼즐.md` (+ PUZ_00 공통 기반)
 * 인터랙션: 모바일 터치 / 드래그 앤 드롭 (단일 터치 전용)
 *
 * 이 계층은 `horizon/core` 에 런타임 의존이 없는 순수 로직이다 (PUZ_00 §7.1).
 *
 * 모델
 * ----
 *   case[i] = stack<Battery>   (용량 4)
 *   Battery = { color, isRevealed }
 *
 * 스택의 마지막 원소가 "최상단(top)" 이다. 그랩/드래그는 항상 최상단부터 집는다.
 */

//#region Constants

/** 케이스 하나에 들어가는 건전지 수 - §3 "케이스 종류는 1가지이며 건전지 4개가 들어갈 수 있다" */
export const CASE_CAPACITY = 4;

/** 필드에 배치되는 케이스 총 개수 - §3 "필드 위에는 총 8개의 케이스가 배치된다" */
export const TOTAL_CASE_COUNT = 8;

/** 여분(빈) 케이스 개수 범위 - §4 "최소 1개, 최대 6개 제공" */
export const MIN_SPARE_CASE_COUNT = 1;
export const MAX_SPARE_CASE_COUNT = 6;

/** 한 번에 옮길 수 있는 최대 개수 - §6 "한 번에 이동할 수 있는 오브젝트 수량은 1 ~ 3개" */
export const MAX_MOVE_RUN = 3;

/** 건전지 색상 총 가짓수 - §5 "색상은 총 10가지" */
export const TOTAL_BATTERY_COLOR_COUNT = 10;

/** 영역 밖에 드랍했을 때 이전 위치로 되돌아가기까지의 시간(초) - §8 드랍 */
export const OUT_OF_BOUNDS_RESPAWN_SECONDS = 2;

//#endregion

//#region Enums

/** 건전지 색상 10종 - §5 */
export enum EBatteryColor {
	RED = 'RED',
	ORANGE = 'ORANGE',
	YELLOW = 'YELLOW',
	GREEN = 'GREEN',
	CYAN = 'CYAN',
	BLUE = 'BLUE',
	PURPLE = 'PURPLE',
	PINK = 'PINK',
	BROWN = 'BROWN',
	GRAY = 'GRAY',
}

export const ALL_BATTERY_COLORS: readonly EBatteryColor[] = [
	EBatteryColor.RED,
	EBatteryColor.ORANGE,
	EBatteryColor.YELLOW,
	EBatteryColor.GREEN,
	EBatteryColor.CYAN,
	EBatteryColor.BLUE,
	EBatteryColor.PURPLE,
	EBatteryColor.PINK,
	EBatteryColor.BROWN,
	EBatteryColor.GRAY,
];

/** 케이스 상태 4종 - §4 */
export enum ECaseState {
	/** 조작 가능한 상태. 비었거나 색이 섞여 있으면 열림을 유지한다 */
	OPEN = 'OPEN',
	/** 같은 색 건전지로 가득 차 닫힌 상태 */
	CLOSED_COMPLETE = 'CLOSED_COMPLETE',
	/** 퍼즐 시작 시 사용할 수 없는 케이스 */
	DISABLED = 'DISABLED',
	/** 드래그 중이거나 리스폰 대기 중이라 잠긴 상태 - §8 드랍 */
	LOCKED = 'LOCKED',
}

/** 이동이 거절된 이유 - 미리보기 비활성 사유로도 쓴다 (§10.2) */
export enum EMoveRejection {
	NONE = 'NONE',
	SAME_CASE = 'SAME_CASE',
	/** (a) 출발 케이스가 비어 있다 */
	SOURCE_EMPTY = 'SOURCE_EMPTY',
	/** 출발 케이스가 닫혔거나 비활성이거나 잠겨 있다 */
	SOURCE_NOT_OPEN = 'SOURCE_NOT_OPEN',
	/** 목적지가 닫혔거나 비활성이거나 잠겨 있다 */
	DESTINATION_NOT_OPEN = 'DESTINATION_NOT_OPEN',
	/** (c) 목적지가 비어 있지도 않고 최상단 색도 다르다 */
	COLOR_MISMATCH = 'COLOR_MISMATCH',
	/** (d) 목적지 잔여 공간이 부족하다 */
	NOT_ENOUGH_SPACE = 'NOT_ENOUGH_SPACE',
	/** 미공개 건전지는 빈 케이스로만 이동할 수 있다 - §10.3 */
	UNKNOWN_NEEDS_EMPTY = 'UNKNOWN_NEEDS_EMPTY',
}

/** 퍼즐 진행 상태 머신 */
export enum EColorSortState {
	IDLE = 'idle',
	ROUND_INTRO = 'round_intro',
	PLAYER_INPUT = 'player_input',
	ROUND_CLEAR = 'round_clear',
	QUEST_CLEAR = 'quest_clear',
	PAUSED = 'paused',
	GAME_OVER = 'game_over',
}

export enum EColorSortResult {
	WIN = 'win',
	LOSE = 'lose',
}

/** 실패 사유 - §2 */
export enum EColorSortFailReason {
	TIME_OUT = 'TIME_OUT',
	/** 이동시킬 수 있는 목표 오브젝트가 없음 (데드락) */
	DEADLOCK = 'DEADLOCK',
	/** 레벨을 만들지 못함 (테이블 설정 오류 등) - 결과 이벤트 없이 멈추지 않도록 실패로 처리한다 */
	LEVEL_LOAD_FAILED = 'LEVEL_LOAD_FAILED',
}

//#endregion

//#region Data types

/**
 * 건전지 한 개 - §5 / §7.
 * `color` 는 언제나 실제 색을 담고 있고, `isRevealed` 가 false 면 유저에게 `?` 로 보인다.
 */
export type Battery = {
	id: string,
	color: EBatteryColor,
	/** false 면 블랙(미지) 건전지 - §7 */
	isRevealed: boolean,
}

/** 케이스 한 개 - 아래가 바닥, 배열 마지막이 최상단 */
export type BatteryCase = {
	id: string,
	index: number,
	capacity: number,
	batteries: Battery[],
	/** 퍼즐 시작 시 사용 가능한 케이스인지 - §3 "난이도에 따라 활성화되는 케이스의 수량이 달라진다" */
	isActive: boolean,
}

/** 이동 유효성 검사 결과 - §10.2 */
export type MoveCheck = {
	isValid: boolean,
	/** 함께 옮겨지는 건전지 수 (1~3) */
	count: number,
	rejection: EMoveRejection,
}

/** 실제로 수행된 이동 */
export type ColorSortMove = {
	fromCaseIndex: number,
	toCaseIndex: number,
	count: number,
	color: EBatteryColor,
	/** 이 이동으로 공개된 건전지 id - §7 */
	revealedBatteryIds: string[],
	/** 이 이동으로 닫힌 케이스 index - §4 */
	closedCaseIndexes: number[],
}

/** 한 판의 배치 정보 */
export type ColorSortLevel = {
	puzzleId: string,
	difficulty: number,
	/** 케이스별 초기 건전지 배치 (아래 -> 위) */
	cases: BatteryCase[],
	/** 사용된 색상 수 */
	colorCount: number,
}

export type ColorSortResultData = {
	result: EColorSortResult,
	failReason?: EColorSortFailReason,
	roundsCleared: number,
	roundCount: number,
	remainingTimeSeconds: number,
}

export type ColorSortRoundProgress = {
	current: number,
	total: number,
	cleared: number,
}

export type ColorSortValidationResult = {
	isValid: boolean,
	violations: string[],
}

//#endregion

//#region Helpers

export function cloneBattery(battery: Battery): Battery {
	return { id: battery.id, color: battery.color, isRevealed: battery.isRevealed };
}

export function cloneCase(batteryCase: BatteryCase): BatteryCase {
	return {
		id: batteryCase.id,
		index: batteryCase.index,
		capacity: batteryCase.capacity,
		batteries: batteryCase.batteries.map(cloneBattery),
		isActive: batteryCase.isActive,
	};
}

export function cloneLevel(level: ColorSortLevel): ColorSortLevel {
	return {
		puzzleId: level.puzzleId,
		difficulty: level.difficulty,
		cases: level.cases.map(cloneCase),
		colorCount: level.colorCount,
	};
}

/** 케이스가 같은 색으로 가득 찼는지 - §4 "가득 참 -> 닫힘" */
export function isCaseComplete(batteryCase: BatteryCase): boolean {
	if (batteryCase.batteries.length !== batteryCase.capacity) {
		return false;
	}

	const first = batteryCase.batteries[0];
	for (const battery of batteryCase.batteries) {
		// 미공개 건전지가 남아 있으면 완성으로 보지 않는다
		if (battery.isRevealed === false || battery.color !== first.color) {
			return false;
		}
	}
	return true;
}

/** 최상단 건전지 */
export function getTopBattery(batteryCase: BatteryCase): Battery | undefined {
	if (batteryCase.batteries.length === 0) {
		return undefined;
	}
	return batteryCase.batteries[batteryCase.batteries.length - 1];
}

/**
 * 최상단부터 이어지는 같은 색 건전지의 개수.
 * 미공개 건전지는 단일로만 움직이므로 언제나 1 이다 - §7.
 */
export function getTopRunLength(batteryCase: BatteryCase): number {
	const top = getTopBattery(batteryCase);
	if (top === undefined) {
		return 0;
	}
	if (top.isRevealed === false) {
		return 1;
	}

	let run = 1;
	for (let index = batteryCase.batteries.length - 2; index >= 0; index--) {
		const battery = batteryCase.batteries[index];
		if (battery.isRevealed === false || battery.color !== top.color) {
			break;
		}
		run++;
	}
	return run;
}

/** 실제로 함께 옮겨지는 개수 - §6 "한 번에 이동할 수 있는 수량은 1~3개" */
export function getMovableCount(batteryCase: BatteryCase): number {
	return Math.min(getTopRunLength(batteryCase), MAX_MOVE_RUN);
}

export function getRemainingSpace(batteryCase: BatteryCase): number {
	return batteryCase.capacity - batteryCase.batteries.length;
}

//#endregion

//#region Random

export type RandomSource = () => number;

/** mulberry32 */
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
