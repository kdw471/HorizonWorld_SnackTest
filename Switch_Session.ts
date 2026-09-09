/**
 * Switch Session - 라운드 / 제한시간 / 승패를 묶는 순수 상태 머신 (PUZ_08)
 *
 * PUZ_00 §7.4 가 요구하는 "실패/성공 판정, 남은 시간, 라운드 진행도를 외부에서 조회 가능한 API".
 *
 * 승패 - §2
 *   클리어: 제한 시간 안에 모든 키를 눌린 상태(녹색)로 만들면 클리어
 *   실패:   제한 시간 동안 모든 키를 누르지 못하면 실패
 *
 * 클리어 판정은 §7 연출이 끝나는 시점(0.4초)에 한다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { SwitchBoard } from 'Switch_Board';
import { SwitchPuzzleEvents } from 'Switch_GameEvents';
import { SwitchInputController } from 'Switch_InputController';
import { SwitchLevelGenerator } from 'Switch_LevelGenerator';
import { SwitchMainTableEntry, SwitchPuzzleTables } from 'Switch_DataTables';
import {
	ESwitchInputState,
	ESwitchPressOutcome,
	ESwitchPuzzleResult,
	ESwitchPuzzleState,
	ESwitchRejection,
	SwitchLevel,
	SwitchPressResult,
	SwitchPuzzleResultData,
	SwitchRoundProgress,
	createSeededRandom,
	pickRandom,
	toPosition,
} from 'Switch_Definitions';

export type SwitchSessionOptions = {
	/** 제한 시간을 라운드마다 리셋할지(기본 true) 퀘스트 전체에 한 번만 줄지 */
	isTimeLimitPerRound?: boolean,
	seed?: number,
}

const DEFAULT_TIME_LIMIT_SECONDS = 120;

export class SwitchSession {
	private readonly _events: SwitchPuzzleEvents;
	private readonly _tables: SwitchPuzzleTables;
	private readonly _generator: SwitchLevelGenerator;
	private readonly _isTimeLimitPerRound: boolean;
	private readonly _seed: number | undefined;

	private _state: ESwitchPuzzleState = ESwitchPuzzleState.IDLE;
	private _stateBeforePause: ESwitchPuzzleState = ESwitchPuzzleState.IDLE;

	private _quest: SwitchMainTableEntry | undefined = undefined;
	/**
	 * 레벨 모드에서 이번 판의 순번 (그 난이도의 판 목록에서 0-based).
	 * undefined 면 기존처럼 아직 안 낸 판 중에서 무작위로 고른다.
	 */
	private _fieldOrdinal: number | undefined = undefined;
	/** 레벨 모드는 1라운드 고정. undefined 면 퀘스트 테이블의 roundCount 를 쓴다 */
	private _roundCountOverride: number | undefined = undefined;
	private _level: SwitchLevel | undefined = undefined;
	private _board: SwitchBoard | undefined = undefined;
	private _input: SwitchInputController | undefined = undefined;

	private _roundIndex: number = 0;
	/**
	 * 이번 퀘스트에서 이미 낸 필드 데이터 index.
	 * 기획 CSV 를 붙인 뒤 난이도당 판이 14~23개가 됐으므로, 라운드마다 다른 판을 낸다.
	 */
	private _usedFieldIndexes: number[] = [];
	private _roundsCleared: number = 0;
	private _remainingSeconds: number = 0;
	private _lastPublishedSecond: number = -1;
	private _lastUnpressedCount: number = -1;

	//#region External query API (PUZ_00 §7.4)

	public get state(): ESwitchPuzzleState {
		return this._state;
	}

	public get board(): SwitchBoard | undefined {
		return this._board;
	}

	public get level(): SwitchLevel | undefined {
		return this._level;
	}

	public get input(): SwitchInputController | undefined {
		return this._input;
	}

	public get isActive(): boolean {
		return this._state === ESwitchPuzzleState.PLAYER_INPUT;
	}

	public getRemainingTimeSeconds(): number {
		return Math.max(0, this._remainingSeconds);
	}

	public getRoundProgress(): SwitchRoundProgress {
		return {
			current: this._roundIndex + 1,
			total: this.getRoundCount(),
			cleared: this._roundsCleared,
		};
	}

	/** 아직 눌리지 않은 키 캡 수 - 진행도 표시용 */
	public getUnpressedKeyCount(): number {
		return this._board?.getUnpressedCount() ?? 0;
	}

	/** 우측 미니 UI 에 표시할 스위치 영역 마스크 - §6 / §9.5 */
	public getMask(): readonly number[] | undefined {
		return this._board?.mask;
	}

	//#endregion

	constructor(events: SwitchPuzzleEvents, tables: SwitchPuzzleTables, generator: SwitchLevelGenerator, options: SwitchSessionOptions = {}) {
		this._events = events;
		this._tables = tables;
		this._generator = generator;
		this._isTimeLimitPerRound = options.isTimeLimitPerRound ?? true;
		this._seed = options.seed;
	}

	//#region Quest / round lifecycle

	public startQuest(questId: string): boolean {
		const quest = this._tables.getQuest(questId);
		if (quest === undefined) {
			console.warn(`[SwitchSession] Unknown questId: ${questId}`);
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
			console.warn(`[SwitchSession] No quest for difficulty ${difficulty}`);
			return false;
		}

		this._fieldOrdinal = fieldOrdinal;
		this._roundCountOverride = 1;
		return this.beginQuest(quest);
	}

	/** startQuest / startLevel 의 공통 몸통 - 상태를 초기화하고 첫 라운드를 연다 */
	private beginQuest(quest: SwitchMainTableEntry): boolean {
		this._quest = quest;
		this._roundIndex = 0;
		this._usedFieldIndexes = [];
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
			console.warn(`[SwitchSession] Level field ordinal ${ordinal} is out of range (${fields.length} fields). Falling back to random selection.`);
		}
		return field;
	}

	public startQuestByDifficulty(difficulty: number): boolean {
		const quest = this._tables.getQuestByDifficulty(difficulty);
		if (quest === undefined) {
			console.warn(`[SwitchSession] No quest for difficulty ${difficulty}`);
			return false;
		}
		return this.startQuest(quest.questId);
	}

	/**
	 * 이번 라운드에 쓸 필드 데이터를 고른다.
	 * 같은 퀘스트 안에서는 이미 낸 판을 다시 내지 않고, 다 소진하면 처음부터 다시 고른다.
	 */
	private pickFieldIndex(difficulty: number): number | undefined {
		// 레벨 모드는 판이 정해져 있다 - 무작위 선택을 건너뛴다
		const chosen = this.resolveLevelField(this._tables.getFieldsForDifficulty(difficulty));
		if (chosen !== undefined) {
			return chosen.index;
		}

		const config = this._tables.getDifficultyConfig(difficulty);
		if (config === undefined || config.fieldIndexes.length === 0) {
			return undefined;
		}

		const unused = config.fieldIndexes.filter((index) => this._usedFieldIndexes.indexOf(index) < 0);
		const candidates = unused.length > 0 ? unused : config.fieldIndexes;
		const random = this._seed === undefined ? Math.random : createSeededRandom(this._seed + this._roundIndex);
		const picked = candidates.length === 1 ? candidates[0] : pickRandom(random, candidates);
		this._usedFieldIndexes.push(picked);
		return picked;
	}

	public startRound(): boolean {
		const quest = this._quest;
		if (quest === undefined) {
			return false;
		}

		const level = this._generator.generate({
			puzzleId: `${quest.questId}_R${this._roundIndex}`,
			difficulty: quest.difficulty,
			seed: this._seed === undefined ? undefined : this._seed + this._roundIndex,
			fieldIndex: this.pickFieldIndex(quest.difficulty),
		});
		if (level === undefined) {
			console.warn(`[SwitchSession] Failed to load a level for quest ${quest.questId} round ${this._roundIndex}`);
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
		return this._state === ESwitchPuzzleState.ROUND_INTRO || this._state === ESwitchPuzzleState.PLAYER_INPUT;
	}

	/**
	 * 판 하나를 열어 플레이 가능 상태로 만든다.
	 *
	 * `startRound()` 와 `resetRound()` 가 공유한다. 둘의 차이는 **판을 새로 고르는지**와
	 * **남은 시간을 되돌리는지** 둘뿐이고, 그 둘은 이 함수 밖에 있다.
	 */
	private openLevel(level: SwitchLevel): void {
		this._level = level;
		this._board = SwitchBoard.fromLevel(level);
		this._input = new SwitchInputController(this._board);
		this._lastUnpressedCount = -1;

		this.setState(ESwitchPuzzleState.ROUND_INTRO);
		this._events.LEVEL_LOADED.publish(level);
		// §6 - 라운드마다 다른 스위치 영역. 우측 3×3 미니 UI 갱신 (§9.5)
		this._events.MASK_CHANGED.publish(level.mask.slice());
		this._events.ROUND_START.publish(this._roundIndex);
		this.publishRoundProgress();
		this.publishRemainingTime(true);
		this.publishUnpressedCount();

		this.setState(ESwitchPuzzleState.PLAYER_INPUT);
	}

	/** 매 프레임 호출. 누름 연출과 제한 시간을 함께 진행시킨다 */
	public update(deltaSeconds: number): void {
		if (this.isActive === false) {
			return;
		}

		const board = this._board;
		if (board === undefined) {
			return;
		}

		const progressed = board.update(deltaSeconds);
		if (progressed.didReachAreaPhase) {
			// §7 0.2초 - 스위치 영역의 키 캡 연출 재생
			this._events.AREA_TOGGLED.publish(this.buildLastPressResult(board));
		}
		if (progressed.didFinishSequence) {
			// §7 0.4초 - 모든 연출 종료. 이 시점에 클리어 판정 (§9.3)
			this._events.PRESS_SEQUENCE_FINISHED.publish();
			this.publishUnpressedCount();

			if (progressed.didClear) {
				this.completeRound();
				return;
			}
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
		this._input?.clearPending();
		this.setState(ESwitchPuzzleState.PAUSED);
		this._events.GAME_PAUSE.publish();
	}

	public resume(): void {
		if (this._state !== ESwitchPuzzleState.PAUSED) {
			return;
		}
		this.setState(this._stateBeforePause);
		this._events.GAME_RESUME.publish();
	}

	public abort(): void {
		this._input?.clearPending();
		this.unloadLevel();
		this.setState(ESwitchPuzzleState.IDLE);
	}

	//#endregion

	//#region Input

	/**
	 * 키 캡을 누른다 (탭 간편 경로).
	 * 같은 프레임에 여러 입력이 들어올 수 있는 환경이라면 `queueTouch()` + `flushTouches()` 를 쓴다.
	 */
	public pressKey(position: number): SwitchPressResult | undefined {
		if (this.isActive === false || this._input === undefined) {
			return undefined;
		}
		return this.applyPressResult(this._input.touch(position));
	}

	/** 행/열로 누른다 (어댑터 편의용) */
	public pressKeyAt(row: number, col: number): SwitchPressResult | undefined {
		return this.pressKey(toPosition(row, col));
	}

	/** 터치 다운 - §7 "먼저 들어간 손만 인식" (진행 중이면 무시) */
	public touchDown(position: number): boolean {
		if (this.isActive === false || this._input === undefined) {
			return false;
		}
		return this._input.touchDown(position);
	}

	/** 터치 유지 중 이동 */
	public touchMove(position: number): void {
		if (this.isActive === false) {
			return;
		}
		this._input?.touchMove(position);
	}

	/** 터치 업 - 다운했던 키 캡 위에서 뗀 경우에만 눌림 확정 */
	public touchUp(): SwitchPressResult | undefined {
		if (this.isActive === false || this._input === undefined) {
			return undefined;
		}
		return this.applyPressResult(this._input.touchUp());
	}

	/** 같은 프레임의 입력을 모은다 - PUZ_00 §8.1 */
	public queueTouch(position: number, timestampMs: number): void {
		if (this.isActive === false) {
			return;
		}
		this._input?.queueTouch(position, timestampMs);
	}

	/** 모은 입력 중 가장 먼저 눌린 하나만 처리한다 - PUZ_00 §8.1 */
	public flushTouches(): SwitchPressResult | undefined {
		if (this.isActive === false || this._input === undefined) {
			return undefined;
		}
		return this.applyPressResult(this._input.flush());
	}

	/** 이 키 캡을 하이라이트할 수 있는지 - PUZ_00 §8.2 */
	public canHighlight(position: number): boolean {
		return this._input?.canHighlight(position) ?? false;
	}

	//#endregion

	//#region Internal

	private applyPressResult(result: SwitchPressResult | undefined): SwitchPressResult | undefined {
		if (result === undefined) {
			return undefined;
		}

		if (result.outcome === ESwitchPressOutcome.PRESSED) {
			// §7 0.0초 - 중앙 키 캡의 눌림 연출
			this._events.KEY_PRESSED.publish(result);

			// 연출 시간이 0이면 board 가 즉시 완료 처리하므로 여기서 마무리한다
			const board = this._board;
			if (board !== undefined && board.inputState !== ESwitchInputState.SEQUENCE) {
				this._events.AREA_TOGGLED.publish(result);
				this._events.PRESS_SEQUENCE_FINISHED.publish();
				this.publishUnpressedCount();
				if (board.isSolved()) {
					this.completeRound();
				}
			}
		}
		else {
			this._events.PRESS_REJECTED.publish(result.rejection);
		}
		return result;
	}

	private unloadLevel(): void {
		if (this._level !== undefined) {
			this._events.LEVEL_UNLOADED.publish();
		}
		this._level = undefined;
		this._board = undefined;
		this._input = undefined;
	}

	private completeRound(): void {
		this._events.PUZZLE_COMPLETED.publish();

		this._roundsCleared++;
		this._input?.clearPending();
		this.setState(ESwitchPuzzleState.ROUND_CLEAR);
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
		this.setState(ESwitchPuzzleState.QUEST_CLEAR);
		const results = this.buildResultData(ESwitchPuzzleResult.WIN);
		this._events.QUEST_CLEAR.publish(results);
		this._events.GAME_END.publish(results);
	}

	private fail(): void {
		this._input?.clearPending();
		this.setState(ESwitchPuzzleState.GAME_OVER);
		const results = this.buildResultData(ESwitchPuzzleResult.LOSE);
		this._events.QUEST_FAILED.publish(results);
		this._events.GAME_END.publish(results);
	}

	private buildResultData(result: ESwitchPuzzleResult): SwitchPuzzleResultData {
		return {
			result: result,
			roundsCleared: this._roundsCleared,
			roundCount: this.getRoundCount(),
			remainingTimeSeconds: this.getRemainingTimeSeconds(),
			unpressedKeyCount: this.getUnpressedKeyCount(),
		};
	}

	private buildLastPressResult(board: SwitchBoard): SwitchPressResult {
		return {
			outcome: ESwitchPressOutcome.PRESSED,
			rejection: ESwitchRejection.NONE,
			position: board.lastPressPosition,
			toggledPositions: board.lastToggledPositions.slice(),
		};
	}

	private setState(state: ESwitchPuzzleState): void {
		if (this._state === state) {
			return;
		}
		this._state = state;
		this._events.STATE_CHANGED.publish(state);
	}

	private publishRoundProgress(): void {
		this._events.ROUND_PROGRESS_CHANGED.publish(this.getRoundProgress());
	}

	private publishUnpressedCount(): void {
		const count = this.getUnpressedKeyCount();
		if (count === this._lastUnpressedCount) {
			return;
		}
		this._lastUnpressedCount = count;
		this._events.UNPRESSED_COUNT_CHANGED.publish(count);
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
