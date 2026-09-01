/**
 * Laser Beam Tracer - 광선 전파 (PUZ_01 §8.1)
 *
 * 사양 §8.1:
 *   "레이저 전파는 BFS/DFS 기반 광선 추적으로 구현한다.
 *    분배 크리스탈(팔각/십자/T자) 때문에 하나의 발사체에서 여러 갈래가 생기므로,
 *    방문한 (셀, 진입방향, 색) 조합을 기록해 무한 루프를 방지한다."
 *
 * 색 = 레이어(§5). 따라서 색이 다른 광선끼리는 교차해도 간섭하지 않는다.
 * 크리스탈과 해골은 층 구분이 없어 모든 색의 광선과 상호작용한다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { LaserBoard } from 'Laser_Board';
import {
	EGimmickType,
	ELaserColor,
	ELaserDirection,
	EObjectState,
	LASER_MAX_TRACE_SEGMENTS,
	LaserBeamSegment,
	LaserTraceResult,
	getCrystalOutputs,
	getDirectionDelta,
	getInwardDirection,
	isInsideFullGrid,
} from 'Laser_Definitions';

/** 광선의 진행 상태 한 개 */
type BeamHead = {
	/** 현재 광선이 서 있는 칸 (전체 그리드 좌표) */
	row: number,
	col: number,
	direction: ELaserDirection,
	color: ELaserColor,
}

export class LaserBeamTracer {
	/**
	 * 현재 배치에서 광선을 전부 추적한다.
	 * 보드를 변경하지 않으므로 배치가 바뀔 때마다 다시 호출하면 된다 (§8.2 "즉시 재계산").
	 */
	public trace(board: LaserBoard): LaserTraceResult {
		const segments: LaserBeamSegment[] = [];
		const litReceiverIds = new Set<string>();
		const visitedRelayIds = new Set<string>();
		let didHitSkull = false;

		const visited = new Set<string>();
		const stack: BeamHead[] = [];

		// 발사체에서 필드 안쪽을 향해 출발한다 (§3 1.0 / 1.2 - 발사체 색 == 레이저 색)
		for (const emitter of board.emitters) {
			const direction = getInwardDirection(emitter.row, emitter.col);
			if (direction === undefined) {
				continue;
			}
			for (const color of emitter.colors) {
				stack.push({ row: emitter.row, col: emitter.col, direction: direction, color: color });
			}
		}

		while (stack.length > 0 && segments.length < LASER_MAX_TRACE_SEGMENTS) {
			const head = stack.pop();
			if (head === undefined) {
				break;
			}

			const delta = getDirectionDelta(head.direction);
			const nextRow = head.row + delta.row;
			const nextCol = head.col + delta.col;

			// §3 1.1 - 레이저는 직선으로만 진행한다. 격자를 벗어나면 소멸.
			if (isInsideFullGrid(nextRow, nextCol) === false) {
				continue;
			}

			// §8.1 - (셀, 진입방향, 색) 으로 무한 루프를 막는다.
			const key = `${nextRow},${nextCol},${head.direction},${head.color}`;
			if (visited.has(key)) {
				continue;
			}
			visited.add(key);

			segments.push({
				color: head.color,
				from: { row: head.row, col: head.col },
				to: { row: nextRow, col: nextCol },
				direction: head.direction,
			});

			const gimmick = board.getGimmickAt(nextRow, nextCol);
			if (gimmick !== undefined && gimmick.type !== EGimmickType.FIXED_CRYSTAL) {
				switch (gimmick.type) {
					case EGimmickType.RECEIVER:
						// §3 2.1 - 수신체의 색 == 도달한 레이저의 색이어야 완료
						if (gimmick.colors.indexOf(head.color) >= 0) {
							litReceiverIds.add(gimmick.id);
						}
						// 색이 맞든 아니든 수신체에서 광선은 멈춘다
						continue;

					case EGimmickType.RELAY:
						// §3 4.1 - 반드시 경유해야 하는 오브젝트. 색이 맞을 때만 경유로 인정한다.
						// (§4.1.1 - 중계체는 여러 색을 지닐 수 있다)
						if (gimmick.colors.indexOf(head.color) >= 0) {
							visitedRelayIds.add(gimmick.id);
						}
						// 중계체는 통과 지점이므로 광선은 직진을 이어간다
						stack.push({ row: nextRow, col: nextCol, direction: head.direction, color: head.color });
						continue;

					case EGimmickType.SKULL:
						// §3 4.2.1 - 닿으면 모든 수신체가 비활성(Fault)이 되어 클리어 불가
						didHitSkull = true;
						continue;

					default:
						// 발사체에 다시 닿으면 흡수된다
						continue;
				}
			}

			// 크리스탈 - 배치된 것과 고정된 것 모두 포함 (§4.3)
			const crystal = board.getCrystalAtFullGrid(nextRow, nextCol);
			if (crystal !== undefined) {
				// §3 3.0 - 크리스탈을 지나가면 궤도가 변경된다
				for (const outgoing of getCrystalOutputs(crystal, head.direction)) {
					stack.push({ row: nextRow, col: nextCol, direction: outgoing, color: head.color });
				}
				continue;
			}

			// 빈 칸 - 직진
			stack.push({ row: nextRow, col: nextCol, direction: head.direction, color: head.color });
		}

		return {
			segments: segments,
			litReceiverIds: Array.from(litReceiverIds),
			visitedRelayIds: Array.from(visitedRelayIds),
			didHitSkull: didHitSkull,
			objectStates: this.buildObjectStates(board, litReceiverIds, visitedRelayIds, didHitSkull),
		};
	}

	/**
	 * 클리어 판정 - §3 "클리어 판정".
	 *   모든 수신체가 자기 색 레이저를 받아 On + 모든 중계체 경유 + 해골에 닿지 않음
	 */
	public isSolved(board: LaserBoard, result: LaserTraceResult): boolean {
		if (result.didHitSkull) {
			return false;
		}

		const receivers = board.receivers;
		if (receivers.length === 0) {
			return false;
		}
		for (const receiver of receivers) {
			if (result.litReceiverIds.indexOf(receiver.id) < 0) {
				return false;
			}
		}

		for (const relay of board.relays) {
			if (result.visitedRelayIds.indexOf(relay.id) < 0) {
				return false;
			}
		}
		return true;
	}

	/** 편의 함수 - 추적과 판정을 한 번에 */
	public traceAndCheck(board: LaserBoard): { result: LaserTraceResult, isSolved: boolean } {
		const result = this.trace(board);
		return { result: result, isSolved: this.isSolved(board, result) };
	}

	//#region Internal

	/** 오브젝트별 On / Off / Fault 상태 - PUZ_00 §5, §6 */
	private buildObjectStates(board: LaserBoard, litReceiverIds: Set<string>, visitedRelayIds: Set<string>, didHitSkull: boolean): Map<string, EObjectState> {
		const states = new Map<string, EObjectState>();

		for (const gimmick of board.gimmicks) {
			switch (gimmick.type) {
				case EGimmickType.EMITTER:
					states.set(gimmick.id, EObjectState.ON);
					break;

				case EGimmickType.RECEIVER:
					// 해골에 광선이 닿으면 모든 수신체가 Fault 가 된다 (§3 4.2.1)
					if (didHitSkull) {
						states.set(gimmick.id, EObjectState.FAULT);
					}
					else {
						states.set(gimmick.id, litReceiverIds.has(gimmick.id) ? EObjectState.ON : EObjectState.OFF);
					}
					break;

				case EGimmickType.RELAY:
					states.set(gimmick.id, visitedRelayIds.has(gimmick.id) ? EObjectState.ON : EObjectState.OFF);
					break;

				case EGimmickType.SKULL:
					states.set(gimmick.id, didHitSkull ? EObjectState.ON : EObjectState.OFF);
					break;

				default:
					states.set(gimmick.id, EObjectState.OFF);
					break;
			}
		}

		return states;
	}

	//#endregion
}
