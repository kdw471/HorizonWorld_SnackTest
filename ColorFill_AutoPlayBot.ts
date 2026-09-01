/**
 * Color Fill Auto Play Bot - 밸런싱 검증용 자동 플레이 봇 (PUZ_04 §8.6)
 *
 * 사양 §8.6:
 *   "(총 오염 그룹 수) x (평균 왕복 이동 시간) 이 제한 시간 내에 들어오는지 시뮬레이션한다.
 *    방향 반전 딜레이가 크면 클리어 불가능한 레벨이 생성될 수 있으므로 자동 플레이 봇으로 검증한다."
 *
 * 봇 전략
 * -------
 *   1. 바늘이 오염 칸 위에 있으면 즉시 터치한다 (정화 + 방향 반전).
 *   2. 그렇지 않으면, 진행 방향으로 가장 가까운 오염 칸까지의 거리와
 *      반대 방향으로의 거리를 비교한다. 반대쪽이 **방향 전환 비용보다 더 많이** 가까우면
 *      지금 터치해 방향을 돌린다.
 *   3. 방향 전환 비용은 딜레이 동안 잘못된 방향으로 더 나아간 거리와
 *      그것을 되돌아오는 거리를 합쳐 2배로 계산한다.
 *
 * ## 반응 지연을 반드시 넣는다
 *
 * 봇이 매 프레임 완벽한 타이밍으로 누르면 어떤 레벨이든 몇 초 만에 끝나 버려
 * 제한 시간 검증이 아무 의미가 없어진다. 이 퍼즐의 실제 난이도는 **반응 속도**에 있다.
 * 예를 들어 160도/초에서 한 칸(20도)은 0.125초 만에 지나가는데, 사람은 그 안에 반응하지 못한다.
 *
 * 그래서 봇은 `reactionSeconds` 간격으로만 판단한다. 그 사이에 지나가 버린 칸은 놓치고,
 * 다음 바퀴를 기다려야 한다. 이렇게 해야 "사람이 시간 안에 끝낼 수 있는가" 를 잰다는
 * §8.6 의 의도가 성립한다.
 *
 * 이 봇은 최적해를 보장하지 않는다. "사람이 무난히 두면 시간 안에 끝나는가" 를 재는 도구다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { ColorFillDial } from 'ColorFill_Dial';
import {
	DEGREES_PER_SLOT,
	DIAL_SLOT_COUNT,
	ESlotState,
	getSlotDistance,
} from 'ColorFill_Definitions';

export type AutoPlayResult = {
	/** 제한 시간 안에 클리어했는지 */
	didClear: boolean,
	/** 클리어까지 걸린 시간(초). 실패하면 제한 시간과 같다 */
	elapsedSeconds: number,
	/** 터치 횟수 */
	touchCount: number,
	/** 끝났을 때 남은 오염 칸 수 */
	remainingContaminated: number,
}

export type AutoPlayOptions = {
	/** 시뮬레이션 시간 간격(초) */
	stepSeconds?: number,
	/** 이 시간을 넘으면 실패로 본다 */
	timeLimitSeconds: number,
	/**
	 * 봇이 판단·입력하는 최소 간격(초). 사람의 반응 속도를 모사한다.
	 * 0 으로 두면 매 프레임 완벽하게 반응하므로 밸런싱 검증이 무의미해진다.
	 */
	reactionSeconds?: number,
}

const DEFAULT_STEP_SECONDS = 1 / 60;
/** 사람의 평균 시각 반응 속도에 가깝게 잡은 기본값 */
const DEFAULT_REACTION_SECONDS = 0.25;

export class ColorFillAutoPlayBot {
	/**
	 * 주어진 다이얼을 자동으로 플레이해 제한 시간 안에 클리어되는지 확인한다.
	 * 전달한 다이얼은 변경하지 않는다 (내부에서 복제한다).
	 */
	public play(dial: ColorFillDial, options: AutoPlayOptions): AutoPlayResult {
		const step = options.stepSeconds ?? DEFAULT_STEP_SECONDS;
		const reaction = options.reactionSeconds ?? DEFAULT_REACTION_SECONDS;
		const limit = options.timeLimitSeconds;
		const working = dial.clone();

		let elapsed = 0;
		let touchCount = 0;
		let sinceLastDecision = reaction;

		while (elapsed < limit) {
			if (working.isSolved()) {
				return {
					didClear: true,
					elapsedSeconds: elapsed,
					touchCount: touchCount,
					remainingContaminated: 0,
				};
			}

			// 반응 지연 - 이 간격으로만 판단한다. 그 사이 지나간 칸은 놓친다.
			// 터치 여부와 무관하게 "판단"이 일어날 때마다 리셋해야
			// 터치하지 않는 프레임에 매 프레임 재판단하는 완벽 반응이 되지 않는다.
			if (sinceLastDecision >= reaction) {
				sinceLastDecision = 0;
				if (working.isInputAccepted && this.shouldTouch(working)) {
					const result = working.touch();
					if (result.didScheduleReverse) {
						touchCount++;
					}
				}
			}

			working.update(step);
			elapsed += step;
			sinceLastDecision += step;
		}

		return {
			didClear: working.isSolved(),
			elapsedSeconds: elapsed,
			touchCount: touchCount,
			remainingContaminated: working.getContaminatedCount(),
		};
	}

	//#region Internal

	private shouldTouch(dial: ColorFillDial): boolean {
		const currentIndex = dial.getCurrentSlotIndex();
		const slots = dial.slots;

		// 1. 오염 칸 위면 무조건 터치한다 - 정화 기회를 놓치지 않는다
		if (slots[currentIndex].state === ESlotState.CONTAMINATED) {
			return true;
		}

		// 2. 반대 방향이 충분히 가까우면 지금 돌린다
		const direction = dial.needle.direction;
		const forward = this.getDistanceToContaminated(dial, currentIndex, direction);
		const backward = this.getDistanceToContaminated(dial, currentIndex, -direction);
		if (forward === undefined) {
			// 진행 방향에 오염이 없다면 반대쪽에 있을 때만 돌린다
			return backward !== undefined;
		}
		if (backward === undefined) {
			return false;
		}

		// 딜레이 동안 잘못된 방향으로 더 나아가고, 그만큼 되돌아와야 한다
		const reverseCostInSlots = 2 * (dial.reverseDelaySeconds * dial.needle.speedDegPerSec) / DEGREES_PER_SLOT;
		return backward + reverseCostInSlots < forward;
	}

	/** 해당 방향으로 가장 가까운 오염 칸까지의 거리(칸 수). 없으면 undefined */
	private getDistanceToContaminated(dial: ColorFillDial, fromIndex: number, direction: number): number | undefined {
		const slots = dial.slots;
		for (let step = 1; step <= DIAL_SLOT_COUNT; step++) {
			const target = direction >= 0 ? fromIndex + step : fromIndex - step;
			const index = ((target % DIAL_SLOT_COUNT) + DIAL_SLOT_COUNT) % DIAL_SLOT_COUNT;
			if (slots[index].state === ESlotState.CONTAMINATED) {
				return getSlotDistance(fromIndex, index, direction);
			}
		}
		return undefined;
	}

	//#endregion
}
