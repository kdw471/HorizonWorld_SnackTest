/**
 * Color Sort Tests - PUZ_03 §10.6 "테스트" 항목
 *
 *   3개 초과 런 이동 시도 / 가득 찬 케이스로 이동 / 잔여 공간 부족 이동 /
 *   블랙 공개 타이밍 / 블랙 단일 이동 / 영역 밖 드랍 2초 리스폰 및 케이스 잠금 /
 *   같은 케이스 양손 그랩 금지 (모바일에서는 "조작 중 추가 터치 무시" 로 대체)
 *
 * 여기에 더해 데드락 감지(§2), 클리어 판정(§10.5), 레벨 생성기(§10.4)를 검증한다.
 *
 * Horizon Component 가 아니라 순수 검증 하네스다. `runColorSortTests()` 를 호출하면 결과를 돌려준다.
 */

import { ColorSortBoard, createCases } from 'ColorSort_Board';
import { ColorSortDragController } from 'ColorSort_DragController';
import { ColorSortEvents } from 'ColorSort_GameEvents';
import { ColorSortLevelGenerator, ColorSortPlacementValidator } from 'ColorSort_LevelGenerator';
import { ColorSortSession } from 'ColorSort_Session';
import { ColorSortSolver } from 'ColorSort_Solver';
import { COLORSORT_CSV_FIELD_TABLE, ColorSortTables } from 'ColorSort_DataTables';
import {
	Battery,
	BatteryCase,
	CASE_CAPACITY,
	EBatteryColor,
	ECaseState,
	EColorSortFailReason,
	EColorSortState,
	EMoveRejection,
	MAX_MOVE_RUN,
	OUT_OF_BOUNDS_RESPAWN_SECONDS,
	getMovableCount,
} from 'ColorSort_Definitions';

export type ColorSortTestResult = {
	name: string,
	isPassed: boolean,
	detail?: string,
}

export type ColorSortTestReport = {
	passed: number,
	failed: number,
	results: ColorSortTestResult[],
}

class TestRecorder {
	public readonly results: ColorSortTestResult[] = [];

	public check(name: string, condition: boolean, detail?: string): void {
		this.results.push({ name: name, isPassed: condition, detail: condition ? undefined : detail });
	}
}

export function runColorSortTests(): ColorSortTestReport {
	const recorder = new TestRecorder();
	const tables = new ColorSortTables();

	testMoveRules(recorder);
	testUnknownBatteries(recorder);
	testCaseStates(recorder);
	testDeadlockAndClear(recorder);
	testDragInteraction(recorder);
	testGeneration(recorder, tables);
	testSession(recorder, tables);
	testCsvFieldTable(recorder, tables);

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

let batteryCounter = 0;

function makeBattery(color: EBatteryColor, isRevealed: boolean = true): Battery {
	batteryCounter++;
	return { id: `B${batteryCounter}`, color: color, isRevealed: isRevealed };
}

/** 케이스 스택을 아래 -> 위 순서로 지정해 보드를 만든다 */
function makeBoard(stacks: (EBatteryColor | { color: EBatteryColor, hidden: true })[][], totalCases?: number): ColorSortBoard {
	const total = totalCases ?? stacks.length;
	const cases: BatteryCase[] = createCases(stacks.length, total, CASE_CAPACITY);

	for (let index = 0; index < stacks.length; index++) {
		for (const entry of stacks[index]) {
			if (typeof entry === 'string') {
				cases[index].batteries.push(makeBattery(entry));
			}
			else {
				cases[index].batteries.push(makeBattery(entry.color, false));
			}
		}
	}
	return new ColorSortBoard(cases);
}

const R = EBatteryColor.RED;
const G = EBatteryColor.GREEN;
const B = EBatteryColor.BLUE;
const Y = EBatteryColor.YELLOW;

//#endregion

//#region §6 / §10.2 이동 규칙

function testMoveRules(recorder: TestRecorder): void {
	// 최상단 동일색 런이 함께 움직인다 (§6)
	{
		const board = makeBoard([[G, R, R], []]);
		const check = board.canMove(0, 1);
		recorder.check('연속된 같은 색은 함께 이동한다', check.isValid && check.count === 2, JSON.stringify(check));

		board.move(0, 1);
		recorder.check('런 전체가 옮겨졌다', board.getCase(1)?.batteries.length === 2 && board.getCase(0)?.batteries.length === 1);
	}

	// 3개 초과 런은 3개까지만 옮긴다 (§6 "한 번에 이동할 수 있는 수량은 1~3개")
	{
		const board = makeBoard([[R, R, R, R], []]);
		// 같은 색 4개 = 완성된 케이스이므로 닫혀서 출발지가 될 수 없다 (§4)
		recorder.check('같은 색 4개는 닫힘 상태', board.getCaseState(0) === ECaseState.CLOSED_COMPLETE);
		recorder.check('닫힌 케이스에서는 이동 불가', board.canMove(0, 1).rejection === EMoveRejection.SOURCE_NOT_OPEN);
	}
	{
		// 색이 섞여 있어 닫히지 않은 상태에서 런이 3을 넘는 경우
		const stack: BatteryCase[] = createCases(2, 2, 5);
		stack[0].batteries.push(makeBattery(G), makeBattery(R), makeBattery(R), makeBattery(R), makeBattery(R));
		const board = new ColorSortBoard(stack);
		recorder.check('런이 4여도 옮기는 개수는 3으로 제한된다', getMovableCount(board.getCase(0)!) === MAX_MOVE_RUN, `${getMovableCount(board.getCase(0)!)}`);
	}

	// 가득 찬 케이스로 이동 불가 (§6)
	{
		const board = makeBoard([[R], [G, G, G, G]]);
		recorder.check('가득 찬(닫힌) 케이스로는 이동할 수 없다', board.canMove(0, 1).rejection === EMoveRejection.DESTINATION_NOT_OPEN);
	}
	{
		// 가득 찼지만 색이 섞여 닫히지 않은 케이스
		const board = makeBoard([[R], [G, R, G, R]]);
		const check = board.canMove(0, 1);
		recorder.check('가득 찬 케이스는 잔여 공간 부족으로 거절', check.isValid === false && check.rejection === EMoveRejection.NOT_ENOUGH_SPACE, JSON.stringify(check));
	}

	// 잔여 공간 부족 (§6 "옮겨지는 수가 남은 공간을 넘으면 이동되지 않는다")
	{
		const board = makeBoard([[G, R, R], [R, R, R]]);
		const check = board.canMove(0, 1);
		recorder.check('잔여 공간(1) < 옮길 개수(2) 면 거절', check.isValid === false && check.rejection === EMoveRejection.NOT_ENOUGH_SPACE, JSON.stringify(check));
	}

	// 색이 다르면 이동 불가 (§6)
	{
		const board = makeBoard([[R], [G]]);
		recorder.check('최상단 색이 다르면 이동 불가', board.canMove(0, 1).rejection === EMoveRejection.COLOR_MISMATCH);
	}

	// 빈 케이스로는 언제나 이동 가능 (§6)
	{
		const board = makeBoard([[G, R], []]);
		recorder.check('빈 케이스로는 이동 가능', board.canMove(0, 1).isValid);
	}

	// 빈 케이스에서는 집을 수 없다 (§10.2 (a))
	{
		const board = makeBoard([[], [R]]);
		recorder.check('빈 케이스에서는 이동 불가', board.canMove(0, 1).rejection === EMoveRejection.SOURCE_EMPTY);
	}

	// 같은 케이스로는 이동 불가
	{
		const board = makeBoard([[R], []]);
		recorder.check('같은 케이스로는 이동 불가', board.canMove(0, 0).rejection === EMoveRejection.SAME_CASE);
	}
}

//#endregion

//#region §7 블랙(미지) 건전지

function testUnknownBatteries(recorder: TestRecorder): void {
	// 최상단에 노출되면 공개된다
	{
		const board = makeBoard([[{ color: G, hidden: true }, R], []]);
		recorder.check('아래에 깔린 블랙은 미공개', board.getCase(0)?.batteries[0].isRevealed === false);

		board.move(0, 1);
		recorder.check('위가 치워지면 공개된다', board.getCase(0)?.batteries[0].isRevealed === true);
		recorder.check('공개된 색은 원래 색', board.getCase(0)?.batteries[0].color === G);
	}

	// 보드 생성 시점에 최상단이면 즉시 공개된다
	{
		const board = makeBoard([[{ color: B, hidden: true }], []]);
		recorder.check('시작 시 최상단 블랙은 즉시 공개', board.getCase(0)?.batteries[0].isRevealed === true);
	}

	// 블랙은 단일로만 움직인다 (런에 포함되지 않는다)
	{
		const stack: BatteryCase[] = createCases(2, 2, CASE_CAPACITY);
		// 아래 -> 위: R, R(블랙), R  -> 최상단 R 은 그 아래가 미공개라 런이 끊긴다
		stack[0].batteries.push(makeBattery(R), makeBattery(R, false), makeBattery(R));
		const board = new ColorSortBoard(stack);
		recorder.check('미공개 건전지는 런을 끊는다', getMovableCount(board.getCase(0)!) === 1, `${getMovableCount(board.getCase(0)!)}`);
	}

	// §10.3 - 미공개 건전지는 빈 케이스로만 이동 가능
	{
		const stack: BatteryCase[] = createCases(3, 3, CASE_CAPACITY);
		stack[0].batteries.push(makeBattery(R, false));
		stack[1].batteries.push(makeBattery(R));
		const board = new ColorSortBoard(stack);
		// 보드 생성 시 최상단이라 자동 공개되므로, 규칙 자체를 직접 확인한다
		board.getCase(0)!.batteries[0].isRevealed = false;
		recorder.check('미공개는 색이 같아도 비지 않은 케이스로 이동 불가', board.canMove(0, 1).rejection === EMoveRejection.UNKNOWN_NEEDS_EMPTY);
		recorder.check('미공개도 빈 케이스로는 이동 가능', board.canMove(0, 2).isValid);
	}
}

//#endregion

//#region §4 케이스 상태

function testCaseStates(recorder: TestRecorder): void {
	const board = makeBoard([[R, R, R, R], [G, R], []], 4);

	recorder.check('같은 색으로 가득 차면 닫힘', board.getCaseState(0) === ECaseState.CLOSED_COMPLETE);
	recorder.check('색이 섞여 있으면 열림 유지', board.getCaseState(1) === ECaseState.OPEN);
	recorder.check('비어 있으면 열림 유지', board.getCaseState(2) === ECaseState.OPEN);
	recorder.check('활성화되지 않은 케이스는 닫힘(비활성)', board.getCaseState(3) === ECaseState.DISABLED);

	board.lockCase(1);
	recorder.check('잠긴 케이스는 LOCKED', board.getCaseState(1) === ECaseState.LOCKED);
	recorder.check('잠긴 케이스는 조작 불가', board.canMove(1, 2).rejection === EMoveRejection.SOURCE_NOT_OPEN);
	board.unlockCase(1);
	recorder.check('잠금 해제되면 다시 열림', board.getCaseState(1) === ECaseState.OPEN);

	recorder.check('비활성 케이스로는 이동 불가', board.canMove(1, 3).rejection === EMoveRejection.DESTINATION_NOT_OPEN);
}

//#endregion

//#region §2 데드락 / §10.5 클리어

function testDeadlockAndClear(recorder: TestRecorder): void {
	// 클리어: 모든 색이 각각 하나의 케이스에 4개로 모임
	{
		const board = makeBoard([[R, R, R, R], [G, G, G, G], []]);
		recorder.check('모든 색이 정렬되면 클리어', board.isSolved());
		recorder.check('클리어 상태는 데드락이 아니다', board.isDeadlocked() === false);
	}

	// 같은 색이 두 케이스에 나뉘어 있으면 아직 클리어가 아니다
	{
		const board = makeBoard([[R, R], [R, R], []]);
		recorder.check('같은 색이 나뉘어 있으면 미클리어', board.isSolved() === false);
	}

	// 데드락: 이동할 수 있는 뭉치가 하나도 없다
	{
		// 빈 케이스가 없고, 모든 케이스가 가득 찼으며 최상단 색이 서로 다르다
		const board = makeBoard([[R, G, B, Y], [G, B, Y, R], [B, Y, R, G]]);
		recorder.check('이동 가능한 수가 없으면 데드락', board.isDeadlocked(), JSON.stringify(board.getValidMoves()));
		recorder.check('데드락 상태에서 유효 이동 0개', board.getValidMoves().length === 0);
	}

	// 데드락이 아닌 경우
	{
		const board = makeBoard([[R, G, B, Y], [G, B, Y, R], []]);
		recorder.check('빈 케이스가 있으면 데드락이 아니다', board.isDeadlocked() === false);
	}
}

//#endregion

//#region 모바일 드래그 조작 (§8 를 단일 터치로 대체)

function testDragInteraction(recorder: TestRecorder): void {
	// 케이스 1 은 R 3개로 채워 잔여 공간을 1칸만 남긴다 (2개짜리 뭉치를 받을 수 없다)
	const board = makeBoard([[G, R, R], [R, R, R], []]);
	const drag = new ColorSortDragController(board);

	// 그랩 - 최상단 뭉치를 집는다
	const begin = drag.begin(0);
	recorder.check('최상단 동일색 뭉치를 집는다', begin.isAccepted && begin.count === 2, JSON.stringify(begin));

	// 단일 터치 전용 - 조작 중 추가 터치 무시 (VR 의 양손 그랩 대체)
	const second = drag.begin(1);
	recorder.check('조작 중 추가 터치는 무시된다', second.isAccepted === false && second.reason === 'already-dragging');

	// 미리보기 - 놓을 수 있는 곳에서만 활성화된다
	const validPreview = drag.hover(2);
	recorder.check('빈 케이스 위에서 미리보기 활성', validPreview?.isPreviewActive === true);

	const invalidPreview = drag.hover(1);
	recorder.check('잔여 공간이 부족하면 미리보기 비활성', invalidPreview?.isPreviewActive === false, JSON.stringify(invalidPreview));
	recorder.check('비활성 사유를 알려준다', invalidPreview?.rejection === EMoveRejection.NOT_ENOUGH_SPACE, invalidPreview?.rejection);

	const outsidePreview = drag.hover(undefined);
	recorder.check('영역 밖에서는 미리보기 비활성', outsidePreview?.isPreviewActive === false);

	// 드랍 - 유효한 곳
	drag.hover(2);
	const dropped = drag.end();
	recorder.check('유효한 곳에 드랍하면 이동', dropped?.didMove === true && dropped.toCaseIndex === 2, JSON.stringify(dropped));
	recorder.check('실제로 옮겨졌다', board.getCase(2)?.batteries.length === 2);

	// 영역 밖 드랍 -> 2초 리스폰 + 케이스 잠금 (§8)
	recorder.check('다시 그랩', drag.begin(0).isAccepted);
	const outsideDrop = drag.end(undefined);
	recorder.check('영역 밖 드랍은 이동하지 않는다', outsideDrop?.didMove === false);
	recorder.check('리스폰 대기에 들어간다', outsideDrop?.isRespawning === true);
	recorder.check('리스폰될 때까지 케이스는 잠금', board.getCaseState(0) === ECaseState.LOCKED);
	recorder.check('리스폰 대기 시간은 2초', Math.abs(drag.getRespawnRemainingSeconds() - OUT_OF_BOUNDS_RESPAWN_SECONDS) < 1e-9, `${drag.getRespawnRemainingSeconds()}`);

	recorder.check('1초 경과 시점에는 아직 잠금', drag.update(1).length === 0 && board.getCaseState(0) === ECaseState.LOCKED);

	const respawned = drag.update(1.1);
	recorder.check('2초 후 리스폰된다', respawned.length === 1 && respawned[0].caseIndex === 0, JSON.stringify(respawned));
	recorder.check('리스폰되면 잠금이 풀린다', board.getCaseState(0) === ECaseState.OPEN);
	recorder.check('건전지는 이전 위치 그대로', board.getCase(0)?.batteries.length === 1);

	// 연속 영역 밖 드랍 - 각 드랍은 자기만의 2초를 온전히 기다려야 한다
	{
		const multiBoard = makeBoard([[G, R], [R, G], []]);
		const multiDrag = new ColorSortDragController(multiBoard);
		multiDrag.begin(0);
		multiDrag.end(undefined);
		multiDrag.update(0.5);
		multiDrag.begin(1);
		multiDrag.end(undefined);
		recorder.check('두 케이스가 동시에 리스폰 대기', multiDrag.isRespawning && multiBoard.getCaseState(0) === ECaseState.LOCKED && multiBoard.getCaseState(1) === ECaseState.LOCKED);

		// 첫 드랍은 2.0초에, 둘째 드랍은 2.5초에 끝난다
		const firstBatch = multiDrag.update(1.6);
		recorder.check('앞선 리스폰만 먼저 끝난다', firstBatch.length === 1 && firstBatch[0].caseIndex === 0);
		recorder.check('뒤 드랍의 잠금은 조기 해제되지 않는다', multiBoard.getCaseState(1) === ECaseState.LOCKED);

		const secondBatch = multiDrag.update(0.5);
		recorder.check('뒤 리스폰도 제 시간에 끝난다', secondBatch.length === 1 && secondBatch[0].caseIndex === 1);
		recorder.check('모든 잠금 해제', multiBoard.getCaseState(0) === ECaseState.OPEN && multiBoard.getCaseState(1) === ECaseState.OPEN);
	}

	// 집었던 케이스 위에 그대로 놓으면 벌점 없이 제자리 (리스폰 잠금 없음)
	{
		const sameBoard = makeBoard([[G, R], []]);
		const sameDrag = new ColorSortDragController(sameBoard);
		sameDrag.begin(0);
		const sameDrop = sameDrag.end(0);
		recorder.check('제자리 드랍은 이동하지 않는다', sameDrop?.didMove === false && sameDrop.rejection === EMoveRejection.SAME_CASE, JSON.stringify(sameDrop));
		recorder.check('제자리 드랍은 리스폰 잠금이 없다', sameDrop?.isRespawning === false && sameBoard.getCaseState(0) === ECaseState.OPEN);
	}

	// CASE_CLOSED 는 "이번 이동으로 새로 닫힌" 케이스만 담아야 한다
	{
		const closeBoard = makeBoard([[G, G, G, G], [R, R, R], [R]]);
		recorder.check('이미 닫힌 케이스가 있는 보드', closeBoard.getCaseState(0) === ECaseState.CLOSED_COMPLETE);
		const closeMove = closeBoard.move(2, 1);
		recorder.check('새로 닫힌 케이스만 알린다', closeMove !== undefined && closeMove.closedCaseIndexes.length === 1 && closeMove.closedCaseIndexes[0] === 1, JSON.stringify(closeMove?.closedCaseIndexes));
	}
}

//#endregion

//#region §10.4 레벨 생성기

function testGeneration(recorder: TestRecorder, tables: ColorSortTables): void {
	const generator = new ColorSortLevelGenerator(tables);
	const solver = new ColorSortSolver();

	for (const config of tables.difficultyTable) {
		const generated = generator.generate({
			puzzleId: `TEST_CS_D${config.difficulty}`,
			difficulty: config.difficulty,
			seed: 777000 + config.difficulty,
		});

		if (generated === undefined) {
			recorder.check(`난이도 ${config.difficulty} 생성`, false, '생성 실패');
			continue;
		}

		const verification = generator.verify(generated);
		recorder.check(`난이도 ${config.difficulty} 생성 및 검증`, verification.isValid, verification.violations.join(' / '));

		const board = ColorSortBoard.fromLevel(generated);
		recorder.check(`난이도 ${config.difficulty} 시작부터 클리어가 아님`, board.isSolved() === false);
		recorder.check(`난이도 ${config.difficulty} 시작부터 데드락이 아님`, board.isDeadlocked() === false);

		// 블랙 건전지는 최상단에 있을 수 없다 (§7)
		let hasTopUnknown = false;
		for (const batteryCase of generated.cases) {
			const top = batteryCase.batteries[batteryCase.batteries.length - 1];
			if (top !== undefined && top.isRevealed === false) {
				hasTopUnknown = true;
			}
		}
		recorder.check(`난이도 ${config.difficulty} 블랙이 최상단에 없다`, hasTopUnknown === false);

		// 해를 재생하면 실제로 클리어되어야 한다
		const solution = solver.solve(board);
		recorder.check(`난이도 ${config.difficulty} 해가 존재`, solution.isSolvable);

		const replay = ColorSortBoard.fromLevel(generated);
		let didReplay = true;
		for (const step of solution.steps) {
			if (replay.move(step.fromCaseIndex, step.toCaseIndex) === undefined) {
				didReplay = false;
				break;
			}
		}
		recorder.check(`난이도 ${config.difficulty} 해 재생 시 클리어`, didReplay && replay.isSolved());
	}

	const first = generator.generate({ puzzleId: 'SEEDED', difficulty: 3, seed: 2024 });
	const second = generator.generate({ puzzleId: 'SEEDED', difficulty: 3, seed: 2024 });
	recorder.check('같은 시드는 같은 레벨을 만든다', JSON.stringify(first) === JSON.stringify(second));
}

//#endregion

//#region 세션

function testSession(recorder: TestRecorder, tables: ColorSortTables): void {
	const generator = new ColorSortLevelGenerator(tables);
	const solver = new ColorSortSolver();

	// 클리어 흐름
	{
		const events = new ColorSortEvents();
		let didClear = false;
		events.QUEST_CLEAR.subscribe(() => { didClear = true; });

		const session = new ColorSortSession(events, tables, generator, solver, { seed: 555 });
		recorder.check('퀘스트 시작', session.startQuest('QUEST_COLORSORT_D1'));
		recorder.check('입력 대기 상태로 진입', session.state === EColorSortState.PLAYER_INPUT, session.state);
		recorder.check('제한시간이 테이블에서 적용됨', session.getRemainingTimeSeconds() === 120);

		const progress = session.getRoundProgress();
		recorder.check('라운드 진행도 조회', progress.current === 1 && progress.total === 1);
		recorder.check('힌트 제공', session.getHintStep() !== undefined);

		// 힌트를 따라 끝까지 풀어본다
		let guard = 0;
		while (session.state === EColorSortState.PLAYER_INPUT && guard < 200) {
			const hint = session.getHintStep();
			if (hint === undefined) {
				break;
			}
			session.beginDrag(hint.fromCaseIndex);
			session.hoverDrag(hint.toCaseIndex);
			session.endDrag();
			guard++;
		}
		recorder.check('힌트를 따라가면 클리어된다', session.state === EColorSortState.QUEST_CLEAR, session.state);
		recorder.check('QUEST_CLEAR 이벤트 발행', didClear);
	}

	// 제한 시간 초과
	{
		const events = new ColorSortEvents();
		let failReason: EColorSortFailReason | undefined = undefined;
		events.QUEST_FAILED.subscribe((data) => { failReason = data.failReason; });

		const session = new ColorSortSession(events, tables, generator, solver, { seed: 556 });
		session.startQuest('QUEST_COLORSORT_D1');
		session.update(119);
		recorder.check('제한시간 전에는 계속 진행', session.state === EColorSortState.PLAYER_INPUT);
		session.update(2);
		recorder.check('제한시간 초과 시 실패', session.state === EColorSortState.GAME_OVER);
		recorder.check('실패 사유가 TIME_OUT', failReason === EColorSortFailReason.TIME_OUT, failReason);
		recorder.check('종료 후에는 입력을 받지 않는다', session.beginDrag(0).isAccepted === false);
	}

	// 영역 밖 드랍 후 리스폰이 세션 업데이트로 진행된다
	{
		const events = new ColorSortEvents();
		let respawnStarted = -1;
		let respawnFinished = -1;
		events.RESPAWN_STARTED.subscribe((index) => { respawnStarted = index; });
		events.RESPAWN_FINISHED.subscribe((index) => { respawnFinished = index; });

		const session = new ColorSortSession(events, tables, generator, solver, { seed: 557 });
		session.startQuest('QUEST_COLORSORT_D1');

		const board = session.board;
		if (board !== undefined) {
			// 건전지가 들어 있는 케이스를 찾아 집는다
			let sourceIndex = -1;
			for (const batteryCase of board.cases) {
				if (board.isCaseOperable(batteryCase.index) && batteryCase.batteries.length > 0) {
					sourceIndex = batteryCase.index;
					break;
				}
			}

			recorder.check('집을 수 있는 케이스가 있다', sourceIndex >= 0);
			if (sourceIndex >= 0) {
				session.beginDrag(sourceIndex);
				session.endDrag(undefined);
				recorder.check('RESPAWN_STARTED 발행', respawnStarted === sourceIndex, `${respawnStarted}`);
				recorder.check('리스폰 대기 중 케이스 잠금', board.getCaseState(sourceIndex) === ECaseState.LOCKED);

				session.update(2.5);
				recorder.check('RESPAWN_FINISHED 발행', respawnFinished === sourceIndex, `${respawnFinished}`);
				recorder.check('리스폰 후 잠금 해제', board.getCaseState(sourceIndex) === ECaseState.OPEN);
			}
		}
	}
}

//#endregion

//#region 기획 데이터 테이블 (NPUZ_03)

/**
 * `Documents/기획서 및 데이터 구조/DataTable/NPUZ_03_FieldData.csv` 에서 생성한 필드 테이블 검증.
 * CSV 를 갱신했을 때 규칙을 깨는 행이 섞여 들어오면 여기서 잡힌다.
 */
function testCsvFieldTable(recorder: TestRecorder, tables: ColorSortTables): void {
	const fields = COLORSORT_CSV_FIELD_TABLE;
	recorder.check('CSV 필드 테이블이 비어 있지 않다', fields.length > 0, `${fields.length}`);
	recorder.check('운영 테이블이 CSV 를 쓴다', tables.fieldTable.length === fields.length);

	const validator = new ColorSortPlacementValidator();
	const solver = new ColorSortSolver();
	const invalid: string[] = [];
	const unsolved: string[] = [];
	const preSolved: string[] = [];
	const difficulties: number[] = [];

	for (const field of fields) {
		const level = tables.buildLevel(field);
		const result = validator.validate(level);
		if (result.isValid === false) {
			invalid.push(`${field.puzzleId}: ${result.violations.join(' / ')}`);
		}

		const board = ColorSortBoard.fromLevel(level);
		if (board.isSolved()) {
			preSolved.push(field.puzzleId);
		}
		if (solver.solve(board, { maxStates: 400000, maxDepth: 200 }).isSolvable === false) {
			unsolved.push(field.puzzleId);
		}
		if (difficulties.indexOf(field.difficulty) < 0) {
			difficulties.push(field.difficulty);
		}
	}

	recorder.check('모든 CSV 레벨이 배치 규칙을 만족', invalid.length === 0, invalid.slice(0, 3).join(' | '));
	recorder.check('시작부터 클리어된 판이 없다', preSolved.length === 0, preSolved.join());
	recorder.check('모든 CSV 레벨에 해가 존재', unsolved.length === 0, unsolved.slice(0, 5).join());

	const orphans = difficulties.filter((difficulty) => tables.getDifficultyConfig(difficulty) === undefined);
	recorder.check('모든 난이도가 난이도 테이블에 있다', orphans.length === 0, orphans.join());

	for (const config of tables.difficultyTable) {
		const count = tables.getFieldsForDifficulty(config.difficulty).length;
		recorder.check(`난이도 ${config.difficulty} 판이 존재`, count > 0, `${count}`);
	}
}

//#endregion
