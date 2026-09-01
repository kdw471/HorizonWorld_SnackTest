/**
 * Laser Session - 라운드 / 제한시간 / 승패를 묶는 순수 상태 머신 (PUZ_01)
 *
 * PUZ_00 §7.4 가 요구하는 "실패/성공 판정, 남은 시간, 라운드 진행도를 외부에서 조회 가능한 API".
 * §8.2 에 따라 배치가 바뀔 때마다 광선을 즉시 재계산하고 BEAM_UPDATED 로 알린다.
 *
 * 플레이 플로우 (§8.5):
 *   퍼즐 시작 -> 크리스탈 지급 -> 배치/회수 반복 -> 실시간 광선 갱신 -> 클리어 판정 -> 라운드 진행(1~3회)
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { LaserBoard } from 'Laser_Board';
import { LaserBeamTracer } from 'Laser_BeamTracer';
import { LaserDragBeginResult, LaserDragController, LaserDragEndResult, LaserDragVisualState } from 'Laser_DragController';
import { LaserEvents } from 'Laser_GameEvents';
import { LaserLevelGenerator } from 'Laser_LevelGenerator';
import { LaserMainTableEntry, LaserTables } from 'Laser_DataTables';
import { LaserSolutionStep, LaserSolver } from 'Laser_Solver';
import {
	ELaserResult,
	ELaserState,
	LaserLevel,
	LaserResultData,
	LaserRoundProgress,
	LaserTraceResult,
	createSeededRandom,
	pickRandom,
} from 'Laser_Definitions';

export type LaserSessionOptions = {
	/** 제한 시간을 라운드마다 리셋할지(기본 true) 퀘스트 전체에 한 번만 줄지 */
	isTimeLimitPerRound?: boolean,
	seed?: number,
}

const DEFAULT_TIME_LIMIT_SECONDS = 120;

export class LaserSession {
	private readonly _events: LaserEvents;
	private readonly _tables: LaserTables;
	private readonly _generator: LaserLevelGenerator;
	private readonly _tracer: LaserBeamTracer;
	private readonly _solver: LaserSolver;
	private readonly _isTimeLimitPerRound: boolean;
	private readonly _seed: number | undefined;

	private _state: ELaserState = ELaserState.IDLE;
	private _stateBeforePause: ELaserState = ELaserState.IDLE;

	private _quest: LaserMainTableEntry | undefined = undefined;
	private _level: LaserLevel | undefined = undefined;
	private _board: LaserBoard | undefined = undefined;
	private _dragController: LaserDragController | undefined = undefined;
	private _lastTrace: LaserTraceResult | undefined = undefined;

	private _roundIndex: number = 0;
	private _roundsCleared: number = 0;
	private _remainingSeconds: number = 0;
	private _lastPublishedSecond: number = -1;

	//#region External query API (PUZ_00 §7.4)

	public get state(): ELaserState {
		return this._state;
	}

	public get board(): LaserBoard | undefined {
		return this._board;
	}

	public get level(): LaserLevel | undefined {
		return this._level;
	}

	public get dragController(): LaserDragController | undefined {
		return this._dragController;
	}

	/** 가장 최근 광선 추적 결과 - 연출 계층이 다시 계산할 필요가 없다 */
	public get lastTrace(): LaserTraceResult | undefined {
		return this._lastTrace;
	}

	public get isActive(): boolean {
		return this._state === ELaserState.PLAYER_INPUT;
	}

	public getRemainingTimeSeconds(): number {
		return Math.max(0, this._remainingSeconds);
	}

	public getRoundProgress(): LaserRoundProgress {
		return {
			current: this._roundIndex + 1,
			total: this._quest?.roundCount ?? 0,
			cleared: this._roundsCleared,
		};
	}

	/** 솔버가 찾은 해의 다음 한 수 (힌트 기능용) */
	public getHintStep(): LaserSolutionStep | undefined {
		if (this._board === undefined) {
			return undefined;
		}
		const solution = this._solver.solve(this._board);
		return solution.isSolvable ? solution.steps[0] : undefined;
	}

	//#endregion

	constructor(events: LaserEvents, tables: LaserTables, generator: LaserLevelGenerator, tracer: LaserBeamTracer = new LaserBeamTracer(), solver: LaserSolver = new LaserSolver(tracer), options: LaserSessionOptions = {}) {
		this._events = events;
		this._tables = tables;
		this._generator = generator;
		this._tracer = tracer;
		this._solver = solver;
		this._isTimeLimitPerRound = options.isTimeLimitPerRound ?? true;
		this._seed = options.seed;
	}

	//#region Quest / round lifecycle

	public startQuest(questId: string): boolean {
		const quest = this._tables.getQuest(questId);
		if (quest === undefined) {
			console.warn(`[LaserSession] Unknown questId: ${questId}`);
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
			console.warn(`[LaserSession] No quest for difficulty ${difficulty}`);
			return false;
		}
		return this.startQuest(quest.questId);
	}

	/** 필드 테이블에 사전 배치가 있으면 쓰고, 없으면 생성기로 만든다 (PUZ_00 §7.3) */
	public startRound(): boolean {
		const quest = this._quest;
		if (quest === undefined) {
			return false;
		}

		const level = this.loadLevel(quest);
		if (level === undefined) {
			console.warn(`[LaserSession] Failed to load a level for quest ${quest.questId} round ${this._roundIndex}`);
			// 결과 이벤트(QUEST_FAILED/GAME_END) 없이 멈추면 UI 가 영원히 대기하므로 실패로 처리한다
			this.fail();
			return false;
		}

		this._level = level;
		this._board = LaserBoard.fromLevel(level);
		this._dragController = new LaserDragController(this._board);

		if (this._isTimeLimitPerRound) {
			this._remainingSeconds = quest.timeLimitSeconds > 0 ? quest.timeLimitSeconds : DEFAULT_TIME_LIMIT_SECONDS;
			this._lastPublishedSecond = -1;
		}

		this.setState(ELaserState.ROUND_INTRO);
		this._events.LEVEL_LOADED.publish(level);
		this._events.ROUND_START.publish(this._roundIndex);
		this.publishRoundProgress();
		this.publishRemainingTime(true);

		this.setState(ELaserState.PLAYER_INPUT);
		this.refreshBeams();
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
		this.setState(ELaserState.PAUSED);
		this._events.GAME_PAUSE.publish();
	}

	public resume(): void {
		if (this._state !== ELaserState.PAUSED) {
			return;
		}
		this.setState(this._stateBeforePause);
		this._events.GAME_RESUME.publish();
	}

	public abort(): void {
		this._dragController?.cancel();
		this.unloadLevel();
		this.setState(ELaserState.IDLE);
	}

	//#endregion

	//#region Input entry points (모바일 드래그)

	/** 인벤토리 슬롯의 크리스탈을 집는다 */
	public beginDragFromInventory(crystalId: string): LaserDragBeginResult {
		if (this._state !== ELaserState.PLAYER_INPUT || this._dragController === undefined) {
			return { isAccepted: false, reason: 'not-accepting-input' };
		}
		return this._dragController.beginFromInventory(crystalId);
	}

	/** 필드에 놓인 크리스탈을 집는다. 좌표는 배치 로컬 격자(실수) */
	public beginDragFromBoard(gridRow: number, gridCol: number): LaserDragBeginResult {
		if (this._state !== ELaserState.PLAYER_INPUT || this._dragController === undefined) {
			return { isAccepted: false, reason: 'not-accepting-input' };
		}
		return this._dragController.beginFromBoard(gridRow, gridCol);
	}

	public updateDrag(gridRow: number, gridCol: number): LaserDragVisualState | undefined {
		return this._dragController?.update(gridRow, gridCol);
	}

	/** 손을 뗀다. 배치가 바뀌면 광선을 즉시 재계산한다 (§8.2) */
	public endDrag(): LaserDragEndResult | undefined {
		const controller = this._dragController;
		if (controller === undefined) {
			return undefined;
		}

		const result = controller.end();
		if (result === undefined) {
			return undefined;
		}

		if (result.didPlace && result.row !== undefined && result.col !== undefined) {
			this._events.CRYSTAL_PLACED.publish({ crystalId: result.crystalId, row: result.row, col: result.col });
		}
		else {
			// 인벤토리로 회수되는 드랍도 "거절"이었다면 사유를 함께 알린다.
			// (예: 점유 칸에 드랍 - 회수 연출과 별개로 거절 피드백이 필요하다)
			if (result.reason !== undefined) {
				this._events.PLACEMENT_REJECTED.publish({ crystalId: result.crystalId, reason: result.reason });
			}
			if (result.didReturnToInventory) {
				this._events.CRYSTAL_RETURNED.publish(result.crystalId);
			}
		}

		this.refreshBeams();
		return result;
	}

	public cancelDrag(): void {
		this._dragController?.cancel();
	}

	/** 놓은 크리스탈을 모두 회수한다 (리셋 버튼) */
	public resetPlacements(): void {
		if (this._board === undefined || this.isActive === false) {
			// 일시정지 / 라운드 전환 / 종료 중에는 보드를 바꾸면 안 된다
			return;
		}
		this._dragController?.cancel();
		this._board.pickUpAll();
		this.refreshBeams();
	}

	//#endregion

	//#region Internal

	private loadLevel(quest: LaserMainTableEntry): LaserLevel | undefined {
		const fields = this._tables.getFieldsForDifficulty(quest.difficulty);
		if (fields.length > 0) {
			// 세션 seed 가 있으면 필드 선택도 재현 가능해야 한다
			const random = this._seed === undefined ? Math.random : createSeededRandom(this._seed + this._roundIndex);
			const field = fields.length === 1 ? fields[0] : pickRandom(random, fields);
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
		this._lastTrace = undefined;
	}

	/**
	 * 광선을 다시 계산하고 결과를 알린다 - §8.2.
	 * 클리어 판정도 여기서 한다 (§3 클리어 판정).
	 */
	private refreshBeams(): void {
		const board = this._board;
		if (board === undefined) {
			return;
		}

		const wasSkullHit = this._lastTrace?.didHitSkull ?? false;
		const checked = this._tracer.traceAndCheck(board);
		this._lastTrace = checked.result;
		this._events.BEAM_UPDATED.publish(checked.result);

		if (checked.result.didHitSkull && wasSkullHit === false) {
			this._events.SKULL_HIT.publish();
		}

		if (checked.isSolved && this._state === ELaserState.PLAYER_INPUT) {
			this.clearRound();
		}
	}

	private clearRound(): void {
		this._roundsCleared++;
		this.setState(ELaserState.ROUND_CLEAR);
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
		this.setState(ELaserState.QUEST_CLEAR);
		const results = this.buildResultData(ELaserResult.WIN);
		this._events.QUEST_CLEAR.publish(results);
		this._events.GAME_END.publish(results);
	}

	private fail(): void {
		this._dragController?.cancel();
		this.setState(ELaserState.GAME_OVER);
		const results = this.buildResultData(ELaserResult.LOSE);
		this._events.QUEST_FAILED.publish(results);
		this._events.GAME_END.publish(results);
	}

	private buildResultData(result: ELaserResult): LaserResultData {
		return {
			result: result,
			roundsCleared: this._roundsCleared,
			roundCount: this._quest?.roundCount ?? 0,
			remainingTimeSeconds: this.getRemainingTimeSeconds(),
		};
	}

	private setState(state: ELaserState): void {
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
