/**
 * Color Fill Level Generator - 항상 클리어 가능한 다이얼 배치를 만드는 생성기 (PUZ_04 §8.5 / §8.6)
 *
 * 사양 §8.5:
 *   "난이도 표의 활성화 칸 수와 오염 그룹 구성을 입력받아, 18칸 원형 배열 위에
 *    지정된 크기의 오염 덩어리들을 서로 인접하지 않게(그룹이 합쳐지지 않게) 배치한다.
 *    활성화 영역은 연속/분산 모두 허용한다."
 *
 * 사양 §8.6:
 *   "밸런싱 검증: 자동 플레이 봇으로 제한 시간 내 클리어 가능 여부를 시뮬레이션한다."
 *
 * 이 퍼즐은 배치 자체는 언제나 풀 수 있다(바늘이 한 바퀴 돌면 모든 칸을 지난다).
 * 따라서 검증의 핵심은 "해가 있는가" 가 아니라 **"제한 시간 안에 끝낼 수 있는가"** 다.
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { ColorFillAutoPlayBot, AutoPlayResult } from 'ColorFill_AutoPlayBot';
import { ColorFillDial, getSafeStartAngle } from 'ColorFill_Dial';
import { ColorFillDifficultyConfig, ColorFillTables, validateDifficultyConfig } from 'ColorFill_DataTables';
import {
	ColorFillLevel,
	ColorFillValidationResult,
	DEGREES_PER_SLOT,
	DIAL_SLOT_COUNT,
	DialSlot,
	ESlotState,
	RandomSource,
	countActive,
	countContaminated,
	createSeededRandom,
	createSlots,
	getContaminatedGroups,
	randomInt,
	shuffleInPlace,
	wrapSlotIndex,
} from 'ColorFill_Definitions';

export type ColorFillGenerationOptions = {
	puzzleId: string,
	difficulty: number,
	seed?: number,
	maxAttempts?: number,
	config?: ColorFillDifficultyConfig,
	/**
	 * 봇이 제한 시간의 이 비율 안에 끝내야 채택한다.
	 * 1.0 이면 아슬아슬한 레벨도 통과하므로 약간의 여유를 둔다.
	 */
	clearTimeMarginRatio?: number,
}

const DEFAULT_MAX_ATTEMPTS = 200;
const DEFAULT_CLEAR_TIME_MARGIN_RATIO = 0.8;

/** 검증 봇 반응 시간의 상·하한 (초) */
const MIN_VERIFICATION_REACTION_SECONDS = 0.05;
const MAX_VERIFICATION_REACTION_SECONDS = 0.25;

/**
 * 검증 봇이 쓸 반응 시간.
 * 가장 좁은 오염 덩어리가 바늘 아래를 지나가는 시간보다 짧게 잡아야
 * "충분히 빠른 플레이어라면 풀 수 있는가"를 제대로 잴 수 있다.
 */
function getVerificationReactionSeconds(level: ColorFillLevel): number {
	const groups = getContaminatedGroups(level.slots);
	let smallestGroupSize = DIAL_SLOT_COUNT;
	for (const group of groups) {
		if (group.length < smallestGroupSize) {
			smallestGroupSize = group.length;
		}
	}

	const exposureSeconds = (smallestGroupSize * DEGREES_PER_SLOT) / level.needleSpeedDegPerSec;
	const reaction = exposureSeconds * 0.8;
	if (reaction < MIN_VERIFICATION_REACTION_SECONDS) {
		return MIN_VERIFICATION_REACTION_SECONDS;
	}
	if (reaction > MAX_VERIFICATION_REACTION_SECONDS) {
		return MAX_VERIFICATION_REACTION_SECONDS;
	}
	return reaction;
}

//#region Validator

export class ColorFillPlacementValidator {
	public validate(level: ColorFillLevel, config?: ColorFillDifficultyConfig): ColorFillValidationResult {
		const violations: string[] = [];

		if (level.slots.length !== DIAL_SLOT_COUNT) {
			violations.push(`Dial must have ${DIAL_SLOT_COUNT} slots (got ${level.slots.length}).`);
		}

		// 오염 영역은 활성 영역의 부분집합이어야 한다
		for (const slot of level.slots) {
			if (slot.state === ESlotState.CONTAMINATED && slot.isActive === false) {
				violations.push(`Inactive slot ${slot.index} is contaminated.`);
			}
		}

		const contaminated = countContaminated(level.slots);
		if (contaminated === 0) {
			violations.push('No contaminated slots; already cleared at start.');
		}

		const groups = getContaminatedGroups(level.slots);

		// §8.5 - 덩어리끼리 인접하면 하나로 합쳐진 것이므로 구성이 어긋난다
		if (config !== undefined) {
			const expected = config.contaminationGroupSizes.slice().sort((left, right) => left - right);
			const actual = groups.map((group) => group.length).sort((left, right) => left - right);
			if (expected.join(',') !== actual.join(',')) {
				violations.push(`Contamination cluster layout mismatch. Expected [${expected.join(',')}] / actual [${actual.join(',')}]`);
			}
			if (countActive(level.slots) !== config.activeSlotCount) {
				violations.push(`Active slot count mismatch. Expected ${config.activeSlotCount} / actual ${countActive(level.slots)}`);
			}
		}

		if (level.needleSpeedDegPerSec <= 0) {
			violations.push('Needle speed must be greater than 0.');
		}

		return { isValid: violations.length === 0, violations: violations };
	}
}

//#endregion

//#region Generator

export class ColorFillLevelGenerator {
	private readonly _tables: ColorFillTables;
	private readonly _bot: ColorFillAutoPlayBot;
	private readonly _validator: ColorFillPlacementValidator;

	constructor(tables: ColorFillTables, bot: ColorFillAutoPlayBot = new ColorFillAutoPlayBot(), validator: ColorFillPlacementValidator = new ColorFillPlacementValidator()) {
		this._tables = tables;
		this._bot = bot;
		this._validator = validator;
	}

	public get validator(): ColorFillPlacementValidator {
		return this._validator;
	}

	public generate(options: ColorFillGenerationOptions): ColorFillLevel | undefined {
		const config = options.config ?? this._tables.getDifficultyConfig(options.difficulty);
		if (config === undefined) {
			console.warn(`[ColorFillLevelGenerator] No difficulty config for difficulty ${options.difficulty}`);
			return undefined;
		}

		// 설정 자체가 다이얼 규격을 위반하면 조용히 재시도하지 말고 바로 알린다
		const configViolations = validateDifficultyConfig(config);
		if (configViolations.length > 0) {
			console.warn(`[ColorFillLevelGenerator] Invalid config for difficulty ${options.difficulty}: ${configViolations.join(' / ')}`);
			return undefined;
		}

		const random = options.seed === undefined ? Math.random : createSeededRandom(options.seed);
		const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
		const marginRatio = options.clearTimeMarginRatio ?? DEFAULT_CLEAR_TIME_MARGIN_RATIO;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const slots = this.placeContamination(random, config);
			if (slots === undefined) {
				continue;
			}

			const level: ColorFillLevel = {
				puzzleId: options.puzzleId,
				difficulty: options.difficulty,
				slots: slots,
				needleSpeedDegPerSec: config.needleSpeedDegPerSec,
				reverseDelaySeconds: config.reverseDelaySeconds,
				// 바늘이 칸 경계에 정확히 걸리지 않도록 칸 중심에서 시작한다
				startAngleDeg: getSafeStartAngle(randomInt(random, 0, DIAL_SLOT_COUNT - 1)),
			};

			if (this._validator.validate(level, config).isValid === false) {
				continue;
			}

			// §8.6 - 자동 플레이 봇으로 제한 시간 내 클리어 가능 여부를 검증한다
			const play = this.simulate(level, config.timeLimitSeconds);
			if (play.didClear === false) {
				continue;
			}
			if (play.elapsedSeconds > config.timeLimitSeconds * marginRatio) {
				// 아슬아슬한 레벨은 버린다
				continue;
			}

			return level;
		}

		console.warn(`[ColorFillLevelGenerator] Failed to generate a level for difficulty ${options.difficulty} within ${maxAttempts} attempts`);
		return undefined;
	}

	/**
	 * 자동 플레이 봇을 돌려 클리어 가능성과 소요 시간을 잰다 - §8.6.
	 *
	 * 봇의 반응 시간은 **레벨의 타이밍에 맞춰 잡는다.** 봇의 기본값(0.25초)을 그대로 쓰면
	 * 바늘이 빠른 레벨에서 가장 좁은 덩어리의 노출 시간보다 반응이 느려져,
	 * 실제로는 풀 수 있는 배치도 "클리어 불가"로 버려진다.
	 * (기획 CSV 의 난이도 4는 450도/초 × 3칸 = 노출 0.13초라 0.25초 반응으로는 전부 탈락했다)
	 *
	 * 여기서 재는 것은 "충분히 빠른 플레이어라면 풀 수 있는 배치인가" 이고,
	 * 사람이 실제로 낼 수 있는 반응 시간인지는 별도 밸런스 문제로 다룬다.
	 */
	public simulate(level: ColorFillLevel, timeLimitSeconds: number): AutoPlayResult {
		return this._bot.play(ColorFillDial.fromLevel(level), {
			timeLimitSeconds: timeLimitSeconds,
			reactionSeconds: getVerificationReactionSeconds(level),
		});
	}

	public verify(level: ColorFillLevel, config?: ColorFillDifficultyConfig): ColorFillValidationResult {
		const result = this._validator.validate(level, config);
		if (result.isValid === false) {
			return result;
		}

		const timeLimit = config?.timeLimitSeconds
			?? this._tables.getDifficultyConfig(level.difficulty)?.timeLimitSeconds
			?? 60;
		const play = this.simulate(level, timeLimit);
		if (play.didClear === false) {
			return {
				isValid: false,
				violations: [`Cannot be cleared within the ${timeLimit}s time limit (${play.remainingContaminated} contaminated slots remain).`],
			};
		}
		return { isValid: true, violations: [] };
	}

	//#region Internal

	/**
	 * 18칸 원형 배열 위에 오염 덩어리들을 서로 인접하지 않게 배치한다 - §8.5.
	 *
	 * 덩어리 사이에는 최소 1칸의 여백이 필요하다. 그렇지 않으면 두 덩어리가 이어져
	 * 한 번의 터치로 함께 정화되어 버려 난이도 구성이 무너진다.
	 */
	private placeContamination(random: RandomSource, config: ColorFillDifficultyConfig): DialSlot[] | undefined {
		const slots = createSlots();
		const groupSizes = shuffleInPlace(random, config.contaminationGroupSizes.slice());

		// 시작 위치를 무작위로 잡고, 덩어리와 여백을 번갈아 배치한다.
		let cursor = randomInt(random, 0, DIAL_SLOT_COUNT - 1);
		const gapBudget = DIAL_SLOT_COUNT - config.contaminationGroupSizes.reduce((sum, size) => sum + size, 0);
		const gaps = this.distributeGaps(random, gapBudget, groupSizes.length);
		if (gaps === undefined) {
			return undefined;
		}

		const contaminatedIndexes: number[] = [];
		for (let groupIndex = 0; groupIndex < groupSizes.length; groupIndex++) {
			for (let step = 0; step < groupSizes[groupIndex]; step++) {
				const index = wrapSlotIndex(cursor);
				if (slots[index].state === ESlotState.CONTAMINATED) {
					// 한 바퀴를 넘어 겹쳤다
					return undefined;
				}
				slots[index].state = ESlotState.CONTAMINATED;
				slots[index].isActive = true;
				contaminatedIndexes.push(index);
				cursor++;
			}
			// 덩어리 사이 여백
			cursor += gaps[groupIndex];
		}

		// 오염 칸 외에 활성 칸을 더 채운다. 활성 영역은 연속/분산 모두 허용된다 (§4).
		const extraActive = config.activeSlotCount - contaminatedIndexes.length;
		if (extraActive < 0) {
			return undefined;
		}

		const candidates: number[] = [];
		for (let index = 0; index < DIAL_SLOT_COUNT; index++) {
			if (slots[index].isActive === false) {
				candidates.push(index);
			}
		}
		shuffleInPlace(random, candidates);
		for (let index = 0; index < extraActive && index < candidates.length; index++) {
			slots[candidates[index]].isActive = true;
		}

		if (countActive(slots) !== config.activeSlotCount) {
			return undefined;
		}
		return slots;
	}

	/**
	 * 남은 칸을 덩어리 사이 여백으로 나눈다.
	 * 덩어리가 2개 이상이면 사이마다 최소 1칸을 확보해야 서로 붙지 않는다.
	 */
	private distributeGaps(random: RandomSource, gapBudget: number, groupCount: number): number[] | undefined {
		if (groupCount <= 0) {
			return undefined;
		}
		if (groupCount === 1) {
			// 덩어리가 하나면 여백을 나눌 필요가 없다
			return [gapBudget];
		}
		if (gapBudget < groupCount) {
			// 사이마다 1칸도 못 넣는다
			return undefined;
		}

		const gaps: number[] = [];
		for (let index = 0; index < groupCount; index++) {
			gaps.push(1);
		}

		let remaining = gapBudget - groupCount;
		while (remaining > 0) {
			gaps[randomInt(random, 0, groupCount - 1)]++;
			remaining--;
		}
		return gaps;
	}

	//#endregion
}

//#endregion

/** 생성 결과를 한 줄 요약으로 남기는 디버그 헬퍼 */
export function describeColorFillLevel(level: ColorFillLevel): string {
	const groups = getContaminatedGroups(level.slots).map((group) => group.length);
	return `${level.puzzleId} D${level.difficulty} active=${countActive(level.slots)} contaminated=${countContaminated(level.slots)} groups=[${groups.join(',')}] speed=${level.needleSpeedDegPerSec} delay=${level.reverseDelaySeconds}`;
}
