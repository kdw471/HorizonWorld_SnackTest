/**
 * Color Fill Game Events - 색 채우기 퍼즐의 이벤트 허브 (PUZ_04)
 *
 * 연출/UI/입력 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).
 */

import {
	ColorFillLevel,
	ColorFillResultData,
	ColorFillRoundProgress,
	EColorFillState,
	TouchResult,
} from 'ColorFill_Definitions';
import { EventPublisher } from 'Utility_Events';

export class ColorFillEvents {
	//#region Quest / Round lifecycle

	public readonly QUEST_START = new EventPublisher<string>();
	public readonly QUEST_CLEAR = new EventPublisher<ColorFillResultData>();
	public readonly QUEST_FAILED = new EventPublisher<ColorFillResultData>();
	public readonly GAME_END = new EventPublisher<ColorFillResultData>();

	public readonly ROUND_START = new EventPublisher<number>();
	public readonly ROUND_CLEAR = new EventPublisher<number>();
	/** 라운드 슬롯 표시 갱신 - PUZ_00 §2.1 */
	public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<ColorFillRoundProgress>();

	//#endregion

	//#region Dial

	public readonly LEVEL_LOADED = new EventPublisher<ColorFillLevel>();
	public readonly LEVEL_UNLOADED = new EventPublisher<void>();

	/** 터치가 처리되었다 (무시된 경우 포함) */
	public readonly TOUCHED = new EventPublisher<TouchResult>();

	/**
	 * 오염 덩어리가 정화되었다 - §5.
	 * 페이로드는 정화된 칸 index 목록이다. 연출은 MainColor 를 0 -> 1 로 올리면 된다.
	 */
	public readonly SLOTS_PURIFIED = new EventPublisher<number[]>();

	/** 방향 반전이 예약되었다 (딜레이 시작) - §6 */
	public readonly REVERSE_SCHEDULED = new EventPublisher<void>();
	/** 방향 반전이 실제로 적용되었다. 페이로드는 새 방향(+1 / -1) */
	public readonly DIRECTION_CHANGED = new EventPublisher<number>();

	/** 바늘이 다른 칸으로 넘어갔다. 페이로드는 새 칸 index */
	public readonly NEEDLE_SLOT_CHANGED = new EventPublisher<number>();

	//#endregion

	//#region Timer / State

	public readonly TIME_CHANGED = new EventPublisher<number>();
	public readonly STATE_CHANGED = new EventPublisher<EColorFillState>();

	public readonly GAME_PAUSE = new EventPublisher<void>();
	public readonly GAME_RESUME = new EventPublisher<void>();

	//#endregion
}
