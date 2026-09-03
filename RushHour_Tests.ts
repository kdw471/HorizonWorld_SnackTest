/**
 * Rush Hour Tests - 모바일 사양 §11.4 "테스트 검증 필수 항목"
 *
 *   축 고정 이동 / 겹침 금지 / 1x1 전방향 이동 / 터치 해제 시 스냅 반올림 /
 *   드래그 중 영역 이탈 시 상태 유지 / 싱글 터치 제어(멀티터치 차단) /
 *   USB 삽입·재분리 및 3칸 점유 판정
 *
 * 이 파일은 Horizon Component 가 아니라 순수 검증 하네스다.
 * 월드에 배치되지 않으며, `runRushHourTests()` 를 호출하면 결과를 돌려준다.
 * Node 에서 돌리려면 순수 로직 파일들만 컴파일해 실행하면 된다 (`Documents/생성 문서/가이드/타입체크와_테스트_실행.md` §3 참고).
 */

import { RushHourBoard } from 'RushHour_Board';
import { RushHourDragController } from 'RushHour_DragController';
import { RushHourEvents } from 'RushHour_GameEvents';
import { RushHourLevelGenerator } from 'RushHour_LevelGenerator';
import { RushHourSession } from 'RushHour_Session';
import { RushHourSolver } from 'RushHour_Solver';
import { DEFAULT_RUSH_HOUR_FIELD_TABLE, RUSHHOUR_CSV_FIELD_TABLE, RushHourTables } from 'RushHour_DataTables';
import {
	EGoalStatus,
	EMoveDirection,
	EOrientation,
	ERushHourState,
	RushHourLevel,
	isEndPointInsidePlayField,
} from 'RushHour_Definitions';

export type RushHourTestResult = {
	name: string,
	isPassed: boolean,
	detail?: string,
}

export type RushHourTestReport = {
	passed: number,
	failed: number,
	results: RushHourTestResult[],
}

class TestRecorder {
	public readonly results: RushHourTestResult[] = [];

	public check(name: string, condition: boolean, detail?: string): void {
		this.results.push({ name: name, isPassed: condition, detail: condition ? undefined : detail });
	}
}

/** 모든 검증을 실행하고 결과를 돌려준다 */
export function runRushHourTests(): RushHourTestReport {
	const recorder = new TestRecorder();

	// 실제 운영 테이블 - 기획 CSV(NPUZ_02) 가 들어 있다
	const tables = new RushHourTables();

	// 손으로 배치하고 솔버로 검증한 샘플 한 판만 담은 테이블.
	// 조작·세션 테스트는 결과가 결정적이어야 하므로 이쪽을 쓴다.
	const sampleTables = new RushHourTables();
	sampleTables.loadFieldTable(DEFAULT_RUSH_HOUR_FIELD_TABLE);

	const field = sampleTables.getField('RH_D1_001');
	if (field === undefined) {
		recorder.check('샘플 필드 RH_D1_001 존재', false, '필드 테이블에서 찾을 수 없음');
		return buildReport(recorder);
	}
	const level = sampleTables.buildLevel(field);

	testSampleLevel(recorder, sampleTables, level);
	testAxisAndOverlap(recorder, level);
	testDragInteraction(recorder, level);
	testDockAndUndock(recorder, level);
	testCsvDockAndClear(recorder, tables);
	testSession(recorder, sampleTables);
	testGeneration(recorder, sampleTables);
	testCsvFieldTable(recorder, tables);

	return buildReport(recorder);
}

function buildReport(recorder: TestRecorder): RushHourTestReport {
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

//#region 샘플 레벨 / §6 배치 제약

function testSampleLevel(recorder: TestRecorder, tables: RushHourTables, level: RushHourLevel): void {
	const board = RushHourBoard.fromLevel(level);
	const generator = new RushHourLevelGenerator(tables);

	const validation = generator.validator.validate(board);
	recorder.check('§6 배치 제약 통과', validation.isValid, validation.violations.join(' / '));

	const solution = new RushHourSolver().solve(board);
	recorder.check('해가 존재한다', solution.isSolvable);
	recorder.check(
		'최소 이동 수가 필드 테이블 값과 일치',
		solution.minimumMoves === level.minimumMoves,
		`solver=${solution.minimumMoves} table=${level.minimumMoves}`);
}

//#endregion

//#region 축 고정 이동 / 겹침 금지 / 1x1 전방향

function testAxisAndOverlap(recorder: TestRecorder, level: RushHourLevel): void {
	const board = RushHourBoard.fromLevel(level);

	const vertical = board.pieces.find((piece) => piece.orientation === EOrientation.VERTICAL);
	const horizontal = board.pieces.find((piece) => piece.orientation === EOrientation.HORIZONTAL);
	const free = board.pieces.find((piece) => piece.orientation === EOrientation.FREE);

	if (vertical === undefined || horizontal === undefined || free === undefined) {
		recorder.check('H / V / FREE 조각이 모두 존재', false);
		return;
	}

	// isRejected 는 "축이 허용되지 않음"을 뜻한다. 빈칸이 없어 못 가는 경우(steps 0)와 구분된다.
	recorder.check('세로 조각은 좌우 이동 거부', board.slide(vertical.id, EMoveDirection.LEFT, 1).isRejected);
	recorder.check('가로 조각은 상하 이동 거부', board.slide(horizontal.id, EMoveDirection.UP, 1).isRejected);
	recorder.check(
		'1x1 은 상하좌우 모두 허용',
		board.slide(free.id, EMoveDirection.UP, 1).isRejected === false
		&& board.slide(free.id, EMoveDirection.DOWN, 1).isRejected === false
		&& board.slide(free.id, EMoveDirection.LEFT, 1).isRejected === false
		&& board.slide(free.id, EMoveDirection.RIGHT, 1).isRejected === false);

	// 겹침 금지 - 이미 점유된 칸을 향한 슬라이드는 그 앞에서 멈춘다
	const fresh = RushHourBoard.fromLevel(level);
	const goal = fresh.goalPieces[0];
	const before = goal.col;
	fresh.slide(goal.id, EMoveDirection.RIGHT, 6);
	const occupantAhead = fresh.getPieceAt(goal.row, goal.col + goal.size);
	recorder.check('막힌 곳을 통과하지 않는다', occupantAhead !== undefined, '앞 칸이 비어 있는데 멈췄다');
	recorder.check('막히기 전까지는 이동한다', fresh.getPiece(goal.id)!.col > before);

	// 한 칸에 두 오브젝트가 들어갈 수 없다
	let overlapping = 0;
	const seen = new Set<string>();
	for (let row = 0; row < fresh.size; row++) {
		for (let col = 0; col < fresh.size; col++) {
			const piece = fresh.getPieceAt(row, col);
			if (piece === undefined) {
				continue;
			}
			const key = `${row},${col}`;
			if (seen.has(key)) {
				overlapping++;
			}
			seen.add(key);
		}
	}
	recorder.check('영역 점유 배타성', overlapping === 0);
}

//#endregion

//#region 드래그 조작 (§7 스냅 / §8 단일 터치·영역 이탈)

function testDragInteraction(recorder: TestRecorder, level: RushHourLevel): void {
	const board = RushHourBoard.fromLevel(level);
	const drag = new RushHourDragController(board);
	const goal = board.goalPieces[0];

	// §8 히트박스 보정 - 살짝 빗나간 터치도 가장 가까운 오브젝트를 잡는다
	recorder.check('빗나간 터치도 가장 가까운 조각 선택', drag.findPieceAt(goal.row + 0.2, goal.col + 0.2)?.id === goal.id);
	recorder.check('먼 곳은 아무것도 선택하지 않음', drag.findPieceAt(0, 4) === undefined);

	// §8 단일 터치 전용 - 조작 중 추가 터치는 완전히 무시
	recorder.check('드래그 시작', drag.begin(goal.row, goal.col).isAccepted);
	const second = drag.begin(1, 3);
	recorder.check('멀티터치 차단', second.isAccepted === false && second.reason === 'already-dragging');

	// §8 화면 이탈 - 드래그는 유지되고 최외곽 경계에 고정된다
	const maxSteps = board.getMaxSteps(goal.id, EMoveDirection.RIGHT);
	const far = drag.update(goal.row, goal.col + 100);
	recorder.check('영역 이탈 시 드래그 유지', far !== undefined);
	recorder.check(
		'영역 이탈 시 최외곽 경계에 고정',
		far !== undefined && Math.abs(far.col - (goal.col + maxSteps)) < 1e-9,
		`col=${far?.col} expected=${goal.col + maxSteps}`);
	recorder.check('축 고정 - 가로 조각은 row 가 변하지 않음', far !== undefined && far.row === goal.row);

	// §7 스냅 - 놓으면 중심이 위치한 칸으로 반올림된다
	const startCol = goal.col;
	const result = drag.end();
	recorder.check('스냅 후 이동이 기록됨', result?.move !== undefined && result.move.direction === EMoveDirection.RIGHT);
	recorder.check('막히기 직전 칸에 정지', board.getPiece(goal.id)!.col === startCol + maxSteps);
	recorder.check('스냅 결과가 정수 칸', Number.isInteger(board.getPiece(goal.id)!.col));

	// 반올림 방향 확인 - 0.4 는 내려가고 0.6 은 올라간다
	const roundingBoard = RushHourBoard.fromLevel(level);
	const roundingGoal = roundingBoard.goalPieces[0];
	roundingBoard.snapFromContinuous(roundingGoal.id, roundingGoal.row, roundingGoal.col + 0.4);
	recorder.check('0.4 는 제자리로 반올림', roundingBoard.getPiece(roundingGoal.id)!.col === 0);
	roundingBoard.snapFromContinuous(roundingGoal.id, roundingGoal.row, roundingGoal.col + 0.6);
	recorder.check('0.6 은 다음 칸으로 반올림', roundingBoard.getPiece(roundingGoal.id)!.col === 1);
}

//#endregion

//#region USB 삽입 / 재분리 / 3칸 점유 (§9)

function testDockAndUndock(recorder: TestRecorder, level: RushHourLevel): void {
	const board = RushHourBoard.fromLevel(level);
	const solver = new RushHourSolver();
	for (const move of solver.solve(board).moves) {
		board.slide(move.pieceId, move.direction, move.steps);
	}

	const goal = board.goalPieces[0];
	recorder.check('도착 포인트 도달', board.getGoalStatus(goal.id) === EGoalStatus.READY);
	recorder.check('도달만으로는 클리어가 아니다', board.isSolved() === false);
	recorder.check('도달 판정은 별도로 조회 가능', board.hasEveryGoalArrived());

	const drag = new RushHourDragController(board);
	drag.begin(goal.row, goal.col);
	const visual = drag.update(goal.row, goal.col + 1.8);
	recorder.check('슬롯 방향 추가 드래그로 결합 진행도 상승', visual !== undefined && visual.dockProgress > 0.5);

	const docked = drag.end();
	recorder.check('드래그로 USB 결합', docked?.didDock === true);
	recorder.check('결합 상태', board.getGoalStatus(goal.id) === EGoalStatus.DOCKED);
	recorder.check('결합하면 클리어', board.isSolved());
	recorder.check('결합 시 3칸 점유', board.getGoalOccupiedCellsInFullGrid(goal.id).length === 3);
	recorder.check('결합 중에는 이동 불가', board.slide(goal.id, EMoveDirection.LEFT, 1).isRejected);

	// 회귀: 결합된 USB 는 탭 수준의 지터로는 분리되지 않아야 한다 (§9 반 칸 드래그 규칙)
	drag.begin(goal.row, goal.col);
	drag.update(goal.row, goal.col + 0.01);
	const jitter = drag.end();
	recorder.check('미세 지터로는 분리되지 않는다', jitter?.didUndock === false, JSON.stringify(jitter));
	recorder.check('지터 후에도 결합 유지', board.getGoalStatus(goal.id) === EGoalStatus.DOCKED);

	drag.begin(goal.row, goal.col);
	drag.update(goal.row, goal.col - 2);
	const undocked = drag.end();
	recorder.check('반대 방향 드래그로 재분리', undocked?.didUndock === true);
	recorder.check('재분리하면 클리어가 풀린다', board.isSolved() === false);
	recorder.check('재분리 후 2칸 점유', board.getGoalOccupiedCellsInFullGrid(goal.id).length === 2);
}

/**
 * 회귀 - 기획 CSV(NPUZ_02) 판에서도 USB 가 꽂히고 판이 클리어되는가 (§9 / §11.3).
 *
 * CSV 판은 도착 포인트가 **7x7 플레이 공간 안쪽** 가장자리 칸에 있어서 USB 는 그 앞 칸까지만
 * 갈 수 있다. 예전 컨트롤러는 밀착 좌표를 판의 바깥 변(0 또는 size-1)으로 가정했기 때문에
 * 그 판에서는 밀착 판정이 영원히 거짓이 되고 결합 범위 자체가 열리지 않았다.
 * 그 결과 "USB 를 삽입구에 붙였는데 클리어가 되지 않는다" 는 신고가 나왔다.
 */
function testCsvDockAndClear(recorder: TestRecorder, tables: RushHourTables): void {
	const solver = new RushHourSolver();

	let board: RushHourBoard | undefined = undefined;
	let puzzleId = '';
	for (const field of RUSHHOUR_CSV_FIELD_TABLE.slice(0, 8)) {
		const candidate = RushHourBoard.fromLevel(tables.buildLevel(field));
		const solution = solver.solve(candidate, { maxStates: 200000 });
		if (solution.isSolvable === false) {
			continue;
		}
		for (const move of solution.moves) {
			candidate.slide(move.pieceId, move.direction, move.steps);
		}
		board = candidate;
		puzzleId = field.puzzleId;
		break;
	}

	if (board === undefined) {
		recorder.check('CSV 판 중 풀리는 판이 있다', false, '앞 8판이 모두 풀리지 않았다');
		return;
	}

	recorder.check('CSV 판의 도착 포인트는 플레이 공간 안쪽 칸이다',
		board.endPoints.filter((endPoint) => isEndPointInsidePlayField(endPoint)).length === board.endPoints.length,
		puzzleId);
	recorder.check('CSV 판도 도착까지는 간다', board.hasEveryGoalArrived(), puzzleId);
	recorder.check('도착만으로는 아직 클리어가 아니다', board.isSolved() === false, puzzleId);

	// 삽입구에 밀착한 자리에서 손을 떼기만 해도 꽂힌다
	const drag = new RushHourDragController(board);
	for (const goal of board.goalPieces) {
		drag.begin(goal.row, goal.col);
		drag.update(goal.row, goal.col);
		const result = drag.end();
		recorder.check(`CSV 판 USB 결합 (${goal.id})`, result?.didDock === true, JSON.stringify(result));
	}

	recorder.check('CSV 판이 클리어된다', board.isSolved(), puzzleId);
	for (const goal of board.goalPieces) {
		recorder.check(`CSV 판 결합 시 3칸 점유 (${goal.id})`,
			board.getGoalOccupiedCellsInFullGrid(goal.id).length === 3);
	}
}

//#endregion

//#region 세션 - 라운드 / 제한시간 / 승패

function testSession(recorder: TestRecorder, tables: RushHourTables): void {
	const events = new RushHourEvents();
	const generator = new RushHourLevelGenerator(tables);

	let didClear = false;
	events.QUEST_CLEAR.subscribe(() => { didClear = true; });

	const session = new RushHourSession(events, tables, generator);
	recorder.check('퀘스트 시작', session.startQuest('QUEST_RUSHHOUR_D1'));
	recorder.check('입력 대기 상태로 진입', session.state === ERushHourState.PLAYER_INPUT, session.state);
	recorder.check('난이도 테이블의 제한시간이 적용됨', session.getRemainingTimeSeconds() === 120);

	const progress = session.getRoundProgress();
	recorder.check('라운드 진행도 조회', progress.current === 1 && progress.total === 1 && progress.cleared === 0);
	recorder.check('힌트 제공', session.getHintMove() !== undefined);

	// 솔버 힌트를 따라 도착 포인트까지 이동시킨다
	const board = session.board;
	if (board === undefined) {
		recorder.check('세션이 보드를 노출한다', false);
		return;
	}
	let guard = 0;
	while (board.hasEveryGoalArrived() === false && guard < 50) {
		const hint = session.getHintMove();
		if (hint === undefined) {
			break;
		}
		board.slide(hint.pieceId, hint.direction, hint.steps);
		guard++;
	}
	recorder.check('힌트를 따라가면 도착한다', board.hasEveryGoalArrived());

	// 드래그로 결합해 클리어시킨다
	const goal = board.goalPieces[0];
	session.beginDrag(goal.row, goal.col);
	session.updateDrag(goal.row, goal.col + 1.8);
	session.endDrag();
	recorder.check('세션이 클리어를 판정', session.state === ERushHourState.QUEST_CLEAR, session.state);
	recorder.check('QUEST_CLEAR 이벤트 발행', didClear);

	// 제한 시간 초과
	const failEvents = new RushHourEvents();
	let didFail = false;
	failEvents.QUEST_FAILED.subscribe(() => { didFail = true; });
	const failSession = new RushHourSession(failEvents, tables, generator);
	failSession.startQuest('QUEST_RUSHHOUR_D1');
	failSession.update(119);
	recorder.check('제한시간 전에는 계속 진행', failSession.state === ERushHourState.PLAYER_INPUT && didFail === false);
	failSession.update(2);
	recorder.check('제한시간 초과 시 실패', didFail && failSession.state === ERushHourState.GAME_OVER, failSession.state);
	recorder.check('남은 시간은 0 미만으로 내려가지 않는다', failSession.getRemainingTimeSeconds() === 0);
	recorder.check('종료 후에는 입력을 받지 않는다', failSession.beginDrag(0, 0).isAccepted === false);
}

//#endregion

//#region 레벨 생성기

function testGeneration(recorder: TestRecorder, tables: RushHourTables): void {
	const generator = new RushHourLevelGenerator(tables);

	for (const config of tables.difficultyTable) {
		const generated = generator.generate({
			puzzleId: `TEST_D${config.difficulty}`,
			difficulty: config.difficulty,
			seed: 20260831 + config.difficulty,
		});

		if (generated === undefined) {
			recorder.check(`난이도 ${config.difficulty} 생성`, false, '생성 실패');
			continue;
		}

		const verification = generator.verify(generated);
		recorder.check(`난이도 ${config.difficulty} 생성 및 §6 검증`, verification.isValid, verification.violations.join(' / '));

		const goals = generated.pieces.filter((piece) => piece.isGoal).length;
		recorder.check(`난이도 ${config.difficulty} 목표 개수`, goals === config.goalCount, `goals=${goals} expected=${config.goalCount}`);
		recorder.check(`난이도 ${config.difficulty} 도착 포인트 개수`, generated.endPoints.length === goals);
		recorder.check(`난이도 ${config.difficulty} 최소 이동 수 하한`, generated.minimumMoves >= 1);
	}

	// 같은 시드는 같은 결과를 낸다
	const first = generator.generate({ puzzleId: 'SEEDED', difficulty: 2, seed: 777 });
	const second = generator.generate({ puzzleId: 'SEEDED', difficulty: 2, seed: 777 });
	recorder.check('같은 시드는 같은 레벨을 만든다', JSON.stringify(first) === JSON.stringify(second));
}

//#endregion

//#region 기획 데이터 테이블 (NPUZ_02)

/**
 * `Documents/기획서 및 데이터 구조/DataTable/NPUZ_02_FieldData.csv` 에서 생성한 필드 테이블 검증.
 *
 * §6 의 "한 줄 가득 채우기 금지 / 모든 오브젝트 1칸 이동 가능"은 기획서가
 * **레벨 생성기** 검증 항목으로 정의한 것이라 기획 데이터에는 강제하지 않는다.
 * 나머지 규칙(도착 포인트 개수·위치, 목표 개수·동일 선상, 시작부터 클리어 금지,
 * 목표 경로에 같은 축 방해물 금지)은 여기서 전부 확인한다.
 */
function testCsvFieldTable(recorder: TestRecorder, tables: RushHourTables): void {
	const fields = RUSHHOUR_CSV_FIELD_TABLE;
	recorder.check('CSV 필드 테이블이 비어 있지 않다', fields.length > 0, `${fields.length}`);
	recorder.check('운영 테이블이 CSV 를 쓴다', tables.fieldTable.length === fields.length);

	const generator = new RushHourLevelGenerator(tables);
	const invalid: string[] = [];
	const difficulties: number[] = [];

	for (const field of fields) {
		const board = RushHourBoard.fromLevel(tables.buildLevel(field));
		const result = generator.validator.validate(board, { enforceGeneratorConstraints: false });
		if (result.isValid === false) {
			invalid.push(`${field.puzzleId}: ${result.violations.join(' / ')}`);
		}
		if (difficulties.indexOf(field.difficulty) < 0) {
			difficulties.push(field.difficulty);
		}
	}
	recorder.check('모든 CSV 레벨이 배치 규칙을 만족', invalid.length === 0, invalid.slice(0, 3).join(' | '));

	const orphans = difficulties.filter((difficulty) => tables.getDifficultyConfig(difficulty) === undefined);
	recorder.check('모든 난이도가 난이도 테이블에 있다', orphans.length === 0, orphans.join());

	for (const config of tables.difficultyTable) {
		const count = tables.getFieldsForDifficulty(config.difficulty).length;
		recorder.check(`난이도 ${config.difficulty} 판이 존재`, count > 0, `${count}`);
	}

	// 미리 구해 둔 최소 이동 수가 솔버 결과와 맞는지 (표본 검사 - 전수는 느리다)
	const solver = new RushHourSolver();
	const mismatched: string[] = [];
	for (const field of fields) {
		if (field.minimumMoves < 0) {
			continue;
		}
		const board = RushHourBoard.fromLevel(tables.buildLevel(field));
		const solution = solver.solve(board, { maxStates: 200000, reconstructPath: false });
		if (solution.isSolvable === false) {
			continue;
		}
		if (solution.minimumMoves !== field.minimumMoves) {
			mismatched.push(`${field.puzzleId}: solver=${solution.minimumMoves} table=${field.minimumMoves}`);
		}
	}
	recorder.check('저장된 최소 이동 수가 솔버 결과와 일치', mismatched.length === 0, mismatched.slice(0, 3).join(' | '));
}

//#endregion
