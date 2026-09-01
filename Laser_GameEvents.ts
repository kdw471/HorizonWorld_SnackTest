/**
 * Laser Game Events - 레이저 해킹 퍼즐의 이벤트 허브 (PUZ_01)
 *
 * 연출/UI/입력 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).
 */

import {
	ELaserState,
	LaserLevel,
	LaserResultData,
	LaserRoundProgress,
	LaserTraceResult,
} from 'Laser_Definitions';
import { EventPublisher } from 'Utility_Events';

export class LaserEvents {
	//#region Quest / Round lifecycle

	public readonly QUEST_START = new EventPublisher<string>();
	public readonly QUEST_CLEAR = new EventPublisher<LaserResultData>();
	public readonly QUEST_FAILED = new EventPublisher<LaserResultData>();
	public readonly GAME_END = new EventPublisher<LaserResultData>();

	public readonly ROUND_START = new EventPublisher<number>();
	public readonly ROUND_CLEAR = new EventPublisher<number>();
	/** 라운드 슬롯 표시 갱신 - PUZ_00 §2.1 */
	public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<LaserRoundProgress>();

	//#endregion

	//#region Board

	public readonly LEVEL_LOADED = new EventPublisher<LaserLevel>();
	public readonly LEVEL_UNLOADED = new EventPublisher<void>();

	/** 크리스탈이 필드에 놓임 (crystalId, row, col 는 배치 로컬 좌표) */
	public readonly CRYSTAL_PLACED = new EventPublisher<{ crystalId: string, row: number, col: number }>();
	/** 크리스탈이 인벤토리로 회수됨 */
	public readonly CRYSTAL_RETURNED = new EventPublisher<string>();
	/** 배치가 거절됨 (칸이 막혔거나 영역 밖) */
	public readonly PLACEMENT_REJECTED = new EventPublisher<{ crystalId: string, reason: string }>();

	/**
	 * 배치가 바뀔 때마다 광선을 다시 계산해 알린다 - §8.2 "배치 변경 시마다 전체 광선을 즉시 재계산".
	 * 연출 계층은 이 이벤트만 보고 광선과 오브젝트 상태를 갱신하면 된다.
	 */
	public readonly BEAM_UPDATED = new EventPublisher<LaserTraceResult>();

	/** 해골에 광선이 닿아 모든 수신체가 Fault 가 됨 - §3 4.2.1 */
	public readonly SKULL_HIT = new EventPublisher<void>();

	//#endregion

	//#region Timer / State

	public readonly TIME_CHANGED = new EventPublisher<number>();
	public readonly STATE_CHANGED = new EventPublisher<ELaserState>();

	public readonly GAME_PAUSE = new EventPublisher<void>();
	public readonly GAME_RESUME = new EventPublisher<void>();

	//#endregion
}
