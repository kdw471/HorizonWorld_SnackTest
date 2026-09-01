/**
 * Flow Puzzle - Core Definitions (PUZ_05 연결 퍼즐 / 전구 잇기)
 *
 * 사양: `Documents/Prompts/PUZ_05_연결퍼즐.md` (+ PUZ_00 공통 기반)
 * 인터랙션: 모바일 터치 / 드래그 (단일 터치 전용)
 *
 * 일반 Flow 와 다른 점: 경로가 지나갈 칸(서브 오브젝트)이 명시적으로 배치되며
 * **모든 서브 오브젝트를 전부 사용**해야 클리어된다 (§5).
 *
 * 이 계층은 `horizon/core` 에 런타임 의존이 없는 순수 로직이다 (PUZ_00 §7.1).
 */

//#region Constants

/** 필드 한 변 - §3 "7x7 필드, 최대 배치 타일 개수는 49개" */
export const FLOW_GRID_SIZE = 7;
export const FLOW_MAX_TILE_COUNT = FLOW_GRID_SIZE * FLOW_GRID_SIZE;

//#endregion

//#region Enums

/** 오브젝트 종류 - §4 */
export enum ENodeKind {
	/** 메인 오브젝트 - 색상을 가진 전구. 출발/도착 지점 */
	MAIN = 'MAIN',
	/** 서브 오브젝트 - 색상이 없는 회색 전구. 연결되면 색을 부여받는다 */
	SUB = 'SUB',
}

/** 메인 오브젝트의 역할 - §4 */
export enum ENodeRole {
	START = 'START',
	END = 'END',
}

/** 전구 색상 */
export enum EFlowColor {
	RED = 'RED',
	ORANGE = 'ORANGE',
	YELLOW = 'YELLOW',
	GREEN = 'GREEN',
	CYAN = 'CYAN',
	BLUE = 'BLUE',
	PURPLE = 'PURPLE',
	PINK = 'PINK',
}

export const ALL_FLOW_COLORS: readonly EFlowColor[] = [
	EFlowColor.RED,
	EFlowColor.ORANGE,
	EFlowColor.YELLOW,
	EFlowColor.GREEN,
	EFlowColor.CYAN,
	EFlowColor.BLUE,
	EFlowColor.PURPLE,
	EFlowColor.PINK,
];

/** 경로 확장이 거절된 이유 - 미리보기 비활성 사유로도 쓴다 */
export enum EExtendRejection {
	NONE = 'NONE',
	/** 인접하지 않음 (대각선 포함) - §5 */
	NOT_ADJACENT = 'NOT_ADJACENT',
	/** 타일이 없는 칸 - §3 */
	NO_TILE = 'NO_TILE',
	/** 이미 다른 색이 활성화된 칸 - §5 */
	ALREADY_COLORED = 'ALREADY_COLORED',
	/** 자기 경로와 교차 (서브는 입력 1 / 출력 1 뿐) - §4 */
	SELF_INTERSECT = 'SELF_INTERSECT',
	/** 다른 색의 메인 오브젝트 */
	OTHER_MAIN = 'OTHER_MAIN',
	/** 이미 완결된 경로는 더 늘릴 수 없다 */
	PATH_COMPLETE = 'PATH_COMPLETE',
	/** 그리는 중이 아님 */
	NOT_DRAWING = 'NOT_DRAWING',
}

/** 퍼즐 진행 상태 머신 */
export enum EFlowState {
	IDLE = 'idle',
	ROUND_INTRO = 'round_intro',
	PLAYER_INPUT = 'player_input',
	ROUND_CLEAR = 'round_clear',
	QUEST_CLEAR = 'quest_clear',
	PAUSED = 'paused',
	GAME_OVER = 'game_over',
}

export enum EFlowResult {
	WIN = 'win',
	LOSE = 'lose',
}

//#endregion

//#region Data types

export type FlowCell = {
	row: number,
	col: number,
}

/** 타일 위의 오브젝트 한 개 - §4 */
export type FlowNode = {
	row: number,
	col: number,
	kind: ENodeKind,
	/** MAIN 이면 고정 색상. SUB 이면 부여받은 색(없으면 undefined) */
	color?: EFlowColor,
	/** MAIN 일 때의 역할 */
	role?: ENodeRole,
}

/** 한 판의 배치 정보 */
export type FlowLevel = {
	puzzleId: string,
	difficulty: number,
	/** 타일 생성 여부 비트맵 - §3 "타일의 위치와 생성 여부는 0/1 비트맵으로 표기" */
	tiles: boolean[][],
	/** 타일 위에 놓인 오브젝트들 */
	nodes: FlowNode[],
	/** 사용된 색상 수 (= 메인 오브젝트 쌍의 수) */
	colorCount: number,
}

export type FlowResultData = {
	result: EFlowResult,
	roundsCleared: number,
	roundCount: number,
	remainingTimeSeconds: number,
	/** 아직 색을 받지 못한 서브 오브젝트 수 */
	remainingSubCount: number,
}

export type FlowRoundProgress = {
	current: number,
	total: number,
	cleared: number,
}

export type FlowValidationResult = {
	isValid: boolean,
	violations: string[],
}

/** 경로 확장 시도 결과 */
export type ExtendCheck = {
	isValid: boolean,
	rejection: EExtendRejection,
	/** 이 이동이 되돌아가기(Undo)인지 - §6 지우기 */
	isUndo: boolean,
}

//#endregion

//#region Helpers

export function isInsideGrid(row: number, col: number): boolean {
	return row >= 0 && row < FLOW_GRID_SIZE && col >= 0 && col < FLOW_GRID_SIZE;
}

/** 상하좌우 인접 여부 - §5 "대각선 연결 불가" */
export function isOrthogonallyAdjacent(left: FlowCell, right: FlowCell): boolean {
	const rowDelta = Math.abs(left.row - right.row);
	const colDelta = Math.abs(left.col - right.col);
	return (rowDelta === 1 && colDelta === 0) || (rowDelta === 0 && colDelta === 1);
}

/** 상하좌우 이웃 칸 */
export function getOrthogonalNeighbors(cell: FlowCell): FlowCell[] {
	return [
		{ row: cell.row - 1, col: cell.col },
		{ row: cell.row + 1, col: cell.col },
		{ row: cell.row, col: cell.col - 1 },
		{ row: cell.row, col: cell.col + 1 },
	].filter((candidate) => isInsideGrid(candidate.row, candidate.col));
}

export function cellKey(row: number, col: number): string {
	return `${row},${col}`;
}

export function cloneNode(node: FlowNode): FlowNode {
	return {
		row: node.row,
		col: node.col,
		kind: node.kind,
		color: node.color,
		role: node.role,
	};
}

export function cloneTiles(tiles: boolean[][]): boolean[][] {
	return tiles.map((row) => row.slice());
}

export function cloneLevel(level: FlowLevel): FlowLevel {
	return {
		puzzleId: level.puzzleId,
		difficulty: level.difficulty,
		tiles: cloneTiles(level.tiles),
		nodes: level.nodes.map(cloneNode),
		colorCount: level.colorCount,
	};
}

/** 비어 있는(전부 false) 7x7 타일 배열 */
export function createEmptyTiles(): boolean[][] {
	const tiles: boolean[][] = [];
	for (let row = 0; row < FLOW_GRID_SIZE; row++) {
		const line: boolean[] = [];
		for (let col = 0; col < FLOW_GRID_SIZE; col++) {
			line.push(false);
		}
		tiles.push(line);
	}
	return tiles;
}

/**
 * `"1111111"` 같은 문자열 7줄을 타일 비트맵으로 바꾼다 - §3.
 * 문자열이 7줄 x 7글자가 아니면 undefined 를 돌려준다.
 */
export function parseTileBitmap(lines: readonly string[]): boolean[][] | undefined {
	if (lines.length !== FLOW_GRID_SIZE) {
		return undefined;
	}

	const tiles = createEmptyTiles();
	for (let row = 0; row < FLOW_GRID_SIZE; row++) {
		const line = lines[row];
		if (line.length !== FLOW_GRID_SIZE) {
			return undefined;
		}
		for (let col = 0; col < FLOW_GRID_SIZE; col++) {
			tiles[row][col] = line.charAt(col) === '1';
		}
	}
	return tiles;
}

/** 타일 비트맵을 문자열 7줄로 되돌린다 (디버그/테이블 저장용) */
export function formatTileBitmap(tiles: readonly boolean[][]): string[] {
	return tiles.map((line) => line.map((hasTile) => (hasTile ? '1' : '0')).join(''));
}

export function countTiles(tiles: readonly boolean[][]): number {
	let count = 0;
	for (const line of tiles) {
		for (const hasTile of line) {
			if (hasTile) {
				count++;
			}
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
