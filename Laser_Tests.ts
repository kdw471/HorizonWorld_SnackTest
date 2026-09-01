/**
 * Laser Tests - PUZ_01 §8.4 "다음 예외를 반드시 테스트한다"
 *
 *   - 직각 삼각형에 평면 방향으로 입사 -> 되돌아감
 *   - 해골에 레이저 도달 -> 전 수신체 Fault, 클리어 불가
 *   - 중계체를 경유하지 않고 수신체 도달 -> 클리어 실패
 *   - 색이 다른 레이저가 수신체 도달 -> 클리어 실패
 *   - 서로 다른 색 레이저는 층이 다르므로 교차해도 간섭하지 않음
 *
 * 여기에 더해 무한 루프 방지(§8.1), 솔버/생성기(§8.3), 모바일 드래그 조작을 검증한다.
 *
 * Horizon Component 가 아니라 순수 검증 하네스다. `runLaserTests()` 를 호출하면 결과를 돌려준다.
 */

import { LaserBeamTracer } from 'Laser_BeamTracer';
import { LaserBoard } from 'Laser_Board';
import { LaserDragController } from 'Laser_DragController';
import { LaserEvents } from 'Laser_GameEvents';
import { LaserLevelGenerator } from 'Laser_LevelGenerator';
import { LaserSession } from 'Laser_Session';
import { LaserSolver } from 'Laser_Solver';
import { LaserTables } from 'Laser_DataTables';
import {
	ECrystalType,
	EGimmickType,
	ELaserColor,
	ELaserDirection,
	ELaserState,
	EObjectState,
	ETeeBlockedSide,
	ETriangleCorner,
	LASER_MAX_TRACE_SEGMENTS,
	LaserGimmick,
	getCrystalOutputs,
	getOppositeDirection,
	reflectTriangle,
} from 'Laser_Definitions';

export type LaserTestResult = {
	name: string,
	isPassed: boolean,
	detail?: string,
}

export type LaserTestReport = {
	passed: number,
	failed: number,
	results: LaserTestResult[],
}

class TestRecorder {
	public readonly results: LaserTestResult[] = [];

	public check(name: string, condition: boolean, detail?: string): void {
		this.results.push({ name: name, isPassed: condition, detail: condition ? undefined : detail });
	}
}

export function runLaserTests(): LaserTestReport {
	const recorder = new TestRecorder();
	const tables = new LaserTables();

	testCrystalBehaviour(recorder);
	testSampleLevel(recorder, tables);
	testExceptions(recorder);
	testLoopPrevention(recorder);
	testSolverAndGenerator(recorder, tables);
	testDragInteraction(recorder, tables);
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

//#region 크리스탈 동작 (§4.1)

function testCrystalBehaviour(recorder: TestRecorder): void {
	// 직각 삼각형 - 빗변 반사 / 평면 되돌림
	// BOTTOM_RIGHT: 직각이 우하단이므로 평면은 아래·오른쪽, 빗변은 BL->TR (`/`)
	recorder.check('삼각형 BR: 빗변 입사 RIGHT -> UP', reflectTriangle(ETriangleCorner.BOTTOM_RIGHT, ELaserDirection.RIGHT)[0] === ELaserDirection.UP);
	recorder.check('삼각형 BR: 빗변 입사 DOWN -> LEFT', reflectTriangle(ETriangleCorner.BOTTOM_RIGHT, ELaserDirection.DOWN)[0] === ELaserDirection.LEFT);
	recorder.check('삼각형 BR: 평면 입사 LEFT -> 되돌아감', reflectTriangle(ETriangleCorner.BOTTOM_RIGHT, ELaserDirection.LEFT)[0] === ELaserDirection.RIGHT);
	recorder.check('삼각형 BR: 평면 입사 UP -> 되돌아감', reflectTriangle(ETriangleCorner.BOTTOM_RIGHT, ELaserDirection.UP)[0] === ELaserDirection.DOWN);

	// BOTTOM_LEFT: 평면은 아래·왼쪽, 빗변은 TL->BR (`\`)
	recorder.check('삼각형 BL: 빗변 입사 LEFT -> UP', reflectTriangle(ETriangleCorner.BOTTOM_LEFT, ELaserDirection.LEFT)[0] === ELaserDirection.UP);
	recorder.check('삼각형 BL: 평면 입사 RIGHT -> 되돌아감', reflectTriangle(ETriangleCorner.BOTTOM_LEFT, ELaserDirection.RIGHT)[0] === ELaserDirection.LEFT);

	// 반사는 가역적이어야 한다 (거울이므로)
	const forward = reflectTriangle(ETriangleCorner.BOTTOM_RIGHT, ELaserDirection.RIGHT)[0];
	const backward = reflectTriangle(ETriangleCorner.BOTTOM_RIGHT, getOppositeDirection(forward))[0];
	recorder.check('삼각형 반사는 가역적', backward === getOppositeDirection(ELaserDirection.RIGHT));

	// 분배 / 흡수
	const octagon = getCrystalOutputs({ id: 'o', type: ECrystalType.OCTAGON }, ELaserDirection.RIGHT);
	recorder.check('팔각: 대각선 4방향으로 분배', octagon.length === 4 && octagon.every((direction) => direction.indexOf('_') > 0), octagon.join());

	const cross = getCrystalOutputs({ id: 'c', type: ECrystalType.CROSS }, ELaserDirection.RIGHT);
	recorder.check('십자: 직각 4방향으로 분배', cross.length === 4 && cross.every((direction) => direction.indexOf('_') < 0), cross.join());

	recorder.check('꽃: 모든 광선 흡수', getCrystalOutputs({ id: 'f', type: ECrystalType.FLOWER }, ELaserDirection.RIGHT).length === 0);

	// T자 - "2~3방향으로 분배". 되돌아가는 팔만 제외한다.
	const teeFromArm = getCrystalOutputs({ id: 't', type: ECrystalType.TEE, blockedSide: ETeeBlockedSide.BLOCKED_DOWN }, ELaserDirection.DOWN);
	recorder.check('T자(ㅗ): 팔로 들어오면 그 팔을 빼고 2방향', teeFromArm.length === 2 && teeFromArm.indexOf(ELaserDirection.UP) < 0, teeFromArm.join());

	const teeFromBlocked = getCrystalOutputs({ id: 't', type: ECrystalType.TEE, blockedSide: ETeeBlockedSide.BLOCKED_DOWN }, ELaserDirection.UP);
	recorder.check('T자(ㅗ): 막힌 쪽으로 들어오면 3방향', teeFromBlocked.length === 3, teeFromBlocked.join());
}

//#endregion

//#region 샘플 레벨

function testSampleLevel(recorder: TestRecorder, tables: LaserTables): void {
	const field = tables.getField('LZ_D1_001');
	if (field === undefined) {
		recorder.check('샘플 필드 LZ_D1_001 존재', false);
		return;
	}

	const level = tables.buildLevel(field);
	const board = LaserBoard.fromLevel(level);
	const tracer = new LaserBeamTracer();

	recorder.check('크리스탈을 놓기 전에는 미클리어', tracer.traceAndCheck(board).isSolved === false);
	recorder.check('테두리에는 크리스탈을 놓을 수 없다 (§5.1)', board.canPlaceAt(-1, 2).isPlaced === false);
	recorder.check('배치 영역 밖 인덱스도 거부', board.canPlaceAt(5, 0).isPlaced === false);

	recorder.check('삼각형 배치 성공', board.placeFromInventory('INV_TRI_0', 2, 2).isPlaced);

	const checked = tracer.traceAndCheck(board);
	recorder.check('수신체 점등', checked.result.litReceiverIds.indexOf('RECV_RED') >= 0, checked.result.litReceiverIds.join());
	recorder.check('클리어', checked.isSolved);
	recorder.check('여분 크리스탈을 남겨도 클리어 (§3 3.3)', board.inventory.length === 1);
	recorder.check('수신체 상태 On', checked.result.objectStates.get('RECV_RED') === EObjectState.ON);

	// 회수하면 다시 미클리어
	recorder.check('크리스탈 회수', board.pickUp(2, 2) !== undefined);
	recorder.check('회수하면 다시 미클리어', tracer.traceAndCheck(board).isSolved === false);
	recorder.check('회수한 크리스탈은 인벤토리로 돌아온다', board.inventory.length === 2);
}

//#endregion

//#region §8.4 예외 규칙

function makeBoard(gimmicks: LaserGimmick[]): LaserBoard {
	return new LaserBoard(gimmicks, [], []);
}

function testExceptions(recorder: TestRecorder): void {
	const tracer = new LaserBeamTracer();

	// 해골에 레이저 도달 -> 전 수신체 Fault, 클리어 불가 (§3 4.2.1)
	{
		const board = makeBoard([
			{ id: 'E', type: EGimmickType.EMITTER, row: 3, col: 0, colors: [ELaserColor.RED] },
			{ id: 'R', type: EGimmickType.RECEIVER, row: 3, col: 6, colors: [ELaserColor.RED] },
			{ id: 'SK', type: EGimmickType.SKULL, row: 3, col: 3, colors: [] },
		]);
		const checked = tracer.traceAndCheck(board);
		recorder.check('해골에 광선이 닿음', checked.result.didHitSkull);
		recorder.check('해골에 닿으면 클리어 불가', checked.isSolved === false);
		recorder.check('해골에 닿으면 수신체가 Fault', checked.result.objectStates.get('R') === EObjectState.FAULT);
	}

	// 중계체를 경유하면 클리어, 경유하지 않으면 실패 (§3 4.1)
	{
		const onPath = makeBoard([
			{ id: 'E', type: EGimmickType.EMITTER, row: 3, col: 0, colors: [ELaserColor.RED] },
			{ id: 'R', type: EGimmickType.RECEIVER, row: 3, col: 6, colors: [ELaserColor.RED] },
			{ id: 'M', type: EGimmickType.RELAY, row: 3, col: 3, colors: [ELaserColor.RED] },
		]);
		const checked = tracer.traceAndCheck(onPath);
		recorder.check('중계체를 통과하면 클리어', checked.isSolved && checked.result.visitedRelayIds.indexOf('M') >= 0);

		const offPath = makeBoard([
			{ id: 'E', type: EGimmickType.EMITTER, row: 3, col: 0, colors: [ELaserColor.RED] },
			{ id: 'R', type: EGimmickType.RECEIVER, row: 3, col: 6, colors: [ELaserColor.RED] },
			{ id: 'M', type: EGimmickType.RELAY, row: 1, col: 1, colors: [ELaserColor.RED] },
		]);
		const missed = tracer.traceAndCheck(offPath);
		recorder.check('수신체에 닿아도 중계체 미경유면 실패', missed.result.litReceiverIds.length === 1 && missed.isSolved === false);
	}

	// 색이 다른 레이저가 수신체에 도달 -> 실패 (§3 2.1)
	{
		const board = makeBoard([
			{ id: 'E', type: EGimmickType.EMITTER, row: 3, col: 0, colors: [ELaserColor.RED] },
			{ id: 'R', type: EGimmickType.RECEIVER, row: 3, col: 6, colors: [ELaserColor.GREEN] },
		]);
		const checked = tracer.traceAndCheck(board);
		recorder.check('색이 다르면 수신체가 켜지지 않는다', checked.result.litReceiverIds.length === 0);
		recorder.check('색이 다르면 클리어 실패', checked.isSolved === false);
	}

	// 서로 다른 색 레이저는 층이 달라 교차해도 간섭하지 않는다 (§5)
	{
		const board = makeBoard([
			{ id: 'E1', type: EGimmickType.EMITTER, row: 3, col: 0, colors: [ELaserColor.RED] },
			{ id: 'R1', type: EGimmickType.RECEIVER, row: 3, col: 6, colors: [ELaserColor.RED] },
			{ id: 'E2', type: EGimmickType.EMITTER, row: 0, col: 3, colors: [ELaserColor.GREEN] },
			{ id: 'R2', type: EGimmickType.RECEIVER, row: 6, col: 3, colors: [ELaserColor.GREEN] },
		]);
		const checked = tracer.traceAndCheck(board);
		recorder.check('색이 다른 광선은 교차해도 간섭하지 않는다', checked.result.litReceiverIds.length === 2 && checked.isSolved, checked.result.litReceiverIds.join());
	}

	// 중계체는 여러 색을 지닐 수 있다 (§3 4.1.1)
	{
		const board = makeBoard([
			{ id: 'E1', type: EGimmickType.EMITTER, row: 3, col: 0, colors: [ELaserColor.RED] },
			{ id: 'R1', type: EGimmickType.RECEIVER, row: 3, col: 6, colors: [ELaserColor.RED] },
			{ id: 'E2', type: EGimmickType.EMITTER, row: 0, col: 3, colors: [ELaserColor.GREEN] },
			{ id: 'R2', type: EGimmickType.RECEIVER, row: 6, col: 3, colors: [ELaserColor.GREEN] },
			{ id: 'M', type: EGimmickType.RELAY, row: 3, col: 3, colors: [ELaserColor.RED, ELaserColor.GREEN] },
		]);
		const checked = tracer.traceAndCheck(board);
		recorder.check('다색 중계체는 두 색 모두 경유로 인정', checked.isSolved && checked.result.visitedRelayIds.indexOf('M') >= 0);
	}

	// 고정 크리스탈은 유저가 회수할 수 없다 (§4.3)
	{
		const board = new LaserBoard(
			[
				{ id: 'E', type: EGimmickType.EMITTER, row: 3, col: 0, colors: [ELaserColor.RED] },
				{ id: 'R', type: EGimmickType.RECEIVER, row: 0, col: 3, colors: [ELaserColor.RED] },
			],
			[{ id: 'FIX', type: ECrystalType.TRIANGLE, corner: ETriangleCorner.BOTTOM_RIGHT, row: 2, col: 2, isFixed: true }],
			[]);
		recorder.check('고정 크리스탈도 광선을 꺾는다', tracer.traceAndCheck(board).isSolved);
		recorder.check('고정 크리스탈은 회수 불가', board.pickUp(2, 2) === undefined);
	}
}

//#endregion

//#region §8.1 무한 루프 방지

function testLoopPrevention(recorder: TestRecorder): void {
	const tracer = new LaserBeamTracer();

	// 십자 크리스탈 두 개가 서로를 향해 계속 되쏘는 구성
	const board = new LaserBoard(
		[
			{ id: 'E', type: EGimmickType.EMITTER, row: 3, col: 0, colors: [ELaserColor.RED] },
			{ id: 'R', type: EGimmickType.RECEIVER, row: 0, col: 3, colors: [ELaserColor.RED] },
		],
		[
			{ id: 'C1', type: ECrystalType.CROSS, row: 2, col: 1, isFixed: true },
			{ id: 'C2', type: ECrystalType.CROSS, row: 2, col: 3, isFixed: true },
			{ id: 'C3', type: ECrystalType.OCTAGON, row: 2, col: 2, isFixed: true },
		],
		[]);

	const startedAt = Date.now();
	const result = tracer.trace(board);
	const elapsed = Date.now() - startedAt;

	recorder.check('순환 구성에서도 유한 시간 내 종료', elapsed < 2000, `${elapsed}ms`);
	recorder.check('세그먼트 상한에 걸리지 않고 자연 종료', result.segments.length < LASER_MAX_TRACE_SEGMENTS, `${result.segments.length}`);
}

//#endregion

//#region 솔버 / 생성기 (§8.3)

function testSolverAndGenerator(recorder: TestRecorder, tables: LaserTables): void {
	const tracer = new LaserBeamTracer();
	const solver = new LaserSolver(tracer);
	const generator = new LaserLevelGenerator(tables);

	const field = tables.getField('LZ_D1_001');
	if (field !== undefined) {
		const level = tables.buildLevel(field);
		const solution = solver.solve(LaserBoard.fromLevel(level));
		recorder.check('샘플 레벨에 해가 존재', solution.isSolvable);
		recorder.check('가장 얕은 해를 찾는다', solution.usedCrystalCount === 1, `${solution.usedCrystalCount}`);

		// 해를 실제로 적용하면 클리어되어야 한다
		const board = LaserBoard.fromLevel(level);
		for (const step of solution.steps) {
			board.placeFromInventory(step.crystalId, step.row, step.col);
		}
		recorder.check('솔버의 해를 적용하면 클리어', tracer.traceAndCheck(board).isSolved);
	}

	for (const config of tables.difficultyTable) {
		const generated = generator.generate({
			puzzleId: `TEST_LZ_D${config.difficulty}`,
			difficulty: config.difficulty,
			seed: 424242 + config.difficulty,
		});

		if (generated === undefined) {
			recorder.check(`난이도 ${config.difficulty} 생성`, false, '생성 실패');
			continue;
		}

		const verification = generator.verify(generated);
		recorder.check(`난이도 ${config.difficulty} 생성 및 검증`, verification.isValid, verification.violations.join(' / '));

		// §2 - 인벤토리 슬롯 상한
		recorder.check(`난이도 ${config.difficulty} 인벤토리 슬롯 상한`, generated.inventory.length <= 5, `${generated.inventory.length}`);

		// 생성 직후에는 풀려 있으면 안 되고, 솔버로는 풀려야 한다
		const board = LaserBoard.fromLevel(generated);
		recorder.check(`난이도 ${config.difficulty} 시작부터 클리어 상태가 아님`, tracer.traceAndCheck(board).isSolved === false);

		const solution = solver.solve(board);
		recorder.check(`난이도 ${config.difficulty} 해가 존재`, solution.isSolvable);

		for (const step of solution.steps) {
			board.placeFromInventory(step.crystalId, step.row, step.col);
		}
		recorder.check(`난이도 ${config.difficulty} 해 적용 시 클리어`, tracer.traceAndCheck(board).isSolved);
	}

	const first = generator.generate({ puzzleId: 'SEEDED', difficulty: 2, seed: 31337 });
	const second = generator.generate({ puzzleId: 'SEEDED', difficulty: 2, seed: 31337 });
	recorder.check('같은 시드는 같은 레벨을 만든다', JSON.stringify(first) === JSON.stringify(second));
}

//#endregion

//#region 모바일 드래그 조작

function testDragInteraction(recorder: TestRecorder, tables: LaserTables): void {
	const field = tables.getField('LZ_D1_001');
	if (field === undefined) {
		return;
	}

	const board = LaserBoard.fromLevel(tables.buildLevel(field));
	const drag = new LaserDragController(board);

	// 단일 터치 전용
	recorder.check('인벤토리에서 드래그 시작', drag.beginFromInventory('INV_TRI_0').isAccepted);
	const second = drag.beginFromInventory('INV_TEE_0');
	recorder.check('멀티터치 차단', second.isAccepted === false && second.reason === 'already-dragging');

	// 놓을 수 있는 칸 미리보기
	const preview = drag.update(2.4, 2.4);
	recorder.check('스냅 대상 칸 미리보기', preview?.targetRow === 2 && preview?.targetCol === 2, JSON.stringify(preview));
	recorder.check('빈 칸은 유효한 대상', preview?.isValidTarget === true);

	const dropped = drag.end();
	recorder.check('드롭하면 배치된다', dropped?.didPlace === true && dropped.row === 2 && dropped.col === 2, JSON.stringify(dropped));
	recorder.check('배치 후 인벤토리에서 빠진다', board.inventory.some((crystal) => crystal.id === 'INV_TRI_0') === false);

	// 이미 놓인 크리스탈 위에는 놓을 수 없다
	drag.beginFromInventory('INV_TEE_0');
	const blocked = drag.update(2, 2);
	recorder.check('점유된 칸은 무효한 대상으로 표시', blocked?.isValidTarget === false, JSON.stringify(blocked));
	const rejected = drag.end();
	recorder.check('점유된 칸에는 놓이지 않는다', rejected?.didPlace === false);

	// 필드에 놓인 것을 집어 다른 칸으로 옮긴다
	recorder.check('필드에서 집기', drag.beginFromBoard(2, 2).isAccepted);
	drag.update(0, 0);
	const moved = drag.end();
	recorder.check('다른 칸으로 이동', moved?.didPlace === true && moved.row === 0 && moved.col === 0, JSON.stringify(moved));
	recorder.check('원래 칸은 비었다', board.getCrystalAt(2, 2) === undefined);

	// 영역 밖에 놓으면 인벤토리로 회수된다
	recorder.check('필드에서 다시 집기', drag.beginFromBoard(0, 0).isAccepted);
	drag.update(-4, -4);
	const returned = drag.end();
	recorder.check('영역 밖에 놓으면 인벤토리로 회수', returned?.didReturnToInventory === true);
	recorder.check('회수 후 인벤토리에 존재', board.inventory.some((crystal) => crystal.id === 'INV_TRI_0'));
}

//#endregion

//#region 세션

function testSession(recorder: TestRecorder, tables: LaserTables): void {
	const events = new LaserEvents();
	const generator = new LaserLevelGenerator(tables);

	let didClear = false;
	let beamUpdates = 0;
	events.QUEST_CLEAR.subscribe(() => { didClear = true; });
	events.BEAM_UPDATED.subscribe(() => { beamUpdates++; });

	const session = new LaserSession(events, tables, generator);
	recorder.check('퀘스트 시작', session.startQuest('QUEST_LASER_D1'));
	recorder.check('입력 대기 상태로 진입', session.state === ELaserState.PLAYER_INPUT, session.state);
	recorder.check('제한시간이 테이블에서 적용됨', session.getRemainingTimeSeconds() === 120);
	recorder.check('시작 시 광선을 계산해 알린다 (§8.2)', beamUpdates >= 1, `${beamUpdates}`);

	const progress = session.getRoundProgress();
	recorder.check('라운드 진행도 조회', progress.current === 1 && progress.total === 1);

	const hint = session.getHintStep();
	recorder.check('힌트 제공', hint !== undefined);

	if (hint !== undefined) {
		const updatesBefore = beamUpdates;
		session.beginDragFromInventory(hint.crystalId);
		session.updateDrag(hint.row, hint.col);
		session.endDrag();
		recorder.check('배치 시 광선을 즉시 재계산 (§8.2)', beamUpdates > updatesBefore);
		recorder.check('세션이 클리어를 판정', session.state === ELaserState.QUEST_CLEAR, session.state);
		recorder.check('QUEST_CLEAR 이벤트 발행', didClear);
	}

	// 제한 시간 초과
	const failEvents = new LaserEvents();
	let didFail = false;
	failEvents.QUEST_FAILED.subscribe(() => { didFail = true; });
	const failSession = new LaserSession(failEvents, tables, generator);
	failSession.startQuest('QUEST_LASER_D1');
	failSession.update(119);
	recorder.check('제한시간 전에는 계속 진행', failSession.state === ELaserState.PLAYER_INPUT && didFail === false);
	failSession.update(2);
	recorder.check('제한시간 초과 시 실패', didFail && failSession.state === ELaserState.GAME_OVER, failSession.state);
	recorder.check('종료 후에는 입력을 받지 않는다', failSession.beginDragFromInventory('INV_TRI_0').isAccepted === false);

	// 리셋
	const resetEvents = new LaserEvents();
	const resetSession = new LaserSession(resetEvents, tables, generator);
	resetSession.startQuest('QUEST_LASER_D1');
	const board = resetSession.board;
	if (board !== undefined) {
		const inventoryBefore = board.inventory.length;
		resetSession.beginDragFromInventory(board.inventory[0].id);
		resetSession.updateDrag(4, 4);
		resetSession.endDrag();
		recorder.check('배치 후 인벤토리 감소', board.inventory.length === inventoryBefore - 1);
		resetSession.resetPlacements();
		recorder.check('리셋하면 모두 회수된다', board.inventory.length === inventoryBefore && board.placedCrystals.length === 0);
	}
}

//#endregion
