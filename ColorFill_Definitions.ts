/**
 * Color Fill Puzzle - Core Definitions (PUZ_04 색 채우기 / 다이얼 타이밍)
 *
 * 사양: `Documents/Prompts/PUZ_04_색채우기퍼즐.md` (+ PUZ_00 공통 기반)
 * 인터랙션: 모바일 **탭(단일 터치)**. 이 퍼즐은 배치가 아니라 반응속도/타이밍 퍼즐이라
 *           드래그가 없고 "터치 = 방향 반전 (+ 오염 칸 위면 정화)" 하나로 끝난다.
 *
 * 이 계층은 `horizon/core` 에 런타임 의존이 없는 순수 로직이다 (PUZ_00 §7.1).
 *
 * 모델 (§8.1)
 * ----------
 *   slots: Slot[18]          // 각 20도
 *   Slot = { isActive, state: CLEAN | CONTAMINATED }
 *   needle = { angleDeg, direction: +1 | -1, speedDegPerSec }
 *   reverseDelaySeconds
 */

//#region Constants

/** 다이얼 칸 수 - §3 "다이얼은 18칸으로 나누어진다" */
export const DIAL_SLOT_COUNT = 18;

/** 한 칸이 차지하는 각도 - §3 "최소 단위인 한 칸은 20도" (18 x 20 = 360) */
export const DEGREES_PER_SLOT = 360 / DIAL_SLOT_COUNT;

/** 시계방향 회전 - §6 "퍼즐 시작 시 시계방향으로 회전을 시작한다" */
export const DIRECTION_CLOCKWISE = 1;
export const DIRECTION_COUNTER_CLOCKWISE = -1;

//#endregion

//#region Enums

/** 칸의 오염 상태 - §8.1 */
export enum ESlotState {
	/** 정화된 영역 */
	CLEAN = 'CLEAN',
	/** 오염 영역. 붉은 색상으로 표시한다 (§3) */
	CONTAMINATED = 'CONTAMINATED',
}

/** 퍼즐 진행 상태 머신 */
export enum EColorFillState {
	IDLE = 'idle',
	ROUND_INTRO = 'round_intro',
	PLAYER_INPUT = 'player_input',
	ROUND_CLEAR = 'round_clear',
	QUEST_CLEAR = 'quest_clear',
	PAUSED = 'paused',
	GAME_OVER = 'game_over',
}

export enum EColorFillResult {
	WIN = 'win',
	LOSE = 'lose',
}

/** 터치가 만들어낸 결과 - §6 */
export enum ETouchOutcome {
	/** 입력이 무시되었다 (방향 전환 딜레이 중 입력 잠금 등) */
	IGNORED = 'IGNORED',
	/** 방향 반전만 예약되었다 */
	REVERSE_ONLY = 'REVERSE_ONLY',
	/** 오염 덩어리를 정화하고 방향 반전도 예약되었다 */
	PURIFY_AND_REVERSE = 'PURIFY_AND_REVERSE',
}

//#endregion

//#region Data types

/** 다이얼 한 칸 */
export type DialSlot = {
	index: number,
	/** 활성화 영역인지 - §4. 비활성 칸은 정화 대상이 아니다 */
	isActive: boolean,
	state: ESlotState,
}

/** 회전 바늘 - §6 */
export type DialNeedle = {
	/** 0 이상 360 미만 */
	angleDeg: number,
	/** +1 시계방향 / -1 반시계방향 */
	direction: number,
	speedDegPerSec: number,
}

/** 터치 처리 결과 */
export type TouchResult = {
	outcome: ETouchOutcome,
	/** 터치 시점의 칸 index */
	slotIndex: number,
	/** 이번 터치로 정화된 칸 index 목록 */
	purifiedSlotIndexes: number[],
	/** 방향 반전이 예약되었는지 */
	didScheduleReverse: boolean,
}

/** 한 판의 배치 정보 */
export type ColorFillLevel = {
	puzzleId: string,
	difficulty: number,
	/** 18칸 전체의 초기 상태 */
	slots: DialSlot[],
	/** 바늘 회전 속도 (도/초) */
	needleSpeedDegPerSec: number,
	/** 방향 전환 딜레이(초) - §6 */
	reverseDelaySeconds: number,
	/** 시작 각도 */
	startAngleDeg: number,
}

export type ColorFillResultData = {
	result: EColorFillResult,
	roundsCleared: number,
	roundCount: number,
	remainingTimeSeconds: number,
	/** 남은 오염 칸 수 */
	remainingContaminatedCount: number,
}

export type ColorFillRoundProgress = {
	current: number,
	total: number,
	cleared: number,
}

export type ColorFillValidationResult = {
	isValid: boolean,
	violations: string[],
}

//#endregion

//#region Ring helpers (원형 배열)

/** 인덱스를 0..17 범위로 감싼다 */
export function wrapSlotIndex(index: number): number {
	const count = DIAL_SLOT_COUNT;
	return ((index % count) + count) % count;
}

/** 각도를 0 이상 360 미만으로 감싼다 */
export function wrapAngle(angleDeg: number): number {
	return ((angleDeg % 360) + 360) % 360;
}

/** 각도가 속한 칸 index - §8.2 "현재 칸 인덱스 = floor(angle / 20)" */
export function getSlotIndexFromAngle(angleDeg: number): number {
	return wrapSlotIndex(Math.floor(wrapAngle(angleDeg) / DEGREES_PER_SLOT));
}

/** 칸의 중심 각도 */
export function getSlotCenterAngle(index: number): number {
	return wrapSlotIndex(index) * DEGREES_PER_SLOT + DEGREES_PER_SLOT * 0.5;
}

/**
 * `from` 에서 `to` 까지 `direction` 방향으로 갈 때 지나는 칸 수.
 * 같은 칸이면 0 이다.
 */
export function getSlotDistance(from: number, to: number, direction: number): number {
	const start = wrapSlotIndex(from);
	const end = wrapSlotIndex(to);
	if (direction >= 0) {
		return wrapSlotIndex(end - start);
	}
	return wrapSlotIndex(start - end);
}

//#endregion

//#region Slot helpers

export function cloneSlot(slot: DialSlot): DialSlot {
	return { index: slot.index, isActive: slot.isActive, state: slot.state };
}

export function cloneLevel(level: ColorFillLevel): ColorFillLevel {
	return {
		puzzleId: level.puzzleId,
		difficulty: level.difficulty,
		slots: level.slots.map(cloneSlot),
		needleSpeedDegPerSec: level.needleSpeedDegPerSec,
		reverseDelaySeconds: level.reverseDelaySeconds,
		startAngleDeg: level.startAngleDeg,
	};
}

/** 18칸을 모두 비활성·정화 상태로 만든다 */
export function createSlots(): DialSlot[] {
	const slots: DialSlot[] = [];
	for (let index = 0; index < DIAL_SLOT_COUNT; index++) {
		slots.push({ index: index, isActive: false, state: ESlotState.CLEAN });
	}
	return slots;
}

/**
 * `index` 를 포함하는 연속 오염 덩어리의 칸 index 들 - §5 / §8.3.
 * 원형 배열이므로 17 <-> 0 을 넘나드는 wrap-around 를 고려한다.
 * `index` 가 오염 칸이 아니면 빈 배열이다.
 */
export function getContiguousContaminatedRun(slots: readonly DialSlot[], index: number): number[] {
	const start = wrapSlotIndex(index);
	if (slots[start].state !== ESlotState.CONTAMINATED) {
		return [];
	}

	const run: number[] = [start];

	// 뒤쪽으로 확장
	for (let step = 1; step < DIAL_SLOT_COUNT; step++) {
		const candidate = wrapSlotIndex(start - step);
		if (slots[candidate].state !== ESlotState.CONTAMINATED) {
			break;
		}
		run.push(candidate);
	}

	// 앞쪽으로 확장
	for (let step = 1; step < DIAL_SLOT_COUNT; step++) {
		const candidate = wrapSlotIndex(start + step);
		if (slots[candidate].state !== ESlotState.CONTAMINATED) {
			break;
		}
		if (run.indexOf(candidate) >= 0) {
			// 18칸이 전부 오염된 경우 한 바퀴를 다 돌았다
			break;
		}
		run.push(candidate);
	}

	run.sort((left, right) => left - right);
	return run;
}

/** 서로 떨어져 있는 오염 덩어리들 - 밸런싱 시뮬레이션과 검증에 쓴다 */
export function getContaminatedGroups(slots: readonly DialSlot[]): number[][] {
	const groups: number[][] = [];
	const visited = new Set<number>();

	for (let index = 0; index < DIAL_SLOT_COUNT; index++) {
		if (visited.has(index) || slots[index].state !== ESlotState.CONTAMINATED) {
			continue;
		}
		const run = getContiguousContaminatedRun(slots, index);
		for (const slotIndex of run) {
			visited.add(slotIndex);
		}
		groups.push(run);
	}

	return groups;
}

export function countContaminated(slots: readonly DialSlot[]): number {
	let count = 0;
	for (const slot of slots) {
		if (slot.state === ESlotState.CONTAMINATED) {
			count++;
		}
	}
	return count;
}

export function countActive(slots: readonly DialSlot[]): number {
	let count = 0;
	for (const slot of slots) {
		if (slot.isActive) {
			count++;
		}
	}
	return count;
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
