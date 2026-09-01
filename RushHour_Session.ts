/**
 * Rush Hour Session - 라운드 / 제한시간 / 승패를 묶는 순수 상태 머신
 *
 * PUZ_00 §7.4 가 요구하는 "실패/성공 판정, 남은 시간, 라운드 진행도를 외부에서 조회 가능한 API" 다.
 * 모바일 사양의 드래그 조작은 `RushHour_DragController` 가 담당하고,
 * 이 클래스는 그 결과를 받아 게임 진행에 반영한다.
 *
 * 진행 흐름
 *   IDLE -> ROUND_INTRO -> PLAYER_INPUT -> (MOVING) -> ROUND_CLEAR
 *        -> 다음 라운드가 남았으면 ROUND_INTRO, 아니면 QUEST_CLEAR
 *   제한 시간이 다하면 어느 상태에서든 GAME_OVER.
 *
 * horizon/core 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { RushHourBoard } from 'RushHour_Board';
import { RushHourDragController, DragBeginResult, DragEndResult, DragVisualState } from 'RushHour_DragController';
import { RushHourEvents } from 'RushHour_GameEvents';
import { RushHourLevelGenerator } from 'RushHour_LevelGenerator';
import { RushHourSolver } from 'RushHour_Solver';
import { PuzMainTableEntry, RushHourTables } from 'RushHour_DataTables';
import {
	ERushHourResult,
	ERushHourState,
	EGoalStatus,
	RushHourLevel,
	RushHourMove,
	RushHourResultData,
	RushHourRoundProgress,
	createSeededRandom,
	pickRandom,
} from 'RushHour_Definitions';

export type RushHourSessionOptions = {
	/** 제한 시간을 라운드마다 리셋할지(기본 true) 퀘스트 전체에 한 번만 줄지 */
	isTimeLimitPerRound?: boolean,
	/** 레벨 생성기 시드. 지정하면 같은 배치가 재현된다 */
	seed?: number,
	/** 드래그 컨트롤러를 직접 주입하고 싶을 때 (테스트용) */
	dragController?: RushHourDragController,
}

const DEFAULT_TIME_LIMIT_SECONDS = 120;

export class RushHourSession {
	private readonly _events: RushHourEvents;
	private readonly _tables: RushHourTables;
	private readonly _generator: RushHourLevelGenerator;
	private readonly _solver: RushHourSolver;
	private readonly _isTimeLimitPerRound: boolean;
	private readonly _seed: number | undefined;

	private _state: ERushHourState = ERushHourState.IDLE;
	private _stateBeforePause: ERushHourState = ERushHourState.IDLE;

	private _quest: PuzMainTableEntry | undefined = undefined;
	private _level: RushHourLevel | undefined = undefined;
	private _board: RushHourBoard | undefined = undefined;
	private _dragController: RushHourDragController | undefined = undefined;
	private _injectedDragController: RushHourDragController | undefined = undefined;

	private _roundIndex: number = 0;
	private _roundsCleared: number = 0;
	private _remainingSeconds: number = 0;
	/** 남은 시간 이벤트를 초 단위로만 쏘기 위한 직전 정수 초 */
	private _lastPublishedSecond: number = -1;

	//#region External query API (PUZ_00 §7.4)

	public get state(): ERushHourState {
		return this._state;
	}

	public get board(): RushHourBoard | undefined {
		return this._board;
	}

	public get level(): RushHourLevel | undefined {
		return this._level;
	}

	public get dragController(): RushHourDragController | undefined {
		return this._dragController;
	}

	/** 게임이 진행 중인지 (일시정지/종료/대기 상태가 아닌지) */
	public get isActive(): boolean {
		return this._state === ERushHourState.PLAYER_INPUT || this._state === ERushHourState.MOVING;
	}

	public getRemainingTimeSeconds(): number {
		return Math.max(0, this._remainingSeconds);
	}

	public getRoundProgress(): RushHourRoundProgress {
		return {
			current: this._roundIndex + 1,
			total: this._quest?.roundCount ?? 0,
			cleared: this._roundsCleared,
		};
	}

	/** 솔버가 구한 최소 해의 다음 한 수 (힌트 기능용) */
	public getHintMove(): RushHourMove | undefined {
		if (this._board === undefined) {
			return undefined;
		}
		const solution = this._solver.solve(this._board);
		return solution.isSolvable ? solution.moves[0] : undefined;
	}

	//#endregion

	constructor(events: RushHourEvents, tables: RushHourTables, generator: RushHourLevelGenerator, solver: RushHourSolver = new RushHourSolver(), options: RushHourSessionOptions = {}) {
		this._events = events;
		this._tables = tables;
		this._generator = generator;
		this._solver = solver;
		this._isTimeLimitPerRound = options.isTimeLimitPerRound ?? true;
		this._seed = options.seed;
		this._injectedDragController = options.dragController;
	}

	//#region Quest / round lifecycle

	/** 퀘스트를 시작한다. 메인 테이블에서 난이도/라운드/제한시간을 읽는다 */
	public startQuest(questId: string): boolean {
		const quest = this._tables.getQuest(questId);
		if (quest === undefined) {
			console.warn(`[RushHourSession] Unknown questId: ${questId}`);
			return false;
		}

		this._quest = quest;
		this._roundIndex = 0;
		this._roundsCleared = 0;
		this._remainingSeconds = quest.timeLimitSeconds > 0 ? quest.timeLimitSeconds : DEFAULT_TIME_LIMIT_SECONDS;
		this._lastPublishedSecond = -1;

		this._events.QUEST_START.publish(questId);
		this.publishRoundProgress();
		return this.startRound();
	}

	/** 난이도로 바로 시작하고 싶을 때 */
	public startQuestByDifficulty(difficulty: number): boolean {
		const quest = this._tables.getQuestByDifficulty(difficulty);
		if (quest === undefined) {
			console.warn(`[RushHourSession] No quest for difficulty ${difficulty}`);
			return false;
		}
		return this.startQuest(quest.questId);
	}

	/**
	 * 현재 라운드의 배치를 불러온다.
	 * 필드 테이블에 사전 배치가 있으면 그것을 쓰고, 없으면 레벨 생성기로 만든다 (PUZ_00 §7.3).
	 */
	public startRound(): boolean {
		const quest = this._quest;
		if (quest === undefined) {
			return false;
		}

		const level = this.loadLevel(quest);
		if (level === undefined) {
			console.warn(`[RushHourSession] Failed to load a level for quest ${quest.questId} round ${this._roundIndex}`);
			// 결과 이벤트(QUEST_FAILED/GAME_END) 없이 멈추면 UI 가 영원히 대기하므로 실패로 처리한다
			this.fail();
			return false;
		}

		this._level = level;
		this._board = RushHourBoard.fromLevel(level);
		this._dragController = this._injectedDragController ?? new RushHourDragController(this._board);

		if (this._isTimeLimitPerRound) {
			this._remainingSeconds = quest.timeLimitSeconds > 0 ? quest.timeLimitSeconds : DEFAULT_TIME_LIMIT_SECONDS;
			this._lastPublishedSecond = -1;
		}

		this.setState(ERushHourState.ROUND_INTRO);
		this._events.LEVEL_LOADED.publish(level);
		this._events.ROUND_START.publish(this._roundIndex);
		this.publishRoundProgress();
		this.publishRemainingTime(true);

		this.setState(ERushHourState.PLAYER_INPUT);
		return true;
	}

	/** 매 프레임 호출. 제한 시간을 줄이고 시간 초과를 판정한다 */
	public update(deltaSeconds: number): void {
		if (this.isActive === false) {
			return;
		}

		this._remainingSeconds -= deltaSeconds;
		this.publishRemainingTime(false);

		if (this._remainingSeconds <= 0) {
			this._remainingSeconds = 0;
			this.fail();
		}
	}

	public pause(): void {
		if (this.isActive === false) {
			return;
		}
		this._stateBeforePause = this._state;
		this._dragController?.cancel();
		this.setState(ERushHourState.PAUSED);
		this._events.GAME_PAUSE.publish();
	}

	public resume(): void {
		if (this._state !== ERushHourState.PAUSED) {
			return;
		}
		this.setState(this._stateBeforePause);
		this._events.GAME_RESUME.publish();
	}

	/** 외부에서 퍼즐을 중단시킨다 (레벨 이탈 등) */
	public abort(): void {
		this._dragController?.cancel();
		this.unloadLevel();
		this.setState(ERushHourState.IDLE);
	}

	//#endregion

	//#region Input entry points (모바일 드래그)

	/** 터치 시작 - 사양 §8. 좌표는 플레이 로컬 격자(실수) */
	public beginDrag(gridRow: number, gridCol: number): DragBeginResult {
		if (this._state !== ERushHourState.PLAYER_INPUT || this._dragController === undefined) {
			return { isAccepted: false, reason: 'not-accepting-input' };
		}
		return this._dragController.begin(gridRow, gridCol);
	}

	/** 터치 이동 - 사양 §8. 영역 밖으로 나가도 계속 호출해야 한다 */
	public updateDrag(gridRow: number, gridCol: number): DragVisualState | undefined {
		if (this._dragController === undefined) {
			return undefined;
		}
		return this._dragController.update(gridRow, gridCol);
	}

	/** 터치 종료 - 사양 §7 스냅 + §9 결합/분리 판정 */
	public endDrag(): DragEndResult | undefined {
		const board = this._board;
		const controller = this._dragController;
		if (board === undefined || controller === undefined) {
			return undefined;
		}

		const goalStatusBefore = this.captureGoalStatuses(board);
		const result = controller.end();
		if (result === undefined) {
			return undefined;
		}

		if (result.move !== undefined) {
			this._events.PIECE_MOVED.publish(result.move);
		}

		// §9 - 결합 성공 이펙트(LED, 진동)는 이 이벤트를 구독해 재생한다.
		// GOAL_REACHED/GOAL_LEFT 는 READY↔DOCKED 전이를 구분하지 못하므로 별도로 알린다.
		if (result.didDock || result.didUndock) {
			const goalPiece = board.getPiece(result.pieceId);
			if (goalPiece !== undefined) {
				if (result.didDock) {
					this._events.USB_DOCKED.publish(goalPiece);
				}
				else {
					this._events.USB_UNDOCKED.publish(goalPiece);
				}
			}
		}

		this.publishGoalStatusChanges(board, goalStatusBefore);
		this.checkRoundClear();
		return result;
	}

	/** 드래그를 취소한다 (일시정지, 화면 전환 등) */
	public cancelDrag(): void {
		this._dragController?.cancel();
	}

	//#endregion

	//#region Internal

	/** 필드 테이블 우선, 없으면 생성기 */
	private loadLevel(quest: PuzMainTableEntry): RushHourLevel | undefined {
		const fields = this._tables.getFieldsForDifficulty(quest.difficulty);
		if (fields.length > 0) {
			// 세션 seed 가 있으면 필드 선택도 재현 가능해야 한다
			const random = this._seed === undefined ? Math.random : createSeededRandom(this._seed + this._roundIndex);
			const field = fields.length === 1
				? fields[0]
				: pickRandom(random, fields);
			return this._tables.buildLevel(field);
		}

		return this._generator.generate({
			puzzleId: `${quest.questId}_R${this._roundIndex}`,
			difficulty: quest.difficulty,
			seed: this._seed === undefined ? undefined : this._seed + this._roundIndex,
		});
	}

	private unloadLevel(): void {
		if (this._level !== undefined) {
			this._events.LEVEL_UNLOADED.publish();
		}
		this._level = undefined;
		this._board = undefined;
		this._dragController = undefined;
	}

	/**
	 * 클리어 판정 - 사양 §2 / §11.3.
	 * 모든 목표가 도착 포인트에 도달하고 결합까지 끝나야 라운드 클리어다.
	 */
	private checkRoundClear(): void {
		const board = this._board;
		if (board === undefined || this._state !== ERushHourState.PLAYER_INPUT) {
			return;
		}
		if (board.isSolved() === false) {
			return;
		}

		this._roundsCleared++;
		this.setState(ERushHourState.ROUND_CLEAR);
		this._events.ROUND_CLEAR.publish(this._roundIndex);
		this.publishRoundProgress();

		const total = this._quest?.roundCount ?? 1;
		if (this._roundsCleared >= total) {
			this.succeed();
			return;
		}

		this._roundIndex++;
		this.startRound();
	}

	private succeed(): void {
		this.setState(ERushHourState.QUEST_CLEAR);
		const results = this.buildResultData(ERushHourResult.WIN);
		this._events.QUEST_CLEAR.publish(results);
		this._events.GAME_END.publish(results);
	}

	private fail(): void {
		this._dragController?.cancel();
		this.setState(ERushHourState.GAME_OVER);
		const results = this.buildResultData(ERushHourResult.LOSE);
		this._events.QUEST_FAILED.publish(results);
		this._events.GAME_END.publish(results);
	}

	private buildResultData(result: ERushHourResult): RushHourResultData {
		return {
			result: result,
			roundsCleared: this._roundsCleared,
			roundCount: this._quest?.roundCount ?? 0,
			remainingTimeSeconds: this.getRemainingTimeSeconds(),
		};
	}

	private setState(state: ERushHourState): void {
		if (this._state === state) {
			return;
		}
		this._state = state;
		this._events.STATE_CHANGED.publish(state);
	}

	private captureGoalStatuses(board: RushHourBoard): Map<string, EGoalStatus> {
		const statuses = new Map<string, EGoalStatus>();
		for (const goal of board.goalPieces) {
			statuses.set(goal.id, board.getGoalStatus(goal.id));
		}
		return statuses;
	}

	/** 도달/이탈을 이벤트로 알린다 */
	private publishGoalStatusChanges(board: RushHourBoard, before: Map<string, EGoalStatus>): void {
		for (const goal of board.goalPieces) {
			const previous = before.get(goal.id) ?? EGoalStatus.BLOCKED;
			const current = board.getGoalStatus(goal.id);
			if (previous === current) {
				continue;
			}

			const wasArrived = previous !== EGoalStatus.BLOCKED;
			const isArrived = current !== EGoalStatus.BLOCKED;
			if (wasArrived === false && isArrived === true) {
				this._events.GOAL_REACHED.publish(goal);
			}
			else if (wasArrived === true && isArrived === false) {
				this._events.GOAL_LEFT.publish(goal);
			}
		}
	}

	private publishRoundProgress(): void {
		this._events.ROUND_PROGRESS_CHANGED.publish(this.getRoundProgress());
	}

	private publishRemainingTime(force: boolean): void {
		const seconds = Math.max(0, Math.ceil(this._remainingSeconds));
		if (force === false && seconds === this._lastPublishedSecond) {
			return;
		}
		this._lastPublishedSecond = seconds;
		this._events.TIME_CHANGED.publish(seconds);
	}

	//#endregion
}
