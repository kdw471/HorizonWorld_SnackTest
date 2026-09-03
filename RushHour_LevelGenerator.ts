/**
 * Rush Hour Level Generator - 항상 풀 수 있는 배치만 출력하는 레벨 생성기
 *
 * PUZ_00 §7.3 / PUZ_02 §11.2:
 *   "레벨 생성기는 항상 해결 가능한(solvable) 배치만 출력해야 한다.
 *    생성 후 솔버로 검증하고, 실패 시 재생성한다."
 *   "난이도는 최소 이동 수와 방해 오브젝트 수로 스케일링한다."
 *
 * 생성 절차
 *   1) 난이도 테이블에서 목표 수 / 방해 오브젝트 수 / 최소 이동 수 범위를 읽는다
 *   2) 꼭짓점을 제외한 테두리 링에 도착 포인트를 1~2개 배치한다 (§4)
 *   3) 각 도착 포인트와 동일 선상에 같은 색 목표 USB(1x2)를 배치한다 (§5.1)
 *   4) 방해 오브젝트를 겹치지 않게 배치한다 (§5.2)
 *   5) §6 배치 제약 3종을 검증한다
 *   6) BFS 솔버로 해의 존재와 최소 이동 수 범위를 검증한다
 *   7) 어느 하나라도 실패하면 처음부터 재생성한다
 */

import { RushHourBoard } from 'RushHour_Board';
import { RushHourReachableState, RushHourSolver } from 'RushHour_Solver';
import { RushHourDifficultyConfig, RushHourTables } from 'RushHour_DataTables';
import {
	EEdge,
	EOrientation,
	EPieceColor,
	GOAL_OBJECT_LENGTH,
	MAX_END_POINTS,
	MAX_GOAL_OBJECTS,
	RUSH_HOUR_PLAY_GRID_SIZE,
	RandomSource,
	RushHourEndPoint,
	RushHourLevel,
	RushHourPiece,
	RushHourValidationResult,
	clonePiece,
	createSeededRandom,
	getEndPointCandidates,
	getEndPointLaneIndex,
	getOrientationForEdge,
	hasReachedEndPoint,
	isEndPointInsidePlayField,
	isOnEndPointLane,
	pickRandom,
	randomInt,
	shuffleInPlace,
} from 'RushHour_Definitions';

export type RushHourGenerationOptions = {
	puzzleId: string,
	difficulty: number,
	/** 재현 가능한 결과를 원할 때의 시드 */
	seed?: number,
	/** 재생성 시도 횟수 상한 */
	maxAttempts?: number,
	/** 난이도 테이블을 직접 지정하고 싶을 때 */
	config?: RushHourDifficultyConfig,
}

const DEFAULT_MAX_ATTEMPTS = 80;
const BLOCKER_PLACEMENT_ATTEMPTS = 40;
/** 한 구성에서 살펴볼 배치 후보 수 상한 */
const EXPLORE_RESULT_LIMIT = 4000;

//#region Validator

/**
 * 기획서 §6 배치 제약 검증기.
 *
 *   [금지] 목표 오브젝트와 "같은 이동 방향"을 가진 방해 오브젝트를
 *          목표 오브젝트와 도착 지점 사이에 배치할 수 없다.
 *   [금지] 동일한 이동 방향을 가진 오브젝트들의 배치로
 *          필드의 한 줄(최대 칸수)을 가득 채울 수 없다.
 *   [필수] 모든 오브젝트는 최소 1칸 이상 움직일 수 있도록 배치되어야 한다.
 */
export type RushHourValidateOptions = {
	/**
	 * §6 의 두 항목은 "레벨 생성기 필수 검증 항목" 이라 절차적 생성에만 강제한다.
	 *   - 같은 이동 방향 오브젝트로 한 줄을 가득 채우지 않는다
	 *   - 모든 오브젝트가 최소 1칸 이상 움직일 수 있다
	 * 기획 CSV(NPUZ_02) 는 이 둘을 지키지 않는 판이 많으므로 false 로 끄고 검사한다.
	 */
	enforceGeneratorConstraints?: boolean,
}

export class RushHourPlacementValidator {
	public validate(board: RushHourBoard, options: RushHourValidateOptions = {}): RushHourValidationResult {
		const violations: string[] = [];
		const enforceGeneratorConstraints = options.enforceGeneratorConstraints ?? true;

		this.validateEndPoints(board, violations);
		this.validateGoals(board, violations);
		this.validateGoalCorridor(board, violations);
		if (enforceGeneratorConstraints) {
			this.validateSaturatedLines(board, violations);
			this.validateEveryPieceCanMove(board, violations);
		}

		return { isValid: violations.length === 0, violations: violations };
	}

	/**
	 * §4 - 도착 포인트는 꼭짓점을 제외한 자리에 최대 2곳.
	 *
	 * 자리로 인정하는 곳은 두 가지다.
	 *   - 9x9 테두리 링 (기획서 §4 원문. 절차적 생성기가 여기에 놓는다)
	 *   - 7x7 플레이 공간 안의 칸 (기획 CSV 가 쓰는 방식. USB 가 그 칸으로 꽂혀 들어간다)
	 */
	private validateEndPoints(board: RushHourBoard, violations: string[]): void {
		if (board.endPoints.length === 0) {
			violations.push('There are no end points.');
			return;
		}
		if (board.endPoints.length > MAX_END_POINTS) {
			violations.push(`End points are limited to ${MAX_END_POINTS} (got ${board.endPoints.length}).`);
		}

		const candidates = getEndPointCandidates();
		for (const endPoint of board.endPoints) {
			const isOnRing = candidates.some((candidate) =>
				candidate.edge === endPoint.edge && candidate.row === endPoint.row && candidate.col === endPoint.col);
			if (isOnRing === false && isEndPointInsidePlayField(endPoint) === false) {
				violations.push(`End point '${endPoint.id}' is neither on the border ring (corners excluded) nor inside the play field.`);
			}
		}
	}

	/** §5.1 - 목표는 최대 2개, 반드시 동일 색 도착 포인트와 동일 선상 */
	private validateGoals(board: RushHourBoard, violations: string[]): void {
		const goals = board.goalPieces;
		if (goals.length === 0) {
			violations.push('There are no goal objects.');
			return;
		}
		if (goals.length > MAX_GOAL_OBJECTS) {
			violations.push(`Goal objects are limited to ${MAX_GOAL_OBJECTS} (got ${goals.length}).`);
		}

		for (const goal of goals) {
			if (goal.size !== GOAL_OBJECT_LENGTH) {
				violations.push(`Goal object '${goal.id}' must be 1x${GOAL_OBJECT_LENGTH}.`);
			}
			const endPoint = board.getEndPointForPiece(goal.id);
			if (endPoint === undefined) {
				violations.push(`No end point shares the line and color of goal object '${goal.id}'.`);
				continue;
			}
			if (hasReachedEndPoint(goal, endPoint)) {
				violations.push(`Goal object '${goal.id}' already reaches an end point at start.`);
			}
		}
	}

	/** §6 [금지] 목표와 같은 이동 방향의 방해 오브젝트를 목표-도착 지점 사이에 둘 수 없다 */
	private validateGoalCorridor(board: RushHourBoard, violations: string[]): void {
		for (const goal of board.goalPieces) {
			const corridor = board.getCellsBetweenGoalAndEndPoint(goal.id);
			for (const cell of corridor) {
				const occupant = board.getPieceAt(cell.row, cell.col);
				if (occupant === undefined || occupant.id === goal.id) {
					continue;
				}
				if (occupant.orientation === goal.orientation) {
					violations.push(`'${occupant.id}' blocks the goal path (${cell.row},${cell.col}) while moving on the same axis as goal '${goal.id}'.`);
				}
			}
		}
	}

	/** §6 [금지] 같은 이동 방향 오브젝트들이 한 줄을 가득 채울 수 없다 */
	private validateSaturatedLines(board: RushHourBoard, violations: string[]): void {
		for (const line of board.getSaturatedLines()) {
			const axisName = line.axis === EOrientation.HORIZONTAL ? 'row' : 'column';
			violations.push(`${axisName} ${line.index} is completely filled with objects moving on the same axis.`);
		}
	}

	/** §6 [필수] 모든 오브젝트는 최소 1칸 이상 움직일 수 있어야 한다 */
	private validateEveryPieceCanMove(board: RushHourBoard, violations: string[]): void {
		for (const pieceId of board.getImmovablePieceIds()) {
			violations.push(`'${pieceId}' cannot move in any direction.`);
		}
	}
}

//#endregion

//#region Generator

export class RushHourLevelGenerator {
	private readonly _tables: RushHourTables;
	private readonly _solver: RushHourSolver;
	private readonly _validator: RushHourPlacementValidator;

	constructor(tables: RushHourTables, solver: RushHourSolver = new RushHourSolver(), validator: RushHourPlacementValidator = new RushHourPlacementValidator()) {
		this._tables = tables;
		this._solver = solver;
		this._validator = validator;
	}

	public get validator(): RushHourPlacementValidator {
		return this._validator;
	}

	/**
	 * 해가 존재하고 §6 배치 제약을 모두 만족하는 레벨을 생성한다.
	 * 시도 횟수를 모두 소진하면 undefined 를 돌려준다 (호출측에서 필드 테이블로 대체).
	 */
	public generate(options: RushHourGenerationOptions): RushHourLevel | undefined {
		const config = options.config ?? this._tables.getDifficultyConfig(options.difficulty);
		if (config === undefined) {
			console.warn(`[RushHourLevelGenerator] No difficulty config for difficulty ${options.difficulty}`);
			return undefined;
		}

		const random = options.seed === undefined ? Math.random : createSeededRandom(options.seed);
		const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

		let bestBoard: RushHourBoard | undefined = undefined;
		let bestDistance = 0;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			// 1) 오브젝트 "구성"을 무작위로 만든다.
			//    목표 USB 는 도착 포인트에 밀착한 완성 상태로 놓이므로 해가 반드시 존재한다.
			const board = this.buildCandidate(random, config);
			if (board === undefined) {
				continue;
			}

			// 2) 이 구성으로 도달 가능한 모든 배치와 각각의 최소 이동 수를 한 번에 받아온다.
			//    배치마다 솔버를 새로 돌리는 것보다 훨씬 빠르고, 최소 이동 수를 정확히 알 수 있다 (§11.2).
			const states = this._solver.exploreReachableStates(board, {
				distanceMin: 1,
				distanceMax: config.minimumMovesMax,
				maxResults: EXPLORE_RESULT_LIMIT,
			});
			if (states.length === 0) {
				continue;
			}

			// 3) 깊은 배치부터 보면서 §6 배치 제약을 통과하는 가장 어려운 것을 고른다.
			states.sort((left, right) => right.distanceToGoal - left.distanceToGoal);
			for (const state of states) {
				if (state.distanceToGoal <= bestDistance) {
					// 이미 확보한 것보다 쉬운 배치는 볼 필요가 없다.
					break;
				}
				const candidate = this.applyState(board, state);
				if (candidate === undefined) {
					continue;
				}
				if (this._validator.validate(candidate).isValid === false) {
					continue;
				}
				bestBoard = candidate;
				bestDistance = state.distanceToGoal;
				break;
			}

			if (bestBoard !== undefined && bestDistance >= config.minimumMovesMin) {
				return this.adoptBoard(bestBoard, bestDistance, options);
			}
		}

		if (bestBoard !== undefined) {
			// §6 [필수] "모든 오브젝트는 최소 1칸 이상 움직일 수 있어야 한다" 가
			// 촘촘한(=어려운) 배치를 걸러내므로, 요구 범위를 채우지 못하는 난이도가 있을 수 있다.
			// 실패시키는 대신 찾아낸 것 중 가장 어려운 배치를 실제 최소 이동 수와 함께 돌려준다.
			console.warn(`[RushHourLevelGenerator] difficulty ${options.difficulty}: adopted a ${bestDistance}-move layout, below the required minimum of ${config.minimumMovesMin} moves`);
			return this.adoptBoard(bestBoard, bestDistance, options);
		}

		console.warn(`[RushHourLevelGenerator] Failed to generate a level for difficulty ${options.difficulty} within ${maxAttempts} attempts`);
		return undefined;
	}

	/**
	 * 채택 직전에 정확한 최소 이동 수를 다시 잰다.
	 *
	 * exploreReachableStates() 는 상태 수 상한에서 그래프를 잘라내므로, 잘려나간 상태를
	 * 경유하는 더 짧은 해가 있으면 탐색 거리가 실제 최소 이동 수보다 커질 수 있다.
	 * 레벨에 기록되는 minimumMoves 는 난이도 표기의 근거이므로 솔버로 한 번 재검증한다.
	 */
	private adoptBoard(board: RushHourBoard, exploredDistance: number, options: RushHourGenerationOptions): RushHourLevel {
		const solved = this._solver.solve(board, { reconstructPath: false });
		const minimumMoves = solved.isSolvable && solved.minimumMoves >= 0 ? solved.minimumMoves : exploredDistance;
		if (minimumMoves !== exploredDistance) {
			console.warn(`[RushHourLevelGenerator] Layout explored at ${exploredDistance} moves actually solves in ${minimumMoves} moves (search-cap truncation adjusted).`);
		}
		return board.toLevel(options.puzzleId, options.difficulty, minimumMoves);
	}

	/** 탐색으로 얻은 배치를 실제 보드로 만든다 */
	private applyState(board: RushHourBoard, state: RushHourReachableState): RushHourBoard | undefined {
		const positionById = new Map<string, { row: number, col: number }>();
		for (const position of state.positions) {
			positionById.set(position.pieceId, { row: position.row, col: position.col });
		}

		const pieces: RushHourPiece[] = [];
		for (const piece of board.pieces) {
			const position = positionById.get(piece.id);
			if (position === undefined) {
				return undefined;
			}
			const moved = clonePiece(piece);
			moved.row = position.row;
			moved.col = position.col;
			pieces.push(moved);
		}

		const next = new RushHourBoard(pieces, board.endPoints.slice(), board.size);
		if (next.pieces.length !== pieces.length) {
			// 겹침 등으로 일부가 배치되지 못했다면 버린다.
			return undefined;
		}
		return next;
	}

	/** 이미 만들어진 레벨이 §6 제약과 해의 존재를 만족하는지 확인한다 */
	public verify(level: RushHourLevel): RushHourValidationResult {
		const board = RushHourBoard.fromLevel(level);
		const result = this._validator.validate(board);
		if (result.isValid === false) {
			return result;
		}

		const solution = this._solver.solve(board, { reconstructPath: false });
		if (solution.isSolvable === false) {
			return { isValid: false, violations: ['No solution exists (BFS search failed).'] };
		}
		return { isValid: true, violations: [] };
	}

	/** §11.2 - 최소 이동 수와 방해 오브젝트 수로 난이도를 스케일링한다 */
	public estimateDifficulty(minimumMoves: number, blockerCount: number): number {
		const table = this._tables.difficultyTable;
		for (const config of table) {
			const movesMatch = minimumMoves >= config.minimumMovesMin && minimumMoves <= config.minimumMovesMax;
			const blockersMatch = blockerCount >= config.blockerCountMin && blockerCount <= config.blockerCountMax;
			if (movesMatch && blockersMatch) {
				return config.difficulty;
			}
		}
		for (const config of table) {
			if (minimumMoves <= config.minimumMovesMax) {
				return config.difficulty;
			}
		}
		return table.length > 0 ? table[table.length - 1].difficulty : 1;
	}

	//#region Internal

	/**
	 * 오브젝트 "구성"을 만든다.
	 *
	 * 목표 USB 는 일부러 **도착 포인트에 밀착한 완성 상태**로 놓는다.
	 * 이러면 이 구성의 상태 그래프에 클리어 상태가 반드시 존재하므로,
	 * 이후 exploreReachableStates() 가 헛도는 일이 없다.
	 * 실제 시작 배치는 탐색 결과에서 원하는 난이도의 상태를 골라 쓴다
	 * (README 의 "완성 상태에서 역방향으로 흐트러뜨리는" 원칙).
	 */
	private buildCandidate(random: RandomSource, config: RushHourDifficultyConfig): RushHourBoard | undefined {
		const goalCount = Math.min(config.goalCount, MAX_GOAL_OBJECTS);
		const endPoints = this.pickEndPoints(random, goalCount);
		if (endPoints.length !== goalCount) {
			return undefined;
		}

		const board = new RushHourBoard([], endPoints, RUSH_HOUR_PLAY_GRID_SIZE);

		for (let index = 0; index < endPoints.length; index++) {
			if (this.placeGoal(board, endPoints[index], index) === false) {
				return undefined;
			}
		}

		const blockerCount = randomInt(random, config.blockerCountMin, config.blockerCountMax);
		let placed = 0;
		for (let index = 0; index < blockerCount; index++) {
			if (this.placeBlocker(random, board, config, index)) {
				placed++;
			}
		}
		if (placed < config.blockerCountMin) {
			return undefined;
		}

		return board;
	}

	/** §4 - 꼭짓점을 제외한 테두리에서 서로 다른 변/레인의 도착 포인트를 고른다 */
	private pickEndPoints(random: RandomSource, count: number): RushHourEndPoint[] {
		const candidates = shuffleInPlace(random, getEndPointCandidates());
		const colors = [EPieceColor.RED, EPieceColor.BLUE];
		const chosen: RushHourEndPoint[] = [];

		for (const candidate of candidates) {
			if (chosen.length >= count) {
				break;
			}

			const endPoint: RushHourEndPoint = {
				id: `END_${colors[chosen.length]}`,
				edge: candidate.edge,
				row: candidate.row,
				col: candidate.col,
				color: colors[chosen.length],
			};

			// 두 목표의 진행 축이 같으면 서로의 레인을 막을 수 있으므로 축이 다른 조합을 고른다.
			const conflicts = chosen.some((existing) =>
				getOrientationForEdge(existing.edge) === getOrientationForEdge(endPoint.edge));
			if (conflicts) {
				continue;
			}

			chosen.push(endPoint);
		}

		return chosen;
	}

	/**
	 * §5.1 - 도착 포인트와 동일 선상, 동일 색상의 1x2 USB 를 배치한다.
	 * 생성 단계에서는 클리어 상태(도착 포인트에 밀착)로 놓는다.
	 */
	private placeGoal(board: RushHourBoard, endPoint: RushHourEndPoint, index: number): boolean {
		const orientation = getOrientationForEdge(endPoint.edge);
		const lane = getEndPointLaneIndex(endPoint);
		const objectEntry = this._tables.findGoalObject(endPoint.color);
		const objectId = objectEntry?.objectId ?? `USB_${endPoint.color}`;

		// 해당 변에 밀착한 offset - hasReachedEndPoint() 의 조건과 동일하다.
		const isNegativeEdge = endPoint.edge === EEdge.TOP || endPoint.edge === EEdge.LEFT;
		const flushOffset = isNegativeEdge ? 0 : RUSH_HOUR_PLAY_GRID_SIZE - GOAL_OBJECT_LENGTH;

		const piece: RushHourPiece = {
			id: `${objectId}#${index}`,
			size: GOAL_OBJECT_LENGTH,
			orientation: orientation,
			row: orientation === EOrientation.VERTICAL ? flushOffset : lane,
			col: orientation === EOrientation.VERTICAL ? lane : flushOffset,
			color: endPoint.color,
			isGoal: true,
		};

		if (isOnEndPointLane(piece, endPoint) === false) {
			return false;
		}
		return board.addPiece(piece);
	}

	/**
	 * §5.2 - 방해 오브젝트 한 개를 배치한다.
	 * 목표의 도착 경로를 같은 이동 방향으로 막는 자리는 §6 [금지] 이므로 처음부터 제외한다.
	 */
	private placeBlocker(random: RandomSource, board: RushHourBoard, config: RushHourDifficultyConfig, index: number): boolean {
		for (let attempt = 0; attempt < BLOCKER_PLACEMENT_ATTEMPTS; attempt++) {
			const size = pickRandom(random, config.blockerLengths);
			const orientation = size === 1
				? EOrientation.FREE
				: (random() < 0.5 ? EOrientation.HORIZONTAL : EOrientation.VERTICAL);

			const maxOffset = RUSH_HOUR_PLAY_GRID_SIZE - size;
			const row = orientation === EOrientation.VERTICAL ? randomInt(random, 0, maxOffset) : randomInt(random, 0, RUSH_HOUR_PLAY_GRID_SIZE - 1);
			const col = orientation === EOrientation.HORIZONTAL ? randomInt(random, 0, maxOffset) : randomInt(random, 0, RUSH_HOUR_PLAY_GRID_SIZE - 1);

			const objectEntry = this._tables.findBlockerObject(size);
			const objectId = objectEntry?.objectId ?? `BLOCK_${size}x1`;
			const piece: RushHourPiece = {
				id: `${objectId}#B${index}`,
				size: size,
				orientation: orientation,
				row: row,
				col: col,
				color: EPieceColor.NEUTRAL,
				isGoal: false,
			};

			if (board.addPiece(piece) === false) {
				continue;
			}

			// 자기 자신이 줄을 가득 채우거나 스스로 갇히는 배치는 즉시 되돌린다.
			if (board.getSaturatedLines().length > 0 || board.canPieceMove(piece.id) === false) {
				board.removePiece(piece.id);
				continue;
			}

			return true;
		}

		return false;
	}

	//#endregion
}

//#endregion

/** 생성 결과를 한 줄 요약으로 남기는 디버그 헬퍼 */
export function describeLevel(level: RushHourLevel): string {
	const goals = level.pieces.filter((piece) => piece.isGoal).length;
	const blockers = level.pieces.length - goals;
	const edges = level.endPoints.map((endPoint) => `${endPoint.edge}:${endPoint.color}`).join(',');
	return `${level.puzzleId} D${level.difficulty} goals=${goals} blockers=${blockers} edges=${edges} minMoves=${level.minimumMoves}`;
}
