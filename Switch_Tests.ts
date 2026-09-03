/**
 * Switch Puzzle Tests - PUZ_08 §9.7 "테스트" 항목
 *
 *   경계 칸에서 마스크 클리핑 / FREE 칸 무영향 / 중앙 항상 포함 검증 /
 *   K회 역셔플 배치의 해 존재 / 양손(다중 터치) 동시 입력 차단 /
 *   부분 누름 미반응 / 0.2초 딜레이 연출 순서
 *
 * 여기에 더해 GF(2) 솔버의 브루트포스 교차 검증, 레벨 생성기, 데이터 검증,
 * 세션의 라운드 진행과 제한 시간 실패를 검증한다.
 *
 * Horizon Component 가 아니라 순수 검증 하네스다. `runSwitchTests()` 를 호출하면 결과를 돌려준다.
 */

import { SwitchBoard } from 'Switch_Board';
import { SwitchPuzzleEvents } from 'Switch_GameEvents';
import { SwitchInputController } from 'Switch_InputController';
import { SwitchLevelGenerator, describeSwitchLevel } from 'Switch_LevelGenerator';
import { SwitchSession } from 'Switch_Session';
import { SwitchSolver } from 'Switch_Solver';
import { SWITCH_CSV_FIELD_TABLE, SwitchFieldTableEntry, SwitchPuzzleTables, validateFieldData, validateObjectTable } from 'Switch_DataTables';
import {
	BOARD_SPAWN_SECONDS,
	ESwitchCellState,
	ESwitchInputState,
	ESwitchPressOutcome,
	ESwitchPuzzleState,
	ESwitchRejection,
	INITIAL_PRESS_SECONDS,
	KEY_BOARD_SIZE_CM,
	KEY_CAP_COLLISION_CM,
	KEY_CAP_SIZE_CM,
	KEY_PLATE_SIZE_CM,
	PRESS_AREA_DELAY_SECONDS,
	PRESS_SEQUENCE_SECONDS,
	SWITCH_BOARD_SIZE,
	createGridFromLayout,
	createSeededRandom,
	getMaskViolations,
	getToggledPositions,
	getUsablePositions,
	isGridSolved,
	parseKeyLayout,
	parseSwitchMask,
	toCoordLabel,
	toPosition,
} from 'Switch_Definitions';

export type SwitchTestResult = {
	name: string,
	isPassed: boolean,
	detail?: string,
}

export type SwitchTestReport = {
	passed: number,
	failed: number,
	results: SwitchTestResult[],
}

class TestRecorder {
	public readonly results: SwitchTestResult[] = [];

	public check(name: string, condition: boolean, detail?: string): void {
		this.results.push({ name: name, isPassed: condition, detail: condition ? undefined : detail });
	}
}

export function runSwitchTests(): SwitchTestReport {
	const recorder = new TestRecorder();
	const tables = new SwitchPuzzleTables();

	testMetrics(recorder);
	testMaskParsing(recorder);
	testToggleMechanics(recorder);
	testFreeCells(recorder);
	testPressRejections(recorder);
	testSequenceTiming(recorder);
	testClear(recorder);
	testSolver(recorder);
	testShuffle(recorder);
	testGeneration(recorder, tables);
	testDataValidation(recorder, tables);
	testInputController(recorder);
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

//#region Test fixtures

const MASK_PLUS = parseSwitchMask(['010', '111', '010'])!;
const MASK_FULL = parseSwitchMask(['111', '111', '111'])!;
const MASK_ROW = parseSwitchMask(['000', '111', '000'])!;
const MASK_CENTER_ONLY = parseSwitchMask(['000', '010', '000'])!;

const FULL_LAYOUT = parseKeyLayout(['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'])!;

function createFullGrid(fill: ESwitchCellState): ESwitchCellState[] {
	return createGridFromLayout(FULL_LAYOUT, fill);
}

/** 브루트포스: 모든 누름 부분집합을 열거해 최소 해를 찾는다. 해가 없으면 undefined */
function bruteForceMinPresses(grid: readonly ESwitchCellState[], mask: readonly number[]): number | undefined {
	const usable = getUsablePositions(grid);
	if (usable.length > 12) {
		throw new Error('브루트포스는 사용 칸 12개 이하에서만 쓴다');
	}

	let best: number | undefined = undefined;
	const subsetCount = 1 << usable.length;
	for (let subset = 0; subset < subsetCount; subset++) {
		const work = grid.slice();
		let weight = 0;
		for (let index = 0; index < usable.length; index++) {
			if ((subset & (1 << index)) === 0) {
				continue;
			}
			weight++;
			for (const target of getToggledPositions(work, mask, usable[index])) {
				work[target] = work[target] === ESwitchCellState.PRESSED ? ESwitchCellState.UNPRESSED : ESwitchCellState.PRESSED;
			}
		}
		if (isGridSolved(work) && (best === undefined || weight < best)) {
			best = weight;
		}
	}
	return best;
}

//#endregion

//#region §3 규격값

function testMetrics(recorder: TestRecorder): void {
	recorder.check('키 판은 5×5', SWITCH_BOARD_SIZE === 5);
	recorder.check('단일 키 판은 7cm', KEY_PLATE_SIZE_CM === 7);
	recorder.check('완성 키 판은 35cm', KEY_BOARD_SIZE_CM === 35);
	// 7cm × 5 = 35cm 항등식
	recorder.check('키 판 규격 합이 35cm', KEY_PLATE_SIZE_CM * SWITCH_BOARD_SIZE === KEY_BOARD_SIZE_CM);
	recorder.check('키 캡은 6cm', KEY_CAP_SIZE_CM === 6);
	recorder.check('키 캡 조작 콜리전은 7cm (칸보다 넉넉한 히트박스)', KEY_CAP_COLLISION_CM === 7 && KEY_CAP_COLLISION_CM > KEY_CAP_SIZE_CM);
	recorder.check('키 판 생성 연출은 1초', BOARD_SPAWN_SECONDS === 1);
	recorder.check('초기 눌림 연출은 0.2초', Math.abs(INITIAL_PRESS_SECONDS - 0.2) < 1e-9);
	// 원안(§7)은 0.2초/0.4초였으나 모바일 체감 반응성을 위해 축소했다 (Switch_Definitions 주석)
	recorder.check('영역 연출 딜레이는 0.05초', Math.abs(PRESS_AREA_DELAY_SECONDS - 0.05) < 1e-9);
	recorder.check('누름 연출 전체는 0.12초', Math.abs(PRESS_SEQUENCE_SECONDS - 0.12) < 1e-9);

	// §4 좌표 표기 A1~E5
	recorder.check('좌표 0 은 A1', toCoordLabel(0) === 'A1');
	recorder.check('좌표 (1,2) 는 B3', toCoordLabel(toPosition(1, 2)) === 'B3');
	recorder.check('좌표 24 는 E5', toCoordLabel(24) === 'E5');
}

//#endregion

//#region §6 마스크 파싱 / 중앙 항상 포함

function testMaskParsing(recorder: TestRecorder): void {
	recorder.check('십자 마스크 파싱', MASK_PLUS.join('') === '010111010');
	recorder.check('마스크 행 수가 틀리면 거부', parseSwitchMask(['010', '111']) === undefined);
	recorder.check('마스크 글자 수가 틀리면 거부', parseSwitchMask(['010', '1111', '010']) === undefined);
	recorder.check('마스크에 0/1 외 문자는 거부', parseSwitchMask(['010', '1x1', '010']) === undefined);

	// §6 - 중앙은 항상 포함
	recorder.check('중앙 포함 마스크는 통과', getMaskViolations(MASK_PLUS).length === 0);
	const noCenter = parseSwitchMask(['111', '101', '111'])!;
	recorder.check('중앙 미포함 마스크는 위반', getMaskViolations(noCenter).length > 0);
	recorder.check('길이가 9가 아니면 위반', getMaskViolations([1, 1, 1]).length > 0);

	// 중앙만 있는 마스크도 유효하다 (§6 은 중앙 포함만 요구)
	recorder.check('중앙 단독 마스크는 유효', getMaskViolations(MASK_CENTER_ONLY).length === 0);
}

//#endregion

//#region §6 / §9.2 토글 - 경계 클리핑 / 랩어라운드 금지

function testToggleMechanics(recorder: TestRecorder): void {
	const grid = createFullGrid(ESwitchCellState.UNPRESSED);

	// 중앙 (2,2) + 십자 → 5칸
	const center = getToggledPositions(grid, MASK_PLUS, toPosition(2, 2));
	recorder.check('중앙 십자 누름은 5칸 반전', center.length === 5, `${center.length}`);
	recorder.check('중앙 십자에 자기 칸 포함', center.indexOf(toPosition(2, 2)) >= 0);

	// 모서리 (0,0) + 십자 → 위/왼쪽이 잘려 3칸 (경계 클리핑)
	const corner = getToggledPositions(grid, MASK_PLUS, toPosition(0, 0));
	recorder.check('모서리 십자 누름은 3칸 (클리핑)', corner.length === 3, `${corner.length}`);

	// 변 (0,2) + 십자 → 4칸
	const edge = getToggledPositions(grid, MASK_PLUS, toPosition(0, 2));
	recorder.check('변 십자 누름은 4칸 (클리핑)', edge.length === 4, `${edge.length}`);

	// 모서리 (0,0) + 전체 → 4칸. 랩어라운드가 있다면 9칸이 나온다
	const cornerFull = getToggledPositions(grid, MASK_FULL, toPosition(0, 0));
	recorder.check('모서리 전체 마스크는 4칸 (랩어라운드 금지)', cornerFull.length === 4, `${cornerFull.length}`);
	recorder.check('랩어라운드 칸이 포함되지 않음', cornerFull.indexOf(toPosition(4, 4)) < 0 && cornerFull.indexOf(toPosition(0, 4)) < 0);

	// 토글은 자기역원 - 같은 칸을 두 번 누르면 원상복구
	const board = new SwitchBoard(createFullGrid(ESwitchCellState.UNPRESSED), MASK_PLUS, 0, 0);
	const before = board.grid.join(',');
	board.press(toPosition(2, 2));
	const middle = board.grid.join(',');
	board.press(toPosition(2, 2));
	const after = board.grid.join(',');
	recorder.check('한 번 누르면 상태가 바뀐다', before !== middle);
	recorder.check('같은 칸 두 번 누르면 원상복구 (involution)', before === after);
}

//#endregion

//#region §4 / §9.2 FREE 칸 무영향

function testFreeCells(recorder: TestRecorder): void {
	// 중앙 3×3 레이아웃 - 테두리는 전부 FREE
	const usable = parseKeyLayout(['.....', '.OOO.', '.OOO.', '.OOO.', '.....'])!;
	const grid = createGridFromLayout(usable, ESwitchCellState.UNPRESSED);

	// (1,1) 십자 누름 - 위(0,1)/왼쪽(1,0)은 FREE 라 영향 없음
	const toggled = getToggledPositions(grid, MASK_PLUS, toPosition(1, 1));
	recorder.check('FREE 칸은 반전 대상에서 제외', toggled.length === 3, `${toggled.length}`);
	recorder.check('FREE 칸 위치가 목록에 없음', toggled.indexOf(toPosition(0, 1)) < 0 && toggled.indexOf(toPosition(1, 0)) < 0);

	const board = new SwitchBoard(grid, MASK_PLUS, 0, 0);
	board.press(toPosition(1, 1));
	recorder.check('누름 후에도 FREE 칸은 FREE 그대로', board.getCellAt(toPosition(0, 1)) === ESwitchCellState.FREE);

	// FREE 칸 자체를 누르면 거절
	const freePress = board.press(toPosition(0, 0));
	recorder.check('FREE 칸 누름은 거절', freePress.rejection === ESwitchRejection.FREE_CELL);
	recorder.check('FREE 칸 누름은 아무것도 반전하지 않음', freePress.toggledPositions.length === 0);

	// FREE 칸은 하이라이트도 켜지 않는다 - PUZ_00 §8.2
	recorder.check('FREE 칸은 하이라이트 불가', board.canHighlight(toPosition(0, 0)) === false);
	recorder.check('키 캡 칸은 하이라이트 가능', board.canHighlight(toPosition(1, 1)) === true);
	recorder.check('누를 수 있는 칸 수는 9', board.getPressablePositions().length === 9);
}

//#endregion

//#region 입력 거절

function testPressRejections(recorder: TestRecorder): void {
	const board = new SwitchBoard(createFullGrid(ESwitchCellState.UNPRESSED), MASK_PLUS);

	recorder.check('범위 밖 누름은 거절', board.press(-1).rejection === ESwitchRejection.INVALID_POSITION);
	recorder.check('범위 밖 누름은 거절 (25)', board.press(25).rejection === ESwitchRejection.INVALID_POSITION);

	// 연출(0.4초) 중 추가 입력 차단 - §7
	const first = board.press(toPosition(2, 2));
	recorder.check('첫 누름은 접수', first.outcome === ESwitchPressOutcome.PRESSED);
	const during = board.press(toPosition(0, 0));
	recorder.check('연출 중 누름은 거절', during.rejection === ESwitchRejection.SEQUENCE_IN_PROGRESS);
	recorder.check('연출 중에는 누를 수 있는 칸이 없음', board.getPressablePositions().length === 0);

	board.flushSequence();
	recorder.check('연출이 끝나면 다시 입력 가능', board.isInputAccepted === true);
}

//#endregion

//#region §7 연출 타이밍 - 0.0초 / 딜레이 / 시퀀스 종료 (값은 Switch_Definitions 상수)

function testSequenceTiming(recorder: TestRecorder): void {
	const board = new SwitchBoard(createFullGrid(ESwitchCellState.UNPRESSED), MASK_PLUS);
	board.press(toPosition(2, 2));

	// 딜레이의 절반 - 아직 아무 단계도 아님
	let progress = board.update(PRESS_AREA_DELAY_SECONDS / 2);
	recorder.check('딜레이 전에는 영역 연출 전', progress.didReachAreaPhase === false && progress.didFinishSequence === false);

	// 딜레이를 넘긴 시점 - 영역 연출 단계 도달, 아직 종료 전
	progress = board.update(PRESS_AREA_DELAY_SECONDS);
	recorder.check('딜레이 경과에 영역 연출 도달', progress.didReachAreaPhase === true);
	recorder.check('시퀀스 종료 전에는 종료 신호 없음', progress.didFinishSequence === false);

	// 시퀀스 길이만큼 더 - 종료
	progress = board.update(PRESS_SEQUENCE_SECONDS);
	recorder.check('영역 연출 신호는 한 번만', progress.didReachAreaPhase === false);
	recorder.check('시퀀스 경과에 연출 종료', progress.didFinishSequence === true);
	recorder.check('종료 후 입력 재개', board.isInputAccepted === true);

	// 큰 델타 하나로 두 단계를 한 번에 지나가도 둘 다 신호가 난다
	const board2 = new SwitchBoard(createFullGrid(ESwitchCellState.UNPRESSED), MASK_PLUS);
	board2.press(toPosition(1, 1));
	const jumbo = board2.update(1);
	recorder.check('큰 델타에서도 영역+종료 신호 동시 처리', jumbo.didReachAreaPhase === true && jumbo.didFinishSequence === true);

	// 연출 시간 0이면 즉시 종료 (테스트/시뮬레이션용)
	const instant = new SwitchBoard(createFullGrid(ESwitchCellState.UNPRESSED), MASK_PLUS, 0, 0);
	instant.press(toPosition(2, 2));
	recorder.check('연출 0초면 즉시 입력 재개', instant.isInputAccepted === true);
}

//#endregion

//#region §9.3 클리어 판정

function testClear(recorder: TestRecorder): void {
	// 모두 눌림에서 (2,2) 십자 한 번 흐트러뜨림 → 같은 곳을 누르면 클리어
	const grid = createFullGrid(ESwitchCellState.PRESSED);
	const setup = new SwitchBoard(grid, MASK_PLUS, 0, 0);
	setup.shuffleFromSolved(createSeededRandom(7), 1);
	recorder.check('1회 역셔플 후 미완성', setup.isSolved() === false);

	const pressed = setup.shuffleFromSolved(createSeededRandom(7), 1);
	const board = new SwitchBoard(setup.grid.slice(), MASK_PLUS);
	const result = board.press(pressed[0]);
	recorder.check('되누름 접수', result.outcome === ESwitchPressOutcome.PRESSED);

	const progress = board.update(PRESS_SEQUENCE_SECONDS);
	recorder.check('연출 종료 시점에 클리어 판정', progress.didFinishSequence === true && progress.didClear === true);
	recorder.check('클리어 후 상태 잠금', board.inputState === ESwitchInputState.LOCKED_CLEARED);
	recorder.check('클리어 후 누름은 거절', board.press(toPosition(0, 0)).rejection === ESwitchRejection.ALREADY_CLEARED);

	// 시작부터 완성 상태면 즉시 잠금
	const solved = new SwitchBoard(createFullGrid(ESwitchCellState.PRESSED), MASK_PLUS);
	recorder.check('완성 상태로 시작하면 즉시 잠금', solved.inputState === ESwitchInputState.LOCKED_CLEARED);
}

//#endregion

//#region GF(2) 솔버

function testSolver(recorder: TestRecorder): void {
	const solver = new SwitchSolver();

	// 완성 상태 → 0수 해
	const solvedGrid = createFullGrid(ESwitchCellState.PRESSED);
	const zero = solver.solve(solvedGrid, MASK_PLUS);
	recorder.check('완성 상태는 0수 해', zero.isSolvable === true && zero.pressCount === 0);

	// 한 번 흐트러뜨린 배치 → 최소 1수, 위치 일치
	const oneAway = new SwitchBoard(createFullGrid(ESwitchCellState.PRESSED), MASK_PLUS, 0, 0);
	const presses = oneAway.shuffleFromSolved(createSeededRandom(11), 1);
	const one = solver.solve(oneAway.grid, MASK_PLUS);
	recorder.check('1회 흐트러뜨림은 1수 해', one.isSolvable === true && one.pressCount === 1);
	recorder.check('해의 위치가 흐트러뜨린 위치와 일치', one.pressPositions[0] === presses[0]);

	// 브루트포스 교차 검증 - 3×3 레이아웃 × 십자/대각 마스크 × 여러 상태
	const smallLayout = parseKeyLayout(['.....', '.OOO.', '.OOO.', '.OOO.', '.....'])!;
	const maskX = parseSwitchMask(['101', '010', '101'])!;
	let solvabilityMatches = true;
	let minimalityMatches = true;
	for (const mask of [MASK_PLUS, maskX, MASK_ROW]) {
		for (let seed = 0; seed < 12; seed++) {
			const random = createSeededRandom(seed * 97 + 5);
			const grid = createGridFromLayout(smallLayout, ESwitchCellState.PRESSED);
			for (let index = 0; index < grid.length; index++) {
				if (grid[index] !== ESwitchCellState.FREE && random() < 0.5) {
					grid[index] = ESwitchCellState.UNPRESSED;
				}
			}
			const expected = bruteForceMinPresses(grid, mask);
			const actual = solver.solve(grid, mask);
			if ((expected !== undefined) !== actual.isSolvable) {
				solvabilityMatches = false;
			}
			else if (expected !== undefined && actual.isMinimal && actual.pressCount !== expected) {
				minimalityMatches = false;
			}
		}
	}
	recorder.check('솔버 해 존재 판정이 브루트포스와 일치', solvabilityMatches);
	recorder.check('솔버 최소 해가 브루트포스와 일치', minimalityMatches);

	// §9.4 - 무작위 0/1 배열은 해가 없을 수 있다: 가로줄 마스크 + 2×2 블록에서
	// "한 칸만 안 눌림"은 원리적으로 풀 수 없다 (같은 행 두 칸이 항상 함께 반전되므로)
	const pairLayout = parseKeyLayout(['OO...', 'OO...', '.....', '.....', '.....'])!;
	const unsolvableGrid = createGridFromLayout(pairLayout, ESwitchCellState.PRESSED);
	unsolvableGrid[toPosition(0, 0)] = ESwitchCellState.UNPRESSED;
	const unsolvable = solver.solve(unsolvableGrid, MASK_ROW);
	recorder.check('해가 없는 배치를 정확히 판정', unsolvable.isSolvable === false);
	recorder.check('브루트포스도 해 없음에 동의', bruteForceMinPresses(unsolvableGrid, MASK_ROW) === undefined);

	// 중앙 단독 마스크는 어떤 배치든 풀 수 있다 (각 칸을 독립적으로 뒤집을 수 있으므로)
	const anyGrid = createFullGrid(ESwitchCellState.UNPRESSED);
	const independent = solver.solve(anyGrid, MASK_CENTER_ONLY);
	recorder.check('중앙 단독 마스크는 전 칸 독립 - 25수 해', independent.isSolvable === true && independent.pressCount === 25);
}

//#endregion

//#region §9.4 역셔플

function testShuffle(recorder: TestRecorder): void {
	const solver = new SwitchSolver();

	// K회 역셔플 배치는 항상 해가 존재하고, 최소 해는 K 이하다
	let allSolvable = true;
	let allWithinK = true;
	let anyShuffled = false;
	for (let seed = 0; seed < 30; seed++) {
		for (const pressCount of [1, 3, 5, 8]) {
			const board = new SwitchBoard(createFullGrid(ESwitchCellState.PRESSED), MASK_PLUS, 0, 0);
			const presses = board.shuffleFromSolved(createSeededRandom(seed * 131 + pressCount), pressCount);
			if (board.isSolved() === false) {
				anyShuffled = true;
			}
			const solution = solver.solve(board.grid, MASK_PLUS);
			if (solution.isSolvable === false) {
				allSolvable = false;
			}
			else if (solution.isMinimal && solution.pressCount > presses.length) {
				allWithinK = false;
			}
		}
	}
	recorder.check('K회 역셔플 배치는 항상 해 존재 (§9.4)', allSolvable);
	recorder.check('역셔플 배치의 최소 해는 K 이하', allWithinK);
	recorder.check('셔플이 실제로 상태를 흐트러뜨림', anyShuffled);

	// 서로 다른 칸만 누른다 - 같은 칸 중복 없음
	const board = new SwitchBoard(createFullGrid(ESwitchCellState.PRESSED), MASK_PLUS, 0, 0);
	const presses = board.shuffleFromSolved(createSeededRandom(3), 10);
	recorder.check('역셔플은 서로 다른 칸 K개를 누름', new Set(presses).size === presses.length && presses.length === 10);

	// K 가 사용 칸 수를 넘으면 사용 칸 수만큼만 누른다
	const smallLayout = parseKeyLayout(['OO...', '.....', '.....', '.....', '.....'])!;
	const smallBoard = new SwitchBoard(createGridFromLayout(smallLayout, ESwitchCellState.PRESSED), MASK_CENTER_ONLY, 0, 0);
	const clamped = smallBoard.shuffleFromSolved(createSeededRandom(1), 99);
	recorder.check('K 가 사용 칸 수를 넘으면 클램프', clamped.length === 2);
}

//#endregion

//#region 레벨 생성기

function testGeneration(recorder: TestRecorder, tables: SwitchPuzzleTables): void {
	const generator = new SwitchLevelGenerator(tables);
	const solver = generator.solver;

	for (let difficulty = 1; difficulty <= 5; difficulty++) {
		let allValid = true;
		let allSolvable = true;
		let detail = '';
		for (let seed = 1; seed <= 5; seed++) {
			const level = generator.generate({ difficulty: difficulty, seed: seed * 1009 });
			if (level === undefined) {
				allValid = false;
				detail = `seed ${seed * 1009} 생성 실패`;
				break;
			}
			const validation = generator.verify(level);
			if (validation.isValid === false) {
				allValid = false;
				detail = `${describeSwitchLevel(level)}: ${validation.violations.join(' / ')}`;
				break;
			}
			const solution = solver.solve(level.grid, level.mask);
			if (solution.isSolvable === false || solution.pressCount < 1) {
				allSolvable = false;
				detail = describeSwitchLevel(level);
				break;
			}
		}
		recorder.check(`D${difficulty} 생성 레벨이 항상 유효`, allValid, detail);
		recorder.check(`D${difficulty} 생성 레벨이 항상 풀 수 있음 (1수 이상)`, allSolvable, detail);
	}

	// 같은 시드는 같은 레벨
	const levelA = generator.generate({ difficulty: 3, seed: 42 });
	const levelB = generator.generate({ difficulty: 3, seed: 42 });
	recorder.check('같은 시드는 같은 레벨', levelA !== undefined && levelB !== undefined && levelA.grid.join(',') === levelB.grid.join(','));

	// 다른 시드는 (대체로) 다른 레벨
	const levelC = generator.generate({ difficulty: 3, seed: 43 });
	recorder.check('다른 시드는 다른 레벨', levelA !== undefined && levelC !== undefined && levelA.grid.join(',') !== levelC.grid.join(','));

	// 없는 난이도는 생성 실패
	recorder.check('없는 난이도는 생성 거부', generator.generate({ difficulty: 99, seed: 1 }) === undefined);
}

//#endregion

//#region 데이터 검증

function testDataValidation(recorder: TestRecorder, tables: SwitchPuzzleTables): void {
	// 기본 테이블은 전부 유효해야 한다
	recorder.check('기본 오브젝트 테이블 유효', validateObjectTable(tables.objectTable).length === 0);
	let allFieldsValid = true;
	let detail = '';
	for (const field of tables.fieldTable) {
		const violations = validateFieldData(field, tables);
		if (violations.length > 0) {
			allFieldsValid = false;
			detail = `index ${field.index}: ${violations.join(' / ')}`;
			break;
		}
	}
	recorder.check('기본 필드 테이블 유효', allFieldsValid, detail);

	const base: SwitchFieldTableEntry = {
		index: 99,
		puzzleId: 'SW_TEST',
		difficulty: 1,
		switchAreaId: 'SW_AREA_PLUS',
		layoutRows: ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'],
		shuffleCount: 3,
	};

	recorder.check('잘못된 레이아웃 거부', validateFieldData({ ...base, layoutRows: ['OOO'] }, tables).length > 0);
	recorder.check('K > 사용 칸 수 거부', validateFieldData({ ...base, shuffleCount: 26 }, tables).length > 0);
	recorder.check('K < 1 거부', validateFieldData({ ...base, shuffleCount: 0 }, tables).length > 0);
	recorder.check('없는 스위치 영역 거부', validateFieldData({ ...base, switchAreaId: 'SW_AREA_NOPE' }, tables).length > 0);
	recorder.check('키 캡 1개 이하 레이아웃 거부', validateFieldData({ ...base, layoutRows: ['O....', '.....', '.....', '.....', '.....'], shuffleCount: 1 }, tables).length > 0);

	// 중앙 미포함 마스크는 오브젝트 테이블 검증에서 걸린다 (§6)
	const badMaskViolations = validateObjectTable([
		{ switchAreaId: 'SW_BAD', name: '나쁜 마스크', maskRows: ['111', '101', '111'] },
	]);
	recorder.check('중앙 미포함 마스크는 데이터 단계에서 거부', badMaskViolations.length > 0);
	recorder.check('중복 스위치 영역 ID 거부', validateObjectTable([
		{ switchAreaId: 'SW_DUP', name: 'a', maskRows: ['010', '111', '010'] },
		{ switchAreaId: 'SW_DUP', name: 'b', maskRows: ['010', '111', '010'] },
	]).length > 0);
}

//#endregion

//#region 모바일 입력 - §7 동시 입력 차단 / 부분 누름 미반응

function testInputController(recorder: TestRecorder): void {
	const board = new SwitchBoard(createFullGrid(ESwitchCellState.UNPRESSED), MASK_PLUS, 0, 0);
	const input = new SwitchInputController(board);

	// §7 - "먼저 들어간 손만 인식": 터치 진행 중 추가 다운은 무시
	recorder.check('첫 터치 다운 접수', input.touchDown(toPosition(2, 2)) === true);
	recorder.check('두 번째 터치 다운은 무시 (동시 입력 차단)', input.touchDown(toPosition(0, 0)) === false);
	recorder.check('진행 중 터치 있음', input.hasActiveTouch === true);

	// 같은 칸에서 떼면 눌림 확정
	const confirmed = input.touchUp();
	recorder.check('같은 칸에서 떼면 눌림 확정', confirmed.outcome === ESwitchPressOutcome.PRESSED);
	recorder.check('확정 후 진행 중 터치 없음', input.hasActiveTouch === false);

	// §7 부분 누름 미반응 - 밖으로 끌고 나가 떼면 취소, 상태 불변
	const before = board.grid.join(',');
	input.touchDown(toPosition(2, 2));
	input.touchMove(toPosition(2, 3));
	const cancelled = input.touchUp();
	recorder.check('밖에서 떼면 취소 (부분 누름 미반응)', cancelled.rejection === ESwitchRejection.RELEASED_OUTSIDE);
	recorder.check('취소 시 격자 불변', board.grid.join(',') === before);

	// 다운 없이 업
	recorder.check('다운 없는 업은 거절', input.touchUp().rejection === ESwitchRejection.NO_ACTIVE_TOUCH);

	// 같은 프레임 다중 입력 - 타임스탬프 빠른 하나만 (PUZ_00 §8.1)
	const board2 = new SwitchBoard(createFullGrid(ESwitchCellState.UNPRESSED), MASK_PLUS, 0, 0);
	const input2 = new SwitchInputController(board2);
	input2.queueTouch(toPosition(4, 4), 200);
	input2.queueTouch(toPosition(0, 0), 100);
	input2.queueTouch(toPosition(2, 2), 300);
	const flushed = input2.flush();
	recorder.check('같은 프레임 입력 중 가장 빠른 것만 채택', flushed !== undefined && flushed.position === toPosition(0, 0));
	recorder.check('나머지 입력은 폐기', input2.pendingCount === 0 && input2.flush() === undefined);

	// clearPending 이 진행 중 터치까지 버린다
	input2.touchDown(toPosition(1, 1));
	input2.queueTouch(toPosition(2, 2), 400);
	input2.clearPending();
	recorder.check('clearPending 은 큐와 진행 중 터치를 모두 버림', input2.pendingCount === 0 && input2.hasActiveTouch === false);

	// peekRejection
	recorder.check('FREE 아닌 칸의 peek 은 NONE', input2.peekRejection(toPosition(0, 0)) === ESwitchRejection.NONE);

	// 연출 잠금 중에는 터치 다운 자체가 접수되지 않는다 (M3 - 버퍼링 방지)
	const board3 = new SwitchBoard(createFullGrid(ESwitchCellState.UNPRESSED), MASK_PLUS);
	const input3 = new SwitchInputController(board3);
	input3.touch(toPosition(2, 2));
	recorder.check('연출 중 터치 다운은 접수되지 않음', input3.touchDown(toPosition(0, 0)) === false);
	recorder.check('접수되지 않은 다운의 업은 거절', input3.touchUp().rejection === ESwitchRejection.NO_ACTIVE_TOUCH);
	board3.flushSequence();
	recorder.check('연출 종료 후 터치 다운 재개', input3.touchDown(toPosition(0, 0)) === true);
}

//#endregion

//#region 세션 - 라운드 / 제한시간 / 이벤트 순서

function testSession(recorder: TestRecorder, tables: SwitchPuzzleTables): void {
	const solver = new SwitchSolver();

	// §7 이벤트 순서: KEY_PRESSED(0.0) → AREA_TOGGLED(0.2) → PRESS_SEQUENCE_FINISHED(0.4)
	{
		const events = new SwitchPuzzleEvents();
		const session = new SwitchSession(events, tables, new SwitchLevelGenerator(tables), { seed: 500 });
		const order: string[] = [];
		events.KEY_PRESSED.subscribe(() => order.push('pressed'));
		events.AREA_TOGGLED.subscribe(() => order.push('area'));
		events.PRESS_SEQUENCE_FINISHED.subscribe(() => order.push('finished'));

		recorder.check('난이도로 퀘스트 시작', session.startQuestByDifficulty(1) === true);
		recorder.check('시작 상태는 PLAYER_INPUT', session.state === ESwitchPuzzleState.PLAYER_INPUT);

		const anyKey = session.board!.getPressablePositions()[0];
		session.pressKey(anyKey);
		recorder.check('누름 직후 KEY_PRESSED 만 발행', order.join(',') === 'pressed');
		session.update((PRESS_AREA_DELAY_SECONDS + PRESS_SEQUENCE_SECONDS) / 2);
		recorder.check('딜레이 경과에 AREA_TOGGLED', order.join(',') === 'pressed,area');
		session.update(PRESS_SEQUENCE_SECONDS);
		recorder.check('시퀀스 경과에 PRESS_SEQUENCE_FINISHED', order.join(',') === 'pressed,area,finished');

		// 연출 중 세션 경유 입력도 거절된다
		session.pressKey(anyKey);
		session.update(PRESS_AREA_DELAY_SECONDS / 2);
		const rejections: ESwitchRejection[] = [];
		events.PRESS_REJECTED.subscribe((rejection) => rejections.push(rejection));
		session.pressKey(anyKey);
		recorder.check('연출 중 세션 입력 거절', rejections.length === 1 && rejections[0] === ESwitchRejection.SEQUENCE_IN_PROGRESS);
		session.update(1);
	}

	// MASK_CHANGED 가 라운드 시작마다 발행된다 (§6 / §9.5)
	{
		const events = new SwitchPuzzleEvents();
		const session = new SwitchSession(events, tables, new SwitchLevelGenerator(tables), { seed: 42 });
		const masks: number[][] = [];
		events.MASK_CHANGED.subscribe((mask) => masks.push(mask));
		session.startQuestByDifficulty(1);
		recorder.check('라운드 시작 시 MASK_CHANGED 발행', masks.length === 1 && masks[0].length === 9);
		recorder.check('발행된 마스크의 중앙은 1', masks[0][4] === 1);
		recorder.check('세션 마스크 조회 API', session.getMask() !== undefined && session.getMask()!.length === 9);
	}

	// 솔버 해를 그대로 눌러 전 라운드 클리어
	for (let difficulty = 1; difficulty <= 5; difficulty++) {
		const events = new SwitchPuzzleEvents();
		const session = new SwitchSession(events, tables, new SwitchLevelGenerator(tables), { seed: difficulty * 777 });
		let cleared: boolean = false;
		events.QUEST_CLEAR.subscribe(() => { cleared = true; });

		session.startQuestByDifficulty(difficulty);
		let guard = 0;
		while (session.state === ESwitchPuzzleState.PLAYER_INPUT && guard < 200) {
			guard++;
			const board = session.board!;
			const solution = solver.solve(board.grid, board.mask);
			if (solution.isSolvable === false || solution.pressCount === 0) {
				break;
			}
			for (const position of solution.pressPositions) {
				session.pressKey(position);
				session.update(PRESS_SEQUENCE_SECONDS + 0.01);
				if (session.state !== ESwitchPuzzleState.PLAYER_INPUT) {
					break;
				}
			}
		}
		recorder.check(`D${difficulty} 솔버 해로 퀘스트 클리어`, cleared && session.state === ESwitchPuzzleState.QUEST_CLEAR, `state=${session.state}`);
	}

	// 제한 시간 초과 → 실패
	{
		const events = new SwitchPuzzleEvents();
		const session = new SwitchSession(events, tables, new SwitchLevelGenerator(tables), { seed: 9 });
		let failed = false;
		events.QUEST_FAILED.subscribe(() => { failed = true; });
		session.startQuestByDifficulty(1);
		const limit = session.getRemainingTimeSeconds();
		session.update(limit + 1);
		recorder.check('제한 시간 초과 시 실패', failed && session.state === ESwitchPuzzleState.GAME_OVER);
		recorder.check('실패 후 입력 무시', session.pressKey(0) === undefined);
	}

	// 일시정지 / 재개
	{
		const events = new SwitchPuzzleEvents();
		const session = new SwitchSession(events, tables, new SwitchLevelGenerator(tables), { seed: 10 });
		session.startQuestByDifficulty(1);
		const before = session.getRemainingTimeSeconds();
		session.pause();
		recorder.check('일시정지 상태', session.state === ESwitchPuzzleState.PAUSED);
		session.update(5);
		recorder.check('일시정지 중 시간 정지', session.getRemainingTimeSeconds() === before);
		recorder.check('일시정지 중 입력 무시', session.pressKey(0) === undefined);
		session.resume();
		recorder.check('재개 후 상태 복원', session.state === ESwitchPuzzleState.PLAYER_INPUT);
	}

	// 라운드 진행도
	{
		const events = new SwitchPuzzleEvents();
		const session = new SwitchSession(events, tables, new SwitchLevelGenerator(tables), { seed: 11 });
		session.startQuestByDifficulty(2);
		const progress = session.getRoundProgress();
		recorder.check('D2 는 2라운드', progress.total === 2 && progress.current === 1 && progress.cleared === 0);
	}
}

//#endregion

//#region 기획 데이터 테이블 (NPUZ_08)

/**
 * `Documents/기획서 및 데이터 구조/DataTable/NPUZ_08_FieldData.csv` 에서 생성한 필드 테이블 검증.
 *
 * 이 퍼즐의 CSV 는 **초기 눌림 상태를 직접** 담고 있다(다른 퍼즐과 달리 역셔플로 만들지 않는다).
 * 임의의 0/1 배치는 마스크에 따라 해가 없을 수 있으므로, 전 판의 해 존재를 반드시 확인해야 한다.
 */
function testCsvFieldTable(recorder: TestRecorder, tables: SwitchPuzzleTables): void {
	const fields = SWITCH_CSV_FIELD_TABLE;
	recorder.check('CSV 필드 테이블이 비어 있지 않다', fields.length > 0, `${fields.length}`);
	recorder.check('운영 테이블이 CSV 를 쓴다', tables.fieldTable.length === fields.length);

	const generator = new SwitchLevelGenerator(tables);
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
			seed: 777,
		});
		if (level === undefined) {
			failedGeneration.push(field.puzzleId);
			continue;
		}

		// 검증기가 "해 존재 + 최소 해 <= shuffleCount" 를 함께 본다
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
	recorder.check('모든 CSV 레벨에 해가 존재하고 최소 해가 기록값과 맞음',
		invalidLevel.length === 0, invalidLevel.slice(0, 3).join(' | '));

	const orphans = difficulties.filter((difficulty) => tables.getDifficultyConfig(difficulty) === undefined);
	recorder.check('모든 난이도가 난이도 테이블에 있다', orphans.length === 0, orphans.join());

	for (const config of tables.difficultyTable) {
		const count = tables.fieldTable.filter((field) => field.difficulty === config.difficulty).length;
		recorder.check(`난이도 ${config.difficulty} 판이 존재`, count > 0, `${count}`);
	}
}

//#endregion
