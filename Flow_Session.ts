/**
 * Flow Session - 라운드 / 제한시간 / 승패를 묶는 순수 상태 머신 (PUZ_05)
 *
 * PUZ_00 §7.4 가 요구하는 "실패/성공 판정, 남은 시간, 라운드 진행도를 외부에서 조회 가능한 API".
 *
 * 승패 - §2
 *   클리어: 제한시간 동안 필드 위의 모든 전구에 불을 밝히면 클리어
 *   실패:   제한시간 안에 밝히지 못하면 실패
 *
 * 실패 시 §7 에 따라 유저 입력을 즉시 막는다. 불이 서서히 꺼지는 연출은 어댑터의 몫이다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { FlowBoard } from 'Flow_Board';
import { FlowDragBeginResult, FlowDragController, FlowDragEndResult, FlowDragPreview } from 'Flow_DragController';
import { FlowEvents } from 'Flow_GameEvents';
import { FlowLevelGenerator } from 'Flow_LevelGenerator';
import { FlowMainTableEntry, FlowTables } from 'Flow_DataTables';
import { FlowSolver } from 'Flow_Solver';
import {
	EExtendRejection,
	EFlowColor,
	EFlowResult,
	EFlowState,
	FlowCell,
	FlowLevel,
	FlowResultData,
	FlowRoundProgress,
	createSeededRandom,
	pickRandom,
} from 'Flow_Definitions';

export type FlowSessionOptions = {
	/** 제한 시간을 라운드마다 리셋할지(기본 true) 퀘스트 전체에 한 번만 줄지 */
	isTimeLimitPerRound?: boolean,
	seed?: number,
}

const DEFAULT_TIME_LIMIT_SECONDS = 120;

export class FlowSession {
	private readonly _events: FlowEvents;
	private readonly _tables: FlowTables;
	private readonly _generator: FlowLevelGenerator;
	private readonly _solver: FlowSolver;
	private readonly _isTimeLimitPerRound: boolean;
	private readonly _seed: number | undefined;

	private _state: EFlowState = EFlowState.IDLE;
	private _stateBeforePause: EFlowState = EFlowState.IDLE;

	private _quest: FlowMainTableEntry | undefined = undefined;
	private _level: FlowLevel | undefined = undefined;
	private _board: FlowBoard | undefined = undefined;
	private _dragController: FlowDragController | undefined = undefined;

	private _roundIndex: number = 0;
	private _roundsCleared: number = 0;
	private _remainingSeconds: number = 0;
	private _lastPublishedSecond: number = -1;

	/** 직전에 완결되어 있던 색들 - 완결/해제 이벤트를 내기 위해 기억한다 */
	private _completedColors = new Set<EFlowColor>();

	//#region External query API (PUZ_00 §7.4)

	public get state(): EFlowState {
		return this._state;
	}

	public get board(): FlowBoard | undefined {
		return this._board;
	}

	public get level(): FlowLevel | undefined {
		return this._level;
	}

	public get dragController(): FlowDragController | undefined {
		return this._dragController;
	}

	public get isActive(): boolean {
		return this._state === EFlowState.PLAYER_INPUT;
	}

	public getRemainingTimeSeconds(): number {
		return Math.max(0, this._remainingSeconds);
	}

	public getRoundProgress(): FlowRoundProgress {
		return {
			current: this._roundIndex + 1,
			total: this._quest?.roundCount ?? 0,
			cleared: this._roundsCleared,
		};
	}

	/** 아직 불이 들어오지 않은 서브 오브젝트 수 - §5 진행도 표시용 */
	public getRemainingSubCount(): number {
		return this._board?.getUncoloredSubCount() ?? 0;
	}

	/** 솔버가 찾은 해 - 힌트 기능용 */
	public getSolutionPaths(): { color: EFlowColor, cells: FlowCell[] }[] {
		if (this._board === undefined) {
			return [];
		}
		const solution = this._solver.solve(this._board);
		return solution.isSolvable ? solution.paths : [];
	}

	//#endregion

	constructor(events: FlowEvents, tables: FlowTables, generator: FlowLevelGenerator, solver: FlowSolver = new FlowSolver(), options: FlowSessionOptions = {}) {
		this._events = events;
		this._tables = tables;
		this._generator = generator;
		this._solver = solver;
		this._isTimeLimitPerRound = options.isTimeLimitPerRound ?? true;
		this._seed = options.seed;
	}

	//#region Quest / round lifecycle

	public startQuest(questId: string): boolean {
		const quest = this._tables.getQuest(questId);
		if (quest === undefined) {
			console.warn(`[FlowSession] Unknown questId: ${questId}`);
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

	public startQuestByDifficulty(difficulty: number): boolean {
		const quest = this._tables.getQuestByDifficulty(difficulty);
		if (quest === undefined) {
			console.warn(`[FlowSession] No quest for difficulty ${difficulty}`);
			return false;
		}
		return this.startQuest(quest.questId);
	}

	public startRound(): boolean {
		const quest = this._quest;
		if (quest === undefined) {
			return false;
		}

		const level = this.loadLevel(quest);
		if (level === undefined) {
			console.warn(`[FlowSession] Failed to load a level for quest ${quest.questId} round ${this._roundIndex}`);
			// 결과 이벤트(QUEST_FAILED/GAME_END) 없이 멈추면 UI 가 영원히 대기하므로 실패로 처리한다
			this.fail();
			return false;
		}

		this._level = level;
		this._board = FlowBoard.fromLevel(level);
		this._dragController = new FlowDragController(this._board);
		this._completedColors.clear();

		if (this._isTimeLimitPerRound) {
			this._remainingSeconds = quest.timeLimitSeconds > 0 ? quest.timeLimitSeconds : DEFAULT_TIME_LIMIT_SECONDS;
			this._lastPublishedSecond = -1;
		}

		this.setState(EFlowState.ROUND_INTRO);
		this._events.LEVEL_LOADED.publish(level);
		this._events.ROUND_START.publish(this._roundIndex);
		this.publishRoundProgress();
		this.publishRemainingTime(true);

		this.setState(EFlowState.PLAYER_INPUT);
		return true;
	}

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
		this.setState(EFlowState.PAUSED);
		this._events.GAME_PAUSE.publish();
	}

	public resume(): void {
		if (this._state !== EFlowState.PAUSED) {
			return;
		}
		this.setState(this._stateBeforePause);
		this._events.GAME_RESUME.publish();
	}

	public abort(): void {
		this._dragController?.cancel();
		this.unloadLevel();
		this.setState(EFlowState.IDLE);
	}

	//#endregion

	//#region Input entry points (모바일 드래그)

	/** 메인 오브젝트 또는 경로의 머리를 눌러 그리기를 시작한다 */
	public beginDraw(row: number, col: number): FlowDragBeginResult {
		if (this._state !== EFlowState.PLAYER_INPUT || this._dragController === undefined) {
			return { isAccepted: false, reason: 'not-accepting-input' };
		}

		const result = this._dragController.begin(row, col);
		if (result.isAccepted && result.color !== undefined) {
			this._events.DRAW_BEGAN.publish(result.color);
		}
		return result;
	}

	/** 손가락이 지나가는 칸을 알린다 */
	public moveDraw(row: number, col: number): FlowDragPreview | undefined {
		const board = this._board;
		const controller = this._dragController;
		if (board === undefined || controller === undefined) {
			return undefined;
		}

		// 역주행(undo)으로 불이 꺼지는 칸은 pop 되는 "이전 머리"다. 미리 잡아 둔다.
		const beforeHead = controller.drawingColor === undefined ? undefined : board.getPathHead(controller.drawingColor);
		const beforeLength = controller.drawingColor === undefined ? 0 : board.getPath(controller.drawingColor).length;
		const preview = controller.moveTo(row, col);
		if (preview === undefined) {
			return undefined;
		}

		const afterLength = board.getPath(preview.color).length;
		if (afterLength > beforeLength) {
			this._events.NODE_LIT.publish({ color: preview.color, cell: preview.cell });
		}
		else if (afterLength < beforeLength && beforeHead !== undefined) {
			// preview.cell 은 이동해 간 칸(그대로 켜져 있음)이므로 발행하면 안 된다
			this._events.NODE_UNLIT.publish(beforeHead);
		}
		else if (preview.canExtend === false && preview.isUndo === false && preview.rejection !== EExtendRejection.NONE) {
			this._events.EXTEND_REJECTED.publish(preview.rejection);
		}

		this.refreshCompletion();
		this.checkClear();
		return preview;
	}

	/** 손을 뗀다. 그린 경로는 그대로 남는다 - §6 */
	public endDraw(): FlowDragEndResult | undefined {
		const controller = this._dragController;
		if (controller === undefined) {
			return undefined;
		}

		const result = controller.end();
		if (result !== undefined) {
			this._events.DRAW_ENDED.publish(result.color);
			this.refreshCompletion();
			this.checkClear();
		}
		return result;
	}

	public cancelDraw(): void {
		this._dragController?.cancel();
	}

	/** 한 색의 경로를 통째로 지운다 (리셋 버튼) */
	public clearColor(color: EFlowColor): void {
		if (this.isActive === false || this._board === undefined) {
			return;
		}
		this._dragController?.cancel();
		this._board.clearPath(color);
		this.refreshCompletion();
	}

	/** 모든 경로를 지운다 */
	public clearAll(): void {
		if (this.isActive === false || this._board === undefined) {
			return;
		}
		this._dragController?.cancel();
		this._board.clearAllPaths();
		this.refreshCompletion();
	}

	//#endregion

	//#region Internal

	private loadLevel(quest: FlowMainTableEntry): FlowLevel | undefined {
		const fields = this._tables.getFieldsForDifficulty(quest.difficulty);
		if (fields.length > 0) {
			// 세션 seed 가 있으면 필드 선택도 재현 가능해야 한다
			const random = this._seed === undefined ? Math.random : createSeededRandom(this._seed + this._roundIndex);
			const field = fields.length === 1 ? fields[0] : pickRandom(random, fields);
			const built = this._tables.buildLevel(field);
			if (built !== undefined) {
				return built;
			}
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
		this._completedColors.clear();
	}

	/** 완결된 색이 늘거나 줄었으면 알린다 */
	private refreshCompletion(): void {
		const board = this._board;
		if (board === undefined) {
			return;
		}

		for (const color of board.colors) {
			const isComplete = board.isPathComplete(color);
			const wasComplete = this._completedColors.has(color);

			if (isComplete && wasComplete === false) {
				this._completedColors.add(color);
				this._events.PATH_COMPLETED.publish(color);
			}
			else if (isComplete === false && wasComplete) {
				this._completedColors.delete(color);
				this._events.PATH_BROKEN.publish(color);
			}
		}
	}

	/** 클리어 판정 - §9.4 (모든 색 완결 AND 모든 서브 활성화) */
	private checkClear(): void {
		const board = this._board;
		if (board === undefined || this.isActive === false) {
			return;
		}
		if (board.isSolved() === false) {
			return;
		}
		this.clearRound();
	}

	private clearRound(): void {
		this._roundsCleared++;
		this._dragController?.cancel();
		this.setState(EFlowState.ROUND_CLEAR);
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
		this.setState(EFlowState.QUEST_CLEAR);
		const results = this.buildResultData(EFlowResult.WIN);
		this._events.QUEST_CLEAR.publish(results);
		this._events.GAME_END.publish(results);
	}

	private fail(): void {
		// §7 - 실패 시 유저는 아무런 상호작용을 할 수 없게 된다
		this._dragController?.cancel();
		this.setState(EFlowState.GAME_OVER);
		const results = this.buildResultData(EFlowResult.LOSE);
		this._events.QUEST_FAILED.publish(results);
		this._events.GAME_END.publish(results);
	}

	private buildResultData(result: EFlowResult): FlowResultData {
		return {
			result: result,
			roundsCleared: this._roundsCleared,
			roundCount: this._quest?.roundCount ?? 0,
			remainingTimeSeconds: this.getRemainingTimeSeconds(),
			remainingSubCount: this.getRemainingSubCount(),
		};
	}

	private setState(state: EFlowState): void {
		if (this._state === state) {
			return;
		}
		this._state = state;
		this._events.STATE_CHANGED.publish(state);
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
