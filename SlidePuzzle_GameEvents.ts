/**
 * Slide Puzzle Game Events - 슬라이드 퍼즐의 이벤트 허브 (PUZ_07)
 *
 * 연출/UI/입력 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).
 */

import {
	ESlidePuzzleState,
	ESlideRejection,
	SlideMoveResult,
	SlidePuzzleLevel,
	SlidePuzzleResultData,
	SlidePuzzleRoundProgress,
} from 'SlidePuzzle_Definitions';
import { EventPublisher } from 'Utility_Events';

export class SlidePuzzleEvents {
	//#region Quest / Round lifecycle

	public readonly QUEST_START = new EventPublisher<string>();
	public readonly QUEST_CLEAR = new EventPublisher<SlidePuzzleResultData>();
	public readonly QUEST_FAILED = new EventPublisher<SlidePuzzleResultData>();
	public readonly GAME_END = new EventPublisher<SlidePuzzleResultData>();

	public readonly ROUND_START = new EventPublisher<number>();
	public readonly ROUND_CLEAR = new EventPublisher<number>();
	/** 라운드 슬롯 표시 갱신 - PUZ_00 §2.1 */
	public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<SlidePuzzleRoundProgress>();

	//#endregion

	//#region Board

	public readonly LEVEL_LOADED = new EventPublisher<SlidePuzzleLevel>();
	public readonly LEVEL_UNLOADED = new EventPublisher<void>();

	/** 조각이 미끄러지기 시작했다 - §6, S_PieceMove_SFX 를 재생한다 */
	public readonly PIECE_MOVE_STARTED = new EventPublisher<SlideMoveResult>();
	/** 0.25초 이동 연출이 끝났다 - 이 시점에 완성 판정을 한다 (§12.6) */
	public readonly PIECE_MOVE_FINISHED = new EventPublisher<void>();
	/** 입력이 거절되었다 (사유 포함) */
	public readonly MOVE_REJECTED = new EventPublisher<ESlideRejection>();

	/**
	 * 지금 누를 수 있는 조각 목록이 바뀌었다 - §5.
	 * 연출은 이 위치들의 모서리에 Emissive(#FF5C41)를 켜고 S_PieceHover_SFX 를 재생한다.
	 */
	public readonly MOVABLE_POSITIONS_CHANGED = new EventPublisher<number[]>();

	/**
	 * 완성되었다 - §9.
	 * 빈 조각을 표시하고 간격을 0으로 좁힌 뒤, 원본 이미지를 1초간 보여 주고
	 * S_PUZ07_Success_SFX 를 재생한다.
	 */
	public readonly PUZZLE_COMPLETED = new EventPublisher<string>();

	//#endregion

	//#region Timer / State

	public readonly TIME_CHANGED = new EventPublisher<number>();
	public readonly STATE_CHANGED = new EventPublisher<ESlidePuzzleState>();

	public readonly GAME_PAUSE = new EventPublisher<void>();
	public readonly GAME_RESUME = new EventPublisher<void>();

	//#endregion
}
