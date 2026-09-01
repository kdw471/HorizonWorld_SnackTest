/**
 * Switch Puzzle Game Events - 스위치 퍼즐의 이벤트 허브 (PUZ_08)
 *
 * 연출/UI/입력 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).
 */

import {
	ESwitchPuzzleState,
	ESwitchRejection,
	SwitchLevel,
	SwitchPressResult,
	SwitchPuzzleResultData,
	SwitchRoundProgress,
} from 'Switch_Definitions';
import { EventPublisher } from 'Utility_Events';

export class SwitchPuzzleEvents {
	//#region Quest / Round lifecycle

	public readonly QUEST_START = new EventPublisher<string>();
	public readonly QUEST_CLEAR = new EventPublisher<SwitchPuzzleResultData>();
	public readonly QUEST_FAILED = new EventPublisher<SwitchPuzzleResultData>();
	public readonly GAME_END = new EventPublisher<SwitchPuzzleResultData>();

	public readonly ROUND_START = new EventPublisher<number>();
	public readonly ROUND_CLEAR = new EventPublisher<number>();
	/** 라운드 슬롯 표시 갱신 - PUZ_00 §2.1 */
	public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<SwitchRoundProgress>();

	//#endregion

	//#region Board

	public readonly LEVEL_LOADED = new EventPublisher<SwitchLevel>();
	public readonly LEVEL_UNLOADED = new EventPublisher<void>();

	/**
	 * 스위치 영역 마스크가 바뀌었다 (라운드마다 다르다 - §6).
	 * 연출은 해킹 패널 우측의 3×3 미니 UI 에 녹색(영향 있음)/빨간색(영향 없음)으로 표시한다 (§9.5).
	 */
	public readonly MASK_CHANGED = new EventPublisher<number[]>();

	/** 키 캡이 눌렸다 - §7 0.0초, 중앙 키 캡의 눌림 연출을 재생한다 */
	public readonly KEY_PRESSED = new EventPublisher<SwitchPressResult>();
	/** §7 0.2초 - 스위치 영역의 (영향받는) 키 캡 연출을 재생한다 */
	public readonly AREA_TOGGLED = new EventPublisher<SwitchPressResult>();
	/** §7 0.4초 - 모든 연출이 끝났다. 이 시점에 클리어 판정을 한다 (§9.3) */
	public readonly PRESS_SEQUENCE_FINISHED = new EventPublisher<void>();
	/** 입력이 거절되었다 (사유 포함) */
	public readonly PRESS_REJECTED = new EventPublisher<ESwitchRejection>();

	/** 아직 눌리지 않은 키 캡 수가 바뀌었다 - 진행도 표시용 */
	public readonly UNPRESSED_COUNT_CHANGED = new EventPublisher<number>();

	/** 완성되었다 - 모든 키 캡이 녹색이 되었다 (§1 / §2) */
	public readonly PUZZLE_COMPLETED = new EventPublisher<void>();

	//#endregion

	//#region Timer / State

	public readonly TIME_CHANGED = new EventPublisher<number>();
	public readonly STATE_CHANGED = new EventPublisher<ESwitchPuzzleState>();

	public readonly GAME_PAUSE = new EventPublisher<void>();
	public readonly GAME_RESUME = new EventPublisher<void>();

	//#endregion
}
