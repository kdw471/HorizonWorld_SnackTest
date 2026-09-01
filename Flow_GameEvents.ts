/**
 * Flow Game Events - 연결 퍼즐의 이벤트 허브 (PUZ_05)
 *
 * 연출/UI/입력 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).
 */

import {
	EFlowColor,
	EFlowState,
	FlowCell,
	FlowLevel,
	FlowResultData,
	FlowRoundProgress,
} from 'Flow_Definitions';
import { EventPublisher } from 'Utility_Events';

export class FlowEvents {
	//#region Quest / Round lifecycle

	public readonly QUEST_START = new EventPublisher<string>();
	public readonly QUEST_CLEAR = new EventPublisher<FlowResultData>();
	public readonly QUEST_FAILED = new EventPublisher<FlowResultData>();
	public readonly GAME_END = new EventPublisher<FlowResultData>();

	public readonly ROUND_START = new EventPublisher<number>();
	public readonly ROUND_CLEAR = new EventPublisher<number>();
	/** 라운드 슬롯 표시 갱신 - PUZ_00 §2.1 */
	public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<FlowRoundProgress>();

	//#endregion

	//#region Board

	public readonly LEVEL_LOADED = new EventPublisher<FlowLevel>();
	public readonly LEVEL_UNLOADED = new EventPublisher<void>();

	/** 그리기를 시작했다 */
	public readonly DRAW_BEGAN = new EventPublisher<EFlowColor>();
	/** 서브 오브젝트에 불이 들어왔다 - §5 */
	public readonly NODE_LIT = new EventPublisher<{ color: EFlowColor, cell: FlowCell }>();
	/** 되짚어서 서브 오브젝트의 불이 꺼졌다 - §6 지우기 */
	public readonly NODE_UNLIT = new EventPublisher<FlowCell>();
	/** 한 색의 경로가 도착 지점까지 완결되었다 */
	public readonly PATH_COMPLETED = new EventPublisher<EFlowColor>();
	/** 완결되었던 경로가 다시 끊어졌다 */
	public readonly PATH_BROKEN = new EventPublisher<EFlowColor>();
	/** 이을 수 없는 칸으로 끌었다 (미리보기 비활성 사유 전달) */
	public readonly EXTEND_REJECTED = new EventPublisher<string>();
	/** 손을 뗐다. 그린 경로는 유지된다 - §6 */
	public readonly DRAW_ENDED = new EventPublisher<EFlowColor>();

	//#endregion

	//#region Timer / State

	public readonly TIME_CHANGED = new EventPublisher<number>();
	public readonly STATE_CHANGED = new EventPublisher<EFlowState>();

	public readonly GAME_PAUSE = new EventPublisher<void>();
	public readonly GAME_RESUME = new EventPublisher<void>();

	//#endregion
}
