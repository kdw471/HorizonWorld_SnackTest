/**
 * Color Fill Tests - PUZ_04 §8.7 "테스트" 항목
 *
 *   정화된 칸 터치 시 무패널티 확인 / 연속 오염 1회 터치 전체 정화 /
 *   원형 wrap-around 구간(17 <-> 0)의 연속 판정 / 비활성 영역에서의 터치도 방향 반전 발생 /
 *   방향 전환 딜레이 중 재터치 처리
 *
 * 여기에 더해 클리어 판정(§8.4), 레벨 생성기(§8.5), 자동 플레이 봇 밸런싱 검증(§8.6),
 * 세션의 제한 시간 실패를 검증한다.
 *
 * Horizon Component 가 아니라 순수 검증 하네스다. `runColorFillTests()` 를 호출하면 결과를 돌려준다.
 */

import { ColorFillAutoPlayBot } from 'ColorFill_AutoPlayBot';
import { ColorFillDial, getSafeStartAngle } from 'ColorFill_Dial';
import { ColorFillEvents } from 'ColorFill_GameEvents';
import { ColorFillInputController } from 'ColorFill_InputController';
import { ColorFillLevelGenerator, ColorFillPlacementValidator, describeColorFillLevel } from 'ColorFill_LevelGenerator';
import { ColorFillSession } from 'ColorFill_Session';
import { COLORFILL_CSV_FIELD_TABLE, ColorFillTables } from 'ColorFill_DataTables';
import {
	DEGREES_PER_SLOT,
	DIAL_SLOT_COUNT,
	DIRECTION_CLOCKWISE,
	DialSlot,
	EColorFillState,
	ESlotState,
	ETouchOutcome,
	countActive,
	countContaminated,
	createSlots,
	getContaminatedGroups,
	getContiguousContaminatedRun,
	getSlotIndexFromAngle,
} from 'ColorFill_Definitions';

export type ColorFillTestResult = {
	name: string,
	isPassed: boolean,
	detail?: string,
}

export type ColorFillTestReport = {
	passed: number,
	failed: number,
	results: ColorFillTestResult[],
}

class TestRecorder {
	public readonly results: ColorFillTestResult[] = [];

	public check(name: string, condition: boolean, detail?: string): void {
		this.results.push({ name: name, isPassed: condition, detail: condition ? undefined : detail });
	}
}

export function runColorFillTests(): ColorFillTestReport {
	const recorder = new TestRecorder();
	const tables = new ColorFillTables();

	testRingGeometry(recorder);
	testPurifyRules(recorder);
	testNeedleAndReverse(recorder);
	testClearCondition(recorder);
	testGeneration(recorder, tables);
	testAutoPlayBot(recorder, tables);
	testCsvFieldTable(recorder, tables);
	testSession(recorder, tables);

	let passed = 0;
	let failed = 0;
	for (const result of recorder.results) {
		if (result.isPassed) {
			passed++;
		}
		else {
			failed++;
		}
	}
	return { passed: passed, failed: failed, results: recorder.results };
}

//#region Helpers

/** 지정한 칸들을 오염 상태로, 나머지 활성 칸은 정화 상태로 만든다 */
function makeSlots(contaminated: number[], activeExtra: number[] = []): DialSlot[] {
	const slots = createSlots();
	for (const index of contaminated) {
		slots[index].isActive = true;
		slots[index].state = ESlotState.CONTAMINATED;
	}
	for (const index of activeExtra) {
		slots[index].isActive = true;
	}
	return slots;
}

/** 특정 칸 위에서 시작하는 다이얼 */
function makeDial(contaminated: number[], startSlot: number, activeExtra: number[] = [], reverseDelay: number = 0.3): ColorFillDial {
	return new ColorFillDial(makeSlots(contaminated, activeExtra), 90, reverseDelay, getSafeStartAngle(startSlot));
}

//#endregion

//#region 원형 배열 기하 (§3, §8.2)

function testRingGeometry(recorder: TestRecorder): void {
	recorder.check('다이얼은 18칸', DIAL_SLOT_COUNT === 18);
	recorder.check('한 칸은 20도', Math.abs(DEGREES_PER_SLOT - 20) < 1e-9);

	recorder.check('각도 0도는 0번 칸', getSlotIndexFromAngle(0) === 0);
	recorder.check('각도 19.9도는 0번 칸', getSlotIndexFromAngle(19.9) === 0);
	recorder.check('각도 20도는 1번 칸', getSlotIndexFromAngle(20) === 1);
	recorder.check('각도 359도는 17번 칸', getSlotIndexFromAngle(359) === 17);
	recorder.check('각도 360도는 0번 칸으로 감긴다', getSlotIndexFromAngle(360) === 0);
	recorder.check('음수 각도도 감긴다', getSlotIndexFromAngle(-10) === 17, `${getSlotIndexFromAngle(-10)}`);
}

//#endregion

//#region §5 정화 규칙

function testPurifyRules(recorder: TestRecorder): void {
	// 연속 오염은 1회 터치로 전체 정화 (§5)
	{
		const dial = makeDial([4, 5, 6, 7], 5);
		const result = dial.touch();
		recorder.check('연속 오염을 1회 터치로 전체 정화', result.purifiedSlotIndexes.length === 4, JSON.stringify(result.purifiedSlotIndexes));
		recorder.check('정화 후 오염 칸이 남지 않는다', dial.getContaminatedCount() === 0);
		recorder.check('정화 결과는 PURIFY_AND_REVERSE', result.outcome === ETouchOutcome.PURIFY_AND_REVERSE);
	}

	// 원형 wrap-around 구간 (17 <-> 0) 의 연속 판정 (§8.3)
	{
		const slots = makeSlots([16, 17, 0, 1]);
		const run = getContiguousContaminatedRun(slots, 17);
		recorder.check('17 <-> 0 을 넘는 구간도 한 덩어리', run.length === 4, JSON.stringify(run));

		const dial = makeDial([16, 17, 0, 1], 0);
		dial.touch();
		recorder.check('wrap-around 덩어리도 1회 터치로 전체 정화', dial.getContaminatedCount() === 0);
	}

	// 떨어진 덩어리는 함께 정화되지 않는다
	{
		const slots = makeSlots([2, 3, 8, 9]);
		const groups = getContaminatedGroups(slots);
		recorder.check('떨어진 오염은 별개의 덩어리', groups.length === 2, JSON.stringify(groups));

		const dial = makeDial([2, 3, 8, 9], 2);
		dial.touch();
		recorder.check('한 덩어리만 정화된다', dial.getContaminatedCount() === 2);
	}

	// 18칸 전부 오염이어도 무한 루프 없이 한 덩어리로 처리된다
	{
		const all: number[] = [];
		for (let index = 0; index < DIAL_SLOT_COUNT; index++) {
			all.push(index);
		}
		const dial = makeDial(all, 0);
		const result = dial.touch();
		recorder.check('전부 오염이면 18칸이 한 덩어리', result.purifiedSlotIndexes.length === DIAL_SLOT_COUNT, `${result.purifiedSlotIndexes.length}`);
	}

	// 이미 정화된 칸 터치 - 패널티 없음 (§5)
	{
		const dial = makeDial([4, 5], 10, [10]);
		const before = dial.getContaminatedCount();
		const result = dial.touch();
		recorder.check('정화된 칸을 터치해도 오염 수는 그대로', dial.getContaminatedCount() === before);
		recorder.check('정화된 칸 터치는 REVERSE_ONLY', result.outcome === ETouchOutcome.REVERSE_ONLY);
		recorder.check('정화된 칸 터치도 방향 반전은 예약된다', result.didScheduleReverse);
	}
}

//#endregion

//#region §6 바늘과 방향 반전

function testNeedleAndReverse(recorder: TestRecorder): void {
	// 시작은 시계방향 (§6)
	{
		const dial = makeDial([4], 0);
		recorder.check('퍼즐 시작 시 시계방향', dial.needle.direction === DIRECTION_CLOCKWISE);
	}

	// 회전 - angle += dir * speed * dt (§8.2)
	{
		const dial = new ColorFillDial(makeSlots([4]), 90, 0.3, 0);
		dial.update(1);
		recorder.check('1초에 90도 회전', Math.abs(dial.needle.angleDeg - 90) < 1e-6, `${dial.needle.angleDeg}`);
		recorder.check('90도는 4번 칸', dial.getCurrentSlotIndex() === 4);
	}

	// 비활성 영역에서의 터치도 방향 반전이 발생한다 (§6)
	{
		// 3번 칸은 활성/오염 어디에도 속하지 않는다
		const dial = makeDial([8, 9], 3);
		recorder.check('시작 칸은 비활성', dial.getCurrentSlot().isActive === false);

		const before = dial.needle.direction;
		const result = dial.touch();
		recorder.check('비활성 칸 터치도 반전 예약', result.didScheduleReverse && result.outcome === ETouchOutcome.REVERSE_ONLY);

		dial.update(0.4);
		recorder.check('딜레이 후 방향이 반전된다', dial.needle.direction === -before, `${dial.needle.direction}`);
	}

	// 방향 전환 딜레이 (§6)
	{
		const dial = makeDial([8], 0, [], 0.5);
		const before = dial.needle.direction;
		dial.touch();
		recorder.check('터치 직후에는 아직 방향이 그대로', dial.needle.direction === before);
		recorder.check('반전 대기 상태', dial.hasPendingReverse);

		dial.update(0.3);
		recorder.check('딜레이 중에는 아직 그대로', dial.needle.direction === before);

		dial.update(0.3);
		recorder.check('딜레이가 끝나면 반전', dial.needle.direction === -before);
		recorder.check('반전 후에는 대기 상태 해제', dial.hasPendingReverse === false);
	}

	// 딜레이 0이면 즉시 반전
	{
		const dial = makeDial([8], 0, [], 0);
		const before = dial.needle.direction;
		dial.touch();
		recorder.check('딜레이 0이면 즉시 반전', dial.needle.direction === -before);
	}

	// 방향 전환 딜레이 중 재터치 - 입력 잠금이 켜져 있으면 무시된다 (§8.3)
	{
		const dial = new ColorFillDial(makeSlots([8, 9]), 90, 0.5, getSafeStartAngle(8), { isInputLockedDuringReverse: true });
		const first = dial.touch();
		recorder.check('첫 터치는 정화된다', first.purifiedSlotIndexes.length === 2);
		recorder.check('반전 대기 중에는 입력이 잠긴다', dial.isInputAccepted === false);

		const second = dial.touch();
		recorder.check('잠금 중 재터치는 무시된다', second.outcome === ETouchOutcome.IGNORED);
		recorder.check('무시된 터치는 반전을 예약하지 않는다', second.didScheduleReverse === false);
	}

	// 입력 잠금을 끄면 재터치가 처리되고 반전 타이머만 다시 시작한다
	{
		const dial = new ColorFillDial(makeSlots([8, 9]), 90, 0.5, getSafeStartAngle(8), { isInputLockedDuringReverse: false });
		const before = dial.needle.direction;
		dial.touch();
		dial.update(0.3);
		const second = dial.touch();
		recorder.check('잠금을 끄면 재터치가 처리된다', second.outcome !== ETouchOutcome.IGNORED);

		dial.update(0.3);
		recorder.check('타이머가 다시 시작되어 아직 반전되지 않았다', dial.needle.direction === before, `${dial.needle.direction}`);

		dial.update(0.3);
		recorder.check('연타해도 반전은 한 번만 일어난다', dial.needle.direction === -before);
	}

	// 입력 컨트롤러의 연타 방지 (모바일 단일 터치)
	{
		const dial = new ColorFillDial(makeSlots([8]), 90, 0, getSafeStartAngle(0), { isInputLockedDuringReverse: false });
		const input = new ColorFillInputController(dial, { minTouchIntervalSeconds: 0.1 });
		const first = input.touch();
		const second = input.touch();
		recorder.check('같은 프레임의 두 번째 터치는 무시된다', first.outcome !== ETouchOutcome.IGNORED && second.outcome === ETouchOutcome.IGNORED);

		input.update(0.2);
		recorder.check('간격이 지나면 다시 받는다', input.touch().outcome !== ETouchOutcome.IGNORED);
	}
}

//#endregion

//#region §8.4 클리어 판정

function testClearCondition(recorder: TestRecorder): void {
	// 모든 active 슬롯이 CLEAN 이면 클리어
	{
		const dial = makeDial([4, 5], 4, [10, 11]);
		recorder.check('오염이 남아 있으면 미클리어', dial.isSolved() === false);
		dial.touch();
		recorder.check('모두 정화하면 클리어', dial.isSolved());
	}

	// 비활성 칸은 판정에서 제외된다
	{
		const slots = createSlots();
		slots[3].isActive = true;
		// 나머지 15칸은 비활성이며 CLEAN 이다
		const dial = new ColorFillDial(slots, 90, 0.3, getSafeStartAngle(3));
		recorder.check('활성 칸이 모두 정화되어 있으면 클리어', dial.isSolved());
	}

	// 활성 칸이 하나도 없으면 클리어로 보지 않는다
	{
		const dial = new ColorFillDial(createSlots(), 90, 0.3, 0);
		recorder.check('활성 칸이 없으면 클리어가 아니다', dial.isSolved() === false);
	}
}

//#endregion

//#region §8.5 레벨 생성기

function testGeneration(recorder: TestRecorder, tables: ColorFillTables): void {
	const generator = new ColorFillLevelGenerator(tables);

	for (const config of tables.difficultyTable) {
		const generated = generator.generate({
			puzzleId: `TEST_CF_D${config.difficulty}`,
			difficulty: config.difficulty,
			seed: 90000 + config.difficulty,
		});

		if (generated === undefined) {
			recorder.check(`난이도 ${config.difficulty} 생성`, false, '생성 실패');
			continue;
		}

		const verification = generator.verify(generated, config);
		recorder.check(`난이도 ${config.difficulty} 생성 및 검증`, verification.isValid, verification.violations.join(' / '));

		// 활성 칸 수 / 오염 덩어리 구성이 테이블과 일치해야 한다
		recorder.check(`난이도 ${config.difficulty} 활성 칸 수 일치`, countActive(generated.slots) === config.activeSlotCount,
			`${countActive(generated.slots)} != ${config.activeSlotCount}`);

		const groups = getContaminatedGroups(generated.slots).map((group) => group.length).sort((a, b) => a - b);
		const expected = config.contaminationGroupSizes.slice().sort((a, b) => a - b);
		recorder.check(`난이도 ${config.difficulty} 오염 덩어리 구성 일치`, groups.join(',') === expected.join(','),
			`[${groups.join(',')}] != [${expected.join(',')}]`);

		// 오염은 반드시 활성 칸 위에만 있다
		let hasInactiveContamination = false;
		for (const slot of generated.slots) {
			if (slot.state === ESlotState.CONTAMINATED && slot.isActive === false) {
				hasInactiveContamination = true;
			}
		}
		recorder.check(`난이도 ${config.difficulty} 오염은 활성 칸 위에만`, hasInactiveContamination === false);

		// 덩어리가 2개 이상이면 서로 붙어 있지 않아야 한다 (§8.5)
		if (config.contaminationGroupSizes.length > 1) {
			recorder.check(`난이도 ${config.difficulty} 덩어리가 합쳐지지 않았다`,
				getContaminatedGroups(generated.slots).length === config.contaminationGroupSizes.length,
				describeColorFillLevel(generated));
		}
	}

	const first = generator.generate({ puzzleId: 'SEEDED', difficulty: 5, seed: 4321 });
	const second = generator.generate({ puzzleId: 'SEEDED', difficulty: 5, seed: 4321 });
	recorder.check('같은 시드는 같은 레벨을 만든다', JSON.stringify(first) === JSON.stringify(second));
}

//#endregion

//#region §8.6 자동 플레이 봇 밸런싱 검증

function testAutoPlayBot(recorder: TestRecorder, tables: ColorFillTables): void {
	const generator = new ColorFillLevelGenerator(tables);
	const bot = new ColorFillAutoPlayBot();

	for (const config of tables.difficultyTable) {
		const generated = generator.generate({
			puzzleId: `BOT_CF_D${config.difficulty}`,
			difficulty: config.difficulty,
			seed: 91000 + config.difficulty,
		});
		if (generated === undefined) {
			continue;
		}

		// 반응 시간 0.2초 기준.
		// 기획 CSV(NPUZ_04)의 회전 속도를 그대로 쓰면 난이도 6 은 720도/초 + 1칸 덩어리라
		// 노출 시간이 한 칸당 28ms 뿐이고, 0.3초 반응으로는 164판 중 9판만 클리어된다.
		// 자세한 측정치는 Documents/생성 문서/데이터 테이블 구조/PUZ_04_색채우기_데이터테이블_적용.md 참조.
		const play = bot.play(ColorFillDial.fromLevel(generated), {
			timeLimitSeconds: config.timeLimitSeconds,
			reactionSeconds: 0.2,
		});
		recorder.check(`난이도 ${config.difficulty} 봇이 제한 시간 내 클리어`, play.didClear,
			`${play.elapsedSeconds.toFixed(1)}s / 제한 ${config.timeLimitSeconds}s, 남은 오염 ${play.remainingContaminated}`);
		recorder.check(`난이도 ${config.difficulty} 터치 횟수가 덩어리 수 이상`, play.touchCount >= config.contaminationGroupSizes.length,
			`${play.touchCount} < ${config.contaminationGroupSizes.length}`);
	}

	// 방향 전환 딜레이가 비상식적으로 크면 봇이 실패해야 한다 (검증 장치가 실제로 동작하는지)
	{
		const slots = makeSlots([2, 10]);
		const dial = new ColorFillDial(slots, 90, 30, getSafeStartAngle(6));
		const play = bot.play(dial, { timeLimitSeconds: 5, reactionSeconds: 0.4 });
		recorder.check('딜레이가 지나치게 크면 봇이 실패한다', play.didClear === false, `${play.elapsedSeconds}s`);
	}
}

//#endregion

//#region 세션

function testSession(recorder: TestRecorder, tables: ColorFillTables): void {
	const generator = new ColorFillLevelGenerator(tables);

	// 클리어 흐름 - 봇처럼 오염 칸 위에서 터치한다
	{
		const events = new ColorFillEvents();
		let didClear = false;
		let purifiedEvents = 0;
		events.QUEST_CLEAR.subscribe(() => { didClear = true; });
		events.SLOTS_PURIFIED.subscribe(() => { purifiedEvents++; });

		const session = new ColorFillSession(events, tables, generator, { seed: 90001 });
		recorder.check('퀘스트 시작', session.startQuest('QUEST_COLORFILL_D1'));
		recorder.check('입력 대기 상태로 진입', session.state === EColorFillState.PLAYER_INPUT, session.state);
		recorder.check('제한시간이 테이블에서 적용됨',
		session.getRemainingTimeSeconds() === (tables.getDifficultyConfig(1)?.timeLimitSeconds ?? -1),
		`${session.getRemainingTimeSeconds()}`);
		recorder.check('남은 오염 칸을 조회할 수 있다', session.getRemainingContaminatedCount() > 0);

		const step = 1 / 60;
		let guard = 0;
		while (session.state === EColorFillState.PLAYER_INPUT && guard < 60 * 60) {
			const dial = session.dial;
			if (dial !== undefined && dial.getCurrentSlot().state === ESlotState.CONTAMINATED) {
				session.touch();
			}
			session.update(step);
			guard++;
		}
		recorder.check('오염 칸에서 터치하면 클리어된다', session.state === EColorFillState.QUEST_CLEAR, session.state);
		recorder.check('QUEST_CLEAR 이벤트 발행', didClear);
		recorder.check('SLOTS_PURIFIED 이벤트 발행', purifiedEvents > 0);
	}

	// 제한 시간 초과 - 아무것도 하지 않으면 실패한다
	{
		const events = new ColorFillEvents();
		let didFail = false;
		events.QUEST_FAILED.subscribe(() => { didFail = true; });

		const session = new ColorFillSession(events, tables, generator, { seed: 90002 });
		session.startQuest('QUEST_COLORFILL_D1');

		const step = 1 / 60;
		for (let index = 0; index < 60 * 20; index++) {
			session.update(step);
		}
		recorder.check('아무것도 하지 않으면 제한 시간 초과로 실패', didFail && session.state === EColorFillState.GAME_OVER, session.state);
		recorder.check('남은 시간 0', session.getRemainingTimeSeconds() === 0);
		recorder.check('종료 후에는 터치를 받지 않는다', session.touch() === undefined);
	}

	// 일시정지 중에는 바늘이 멈춘다
	{
		const events = new ColorFillEvents();
		const session = new ColorFillSession(events, tables, generator, { seed: 90003 });
		session.startQuest('QUEST_COLORFILL_D2');

		session.update(0.5);
		const angleBefore = session.dial?.needle.angleDeg ?? 0;
		session.pause();
		session.update(1);
		recorder.check('일시정지 중 바늘이 멈춘다', Math.abs((session.dial?.needle.angleDeg ?? 0) - angleBefore) < 1e-9);

		session.resume();
		session.update(0.5);
		recorder.check('재개하면 다시 회전한다', Math.abs((session.dial?.needle.angleDeg ?? 0) - angleBefore) > 1e-9);
	}
}

//#endregion

//#region 기획 데이터 테이블 (NPUZ_04)

/**
 * `Documents/기획서 및 데이터 구조/DataTable/NPUZ_04_FieldData.csv` 에서 생성한 필드 테이블 검증.
 *
 * 이 퍼즐의 CSV 는 오염 덩어리의 **칸 수만** 담고 있어서(각도 정보 없음)
 * 변환기가 18칸 위에 배치한다. 그 결과가 다이얼 규격을 지키는지 여기서 확인한다.
 */
function testCsvFieldTable(recorder: TestRecorder, tables: ColorFillTables): void {
	const fields = COLORFILL_CSV_FIELD_TABLE;
	recorder.check('CSV 필드 테이블이 비어 있지 않다', fields.length > 0, `${fields.length}`);
	recorder.check('운영 테이블이 CSV 를 쓴다', tables.fieldTable.length === fields.length);

	const validator = new ColorFillPlacementValidator();
	const bot = new ColorFillAutoPlayBot();
	const invalid: string[] = [];
	const notCleared: string[] = [];
	const difficulties: number[] = [];

	for (const field of fields) {
		const level = tables.buildLevel(field);

		// 난이도 설정과 대조하지 않는다. 판마다 덩어리 구성과 활성 칸 수가 다르기 때문이다
		const result = validator.validate(level);
		if (result.isValid === false) {
			invalid.push(`${field.puzzleId}: ${result.violations.join(' / ')}`);
		}

		// 반응 0.2초면 기획 판 전부가 클리어 가능해야 한다 (그보다 느리면 난이도 6이 무너진다)
		const play = bot.play(ColorFillDial.fromLevel(level), { timeLimitSeconds: 120, reactionSeconds: 0.2 });
		if (play.didClear === false) {
			notCleared.push(field.puzzleId);
		}
		if (difficulties.indexOf(field.difficulty) < 0) {
			difficulties.push(field.difficulty);
		}
	}

	recorder.check('모든 CSV 레벨이 다이얼 규격을 만족', invalid.length === 0, invalid.slice(0, 3).join(' | '));
	recorder.check('반응 0.2초 봇이 모든 CSV 레벨을 클리어', notCleared.length === 0, notCleared.slice(0, 5).join());

	const orphans = difficulties.filter((difficulty) => tables.getDifficultyConfig(difficulty) === undefined);
	recorder.check('모든 난이도가 난이도 테이블에 있다', orphans.length === 0, orphans.join());

	for (const config of tables.difficultyTable) {
		const count = tables.getFieldsForDifficulty(config.difficulty).length;
		recorder.check(`난이도 ${config.difficulty} 판이 존재`, count > 0, `${count}`);
	}
}

//#endregion
