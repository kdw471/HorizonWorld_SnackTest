/**
 * Color Sort Game Events - 정렬 퍼즐의 이벤트 허브 (PUZ_03)
 *
 * 연출/UI/입력 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).
 */

import {
	ColorSortLevel,
	ColorSortMove,
	ColorSortResultData,
	ColorSortRoundProgress,
	EColorSortState,
	EMoveRejection,
} from 'ColorSort_Definitions';
import { EventPublisher } from 'Utility_Events';

export class ColorSortEvents {
	//#region Quest / Round lifecycle

	public readonly QUEST_START = new EventPublisher<string>();
	public readonly QUEST_CLEAR = new EventPublisher<ColorSortResultData>();
	public readonly QUEST_FAILED = new EventPublisher<ColorSortResultData>();
	public readonly GAME_END = new EventPublisher<ColorSortResultData>();

	public readonly ROUND_START = new EventPublisher<number>();
	public readonly ROUND_CLEAR = new EventPublisher<number>();
	/** 라운드 슬롯 표시 갱신 - PUZ_00 §2.1 */
	public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<ColorSortRoundProgress>();

	//#endregion

	//#region Board

	public readonly LEVEL_LOADED = new EventPublisher<ColorSortLevel>();
	public readonly LEVEL_UNLOADED = new EventPublisher<void>();

	/** 건전지 뭉치가 옮겨졌다 */
	public readonly BATTERIES_MOVED = new EventPublisher<ColorSortMove>();
	/** 놓을 수 없는 곳에 놓아 이동이 거절되었다 */
	public readonly MOVE_REJECTED = new EventPublisher<EMoveRejection>();

	/** 블랙 건전지가 공개되었다 - §7 */
	public readonly BATTERY_REVEALED = new EventPublisher<string[]>();
	/** 케이스가 같은 색으로 가득 차 닫혔다 - §4 */
	public readonly CASE_CLOSED = new EventPublisher<number>();

	/** 영역 밖 드랍으로 리스폰 대기에 들어갔다 (케이스 잠금) - §8 */
	public readonly RESPAWN_STARTED = new EventPublisher<number>();
	/** 리스폰이 끝나 케이스 잠금이 풀렸다 - §8 */
	public readonly RESPAWN_FINISHED = new EventPublisher<number>();

	/** 이동 가능한 건전지가 없어 데드락이 되었다 - §2 */
	public readonly DEADLOCK_DETECTED = new EventPublisher<void>();

	//#endregion

	//#region Timer / State

	public readonly TIME_CHANGED = new EventPublisher<number>();
	public readonly STATE_CHANGED = new EventPublisher<EColorSortState>();

	public readonly GAME_PAUSE = new EventPublisher<void>();
	public readonly GAME_RESUME = new EventPublisher<void>();

	//#endregion
}
