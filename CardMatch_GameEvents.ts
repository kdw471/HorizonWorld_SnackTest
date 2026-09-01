/**
 * Card Match Game Events - 카드 맞추기 퍼즐의 이벤트 허브 (PUZ_06)
 *
 * 연출/UI/입력 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).
 */

import {
	CardMatchLevel,
	CardMatchResultData,
	CardMatchRoundProgress,
	ECardMatchState,
	ERevealRejection,
	RevealResult,
} from 'CardMatch_Definitions';
import { EventPublisher } from 'Utility_Events';

export class CardMatchEvents {
	//#region Quest / Round lifecycle

	public readonly QUEST_START = new EventPublisher<string>();
	public readonly QUEST_CLEAR = new EventPublisher<CardMatchResultData>();
	public readonly QUEST_FAILED = new EventPublisher<CardMatchResultData>();
	public readonly GAME_END = new EventPublisher<CardMatchResultData>();

	public readonly ROUND_START = new EventPublisher<number>();
	public readonly ROUND_CLEAR = new EventPublisher<number>();
	/** 라운드 슬롯 표시 갱신 - PUZ_00 §2.1 */
	public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<CardMatchRoundProgress>();

	//#endregion

	//#region Board

	public readonly LEVEL_LOADED = new EventPublisher<CardMatchLevel>();
	public readonly LEVEL_UNLOADED = new EventPublisher<void>();

	/** 포탈 타일이 활성화되었다 (결과 포함) */
	public readonly TILE_REVEALED = new EventPublisher<RevealResult>();
	/** 입력이 거절되었다 (사유 포함) */
	public readonly REVEAL_REJECTED = new EventPublisher<ERevealRejection>();

	/** 짝이 맞아 타일이 완료되었다 - §6 파란색 -> 녹색 */
	public readonly TILES_MATCHED = new EventPublisher<number[]>();
	/** 짝이 틀려 되돌아갈 타일들 - §6 파란색 -> 검정색 */
	public readonly TILES_MISMATCHED = new EventPublisher<number[]>();
	/** 되돌아간 타일들이 다시 뒷면이 되었다 */
	public readonly TILES_HIDDEN = new EventPublisher<number[]>();

	/** 폭탄이 나왔다 - 셔플 시작. 이 동안 입력과 제한 시간이 멈춘다 (§4) */
	public readonly BOMB_TRIGGERED = new EventPublisher<{ tileIndex: number, shuffledTileIndexes: number[] }>();
	/** 폭탄 셔플 연출이 끝나 입력과 제한 시간이 재개되었다 */
	public readonly BOMB_SHUFFLE_FINISHED = new EventPublisher<void>();

	/** 리셋 버튼이 눌렸지만 이 퍼즐에서는 동작하지 않는다 - §1 / §9.5 */
	public readonly RESET_IGNORED = new EventPublisher<void>();

	//#endregion

	//#region Timer / State

	public readonly TIME_CHANGED = new EventPublisher<number>();
	public readonly STATE_CHANGED = new EventPublisher<ECardMatchState>();

	public readonly GAME_PAUSE = new EventPublisher<void>();
	public readonly GAME_RESUME = new EventPublisher<void>();

	//#endregion
}
