/**
 * Flow Tests - PUZ_05 §9.6 "테스트" 항목
 *
 *   대각선 연결 차단 / 이미 색이 있는 노드 통과 차단 /
 *   서브 노드 입출력 1회 제한(경로 자기교차 금지) / 그랩 해제 시 경로 유지 /
 *   역주행 지우기 / 양손 동시 사용 차단(모바일: 단일 터치) /
 *   서브가 남았을 때 클리어 불가 판정
 *
 * 여기에 더해 레벨 생성기(§9.5), 솔버, 세션의 제한 시간 실패를 검증한다.
 *
 * Horizon Component 가 아니라 순수 검증 하네스다. `runFlowTests()` 를 호출하면 결과를 돌려준다.
 */

import { FlowBoard } from 'Flow_Board';
import { FlowDragController } from 'Flow_DragController';
import { FlowEvents } from 'Flow_GameEvents';
import { FlowLevelGenerator, FlowPlacementValidator, describeFlowLevel } from 'Flow_LevelGenerator';
import { FlowSession } from 'Flow_Session';
import { FlowSolver } from 'Flow_Solver';
import { FLOW_CSV_FIELD_TABLE, FlowTables, FLOW_TILE_MASKS } from 'Flow_DataTables';
import {
	EExtendRejection,
	EFlowColor,
	EFlowState,
	ENodeKind,
	ENodeRole,
	FLOW_GRID_SIZE,
	FlowLevel,
	FlowNode,
	assignFlowPairLabels,
	countTiles,
	createSeededRandom,
	getFlowNodeLabel,
	parseTileBitmap,
} from 'Flow_Definitions';

export type FlowTestResult = {
	name: string,
	isPassed: boolean,
	detail?: string,
}

export type FlowTestReport = {
	passed: number,
	failed: number,
	results: FlowTestResult[],
}

class TestRecorder {
	public readonly results: FlowTestResult[] = [];

	public check(name: string, condition: boolean, detail?: string): void {
		this.results.push({ name: name, isPassed: condition, detail: condition ? undefined : detail });
	}
}

export function runFlowTests(): FlowTestReport {
	const recorder = new TestRecorder();
	const tables = new FlowTables();

	testPairLabels(recorder);
	testTileBitmap(recorder);
	testExtendRules(recorder);
	testUndoAndPersistence(recorder);
	testClearCondition(recorder);
	testGeneration(recorder, tables);
	testSolver(recorder, tables);
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

const RED = EFlowColor.RED;
const BLUE = EFlowColor.BLUE;

/**
 * 한 줄에 한 행씩 적어 작은 테스트 보드를 만든다.
 *   `.` 타일 없음 / `o` 서브 / `R`,`B` 등 대문자 = 해당 색 메인
 * 같은 색 메인이 2개 나오면 먼저 나온 쪽이 START, 나중이 END 다.
 */
function makeBoard(lines: string[]): FlowBoard {
	const tiles: boolean[][] = [];
	for (let row = 0; row < FLOW_GRID_SIZE; row++) {
		const line: boolean[] = [];
		for (let col = 0; col < FLOW_GRID_SIZE; col++) {
			line.push(false);
		}
		tiles.push(line);
	}

	const nodes: FlowNode[] = [];
	const seenColors = new Map<EFlowColor, number>();
	const colorByChar: { [key: string]: EFlowColor } = { R: RED, B: BLUE };

	for (let row = 0; row < lines.length; row++) {
		const line = lines[row];
		for (let col = 0; col < line.length; col++) {
			const symbol = line.charAt(col);
			if (symbol === '.' || symbol === ' ') {
				continue;
			}
			tiles[row][col] = true;

			if (symbol === 'o') {
				nodes.push({ row: row, col: col, kind: ENodeKind.SUB });
				continue;
			}

			const color = colorByChar[symbol];
			const count = seenColors.get(color) ?? 0;
			seenColors.set(color, count + 1);
			nodes.push({
				row: row,
				col: col,
				kind: ENodeKind.MAIN,
				color: color,
				role: count === 0 ? ENodeRole.START : ENodeRole.END,
			});
		}
	}

	return new FlowBoard(tiles, nodes);
}

//#endregion

//#region 타일 비트맵 (§3)

/**
 * 출발·도착 지점 표시 (worker/NextJob.md 1번).
 *
 * "시작과 끝 지점 식별이 너무 어렵다" 는 신고를 받아, 같은 색 쌍에 같은 글자를 달고
 * 출발 지점에만 표시를 하나 더 붙인다. 색이 아니라 글자라 색약·작은 화면에서도 읽힌다.
 */
function testPairLabels(recorder: TestRecorder): void {
	const node = (kind: ENodeKind, color: EFlowColor | undefined, role?: ENodeRole): FlowNode =>
		({ row: 0, col: 0, kind: kind, color: color, role: role });

	const nodes: FlowNode[] = [
		node(ENodeKind.MAIN, EFlowColor.BLUE, ENodeRole.START),
		node(ENodeKind.SUB, undefined),
		node(ENodeKind.MAIN, EFlowColor.RED, ENodeRole.START),
		node(ENodeKind.MAIN, EFlowColor.BLUE, ENodeRole.END),
		node(ENodeKind.MAIN, EFlowColor.RED, ENodeRole.END),
	];
	const labels = assignFlowPairLabels(nodes);

	recorder.check('짝 글자 - 판에 나온 순서로 A, B',
		labels.get(EFlowColor.BLUE as string) === 'A' && labels.get(EFlowColor.RED as string) === 'B',
		`${labels.get(EFlowColor.BLUE as string)}/${labels.get(EFlowColor.RED as string)}`);
	recorder.check('짝 글자 - 쓰지 않은 색은 글자가 없다',
		labels.has(EFlowColor.PINK as string) === false && labels.size === 2);

	recorder.check('짝 글자 - 같은 색 두 전구가 같은 글자를 단다',
		getFlowNodeLabel(nodes[0], labels).charAt(0) === getFlowNodeLabel(nodes[3], labels).charAt(0));
	recorder.check('짝 글자 - 출발 지점에만 표시가 붙는다',
		getFlowNodeLabel(nodes[0], labels) === 'A*' && getFlowNodeLabel(nodes[3], labels) === 'A',
		`${getFlowNodeLabel(nodes[0], labels)} / ${getFlowNodeLabel(nodes[3], labels)}`);
	recorder.check('짝 글자 - 서브 오브젝트에는 글자를 달지 않는다',
		getFlowNodeLabel(nodes[1], labels) === '');
	recorder.check('짝 글자 - 색이 없는 메인은 글자가 없다',
		getFlowNodeLabel(node(ENodeKind.MAIN, undefined, ENodeRole.START), labels) === '');

	// 실제 생성 판에서도 모든 메인이 글자를 받는지
	const generated = new FlowLevelGenerator(new FlowTables()).generate({ puzzleId: 'label', difficulty: 1, seed: 7 });
	if (generated !== undefined) {
		const realLabels = assignFlowPairLabels(generated.nodes);
		let labelled = 0;
		let mains = 0;
		for (const item of generated.nodes) {
			if (item.kind !== ENodeKind.MAIN) {
				continue;
			}
			mains++;
			if (getFlowNodeLabel(item, realLabels) !== '') {
				labelled++;
			}
		}
		recorder.check('짝 글자 - 생성 판의 모든 전구가 글자를 받는다',
			mains > 0 && labelled === mains, `${labelled}/${mains}`);
		recorder.check('짝 글자 - 색 수만큼만 글자를 쓴다',
			realLabels.size === generated.colorCount, `${realLabels.size} vs ${generated.colorCount}`);
	}
}

function testTileBitmap(recorder: TestRecorder): void {
	const tiles = parseTileBitmap(FLOW_TILE_MASKS.FULL);
	recorder.check('전체 마스크는 49칸', tiles !== undefined && countTiles(tiles) === 49);

	const cross = parseTileBitmap(FLOW_TILE_MASKS.CROSS);
	recorder.check('십자 마스크 파싱', cross !== undefined && countTiles(cross) === 33, cross === undefined ? 'parse fail' : `${countTiles(cross)}`);
	recorder.check('십자 마스크의 (0,0) 은 타일 없음', cross !== undefined && cross[0][0] === false);
	recorder.check('십자 마스크의 (0,3) 은 타일 있음', cross !== undefined && cross[0][3] === true);

	recorder.check('7줄이 아니면 파싱 실패', parseTileBitmap(['1111111']) === undefined);
	recorder.check('7글자가 아니면 파싱 실패', parseTileBitmap(['111', '111', '111', '111', '111', '111', '111']) === undefined);
}

//#endregion

//#region §5 / §9.2 경로 확장 규칙

function testExtendRules(recorder: TestRecorder): void {
	// 대각선 연결 차단 (§5)
	{
		const board = makeBoard([
			'Rooooo.',
			'oooooo.',
			'ooooooR',
		]);
		board.beginPath(RED);
		const diagonal = board.canExtend(RED, 1, 1);
		recorder.check('대각선은 이어지지 않는다', diagonal.isValid === false && diagonal.rejection === EExtendRejection.NOT_ADJACENT);
		recorder.check('상하좌우는 이어진다', board.canExtend(RED, 0, 1).isValid && board.canExtend(RED, 1, 0).isValid);
	}

	// 타일이 없는 칸으로는 갈 수 없다 (§3)
	{
		const board = makeBoard([
			'Ro.ooR',
		]);
		board.beginPath(RED);
		board.extend(RED, 0, 1);
		recorder.check('타일 없는 칸은 이어지지 않는다', board.canExtend(RED, 0, 2).rejection === EExtendRejection.NO_TILE);
	}

	// 이미 다른 색이 활성화된 노드 통과 차단 (§5)
	{
		const board = makeBoard([
			'RoooR',
			'BoooB',
		]);
		// 빨강이 윗줄을 통째로 차지한다
		board.beginPath(RED);
		board.extend(RED, 0, 1);
		board.extend(RED, 0, 2);
		board.extend(RED, 0, 3);
		board.extend(RED, 0, 4);
		recorder.check('빨강 경로 완결', board.isPathComplete(RED));

		board.beginPath(BLUE);
		// (1,0) 에서 (0,1) 은 대각선이므로, 먼저 (1,1) 로 옮겨 위쪽의 빨강 서브와 인접시킨다
		board.extend(BLUE, 1, 1);
		recorder.check('다른 색이 차지한 칸은 통과 불가', board.canExtend(BLUE, 0, 1).rejection === EExtendRejection.ALREADY_COLORED,
			board.canExtend(BLUE, 0, 1).rejection);
	}

	// 자기 경로와 교차 금지 - 서브는 입력 1 / 출력 1 (§4)
	{
		const board = makeBoard([
			'Rooo',
			'oooo',
			'oooR',
		]);
		board.beginPath(RED);
		board.extend(RED, 0, 1);
		board.extend(RED, 1, 1);
		board.extend(RED, 1, 0);
		recorder.check('이미 지나온 칸으로는 갈 수 없다', board.canExtend(RED, 0, 0).rejection === EExtendRejection.SELF_INTERSECT);
	}

	// 다른 색의 메인 오브젝트로는 갈 수 없다
	{
		const board = makeBoard([
			'RoB',
			'ooo',
			'RoB',
		]);
		board.beginPath(RED);
		recorder.check('인접한 서브로는 갈 수 있다', board.canExtend(RED, 0, 1).isValid);
		board.extend(RED, 0, 1);
		recorder.check('다른 색 메인으로는 갈 수 없다', board.canExtend(RED, 0, 2).rejection === EExtendRejection.OTHER_MAIN,
			board.canExtend(RED, 0, 2).rejection);
	}

	// 도착 지점에 닿으면 완결되고, 더 늘릴 수 없다
	{
		const board = makeBoard([
			'RooR',
			'oooo',
		]);
		board.beginPath(RED);
		board.extend(RED, 0, 1);
		board.extend(RED, 0, 2);
		board.extend(RED, 0, 3);
		recorder.check('도착하면 완결', board.isPathComplete(RED));
		recorder.check('완결된 경로는 더 늘릴 수 없다', board.canExtend(RED, 1, 3).rejection === EExtendRejection.PATH_COMPLETE);
	}
}

//#endregion

//#region §6 지우기 / 그랩 해제

function testUndoAndPersistence(recorder: TestRecorder): void {
	// 역주행 지우기 (§6 / §9.3)
	{
		const board = makeBoard([
			'RoooR',
		]);
		board.beginPath(RED);
		board.extend(RED, 0, 1);
		board.extend(RED, 0, 2);
		recorder.check('두 칸을 이었다', board.getPath(RED).length === 3);
		recorder.check('지나온 서브에 색이 들어왔다', board.getNode(0, 2)?.color === RED);

		const undoCheck = board.canExtend(RED, 0, 1);
		recorder.check('직전 칸으로 가는 것은 지우기로 판정', undoCheck.isValid && undoCheck.isUndo);

		board.extend(RED, 0, 1);
		recorder.check('되짚으면 경로가 줄어든다', board.getPath(RED).length === 2);
		recorder.check('되짚은 서브의 불이 꺼진다', board.getNode(0, 2)?.color === undefined);
	}

	// 그랩 해제 시 경로 유지 (§6)
	{
		const board = makeBoard([
			'RoooR',
		]);
		const drag = new FlowDragController(board);
		recorder.check('그리기 시작', drag.begin(0, 0).isAccepted);
		drag.moveTo(0, 1);
		drag.moveTo(0, 2);

		const end = drag.end();
		recorder.check('손을 떼면 그린 칸 수가 보고된다', end?.extendedCount === 2, JSON.stringify(end));
		recorder.check('손을 떼도 경로는 남는다', board.getPath(RED).length === 3);
		recorder.check('손을 떼도 서브의 색은 유지된다', board.getNode(0, 2)?.color === RED);

		// 머리에서 다시 잡아 이어 그릴 수 있다
		const resume = drag.begin(0, 2);
		recorder.check('경로의 머리에서 이어 잡을 수 있다', resume.isAccepted && resume.isResuming === true, JSON.stringify(resume));
		drag.moveTo(0, 3);
		drag.moveTo(0, 4);
		recorder.check('이어 그려 완결', board.isPathComplete(RED));
	}

	// 단일 터치 - 조작 중 추가 터치 무시 (§6 양손 동시 사용 금지)
	{
		const board = makeBoard([
			'RoooR',
			'BoooB',
		]);
		const drag = new FlowDragController(board);
		recorder.check('빨강 그리기 시작', drag.begin(0, 0).isAccepted);
		const second = drag.begin(1, 0);
		recorder.check('조작 중 다른 색을 잡을 수 없다', second.isAccepted === false && second.reason === 'already-drawing');
	}

	// 상호작용 가능한 지점 판정 (§6)
	{
		const board = makeBoard([
			'RoooR',
		]);
		recorder.check('출발 메인에서 시작 가능', board.canBeginAt(0, 0));
		recorder.check('서브에서는 시작 불가', board.canBeginAt(0, 1) === false);
		recorder.check('도착 메인에서는 시작 불가', board.canBeginAt(0, 4) === false);
	}
}

//#endregion

//#region §9.4 클리어 판정

function testClearCondition(recorder: TestRecorder): void {
	// 서브가 남으면 클리어 불가 (§5 / §9.4)
	{
		const board = makeBoard([
			'RooR',
			'oooo',
		]);
		board.beginPath(RED);
		board.extend(RED, 0, 1);
		board.extend(RED, 0, 2);
		board.extend(RED, 0, 3);
		recorder.check('경로는 완결되었다', board.isPathComplete(RED));
		recorder.check('서브가 남아 있으면 클리어 불가', board.isSolved() === false);
		recorder.check('남은 서브 수를 알 수 있다', board.getUncoloredSubCount() === 4, `${board.getUncoloredSubCount()}`);
	}

	// 모든 서브를 사용하면 클리어
	{
		const board = makeBoard([
			'RooR',
		]);
		board.beginPath(RED);
		board.extend(RED, 0, 1);
		board.extend(RED, 0, 2);
		board.extend(RED, 0, 3);
		recorder.check('모든 서브를 쓰면 클리어', board.isSolved());
	}

	// 색이 여러 개면 전부 완결되어야 한다
	{
		const board = makeBoard([
			'RooR',
			'BooB',
		]);
		board.beginPath(RED);
		board.extend(RED, 0, 1);
		board.extend(RED, 0, 2);
		board.extend(RED, 0, 3);
		recorder.check('한 색만 완결이면 클리어 불가', board.isSolved() === false);

		board.beginPath(BLUE);
		board.extend(BLUE, 1, 1);
		board.extend(BLUE, 1, 2);
		board.extend(BLUE, 1, 3);
		recorder.check('모든 색이 완결되면 클리어', board.isSolved());

		const status = board.getClearStatus();
		recorder.check('클리어 상태를 항목별로 조회', status.completedColors.length === 2 && status.uncoloredSubCount === 0);
	}
}

//#endregion

//#region §9.5 레벨 생성기

function testGeneration(recorder: TestRecorder, tables: FlowTables): void {
	const generator = new FlowLevelGenerator(tables);

	// 해밀턴 경로가 존재할 수 없는 마스크는 걸러진다
	{
		const holes = parseTileBitmap(FLOW_TILE_MASKS.HOLES);
		recorder.check('HOLES 마스크는 해밀턴 경로가 없다 (이분 불균형 3)',
			holes !== undefined && generator.findHamiltonianPath(holes, createSeededRandom(1)) === undefined);
	}

	for (const config of tables.difficultyTable) {
		const generated = generator.generate({
			puzzleId: `TEST_FL_D${config.difficulty}`,
			difficulty: config.difficulty,
			seed: 60000 + config.difficulty,
		});

		if (generated === undefined) {
			recorder.check(`난이도 ${config.difficulty} 생성`, false, '생성 실패');
			continue;
		}

		const verification = generator.verify(generated);
		recorder.check(`난이도 ${config.difficulty} 생성 및 검증`, verification.isValid, verification.violations.join(' / '));
		recorder.check(`난이도 ${config.difficulty} 색상 수 일치`, generated.colorCount === config.colorCount);

		// 타일마다 오브젝트가 하나씩 있어야 "모든 서브 사용" 이 성립한다 (§9.5)
		recorder.check(`난이도 ${config.difficulty} 타일 수 == 오브젝트 수`,
			countTiles(generated.tiles) === generated.nodes.length,
			`${countTiles(generated.tiles)} != ${generated.nodes.length}`);

		// 시작 시 서브는 색이 없어야 한다
		let hasColoredSub = false;
		for (const node of generated.nodes) {
			if (node.kind === ENodeKind.SUB && node.color !== undefined) {
				hasColoredSub = true;
			}
		}
		recorder.check(`난이도 ${config.difficulty} 서브는 시작 시 무색`, hasColoredSub === false, describeFlowLevel(generated));

		const board = FlowBoard.fromLevel(generated);
		recorder.check(`난이도 ${config.difficulty} 시작부터 클리어가 아님`, board.isSolved() === false);
	}

	const first = generator.generate({ puzzleId: 'SEEDED', difficulty: 4, seed: 99 });
	const second = generator.generate({ puzzleId: 'SEEDED', difficulty: 4, seed: 99 });
	recorder.check('같은 시드는 같은 레벨을 만든다', JSON.stringify(first) === JSON.stringify(second));
}

//#endregion

//#region 솔버

function testSolver(recorder: TestRecorder, tables: FlowTables): void {
	const solver = new FlowSolver();
	const generator = new FlowLevelGenerator(tables);

	// 서브를 남길 수밖에 없는 배치는 해가 없다고 판정해야 한다
	{
		// (1,0) 은 이웃이 (0,0) 하나뿐이라 "들어와서 나가는" 것이 불가능하다.
		// 서브는 입력 1 / 출력 1 이어야 하므로(§4) 이 칸은 어떤 경로도 지날 수 없다.
		const board = makeBoard([
			'RooR',
			'o...',
		]);
		recorder.check('지날 수 없는 서브가 있으면 해가 없다', solver.isSolvable(board) === false);
	}

	// 지그재그로 모든 서브를 덮을 수 있는 배치는 해가 있다
	{
		const board = makeBoard([
			'RooR',
			'oooo',
		]);
		const solution = solver.solve(board);
		recorder.check('지그재그로 전부 덮을 수 있으면 해가 있다', solution.isSolvable);
		recorder.check('해가 8칸을 모두 지난다', solution.paths[0]?.cells.length === 8, JSON.stringify(solution.paths[0]?.cells.length));
	}

	// 모든 서브를 덮을 수 있는 배치는 해가 있다
	{
		const board = makeBoard([
			'RooR',
		]);
		const solution = solver.solve(board);
		recorder.check('덮을 수 있으면 해가 있다', solution.isSolvable);
		recorder.check('해 경로가 모든 칸을 지난다', solution.paths[0]?.cells.length === 4, JSON.stringify(solution.paths));
	}

	// 두 색이 각자 자기 줄을 덮어야 하는 배치
	{
		const board = makeBoard([
			'RooR',
			'BooB',
		]);
		const solution = solver.solve(board);
		recorder.check('두 색이 나뉘어 전부 덮는 배치를 푼다', solution.isSolvable);
		recorder.check('두 색의 해를 모두 돌려준다', solution.paths.length === 2, `${solution.paths.length}`);
	}

	// 한 색이 다른 색의 길을 막아 버리는 배치는 해가 없다
	{
		// (0,1) 과 (2,1) 을 둘 다 덮으려면 한 색이 위아래를 오가야 하는데,
		// 가운데 줄을 쓰면 반대쪽 서브가 고립된다.
		const board = makeBoard([
			'RoB',
			'ooo',
			'RoB',
		]);
		recorder.check('서로의 길을 막아 서브가 고립되면 해가 없다', solver.isSolvable(board) === false);
	}

	// 생성기가 만든 레벨은 항상 풀린다
	for (const config of tables.difficultyTable) {
		const generated = generator.generate({
			puzzleId: `SOLVE_FL_D${config.difficulty}`,
			difficulty: config.difficulty,
			seed: 61000 + config.difficulty,
		});
		if (generated === undefined) {
			continue;
		}

		const solution = solver.solve(FlowBoard.fromLevel(generated));
		recorder.check(`난이도 ${config.difficulty} 솔버가 해를 찾는다`, solution.isSolvable,
			`탐색 ${solution.exploredStates}${solution.isExhausted ? ' (한도 초과)' : ''}`);

		// 찾은 해를 실제로 재생하면 클리어되어야 한다
		if (solution.isSolvable) {
			const replay = FlowBoard.fromLevel(generated);
			let didReplay = true;
			for (const path of solution.paths) {
				replay.beginPath(path.color);
				for (let index = 1; index < path.cells.length; index++) {
					if (replay.extend(path.color, path.cells[index].row, path.cells[index].col) === false) {
						didReplay = false;
						break;
					}
				}
			}
			recorder.check(`난이도 ${config.difficulty} 해 재생 시 클리어`, didReplay && replay.isSolved());
		}
	}
}

//#endregion

//#region 세션

function testSession(recorder: TestRecorder, tables: FlowTables): void {
	const generator = new FlowLevelGenerator(tables);
	const solver = new FlowSolver();

	// 클리어 흐름
	{
		const events = new FlowEvents();
		let didClear = false;
		let litCount = 0;
		events.QUEST_CLEAR.subscribe(() => { didClear = true; });
		events.NODE_LIT.subscribe(() => { litCount++; });

		const session = new FlowSession(events, tables, generator, solver, { seed: 60001 });
		recorder.check('퀘스트 시작', session.startQuest('QUEST_FLOW_D1'));
		recorder.check('입력 대기 상태로 진입', session.state === EFlowState.PLAYER_INPUT, session.state);
		recorder.check('제한시간이 테이블에서 적용됨', session.getRemainingTimeSeconds() === 90);
		recorder.check('남은 서브 수를 조회할 수 있다', session.getRemainingSubCount() > 0);

		// 솔버 해를 따라 그린다
		const paths = session.getSolutionPaths();
		recorder.check('힌트(해 경로)를 제공한다', paths.length > 0);

		for (const path of paths) {
			if (path.cells.length === 0) {
				continue;
			}
			session.beginDraw(path.cells[0].row, path.cells[0].col);
			for (let index = 1; index < path.cells.length; index++) {
				session.moveDraw(path.cells[index].row, path.cells[index].col);
			}
			session.endDraw();
		}

		recorder.check('해를 따라 그리면 클리어된다', session.state === EFlowState.QUEST_CLEAR, session.state);
		recorder.check('QUEST_CLEAR 이벤트 발행', didClear);
		recorder.check('NODE_LIT 이벤트 발행', litCount > 0);
	}

	// 제한 시간 초과
	{
		const events = new FlowEvents();
		let didFail = false;
		events.QUEST_FAILED.subscribe(() => { didFail = true; });

		const session = new FlowSession(events, tables, generator, solver, { seed: 60002 });
		session.startQuest('QUEST_FLOW_D1');
		session.update(89);
		recorder.check('제한시간 전에는 계속 진행', session.state === EFlowState.PLAYER_INPUT);
		session.update(2);
		recorder.check('제한시간 초과 시 실패', didFail && session.state === EFlowState.GAME_OVER, session.state);
		// §7 - 실패하면 유저는 아무런 상호작용을 할 수 없다
		recorder.check('종료 후에는 입력을 받지 않는다', session.beginDraw(0, 0).isAccepted === false);
	}

	// 전체 지우기
	{
		const events = new FlowEvents();
		const session = new FlowSession(events, tables, generator, solver, { seed: 60003 });
		session.startQuest('QUEST_FLOW_D1');

		const board = session.board;
		const paths = session.getSolutionPaths();
		if (board !== undefined && paths.length > 0) {
			const before = board.getUncoloredSubCount();
			const path = paths[0];
			session.beginDraw(path.cells[0].row, path.cells[0].col);
			for (let index = 1; index < path.cells.length; index++) {
				session.moveDraw(path.cells[index].row, path.cells[index].col);
			}
			session.endDraw();
			recorder.check('그리면 남은 서브가 줄어든다', board.getUncoloredSubCount() < before);

			session.clearAll();
			recorder.check('전체 지우면 원상 복구된다', board.getUncoloredSubCount() === before);
		}
	}
}

//#endregion

//#region 기획 데이터 테이블 (NPUZ_05)

/**
 * `Documents/기획서 및 데이터 구조/DataTable/NPUZ_05_FieldData.csv` 에서 생성한 필드 테이블 검증.
 *
 * 이 데이터에는 **한 필드 위에 서로 떨어진 독립 보드가 여러 개** 있는 판이 24개 있다.
 * 그런 판도 각 영역 안에서 색 쌍이 완결되므로 규칙상 문제가 없다.
 */
function testCsvFieldTable(recorder: TestRecorder, tables: FlowTables): void {
	const fields = FLOW_CSV_FIELD_TABLE;
	recorder.check('CSV 필드 테이블이 비어 있지 않다', fields.length > 0, `${fields.length}`);
	recorder.check('운영 테이블이 CSV 를 쓴다', tables.fieldTable.length === fields.length);

	const validator = new FlowPlacementValidator();
	const solver = new FlowSolver();
	const invalid: string[] = [];
	const unsolved: string[] = [];
	const difficulties: number[] = [];

	for (const field of fields) {
		const level = tables.buildLevel(field);
		if (level === undefined) {
			invalid.push(`${field.puzzleId}: buildLevel returned undefined`);
			continue;
		}

		const result = validator.validate(level);
		if (result.isValid === false) {
			invalid.push(`${field.puzzleId}: ${result.violations.join(' / ')}`);
		}
		if (solver.solve(FlowBoard.fromLevel(level), { maxStates: 800000 }).isSolvable === false) {
			unsolved.push(field.puzzleId);
		}
		if (difficulties.indexOf(field.difficulty) < 0) {
			difficulties.push(field.difficulty);
		}
	}

	recorder.check('모든 CSV 레벨이 배치 규칙을 만족', invalid.length === 0, invalid.slice(0, 3).join(' | '));
	recorder.check('모든 CSV 레벨에 해가 존재', unsolved.length === 0, unsolved.slice(0, 5).join());

	const orphans = difficulties.filter((difficulty) => tables.getDifficultyConfig(difficulty) === undefined);
	recorder.check('모든 난이도가 난이도 테이블에 있다', orphans.length === 0, orphans.join());

	for (const config of tables.difficultyTable) {
		const count = tables.getFieldsForDifficulty(config.difficulty).length;
		recorder.check(`난이도 ${config.difficulty} 판이 존재`, count > 0, `${count}`);
	}
}

//#endregion
