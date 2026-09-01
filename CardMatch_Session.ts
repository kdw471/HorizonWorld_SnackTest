/**
 * Card Match Session - 라운드 / 제한시간 / 승패를 묶는 순수 상태 머신 (PUZ_06)
 *
 * PUZ_00 §7.4 가 요구하는 "실패/성공 판정, 남은 시간, 라운드 진행도를 외부에서 조회 가능한 API".
 *
 * 이 퍼즐만의 특수 사항
 *   - **폭탄 셔플 중에는 제한 시간이 멈추고 입력이 잠긴다** (§4)
 *   - **리셋 버튼은 동작하지 않는다.** 폭탄이 리셋의 역할을 대신하기 때문이다 (§1 / §9.5)
 *     버튼 자체는 UI 에 남기되 입력은 무시하고 `RESET_IGNORED` 만 알린다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { CardMatchBoard } from 'CardMatch_Board';
import { CardMatchEvents } from 'CardMatch_GameEvents';
import { CardMatchLevelGenerator } from 'CardMatch_LevelGenerator';
import { CardMatchMainTableEntry, CardMatchTables } from 'CardMatch_DataTables';
import {
	CardMatchLevel,
	CardMatchResultData,
	CardMatchRoundProgress,
	ECardMatchResult,
	ECardMatchState,
	ERevealOutcome,
	RandomSource,
	RevealResult,
	createSeededRandom,
} from 'CardMatch_Definitions';

export type CardMatchSessionOptions = {
	/** 제한 시간을 라운드마다 리셋할지(기본 true) 퀘스트 전체에 한 번만 줄지 */
	isTimeLimitPerRound?: boolean,
	seed?: number,
}

const DEFAULT_TIME_LIMIT_SECONDS = 90;

export class CardMatchSession {
	private readonly _events: CardMatchEvents;
	private readonly _tables: CardMatchTables;
	private readonly _generator: CardMatchLevelGenerator;
	private readonly _isTimeLimitPerRound: boolean;
	private readonly _seed: number | undefined;

	private _state: ECardMatchState = ECardMatchState.IDLE;
	private _stateBeforePause: ECardMatchState = ECardMatchState.IDLE;

	private _quest: CardMatchMainTableEntry | undefined = undefined;
	private _level: CardMatchLevel | undefined = undefined;
	private _board: CardMatchBoard | undefined = undefined;

	private _roundIndex: number = 0;
	private _roundsCleared: number = 0;
	private _remainingSeconds: number = 0;
	private _lastPublishedSecond: number = -1;

	//#region External query API (PUZ_00 §7.4)

	public get state(): ECardMatchState {
		return this._state;
	}

	public get board(): CardMatchBoard | undefined {
		return this._board;
	}

	public get level(): CardMatchLevel | undefined {
		return this._level;
	}

	public get isActive(): boolean {
		return this._state === ECardMatchState.PLAYER_INPUT;
	}

	/** 폭탄 셔플 중에는 입력을 받지 않는다 - §4 */
	public get isInputLocked(): boolean {
		return this._board?.isInputLocked ?? false;
	}

	public getRemainingTimeSeconds(): number {
		return Math.max(0, this._remainingSeconds);
	}

	public getRoundProgress(): CardMatchRoundProgress {
		return {
			current: this._roundIndex + 1,
			total: this._quest?.roundCount ?? 0,
			cleared: this._roundsCleared,
		};
	}

	/** 아직 맞추지 못한 오브젝트 타일 수 */
	public getRemainingObjectTileCount(): number {
		return this._board?.getRemainingObjectTileCount() ?? 0;
	}

	//#endregion

	constructor(events: CardMatchEvents, tables: CardMatchTables, generator: CardMatchLevelGenerator, options: CardMatchSessionOptions = {}) {
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
			console.warn(`[CardMatchSession] Unknown questId: ${questId}`);
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
			console.warn(`[CardMatchSession] No quest for difficulty ${difficulty}`);
			return false;
		}
		return this.startQuest(quest.questId);
	}

	public startRound(): boolean {
		const quest = this._quest;
		if (quest === undefined) {
			return false;
		}

		const random = this.createRandom();
		const level = this._generator.generate({
			puzzleId: `${quest.questId}_R${this._roundIndex}`,
			difficulty: quest.difficulty,
			seed: this._seed === undefined ? undefined : this._seed + this._roundIndex,
		});
		if (level === undefined) {
			console.warn(`[CardMatchSession] Failed to load a level for quest ${quest.questId} round ${this._roundIndex}`);
			// 결과 이벤트(QUEST_FAILED/GAME_END) 없이 멈추면 UI 가 영원히 대기하므로 실패로 처리한다
			this.fail();
			return false;
		}

		this._level = level;
		this._board = CardMatchBoard.fromLevel(level, random);

		if (this._isTimeLimitPerRound) {
			this._remainingSeconds = quest.timeLimitSeconds > 0 ? quest.timeLimitSeconds : DEFAULT_TIME_LIMIT_SECONDS;
			this._lastPublishedSecond = -1;
		}

		this.setState(ECardMatchState.ROUND_INTRO);
		this._events.LEVEL_LOADED.publish(level);
		this._events.ROUND_START.publish(this._roundIndex);
		this.publishRoundProgress();
		this.publishRemainingTime(true);

		this.setState(ECardMatchState.PLAYER_INPUT);
		return true;
	}

	/**
	 * 매 프레임 호출.
	 * 폭탄 셔플 중에는 **제한 시간이 흐르지 않는다** (§4).
	 */
	public update(deltaSeconds: number): void {
		if (this.isActive === false) {
			return;
		}

		const board = this._board;
		if (board === undefined) {
			return;
		}

		const progressed = board.update(deltaSeconds);
		if (progressed.hiddenTileIndexes.length > 0) {
			this._events.TILES_HIDDEN.publish(progressed.hiddenTileIndexes);
		}
		if (progressed.didFinishBombShuffle) {
			this._events.BOMB_SHUFFLE_FINISHED.publish();
		}

		// §4 - 폭탄이 활성화되면 랜덤 배치가 끝날 때까지 제한 시간은 일시 정지된다
		if (board.isTimerPaused) {
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
		this.setState(ECardMatchState.PAUSED);
		this._events.GAME_PAUSE.publish();
	}

	public resume(): void {
		if (this._state !== ECardMatchState.PAUSED) {
			return;
		}
		this.setState(this._stateBeforePause);
		this._events.GAME_RESUME.publish();
	}

	public abort(): void {
		this.unloadLevel();
		this.setState(ECardMatchState.IDLE);
	}

	//#endregion

	//#region Input

	/** 포탈 타일을 활성화한다 - §3 */
	public revealTile(index: number): RevealResult | undefined {
		if (this.isActive === false || this._board === undefined) {
			return undefined;
		}

		const result = this._board.reveal(index);
		this._events.TILE_REVEALED.publish(result);

		switch (result.outcome) {
			case ERevealOutcome.REJECTED:
				this._events.REVEAL_REJECTED.publish(result.rejection);
				return result;

			case ERevealOutcome.MATCHED:
				this._events.TILES_MATCHED.publish(result.matchedTileIndexes);
				break;

			case ERevealOutcome.MISMATCHED:
				this._events.TILES_MISMATCHED.publish(result.mismatchedTileIndexes);
				break;

			case ERevealOutcome.BOMB:
				// §3.3 / §4 - 셔플 시작. 이 동안 입력과 제한 시간이 멈춘다
				this._events.BOMB_TRIGGERED.publish({
					tileIndex: result.tileIndex,
					shuffledTileIndexes: result.shuffledTileIndexes,
				});
				break;

			default:
				break;
		}

		this.checkClear();
		return result;
	}

	/** 행/열로 타일을 활성화한다 (어댑터 편의용) */
	public revealTileAt(row: number, col: number): RevealResult | undefined {
		const tile = this._board?.getTileAt(row, col);
		if (tile === undefined) {
			return undefined;
		}
		return this.revealTile(tile.index);
	}

	/**
	 * 리셋 버튼 - §1 / §9.5.
	 * "카드 맞추기 퍼즐 중에는 리셋을 할 수 없다. 리셋 버튼을 눌러도 상호작용되지 않는다."
	 * 버튼은 UI 에 남기되 아무 일도 하지 않고 이벤트만 알린다.
	 */
	public requestReset(): void {
		this._events.RESET_IGNORED.publish();
	}

	//#endregion

	//#region Internal

	private createRandom(): RandomSource {
		if (this._seed === undefined) {
			return Math.random;
		}
		return createSeededRandom(this._seed + this._roundIndex * 7919);
	}

	private unloadLevel(): void {
		if (this._level !== undefined) {
			this._events.LEVEL_UNLOADED.publish();
		}
		this._level = undefined;
		this._board = undefined;
	}

	/** 클리어 판정 - §2 / §9.6 (폭탄이 아닌 모든 타일이 완료) */
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
		this._board?.flushBombShuffle();
		this.setState(ECardMatchState.ROUND_CLEAR);
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
		this.setState(ECardMatchState.QUEST_CLEAR);
		const results = this.buildResultData(ECardMatchResult.WIN);
		this._events.QUEST_CLEAR.publish(results);
		this._events.GAME_END.publish(results);
	}

	private fail(): void {
		this.setState(ECardMatchState.GAME_OVER);
		const results = this.buildResultData(ECardMatchResult.LOSE);
		this._events.QUEST_FAILED.publish(results);
		this._events.GAME_END.publish(results);
	}

	private buildResultData(result: ECardMatchResult): CardMatchResultData {
		return {
			result: result,
			roundsCleared: this._roundsCleared,
			roundCount: this._quest?.roundCount ?? 0,
			remainingTimeSeconds: this.getRemainingTimeSeconds(),
			remainingObjectTileCount: this.getRemainingObjectTileCount(),
		};
	}

	private setState(state: ECardMatchState): void {
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
