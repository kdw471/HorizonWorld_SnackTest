/**
 * Slide Puzzle - Core Definitions (PUZ_07 슬라이드 퍼즐 / N-퍼즐)
 *
 * 사양: `Documents/Prompts/PUZ_07_슬라이드퍼즐.md` (+ PUZ_00 공통 기반)
 * 인터랙션: 모바일 **탭(단일 터치)**. 조각을 누르면 빈 칸으로 미끄러진다.
 *
 * 이 계층은 `horizon/core` 에 런타임 의존이 없는 순수 로직이다 (PUZ_00 §7.1).
 *
 * 보드 모델 (§12.1)
 * ----------------
 *   board: number[]  길이 n*n (n = iDivideNum)
 *   값은 원본 타일 인덱스이며, 빈 칸은 `n*n - 1` 을 sentinel 로 쓴다.
 *   완성 상태는 `board[i] === i` 이고, 빈 칸은 언제나 마지막 자리에 온다 (§4).
 */

//#region Constants - 규격 및 사이즈 (§4, 그대로 사용)

/** 완성된 이미지 한 변 (cm) */
export const COMPLETED_IMAGE_SIZE_CM = 35;

/** 이미지 조각 두께 (cm) */
export const PIECE_THICKNESS_CM = 4;

/** 조각 인터랙션 영역 높이 (cm). 가로·세로는 이미지 조각과 동일하다 */
export const PIECE_INTERACTION_HEIGHT_CM = 7;

/** 핸드 포인트 변경 콜리전 (cm) - PUZ_00 §4 와 동일한 값 */
export const HAND_POINT_COLLIDER_CM = { width: 50, height: 20, depth: 40 };

/** 분할 수별 조각 규격 (cm) - §4 */
export type PieceMetrics = {
	/** 조각 한 변 */
	pieceSizeCm: number,
	/** 조각 간격 */
	gapCm: number,
}

export const PIECE_METRICS_BY_DIVIDE: { [divide: number]: PieceMetrics } = {
	3: { pieceSizeCm: 11.5, gapCm: 0.25 },
	4: { pieceSizeCm: 8.6, gapCm: 0.2 },
};

/**
 * 이동 연출 시간 (초). 기획서 §6 원안은 0.25초였으나 "터치 후 반응이 굼뜨다" 는
 * 피드백으로 줄였다 - 이동 중 입력 잠금 시간도 그만큼 짧아져 연타가 빨라진다.
 */
export const PIECE_MOVE_SECONDS = 0.12;

/** 완성 시 원본 이미지를 보여 주는 시간 (초) - §9 */
export const SUCCESS_IMAGE_SECONDS = 1;

/** 호버 Emissive 색상 - §5 */
export const HOVER_EMISSIVE_COLOR = '#FF5C41';

/** 사운드 ID - §5 / §6 / §9 */
export const SFX_PIECE_HOVER = 'S_PieceHover_SFX';
export const SFX_PIECE_MOVE = 'S_PieceMove_SFX';
export const SFX_SUCCESS = 'S_PUZ07_Success_SFX';

//#endregion

//#region Enums

/** 입력 잠금 상태 - §12.3 */
export enum ESlideInputState {
	/** 조작 가능 */
	IDLE = 'IDLE',
	/** 조각이 미끄러지는 중 - 모든 칸의 인터랙션이 불가 (§6) */
	MOVING = 'MOVING',
	/** 완성되어 모든 인터랙션이 불가 (§5) */
	LOCKED_CLEARED = 'LOCKED_CLEARED',
}

/** 조각을 누른 결과 */
export enum ESlideMoveOutcome {
	/** 입력이 거절되었다 */
	REJECTED = 'REJECTED',
	/** 빈 칸으로 미끄러지기 시작했다 */
	MOVING = 'MOVING',
}

export enum ESlideRejection {
	NONE = 'NONE',
	INVALID_POSITION = 'INVALID_POSITION',
	/** 빈 칸 자체를 눌렀다 */
	IS_BLANK = 'IS_BLANK',
	/** 사방에 빈 칸이 없어 움직일 수 없다 - §5 */
	NOT_ADJACENT_TO_BLANK = 'NOT_ADJACENT_TO_BLANK',
	/** 다른 조각이 이동 중이다 - §6 */
	MOVE_IN_PROGRESS = 'MOVE_IN_PROGRESS',
	/** 이미 완성되어 조작할 수 없다 - §5 */
	ALREADY_CLEARED = 'ALREADY_CLEARED',
}

/** 퍼즐 진행 상태 머신 */
export enum ESlidePuzzleState {
	IDLE = 'idle',
	ROUND_INTRO = 'round_intro',
	PLAYER_INPUT = 'player_input',
	ROUND_CLEAR = 'round_clear',
	QUEST_CLEAR = 'quest_clear',
	PAUSED = 'paused',
	GAME_OVER = 'game_over',
}

export enum ESlidePuzzleResult {
	WIN = 'win',
	LOSE = 'lose',
}

//#endregion

//#region Data types

/** 조각을 누른 결과 */
export type SlideMoveResult = {
	outcome: ESlideMoveOutcome,
	rejection: ESlideRejection,
	/** 누른 조각의 보드 위치 */
	fromPosition: number,
	/** 조각이 이동할 자리 (= 이동 전 빈 칸 위치) */
	toPosition: number,
	/** 이동하는 원본 타일 인덱스 */
	tileIndex: number,
}

/** 한 판의 배치 정보 */
export type SlidePuzzleLevel = {
	puzzleId: string,
	difficulty: number,
	/** 분할 개수 (3 또는 4) - §11 iDivideNum */
	divideNum: number,
	/** 섞인 보드. board[위치] = 원본 타일 인덱스 */
	board: number[],
	/** 섞은 횟수 - §11 iShuffleNum */
	shuffleNum: number,
	/** 원본 이미지 경로 - §11 sImagePath */
	imagePath: string,
}

export type SlidePuzzleResultData = {
	result: ESlidePuzzleResult,
	roundsCleared: number,
	roundCount: number,
	remainingTimeSeconds: number,
	/** 아직 제자리가 아닌 조각 수 */
	misplacedPieceCount: number,
}

export type SlidePuzzleRoundProgress = {
	current: number,
	total: number,
	cleared: number,
}

export type SlidePuzzleValidationResult = {
	isValid: boolean,
	violations: string[],
}

//#endregion

//#region Helpers

/** 분할 수에 맞는 조각 규격을 돌려준다 - §4 */
export function getPieceMetrics(divideNum: number): PieceMetrics | undefined {
	return PIECE_METRICS_BY_DIVIDE[divideNum];
}

/**
 * 조각 규격이 완성 이미지 크기와 맞는지 확인한다 - §4.
 *   조각 * n + 간격 * (n - 1) === 35cm
 * 예) 3x3: 11.5 * 3 + 0.25 * 2 = 35 / 4x4: 8.6 * 4 + 0.2 * 3 = 35
 */
export function getLayoutTotalCm(divideNum: number): number | undefined {
	const metrics = getPieceMetrics(divideNum);
	if (metrics === undefined) {
		return undefined;
	}
	return metrics.pieceSizeCm * divideNum + metrics.gapCm * (divideNum - 1);
}

/** 완성 상태의 보드 - board[i] === i */
export function createSolvedBoard(divideNum: number): number[] {
	const board: number[] = [];
	for (let index = 0; index < divideNum * divideNum; index++) {
		board.push(index);
	}
	return board;
}

/** 빈 칸을 나타내는 sentinel 값 - §4 "언제나 제일 마지막 조각이 비어있다" */
export function getBlankTileIndex(divideNum: number): number {
	return divideNum * divideNum - 1;
}

/** 빈 칸이 지금 있는 보드 위치 */
export function findBlankPosition(board: readonly number[], divideNum: number): number {
	return board.indexOf(getBlankTileIndex(divideNum));
}

/** 위치 -> 행/열 */
export function toRowCol(position: number, divideNum: number): { row: number, col: number } {
	return { row: Math.floor(position / divideNum), col: position % divideNum };
}

/** 행/열 -> 위치 */
export function toPosition(row: number, col: number, divideNum: number): number {
	return row * divideNum + col;
}

/** 두 위치가 상하좌우로 인접한지 */
export function areAdjacent(left: number, right: number, divideNum: number): boolean {
	const a = toRowCol(left, divideNum);
	const b = toRowCol(right, divideNum);
	const rowDelta = Math.abs(a.row - b.row);
	const colDelta = Math.abs(a.col - b.col);
	return (rowDelta === 1 && colDelta === 0) || (rowDelta === 0 && colDelta === 1);
}

/** 빈 칸에 인접한 조각들의 위치 목록 - §12.2 */
export function getMovablePositions(board: readonly number[], divideNum: number): number[] {
	const blank = findBlankPosition(board, divideNum);
	if (blank < 0) {
		return [];
	}

	const positions: number[] = [];
	const { row, col } = toRowCol(blank, divideNum);
	const candidates = [
		{ row: row - 1, col: col },
		{ row: row + 1, col: col },
		{ row: row, col: col - 1 },
		{ row: row, col: col + 1 },
	];

	for (const candidate of candidates) {
		if (candidate.row < 0 || candidate.row >= divideNum || candidate.col < 0 || candidate.col >= divideNum) {
			continue;
		}
		positions.push(toPosition(candidate.row, candidate.col, divideNum));
	}
	return positions;
}

/** 완성 판정 - §12.6 "board[i] === i for all i" */
export function isBoardSolved(board: readonly number[]): boolean {
	for (let index = 0; index < board.length; index++) {
		if (board[index] !== index) {
			return false;
		}
	}
	return true;
}

/** 제자리가 아닌 조각 수 (빈 칸 제외) */
export function countMisplaced(board: readonly number[], divideNum: number): number {
	const blank = getBlankTileIndex(divideNum);
	let count = 0;
	for (let index = 0; index < board.length; index++) {
		if (board[index] === blank) {
			continue;
		}
		if (board[index] !== index) {
			count++;
		}
	}
	return count;
}

export function cloneLevel(level: SlidePuzzleLevel): SlidePuzzleLevel {
	return {
		puzzleId: level.puzzleId,
		difficulty: level.difficulty,
		divideNum: level.divideNum,
		board: level.board.slice(),
		shuffleNum: level.shuffleNum,
		imagePath: level.imagePath,
	};
}

/**
 * 15-퍼즐의 풀이 가능성 판정.
 * 역순 셔플로 만든 배치는 언제나 풀 수 있지만, 외부에서 들어온 데이터를 검증할 때 쓴다.
 *
 * 홀수 폭(3x3)이면 전치 수가 짝수여야 하고,
 * 짝수 폭(4x4)이면 (전치 수 + 빈 칸의 행 번호를 아래에서부터 센 값)이 홀수여야 한다.
 */
export function isBoardSolvable(board: readonly number[], divideNum: number): boolean {
	const blank = getBlankTileIndex(divideNum);
	const values: number[] = [];
	for (const value of board) {
		if (value !== blank) {
			values.push(value);
		}
	}

	let inversions = 0;
	for (let i = 0; i < values.length; i++) {
		for (let j = i + 1; j < values.length; j++) {
			if (values[i] > values[j]) {
				inversions++;
			}
		}
	}

	if (divideNum % 2 === 1) {
		return inversions % 2 === 0;
	}

	const blankPosition = board.indexOf(blank);
	const blankRowFromBottom = divideNum - Math.floor(blankPosition / divideNum);
	return (inversions + blankRowFromBottom) % 2 === 1;
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

//#endregion
