/**
 * Card Match Puzzle - Core Definitions (PUZ_06 카드 맞추기 / 포탈 타일 메모리)
 *
 * 사양: `Documents/Prompts/PUZ_06_카드맞추기퍼즐.md` (+ PUZ_00 공통 기반)
 * 인터랙션: 모바일 **탭(단일 터치)**. 드래그가 없다.
 *
 * 클래식 메모리 매치와 같은 규칙이되, 카드 대신 **포탈 타일**을 쓰고
 * **폭탄 타일이 셔플 기믹**으로 리셋을 대신하는 것이 이 퍼즐의 변형이다 (§1).
 *
 * 이 계층은 `horizon/core` 에 런타임 의존이 없는 순수 로직이다 (PUZ_00 §7.1).
 */

//#region Constants

/** 한 번에 활성화할 수 있는 포탈 타일 수 - §3 "포탈 타일은 한 번에 최대 2개까지 활성화 가능" */
export const MAX_REVEALED_TILES = 2;

/** 짝이 틀렸을 때 뒤집힌 채로 보여 주는 시간(초) - 판정 연출 */
export const DEFAULT_MISMATCH_REVEAL_SECONDS = 0.8;

/** 폭탄 셔플 연출 시간(초). 이 동안 제한 시간이 멈추고 입력이 잠긴다 - §4 */
export const DEFAULT_BOMB_SHUFFLE_SECONDS = 1.2;

//#endregion

//#region Enums

/**
 * 타일 상태 머신 - §9.2
 *   HIDDEN -> REVEALED -> (MATCHED | HIDDEN),  별도로 BOMB_REVEALED
 * MATCHED 와 폭탄 타일은 재선택 불가다.
 */
export enum ETileState {
	/** 기본 (뒷면) */
	HIDDEN = 'HIDDEN',
	/** 활성화되어 오브젝트가 보이는 중 */
	REVEALED = 'REVEALED',
	/** 짝을 맞춰 제거된 상태 - §6 파란색 -> 녹색 */
	MATCHED = 'MATCHED',
	/** 폭탄이 드러나 비활성화된 상태 - §3.3 */
	BOMB_REVEALED = 'BOMB_REVEALED',
}

/** 오브젝트 타입 - §8 NPUZ_06_ObjectData */
export enum ECardObjectType {
	/** 일반 */
	NORMAL = 'NORMAL',
	/** 함정 (폭탄) */
	TRAP = 'TRAP',
}

/** 타일을 활성화한 결과 */
export enum ERevealOutcome {
	/** 입력이 거절되었다 (잠금 중 / 재선택 / 잘못된 index) */
	REJECTED = 'REJECTED',
	/** 첫 번째 타일이 열렸다 */
	FIRST_REVEALED = 'FIRST_REVEALED',
	/** 두 번째 타일이 열렸고 짝이 맞았다 */
	MATCHED = 'MATCHED',
	/** 두 번째 타일이 열렸고 짝이 틀렸다 (곧 되돌아간다) */
	MISMATCHED = 'MISMATCHED',
	/** 폭탄이 나왔다 - 셔플이 시작된다 */
	BOMB = 'BOMB',
}

/** 입력이 거절된 이유 */
export enum ERevealRejection {
	NONE = 'NONE',
	INVALID_INDEX = 'INVALID_INDEX',
	/** 폭탄 셔플 중이라 조작할 수 없다 - §4 */
	LOCKED_BY_BOMB = 'LOCKED_BY_BOMB',
	/** 이미 완료된 타일은 다시 고를 수 없다 - §4 */
	ALREADY_MATCHED = 'ALREADY_MATCHED',
	/** 이미 드러난 폭탄 타일은 다시 고를 수 없다 */
	ALREADY_BOMB = 'ALREADY_BOMB',
	/** 지금 열려 있는 타일을 또 누를 수 없다 */
	ALREADY_REVEALED = 'ALREADY_REVEALED',
}

/** 퍼즐 진행 상태 머신 */
export enum ECardMatchState {
	IDLE = 'idle',
	ROUND_INTRO = 'round_intro',
	PLAYER_INPUT = 'player_input',
	ROUND_CLEAR = 'round_clear',
	QUEST_CLEAR = 'quest_clear',
	PAUSED = 'paused',
	GAME_OVER = 'game_over',
}

export enum ECardMatchResult {
	WIN = 'win',
	LOSE = 'lose',
}

//#endregion

//#region Data types

/** 포탈 타일 한 개 */
export type CardTile = {
	index: number,
	row: number,
	col: number,
	state: ETileState,
	/** 이 타일에 배정된 오브젝트 ID. 폭탄이면 undefined */
	objectId?: string,
	/** 폭탄 타일인지 - §1 */
	isBomb: boolean,
}

/** 타일 활성화 결과 */
export type RevealResult = {
	outcome: ERevealOutcome,
	rejection: ERevealRejection,
	tileIndex: number,
	/** 짝이 맞아 제거된 타일들 */
	matchedTileIndexes: number[],
	/** 짝이 틀려 되돌아갈 타일들 */
	mismatchedTileIndexes: number[],
	/** 폭탄으로 인해 오브젝트 배정이 바뀐 타일들 - §3.3 */
	shuffledTileIndexes: number[],
	/** 이 입력 때문에 직전 판정이 즉시 마무리되었는지 - §9.4 */
	didResolvePending: boolean,
}

/** 한 판의 배치 정보 */
export type CardMatchLevel = {
	puzzleId: string,
	difficulty: number,
	rows: number,
	cols: number,
	tiles: CardTile[],
	/** 폭탄 수 - §8 iBombTile */
	bombCount: number,
	/** 폭탄을 제외한 타일 수 (반드시 짝수) - §8 iObjectTile */
	objectTileCount: number,
	mismatchRevealSeconds: number,
	bombShuffleSeconds: number,
}

export type CardMatchResultData = {
	result: ECardMatchResult,
	roundsCleared: number,
	roundCount: number,
	remainingTimeSeconds: number,
	/** 아직 맞추지 못한 오브젝트 타일 수 */
	remainingObjectTileCount: number,
}

export type CardMatchRoundProgress = {
	current: number,
	total: number,
	cleared: number,
}

export type CardMatchValidationResult = {
	isValid: boolean,
	violations: string[],
}

//#endregion

//#region Helpers

export function cloneTile(tile: CardTile): CardTile {
	return {
		index: tile.index,
		row: tile.row,
		col: tile.col,
		state: tile.state,
		objectId: tile.objectId,
		isBomb: tile.isBomb,
	};
}

export function cloneLevel(level: CardMatchLevel): CardMatchLevel {
	return {
		puzzleId: level.puzzleId,
		difficulty: level.difficulty,
		rows: level.rows,
		cols: level.cols,
		tiles: level.tiles.map(cloneTile),
		bombCount: level.bombCount,
		objectTileCount: level.objectTileCount,
		mismatchRevealSeconds: level.mismatchRevealSeconds,
		bombShuffleSeconds: level.bombShuffleSeconds,
	};
}

/** 재선택할 수 없는 상태인지 - §4 */
export function isTileLockedForever(tile: CardTile): boolean {
	return tile.state === ETileState.MATCHED || tile.state === ETileState.BOMB_REVEALED;
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
