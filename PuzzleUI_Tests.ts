/**
 * Puzzle UI Tests - 메인 UI(퍼즐 허브) 검증 하네스
 *
 *   - 시계 라벨 포맷 / 카탈로그 무결성
 *   - 핸들 팩토리(createPuzzleHandle)의 정규화 (승패 매핑, 구독 해제)
 *   - 레지스트리 등록·교체·이벤트
 *   - 모델의 화면 전이 전체 (선택 → 난이도 → 인게임 → 일시정지 → 결과 → 재도전 → 메뉴)
 *   - 잘못된 화면에서의 액션 거절 / 미등록 퍼즐 잠금 / 시작 실패 경로 2종
 *   - **실제 SwitchSession 과의 통합** - 솔버로 실제 클리어, 시간 초과 실패, 메뉴 복귀
 *
 * Horizon Component 가 아니라 순수 검증 하네스다. `runPuzzleUITests()` 를 호출하면 결과를 돌려준다.
 */

import { EventPublisher } from 'Utility_Events';
import { SwitchLevelGenerator } from 'Switch_LevelGenerator';
import { SwitchPuzzleEvents } from 'Switch_GameEvents';
import { SwitchSession } from 'Switch_Session';
import { SwitchSolver } from 'Switch_Solver';
import { SwitchPuzzleTables } from 'Switch_DataTables';
import { ESwitchPuzzleState, PRESS_SEQUENCE_SECONDS } from 'Switch_Definitions';
import {
	IPuzzleGameHandle,
	PuzzleHubRegistry,
	PuzzleQuestEventSources,
	createPuzzleHandle,
	probePuzzleDifficulties,
} from 'PuzzleUI_Registry';
import { PuzzleHubModel } from 'PuzzleUI_Model';
import {
	EPuzzleHubScreen,
	EPuzzleId,
	PUZZLE_CATALOG,
	PuzzleQuestResultSource,
	PuzzleUIRoundProgress,
	formatClockLabel,
} from 'PuzzleUI_Definitions';

export type PuzzleUITestResult = {
	name: string,
	isPassed: boolean,
	detail?: string,
}

export type PuzzleUITestReport = {
	passed: number,
	failed: number,
	results: PuzzleUITestResult[],
}

class TestRecorder {
	public readonly results: PuzzleUITestResult[] = [];

	public check(name: string, condition: boolean, detail?: string): void {
		this.results.push({ name: name, isPassed: condition, detail: condition ? undefined : detail });
	}
}

//#region Fakes

/** 8개 퍼즐 이벤트 허브와 같은 모양의 가짜 - 모델을 임의로 조종한다 */
class FakeQuestEvents implements PuzzleQuestEventSources {
	public readonly TIME_CHANGED = new EventPublisher<number>();
	public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<PuzzleUIRoundProgress>();
	public readonly QUEST_CLEAR = new EventPublisher<PuzzleQuestResultSource>();
	public readonly QUEST_FAILED = new EventPublisher<PuzzleQuestResultSource>();
	public readonly GAME_PAUSE = new EventPublisher<void>();
	public readonly GAME_RESUME = new EventPublisher<void>();
}

type FakeGameOptions = {
	difficulties?: number[],
	/** startQuestByDifficulty 가 무엇을 할지 */
	startBehaviour?: 'succeed' | 'reject' | 'fail-with-event',
}

/** 세션 역할의 가짜. 호출 기록을 남긴다 */
class FakeGame {
	public readonly events: FakeQuestEvents = new FakeQuestEvents();
	public startCalls: number[] = [];
	public pauseCount: number = 0;
	public resumeCount: number = 0;
	public abortCount: number = 0;
	public remainingSeconds: number = 60;
	public progress: PuzzleUIRoundProgress = { current: 1, total: 2, cleared: 0 };

	private readonly _options: FakeGameOptions;

	constructor(options: FakeGameOptions = {}) {
		this._options = options;
	}

	public createHandle(puzzleId: EPuzzleId): IPuzzleGameHandle {
		return createPuzzleHandle(
			puzzleId,
			{
				startQuestByDifficulty: (difficulty) => this.start(difficulty),
				pause: () => { this.pauseCount++; this.events.GAME_PAUSE.publish(undefined); },
				resume: () => { this.resumeCount++; this.events.GAME_RESUME.publish(undefined); },
				abort: () => { this.abortCount++; },
				getRemainingTimeSeconds: () => this.remainingSeconds,
				getRoundProgress: () => ({ ...this.progress }),
			},
			this.events,
			this._options.difficulties ?? [1, 2, 3],
		);
	}

	private start(difficulty: number): boolean {
		this.startCalls.push(difficulty);
		const behaviour = this._options.startBehaviour ?? 'succeed';
		if (behaviour === 'reject') {
			return false;
		}
		if (behaviour === 'fail-with-event') {
			// 레벨 생성 실패 경로 - 세션이 fail() 을 경유해 동기적으로 알린다 (진행 문서 §8.2)
			this.events.QUEST_FAILED.publish({ roundsCleared: 0, roundCount: 2, remainingTimeSeconds: 60 });
			return false;
		}
		return true;
	}
}

//#endregion

export function runPuzzleUITests(): PuzzleUITestReport {
	const recorder = new TestRecorder();

	testClockLabel(recorder);
	testCatalog(recorder);
	testProbeDifficulties(recorder);
	testHandleFactory(recorder);
	testRegistry(recorder);
	testModelSelectionFlow(recorder);
	testModelGameFlow(recorder);
	testModelStartFailures(recorder);
	testModelGuards(recorder);
	testSwitchIntegration(recorder);

	let passed = 0;
	let failed = 0;
	for (const result of recorder.results) {
		if (result.isPassed) { passed++; } else { failed++; }
	}
	return { passed: passed, failed: failed, results: recorder.results };
}

//#region Unit tests

function testClockLabel(recorder: TestRecorder): void {
	recorder.check('시계 라벨 - 0초', formatClockLabel(0) === '0:00', formatClockLabel(0));
	recorder.check('시계 라벨 - 5초 패딩', formatClockLabel(5) === '0:05', formatClockLabel(5));
	recorder.check('시계 라벨 - 65초', formatClockLabel(65) === '1:05', formatClockLabel(65));
	recorder.check('시계 라벨 - 125초', formatClockLabel(125) === '2:05', formatClockLabel(125));
	recorder.check('시계 라벨 - 10분', formatClockLabel(600) === '10:00', formatClockLabel(600));
	recorder.check('시계 라벨 - 음수는 0으로', formatClockLabel(-3) === '0:00', formatClockLabel(-3));
	recorder.check('시계 라벨 - 소수는 올림', formatClockLabel(3.2) === '0:04', formatClockLabel(3.2));
}

function testCatalog(recorder: TestRecorder): void {
	recorder.check('카탈로그 - 8개 퍼즐', PUZZLE_CATALOG.length === 8, `${PUZZLE_CATALOG.length}`);

	const ids: string[] = [];
	let isOrderCorrect = true;
	for (let i = 0; i < PUZZLE_CATALOG.length; i++) {
		if (ids.indexOf(PUZZLE_CATALOG[i].id) >= 0) {
			ids.push('DUPLICATE');
		} else {
			ids.push(PUZZLE_CATALOG[i].id);
		}
		if (PUZZLE_CATALOG[i].orderIndex !== i) {
			isOrderCorrect = false;
		}
	}
	recorder.check('카탈로그 - id 중복 없음', ids.indexOf('DUPLICATE') < 0);
	recorder.check('카탈로그 - orderIndex 가 배열 순서와 일치', isOrderCorrect);

	let hasEmptyName = false;
	for (const entry of PUZZLE_CATALOG) {
		if (entry.displayName.length === 0 || entry.subtitle.length === 0) {
			hasEmptyName = true;
		}
	}
	recorder.check('카탈로그 - 이름/부제 비어 있지 않음', hasEmptyName === false);
}

function testProbeDifficulties(recorder: TestRecorder): void {
	const table: { [key: number]: string } = { 1: 'a', 2: 'b', 3: 'c', 5: 'e' };
	const probed = probePuzzleDifficulties((difficulty) => table[difficulty]);
	recorder.check('난이도 탐침 - 정의된 난이도만', probed.join(',') === '1,2,3,5', probed.join(','));

	const empty = probePuzzleDifficulties(() => undefined);
	recorder.check('난이도 탐침 - 빈 테이블은 빈 목록', empty.length === 0);
}

function testHandleFactory(recorder: TestRecorder): void {
	const game = new FakeGame({ difficulties: [3, 1, 2] });
	const handle = game.createHandle(EPuzzleId.SWITCH);

	recorder.check('핸들 - 난이도가 오름차순으로 정렬됨', handle.getDifficulties().join(',') === '1,2,3');

	const received: string[] = [];
	const subscriptions = handle.subscribeQuestEvents({
		onTimeChanged: (seconds) => received.push(`t${seconds}`),
		onRoundProgressChanged: (progress) => received.push(`r${progress.current}/${progress.total}`),
		onQuestEnded: (result) => received.push(result.isWin ? 'win' : 'lose'),
		onPaused: () => received.push('pause'),
		onResumed: () => received.push('resume'),
	});

	game.events.TIME_CHANGED.publish(42);
	game.events.ROUND_PROGRESS_CHANGED.publish({ current: 2, total: 3, cleared: 1 });
	game.events.QUEST_CLEAR.publish({ roundsCleared: 3, roundCount: 3, remainingTimeSeconds: 10 });
	game.events.QUEST_FAILED.publish({ roundsCleared: 1, roundCount: 3, remainingTimeSeconds: 0 });
	game.events.GAME_PAUSE.publish(undefined);
	game.events.GAME_RESUME.publish(undefined);

	recorder.check('핸들 - 이벤트 정규화 (승/패 매핑 포함)',
		received.join(' ') === 't42 r2/3 win lose pause resume', received.join(' '));

	for (const subscription of subscriptions) {
		subscription.disconnect();
	}
	game.events.TIME_CHANGED.publish(7);
	recorder.check('핸들 - 구독 해제 후에는 전달되지 않음', received.indexOf('t7') < 0);

	handle.startQuestByDifficulty(2);
	handle.pause();
	handle.resume();
	handle.abort();
	recorder.check('핸들 - 조작이 세션 컨트롤로 전달됨',
		game.startCalls.join(',') === '2' && game.pauseCount === 1 && game.resumeCount === 1 && game.abortCount === 1);
}

function testRegistry(recorder: TestRecorder): void {
	const registry = new PuzzleHubRegistry();
	const game = new FakeGame();

	recorder.check('레지스트리 - 초기에는 비어 있음',
		registry.isRegistered(EPuzzleId.SWITCH) === false && registry.getRegisteredIds().length === 0);

	let registeredCount = 0;
	registry.HANDLE_REGISTERED.subscribe(() => registeredCount++);

	const handle = game.createHandle(EPuzzleId.SWITCH);
	registry.register(handle);
	recorder.check('레지스트리 - 등록 후 조회 가능',
		registry.isRegistered(EPuzzleId.SWITCH) && registry.getHandle(EPuzzleId.SWITCH) === handle);
	recorder.check('레지스트리 - 등록 이벤트 발행', registeredCount === 1);

	const replacement = game.createHandle(EPuzzleId.SWITCH);
	registry.register(replacement);
	recorder.check('레지스트리 - 재등록은 최신 핸들로 교체',
		registry.getHandle(EPuzzleId.SWITCH) === replacement && registry.getRegisteredIds().length === 1);
}

//#endregion

//#region Model tests

function testModelSelectionFlow(recorder: TestRecorder): void {
	const registry = new PuzzleHubRegistry();
	const model = new PuzzleHubModel(registry);

	recorder.check('모델 - 초기 화면은 메인 메뉴', model.screen === EPuzzleHubScreen.MAIN_MENU);

	const initialCatalog = model.getCatalogView();
	let allLocked = true;
	for (const entry of initialCatalog) {
		if (entry.isAvailable) { allLocked = false; }
	}
	recorder.check('모델 - 핸들이 없으면 전 퍼즐이 준비 중', initialCatalog.length === 8 && allLocked);

	let lockedTapped: EPuzzleId | undefined = undefined;
	model.events.LOCKED_PUZZLE_TAPPED.subscribe((id) => { lockedTapped = id; });
	recorder.check('모델 - 미등록 퍼즐 선택 거절',
		model.selectPuzzle(EPuzzleId.LASER) === false && lockedTapped === EPuzzleId.LASER
		&& model.screen === EPuzzleHubScreen.MAIN_MENU);

	let catalogChangedCount = 0;
	model.events.CATALOG_CHANGED.subscribe(() => catalogChangedCount++);
	const game = new FakeGame({ difficulties: [1, 2, 3, 4, 5] });
	registry.register(game.createHandle(EPuzzleId.SWITCH));
	recorder.check('모델 - 핸들 등록 시 카탈로그 갱신 이벤트', catalogChangedCount === 1);

	const catalog = model.getCatalogView();
	const switchEntry = catalog.find((entry) => entry.id === EPuzzleId.SWITCH);
	recorder.check('모델 - 등록된 퍼즐만 이용 가능 표시', switchEntry !== undefined && switchEntry.isAvailable);

	recorder.check('모델 - 퍼즐 선택 → 난이도 화면',
		model.selectPuzzle(EPuzzleId.SWITCH) && model.screen === EPuzzleHubScreen.DIFFICULTY_SELECT);

	const selection = model.getSelectionView();
	recorder.check('모델 - 선택 뷰 (이름 / 난이도 목록 / 기본 난이도)',
		selection.puzzleId === EPuzzleId.SWITCH && selection.displayName === '스위치'
		&& selection.difficulties.join(',') === '1,2,3,4,5' && selection.selectedDifficulty === 1);

	recorder.check('모델 - 목록에 없는 난이도 거절', model.selectDifficulty(99) === false);
	recorder.check('모델 - 난이도 변경',
		model.selectDifficulty(3) && model.getSelectionView().selectedDifficulty === 3);

	recorder.check('모델 - 뒤로 → 메인 메뉴', model.back() && model.screen === EPuzzleHubScreen.MAIN_MENU);

	model.dispose();
}

function testModelGameFlow(recorder: TestRecorder): void {
	const registry = new PuzzleHubRegistry();
	const model = new PuzzleHubModel(registry);
	const game = new FakeGame({ difficulties: [1, 2, 3] });
	registry.register(game.createHandle(EPuzzleId.SWITCH));

	model.selectPuzzle(EPuzzleId.SWITCH);
	model.selectDifficulty(2);
	recorder.check('모델 - 시작 → 인게임',
		model.startSelected() && model.screen === EPuzzleHubScreen.IN_GAME && game.startCalls.join(',') === '2');

	let hudCount = 0;
	model.events.HUD_CHANGED.subscribe(() => hudCount++);
	game.events.TIME_CHANGED.publish(59);
	game.events.ROUND_PROGRESS_CHANGED.publish({ current: 2, total: 2, cleared: 1 });
	const hud = model.getHudView();
	recorder.check('모델 - HUD 갱신 (시간·라운드·시계 라벨)',
		hudCount === 2 && hud.remainingTimeSeconds === 59 && hud.clockLabel === '0:59'
		&& hud.round.current === 2 && hud.round.cleared === 1 && hud.displayName === '스위치');

	model.pauseGame();
	recorder.check('모델 - 일시정지', model.screen === EPuzzleHubScreen.PAUSED && game.pauseCount === 1);
	model.resumeGame();
	recorder.check('모델 - 재개', model.screen === EPuzzleHubScreen.IN_GAME && game.resumeCount === 1);

	let resultReadyCount = 0;
	model.events.RESULT_READY.subscribe(() => resultReadyCount++);
	game.events.QUEST_CLEAR.publish({ roundsCleared: 2, roundCount: 2, remainingTimeSeconds: 31 });
	const result = model.getLastResult();
	recorder.check('모델 - 클리어 → 결과 화면',
		model.screen === EPuzzleHubScreen.RESULT && resultReadyCount === 1
		&& result !== undefined && result.isWin && result.roundsCleared === 2 && result.remainingTimeSeconds === 31);

	recorder.check('모델 - 재도전 → 같은 난이도로 재시작',
		model.retry() && model.screen === EPuzzleHubScreen.IN_GAME && game.startCalls.join(',') === '2,2');

	game.events.QUEST_FAILED.publish({ roundsCleared: 0, roundCount: 2, remainingTimeSeconds: 0 });
	recorder.check('모델 - 실패 → 결과 화면 (패배)',
		model.screen === EPuzzleHubScreen.RESULT && model.getLastResult()?.isWin === false);

	recorder.check('모델 - 메뉴 복귀 시 abort 호출',
		model.quitToMenu() && model.screen === EPuzzleHubScreen.MAIN_MENU && game.abortCount === 1);

	// 구독이 끊겼으므로 이후 이벤트는 화면을 바꾸지 못한다
	game.events.QUEST_CLEAR.publish({ roundsCleared: 2, roundCount: 2, remainingTimeSeconds: 5 });
	recorder.check('모델 - 메뉴 복귀 후 잔여 이벤트 무시', model.screen === EPuzzleHubScreen.MAIN_MENU);

	model.dispose();
}

function testModelStartFailures(recorder: TestRecorder): void {
	// 1) 이벤트 없이 거절 (알 수 없는 난이도 등) - 난이도 화면 유지 + START_FAILED
	{
		const registry = new PuzzleHubRegistry();
		const model = new PuzzleHubModel(registry);
		const game = new FakeGame({ startBehaviour: 'reject' });
		registry.register(game.createHandle(EPuzzleId.FLOW));

		let startFailed: EPuzzleId | undefined = undefined;
		model.events.START_FAILED.subscribe((id) => { startFailed = id; });

		model.selectPuzzle(EPuzzleId.FLOW);
		recorder.check('모델 - 시작 거절 시 난이도 화면 유지 + 알림',
			model.startSelected() === false && model.screen === EPuzzleHubScreen.DIFFICULTY_SELECT
			&& startFailed === EPuzzleId.FLOW);
		model.dispose();
	}

	// 2) 레벨 생성 실패 - 시작 함수 안에서 QUEST_FAILED 가 동기 발행 → 결과 화면으로 수렴 (§8.2)
	{
		const registry = new PuzzleHubRegistry();
		const model = new PuzzleHubModel(registry);
		const game = new FakeGame({ startBehaviour: 'fail-with-event' });
		registry.register(game.createHandle(EPuzzleId.LASER));

		model.selectPuzzle(EPuzzleId.LASER);
		recorder.check('모델 - 생성 실패(동기 QUEST_FAILED) → 결과 화면',
			model.startSelected() === false && model.screen === EPuzzleHubScreen.RESULT
			&& model.getLastResult()?.isWin === false);
		model.dispose();
	}
}

function testModelGuards(recorder: TestRecorder): void {
	const registry = new PuzzleHubRegistry();
	const model = new PuzzleHubModel(registry);
	const game = new FakeGame();
	registry.register(game.createHandle(EPuzzleId.SWITCH));

	recorder.check('가드 - 메인 메뉴에서 back/start/retry/quit 거절',
		model.back() === false && model.startSelected() === false
		&& model.retry() === false && model.quitToMenu() === false);

	model.selectPuzzle(EPuzzleId.SWITCH);
	recorder.check('가드 - 난이도 화면에서 selectPuzzle 거절', model.selectPuzzle(EPuzzleId.SWITCH) === false);

	model.startSelected();
	recorder.check('가드 - 인게임에서 selectPuzzle/selectDifficulty/back 거절',
		model.selectPuzzle(EPuzzleId.SWITCH) === false && model.selectDifficulty(2) === false
		&& model.back() === false && model.screen === EPuzzleHubScreen.IN_GAME);

	// 일시정지 화면이 아닐 때의 resume 은 무시된다
	model.resumeGame();
	recorder.check('가드 - 인게임에서 resume 무시', model.screen === EPuzzleHubScreen.IN_GAME && game.resumeCount === 0);

	model.dispose();
}

//#endregion

//#region Switch integration (실제 세션·솔버로 전체 흐름 검증)

function testSwitchIntegration(recorder: TestRecorder): void {
	const tables = new SwitchPuzzleTables();
	const events = new SwitchPuzzleEvents();
	const session = new SwitchSession(events, tables, new SwitchLevelGenerator(tables), { seed: 4242 });
	const solver = new SwitchSolver();

	const registry = new PuzzleHubRegistry();
	const model = new PuzzleHubModel(registry);

	registry.register(createPuzzleHandle(
		EPuzzleId.SWITCH,
		{
			startQuestByDifficulty: (difficulty) => session.startQuestByDifficulty(difficulty),
			pause: () => session.pause(),
			resume: () => session.resume(),
			abort: () => session.abort(),
			getRemainingTimeSeconds: () => session.getRemainingTimeSeconds(),
			getRoundProgress: () => session.getRoundProgress(),
		},
		events,
		probePuzzleDifficulties((difficulty) => tables.getQuestByDifficulty(difficulty)),
	));

	recorder.check('통합 - 실제 테이블에서 난이도 1~5 탐침',
		registry.getHandle(EPuzzleId.SWITCH)?.getDifficulties().join(',') === '1,2,3,4,5');

	model.selectPuzzle(EPuzzleId.SWITCH);
	recorder.check('통합 - 스위치 D1 시작 → 인게임',
		model.startSelected() && model.screen === EPuzzleHubScreen.IN_GAME
		&& session.state === ESwitchPuzzleState.PLAYER_INPUT);

	// 솔버가 시키는 대로 한 칸씩 누르고 연출(0.4초)을 끝까지 돌린다 → 실제 클리어
	let guard = 0;
	while (model.screen === EPuzzleHubScreen.IN_GAME && guard < 500) {
		guard++;
		const board = session.board;
		if (board === undefined) {
			break;
		}
		const solution = solver.solve(board.grid, board.mask);
		if (solution.isSolvable === false || solution.pressPositions.length === 0) {
			break;
		}
		session.pressKey(solution.pressPositions[0]);
		session.update(PRESS_SEQUENCE_SECONDS + 0.01);
	}
	const winResult = model.getLastResult();
	recorder.check('통합 - 솔버 플레이로 실제 클리어 → 결과(승리)',
		model.screen === EPuzzleHubScreen.RESULT && winResult !== undefined && winResult.isWin,
		`guard=${guard} screen=${model.screen}`);
	recorder.check('통합 - 승리 결과에 라운드가 모두 반영',
		winResult !== undefined && winResult.roundsCleared === winResult.roundCount && winResult.roundCount > 0);

	// 재도전 → 이번에는 시간 초과로 실패
	recorder.check('통합 - 재도전 → 인게임',
		model.retry() && model.screen === EPuzzleHubScreen.IN_GAME);
	session.update(10_000);
	recorder.check('통합 - 시간 초과 → 결과(패배)',
		model.screen === EPuzzleHubScreen.RESULT && model.getLastResult()?.isWin === false);

	// HUD 시계 라벨이 세션의 제한 시간을 따라왔는지 (실패 시점 0초)
	recorder.check('통합 - HUD 시계 라벨 0:00', model.getHudView().clockLabel === '0:00');

	recorder.check('통합 - 메뉴 복귀 시 세션이 IDLE 로',
		model.quitToMenu() && session.state === ESwitchPuzzleState.IDLE);

	model.dispose();
}

//#endregion
