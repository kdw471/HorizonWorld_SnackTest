/**
 * Slide Puzzle Tests - PUZ_07 §12.7 "테스트" 항목
 *
 *   셔플 N회 후 항상 solvable / 직전 되돌리기 배제 확인 / 이동 중 입력 차단 /
 *   인접 빈칸 없는 조각 호버 시 Emissive 미점등 / 완성 후 입력 차단 /
 *   3×3·4×4 규격값 정확성
 *
 * 여기에 더해 레벨 생성기, 양손 동시 입력 처리(§12.4), 세션의 제한 시간 실패를 검증한다.
 *
 * Horizon Component 가 아니라 순수 검증 하네스다. `runSlidePuzzleTests()` 를 호출하면 결과를 돌려준다.
 */

import { SlidePuzzleBoard } from 'SlidePuzzle_Board';
import { SlidePuzzleEvents } from 'SlidePuzzle_GameEvents';
import { SlidePuzzleInputController } from 'SlidePuzzle_InputController';
import { SlidePuzzleLevelGenerator, describeSlideLevel } from 'SlidePuzzle_LevelGenerator';
import { SlidePuzzleSession } from 'SlidePuzzle_Session';
import { SLIDEPUZZLE_CSV_FIELD_TABLE, SlideFieldTableEntry, SlidePuzzleTables, validateFieldData } from 'SlidePuzzle_DataTables';
import {
	COMPLETED_IMAGE_SIZE_CM,
	ESlideInputState,
	ESlideMoveOutcome,
	ESlidePuzzleState,
	ESlideRejection,
	HOVER_EMISSIVE_COLOR,
	PIECE_INTERACTION_HEIGHT_CM,
	PIECE_MOVE_SECONDS,
	PIECE_THICKNESS_CM,
	SlidePuzzleLevel,
	createSeededRandom,
	createSolvedBoard,
	getLayoutTotalCm,
	getPieceMetrics,
	isBoardSolvable,
	isBoardSolved,
} from 'SlidePuzzle_Definitions';

export type SlideTestResult = {
	name: string,
	isPassed: boolean,
	detail?: string,
}

export type SlideTestReport = {
	passed: number,
	failed: number,
	results: SlideTestResult[],
}

class TestRecorder {
	public readonly results: SlideTestResult[] = [];

	public check(name: string, condition: boolean, detail?: string): void {
		this.results.push({ name: name, isPassed: condition, detail: condition ? undefined : detail });
	}
}

export function runSlidePuzzleTests(): SlideTestReport {
	const recorder = new TestRecorder();
	const tables = new SlidePuzzleTables();

	testMetrics(recorder);
	testShuffle(recorder);
	testMoveRules(recorder);
	testInputLocking(recorder);
	testMultiTouch(recorder);
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

//#region §4 규격값

function testMetrics(recorder: TestRecorder): void {
	recorder.check('완성 이미지는 35cm', COMPLETED_IMAGE_SIZE_CM === 35);
	recorder.check('조각 두께는 4cm', PIECE_THICKNESS_CM === 4);
	recorder.check('인터랙션 영역 높이는 7cm', PIECE_INTERACTION_HEIGHT_CM === 7);
	// 원안(§6)은 0.25초였으나 모바일 체감 반응성을 위해 축소했다 (SlidePuzzle_Definitions 주석)
	recorder.check('이동 연출은 0.12초', Math.abs(PIECE_MOVE_SECONDS - 0.12) < 1e-9);
	recorder.check('호버 Emissive 색상은 #FF5C41', HOVER_EMISSIVE_COLOR === '#FF5C41');

	const three = getPieceMetrics(3);
	recorder.check('3x3 조각은 11.5cm', three !== undefined && Math.abs(three.pieceSizeCm - 11.5) < 1e-9);
	recorder.check('3x3 간격은 0.25cm', three !== undefined && Math.abs(three.gapCm - 0.25) < 1e-9);

	const four = getPieceMetrics(4);
	recorder.check('4x4 조각은 8.6cm', four !== undefined && Math.abs(four.pieceSizeCm - 8.6) < 1e-9);
	recorder.check('4x4 간격은 0.2cm', four !== undefined && Math.abs(four.gapCm - 0.2) < 1e-9);

	// 조각 * n + 간격 * (n-1) 이 정확히 35cm 여야 한다
	const totalThree = getLayoutTotalCm(3);
	recorder.check('3x3 규격 합이 35cm', totalThree !== undefined && Math.abs(totalThree - 35) < 1e-9, `${totalThree}`);

	const totalFour = getLayoutTotalCm(4);
	recorder.check('4x4 규격 합이 35cm', totalFour !== undefined && Math.abs(totalFour - 35) < 1e-9, `${totalFour}`);
}

//#endregion

//#region §8 / §12.2 셔플

function testShuffle(recorder: TestRecorder): void {
	// 셔플 결과는 언제나 풀 수 있어야 한다
	{
		let allSolvable = true;
		let anyShuffled = false;
		for (let seed = 0; seed < 50; seed++) {
			for (const divide of [3, 4]) {
				const board = new SlidePuzzleBoard(divide);
				board.shuffle(createSeededRandom(seed * 31 + divide), 100);
				if (isBoardSolvable(board.board, divide) === false) {
					allSolvable = false;
				}
				if (isBoardSolved(board.board) === false) {
					anyShuffled = true;
				}
			}
		}
		recorder.check('셔플 결과는 언제나 풀 수 있다 (3x3 / 4x4, 100회 x 50시드)', allSolvable);
		recorder.check('셔플이 실제로 배치를 흐트러뜨린다', anyShuffled);
	}

	// 무작위 순열은 절반이 풀 수 없다는 사실 확인 (§8 이 금지하는 이유)
	{
		// 8-퍼즐에서 두 조각만 바꾸면 풀 수 없는 배치가 된다
		const board = createSolvedBoard(3);
		const temp = board[0];
		board[0] = board[1];
		board[1] = temp;
		recorder.check('두 조각만 바꾼 배치는 풀 수 없다 (무작위 순열 금지 근거)', isBoardSolvable(board, 3) === false);
	}

	// 직전 되돌리기 배제 - 같은 자리를 오가며 제자리걸음하지 않는다
	{
		const board = new SlidePuzzleBoard(4);
		const moved = board.shuffle(createSeededRandom(7), 2);
		recorder.check('셔플 2회는 2번 움직인다', moved === 2, `${moved}`);
		// 되돌리기를 허용하면 2회 후 완성 상태로 돌아올 수 있다. 배제했으므로 그렇지 않다.
		recorder.check('되돌리기를 배제해 2회 후에도 완성 상태가 아니다', isBoardSolved(board.board) === false, board.toDebugString());
	}

	// 여러 시드로 반복해도 완성 상태로 돌아오지 않는다
	{
		let returnedToSolved = 0;
		for (let seed = 0; seed < 100; seed++) {
			const board = new SlidePuzzleBoard(3);
			board.shuffle(createSeededRandom(seed), 2);
			if (isBoardSolved(board.board)) {
				returnedToSolved++;
			}
		}
		recorder.check('100개 시드 모두 2회 셔플 후 완성 상태가 아니다', returnedToSolved === 0, `${returnedToSolved}개가 되돌아옴`);
	}
}

//#endregion

//#region §5 이동 규칙

function testMoveRules(recorder: TestRecorder): void {
	// 완성 상태에서 하나만 움직인 보드로 시작한다
	const board = new SlidePuzzleBoard(3, undefined, 0);
	board.shuffle(createSeededRandom(3), 10);

	const blank = board.getBlankPosition();
	const movable = board.getMovablePositions();

	recorder.check('빈 칸에 인접한 조각만 움직일 수 있다', movable.length >= 2 && movable.length <= 4, `${movable.length}`);
	recorder.check('빈 칸 자신은 이동 목록에 없다', movable.indexOf(blank) < 0);

	// 인접하지 않은 조각은 거절된다
	{
		let farPosition = -1;
		for (let position = 0; position < 9; position++) {
			if (position !== blank && movable.indexOf(position) < 0) {
				farPosition = position;
				break;
			}
		}
		recorder.check('인접하지 않은 조각이 존재한다', farPosition >= 0);
		if (farPosition >= 0) {
			const result = board.press(farPosition);
			recorder.check('인접하지 않은 조각은 움직일 수 없다',
				result.outcome === ESlideMoveOutcome.REJECTED && result.rejection === ESlideRejection.NOT_ADJACENT_TO_BLANK);
			// §5 - 인접 빈칸이 없는 조각은 Emissive 를 켜지 않는다
			recorder.check('인접 빈칸 없는 조각은 호버 표시 안 함', board.canHover(farPosition) === false);
		}
	}

	recorder.check('인접한 조각은 호버 표시', board.canHover(movable[0]));
	recorder.check('빈 칸을 누르면 거절', board.press(blank).rejection === ESlideRejection.IS_BLANK);
	recorder.check('범위 밖 위치는 거절', board.press(99).rejection === ESlideRejection.INVALID_POSITION);

	// 실제 이동
	{
		const target = movable[0];
		const tileBefore = board.getTileAt(target);
		const result = board.press(target);
		recorder.check('인접한 조각은 빈 칸으로 이동', result.outcome === ESlideMoveOutcome.MOVING && result.toPosition === blank);
		recorder.check('조각이 빈 칸 자리로 옮겨졌다', board.getTileAt(blank) === tileBefore);
		recorder.check('원래 자리가 빈 칸이 되었다', board.getBlankPosition() === target);
	}
}

//#endregion

//#region §6 / §12.3 입력 잠금

function testInputLocking(recorder: TestRecorder): void {
	// 이동 중에는 모든 입력이 막힌다
	{
		const board = new SlidePuzzleBoard(3, undefined, PIECE_MOVE_SECONDS);
		board.shuffle(createSeededRandom(11), 20);

		const movable = board.getMovablePositions();
		board.press(movable[0]);
		recorder.check('이동 중에는 MOVING 상태', board.inputState === ESlideInputState.MOVING);
		recorder.check('이동 중에는 입력을 받지 않는다', board.isInputAccepted === false);

		const nextMovable = board.getMovablePositions();
		recorder.check('이동 중에는 이동 가능 목록이 비어 있다', nextMovable.length === 0);

		const blocked = board.press(0);
		recorder.check('이동 중 입력은 거절된다', blocked.rejection === ESlideRejection.MOVE_IN_PROGRESS);

		board.update(0.1);
		recorder.check('0.1초 후에도 여전히 이동 중', board.isInputAccepted === false);

		const progressed = board.update(0.2);
		recorder.check('0.25초가 지나면 이동이 끝난다', progressed.didFinishMove && board.isInputAccepted);
	}

	// 완성되면 영구히 입력이 막힌다 - §5
	{
		// 한 수만 두면 완성되는 보드를 만든다
		const solved = createSolvedBoard(3);
		// 7번 조각과 빈 칸(8)을 바꿔 둔다 -> 7을 누르면 완성
		const nearlySolved = solved.slice();
		nearlySolved[7] = 8;
		nearlySolved[8] = 7;

		const board = new SlidePuzzleBoard(3, nearlySolved, 0);
		recorder.check('아직 완성 아님', board.isSolved() === false);

		const result = board.press(8);
		recorder.check('마지막 한 수를 둘 수 있다', result.outcome === ESlideMoveOutcome.MOVING);
		recorder.check('완성되었다', board.isSolved());
		recorder.check('완성되면 LOCKED_CLEARED', board.inputState === ESlideInputState.LOCKED_CLEARED);
		recorder.check('완성 후에는 입력이 막힌다', board.press(7).rejection === ESlideRejection.ALREADY_CLEARED);
		recorder.check('완성 후에는 호버도 켜지지 않는다', board.canHover(7) === false);
	}
}

//#endregion

//#region §5 / §12.4 동시 입력

function testMultiTouch(recorder: TestRecorder): void {
	const board = new SlidePuzzleBoard(3, undefined, PIECE_MOVE_SECONDS);
	board.shuffle(createSeededRandom(23), 20);
	const input = new SlidePuzzleInputController(board);

	const movable = board.getMovablePositions();
	recorder.check('움직일 수 있는 조각이 2개 이상', movable.length >= 2, `${movable.length}`);

	// §5 - 두 조각이 동시에 눌리면 먼저 눌린 하나만 이동한다
	input.queueTouch(movable[1], 1050);
	input.queueTouch(movable[0], 1000);
	recorder.check('두 입력이 모였다', input.pendingCount === 2);

	const result = input.flush();
	recorder.check('먼저 눌린 조각만 이동한다', result?.fromPosition === movable[0], JSON.stringify(result));
	recorder.check('모아 둔 입력은 비워진다', input.pendingCount === 0);
	recorder.check('두 번째 입력은 폐기되었다', board.getBlankPosition() === movable[0]);

	// 이동 중 추가 입력은 거절된다
	input.queueTouch(movable[1], 2000);
	const blocked = input.flush();
	recorder.check('이동 중 입력은 거절', blocked?.rejection === ESlideRejection.MOVE_IN_PROGRESS);

	// 호버 표시
	board.update(0.3);
	recorder.check('이동이 끝나면 다시 호버 가능', input.getHighlightablePositions().length > 0);
}

//#endregion

//#region 레벨 생성기

function testGeneration(recorder: TestRecorder, tables: SlidePuzzleTables): void {
	const generator = new SlidePuzzleLevelGenerator(tables);

	// 기본 테이블은 모두 유효해야 한다
	for (const field of tables.fieldTable) {
		const violations = validateFieldData(field, tables);
		recorder.check(`필드 데이터 index ${field.index} 유효`, violations.length === 0, violations.join(' / '));
	}

	// 분할 개수가 3 / 4 가 아니면 거부한다
	{
		const badField: SlideFieldTableEntry = {
			index: 999, puzzleId: 'BAD', difficulty: 1, puzzleObjectId: 'IMG_GROUP_A', divideNum: 5, shuffleNum: 10,
		};
		recorder.check('분할 개수 5는 거부', validateFieldData(badField, tables).length > 0);
	}

	for (const config of tables.difficultyTable) {
		const generated = generator.generate({
			puzzleId: `TEST_SP_D${config.difficulty}`,
			difficulty: config.difficulty,
			seed: 40000 + config.difficulty,
		});

		if (generated === undefined) {
			recorder.check(`난이도 ${config.difficulty} 생성`, false, '생성 실패');
			continue;
		}

		const verification = generator.verify(generated);
		recorder.check(`난이도 ${config.difficulty} 생성 및 검증`, verification.isValid, verification.violations.join(' / '));
		recorder.check(`난이도 ${config.difficulty} 풀 수 있는 배치`, isBoardSolvable(generated.board, generated.divideNum),
			describeSlideLevel(generated));
		recorder.check(`난이도 ${config.difficulty} 시작부터 완성이 아님`, isBoardSolved(generated.board) === false);
		recorder.check(`난이도 ${config.difficulty} 원본 이미지 경로가 있다`, generated.imagePath.length > 0);
	}

	const first = generator.generate({ puzzleId: 'SEEDED', difficulty: 3, seed: 909 });
	const second = generator.generate({ puzzleId: 'SEEDED', difficulty: 3, seed: 909 });
	recorder.check('같은 시드는 같은 레벨을 만든다', JSON.stringify(first) === JSON.stringify(second));
}

//#endregion

//#region 세션

function testSession(recorder: TestRecorder, tables: SlidePuzzleTables): void {
	const generator = new SlidePuzzleLevelGenerator(tables);

	// 클리어 흐름 - 셔플 수순을 되짚는 대신, 완성 직전 보드를 만들어 마지막 한 수를 둔다
	{
		const events = new SlidePuzzleEvents();
		let didClear = false;
		let completedImage = '';
		events.QUEST_CLEAR.subscribe(() => { didClear = true; });
		events.PUZZLE_COMPLETED.subscribe((path) => { completedImage = path; });

		const session = new SlidePuzzleSession(events, tables, generator, { seed: 40001 });
		recorder.check('퀘스트 시작', session.startQuest('QUEST_SLIDE_D1'));
		recorder.check('입력 대기 상태로 진입', session.state === ESlidePuzzleState.PLAYER_INPUT, session.state);
		recorder.check('제한시간이 테이블에서 적용됨', session.getRemainingTimeSeconds() === 90);
		recorder.check('사이드 패널용 원본 이미지 경로 제공 (§10)', (session.getReferenceImagePath() ?? '').length > 0);
		recorder.check('제자리가 아닌 조각이 있다', session.getMisplacedPieceCount() > 0);

		// 완성 직전 상태를 직접 만들고 마지막 한 수를 둔다
		const board = session.board;
		if (board !== undefined) {
			// 보드를 완성 직전으로 되돌린다
			const nearly = createSolvedBoard(board.divideNum);
			const last = board.divideNum * board.divideNum - 1;
			nearly[last - 1] = last;
			nearly[last] = last - 1;

			const rigged = new SlidePuzzleSession(new SlidePuzzleEvents(), tables, generator, { seed: 40001 });
			// 세션 내부 보드를 직접 만들 수 없으므로, 보드 단위로 확인한다
			const riggedBoard = new SlidePuzzleBoard(board.divideNum, nearly, 0);
			riggedBoard.press(last);
			recorder.check('완성 직전에서 한 수로 완성된다', riggedBoard.isSolved());
			recorder.check('rigged 세션은 아직 시작 전', rigged.state === ESlidePuzzleState.IDLE);
		}

		// 실제 세션은 힌트 없이 풀 수 없으므로, 이동/잠금 흐름만 확인한다
		const movable = session.board?.getMovablePositions() ?? [];
		if (movable.length > 0) {
			const result = session.pressPiece(movable[0]);
			recorder.check('세션에서 조각을 움직일 수 있다', result?.outcome === ESlideMoveOutcome.MOVING);
			recorder.check('이동 중에는 세션 입력도 막힌다', session.pressPiece(movable[0])?.rejection === ESlideRejection.MOVE_IN_PROGRESS);
			session.update(0.3);
			recorder.check('이동이 끝나면 다시 움직일 수 있다', (session.board?.getMovablePositions().length ?? 0) > 0);
		}

		recorder.check('아직 클리어되지 않았다', didClear === false && completedImage === '');
	}

	// 회귀: 클리어 판정은 누름 시점이 아니라 이동 완료 시점(0.25초)에 나야 한다 (§12.6)
	{
		class NearSolvedGenerator extends SlidePuzzleLevelGenerator {
			public generate(): SlidePuzzleLevel {
				// 완성 1수 전: 빈 칸(8)이 위치 7, 조각 7이 위치 8에 있다
				return { puzzleId: 'REG_CLEAR_TIMING', difficulty: 1, divideNum: 3, board: [0, 1, 2, 3, 4, 5, 6, 8, 7], shuffleNum: 1, imagePath: 'SlidePuzzle/Reg' };
			}
		}

		const events = new SlidePuzzleEvents();
		const order: string[] = [];
		events.PIECE_MOVE_FINISHED.subscribe(() => order.push('finished'));
		events.PUZZLE_COMPLETED.subscribe(() => order.push('completed'));

		const session = new SlidePuzzleSession(events, tables, new NearSolvedGenerator(tables));
		session.startQuest('QUEST_SLIDE_D1');
		session.pressPiece(8);
		recorder.check('누름 직후(연출 중)에는 아직 클리어가 아니다', session.state === ESlidePuzzleState.PLAYER_INPUT && order.length === 0, order.join(','));
		session.update(PIECE_MOVE_SECONDS + 0.01);
		recorder.check('이동 완료 시점에 완료 이벤트가 순서대로 난다', order.join(',') === 'finished,completed', order.join(','));
		recorder.check('클리어 후 퀘스트 완료 상태', session.state === ESlidePuzzleState.QUEST_CLEAR, session.state);
	}

	// 제한 시간 초과
	{
		const events = new SlidePuzzleEvents();
		let didFail = false;
		events.QUEST_FAILED.subscribe(() => { didFail = true; });

		const session = new SlidePuzzleSession(events, tables, generator, { seed: 40002 });
		session.startQuest('QUEST_SLIDE_D1');
		session.update(89);
		recorder.check('제한시간 전에는 계속 진행', session.state === ESlidePuzzleState.PLAYER_INPUT);
		session.update(2);
		recorder.check('제한시간 초과 시 실패', didFail && session.state === ESlidePuzzleState.GAME_OVER, session.state);
		recorder.check('종료 후에는 입력을 받지 않는다', session.pressPiece(0) === undefined);
	}

	// 일시정지 중에는 시간이 흐르지 않는다
	{
		const events = new SlidePuzzleEvents();
		const session = new SlidePuzzleSession(events, tables, generator, { seed: 40003 });
		session.startQuest('QUEST_SLIDE_D2');

		session.update(1);
		const before = session.getRemainingTimeSeconds();
		session.pause();
		session.update(5);
		recorder.check('일시정지 중에는 시간이 멈춘다', session.getRemainingTimeSeconds() === before);

		session.resume();
		session.update(1);
		recorder.check('재개하면 다시 흐른다', session.getRemainingTimeSeconds() < before);
	}
}

//#endregion

//#region 기획 데이터 테이블 (NPUZ_07)

/**
 * `Documents/기획서 및 데이터 구조/DataTable/NPUZ_07_FieldData.csv` 에서 생성한 필드 테이블 검증.
 *
 * 이 퍼즐의 CSV 는 (이미지 / 분할 개수 / 섞는 횟수) 세 값뿐이라,
 * 확인할 것은 "그 값으로 실제 레벨이 만들어지고 항상 풀 수 있는가" 다.
 */
function testCsvFieldTable(recorder: TestRecorder, tables: SlidePuzzleTables): void {
	const fields = SLIDEPUZZLE_CSV_FIELD_TABLE;
	recorder.check('CSV 필드 테이블이 비어 있지 않다', fields.length > 0, `${fields.length}`);
	recorder.check('운영 테이블이 CSV 를 쓴다', tables.fieldTable.length === fields.length);

	const generator = new SlidePuzzleLevelGenerator(tables);
	const invalidData: string[] = [];
	const failedGeneration: string[] = [];
	const invalidLevel: string[] = [];
	const difficulties: number[] = [];

	for (const field of fields) {
		const violations = validateFieldData(field, tables);
		if (violations.length > 0) {
			invalidData.push(`${field.puzzleId}: ${violations.join(' / ')}`);
			continue;
		}

		const level = generator.generate({
			puzzleId: field.puzzleId,
			difficulty: field.difficulty,
			fieldIndex: field.index,
			seed: 4242,
		});
		if (level === undefined) {
			failedGeneration.push(field.puzzleId);
			continue;
		}

		// 셔플은 합법 이동만 쓰므로 언제나 풀 수 있어야 한다 (§8)
		const result = generator.validator.validate(level);
		if (result.isValid === false) {
			invalidLevel.push(`${field.puzzleId}: ${result.violations.join(' / ')}`);
		}
		if (difficulties.indexOf(field.difficulty) < 0) {
			difficulties.push(field.difficulty);
		}
	}

	recorder.check('모든 CSV 필드 규격이 유효', invalidData.length === 0, invalidData.slice(0, 3).join(' | '));
	recorder.check('모든 CSV 레벨이 생성됨', failedGeneration.length === 0, failedGeneration.slice(0, 5).join());
	recorder.check('생성된 레벨이 전부 풀 수 있는 배치', invalidLevel.length === 0, invalidLevel.slice(0, 3).join(' | '));

	const orphans = difficulties.filter((difficulty) => tables.getDifficultyConfig(difficulty) === undefined);
	recorder.check('모든 난이도가 난이도 테이블에 있다', orphans.length === 0, orphans.join());

	for (const config of tables.difficultyTable) {
		const count = tables.fieldTable.filter((field) => field.difficulty === config.difficulty).length;
		recorder.check(`난이도 ${config.difficulty} 판이 존재`, count > 0, `${count}`);
	}
}

//#endregion
