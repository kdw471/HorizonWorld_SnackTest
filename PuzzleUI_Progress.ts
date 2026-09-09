/**
 * Puzzle UI Progress - 퍼즐별 "마지막으로 클리어한 레벨" 을 기억하는 순수 계층
 *
 * 메인 UI 의 **Continue** 버튼이 이 값 하나로 결정된다.
 *
 *   클리어한 레벨이 없다  -> Continue 잠김, Start 만 가능
 *   3레벨까지 클리어했다  -> Continue 는 4레벨부터
 *   마지막 레벨까지 깼다  -> Continue 는 마지막 레벨을 다시 (더 갈 곳이 없다)
 *
 * ## 레벨이란
 *
 * **레벨 하나 = 퀘스트 라운드 하나 = 기획 판(field) 하나.**
 * 난이도 오름차순으로 각 난이도의 판을 순서대로 이어 붙인 것이 그 퍼즐의 레벨 목록이다.
 * (레이저 난이도 1이 12판이면 L1~L12 가 난이도 1, L13 부터 난이도 2)
 *
 * ## 저장소
 *
 * `IPuzzleProgressStorage` 뒤로 감춰 두었다. 기본은 메모리이고,
 * Horizon 영구 변수에 얹는 구현은 `PuzzleUI_PersistentProgress.ts` 에 있다.
 * 영구 변수가 준비되지 않은 월드에서도 그 세션 안에서는 Continue 가 동작한다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { EPuzzleId } from 'PuzzleUI_Definitions';

//#region Storage

/** 퍼즐 id -> 마지막으로 클리어한 레벨 번호 (1-based). 없으면 키가 없다 */
export type PuzzleProgressSnapshot = { [puzzleId: string]: number };

/**
 * 진행도를 실제로 담아 두는 곳. 구현은 둘이다.
 *   - `MemoryProgressStorage` : 이 세션 동안만 (기본값, 어디서나 동작)
 *   - `HorizonProgressStorage`: 플레이어 영구 변수 (`PuzzleUI_PersistentProgress.ts`)
 */
export interface IPuzzleProgressStorage {
	load(): PuzzleProgressSnapshot;
	save(snapshot: PuzzleProgressSnapshot): void;
}

/** 기본 저장소. 월드를 나가면 사라진다 */
export class MemoryProgressStorage implements IPuzzleProgressStorage {
	private _snapshot: PuzzleProgressSnapshot = {};

	public load(): PuzzleProgressSnapshot {
		return cloneSnapshot(this._snapshot);
	}

	public save(snapshot: PuzzleProgressSnapshot): void {
		this._snapshot = cloneSnapshot(snapshot);
	}
}

export function cloneSnapshot(source: PuzzleProgressSnapshot): PuzzleProgressSnapshot {
	const copy: PuzzleProgressSnapshot = {};
	for (const key in source) {
		const value = source[key];
		if (typeof value === 'number' && isFinite(value) && value > 0) {
			copy[key] = Math.floor(value);
		}
	}
	return copy;
}

/**
 * 저장된 문자열을 스냅샷으로 되돌린다. 깨진 값은 통째로 버리고 빈 진행도로 시작한다.
 * (영구 변수는 사람이 에디터에서 지우거나 형식이 바뀔 수 있으므로 절대 던지지 않는다)
 */
export function parseProgressSnapshot(raw: string | undefined | null): PuzzleProgressSnapshot {
	if (raw === undefined || raw === null || raw === '') {
		return {};
	}
	try {
		const parsed = JSON.parse(raw);
		if (parsed === null || typeof parsed !== 'object') {
			return {};
		}
		return cloneSnapshot(parsed as PuzzleProgressSnapshot);
	}
	catch (error) {
		console.warn(`[PuzzleProgress] Stored progress is not readable and was discarded: ${error}`);
		return {};
	}
}

export function stringifyProgressSnapshot(snapshot: PuzzleProgressSnapshot): string {
	return JSON.stringify(cloneSnapshot(snapshot));
}

//#endregion

//#region Tracker

/**
 * 진행도 조회·기록의 창구. 메인 UI 모델이 이것 하나만 들고 있으면 된다.
 *
 * 저장소 읽기는 생성자에서 한 번만 하고 이후에는 메모리 사본을 쓴다.
 * (영구 변수 읽기는 브리지를 건너므로 버튼을 그릴 때마다 부를 것이 못 된다)
 */
export class PuzzleProgressTracker {
	private readonly _storage: IPuzzleProgressStorage;
	private _snapshot: PuzzleProgressSnapshot;

	constructor(storage: IPuzzleProgressStorage = new MemoryProgressStorage()) {
		this._storage = storage;
		this._snapshot = cloneSnapshot(storage.load());
	}

	/** 마지막으로 클리어한 레벨 번호. 한 번도 못 깼으면 0 */
	public getClearedLevel(puzzleId: EPuzzleId): number {
		const value = this._snapshot[puzzleId as string];
		return typeof value === 'number' && value > 0 ? value : 0;
	}

	public hasProgress(puzzleId: EPuzzleId): boolean {
		return this.getClearedLevel(puzzleId) > 0;
	}

	/**
	 * Continue 가 시작할 레벨.
	 *
	 * 마지막 레벨까지 다 깬 경우에는 그 마지막 레벨을 돌려준다 - 버튼을 눌렀는데
	 * 아무 일도 일어나지 않는 것보다 낫고, 진행도가 뒤로 가지도 않는다.
	 */
	public getContinueLevel(puzzleId: EPuzzleId, levelCount: number): number {
		if (levelCount <= 0) {
			return 1;
		}
		const cleared = this.getClearedLevel(puzzleId);
		if (cleared <= 0) {
			return 1;
		}
		return Math.min(cleared + 1, levelCount);
	}

	/** 이 퍼즐을 전부 깼는지 */
	public isCompleted(puzzleId: EPuzzleId, levelCount: number): boolean {
		return levelCount > 0 && this.getClearedLevel(puzzleId) >= levelCount;
	}

	/**
	 * 레벨 하나를 클리어했다고 기록한다. 이미 더 앞서 있으면 뒤로 물리지 않는다.
	 * 값이 실제로 바뀐 경우에만 저장소에 쓴다 (영구 변수 쓰기를 아낀다).
	 */
	public recordCleared(puzzleId: EPuzzleId, level: number): boolean {
		if (level <= 0) {
			return false;
		}
		const key = puzzleId as string;
		const previous = this.getClearedLevel(puzzleId);
		if (level <= previous) {
			return false;
		}
		this._snapshot[key] = Math.floor(level);
		this._storage.save(this._snapshot);
		return true;
	}

	/** 진행도 초기화. 퍼즐을 지정하면 그 퍼즐만 */
	public reset(puzzleId?: EPuzzleId): void {
		if (puzzleId === undefined) {
			this._snapshot = {};
		}
		else {
			delete this._snapshot[puzzleId as string];
		}
		this._storage.save(this._snapshot);
	}

	/** 테스트·디버그용 사본 */
	public getSnapshot(): PuzzleProgressSnapshot {
		return cloneSnapshot(this._snapshot);
	}
}

//#endregion
