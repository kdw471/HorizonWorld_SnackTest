/**
 * Switch Puzzle - Core Definitions (PUZ_08 스위치 퍼즐 / Lights Out 변형)
 *
 * 사양: `Documents/Prompts/PUZ_08_스위치퍼즐.md` (+ PUZ_00 공통 기반)
 * 인터랙션: 모바일 **탭(단일 터치)**. 키 캡을 누르면 3×3 스위치 영역이 반전된다.
 *
 * 이 계층은 `horizon/core` 에 런타임 의존이 없는 순수 로직이다 (PUZ_00 §7.1).
 *
 * 보드 모델 (§9.1)
 * ----------------
 *   grid: ESwitchCellState[]  길이 25 (5×5 고정, §4)
 *   값은 PRESSED(1) / UNPRESSED(0) / FREE(-1).
 *   FREE 좌표에는 아무런 오브젝트가 생성되지 않으며 (§4) 상호작용·토글 모두 불가하다.
 *
 *   mask: number[]  길이 9 (3×3, §6 sSwitchArray). mask[4](중앙) == 1 고정.
 *   플레이어가 (r, c)를 누르면 값이 1인 오프셋의 키 캡이 XOR 반전된다.
 *   판 밖 오프셋과 FREE 칸은 영향 없음 - 랩어라운드 금지 (§9.2).
 */

//#region Constants - 규격 및 사이즈 (§3, 그대로 사용)

/** 키 판 한 변 (5×5 고정) - §4 */
export const SWITCH_BOARD_SIZE = 5;

/** 키 판 칸 수 */
export const SWITCH_CELL_COUNT = SWITCH_BOARD_SIZE * SWITCH_BOARD_SIZE;

/** 스위치 영역(마스크) 한 변 - §6 "3×3 기준" */
export const SWITCH_MASK_SIZE = 3;

/** 마스크의 중앙 인덱스. mask[4] == 1 고정 - §6 "중앙은 항상 포함" */
export const SWITCH_MASK_CENTER_INDEX = 4;

/** 단일 키 판 (1×1) 한 변 (cm) - §3 */
export const KEY_PLATE_SIZE_CM = 7;

/** 완성된 키 판 (5×5) 한 변 (cm) - §3. 7cm × 5 = 35cm */
export const KEY_BOARD_SIZE_CM = 35;

/** 키 캡 (1×1) 한 변 (cm) - §3 */
export const KEY_CAP_SIZE_CM = 6;

/** 키 캡 조작 콜리전 한 변 (cm) - §3 "조작 콜리전 표기는 7cm × 7cm" */
export const KEY_CAP_COLLISION_CM = 7;

/** 핸드 포인트 변경 콜리전 (cm) - PUZ_00 §4 와 동일한 값 */
export const HAND_POINT_COLLIDER_CM = { width: 50, height: 20, depth: 40 };

/** 키 판 생성 연출 - 모든 타일 생성 소요 시간 (초) - §4 */
export const BOARD_SPAWN_SECONDS = 1;

/** 생성 직후 키 캡이 필드데이터에 따라 동시에 눌리는 연출 (초) - §4 */
export const INITIAL_PRESS_SECONDS = 0.2;

/**
 * 조작 연출 타이밍 - §7
 *   0.0초 중앙의 키 캡을 누름 → 0.2초 영향받는 키 캡 연출 재생 → 0.4초 모든 연출 종료
 */
export const PRESS_AREA_DELAY_SECONDS = 0.2;
export const PRESS_SEQUENCE_SECONDS = 0.4;

//#endregion

//#region Enums

/** 키 캡 한 칸의 상태 - §5. 1 = 눌림(녹색/목표), 0 = 안 눌림(빨강), FREE = 오브젝트 없음 (§4) */
export enum ESwitchCellState {
	FREE = -1,
	UNPRESSED = 0,
	PRESSED = 1,
}

/** 입력 잠금 상태 */
export enum ESwitchInputState {
	/** 조작 가능 */
	IDLE = 'IDLE',
	/** 누름 연출(0.4초)이 재생 중 - 추가 입력 불가 (§7) */
	SEQUENCE = 'SEQUENCE',
	/** 완성되어 모든 인터랙션이 불가 */
	LOCKED_CLEARED = 'LOCKED_CLEARED',
}

/** 키 캡을 누른 결과 */
export enum ESwitchPressOutcome {
	/** 입력이 거절되었다 */
	REJECTED = 'REJECTED',
	/** 눌림이 확정되어 토글이 일어났다 */
	PRESSED = 'PRESSED',
}

export enum ESwitchRejection {
	NONE = 'NONE',
	INVALID_POSITION = 'INVALID_POSITION',
	/** FREE 칸에는 키 캡이 없다 - §4 */
	FREE_CELL = 'FREE_CELL',
	/** 누름 연출이 재생 중이다 - §7 */
	SEQUENCE_IN_PROGRESS = 'SEQUENCE_IN_PROGRESS',
	/** 이미 완성되어 조작할 수 없다 */
	ALREADY_CLEARED = 'ALREADY_CLEARED',
	/** 누른 자리 밖에서 손을 떼어 취소되었다 - §7 부분 누름 (모바일 대체) */
	RELEASED_OUTSIDE = 'RELEASED_OUTSIDE',
	/** 진행 중인 터치가 없다 */
	NO_ACTIVE_TOUCH = 'NO_ACTIVE_TOUCH',
	/** 이미 다른 터치가 진행 중이다 - §7 "먼저 들어간 손만 인식" */
	TOUCH_ALREADY_ACTIVE = 'TOUCH_ALREADY_ACTIVE',
}

/** 퍼즐 진행 상태 머신 */
export enum ESwitchPuzzleState {
	IDLE = 'idle',
	ROUND_INTRO = 'round_intro',
	PLAYER_INPUT = 'player_input',
	ROUND_CLEAR = 'round_clear',
	QUEST_CLEAR = 'quest_clear',
	PAUSED = 'paused',
	GAME_OVER = 'game_over',
}

export enum ESwitchPuzzleResult {
	WIN = 'win',
	LOSE = 'lose',
}

//#endregion

//#region Data types

/** 키 캡을 누른 결과 */
export type SwitchPressResult = {
	outcome: ESwitchPressOutcome,
	rejection: ESwitchRejection,
	/** 누른 칸의 위치 */
	position: number,
	/** 이번 누름으로 반전된 칸들 (누른 칸 포함) - §6 */
	toggledPositions: number[],
}

/** 한 판의 배치 정보 */
export type SwitchLevel = {
	puzzleId: string,
	difficulty: number,
	/** 5×5 키 판. FREE / UNPRESSED / PRESSED - §9.1 */
	grid: ESwitchCellState[],
	/** 3×3 스위치 영역 마스크 (sSwitchArray) - §6 */
	mask: number[],
	/** 스위치 영역 ID - §8 */
	switchAreaId: string,
	/** 역셔플 누름 횟수 K - §9.4 */
	shuffleCount: number,
	/** 역셔플에 실제로 누른 위치들. 이 배치가 K수 이내로 풀린다는 증명이다 */
	shuffledPresses: number[],
}

export type SwitchPuzzleResultData = {
	result: ESwitchPuzzleResult,
	roundsCleared: number,
	roundCount: number,
	remainingTimeSeconds: number,
	/** 아직 눌리지 않은 키 캡 수 */
	unpressedKeyCount: number,
}

export type SwitchRoundProgress = {
	current: number,
	total: number,
	cleared: number,
}

export type SwitchValidationResult = {
	isValid: boolean,
	violations: string[],
}

//#endregion

//#region Helpers - 좌표

/** 위치 -> 행/열 */
export function toRowCol(position: number): { row: number, col: number } {
	return { row: Math.floor(position / SWITCH_BOARD_SIZE), col: position % SWITCH_BOARD_SIZE };
}

/** 행/열 -> 위치 */
export function toPosition(row: number, col: number): number {
	return row * SWITCH_BOARD_SIZE + col;
}

export function isInBounds(row: number, col: number): boolean {
	return row >= 0 && row < SWITCH_BOARD_SIZE && col >= 0 && col < SWITCH_BOARD_SIZE;
}

/** 좌표 표기 A1~E5 (세로 A~E / 가로 1~5) - §4 */
export function toCoordLabel(position: number): string {
	const { row, col } = toRowCol(position);
	return 'ABCDE'.charAt(row) + String(col + 1);
}

//#endregion

//#region Helpers - 마스크 (§6)

/**
 * 마스크 문자열('0'/'1' 3행)을 3×3 배열로 파싱한다.
 * 예) ['010', '111', '010'] → 십자 영역
 */
export function parseSwitchMask(rows: readonly string[]): number[] | undefined {
	if (rows.length !== SWITCH_MASK_SIZE) {
		return undefined;
	}
	const mask: number[] = [];
	for (const row of rows) {
		if (row.length !== SWITCH_MASK_SIZE) {
			return undefined;
		}
		for (const ch of row) {
			if (ch !== '0' && ch !== '1') {
				return undefined;
			}
			mask.push(ch === '1' ? 1 : 0);
		}
	}
	return mask;
}

/** 마스크가 §6 을 만족하는지 - 3×3, 0/1, 중앙 항상 포함 */
export function getMaskViolations(mask: readonly number[]): string[] {
	const violations: string[] = [];
	if (mask.length !== SWITCH_MASK_SIZE * SWITCH_MASK_SIZE) {
		violations.push(`Mask must have 3x3 = 9 cells (got ${mask.length}).`);
		return violations;
	}
	for (const value of mask) {
		if (value !== 0 && value !== 1) {
			violations.push(`Mask values must be 0/1 (got ${value}).`);
			break;
		}
	}
	// §6 - "중앙은 항상 포함한다. 영역의 중심에 불이 들어오지 않는 경우는 없다"
	if (mask[SWITCH_MASK_CENTER_INDEX] !== 1) {
		violations.push('Mask centre (mask[4]) must always be 1 (§6).');
	}
	return violations;
}

/**
 * (r, c)를 눌렀을 때 반전되는 칸들 - §9.2.
 * 판 밖으로 벗어나는 오프셋과 FREE 칸은 영향 없음 (랩어라운드 금지).
 */
export function getToggledPositions(grid: readonly ESwitchCellState[], mask: readonly number[], position: number): number[] {
	const { row, col } = toRowCol(position);
	const toggled: number[] = [];
	for (let dr = -1; dr <= 1; dr++) {
		for (let dc = -1; dc <= 1; dc++) {
			if (mask[(dr + 1) * SWITCH_MASK_SIZE + (dc + 1)] !== 1) {
				continue;
			}
			const nr = row + dr;
			const nc = col + dc;
			if (isInBounds(nr, nc) === false) {
				continue;
			}
			const target = toPosition(nr, nc);
			if (grid[target] === ESwitchCellState.FREE) {
				continue;
			}
			toggled.push(target);
		}
	}
	return toggled;
}

//#endregion

//#region Helpers - 키 판 레이아웃 (§4)

/**
 * 레이아웃 문자열(5행 × 5글자)을 파싱한다.
 *   'O' = 키 캡이 생성되는 칸  /  '.' = FREE (아무것도 생성되지 않음)
 * 반환: 칸별 사용 여부. 형식이 틀리면 undefined.
 */
export function parseKeyLayout(rows: readonly string[]): boolean[] | undefined {
	if (rows.length !== SWITCH_BOARD_SIZE) {
		return undefined;
	}
	const usable: boolean[] = [];
	for (const row of rows) {
		if (row.length !== SWITCH_BOARD_SIZE) {
			return undefined;
		}
		for (const ch of row) {
			if (ch !== 'O' && ch !== '.') {
				return undefined;
			}
			usable.push(ch === 'O');
		}
	}
	return usable;
}

/** 사용 가능 레이아웃으로부터 격자를 만든다. 사용 칸은 fill 값으로 채운다 */
export function createGridFromLayout(usable: readonly boolean[], fill: ESwitchCellState): ESwitchCellState[] {
	const grid: ESwitchCellState[] = [];
	for (let index = 0; index < SWITCH_CELL_COUNT; index++) {
		grid.push(usable[index] === true ? fill : ESwitchCellState.FREE);
	}
	return grid;
}

/** FREE 가 아닌 칸(키 캡이 있는 칸)의 위치 목록 */
export function getUsablePositions(grid: readonly ESwitchCellState[]): number[] {
	const positions: number[] = [];
	for (let index = 0; index < grid.length; index++) {
		if (grid[index] !== ESwitchCellState.FREE) {
			positions.push(index);
		}
	}
	return positions;
}

/** 아직 눌리지 않은 키 캡 수 */
export function countUnpressed(grid: readonly ESwitchCellState[]): number {
	let count = 0;
	for (const cell of grid) {
		if (cell === ESwitchCellState.UNPRESSED) {
			count++;
		}
	}
	return count;
}

/** 클리어 판정 - §9.3 "FREE 가 아닌 모든 칸이 1(눌림)" */
export function isGridSolved(grid: readonly ESwitchCellState[]): boolean {
	for (const cell of grid) {
		if (cell === ESwitchCellState.UNPRESSED) {
			return false;
		}
	}
	return true;
}

export function cloneLevel(level: SwitchLevel): SwitchLevel {
	return {
		puzzleId: level.puzzleId,
		difficulty: level.difficulty,
		grid: level.grid.slice(),
		mask: level.mask.slice(),
		switchAreaId: level.switchAreaId,
		shuffleCount: level.shuffleCount,
		shuffledPresses: level.shuffledPresses.slice(),
	};
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

/** Fisher-Yates 셔플 (역셔플에서 서로 다른 칸 K개를 뽑을 때 쓴다) */
export function shuffleInPlace<T>(random: RandomSource, items: T[]): T[] {
	for (let i = items.length - 1; i > 0; i--) {
		const j = randomInt(random, 0, i);
		const swap = items[i];
		items[i] = items[j];
		items[j] = swap;
	}
	return items;
}

//#endregion
