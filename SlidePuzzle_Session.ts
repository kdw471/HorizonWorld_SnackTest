/**
 * Slide Puzzle Session - 라운드 / 제한시간 / 승패를 묶는 순수 상태 머신 (PUZ_07)
 *
 * PUZ_00 §7.4 가 요구하는 "실패/성공 판정, 남은 시간, 라운드 진행도를 외부에서 조회 가능한 API".
 *
 * 승패 - §2
 *   클리어: 제한 시간 안에 모든 조각을 초기 상태로 만들면 클리어
 *   실패:   제한 시간 동안 맞추지 못하면 실패
 *
 * 완성 판정은 §12.6 에 따라 **매 이동 완료 시점**에 한다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { SlidePuzzleBoard } from 'SlidePuzzle_Board';
import { SlidePuzzleEvents } from 'SlidePuzzle_GameEvents';
import { SlidePuzzleInputController } from 'SlidePuzzle_InputController';
import { SlidePuzzleLevelGenerator } from 'SlidePuzzle_LevelGenerator';
import { SlideMainTableEntry, SlidePuzzleTables } from 'SlidePuzzle_DataTables';
import {
	ESlideInputState,
	ESlideMoveOutcome,
	ESlidePuzzleResult,
	ESlidePuzzleState,
	SlideMoveResult,
	SlidePuzzleLevel,
	SlidePuzzleResultData,
	SlidePuzzleRoundProgress,
} from 'SlidePuzzle_Definitions';

export type SlidePuzzleSessionOptions = {
	/** 제한 시간을 라운드마다 리셋할지(기본 true) 퀘스트 전체에 한 번만 줄지 */
	isTimeLimitPerRound?: boolean,
	seed?: number,
}

const DEFAULT_TIME_LIMIT_SECONDS = 120;

export class SlidePuzzleSession {
	private readonly _events: SlidePuzzleEvents;
	private readonly _tables: SlidePuzzleTables;
	private readonly _generator: SlidePuzzleLevelGenerator;
	private readonly _isTimeLimitPerRound: boolean;
	private readonly _seed: number | undefined;

	private _state: ESlidePuzzleState = ESlidePuzzleState.IDLE;
	private _stateBeforePause: ESlidePuzzleState = ESlidePuzzleState.IDLE;

	private _quest: SlideMainTableEntry | undefined = undefined;
	private _level: SlidePuzzleLevel | undefined = undefined;
	private _board: SlidePuzzleBoard | undefined = undefined;
	private _input: SlidePuzzleInputController | undefined = undefined;

	private _roundIndex: number = 0;
	private _roundsCleared: number = 0;
	private _remainingSeconds: number = 0;
	private _lastPublishedSecond: number = -1;

	/** 직전에 알린 이동 가능 위치 - 바뀔 때만 이벤트를 낸다 */
	private _lastMovableKey: string = '';

	//#region External query API (PUZ_00 §7.4)

	public get state(): ESlidePuzzleState {
		return this._state;
	}

	public get board(): SlidePuzzleBoard | undefined {
		return this._board;
	}

	public get level(): SlidePuzzleLevel | undefined {
		return this._level;
	}

	public get input(): SlidePuzzleInputController | undefined {
		return this._input;
	}

	public get isActive(): boolean {
		return this._state === ESlidePuzzleState.PLAYER_INPUT;
	}

	public getRemainingTimeSeconds(): number {
		return Math.max(0, this._remainingSeconds);
	}

	public getRoundProgress(): SlidePuzzleRoundProgress {
		return {
			current: this._roundIndex + 1,
			total: this._quest?.roundCount ?? 0,
			cleared: this._roundsCleared,
		};
	}

	/** 아직 제자리가 아닌 조각 수 - 진행도 표시용 */
	public getMisplacedPieceCount(): number {
		return this._board?.getMisplacedCount() ?? 0;
	}

	/** 사이드 패널에 표시할 원본 이미지 경로 - §10 */
	public getReferenceImagePath(): string | undefined {
		return this._level?.imagePath;
	}

	//#endregion

	constructor(events: SlidePuzzleEvents, tables: SlidePuzzleTables, generator: SlidePuzzleLevelGenerator, options: SlidePuzzleSessionOptions = {}) {
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
			console.warn(`[SlidePuzzleSession] Unknown questId: ${questId}`);
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
			console.warn(`[SlidePuzzleSession] No quest for difficulty ${difficulty}`);
			return false;
		}
		return this.startQuest(quest.questId);
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
		});
		if (level === undefined) {
			console.warn(`[SlidePuzzleSession] Failed to load a level for quest ${quest.questId} round ${this._roundIndex}`);
			// 결과 이벤트(QUEST_FAILED/GAME_END) 없이 멈추면 UI 가 영원히 대기하므로 실패로 처리한다
			this.fail();
			return false;
		}

		this._level = level;
		this._board = SlidePuzzleBoard.fromLevel(level);
		this._input = new SlidePuzzleInputController(this._board);
		this._lastMovableKey = '';

		if (this._isTimeLimitPerRound) {
			this._remainingSeconds = quest.timeLimitSeconds > 0 ? quest.timeLimitSeconds : DEFAULT_TIME_LIMIT_SECONDS;
			this._lastPublishedSecond = -1;
		}

		this.setState(ESlidePuzzleState.ROUND_INTRO);
		this._events.LEVEL_LOADED.publish(level);
		this._events.ROUND_START.publish(this._roundIndex);
		this.publishRoundProgress();
		this.publishRemainingTime(true);

		this.setState(ESlidePuzzleState.PLAYER_INPUT);
		this.publishMovablePositions();
		return true;
	}

	/** 매 프레임 호출. 이동 연출과 제한 시간을 함께 진행시킨다 */
	public update(deltaSeconds: number): void {
		if (this.isActive === false) {
			return;
		}

		const board = this._board;
		if (board === undefined) {
			return;
		}

		const progressed = board.update(deltaSeconds);
		if (progressed.didFinishMove) {
			this._events.PIECE_MOVE_FINISHED.publish();
			this.publishMovablePositions();

			// §12.6 - 매 이동 완료 시점에 완성 여부를 검사한다
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
		this.setState(ESlidePuzzleState.PAUSED);
		this._events.GAME_PAUSE.publish();
	}

	public resume(): void {
		if (this._state !== ESlidePuzzleState.PAUSED) {
			return;
		}
		this.setState(this._stateBeforePause);
		this._events.GAME_RESUME.publish();
	}

	public abort(): void {
		this._input?.clearPending();
		this.unloadLevel();
		this.setState(ESlidePuzzleState.IDLE);
	}

	//#endregion

	//#region Input

	/**
	 * 조각을 누른다.
	 * 같은 프레임에 여러 입력이 들어올 수 있는 환경이라면 `queueTouch()` + `flushTouches()` 를 쓴다.
	 */
	public pressPiece(position: number): SlideMoveResult | undefined {
		if (this.isActive === false || this._input === undefined) {
			return undefined;
		}
		return this.applyMoveResult(this._input.touch(position));
	}

	/** 행/열로 누른다 (어댑터 편의용) */
	public pressPieceAt(row: number, col: number): SlideMoveResult | undefined {
		const board = this._board;
		if (board === undefined) {
			return undefined;
		}
		return this.pressPiece(row * board.divideNum + col);
	}

	/** 같은 프레임의 입력을 모은다 - §12.4 */
	public queueTouch(position: number, timestampMs: number): void {
		if (this.isActive === false) {
			return;
		}
		this._input?.queueTouch(position, timestampMs);
	}

	/** 모은 입력 중 가장 먼저 눌린 하나만 처리한다 - §5 / §12.4 */
	public flushTouches(): SlideMoveResult | undefined {
		if (this.isActive === false || this._input === undefined) {
			return undefined;
		}
		return this.applyMoveResult(this._input.flush());
	}

	/** 이 조각에 호버 Emissive 를 켤 수 있는지 - §5 */
	public canHighlight(position: number): boolean {
		return this._input?.canHighlight(position) ?? false;
	}

	//#endregion

	//#region Internal

	private applyMoveResult(result: SlideMoveResult | undefined): SlideMoveResult | undefined {
		if (result === undefined) {
			return undefined;
		}

		if (result.outcome === ESlideMoveOutcome.MOVING) {
			this._events.PIECE_MOVE_STARTED.publish(result);
			this.publishMovablePositions();

			// 이동 시간이 0이면 board 가 즉시 완료 처리하므로 여기서 판정한다.
			// press() 가 보드 배열을 즉시 스왑하므로 isSolved() 만 보면 0.25초 연출 중에도
			// 클리어가 나 버린다 - §12.6 은 "매 이동 완료 시점"에 판정하라고 정한다.
			const board = this._board;
			if (board !== undefined && board.inputState !== ESlideInputState.MOVING) {
				this._events.PIECE_MOVE_FINISHED.publish();
				if (board.isSolved()) {
					this.completeRound();
				}
			}
		}
		else {
			this._events.MOVE_REJECTED.publish(result.rejection);
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

	/** 완성 - §9 연출을 위해 원본 이미지 경로를 함께 알린다 */
	private completeRound(): void {
		this._events.PUZZLE_COMPLETED.publish(this._level?.imagePath ?? '');

		this._roundsCleared++;
		this._input?.clearPending();
		this.setState(ESlidePuzzleState.ROUND_CLEAR);
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
		this.setState(ESlidePuzzleState.QUEST_CLEAR);
		const results = this.buildResultData(ESlidePuzzleResult.WIN);
		this._events.QUEST_CLEAR.publish(results);
		this._events.GAME_END.publish(results);
	}

	private fail(): void {
		this._input?.clearPending();
		this.setState(ESlidePuzzleState.GAME_OVER);
		const results = this.buildResultData(ESlidePuzzleResult.LOSE);
		this._events.QUEST_FAILED.publish(results);
		this._events.GAME_END.publish(results);
	}

	private buildResultData(result: ESlidePuzzleResult): SlidePuzzleResultData {
		return {
			result: result,
			roundsCleared: this._roundsCleared,
			roundCount: this._quest?.roundCount ?? 0,
			remainingTimeSeconds: this.getRemainingTimeSeconds(),
			misplacedPieceCount: this.getMisplacedPieceCount(),
		};
	}

	private setState(state: ESlidePuzzleState): void {
		if (this._state === state) {
			return;
		}
		this._state = state;
		this._events.STATE_CHANGED.publish(state);
	}

	private publishRoundProgress(): void {
		this._events.ROUND_PROGRESS_CHANGED.publish(this.getRoundProgress());
	}

	/** 누를 수 있는 조각이 바뀌었을 때만 알린다 - §5 Emissive */
	private publishMovablePositions(): void {
		const positions = this._board?.getMovablePositions() ?? [];
		const key = positions.join(',');
		if (key === this._lastMovableKey) {
			return;
		}
		this._lastMovableKey = key;
		this._events.MOVABLE_POSITIONS_CHANGED.publish(positions);
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
