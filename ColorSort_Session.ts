/**
 * Color Sort Session - 라운드 / 제한시간 / 승패를 묶는 순수 상태 머신 (PUZ_03)
 *
 * PUZ_00 §7.4 가 요구하는 "실패/성공 판정, 남은 시간, 라운드 진행도를 외부에서 조회 가능한 API".
 *
 * 실패 조건이 둘이다 - §2.
 *   1) 제한 시간 초과
 *   2) 이동시킬 수 있는 목표 오브젝트가 없음 (데드락) -> 즉시 종료
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { ColorSortBoard } from 'ColorSort_Board';
import { ColorSortDragBeginResult, ColorSortDragController, ColorSortDragEndResult, ColorSortDragPreview } from 'ColorSort_DragController';
import { ColorSortEvents } from 'ColorSort_GameEvents';
import { ColorSortLevelGenerator } from 'ColorSort_LevelGenerator';
import { ColorSortMainTableEntry, ColorSortTables } from 'ColorSort_DataTables';
import { ColorSortSolutionStep, ColorSortSolver } from 'ColorSort_Solver';
import {
	ColorSortLevel,
	ColorSortResultData,
	ColorSortRoundProgress,
	EColorSortFailReason,
	EColorSortResult,
	EColorSortState,
	createSeededRandom,
	pickRandom,
} from 'ColorSort_Definitions';

export type ColorSortSessionOptions = {
	/** 제한 시간을 라운드마다 리셋할지(기본 true) 퀘스트 전체에 한 번만 줄지 */
	isTimeLimitPerRound?: boolean,
	seed?: number,
}

const DEFAULT_TIME_LIMIT_SECONDS = 120;

export class ColorSortSession {
	private readonly _events: ColorSortEvents;
	private readonly _tables: ColorSortTables;
	private readonly _generator: ColorSortLevelGenerator;
	private readonly _solver: ColorSortSolver;
	private readonly _isTimeLimitPerRound: boolean;
	private readonly _seed: number | undefined;

	private _state: EColorSortState = EColorSortState.IDLE;
	private _stateBeforePause: EColorSortState = EColorSortState.IDLE;

	private _quest: ColorSortMainTableEntry | undefined = undefined;
	/**
	 * 레벨 모드에서 이번 판의 순번 (그 난이도의 판 목록에서 0-based).
	 * undefined 면 기존처럼 아직 안 낸 판 중에서 무작위로 고른다.
	 */
	private _fieldOrdinal: number | undefined = undefined;
	/** 레벨 모드는 1라운드 고정. undefined 면 퀘스트 테이블의 roundCount 를 쓴다 */
	private _roundCountOverride: number | undefined = undefined;
	private _level: ColorSortLevel | undefined = undefined;
	private _board: ColorSortBoard | undefined = undefined;
	private _dragController: ColorSortDragController | undefined = undefined;

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

	public get state(): EColorSortState {
		return this._state;
	}

	public get board(): ColorSortBoard | undefined {
		return this._board;
	}

	public get level(): ColorSortLevel | undefined {
		return this._level;
	}

	public get dragController(): ColorSortDragController | undefined {
		return this._dragController;
	}

	public get isActive(): boolean {
		return this._state === EColorSortState.PLAYER_INPUT;
	}

	public getRemainingTimeSeconds(): number {
		return Math.max(0, this._remainingSeconds);
	}

	public getRoundProgress(): ColorSortRoundProgress {
		return {
			current: this._roundIndex + 1,
			total: this.getRoundCount(),
			cleared: this._roundsCleared,
		};
	}

	/** 솔버가 찾은 해의 다음 한 수 (힌트 기능용) */
	public getHintStep(): ColorSortSolutionStep | undefined {
		if (this._board === undefined) {
			return undefined;
		}
		const solution = this._solver.solve(this._board);
		return solution.isSolvable ? solution.steps[0] : undefined;
	}

	//#endregion

	constructor(events: ColorSortEvents, tables: ColorSortTables, generator: ColorSortLevelGenerator, solver: ColorSortSolver = new ColorSortSolver(), options: ColorSortSessionOptions = {}) {
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
			console.warn(`[ColorSortSession] Unknown questId: ${questId}`);
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
			console.warn(`[ColorSortSession] No quest for difficulty ${difficulty}`);
			return false;
		}

		this._fieldOrdinal = fieldOrdinal;
		this._roundCountOverride = 1;
		return this.beginQuest(quest);
	}

	/** startQuest / startLevel 의 공통 몸통 - 상태를 초기화하고 첫 라운드를 연다 */
	private beginQuest(quest: ColorSortMainTableEntry): boolean {
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
			console.warn(`[ColorSortSession] Level field ordinal ${ordinal} is out of range (${fields.length} fields). Falling back to random selection.`);
		}
		return field;
	}

	public startQuestByDifficulty(difficulty: number): boolean {
		const quest = this._tables.getQuestByDifficulty(difficulty);
		if (quest === undefined) {
			console.warn(`[ColorSortSession] No quest for difficulty ${difficulty}`);
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
			console.warn(`[ColorSortSession] Failed to load a level for quest ${quest.questId} round ${this._roundIndex}`);
			// 결과 이벤트(QUEST_FAILED/GAME_END) 없이 멈추면 UI 가 영원히 대기하므로 실패로 처리한다
			this.fail(EColorSortFailReason.LEVEL_LOAD_FAILED);
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
		return this._state === EColorSortState.ROUND_INTRO || this._state === EColorSortState.PLAYER_INPUT;
	}

	/**
	 * 판 하나를 열어 플레이 가능 상태로 만든다.
	 *
	 * `startRound()` 와 `resetRound()` 가 공유한다. 둘의 차이는 **판을 새로 고르는지**와
	 * **남은 시간을 되돌리는지** 둘뿐이고, 그 둘은 이 함수 밖에 있다.
	 */
	private openLevel(level: ColorSortLevel): void {
		this._level = level;
		this._board = ColorSortBoard.fromLevel(level);
		this._dragController = new ColorSortDragController(this._board);

		this.setState(EColorSortState.ROUND_INTRO);
		this._events.LEVEL_LOADED.publish(level);
		this._events.ROUND_START.publish(this._roundIndex);
		this.publishRoundProgress();
		this.publishRemainingTime(true);

		this.setState(EColorSortState.PLAYER_INPUT);
		// 필드 테이블 레벨은 생성기 검증을 거치지 않으므로,
		// 시작부터 데드락인 배치가 들어오면 §2 에 따라 즉시 종료한다
		this.checkDeadlock();
	}

	/** 매 프레임 호출. 제한 시간과 리스폰 타이머를 함께 진행시킨다 */
	public update(deltaSeconds: number): void {
		// 리스폰은 일시정지 중이 아니면 진행한다 (§8 - 2초 후 이전 위치에 리스폰)
		if (this._state !== EColorSortState.PAUSED) {
			const respawnedList = this._dragController === undefined ? [] : this._dragController.update(deltaSeconds);
			for (const respawned of respawnedList) {
				this._events.RESPAWN_FINISHED.publish(respawned.caseIndex);
			}
			if (respawnedList.length > 0) {
				// 잠금이 풀리면서 비로소 데드락이 아니게 될 수도 있으므로 다시 확인한다
				this.checkDeadlock();
			}
		}

		if (this.isActive === false) {
			return;
		}

		this._remainingSeconds -= deltaSeconds;
		this.publishRemainingTime(false);

		if (this._remainingSeconds <= 0) {
			this._remainingSeconds = 0;
			this.fail(EColorSortFailReason.TIME_OUT);
		}
	}

	public pause(): void {
		if (this.isActive === false) {
			return;
		}
		this._stateBeforePause = this._state;
		this._dragController?.cancel();
		this.setState(EColorSortState.PAUSED);
		this._events.GAME_PAUSE.publish();
	}

	public resume(): void {
		if (this._state !== EColorSortState.PAUSED) {
			return;
		}
		this.setState(this._stateBeforePause);
		this._events.GAME_RESUME.publish();
	}

	public abort(): void {
		this._dragController?.cancel();
		this.unloadLevel();
		this.setState(EColorSortState.IDLE);
	}

	//#endregion

	//#region Input entry points (모바일 드래그)

	/** 케이스의 최상단 뭉치를 집는다 - §8 그랩 */
	public beginDrag(caseIndex: number): ColorSortDragBeginResult {
		if (this._state !== EColorSortState.PLAYER_INPUT || this._dragController === undefined) {
			return { isAccepted: false, reason: 'not-accepting-input' };
		}
		return this._dragController.begin(caseIndex);
	}

	/** 드래그 중 가리키는 케이스를 갱신한다. undefined 면 영역 밖 - §8 드랍 미리보기 */
	public hoverDrag(caseIndex: number | undefined): ColorSortDragPreview | undefined {
		return this._dragController?.hover(caseIndex);
	}

	/** 손을 뗀다 */
	public endDrag(dropCaseIndex?: number): ColorSortDragEndResult | undefined {
		const controller = this._dragController;
		const board = this._board;
		if (controller === undefined || board === undefined) {
			return undefined;
		}

		const result = controller.end(dropCaseIndex);
		if (result === undefined) {
			return undefined;
		}

		if (result.didMove && result.move !== undefined) {
			this._events.BATTERIES_MOVED.publish(result.move);

			if (result.move.revealedBatteryIds.length > 0) {
				this._events.BATTERY_REVEALED.publish(result.move.revealedBatteryIds);
			}
			for (const closedIndex of result.move.closedCaseIndexes) {
				this._events.CASE_CLOSED.publish(closedIndex);
			}

			if (board.isSolved()) {
				this.clearRound();
				return result;
			}
			this.checkDeadlock();
		}
		else {
			this._events.MOVE_REJECTED.publish(result.rejection);
			if (result.isRespawning) {
				this._events.RESPAWN_STARTED.publish(result.fromCaseIndex);
			}
		}

		return result;
	}

	public cancelDrag(): void {
		this._dragController?.cancel();
	}

	//#endregion

	//#region Internal

	private loadLevel(quest: ColorSortMainTableEntry): ColorSortLevel | undefined {
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
	}

	/**
	 * 데드락 감지 - §2 / §10.3.
	 * "이동시킬 수 있는 목표 오브젝트가 없으면 실패(데드락 = 즉시 종료)"
	 *
	 * 리스폰 대기로 케이스가 잠겨 있는 동안은 일시적으로 이동이 막힐 수 있으므로,
	 * 그때는 데드락으로 보지 않고 리스폰이 끝난 뒤 다시 확인한다.
	 */
	private checkDeadlock(): void {
		const board = this._board;
		if (board === undefined || this.isActive === false) {
			return;
		}
		if (this._dragController?.isRespawning === true) {
			return;
		}
		if (board.isDeadlocked() === false) {
			return;
		}

		this._events.DEADLOCK_DETECTED.publish();
		this.fail(EColorSortFailReason.DEADLOCK);
	}

	private clearRound(): void {
		this._roundsCleared++;
		this._dragController?.flushRespawn();
		this.setState(EColorSortState.ROUND_CLEAR);
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
		this.setState(EColorSortState.QUEST_CLEAR);
		const results = this.buildResultData(EColorSortResult.WIN);
		this._events.QUEST_CLEAR.publish(results);
		this._events.GAME_END.publish(results);
	}

	private fail(reason: EColorSortFailReason): void {
		this._dragController?.cancel();
		this.setState(EColorSortState.GAME_OVER);
		const results = this.buildResultData(EColorSortResult.LOSE, reason);
		this._events.QUEST_FAILED.publish(results);
		this._events.GAME_END.publish(results);
	}

	private buildResultData(result: EColorSortResult, failReason?: EColorSortFailReason): ColorSortResultData {
		return {
			result: result,
			failReason: failReason,
			roundsCleared: this._roundsCleared,
			roundCount: this.getRoundCount(),
			remainingTimeSeconds: this.getRemainingTimeSeconds(),
		};
	}

	private setState(state: EColorSortState): void {
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
