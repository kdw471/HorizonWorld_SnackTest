/**
 * Color Fill Session - 라운드 / 제한시간 / 승패를 묶는 순수 상태 머신 (PUZ_04)
 *
 * PUZ_00 §7.4 가 요구하는 "실패/성공 판정, 남은 시간, 라운드 진행도를 외부에서 조회 가능한 API".
 *
 * 승패 - §2
 *   클리어: 제한시간 내에 모든 오염 영역을 정화
 *   실패:   제한시간 내에 정화하지 못함
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { ColorFillDial } from 'ColorFill_Dial';
import { ColorFillEvents } from 'ColorFill_GameEvents';
import { ColorFillInputController } from 'ColorFill_InputController';
import { ColorFillLevelGenerator } from 'ColorFill_LevelGenerator';
import { ColorFillMainTableEntry, ColorFillTables } from 'ColorFill_DataTables';
import {
	ColorFillLevel,
	ColorFillResultData,
	ColorFillRoundProgress,
	EColorFillResult,
	EColorFillState,
	ETouchOutcome,
	TouchResult,
	createSeededRandom,
	pickRandom,
} from 'ColorFill_Definitions';

export type ColorFillSessionOptions = {
	/** 제한 시간을 라운드마다 리셋할지(기본 true) 퀘스트 전체에 한 번만 줄지 */
	isTimeLimitPerRound?: boolean,
	seed?: number,
	/** 방향 전환 딜레이 동안 입력을 잠글지 - §8.3 */
	isInputLockedDuringReverse?: boolean,
}

const DEFAULT_TIME_LIMIT_SECONDS = 30;

export class ColorFillSession {
	private readonly _events: ColorFillEvents;
	private readonly _tables: ColorFillTables;
	private readonly _generator: ColorFillLevelGenerator;
	private readonly _isTimeLimitPerRound: boolean;
	private readonly _seed: number | undefined;
	private readonly _isInputLockedDuringReverse: boolean | undefined;

	private _state: EColorFillState = EColorFillState.IDLE;
	private _stateBeforePause: EColorFillState = EColorFillState.IDLE;

	private _quest: ColorFillMainTableEntry | undefined = undefined;
	private _level: ColorFillLevel | undefined = undefined;
	private _dial: ColorFillDial | undefined = undefined;
	private _input: ColorFillInputController | undefined = undefined;

	private _roundIndex: number = 0;
	private _roundsCleared: number = 0;
	private _remainingSeconds: number = 0;
	private _lastPublishedSecond: number = -1;

	/** 직전 프레임의 칸/방향 - 변화를 이벤트로 알리기 위해 기억한다 */
	private _lastSlotIndex: number = -1;
	private _lastDirection: number = 0;

	//#region External query API (PUZ_00 §7.4)

	public get state(): EColorFillState {
		return this._state;
	}

	public get dial(): ColorFillDial | undefined {
		return this._dial;
	}

	public get level(): ColorFillLevel | undefined {
		return this._level;
	}

	public get isActive(): boolean {
		return this._state === EColorFillState.PLAYER_INPUT;
	}

	public getRemainingTimeSeconds(): number {
		return Math.max(0, this._remainingSeconds);
	}

	public getRoundProgress(): ColorFillRoundProgress {
		return {
			current: this._roundIndex + 1,
			total: this._quest?.roundCount ?? 0,
			cleared: this._roundsCleared,
		};
	}

	/** 남은 오염 칸 수 - UI 진행도 표시용 */
	public getRemainingContaminatedCount(): number {
		return this._dial?.getContaminatedCount() ?? 0;
	}

	//#endregion

	constructor(events: ColorFillEvents, tables: ColorFillTables, generator: ColorFillLevelGenerator, options: ColorFillSessionOptions = {}) {
		this._events = events;
		this._tables = tables;
		this._generator = generator;
		this._isTimeLimitPerRound = options.isTimeLimitPerRound ?? true;
		this._seed = options.seed;
		this._isInputLockedDuringReverse = options.isInputLockedDuringReverse;
	}

	//#region Quest / round lifecycle

	public startQuest(questId: string): boolean {
		const quest = this._tables.getQuest(questId);
		if (quest === undefined) {
			console.warn(`[ColorFillSession] Unknown questId: ${questId}`);
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
			console.warn(`[ColorFillSession] No quest for difficulty ${difficulty}`);
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
			console.warn(`[ColorFillSession] Failed to load a level for quest ${quest.questId} round ${this._roundIndex}`);
			// 결과 이벤트(QUEST_FAILED/GAME_END) 없이 멈추면 UI 가 영원히 대기하므로 실패로 처리한다
			this.fail();
			return false;
		}

		this._level = level;
		this._dial = ColorFillDial.fromLevel(level, {
			isInputLockedDuringReverse: this._isInputLockedDuringReverse,
		});
		this._input = new ColorFillInputController(this._dial);
		this._lastSlotIndex = this._dial.getCurrentSlotIndex();
		this._lastDirection = this._dial.needle.direction;

		if (this._isTimeLimitPerRound) {
			this._remainingSeconds = quest.timeLimitSeconds > 0 ? quest.timeLimitSeconds : DEFAULT_TIME_LIMIT_SECONDS;
			this._lastPublishedSecond = -1;
		}

		this.setState(EColorFillState.ROUND_INTRO);
		this._events.LEVEL_LOADED.publish(level);
		this._events.ROUND_START.publish(this._roundIndex);
		this.publishRoundProgress();
		this.publishRemainingTime(true);

		this.setState(EColorFillState.PLAYER_INPUT);
		return true;
	}

	/** 매 프레임 호출. 바늘 회전 / 방향 전환 딜레이 / 제한 시간을 함께 진행시킨다 */
	public update(deltaSeconds: number): void {
		if (this.isActive === false) {
			return;
		}

		const dial = this._dial;
		if (dial === undefined) {
			return;
		}

		this._input?.update(deltaSeconds);
		dial.update(deltaSeconds);

		// 칸 변화 / 방향 변화 알림
		const slotIndex = dial.getCurrentSlotIndex();
		if (slotIndex !== this._lastSlotIndex) {
			this._lastSlotIndex = slotIndex;
			this._events.NEEDLE_SLOT_CHANGED.publish(slotIndex);
		}
		if (dial.needle.direction !== this._lastDirection) {
			this._lastDirection = dial.needle.direction;
			this._events.DIRECTION_CHANGED.publish(dial.needle.direction);
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
		this.setState(EColorFillState.PAUSED);
		this._events.GAME_PAUSE.publish();
	}

	public resume(): void {
		if (this._state !== EColorFillState.PAUSED) {
			return;
		}
		this.setState(this._stateBeforePause);
		this._events.GAME_RESUME.publish();
	}

	public abort(): void {
		this.unloadLevel();
		this.setState(EColorFillState.IDLE);
	}

	//#endregion

	//#region Input (§6 터치)

	/**
	 * 터치 한 번 - §6.
	 * 방향 반전은 언제나 예약되고, 바늘이 오염 칸 위면 연속 덩어리가 함께 정화된다.
	 * 모든 오염이 사라지면 즉시 클리어한다 (§8.4).
	 */
	public touch(): TouchResult | undefined {
		if (this.isActive === false || this._input === undefined || this._dial === undefined) {
			return undefined;
		}

		const result = this._input.touch();
		this._events.TOUCHED.publish(result);

		if (result.outcome === ETouchOutcome.IGNORED) {
			return result;
		}

		if (result.purifiedSlotIndexes.length > 0) {
			this._events.SLOTS_PURIFIED.publish(result.purifiedSlotIndexes);
		}
		if (result.didScheduleReverse) {
			this._events.REVERSE_SCHEDULED.publish();
			// 딜레이가 0이면 즉시 반전되므로 여기서 바로 알린다
			if (this._dial.needle.direction !== this._lastDirection) {
				this._lastDirection = this._dial.needle.direction;
				this._events.DIRECTION_CHANGED.publish(this._dial.needle.direction);
			}
		}

		if (this._dial.isSolved()) {
			this.clearRound();
		}
		return result;
	}

	//#endregion

	//#region Internal

	private loadLevel(quest: ColorFillMainTableEntry): ColorFillLevel | undefined {
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
		this._dial = undefined;
		this._input = undefined;
	}

	private clearRound(): void {
		this._roundsCleared++;
		this.setState(EColorFillState.ROUND_CLEAR);
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
		this.setState(EColorFillState.QUEST_CLEAR);
		const results = this.buildResultData(EColorFillResult.WIN);
		this._events.QUEST_CLEAR.publish(results);
		this._events.GAME_END.publish(results);
	}

	private fail(): void {
		this.setState(EColorFillState.GAME_OVER);
		const results = this.buildResultData(EColorFillResult.LOSE);
		this._events.QUEST_FAILED.publish(results);
		this._events.GAME_END.publish(results);
	}

	private buildResultData(result: EColorFillResult): ColorFillResultData {
		return {
			result: result,
			roundsCleared: this._roundsCleared,
			roundCount: this._quest?.roundCount ?? 0,
			remainingTimeSeconds: this.getRemainingTimeSeconds(),
			remainingContaminatedCount: this.getRemainingContaminatedCount(),
		};
	}

	private setState(state: EColorFillState): void {
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
