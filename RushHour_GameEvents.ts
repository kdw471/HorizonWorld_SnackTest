/**
 * Rush Hour Game Events - 러시아워 퍼즐의 이벤트 허브
 *
 * Basics_GameEvents 와 동일한 규약(EventPublisher 모음)을 따르되,
 * 러시아워 규칙에 필요한 이벤트만 노출한다.
 * 연출/UI/VR 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).
 */

import {
	ERushHourState,
	RushHourLevel,
	RushHourMove,
	RushHourPiece,
	RushHourResultData,
	RushHourRoundProgress,
} from 'RushHour_Definitions';
import { EventPublisher } from 'Utility_Events';

export class RushHourEvents {
	//#region Quest / Round lifecycle

	/** 퍼즐 퀘스트 시작 (퀘스트 ID) */
	public readonly QUEST_START = new EventPublisher<string>();
	/** 모든 라운드를 클리어 */
	public readonly QUEST_CLEAR = new EventPublisher<RushHourResultData>();
	/** 제한 시간 초과 등으로 실패 - 기획서 §2 */
	public readonly QUEST_FAILED = new EventPublisher<RushHourResultData>();
	/** 승패와 무관한 종료 (결과 데이터 포함) */
	public readonly GAME_END = new EventPublisher<RushHourResultData>();

	/** 라운드 시작 (0-based 인덱스) */
	public readonly ROUND_START = new EventPublisher<number>();
	/** 라운드 클리어 */
	public readonly ROUND_CLEAR = new EventPublisher<number>();
	/** 라운드 슬롯 표시 갱신 - PUZ_00 §2.1 */
	public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<RushHourRoundProgress>();

	//#endregion

	//#region Board

	/** 새 배치를 불러왔을 때 (어댑터가 3D 에셋을 스폰하는 시점) */
	public readonly LEVEL_LOADED = new EventPublisher<RushHourLevel>();
	/** 보드를 비웠을 때 */
	public readonly LEVEL_UNLOADED = new EventPublisher<void>();

	/** 오브젝트가 실제로 이동했을 때 */
	public readonly PIECE_MOVED = new EventPublisher<RushHourMove>();
	/** 축 위반 / 막힘 등으로 이동이 거절되었을 때 */
	public readonly MOVE_REJECTED = new EventPublisher<RushHourMove>();

	/** 목표 USB 가 도착 포인트에 도달 */
	public readonly GOAL_REACHED = new EventPublisher<RushHourPiece>();
	/** 도달했던 목표 USB 가 다시 빠져나옴 */
	public readonly GOAL_LEFT = new EventPublisher<RushHourPiece>();

	/** 목표 USB 가 단자에 결합됨 - 모바일 사양 §9 "결합 성공 이펙트(LED, 진동)" 트리거 */
	public readonly USB_DOCKED = new EventPublisher<RushHourPiece>();
	/** 결합됐던 목표 USB 가 분리됨 - §9 */
	public readonly USB_UNDOCKED = new EventPublisher<RushHourPiece>();

	//#endregion

	//#region Timer / State

	/** 남은 시간(초)이 바뀔 때 */
	public readonly TIME_CHANGED = new EventPublisher<number>();
	/** 상태 머신 전이 */
	public readonly STATE_CHANGED = new EventPublisher<ERushHourState>();

	public readonly GAME_PAUSE = new EventPublisher<void>();
	public readonly GAME_RESUME = new EventPublisher<void>();

	//#endregion
}
