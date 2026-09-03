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
	/** 힌트 1회당 살펴볼 배치 조합 상한. 클라이언트가 멈추지 않을 정도로 묶어 둔다 */
	hintMaxPlacements?: number,
}

const DEFAULT_TIME_LIMIT_SECONDS = 120;

/** 힌트 탐색 기본 예산. 인벤토리 9개짜리 기획 레벨에서도 대략 0.3초 안에 끝난다 */
const DEFAULT_HINT_MAX_PLACEMENTS = 50000;

export class LaserSession {
	private readonly _events: LaserEvents;
	private readonly _tables: LaserTables;
	private readonly _generator: LaserLevelGenerator;
	private readonly _tracer: LaserBeamTracer;
	private readonly _solver: LaserSolver;
	private readonly _isTimeLimitPerRound: boolean;
	private readonly _seed: number | undefined;
	private readonly _hintMaxPlacements: number;

	private _state: ELaserState = ELaserState.IDLE;
	private _stateBeforePause: ELaserState = ELaserState.IDLE;

	private _quest: LaserMainTableEntry | undefined = undefined;
	/**
	 * 레벨 모드에서 이번 판의 순번 (그 난이도의 판 목록에서 0-based).
	 * undefined 면 기존처럼 아직 안 낸 판 중에서 무작위로 고른다.
	 */
	private _fieldOrdinal: number | undefined = undefined;
	/** 레벨 모드는 1라운드 고정. undefined 면 퀘스트 테이블의 roundCount 를 쓴다 */
	private _roundCountOverride: number | undefined = undefined;
	private _level: LaserLevel | undefined = undefined;
	private _board: LaserBoard | undefined = undefined;
	private _dragController: LaserDragController | undefined = undefined;
	private _lastTrace: LaserTraceResult | undefined = undefined;

	private _roundIndex: number = 0;
	/**
	 * 이번 퀘스트에서 이미 낸 필드 테이블 행.
	 * 기획 CSV 를 붙인 뒤 난이도당 판이 여러 개가 됐으므로, 라운드마다 다른 판을 낸다.
	 */
	private _usedPuzzleIds: string[] = [];
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
			total: this.getRoundCount(),
			cleared: this._roundsCleared,
		};
	}

	/**
	 * 솔버가 찾은 해의 다음 한 수 (힌트 기능용).
	 *
	 * 기획 CSV 레벨은 인벤토리가 최대 9개라 완전 탐색이 수백만 조합으로 폭발한다.
	 * 힌트는 클라이언트에서 동기로 도는 만큼 탐색량을 묶어 두고,
	 * 예산 안에 못 찾으면 그냥 힌트 없음으로 처리한다.
	 */
	public getHintStep(): LaserSolutionStep | undefined {
		if (this._board === undefined) {
			return undefined;
		}
		const solution = this._solver.solve(this._board, { maxPlacements: this._hintMaxPlacements });
		if (solution.isExhausted) {
			console.warn(`[LaserSession] Hint search hit the ${this._hintMaxPlacements} placement budget. No hint this time.`);
			return undefined;
		}
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
		this._hintMaxPlacements = options.hintMaxPlacements ?? DEFAULT_HINT_MAX_PLACEMENTS;
	}

	//#region Quest / round lifecycle

	public startQuest(questId: string): boolean {
		const quest = this._tables.getQuest(questId);
		if (quest === undefined) {
			console.warn(`[LaserSession] Unknown questId: ${questId}`);
			return false;
		}

		// 퀘스트 전체 플레이 - 판은 무작위로 고르고 라운드 수는 테이블을 따른다
		this._fieldOrdinal = undefined;
		this._roundCountOverride = undefined;
		return this.beginQuest(quest);
	}

	/**
	 * 레벨 하나만 플레이한다 - 메인 UI 의 Start / Continue 경로.
	 *
	 * 레벨 하나 = 퀘스트 라운드 하나이므로, 지정한 판을 1라운드로 연다.
	 * `fieldOrdinal` 은 그 난이도의 판 목록에서의 순번이다 (0-based).
	 */
	public startLevel(difficulty: number, fieldOrdinal: number): boolean {
		const quest = this._tables.getQuestByDifficulty(difficulty);
		if (quest === undefined) {
			console.warn(`[LaserSession] No quest for difficulty ${difficulty}`);
			return false;
		}

		this._fieldOrdinal = fieldOrdinal;
		this._roundCountOverride = 1;
		return this.beginQuest(quest);
	}

	/** startQuest / startLevel 의 공통 몸통 - 상태를 초기화하고 첫 라운드를 연다 */
	private beginQuest(quest: LaserMainTableEntry): boolean {
		this._quest = quest;
		this._roundIndex = 0;
		this._usedPuzzleIds = [];
		this._roundsCleared = 0;
		this._remainingSeconds = quest.timeLimitSeconds > 0 ? quest.timeLimitSeconds : DEFAULT_TIME_LIMIT_SECONDS;
		this._lastPublishedSecond = -1;

		this._events.QUEST_START.publish(quest.questId);
		this.publishRoundProgress();
		return this.startRound();
	}

	/** 이번 플레이의 라운드 수. 레벨 모드면 1, 아니면 퀘스트 테이블 값 */
	private getRoundCount(): number {
		return this._roundCountOverride ?? this._quest?.roundCount ?? 0;
	}

	/**
	 * 레벨 모드에서 이번에 쓸 판.
	 * 레벨 모드가 아니거나 순번이 범위 밖이면 undefined 를 돌려 기존 무작위 선택으로 넘긴다.
	 */
	private resolveLevelField<T>(fields: T[]): T | undefined {
		const ordinal = this._fieldOrdinal;
		if (ordinal === undefined) {
			return undefined;
		}
		const field = fields[ordinal];
		if (field === undefined) {
			console.warn(`[LaserSession] Level field ordinal ${ordinal} is out of range (${fields.length} fields). Falling back to random selection.`);
		}
		return field;
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

		if (this._isTimeLimitPerRound) {
			this._remainingSeconds = quest.timeLimitSeconds > 0 ? quest.timeLimitSeconds : DEFAULT_TIME_LIMIT_SECONDS;
			this._lastPublishedSecond = -1;
		}

		this.openLevel(level);
		return true;
	}

	/**
	 * 지금 판을 풀기 전 상태로 되돌린다 - 보조 레이아웃의 Reset 버튼 (worker/NextJob.md 1번).
	 *
	 * **남은 시간은 되돌리지 않는다.** 시간까지 함께 돌아가면 리셋 버튼이 곧 무한 연장이 된다.
	 * 판을 새로 고르지도 않는다 - 지금 열려 있는 레벨을 그대로 다시 연다.
	 */
	public resetRound(): boolean {
		const level = this._level;
		if (level === undefined || this.canResetRound() === false) {
			return false;
		}
		this.openLevel(level);
		return true;
	}

	/** 리셋할 수 있는 상태인지 - 판이 열려 있고 아직 끝나지 않았을 때만 */
	private canResetRound(): boolean {
		return this._state === ELaserState.ROUND_INTRO || this._state === ELaserState.PLAYER_INPUT;
	}

	/**
	 * 판 하나를 열어 플레이 가능 상태로 만든다.
	 *
	 * `startRound()` 와 `resetRound()` 가 공유한다. 둘의 차이는 **판을 새로 고르는지**와
	 * **남은 시간을 되돌리는지** 둘뿐이고, 그 둘은 이 함수 밖에 있다.
	 */
	private openLevel(level: LaserLevel): void {
		this._level = level;
		this._board = LaserBoard.fromLevel(level);
		this._dragController = new LaserDragController(this._board);

		this.setState(ELaserState.ROUND_INTRO);
		this._events.LEVEL_LOADED.publish(level);
		this._events.ROUND_START.publish(this._roundIndex);
		this.publishRoundProgress();
		this.publishRemainingTime(true);

		this.setState(ELaserState.PLAYER_INPUT);
		this.refreshBeams();
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
			// 레벨 모드는 판이 정해져 있다 - 무작위 선택을 건너뛴다
			const chosen = this.resolveLevelField(fields);
			if (chosen !== undefined) {
				return this._tables.buildLevel(chosen);
			}

			// 같은 퀘스트 안에서는 이미 낸 판을 다시 내지 않는다. 다 소진하면 처음부터 다시 고른다.
			const unused = fields.filter((field) => this._usedPuzzleIds.indexOf(field.puzzleId) < 0);
			const candidates = unused.length > 0 ? unused : fields;

			// 세션 seed 가 있으면 필드 선택도 재현 가능해야 한다
			const random = this._seed === undefined ? Math.random : createSeededRandom(this._seed + this._roundIndex);
			const field = candidates.length === 1 ? candidates[0] : pickRandom(random, candidates);
			this._usedPuzzleIds.push(field.puzzleId);
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

		const total = Math.max(1, this.getRoundCount());
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
			roundCount: this.getRoundCount(),
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
