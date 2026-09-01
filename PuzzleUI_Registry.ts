/**
 * Puzzle UI Registry - 퍼즐 구동 핸들의 등록소 (메인 UI ↔ 각 퍼즐 CoreAPI 의 접점)
 *
 * 메인 UI 는 8개 퍼즐의 세션/이벤트 타입을 직접 알지 않는다. 대신 각 `*_CoreAPI` 가
 * 자기 세션을 **정규화된 핸들(IPuzzleGameHandle)** 로 감싸 여기 등록하고,
 * 메인 UI 는 핸들만 다룬다.
 *
 * 8개 퍼즐의 세션·이벤트 허브는 이미 같은 규약을 따르므로 (PUZ_00 §2.1 / §7.4 -
 * startQuestByDifficulty / pause / resume / abort / TIME_CHANGED / ROUND_PROGRESS_CHANGED /
 * QUEST_CLEAR / QUEST_FAILED / GAME_PAUSE / GAME_RESUME), 퍼즐별 어댑터 코드 없이
 * `createPuzzleHandle()` 팩토리 하나로 전부 감쌀 수 있다 (구조적 타이핑).
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 *
 * ## CoreAPI 쪽 등록 예 (Switch_CoreAPI.ts 참조)
 *
 *   PuzzleHubRegistry.instance.register(createPuzzleHandle(
 *       EPuzzleId.SWITCH,
 *       { startQuestByDifficulty: (d) => this.startQuestByDifficulty(d), ... },
 *       this.events,
 *       probePuzzleDifficulties((d) => this.tables.getQuestByDifficulty(d)),
 *   ));
 */

import { EventPublisher, Subscription } from 'Utility_Events';
import {
	EPuzzleId,
	PuzzleQuestResultSource,
	PuzzleUIQuestResult,
	PuzzleUIRoundProgress,
} from 'PuzzleUI_Definitions';

//#region Handle interface

/** 메인 UI 가 인게임 중 구독하는 정규화 이벤트 묶음 */
export type PuzzleQuestListener = {
	onTimeChanged: (seconds: number) => void,
	onRoundProgressChanged: (progress: PuzzleUIRoundProgress) => void,
	/** 퀘스트가 승패와 함께 끝났다 (클리어 또는 실패) */
	onQuestEnded: (result: PuzzleUIQuestResult) => void,
	onPaused: () => void,
	onResumed: () => void,
}

/** 메인 UI 가 퍼즐 하나를 조작하는 유일한 창구 */
export interface IPuzzleGameHandle {
	readonly puzzleId: EPuzzleId;
	/** 선택 가능한 난이도 목록 (오름차순, 비어 있지 않음) */
	getDifficulties(): number[];
	/** 퀘스트 시작. 실패하면 false (레벨 생성 실패 시 QUEST_FAILED 이벤트도 함께 나온다) */
	startQuestByDifficulty(difficulty: number): boolean;
	pause(): void;
	resume(): void;
	/** 퀘스트를 버리고 대기 상태로 되돌린다 (메뉴 복귀 시) */
	abort(): void;
	getRemainingTimeSeconds(): number;
	getRoundProgress(): PuzzleUIRoundProgress;
	/** 정규화 이벤트 구독. 반환된 구독들은 호출자가 보관했다가 해제한다 */
	subscribeQuestEvents(listener: PuzzleQuestListener): Subscription[];
}

//#endregion

//#region Structural types (각 퍼즐이 이미 갖춘 모양)

/** CoreAPI 가 넘기는 조작 메서드 묶음 - 보통 CoreAPI 자신의 메서드를 화살표로 감싼다 */
export type PuzzleSessionControls = {
	startQuestByDifficulty(difficulty: number): boolean,
	pause(): void,
	resume(): void,
	abort(): void,
	getRemainingTimeSeconds(): number,
	getRoundProgress(): PuzzleUIRoundProgress,
}

export type PuzzleEventSource<T> = {
	subscribe(func: (data: T) => void): Subscription,
}

/**
 * 8개 퍼즐의 `*_GameEvents.ts` 이벤트 허브가 전부 만족하는 부분 형태.
 * (QUEST_CLEAR/QUEST_FAILED 의 페이로드는 퍼즐마다 다르지만
 *  전부 PuzzleQuestResultSource 필드를 포함하므로 그 부분만 읽는다)
 */
export type PuzzleQuestEventSources = {
	TIME_CHANGED: PuzzleEventSource<number>,
	ROUND_PROGRESS_CHANGED: PuzzleEventSource<PuzzleUIRoundProgress>,
	QUEST_CLEAR: PuzzleEventSource<PuzzleQuestResultSource>,
	QUEST_FAILED: PuzzleEventSource<PuzzleQuestResultSource>,
	GAME_PAUSE: PuzzleEventSource<void>,
	GAME_RESUME: PuzzleEventSource<void>,
}

//#endregion

//#region Handle factory

/**
 * 세션 조작 + 이벤트 허브를 정규화 핸들로 감싼다.
 * 8개 퍼즐이 같은 규약을 따르므로 이 팩토리 하나면 된다 - 퍼즐별 어댑터를 만들지 않는다.
 */
export function createPuzzleHandle(
	puzzleId: EPuzzleId,
	controls: PuzzleSessionControls,
	events: PuzzleQuestEventSources,
	difficulties: number[],
): IPuzzleGameHandle {
	const sortedDifficulties = difficulties.slice().sort((left, right) => left - right);

	const buildResult = (source: PuzzleQuestResultSource, isWin: boolean): PuzzleUIQuestResult => {
		return {
			puzzleId: puzzleId,
			isWin: isWin,
			roundsCleared: source.roundsCleared,
			roundCount: source.roundCount,
			remainingTimeSeconds: source.remainingTimeSeconds,
		};
	};

	return {
		puzzleId: puzzleId,
		getDifficulties: () => sortedDifficulties.slice(),
		startQuestByDifficulty: (difficulty) => controls.startQuestByDifficulty(difficulty),
		pause: () => controls.pause(),
		resume: () => controls.resume(),
		abort: () => controls.abort(),
		getRemainingTimeSeconds: () => controls.getRemainingTimeSeconds(),
		getRoundProgress: () => controls.getRoundProgress(),
		subscribeQuestEvents: (listener) => {
			return [
				events.TIME_CHANGED.subscribe((seconds) => listener.onTimeChanged(seconds)),
				events.ROUND_PROGRESS_CHANGED.subscribe((progress) => listener.onRoundProgressChanged(progress)),
				events.QUEST_CLEAR.subscribe((source) => listener.onQuestEnded(buildResult(source, true))),
				events.QUEST_FAILED.subscribe((source) => listener.onQuestEnded(buildResult(source, false))),
				events.GAME_PAUSE.subscribe(() => listener.onPaused()),
				events.GAME_RESUME.subscribe(() => listener.onResumed()),
			];
		},
	};
}

/**
 * 난이도 테이블을 훑어 선택 가능한 난이도 목록을 만든다.
 * 8개 퍼즐의 `*_DataTables` 가 전부 `getQuestByDifficulty()` 를 노출하므로 그것을 넘기면 된다.
 */
export function probePuzzleDifficulties(
	getQuestByDifficulty: (difficulty: number) => unknown,
	maxProbe: number = 8,
): number[] {
	const difficulties: number[] = [];
	for (let difficulty = 1; difficulty <= maxProbe; difficulty++) {
		if (getQuestByDifficulty(difficulty) !== undefined) {
			difficulties.push(difficulty);
		}
	}
	return difficulties;
}

//#endregion

//#region Registry

/**
 * 퍼즐 핸들의 등록소. 로컬 클라이언트 런타임당 하나면 되므로 싱글턴을 제공하되,
 * 테스트에서는 `new PuzzleHubRegistry()` 로 독립 인스턴스를 만든다.
 */
export class PuzzleHubRegistry {
	private static _instance: PuzzleHubRegistry | undefined = undefined;

	public static get instance(): PuzzleHubRegistry {
		if (PuzzleHubRegistry._instance === undefined) {
			PuzzleHubRegistry._instance = new PuzzleHubRegistry();
		}
		return PuzzleHubRegistry._instance;
	}

	/** 새 핸들이 등록됐다 - 메인 UI 가 "준비 중" 표시를 걷어 내는 시점 */
	public readonly HANDLE_REGISTERED = new EventPublisher<IPuzzleGameHandle>();

	private readonly _handles: Map<EPuzzleId, IPuzzleGameHandle> = new Map();

	public register(handle: IPuzzleGameHandle): void {
		if (this._handles.has(handle.puzzleId)) {
			// 소유권 이전 등으로 CoreAPI 가 다시 시작되면 재등록이 올 수 있다. 최신 것으로 교체한다.
			console.warn(`[PuzzleHubRegistry] Replacing handle for ${handle.puzzleId} (re-registration).`);
		}
		this._handles.set(handle.puzzleId, handle);
		this.HANDLE_REGISTERED.publish(handle);
	}

	public getHandle(puzzleId: EPuzzleId): IPuzzleGameHandle | undefined {
		return this._handles.get(puzzleId);
	}

	public isRegistered(puzzleId: EPuzzleId): boolean {
		return this._handles.has(puzzleId);
	}

	public getRegisteredIds(): EPuzzleId[] {
		return Array.from(this._handles.keys());
	}
}

//#endregion
