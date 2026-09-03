/**
 * Rush Hour (USB Sliding Block) Puzzle - Core Definitions
 *
 * Source: Documents/[HID] PUZ_02러시아워_시스템 기획서_Ver.1.0.6.pdf
 * Prompt: Documents/Prompts/PUZ_02_러시아워퍼즐.md (+ PUZ_00 공통 기반)
 *
 * PUZ_00 §7.1 요구사항에 따라 이 계층은 "순수 로직" 이다.
 * horizon/core 에 대한 런타임 의존이 없으므로 2D 프로토타입/테스트에서 동일하게 검증할 수 있다.
 *
 * 좌표계
 * ------
 *  - 전체 그리드: 9 x 9 (기획서 §3, 보이지 않는 테두리 링 포함), 세로 A~I / 가로 1~9
 *  - 플레이 공간: 중앙 7 x 7 (로컬 좌표 A1~G7)
 *  - 오브젝트(piece)의 row/col 은 항상 "플레이 로컬 좌표" 0..6 이며,
 *    기획서 §7 의 "오브젝트의 중심 = 좌측·상단 1x1 블록" 규칙에 따라 좌측·상단 칸을 가리킨다.
 *  - 도착 포인트(endPoint)는 테두리 링에 존재하므로 "전체 그리드 좌표" 0..8 로 저장한다.
 */

//#region Constants

/** 전체 그리드 한 변의 칸 수 (보이지 않는 테두리 링 포함) - 기획서 §3 */
export const RUSH_HOUR_FULL_GRID_SIZE = 9;
/** 실제 플레이 공간 한 변의 칸 수 - 기획서 §3 */
export const RUSH_HOUR_PLAY_GRID_SIZE = 7;
/** 플레이 공간이 시작되는 전체 그리드 인덱스 (테두리 링 1칸) */
export const RUSH_HOUR_PLAY_ORIGIN = 1;
/** 플레이 로컬 좌표의 최대 인덱스 */
export const RUSH_HOUR_PLAY_MAX_INDEX = RUSH_HOUR_PLAY_GRID_SIZE - 1;

/** 도착 포인트 최대 개수 - 기획서 §4 ("2개 초과 불가") */
export const MAX_END_POINTS = 2;
/** 레벨당 목표 오브젝트 최대 개수 - 기획서 §5.1 */
export const MAX_GOAL_OBJECTS = 2;
/** 추가 목표 오브젝트가 등장하기 시작하는 난이도 - 기획서 §5.1 */
export const MULTI_GOAL_MIN_DIFFICULTY = 3;

/** 목표 오브젝트(USB)의 크기 1x2 - 기획서 §5.1 */
export const GOAL_OBJECT_LENGTH = 2;
/** USB 가 꽂힌 상태에서 점유하는 칸 수 - 기획서 §9 */
export const DOCKED_OCCUPANCY_LENGTH = 3;

/** 방해 오브젝트가 가질 수 있는 길이 (1x1 / 2x1 / 3x1 / 4x1) - 기획서 §5.2 */
export const BLOCKER_LENGTHS: readonly number[] = [1, 2, 3, 4];

/** 타일 영역 점유 배타성 허용 오차 1mm - 기획서 §7 */
export const AREA_OCCUPANCY_TOLERANCE_METERS = 0.001;

//#endregion

//#region Enums

/**
 * 오브젝트의 이동 축 - 기획서 §5.2 / §11.1
 * 1x1 오브젝트만 FREE(전 방향 이동) 를 가진다.
 */
export enum EOrientation {
	HORIZONTAL = 'H',
	VERTICAL = 'V',
	FREE = 'FREE',
}

/** 목표 오브젝트 / 도착 포인트 색상 - 기획서 §4, §5.1 */
export enum EPieceColor {
	RED = 'RED',
	BLUE = 'BLUE',
	/** 방해 오브젝트처럼 색 판정이 없는 경우 */
	NEUTRAL = 'NEUTRAL',
}

/** 9x9 테두리 링에서 도착 포인트가 위치할 수 있는 변 */
export enum EEdge {
	TOP = 'TOP',
	BOTTOM = 'BOTTOM',
	LEFT = 'LEFT',
	RIGHT = 'RIGHT',
}

/** 한 번의 슬라이드가 향하는 방향 */
export enum EMoveDirection {
	UP = 'UP',
	DOWN = 'DOWN',
	LEFT = 'LEFT',
	RIGHT = 'RIGHT',
}

/** 공통 오브젝트 상태 - PUZ_00 §5 */
export enum EObjectState {
	ON = 'On',
	OFF = 'Off',
	FAULT = 'Fault',
}

/** 목표 오브젝트(USB)의 결합 진행 상태 - 기획서 §9 */
export enum EGoalStatus {
	/** 도착 포인트와 동일 선상이지만 아직 도달하지 못함 */
	BLOCKED = 'BLOCKED',
	/** 도착 포인트에 도달, 유저가 꽂을 수 있는 상태 */
	READY = 'READY',
	/** 실제로 꽂힌 상태 (3칸 점유) */
	DOCKED = 'DOCKED',
}

/** 러시아워 퍼즐 진행 상태 머신 - PUZ_00 §7.1 */
export enum ERushHourState {
	IDLE = 'idle',
	ROUND_INTRO = 'round_intro',
	PLAYER_INPUT = 'player_input',
	MOVING = 'moving',
	ROUND_CLEAR = 'round_clear',
	QUEST_CLEAR = 'quest_clear',
	PAUSED = 'paused',
	GAME_OVER = 'game_over',
}

/** 퍼즐 승패 - 기획서 §2 */
export enum ERushHourResult {
	WIN = 'win',
	LOSE = 'lose',
}

//#endregion

//#region Data types

/** 격자 한 칸. 어떤 좌표계인지는 사용처가 명시한다. */
export type RushHourCell = {
	row: number,
	col: number,
}

/**
 * 보드 위의 오브젝트 한 개 - 기획서 §11.1
 * `{id, size, orientation(H|V|FREE), row, col, color, isGoal}`
 */
export type RushHourPiece = {
	id: string,
	/** 길이(칸 수). 목표 오브젝트는 항상 2, 방해 오브젝트는 1~4 */
	size: number,
	orientation: EOrientation,
	/** 플레이 로컬 좌표 0..6, 상단 칸 */
	row: number,
	/** 플레이 로컬 좌표 0..6, 좌측 칸 */
	col: number,
	color: EPieceColor,
	isGoal: boolean,
}

/** 도착 포인트 - 기획서 §4. 전체 그리드(9x9) 좌표를 사용한다. */
export type RushHourEndPoint = {
	id: string,
	edge: EEdge,
	/** 전체 그리드 좌표 0..8 */
	row: number,
	/** 전체 그리드 좌표 0..8 */
	col: number,
	/** 동일 선상의 목표 오브젝트와 같은 색상 - 기획서 §4 */
	color: EPieceColor,
}

/** 완성된 한 판의 배치 정보 */
export type RushHourLevel = {
	puzzleId: string,
	difficulty: number,
	pieces: RushHourPiece[],
	endPoints: RushHourEndPoint[],
	/** BFS 솔버가 구한 최소 이동 수 - 기획서 §11.2 */
	minimumMoves: number,
}

/** 한 번의 슬라이드 조작 */
export type RushHourMove = {
	pieceId: string,
	direction: EMoveDirection,
	/** 이동한 칸 수 (1 이상) */
	steps: number,
}

/** 퍼즐 종료 결과 */
export type RushHourResultData = {
	result: ERushHourResult,
	roundsCleared: number,
	roundCount: number,
	remainingTimeSeconds: number,
}

/** 라운드 슬롯 표시용 진행도 - PUZ_00 §2.1 / §3 */
export type RushHourRoundProgress = {
	/** 1-based 현재 라운드 */
	current: number,
	total: number,
	cleared: number,
}

/** 레벨 생성기 / 배치 검증 결과 - 기획서 §6 */
export type RushHourValidationResult = {
	isValid: boolean,
	violations: string[],
}

//#endregion

//#region Coordinate helpers

/** 플레이 로컬 좌표 -> 전체 9x9 그리드 좌표 */
export function toFullGridIndex(localIndex: number): number {
	return localIndex + RUSH_HOUR_PLAY_ORIGIN;
}

/** 전체 9x9 그리드 좌표 -> 플레이 로컬 좌표 */
export function toPlayLocalIndex(fullIndex: number): number {
	return fullIndex - RUSH_HOUR_PLAY_ORIGIN;
}

/** 플레이 공간(7x7) 안의 좌표인지 */
export function isInsidePlayField(row: number, col: number): boolean {
	return row >= 0 && row < RUSH_HOUR_PLAY_GRID_SIZE && col >= 0 && col < RUSH_HOUR_PLAY_GRID_SIZE;
}

/**
 * 오브젝트가 점유하는 모든 칸 (플레이 로컬 좌표).
 * FREE(1x1) 는 언제나 한 칸이다.
 */
export function getPieceCells(piece: RushHourPiece): RushHourCell[] {
	if (piece.orientation === EOrientation.FREE) {
		return [{ row: piece.row, col: piece.col }];
	}

	const cells: RushHourCell[] = [];
	for (let i = 0; i < piece.size; i++) {
		if (piece.orientation === EOrientation.VERTICAL) {
			cells.push({ row: piece.row + i, col: piece.col });
		}
		else {
			cells.push({ row: piece.row, col: piece.col + i });
		}
	}
	return cells;
}

/** 오브젝트가 해당 방향으로 이동할 수 있는 축을 가졌는지 - 기획서 §5.2 */
export function canMoveOnAxis(orientation: EOrientation, direction: EMoveDirection): boolean {
	if (orientation === EOrientation.FREE) {
		return true;
	}
	if (orientation === EOrientation.HORIZONTAL) {
		return direction === EMoveDirection.LEFT || direction === EMoveDirection.RIGHT;
	}
	return direction === EMoveDirection.UP || direction === EMoveDirection.DOWN;
}

/** 방향 -> (rowDelta, colDelta) */
export function getDirectionDelta(direction: EMoveDirection): RushHourCell {
	switch (direction) {
		case EMoveDirection.UP: return { row: -1, col: 0 };
		case EMoveDirection.DOWN: return { row: 1, col: 0 };
		case EMoveDirection.LEFT: return { row: 0, col: -1 };
		default: return { row: 0, col: 1 };
	}
}

/** 오브젝트가 이동할 수 있는 모든 방향 - 기획서 §5.2 */
export function getAllowedDirections(orientation: EOrientation): EMoveDirection[] {
	if (orientation === EOrientation.FREE) {
		return [EMoveDirection.UP, EMoveDirection.DOWN, EMoveDirection.LEFT, EMoveDirection.RIGHT];
	}
	if (orientation === EOrientation.HORIZONTAL) {
		return [EMoveDirection.LEFT, EMoveDirection.RIGHT];
	}
	return [EMoveDirection.UP, EMoveDirection.DOWN];
}

/** 도착 포인트가 놓인 변이 요구하는 목표 오브젝트의 이동 축 - 기획서 §5.1 */
export function getOrientationForEdge(edge: EEdge): EOrientation {
	if (edge === EEdge.TOP || edge === EEdge.BOTTOM) {
		return EOrientation.VERTICAL;
	}
	return EOrientation.HORIZONTAL;
}

/** 도착 포인트를 향해 목표 오브젝트가 나아가야 하는 방향 */
export function getDirectionTowardsEdge(edge: EEdge): EMoveDirection {
	switch (edge) {
		case EEdge.TOP: return EMoveDirection.UP;
		case EEdge.BOTTOM: return EMoveDirection.DOWN;
		case EEdge.LEFT: return EMoveDirection.LEFT;
		default: return EMoveDirection.RIGHT;
	}
}

/**
 * 도착 포인트와 "동일 선상"인 플레이 로컬 인덱스.
 * TOP/BOTTOM 이면 열(col), LEFT/RIGHT 이면 행(row) 이다.
 */
export function getEndPointLaneIndex(endPoint: RushHourEndPoint): number {
	if (endPoint.edge === EEdge.TOP || endPoint.edge === EEdge.BOTTOM) {
		return toPlayLocalIndex(endPoint.col);
	}
	return toPlayLocalIndex(endPoint.row);
}

/** 오브젝트가 도착 포인트와 동일 선상에 있는지 - 기획서 §5.1 (배치 필수 조건) */
export function isOnEndPointLane(piece: RushHourPiece, endPoint: RushHourEndPoint): boolean {
	if (piece.orientation !== getOrientationForEdge(endPoint.edge)) {
		return false;
	}
	const lane = getEndPointLaneIndex(endPoint);
	if (endPoint.edge === EEdge.TOP || endPoint.edge === EEdge.BOTTOM) {
		return piece.col === lane;
	}
	return piece.row === lane;
}

/**
 * 목표 오브젝트가 도착 포인트에 도달했는지 - 기획서 §2 (클리어 조건).
 *
 * 판정은 "목표의 앞머리 칸이 도착 포인트 칸에 맞닿았는가" 하나로 통일한다.
 *
 *   - 절차적 생성기가 만드는 판: 도착 포인트가 9x9 테두리 링에 있으므로
 *     "플레이 공간의 해당 변에 밀착" 과 결과가 완전히 같다.
 *   - 기획 CSV(NPUZ_02) 로 만든 판: 도착 포인트가 7x7 안쪽 가장자리 칸에 있고
 *     USB 는 그 앞 칸까지 와서 꽂힌다(꽂히면 §9 대로 3칸 = USB 2칸 + 포인트 1칸).
 */
export function hasReachedEndPoint(piece: RushHourPiece, endPoint: RushHourEndPoint): boolean {
	if (piece.color !== endPoint.color) {
		return false;
	}
	if (isOnEndPointLane(piece, endPoint) === false) {
		return false;
	}

	// 도착 포인트는 전체 9x9 좌표, 오브젝트는 플레이 로컬 좌표라 한쪽으로 맞춘다
	const topFull = toFullGridIndex(piece.row);
	const leftFull = toFullGridIndex(piece.col);
	switch (endPoint.edge) {
		case EEdge.TOP: return topFull === endPoint.row + 1;
		case EEdge.BOTTOM: return topFull + piece.size - 1 === endPoint.row - 1;
		case EEdge.LEFT: return leftFull === endPoint.col + 1;
		default: return leftFull + piece.size - 1 === endPoint.col - 1;
	}
}

/**
 * 목표 오브젝트가 도착 포인트에 "밀착" 하는 이동 축 좌표 (플레이 로컬).
 *
 * `hasReachedEndPoint()` 가 참이 되는 단 하나의 좌표를 거꾸로 푼 값이다.
 * 축은 도착 포인트가 놓인 변이 정한다 - TOP/BOTTOM 이면 row, LEFT/RIGHT 이면 col.
 *
 * ## 왜 필요한가
 *
 * 결합(§9)은 "밀착한 자리에서 슬롯 쪽으로 반 칸 더" 인데, 예전에는 그 밀착 자리를
 * **플레이 공간의 바깥 변**(0 또는 size-1)으로 가정했다. 절차적 생성 판은 도착 포인트가
 * 9x9 테두리 링에 있어 그 가정이 맞지만, 기획 CSV(NPUZ_02) 판은 도착 포인트가 7x7 안쪽
 * 가장자리 칸에 있어 USB 가 그 **앞 칸**까지밖에 못 간다. 그래서 밀착 판정이 영원히 거짓이
 * 되고 USB 를 꽂을 수 없어 판이 클리어되지 않았다. 여기서 좌표를 직접 구해 그 가정을 없앤다.
 */
export function getFlushAxisValue(piece: RushHourPiece, endPoint: RushHourEndPoint): number {
	switch (endPoint.edge) {
		// topFull === endPoint.row + 1
		case EEdge.TOP: return toPlayLocalIndex(endPoint.row + 1);
		// topFull + size - 1 === endPoint.row - 1
		case EEdge.BOTTOM: return toPlayLocalIndex(endPoint.row - piece.size);
		// leftFull === endPoint.col + 1
		case EEdge.LEFT: return toPlayLocalIndex(endPoint.col + 1);
		// leftFull + size - 1 === endPoint.col - 1
		default: return toPlayLocalIndex(endPoint.col - piece.size);
	}
}

/** 도착 포인트가 플레이 공간(7x7) 안의 칸인지 - 기획 CSV 판이 여기에 해당한다 */
export function isEndPointInsidePlayField(endPoint: RushHourEndPoint): boolean {
	return isInsidePlayField(toPlayLocalIndex(endPoint.row), toPlayLocalIndex(endPoint.col));
}

/** 9x9 테두리 링에서 꼭짓점을 제외한 모든 도착 포인트 후보 좌표 - 기획서 §4 */
export function getEndPointCandidates(): { edge: EEdge, row: number, col: number }[] {
	const candidates: { edge: EEdge, row: number, col: number }[] = [];
	const last = RUSH_HOUR_FULL_GRID_SIZE - 1;
	for (let i = RUSH_HOUR_PLAY_ORIGIN; i <= last - RUSH_HOUR_PLAY_ORIGIN; i++) {
		candidates.push({ edge: EEdge.TOP, row: 0, col: i });
		candidates.push({ edge: EEdge.BOTTOM, row: last, col: i });
		candidates.push({ edge: EEdge.LEFT, row: i, col: 0 });
		candidates.push({ edge: EEdge.RIGHT, row: i, col: last });
	}
	return candidates;
}

/** 오브젝트를 값 복사한다 (솔버 / 되돌리기용) */
export function clonePiece(piece: RushHourPiece): RushHourPiece {
	return {
		id: piece.id,
		size: piece.size,
		orientation: piece.orientation,
		row: piece.row,
		col: piece.col,
		color: piece.color,
		isGoal: piece.isGoal,
	};
}

/** 레벨을 값 복사한다 */
export function cloneLevel(level: RushHourLevel): RushHourLevel {
	return {
		puzzleId: level.puzzleId,
		difficulty: level.difficulty,
		pieces: level.pieces.map(clonePiece),
		endPoints: level.endPoints.map((endPoint) => ({
			id: endPoint.id,
			edge: endPoint.edge,
			row: endPoint.row,
			col: endPoint.col,
			color: endPoint.color,
		})),
		minimumMoves: level.minimumMoves,
	};
}

//#endregion

//#region Random

/** 재현 가능한 난수. 레벨 생성 결과를 시드로 재현하기 위해 사용한다. */
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
