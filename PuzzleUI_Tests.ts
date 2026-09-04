/**
 * Puzzle UI Tests - 메인 UI(퍼즐 허브) 검증 하네스
 *
 *   - 시계 라벨 포맷 / 카탈로그 무결성
 *   - 레벨 테이블 조립 (난이도 오름차순 × 각 난이도의 판)
 *   - 핸들 팩토리(createPuzzleHandle)의 정규화 (승패 매핑, 레벨 → 난이도·판 변환, 구독 해제)
 *   - 레지스트리 등록·교체·이벤트
 *   - 진행도 저장소 (기록·이어하기 레벨·전부 클리어·직렬화)
 *   - **인게임 HUD** - 좌측 레벨 표시, 상단 중앙 초 단위 카운트다운, 10초 초읽기 판정
 *   - **리셋** - 인게임에서만 통하고 남은 시간을 되돌리지 않는다
 *   - 모델의 화면 전이 전체 (선택 → 상세 → Start/Continue → 인게임 → 일시정지 → 결과 → 메뉴)
 *   - 잘못된 화면에서의 액션 거절 / 미등록 퍼즐 잠금 / 시작 실패 경로 2종
 *   - **시스템 메뉴** - Restart Level 이 일시정지 중에도 레벨을 처음부터 다시 연다
 *   - **재입장** - 허브가 새로 시작하면 언제나 메인 메뉴이고 진행도는 남는다
 *   - **기기별 화면 규격**(`PuzzleUI_Layout`) - 격자가 화면을 넘지 않는지, 글자가 상자를 따라가는지
 *   - **실제 SwitchSession 과의 통합** - 솔버로 실제 클리어, 진행도 반영, 시간 초과 실패
 *
 * Horizon Component 가 아니라 순수 검증 하네스다. `runPuzzleUITests()` 를 호출하면 결과를 돌려준다.
 */

import { EventPublisher } from 'Utility_Events';
import { SwitchLevelGenerator } from 'Switch_LevelGenerator';
import { SwitchPuzzleEvents } from 'Switch_GameEvents';
import { SwitchSession } from 'Switch_Session';
import { SwitchSolver } from 'Switch_Solver';
import { SwitchPuzzleTables } from 'Switch_DataTables';
import { ESwitchCellState, ESwitchPuzzleState, PRESS_SEQUENCE_SECONDS, SWITCH_CELL_COUNT } from 'Switch_Definitions';
import {
	IPuzzleGameHandle,
	PuzzleHubRegistry,
	PuzzleQuestEventSources,
	buildPuzzleLevelTable,
	createPuzzleHandle,
	probePuzzleDifficulties,
} from 'PuzzleUI_Registry';
import { PuzzleHubModel } from 'PuzzleUI_Model';
import {
	AUX_AREA_FLEX,
	BOARD_AREA_FLEX,
	TRAY_HEIGHT_USAGE,
	TRAY_MAX_VISIBLE_SLOTS,
	TRAY_WIDTH_USAGE,
	auxAreaFraction,
	boardAreaFraction,
	boardSquareFraction,
	cellFraction,
	computeGridBox,
	percentText,
	resolveRelativeLayout,
	trayGrid,
	trayPageCount,
	traySlotsPerPage,
} from 'PuzzleUI_RelativeLayout';
import {
	EUIDeviceClass,
	PUZZLE_UI_CANVAS_HEIGHT,
	PUZZLE_UI_CANVAS_WIDTH,
	PUZZLE_UI_MAX_ASPECT,
	PUZZLE_UI_MIN_ASPECT,
	PUZZLE_UI_TRAY_SLOT_COUNT,
	TRAY_SLOT_LOWER_HALF_RATIO,
	clampBoardArea,
	computeBoardGeometry,
	computeGridPixels,
	computeSafeAreaPixels,
	computeTrayPageCount,
	computeTrayPageSize,
	fitBoardAreaToCanvas,
	fitBoardAreaToProfile,
	canvasPixelScale,
	fitFontSize,
	fitSquareSide,
	getCatalogColumns,
	getDefaultCanvas,
	getLayoutProfile,
	getUsableHeightPercent,
	getUsableWidthPercent,
	makeCanvas,
	percentOf,
	resolveCanvas,
	verticalPixels,
	toUIDeviceClass,
	validateBoardArea,
} from 'PuzzleUI_Layout';
import {
	MemoryProgressStorage,
	PuzzleProgressTracker,
	parseProgressSnapshot,
	stringifyProgressSnapshot,
} from 'PuzzleUI_Progress';
import {
	EPuzzleHubScreen,
	EPuzzleId,
	HUD_TIME_CRITICAL_SECONDS,
	PUZZLE_CATALOG,
	PuzzleQuestResultSource,
	PuzzleUIRoundProgress,
	formatClockLabel,
	formatLevelLabel,
	formatSecondsLabel,
	isTimeCritical,
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
	/** 난이도별 판 수. 기본은 난이도 1이 2판, 2가 3판 (= 총 5레벨) */
	fieldCounts?: { [difficulty: number]: number },
	/** startLevel 이 무엇을 할지 */
	startBehaviour?: 'succeed' | 'reject' | 'fail-with-event',
}

const DEFAULT_FIELD_COUNTS: { [difficulty: number]: number } = { 1: 2, 2: 3 };

/** 세션 역할의 가짜. 호출 기록을 남긴다 */
class FakeGame {
	public readonly events: FakeQuestEvents = new FakeQuestEvents();
	/** startLevel 로 들어온 (난이도, 판 순번) 기록. "d1#0" 형태 */
	public startCalls: string[] = [];
	public pauseCount: number = 0;
	public resumeCount: number = 0;
	public abortCount: number = 0;
	public resetCount: number = 0;
	public remainingSeconds: number = 60;
	public progress: PuzzleUIRoundProgress = { current: 1, total: 1, cleared: 0 };

	private readonly _options: FakeGameOptions;

	constructor(options: FakeGameOptions = {}) {
		this._options = options;
	}

	public get fieldCounts(): { [difficulty: number]: number } {
		return this._options.fieldCounts ?? DEFAULT_FIELD_COUNTS;
	}

	public createHandle(puzzleId: EPuzzleId): IPuzzleGameHandle {
		const counts = this.fieldCounts;
		return createPuzzleHandle(
			puzzleId,
			{
				startLevel: (difficulty, fieldOrdinal) => this.start(difficulty, fieldOrdinal),
				startQuestByDifficulty: (difficulty) => this.start(difficulty, -1),
				resetLevel: () => { this.resetCount++; return true; },
				pause: () => { this.pauseCount++; this.events.GAME_PAUSE.publish(undefined); },
				resume: () => { this.resumeCount++; this.events.GAME_RESUME.publish(undefined); },
				abort: () => { this.abortCount++; },
				getRemainingTimeSeconds: () => this.remainingSeconds,
				getRoundProgress: () => ({ ...this.progress }),
			},
			this.events,
			buildPuzzleLevelTable(
				(difficulty) => (counts[difficulty] === undefined ? undefined : true),
				(difficulty) => counts[difficulty] ?? 0,
			),
		);
	}

	private start(difficulty: number, fieldOrdinal: number): boolean {
		this.startCalls.push(`d${difficulty}#${fieldOrdinal}`);
		const behaviour = this._options.startBehaviour ?? 'succeed';
		if (behaviour === 'reject') {
			return false;
		}
		if (behaviour === 'fail-with-event') {
			// 레벨 생성 실패 경로 - 세션이 fail() 을 경유해 동기적으로 알린다
			this.events.QUEST_FAILED.publish({ roundsCleared: 0, roundCount: 1, remainingTimeSeconds: 60 });
			return false;
		}
		return true;
	}
}

/** 등록 + 모델을 한 번에 세우는 헬퍼 - 테스트마다 같은 네 줄을 반복하지 않는다 */
function createHarness(puzzleId: EPuzzleId, options: FakeGameOptions = {}) {
	const registry = new PuzzleHubRegistry();
	const model = new PuzzleHubModel(registry, new PuzzleProgressTracker(new MemoryProgressStorage()));
	const game = new FakeGame(options);
	registry.register(game.createHandle(puzzleId));
	return { registry: registry, model: model, game: game };
}

//#endregion

export function runPuzzleUITests(): PuzzleUITestReport {
	const recorder = new TestRecorder();

	testClockLabel(recorder);
	testCatalog(recorder);
	testProbeDifficulties(recorder);
	testLevelTable(recorder);
	testProgressTracker(recorder);
	testHandleFactory(recorder);
	testRegistry(recorder);
	testModelSelectionFlow(recorder);
	testModelStartAndContinue(recorder);
	testModelGameFlow(recorder);
	testModelStartFailures(recorder);
	testHudLabels(recorder);
	testModelReset(recorder);
	testModelRestartAndBoot(recorder);
	testModelGuards(recorder);
	testDeviceLayout(recorder);
	testRelativeLayout(recorder);
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
	// 메인 메뉴가 2열 × 4행 격자이므로 8종이 정확히 맞아떨어져야 한다
	recorder.check('카탈로그 - 2열 격자에 딱 맞는 개수', PUZZLE_CATALOG.length % 2 === 0);

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

function testLevelTable(recorder: TestRecorder): void {
	const quests: { [key: number]: string } = { 1: 'q1', 2: 'q2', 4: 'q4' };
	const counts: { [key: number]: number } = { 1: 2, 2: 3, 4: 1 };

	const levels = buildPuzzleLevelTable(
		(difficulty) => quests[difficulty],
		(difficulty) => counts[difficulty] ?? 0,
	);

	recorder.check('레벨 테이블 - 판 수의 합이 총 레벨 수', levels.length === 6, `${levels.length}`);

	const shape = levels.map((ref) => `${ref.level}:d${ref.difficulty}#${ref.fieldOrdinal}`).join(' ');
	recorder.check('레벨 테이블 - 난이도 오름차순으로 판을 이어 붙인다',
		shape === '1:d1#0 2:d1#1 3:d2#0 4:d2#1 5:d2#2 6:d4#0', shape);

	// 기획 판이 없는 난이도(절차적 생성 폴백)도 레벨 하나는 있어야 한다
	const fallback = buildPuzzleLevelTable((difficulty) => (difficulty <= 2 ? 'q' : undefined), () => 0);
	recorder.check('레벨 테이블 - 판이 없는 난이도는 레벨 1개로', fallback.length === 2);

	const none = buildPuzzleLevelTable(() => undefined, () => 5);
	recorder.check('레벨 테이블 - 퀘스트가 없으면 빈 목록', none.length === 0);
}

function testProgressTracker(recorder: TestRecorder): void {
	const storage = new MemoryProgressStorage();
	const tracker = new PuzzleProgressTracker(storage);

	recorder.check('진행도 - 기록이 없으면 0 / Continue 잠김',
		tracker.getClearedLevel(EPuzzleId.SWITCH) === 0 && tracker.hasProgress(EPuzzleId.SWITCH) === false);
	recorder.check('진행도 - 기록이 없으면 Continue 레벨은 1',
		tracker.getContinueLevel(EPuzzleId.SWITCH, 10) === 1);

	recorder.check('진행도 - 클리어 기록', tracker.recordCleared(EPuzzleId.SWITCH, 3));
	recorder.check('진행도 - Continue 는 다음 레벨',
		tracker.getClearedLevel(EPuzzleId.SWITCH) === 3 && tracker.getContinueLevel(EPuzzleId.SWITCH, 10) === 4);

	recorder.check('진행도 - 뒤로 가는 기록은 무시', tracker.recordCleared(EPuzzleId.SWITCH, 2) === false
		&& tracker.getClearedLevel(EPuzzleId.SWITCH) === 3);
	recorder.check('진행도 - 퍼즐끼리 섞이지 않음', tracker.getClearedLevel(EPuzzleId.LASER) === 0);

	tracker.recordCleared(EPuzzleId.SWITCH, 10);
	recorder.check('진행도 - 전부 클리어하면 완료 표시', tracker.isCompleted(EPuzzleId.SWITCH, 10));
	recorder.check('진행도 - 전부 클리어면 Continue 는 마지막 레벨',
		tracker.getContinueLevel(EPuzzleId.SWITCH, 10) === 10);

	// 저장소를 공유하는 새 tracker 가 같은 값을 읽어야 영구 저장이 의미가 있다
	const reloaded = new PuzzleProgressTracker(storage);
	recorder.check('진행도 - 저장소에서 다시 읽어도 유지', reloaded.getClearedLevel(EPuzzleId.SWITCH) === 10);

	tracker.reset(EPuzzleId.SWITCH);
	recorder.check('진행도 - 퍼즐 하나만 초기화', tracker.getClearedLevel(EPuzzleId.SWITCH) === 0);

	// 직렬화 - 영구 변수에 문자열로 담고 되읽는 경로
	const round = parseProgressSnapshot(stringifyProgressSnapshot({ LASER: 4, SWITCH: 2 }));
	recorder.check('진행도 - 직렬화 왕복', round['LASER'] === 4 && round['SWITCH'] === 2);
	recorder.check('진행도 - 깨진 문자열은 빈 진행도로', Object.keys(parseProgressSnapshot('{oops')).length === 0);
	recorder.check('진행도 - null / 빈 문자열도 안전',
		Object.keys(parseProgressSnapshot(null)).length === 0
		&& Object.keys(parseProgressSnapshot('')).length === 0);
	recorder.check('진행도 - 0 이하나 숫자가 아닌 값은 버린다',
		Object.keys(parseProgressSnapshot('{"A":0,"B":-2,"C":"x","D":3}')).join(',') === 'D');
}

function testHandleFactory(recorder: TestRecorder): void {
	const game = new FakeGame({ fieldCounts: { 1: 2, 3: 1 } });
	const handle = game.createHandle(EPuzzleId.SWITCH);

	recorder.check('핸들 - 레벨 수는 판 수의 합', handle.getLevelCount() === 3, `${handle.getLevelCount()}`);

	const received: string[] = [];
	const subscriptions = handle.subscribeQuestEvents({
		onTimeChanged: (seconds) => received.push(`t${seconds}`),
		onRoundProgressChanged: (progress) => received.push(`r${progress.current}/${progress.total}`),
		onQuestEnded: (result) => received.push(result.isWin ? 'win' : 'lose'),
		onPaused: () => received.push('pause'),
		onResumed: () => received.push('resume'),
	});

	game.events.TIME_CHANGED.publish(42);
	game.events.ROUND_PROGRESS_CHANGED.publish({ current: 1, total: 1, cleared: 0 });
	game.events.QUEST_CLEAR.publish({ roundsCleared: 1, roundCount: 1, remainingTimeSeconds: 10 });
	game.events.QUEST_FAILED.publish({ roundsCleared: 0, roundCount: 1, remainingTimeSeconds: 0 });
	game.events.GAME_PAUSE.publish(undefined);
	game.events.GAME_RESUME.publish(undefined);

	recorder.check('핸들 - 이벤트 정규화 (승/패 매핑 포함)',
		received.join(' ') === 't42 r1/1 win lose pause resume', received.join(' '));

	for (const subscription of subscriptions) {
		subscription.disconnect();
	}
	game.events.TIME_CHANGED.publish(7);
	recorder.check('핸들 - 구독 해제 후에는 전달되지 않음', received.indexOf('t7') < 0);

	// 레벨 번호가 (난이도, 판 순번) 으로 풀린다 - 3레벨은 난이도 3의 첫 판
	recorder.check('핸들 - 레벨 1 → 난이도 1 의 0번 판', handle.startLevel(1) && game.startCalls[0] === 'd1#0');
	recorder.check('핸들 - 레벨 2 → 난이도 1 의 1번 판', handle.startLevel(2) && game.startCalls[1] === 'd1#1');
	recorder.check('핸들 - 레벨 3 → 난이도 3 의 0번 판', handle.startLevel(3) && game.startCalls[2] === 'd3#0');

	recorder.check('핸들 - 범위 밖 레벨 거절',
		handle.startLevel(0) === false && handle.startLevel(4) === false && game.startCalls.length === 3);

	handle.pause();
	handle.resume();
	handle.abort();
	recorder.check('핸들 - 조작이 세션 컨트롤로 전달됨',
		game.pauseCount === 1 && game.resumeCount === 1 && game.abortCount === 1);
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
	const model = new PuzzleHubModel(registry, new PuzzleProgressTracker(new MemoryProgressStorage()));

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
	const game = new FakeGame({ fieldCounts: { 1: 2, 2: 3 } });
	registry.register(game.createHandle(EPuzzleId.SWITCH));
	recorder.check('모델 - 핸들 등록 시 카탈로그 갱신 이벤트', catalogChangedCount === 1);

	const catalog = model.getCatalogView();
	const switchEntry = catalog.find((entry) => entry.id === EPuzzleId.SWITCH);
	recorder.check('모델 - 등록된 퍼즐만 이용 가능 표시 + 레벨 수 노출',
		switchEntry !== undefined && switchEntry.isAvailable
		&& switchEntry.levelCount === 5 && switchEntry.clearedLevel === 0);

	let detailChangedCount = 0;
	model.events.DETAIL_CHANGED.subscribe(() => detailChangedCount++);
	recorder.check('모델 - 퍼즐 선택 → 상세 화면',
		model.selectPuzzle(EPuzzleId.SWITCH) && model.screen === EPuzzleHubScreen.PUZZLE_DETAIL
		&& detailChangedCount === 1);

	const detail = model.getDetailView();
	recorder.check('모델 - 상세 뷰 (이름 / 레벨 수 / Continue 잠김)',
		detail.puzzleId === EPuzzleId.SWITCH && detail.displayName === 'Switch'
		&& detail.levelCount === 5 && detail.clearedLevel === 0
		&& detail.canContinue === false && detail.continueLevel === 1);

	recorder.check('모델 - Return → 메인 메뉴',
		model.returnToMenu() && model.screen === EPuzzleHubScreen.MAIN_MENU);

	model.dispose();
}

/** Start 는 1레벨, Continue 는 마지막 클리어의 다음 레벨 */
function testModelStartAndContinue(recorder: TestRecorder): void {
	// 1) 기록이 없으면 Continue 는 아무 일도 하지 않는다
	{
		const harness = createHarness(EPuzzleId.SWITCH);
		harness.model.selectPuzzle(EPuzzleId.SWITCH);
		recorder.check('Continue - 기록이 없으면 거절되고 상세 화면 유지',
			harness.model.continueGame() === false
			&& harness.model.screen === EPuzzleHubScreen.PUZZLE_DETAIL
			&& harness.game.startCalls.length === 0);

		recorder.check('Start - 항상 1레벨부터',
			harness.model.startNewGame() && harness.model.screen === EPuzzleHubScreen.IN_GAME
			&& harness.game.startCalls.join(',') === 'd1#0' && harness.model.currentLevel === 1);
		harness.model.dispose();
	}

	// 2) 클리어를 기록하면 Continue 가 그 다음 레벨을 연다
	{
		const harness = createHarness(EPuzzleId.SWITCH);
		harness.model.progress.recordCleared(EPuzzleId.SWITCH, 3);
		harness.model.selectPuzzle(EPuzzleId.SWITCH);

		const detail = harness.model.getDetailView();
		recorder.check('Continue - 마지막 클리어 다음 레벨을 가리킨다',
			detail.canContinue && detail.clearedLevel === 3 && detail.continueLevel === 4);

		// 레벨 4 = 난이도 2 의 1번 판 (난이도 1이 2판이므로 L3 부터 난이도 2)
		recorder.check('Continue - 그 레벨로 시작',
			harness.model.continueGame() && harness.model.currentLevel === 4
			&& harness.game.startCalls.join(',') === 'd2#1', harness.game.startCalls.join(','));
		harness.model.dispose();
	}

	// 3) 전부 깬 뒤에는 마지막 레벨을 다시 연다 (버튼이 먹통이 되지 않게)
	{
		const harness = createHarness(EPuzzleId.SWITCH);
		harness.model.progress.recordCleared(EPuzzleId.SWITCH, 5);
		harness.model.selectPuzzle(EPuzzleId.SWITCH);

		const detail = harness.model.getDetailView();
		recorder.check('Continue - 전부 클리어면 마지막 레벨',
			detail.isCompleted && detail.continueLevel === 5);
		recorder.check('Continue - 마지막 레벨로 시작 가능',
			harness.model.continueGame() && harness.model.currentLevel === 5);
		harness.model.dispose();
	}
}

function testModelGameFlow(recorder: TestRecorder): void {
	const harness = createHarness(EPuzzleId.SWITCH);
	const model = harness.model;
	const game = harness.game;

	model.selectPuzzle(EPuzzleId.SWITCH);
	recorder.check('모델 - Start → 인게임',
		model.startNewGame() && model.screen === EPuzzleHubScreen.IN_GAME && game.startCalls.join(',') === 'd1#0');

	let hudCount = 0;
	model.events.HUD_CHANGED.subscribe(() => hudCount++);
	game.events.TIME_CHANGED.publish(59);
	game.events.ROUND_PROGRESS_CHANGED.publish({ current: 1, total: 1, cleared: 0 });
	const hud = model.getHudView();
	recorder.check('모델 - HUD 갱신 (시간·레벨·시계 라벨)',
		hudCount === 2 && hud.remainingTimeSeconds === 59 && hud.clockLabel === '0:59'
		&& hud.level === 1 && hud.levelCount === 5 && hud.displayName === 'Switch');

	model.pauseGame();
	recorder.check('모델 - 일시정지', model.screen === EPuzzleHubScreen.PAUSED && game.pauseCount === 1);
	model.resumeGame();
	recorder.check('모델 - 재개', model.screen === EPuzzleHubScreen.IN_GAME && game.resumeCount === 1);

	let resultReadyCount = 0;
	model.events.RESULT_READY.subscribe(() => resultReadyCount++);
	game.events.QUEST_CLEAR.publish({ roundsCleared: 1, roundCount: 1, remainingTimeSeconds: 31 });
	const result = model.getLastResult();
	recorder.check('모델 - 클리어 → 결과 화면',
		model.screen === EPuzzleHubScreen.RESULT && resultReadyCount === 1
		&& result !== undefined && result.isWin && result.remainingTimeSeconds === 31);

	recorder.check('모델 - 클리어가 진행도에 기록된다',
		model.progress.getClearedLevel(EPuzzleId.SWITCH) === 1);
	recorder.check('모델 - 이겼고 다음 레벨이 있으면 "다음 레벨" 가능', model.canPlayNextLevel());

	recorder.check('모델 - 다음 레벨 → 2레벨 시작',
		model.playNextLevel() && model.screen === EPuzzleHubScreen.IN_GAME
		&& model.currentLevel === 2 && game.startCalls.join(',') === 'd1#0,d1#1');

	game.events.QUEST_FAILED.publish({ roundsCleared: 0, roundCount: 1, remainingTimeSeconds: 0 });
	recorder.check('모델 - 실패 → 결과 화면 (패배)',
		model.screen === EPuzzleHubScreen.RESULT && model.getLastResult()?.isWin === false);
	recorder.check('모델 - 실패는 진행도를 올리지 않는다',
		model.progress.getClearedLevel(EPuzzleId.SWITCH) === 1);
	recorder.check('모델 - 졌으면 "다음 레벨" 불가', model.canPlayNextLevel() === false);

	recorder.check('모델 - 재도전 → 같은 레벨 재시작',
		model.retry() && model.screen === EPuzzleHubScreen.IN_GAME
		&& model.currentLevel === 2 && game.startCalls.join(',') === 'd1#0,d1#1,d1#1');

	game.events.QUEST_FAILED.publish({ roundsCleared: 0, roundCount: 1, remainingTimeSeconds: 0 });
	recorder.check('모델 - 메뉴 복귀 시 abort 호출',
		model.quitToMenu() && model.screen === EPuzzleHubScreen.MAIN_MENU && game.abortCount === 1);

	// 구독이 끊겼으므로 이후 이벤트는 화면을 바꾸지 못한다
	game.events.QUEST_CLEAR.publish({ roundsCleared: 1, roundCount: 1, remainingTimeSeconds: 5 });
	recorder.check('모델 - 메뉴 복귀 후 잔여 이벤트 무시', model.screen === EPuzzleHubScreen.MAIN_MENU);

	model.dispose();
}

function testModelStartFailures(recorder: TestRecorder): void {
	// 1) 이벤트 없이 거절 - 상세 화면 유지 + START_FAILED
	{
		const harness = createHarness(EPuzzleId.FLOW, { startBehaviour: 'reject' });
		let startFailed: EPuzzleId | undefined = undefined;
		harness.model.events.START_FAILED.subscribe((id) => { startFailed = id; });

		harness.model.selectPuzzle(EPuzzleId.FLOW);
		recorder.check('모델 - 시작 거절 시 상세 화면 유지 + 알림',
			harness.model.startNewGame() === false && harness.model.screen === EPuzzleHubScreen.PUZZLE_DETAIL
			&& startFailed === EPuzzleId.FLOW);
		harness.model.dispose();
	}

	// 2) 레벨 생성 실패 - 시작 함수 안에서 QUEST_FAILED 가 동기 발행 → 결과 화면으로 수렴
	{
		const harness = createHarness(EPuzzleId.LASER, { startBehaviour: 'fail-with-event' });
		harness.model.selectPuzzle(EPuzzleId.LASER);
		recorder.check('모델 - 생성 실패(동기 QUEST_FAILED) → 결과 화면',
			harness.model.startNewGame() === false && harness.model.screen === EPuzzleHubScreen.RESULT
			&& harness.model.getLastResult()?.isWin === false);
		recorder.check('모델 - 생성 실패는 진행도를 올리지 않는다',
			harness.model.progress.getClearedLevel(EPuzzleId.LASER) === 0);
		harness.model.dispose();
	}
}

/**
 * 인게임 HUD 표기 (worker/NextJob.md 1번).
 *
 * 좌측 상단은 레벨, 상단 중앙은 **초 단위** 남은 시간이고, 10초 미만이 초읽기다.
 * 점멸과 소리는 표현 계층이 하지만, "언제 초읽기인가" 는 여기서 정한다.
 */
function testHudLabels(recorder: TestRecorder): void {
	recorder.check('초 라벨 - 정수는 그대로', formatSecondsLabel(45) === '45', formatSecondsLabel(45));
	recorder.check('초 라벨 - 소수는 올림', formatSecondsLabel(9.3) === '10', formatSecondsLabel(9.3));
	recorder.check('초 라벨 - 음수는 0', formatSecondsLabel(-2) === '0', formatSecondsLabel(-2));
	recorder.check('초 라벨 - 분으로 접지 않는다', formatSecondsLabel(125) === '125', formatSecondsLabel(125));

	recorder.check('초읽기 - 10초 정각은 아직 아니다', isTimeCritical(HUD_TIME_CRITICAL_SECONDS) === false);
	recorder.check('초읽기 - 9.9초부터', isTimeCritical(9.9));
	recorder.check('초읽기 - 0초는 이미 끝난 것이라 제외', isTimeCritical(0) === false);

	recorder.check('레벨 라벨 - 총 레벨 수와 함께', formatLevelLabel(3, 24) === 'LV 3 / 24', formatLevelLabel(3, 24));
	recorder.check('레벨 라벨 - 총계를 모르면 번호만', formatLevelLabel(3, 0) === 'LV 3', formatLevelLabel(3, 0));
	recorder.check('레벨 라벨 - 플레이 전에는 빈 문자열', formatLevelLabel(0, 24) === '');

	// 모델이 내는 HUD 스냅샷에도 그대로 실려야 한다
	const harness = createHarness(EPuzzleId.SWITCH);
	const model = harness.model;
	harness.game.remainingSeconds = 60;
	model.selectPuzzle(EPuzzleId.SWITCH);
	model.startNewGame();

	recorder.check('HUD - 시작 직후 레벨 라벨',
		model.getHudView().levelLabel === 'LV 1 / 5', model.getHudView().levelLabel);
	recorder.check('HUD - 시작 직후는 초읽기가 아니다',
		model.getHudView().isTimeCritical === false && model.getHudView().secondsLabel === '60',
		model.getHudView().secondsLabel);

	harness.game.events.TIME_CHANGED.publish(7);
	recorder.check('HUD - 7초가 되면 초읽기 + 초 라벨 "7"',
		model.getHudView().isTimeCritical && model.getHudView().secondsLabel === '7',
		model.getHudView().secondsLabel);

	model.dispose();
}

/** 리셋 - 인게임에서만 통한다 */
function testModelReset(recorder: TestRecorder): void {
	const harness = createHarness(EPuzzleId.SWITCH);
	const model = harness.model;
	const game = harness.game;

	recorder.check('리셋 - 메인 메뉴에서는 거절', model.resetLevel() === false && game.resetCount === 0);

	model.selectPuzzle(EPuzzleId.SWITCH);
	recorder.check('리셋 - 상세 화면에서도 거절', model.resetLevel() === false && game.resetCount === 0);

	model.startNewGame();
	recorder.check('리셋 - 인게임에서 핸들까지 내려간다', model.resetLevel() && game.resetCount === 1);
	recorder.check('리셋 - 화면은 그대로 인게임', model.screen === EPuzzleHubScreen.IN_GAME);

	game.events.GAME_PAUSE.publish(undefined);
	recorder.check('리셋 - 일시정지 중에는 거절',
		model.resetLevel() === false && game.resetCount === 1);

	game.events.GAME_RESUME.publish(undefined);
	game.events.QUEST_FAILED.publish({ roundsCleared: 0, roundCount: 1, remainingTimeSeconds: 0 });
	recorder.check('리셋 - 결과 화면에서는 거절',
		model.resetLevel() === false && game.resetCount === 1);

	model.dispose();
}

/**
 * 시스템 메뉴의 Restart Level 과 허브 재시작(재입장) 경로.
 *
 *   Restart Level  일시정지 중에도 통해야 한다 - 그 버튼이 뜨는 곳이 바로 일시정지 화면이다
 *   재입장         `resetToMainMenu()` 는 어느 화면에서든 메인 메뉴로 맞추고 진행도는 남긴다
 */
function testModelRestartAndBoot(recorder: TestRecorder): void {
	const harness = createHarness(EPuzzleId.SWITCH);
	const model = harness.model;
	const game = harness.game;

	recorder.check('재시작 - 메인 메뉴에서는 거절', model.restartLevel() === false);

	model.selectPuzzle(EPuzzleId.SWITCH);
	recorder.check('재시작 - 상세 화면에서도 거절', model.restartLevel() === false);

	model.startNewGame();
	model.playNextLevel();
	// 아직 결과 화면이 아니므로 다음 레벨로는 못 간다 - 2레벨을 쓰려면 클리어를 거쳐야 한다
	game.events.QUEST_CLEAR.publish({ roundsCleared: 1, roundCount: 1, remainingTimeSeconds: 10 });
	model.playNextLevel();
	recorder.check('재시작 - 2레벨 진행 중', model.currentLevel === 2 && game.startCalls.join(',') === 'd1#0,d1#1');

	game.events.GAME_PAUSE.publish(undefined);
	recorder.check('재시작 - 일시정지 상태', model.screen === EPuzzleHubScreen.PAUSED);

	recorder.check('재시작 - 일시정지 중에도 같은 레벨을 다시 연다',
		model.restartLevel() && game.startCalls.join(',') === 'd1#0,d1#1,d1#1',
		game.startCalls.join(','));
	recorder.check('재시작 - 화면이 인게임으로 돌아온다',
		model.screen === EPuzzleHubScreen.IN_GAME && model.currentLevel === 2);

	// 재입장 - 어느 화면에서든 메인 메뉴로 맞춘다
	const clearedBefore = model.progress.getClearedLevel(EPuzzleId.SWITCH);
	model.resetToMainMenu();
	recorder.check('재입장 - 메인 메뉴로 맞춰진다', model.screen === EPuzzleHubScreen.MAIN_MENU);
	recorder.check('재입장 - 돌던 퍼즐은 정리된다', game.abortCount > 0, `${game.abortCount}`);
	recorder.check('재입장 - 진행도는 그대로 남는다',
		model.progress.getClearedLevel(EPuzzleId.SWITCH) === clearedBefore && clearedBefore > 0,
		`${clearedBefore}`);
	recorder.check('재입장 - 진행 중이던 레벨 표시는 지워진다', model.currentLevel === 0);

	// 정리 뒤에는 잔여 이벤트가 화면을 되돌리지 못한다
	game.events.QUEST_CLEAR.publish({ roundsCleared: 1, roundCount: 1, remainingTimeSeconds: 5 });
	recorder.check('재입장 - 잔여 이벤트 무시', model.screen === EPuzzleHubScreen.MAIN_MENU);

	model.dispose();
}

/**
 * 기기별 화면 규격 (`PuzzleUI_Layout`).
 *
 * 두 가지 신고를 그대로 검증한다.
 *   "모바일에서 인터랙션 영역이 화면 밖으로 넘어간다" -> 격자가 사용 가능한 폭·높이 안에 들어가는가
 *   "모바일에서 버튼 글자가 너무 작다"               -> 상자가 커지면 글자도 커지는가
 */
/**
 * 상대 배치 규격 (`PuzzleUI_RelativeLayout`).
 *
 * **실기 실측값을 기준으로 잡는다.** 2026-09-03 프로브 측정에서 1179x2556 폰이
 * `screenWidth/Height` 로 590x1280 을 돌려주었고, 그 화면에서 7:3 분할과
 * `aspectRatio` + `maxWidth` 정사각형이 정확히 동작했다. 여기서 검증하는 것은
 * **비율 계산이지 픽셀이 아니다** - 픽셀은 이 모듈에 하나도 없다.
 */
function testRelativeLayout(recorder: TestRecorder): void {
	const layout = resolveRelativeLayout();
	// 실측 폰의 화면 비율 (590 / 1280)
	const phoneAspect = 590 / 1280;

	recorder.check('상대 배치 - 7:3 분할은 고정이다',
		layout.boardFlex === BOARD_AREA_FLEX && layout.auxFlex === AUX_AREA_FLEX,
		`${layout.boardFlex}:${layout.auxFlex}`);

	// 위아래 여백을 뺀 나머지가 7:3 으로 갈린다. 둘의 합이 그 나머지와 같아야 한다
	const usable = (100 - layout.topInsetPercent - layout.bottomInsetPercent) / 100;
	const board = boardAreaFraction(layout);
	const aux = auxAreaFraction(layout);
	recorder.check('상대 배치 - 두 영역의 합이 여백을 뺀 나머지와 같다',
		Math.abs(board + aux - usable) < 1e-9, `${board} + ${aux} vs ${usable}`);
	recorder.check('상대 배치 - 본 격자 영역이 보조 레이아웃보다 넓다',
		board > aux * 2, `${board} vs ${aux}`);

	// 여백을 과하게 주면 판이 앉을 자리가 없다 - 둘을 같은 비율로 줄인다
	const squeezed = resolveRelativeLayout({ topInsetPercent: 40, bottomInsetPercent: 40 });
	recorder.check('상대 배치 - 여백 합이 상한을 넘으면 함께 줄어든다',
		squeezed.topInsetPercent + squeezed.bottomInsetPercent <= 40 + 1e-9
		&& squeezed.topInsetPercent === squeezed.bottomInsetPercent,
		`${squeezed.topInsetPercent} + ${squeezed.bottomInsetPercent}`);

	// 격자 상자: 긴 쪽이 100%, 짧은 쪽이 그 비율. 정사각형 부모 안이므로 칸이 정사각형이 된다
	const wide = computeGridBox(4, 8);
	recorder.check('격자 상자 - 4행 8열은 가로 100% / 세로 50%',
		wide.widthPercent === 100 && wide.heightPercent === 50,
		`${wide.widthPercent} x ${wide.heightPercent}`);
	const tall = computeGridBox(9, 3);
	recorder.check('격자 상자 - 9행 3열은 세로 100% / 가로 33.3%',
		tall.heightPercent === 100 && Math.abs(tall.widthPercent - 100 / 3) < 1e-9,
		`${tall.widthPercent} x ${tall.heightPercent}`);
	const square = computeGridBox(9, 9);
	recorder.check('격자 상자 - 정사각 판은 양쪽 100%',
		square.widthPercent === 100 && square.heightPercent === 100,
		`${square.widthPercent} x ${square.heightPercent}`);
	const empty = computeGridBox(0, 0);
	recorder.check('격자 상자 - 판이 없으면 0%',
		empty.widthPercent === 0 && empty.heightPercent === 0,
		`${empty.widthPercent} x ${empty.heightPercent}`);

	// 칸이 정사각형이라는 것이 이 규칙의 요점이다 - 어떤 판이든 칸 한 변의 가로:세로가 1:1
	for (const [rows, cols] of [[4, 8], [5, 6], [9, 9], [3, 7]]) {
		const box = computeGridBox(rows, cols);
		const cellWidth = box.widthPercent / cols;
		const cellHeight = box.heightPercent / rows;
		recorder.check(`격자 상자 - ${rows}x${cols} 의 칸이 정사각형`,
			Math.abs(cellWidth - cellHeight) < 1e-9, `${cellWidth} vs ${cellHeight}`);
	}

	// 세로로 긴 폰에서는 가로가 판 크기를 정한다 (`boardWidthPercent` 가 그대로 이긴다)
	const phoneBoard = boardSquareFraction(layout, phoneAspect);
	recorder.check('보드 정사각형 - 세로 화면에서는 가로가 정한다',
		Math.abs(phoneBoard.ofWidth - layout.boardWidthPercent / 100) < 1e-9,
		`${phoneBoard.ofWidth}`);
	recorder.check('보드 정사각형 - 화면 세로를 넘지 않는다',
		phoneBoard.ofHeight <= boardAreaFraction(layout) + 1e-9,
		`${phoneBoard.ofHeight} > ${boardAreaFraction(layout)}`);

	// 가로로 긴 화면에서는 세로가 먼저 바닥난다 - 그때는 판이 가로 상한보다 작아져야 한다
	const landscapeBoard = boardSquareFraction(layout, 16 / 9);
	recorder.check('보드 정사각형 - 가로 화면에서는 세로가 정한다',
		landscapeBoard.ofWidth < layout.boardWidthPercent / 100,
		`${landscapeBoard.ofWidth}`);
	recorder.check('보드 정사각형 - 가로 화면에서도 본 격자 영역 안에 들어온다',
		landscapeBoard.ofHeight <= boardAreaFraction(layout) + 1e-9,
		`${landscapeBoard.ofHeight} > ${boardAreaFraction(layout)}`);

	// 칸 한 변은 판 한 변을 행·열 중 많은 쪽으로 나눈 값이다
	const cell = cellFraction(layout, phoneAspect, 5, 5);
	recorder.check('칸 크기 - 5x5 판의 칸은 판의 1/5',
		Math.abs(cell.ofWidth * 5 - phoneBoard.ofWidth) < 1e-9,
		`${cell.ofWidth} * 5 vs ${phoneBoard.ofWidth}`);
	// 모바일 인터랙션 규격: 칸이 화면 폭의 10% 는 되어야 손가락으로 집을 수 있다
	recorder.check('칸 크기 - 9x9 판에서도 화면 폭의 10% 이상',
		cellFraction(layout, phoneAspect, 9, 9).ofWidth >= 0.10,
		`${cellFraction(layout, phoneAspect, 9, 9).ofWidth}`);

	// 트레이 격자: 픽셀 없이 화면 비율만으로 줄·칸이 나온다
	recorder.check('트레이 - 부품이 없으면 페이지도 없다',
		traySlotsPerPage(layout, phoneAspect, 0) === 0
		&& trayPageCount(0, 3) === 0,
		`${traySlotsPerPage(layout, phoneAspect, 0)}`);
	const perPage = traySlotsPerPage(layout, phoneAspect, 7);
	recorder.check('트레이 - 한 페이지 슬롯 수가 최대 이하',
		perPage >= 1 && perPage <= TRAY_MAX_VISIBLE_SLOTS,
		`${perPage}`);
	recorder.check('트레이 - 슬롯이 페이지 크기보다 적으면 한 페이지',
		trayPageCount(2, traySlotsPerPage(layout, phoneAspect, 2)) === 1,
		`${trayPageCount(2, traySlotsPerPage(layout, phoneAspect, 2))}`);
	recorder.check('트레이 - 7개를 페이지로 나누면 모두 볼 수 있다',
		trayPageCount(7, perPage) * perPage >= 7,
		`${trayPageCount(7, perPage)} * ${perPage}`);

	// **격자가 트레이를 넘지 않는다** - "부품이 잘려서 안 보인다" 의 회귀 방지.
	//
	// 예전에는 한 줄만 쓰면서 `TRAY_MIN_VISIBLE_SLOTS`(3) 로 페이지 크기를 끌어올렸다.
	// 세로로 긴 화면에서는 슬롯 하나가 화면 폭의 44% 라 셋이 들어갈 자리가 없었는데도
	// 셋을 폈고, 넘친 부분을 `overflow: hidden` 이 잘라내 **부품이 든 첫 슬롯이 화면 밖으로
	// 밀려났다.** 지금은 줄을 쌓아 넘치지 않는 배치만 고른다.
	const trayShapes: { name: string, aspect: number }[] = [
		{ name: '세로 폰', aspect: phoneAspect },
		{ name: '세로 태블릿', aspect: 0.75 },
		{ name: '정사각', aspect: 1 },
		{ name: '가로', aspect: 1.78 },
		{ name: '아주 긴 세로', aspect: 0.35 },
	];
	let trayOverflow = '';
	let trayHeightMismatch = '';
	let trayPaged = '';
	for (const shape of trayShapes) {
		const trayWidth = TRAY_WIDTH_USAGE;
		const trayHeight = auxAreaFraction(layout) * TRAY_HEIGHT_USAGE / shape.aspect;
		for (let count = 1; count <= TRAY_MAX_VISIBLE_SLOTS; count++) {
			const grid = trayGrid(layout, shape.aspect, count);
			const side = grid.slot.ofWidth;
			if (grid.cols * side > trayWidth + 1e-9 || grid.rows * side > trayHeight + 1e-9) {
				trayOverflow += ` ${shape.name}/${count}=${grid.rows}x${grid.cols}`;
			}
			// 화면에 넣는 높이 %로 되그렸을 때 계산과 같은 크기여야 한다
			if (Math.abs(grid.slotHeightPercent / 100 * trayHeight - side) > 1e-9) {
				trayHeightMismatch += ` ${shape.name}/${count}`;
			}
			if (grid.perPage < count) {
				trayPaged += ` ${shape.name}/${count}`;
			}
		}
	}
	recorder.check('트레이 - 어느 화면에서도 격자가 트레이를 넘지 않는다',
		trayOverflow === '', trayOverflow);
	recorder.check('트레이 - 슬롯 높이 %가 계산한 크기와 같다',
		trayHeightMismatch === '', trayHeightMismatch);
	recorder.check('트레이 - 최대 슬롯 수까지는 한 페이지에 다 보인다',
		trayPaged === '', trayPaged);
	recorder.check('트레이 - 부품이 하나면 트레이를 꽉 채운다',
		trayGrid(layout, phoneAspect, 1).rows === 1
		&& trayGrid(layout, phoneAspect, 1).cols === 1,
		`${trayGrid(layout, phoneAspect, 1).rows}x${trayGrid(layout, phoneAspect, 1).cols}`);
	recorder.check('트레이 - 세로 화면에서 넷은 2x2 로 놓인다',
		trayGrid(layout, phoneAspect, 4).rows === 2
		&& trayGrid(layout, phoneAspect, 4).cols === 2,
		`${trayGrid(layout, phoneAspect, 4).rows}x${trayGrid(layout, phoneAspect, 4).cols}`);

	// **글자 크기** - "모바일에서 글씨가 너무 작다" 의 회귀 방지.
	//
	// 원인은 배율의 기준이었다. 글자 한계(min/max)는 기준 캔버스 1180 픽셀로 튜닝한 값이라
	// `pixelScale` 을 곱해야 하는데, 그 배율을 **읽기값**(590x1280)에서 뽑으면 1.08 이 되어
	// 실제(2560 기준 2.17)의 절반으로 그려졌다. 두 배율에서 나온 글자 크기를 비교해 못박는다.
	const readingScale = canvasPixelScale(1280);
	const unitScale = canvasPixelScale(1280 * 2);
	recorder.check('글자 배율 - 좌표 단위 기준이 읽기값 기준보다 크다',
		unitScale > readingScale * 1.9, `${unitScale} vs ${readingScale}`);

	// 실측 폰에서 카탈로그 카드(사용 가능 세로의 16%)의 제목이 화면 세로의 2% 는 되어야 한다.
	// 2% 면 2556px 화면에서 약 51px - 팔 길이에서 읽히는 최소선이다.
	const unitsHeight = 1280 * 2;
	const cardHeight = unitsHeight * 0.9 * 0.16;
	const cardTitle = fitFontSize(cardHeight,
		{ ratio: 0.3, minimum: 18, maximum: 34, pixelScale: unitScale });
	recorder.check('글자 크기 - 카탈로그 카드 제목이 화면 세로의 2% 이상',
		cardTitle >= unitsHeight * 0.02, `${cardTitle} < ${unitsHeight * 0.02}`);

	// 같은 계산을 읽기값 배율로 하면 이 선을 넘지 못한다 - 그것이 신고된 증상이었다
	const tooSmall = fitFontSize(1280 * 0.9 * 0.16,
		{ ratio: 0.3, minimum: 18, maximum: 34, pixelScale: readingScale });
	recorder.check('글자 크기 - 읽기값 배율은 그 선에 못 미친다 (회귀 증상)',
		tooSmall < unitsHeight * 0.02, `${tooSmall}`);

	// 스타일에 그대로 들어가는 문자열이라 형식이 깨지면 배치가 통째로 무너진다
	recorder.check('퍼센트 문자열 - 정수', percentText(96) === '96%', percentText(96));
	recorder.check('퍼센트 문자열 - 소수 두 자리', percentText(100 / 3) === '33.33%', percentText(100 / 3));
	recorder.check('퍼센트 문자열 - 범위를 벗어나면 잘린다',
		percentText(140) === '100%' && percentText(-5) === '0%',
		`${percentText(140)} / ${percentText(-5)}`);
}

function testDeviceLayout(recorder: TestRecorder): void {
	recorder.check('기기 분류 - Mobile', toUIDeviceClass('Mobile') === EUIDeviceClass.MOBILE);
	recorder.check('기기 분류 - 모바일이 아니면 전부 데스크톱',
		toUIDeviceClass(undefined) === EUIDeviceClass.DESKTOP
		&& toUIDeviceClass('Watch') === EUIDeviceClass.DESKTOP
		// 모바일/웹 전용 월드라 VR 전용 규격을 두지 않는다
		&& toUIDeviceClass('VR') === EUIDeviceClass.DESKTOP);

	// 정사각형은 좁은 쪽을 따른다 - 이것이 화면 밖으로 나가지 않게 하는 규칙이다
	recorder.check('정사각형 - 좁은 쪽을 따른다',
		fitSquareSide(400, 900) === 400 && fitSquareSide(900, 400) === 400);
	recorder.check('정사각형 - 음수 크기는 0', fitSquareSide(-10, 100) === 0);

	// 글자는 상자를 따라간다
	const small = fitFontSize(100, { ratio: 0.3, minimum: 10, maximum: 100 });
	const large = fitFontSize(200, { ratio: 0.3, minimum: 10, maximum: 100 });
	recorder.check('글자 - 상자가 커지면 글자도 커진다', large > small, `${small} -> ${large}`);
	recorder.check('글자 - 아래 한계', fitFontSize(1, { minimum: 14 }) === 14);
	recorder.check('글자 - 위 한계', fitFontSize(10000, { maximum: 40 }) === 40);
	recorder.check('글자 - 기기 배율이 곱해진다',
		fitFontSize(100, { ratio: 0.3, scale: 2, maximum: 100 }) === 60);

	// 세로 비율 검증과 보정
	recorder.check('세로 비율 - 100% 를 넘으면 위반으로 잡는다',
		validateBoardArea({ topInsetPercent: 20, boardAreaPercent: 60, auxAreaPercent: 40 }).length > 0);
	recorder.check('세로 비율 - 정상 배치는 위반이 없다',
		validateBoardArea({ topInsetPercent: 11, boardAreaPercent: 55, auxAreaPercent: 28 }).length === 0);

	const clamped = clampBoardArea({ topInsetPercent: 20, boardAreaPercent: 70, auxAreaPercent: 50 });
	const clampedTotal = clamped.topInsetPercent + clamped.boardAreaPercent + clamped.auxAreaPercent;
	recorder.check('세로 비율 - 넘치면 100% 안으로 줄인다',
		clampedTotal <= 100.001 && clamped.topInsetPercent === 20, `${clampedTotal}`);

	// --- 보드 정사각형 규칙 ---
	//
	// 요구: **세로 분할(70:30 등)과 무관하게** 보드는 화면 짧은 변의 90% 인 정사각형이고,
	// 화면 최상단·좌·우와의 거리가 모두 짧은 변의 5% 다. 레이아웃 상자가 정사각형이라
	// (`PuzzleUICanvas`) 5 + 90 + 5 = 100 이 되어 가로가 정확히 꽉 차고 중앙에 온다.
	const area = { topInsetPercent: 11, boardAreaPercent: 55, auxAreaPercent: 28 };
	const devices = [EUIDeviceClass.MOBILE, EUIDeviceClass.DESKTOP];
	const squareCanvas = getDefaultCanvas();
	for (const device of devices) {
		const profile = getLayoutProfile(device);
		const geometry = computeBoardGeometry(profile, area, squareCanvas);
		const shortSide = squareCanvas.width;

		recorder.check(`${device} - 보드가 짧은 변의 90% 인 정사각형`,
			geometry.boardSquareSide === Math.floor(shortSide * 0.9)
			&& geometry.boardPanelWidth === geometry.boardPanelHeight,
			`${geometry.boardSquareSide} vs ${Math.floor(shortSide * 0.9)}`);
		recorder.check(`${device} - 위/좌/우 여백이 짧은 변의 5% 로 같다`,
			geometry.boardSquareMargin === Math.round(shortSide * 0.05)
			&& geometry.boardTop === geometry.boardSquareMargin,
			`${geometry.boardSquareMargin}`);
		recorder.check(`${device} - 여백 + 보드 + 여백이 짧은 변을 넘지 않는다 (가로 중앙)`,
			geometry.boardSquareMargin * 2 + geometry.boardSquareSide <= shortSide + 1,
			`${geometry.boardSquareMargin} * 2 + ${geometry.boardSquareSide} > ${shortSide}`);
		recorder.check(`${device} - 격자가 실제로 그려진다`, geometry.gridSide > 0);

		// **세로 분할을 바꿔도 보드는 그대로다** - 이것이 이번 요구의 핵심이다
		const other = computeBoardGeometry(
			profile, { topInsetPercent: 2, boardAreaPercent: 90, auxAreaPercent: 8 }, squareCanvas);
		recorder.check(`${device} - 세로 분할이 보드 크기를 바꾸지 않는다`,
			other.boardSquareSide === geometry.boardSquareSide
			&& other.boardTop === geometry.boardTop,
			`${other.boardSquareSide} vs ${geometry.boardSquareSide}`);

		// 보조 레이아웃은 보드 아래에 놓이고 화면 밖으로 나가지 않는다
		recorder.check(`${device} - 보조 레이아웃이 보드 아래에서 시작한다`,
			geometry.auxTop >= geometry.boardBottom && geometry.boardGap > 0,
			`${geometry.auxTop} vs ${geometry.boardBottom}`);
		recorder.check(`${device} - 보조 레이아웃이 화면 아래로 넘치지 않는다`,
			geometry.auxTop + geometry.auxHeight <= squareCanvas.fullHeight + 1,
			`${geometry.auxTop} + ${geometry.auxHeight} > ${squareCanvas.fullHeight}`);

		// 슬롯 크기는 화면이 정하고, 다 들어가지 않으면 페이지를 나눈다
		recorder.check(`${device} - 트레이 슬롯이 실제로 그려진다`, geometry.itemSlotSide > 0);
		const pageSize = computeTrayPageSize(geometry, PUZZLE_UI_TRAY_SLOT_COUNT);
		const arrowRoom = pageSize < PUZZLE_UI_TRAY_SLOT_COUNT ? 2 * geometry.trayArrowWidth : 0;
		recorder.check(`${device} - 한 페이지의 슬롯이 화살표까지 트레이 폭 안에 들어간다`,
			pageSize * geometry.itemSlotSide + arrowRoom <= geometry.trayWidth + 1,
			`${pageSize} x ${geometry.itemSlotSide} + ${arrowRoom} > ${geometry.trayWidth}`);
		recorder.check(`${device} - 트레이 슬롯이 트레이 높이를 넘지 않는다`,
			geometry.itemSlotSide <= geometry.trayHeight + 1,
			`${geometry.itemSlotSide} > ${geometry.trayHeight}`);
	}

	testBoardPanelGrid(recorder);
	testTrayPaging(recorder);

	// --- 캔버스 = 정사각 레이아웃 상자 (실기 실측 2026-09-03) ---
	//
	// Screen Overlay 는 패널을 **화면의 짧은 변을 한 변으로 하는 정사각형**에 그린다.
	// 그래서 캔버스의 width/height 에는 그 정사각형을, fullWidth/fullHeight 에는
	// 정사각형 밖까지 포함한 화면 전체를 담는다.
	const landscape = resolveCanvas(2340, 1080);
	recorder.check('캔버스 - 레이아웃 상자는 화면의 짧은 변짜리 정사각형',
		landscape.width === 1080 && landscape.height === 1080 && landscape.aspect === 1,
		`${landscape.width}x${landscape.height}`);
	recorder.check('캔버스 - 화면 전체는 따로 들고 있는다',
		landscape.fullWidth === 2340 && landscape.fullHeight === 1080,
		`${landscape.fullWidth}x${landscape.fullHeight}`);
	recorder.check('캔버스 - 가로 화면으로 분류된다', landscape.isLandscape);
	const phoneCanvas = resolveCanvas(1179, 2556);
	recorder.check('캔버스 - 세로 폰은 가로가 짧은 변이다',
		phoneCanvas.width === 1179 && phoneCanvas.height === 1179
		&& phoneCanvas.fullHeight === 2556 && phoneCanvas.isLandscape === false,
		`${phoneCanvas.width} / ${phoneCanvas.fullHeight}`);

	const portrait = resolveCanvas(1080, 2340);
	recorder.check('캔버스 - 세로 화면은 상자가 화면보다 낮다',
		portrait.width === portrait.height && portrait.fullHeight > portrait.height
		&& portrait.isLandscape === false,
		`${portrait.width} / ${portrait.fullHeight}`);

	recorder.check('캔버스 - 화면 비율 상한을 넘지 않는다',
		resolveCanvas(100000, 1000).fullWidth
		=== Math.round(resolveCanvas(100000, 1000).width * PUZZLE_UI_MAX_ASPECT));
	recorder.check('캔버스 - 화면 비율 하한을 밑돌지 않는다',
		resolveCanvas(1, 100000).fullHeight
		=== Math.round(resolveCanvas(1, 100000).height / PUZZLE_UI_MIN_ASPECT));
	recorder.check('캔버스 - 화면 크기를 못 읽으면 기본 판',
		resolveCanvas(0, 0).width === PUZZLE_UI_CANVAS_WIDTH
		&& resolveCanvas(0, 0).fullHeight === PUZZLE_UI_CANVAS_HEIGHT);
	recorder.check('캔버스 - 기본값도 같은 모양',
		getDefaultCanvas().width === PUZZLE_UI_CANVAS_WIDTH && getDefaultCanvas().isLandscape === false);

	recorder.check('메인 메뉴 - 세로 2열 / 가로 4열',
		getCatalogColumns(portrait) === 2 && getCatalogColumns(landscape) === 4);

	// 가로 화면에서는 정사각 격자가 세로에 막히므로 보조 레이아웃에서 조금 떼어 준다
	const baseArea = { topInsetPercent: 11, boardAreaPercent: 55, auxAreaPercent: 28 };
	const wideArea = fitBoardAreaToCanvas(baseArea, landscape);
	recorder.check('가로 화면 - 격자에 세로를 더 준다',
		wideArea.boardAreaPercent > baseArea.boardAreaPercent
		&& wideArea.auxAreaPercent < baseArea.auxAreaPercent,
		`${wideArea.boardAreaPercent}/${wideArea.auxAreaPercent}`);
	recorder.check('가로 화면 - 합계는 그대로 (화면을 넘지 않는다)',
		Math.abs((wideArea.topInsetPercent + wideArea.boardAreaPercent + wideArea.auxAreaPercent)
			- (baseArea.topInsetPercent + baseArea.boardAreaPercent + baseArea.auxAreaPercent)) < 0.001);
	recorder.check('세로 화면 - 비율을 건드리지 않는다',
		fitBoardAreaToCanvas(baseArea, portrait).boardAreaPercent === baseArea.boardAreaPercent);
	recorder.check('가로 화면 - 보조 레이아웃이 최소치 밑으로 내려가지 않는다',
		fitBoardAreaToCanvas({ topInsetPercent: 11, boardAreaPercent: 70, auxAreaPercent: 16 }, landscape)
			.auxAreaPercent >= 16);

	// --- 기기 보정 (`fitBoardAreaToProfile`) ---
	//
	// 상:하 분할은 보드 패널의 에디터 prop 이 정하는 **설계값**이라, 실제 기기 규격은
	// 보너스 0 으로 두어 비율을 건드리지 않는다. 메커니즘 자체는 남아 있으므로
	// (기기별로 더 주고 싶을 때 쓴다) 가상의 규격으로 동작을 못박는다.
	const mobileFit = fitBoardAreaToProfile(wideArea, getLayoutProfile(EUIDeviceClass.MOBILE));
	recorder.check('기기 보정 - 모바일은 설계 비율을 건드리지 않는다 (보너스 0)',
		mobileFit.boardAreaPercent === wideArea.boardAreaPercent
		&& mobileFit.auxAreaPercent === wideArea.auxAreaPercent,
		`${mobileFit.boardAreaPercent}/${mobileFit.auxAreaPercent}`);
	recorder.check('기기 보정 - 데스크톱도 아무것도 바뀌지 않는다',
		fitBoardAreaToProfile(wideArea, getLayoutProfile(EUIDeviceClass.DESKTOP)).boardAreaPercent
		=== wideArea.boardAreaPercent);

	const bonusProfile = {
		...getLayoutProfile(EUIDeviceClass.MOBILE),
		boardAreaBonusPercent: 6,
		minAuxAreaPercent: 15,
	};
	const bonusFit = fitBoardAreaToProfile(wideArea, bonusProfile);
	recorder.check('기기 보정 - 보너스를 주면 본 격자에 세로를 더 준다',
		bonusFit.boardAreaPercent > wideArea.boardAreaPercent, `${bonusFit.boardAreaPercent}`);
	recorder.check('기기 보정 - 합계가 화면(100%)을 넘지 않는다',
		bonusFit.topInsetPercent + bonusFit.boardAreaPercent + bonusFit.auxAreaPercent <= 100.001,
		`${bonusFit.topInsetPercent + bonusFit.boardAreaPercent + bonusFit.auxAreaPercent}`);
	recorder.check('기기 보정 - 보조 레이아웃이 최소치 밑으로 내려가지 않는다',
		bonusFit.auxAreaPercent >= bonusProfile.minAuxAreaPercent - 0.001,
		`${bonusFit.auxAreaPercent}`);
	recorder.check('기기 보정 - 위쪽 여백(HUD 자리)은 건드리지 않는다',
		bonusFit.topInsetPercent === wideArea.topInsetPercent);

	// 가로 화면에서도 보드는 **짧은 변**(= 화면 세로)의 90% 인 정사각형이다
	for (const device of devices) {
		const profile = getLayoutProfile(device);
		const geometry = computeBoardGeometry(profile, wideArea, landscape);
		// 가로 화면은 짧은 변이 세로라, 90% 를 그대로 쓰면 보드 아래에 트레이 자리가
		// 남지 않는다. 그래서 이때만 보조 레이아웃 최소치만큼 눌린다.
		recorder.check(`${device} - 가로 화면에서는 보조 레이아웃 자리를 남기고 눌린다`,
			geometry.boardSquareSide <= Math.floor(landscape.width * 0.9)
			&& geometry.boardSquareSide > 0
			&& geometry.auxHeight > 0,
			`${geometry.boardSquareSide} / aux ${geometry.auxHeight}`);
		recorder.check(`${device} - 가로 화면에서 보드가 화면 세로를 넘지 않는다`,
			geometry.boardBottom <= landscape.fullHeight + 1,
			`${geometry.boardBottom} > ${landscape.fullHeight}`);
	}

	// --- 여백은 픽셀로 준다 (Yoga 의 퍼센트 여백 함정) ---
	//
	// `margin`/`padding` 의 퍼센트는 네 방향 모두 부모의 *가로* 로 계산된다. 가로 화면에서
	// 위아래 여백이 폭발하는 것을 막으려면 세로 여백을 캔버스 높이에서 픽셀로 뽑아야 한다.
	const mobileProfile = getLayoutProfile(EUIDeviceClass.MOBILE);
	const wideSafe = computeSafeAreaPixels(mobileProfile, landscape);
	const tallSafe = computeSafeAreaPixels(mobileProfile, portrait);
	recorder.check('여백 - 위아래는 캔버스 세로의 비율이다',
		wideSafe.top === Math.round(percentOf(landscape.height, mobileProfile.safeArea.top))
		&& tallSafe.top === Math.round(percentOf(portrait.height, mobileProfile.safeArea.top)),
		`${wideSafe.top} vs ${tallSafe.top}`);
	// 레이아웃 상자가 정사각형이라 좌우 여백도 그 한 변에서 나온다
	recorder.check('여백 - 좌우는 레이아웃 상자 한 변의 비율이다',
		wideSafe.left === Math.round(percentOf(landscape.width, mobileProfile.safeArea.left))
		&& tallSafe.left === Math.round(percentOf(portrait.width, mobileProfile.safeArea.left)),
		`${wideSafe.left} vs ${tallSafe.left}`);
	recorder.check('여백 - 위아래 합이 세로 예산과 맞는다',
		Math.abs((landscape.height - wideSafe.top - wideSafe.bottom)
			- percentOf(landscape.height, getUsableHeightPercent(mobileProfile))) <= 1);
	recorder.check('여백 - 세로 픽셀 변환은 캔버스 세로를 따른다',
		verticalPixels(landscape, 26) === Math.round(percentOf(landscape.height, 26))
		&& verticalPixels(portrait, 26) === Math.round(percentOf(portrait.height, 26)),
		`${verticalPixels(landscape, 26)} vs ${verticalPixels(portrait, 26)}`);

	// 에디터에서 캔버스를 직접 못박는 탈출구
	const forced = makeCanvas(1600, 720);
	recorder.check('캔버스 override - 준 값을 화면 크기로 보고 정사각 상자를 만든다',
		forced !== undefined && forced.width === 720 && forced.height === 720
		&& forced.fullWidth === 1600 && forced.isLandscape,
		`${forced?.width} / ${forced?.fullWidth}`);
	recorder.check('캔버스 override - 쓸 수 없는 값은 undefined',
		makeCanvas(0, 720) === undefined && makeCanvas(1600, -1) === undefined);

	const mobile = getLayoutProfile(EUIDeviceClass.MOBILE);
	const desktop = getLayoutProfile(EUIDeviceClass.DESKTOP);
	recorder.check('모바일 - 데스크톱보다 여백이 넓다',
		getUsableWidthPercent(mobile) < getUsableWidthPercent(desktop)
		&& getUsableHeightPercent(mobile) < getUsableHeightPercent(desktop));
	recorder.check('모바일 - 글자를 키운다', mobile.fontScale > desktop.fontScale);
}

/**
 * 보드 메인 패널(직사각형) 안에 앉는 격자 - **칸은 언제나 정사각형이다.**
 *
 * 예전에는 격자 상자를 정사각형으로 두고 행·열을 `flex: 1` 로 나눠서, 4행 8열(정렬)이나
 * 5행 6열(색 채우기) 같은 판에서 칸이 눌리거나 늘어났다. 여기서 검증하는 것은 세 가지다.
 *   1. 어떤 판이든 칸이 정사각형이고 격자가 패널 밖으로 나가지 않는다
 *   2. 가로로 긴 판일수록 칸이 커진다 (남는 가로를 칸이 가져간다)
 *   3. 행·열이 0 이면 아무것도 그리지 않는다
 */
function testBoardPanelGrid(recorder: TestRecorder): void {
	const profile = getLayoutProfile(EUIDeviceClass.MOBILE);
	const landscape = resolveCanvas(2340, 1080);
	const area = fitBoardAreaToProfile(
		fitBoardAreaToCanvas(
			clampBoardArea({ topInsetPercent: 8, boardAreaPercent: 68, auxAreaPercent: 24 }),
			landscape),
		profile);
	const geometry = computeBoardGeometry(profile, area, landscape);

	// 8개 퍼즐이 실제로 쓰는 판 규격이다 (러시아워 9×9 ~ 정렬 4행 8열)
	const boards: [string, number, number][] = [
		['러시아워 9x9', 9, 9],
		['레이저 7x7', 7, 7],
		['스위치 5x5', 5, 5],
		['색 채우기 5행 6열', 5, 6],
		['정렬 4행 8열', 4, 8],
	];
	for (const [name, rowCount, colCount] of boards) {
		const grid = computeGridPixels(geometry, rowCount, colCount);
		recorder.check(`격자 ${name} - 칸이 정사각형이다`,
			grid.width === grid.cellSide * colCount && grid.height === grid.cellSide * rowCount,
			`${grid.width}x${grid.height} / ${grid.cellSide}`);
		recorder.check(`격자 ${name} - 보드 패널 안에 들어간다`,
			grid.width <= geometry.boardPanelWidth && grid.height <= geometry.boardPanelHeight,
			`${grid.width}x${grid.height} > ${geometry.boardPanelWidth}x${geometry.boardPanelHeight}`);
		recorder.check(`격자 ${name} - 칸이 실제로 그려진다`, grid.cellSide > 0);
	}

	// 보드 패널이 정사각형이므로 칸은 **행과 열 중 많은 쪽**이 정한다.
	// 8x8 과 4행 8열은 열이 같으므로 칸도 같고, 열이 적은 판은 칸이 커진다.
	const square = computeGridPixels(geometry, 8, 8);
	const wide = computeGridPixels(geometry, 4, 8);
	const small = computeGridPixels(geometry, 4, 4);
	recorder.check('격자 - 정사각 패널에서는 긴 쪽이 칸을 정한다',
		wide.cellSide === square.cellSide && small.cellSide > square.cellSide,
		`${wide.cellSide} / ${square.cellSide} / ${small.cellSide}`);

	const empty = computeGridPixels(geometry, 0, 5);
	recorder.check('격자 - 행이 없으면 아무것도 그리지 않는다',
		empty.cellSide === 0 && empty.width === 0 && empty.height === 0);

	// --- 실기 회귀: 세로 2556px 폰 (실측 신고 "보드판이 작다") ---
	//
	// 요구는 "화면 짧은 변의 90% 인 정사각형, 위·좌·우 여백 5%" 다. 화면 폭 1179 이므로
	// 보드는 1061px, 여백은 59px 여야 한다.
	const phone = resolveCanvas(1179, 2556);
	const phoneArea = clampBoardArea({ topInsetPercent: 8, boardAreaPercent: 68, auxAreaPercent: 24 });
	const phoneGeometry = computeBoardGeometry(profile, phoneArea, phone);
	const phoneLaser = computeGridPixels(phoneGeometry, 7, 7);
	recorder.check('폰 세로 - 보드가 화면 폭의 90% 정사각형',
		phoneGeometry.boardSquareSide === Math.floor(1179 * 0.9),
		`${phoneGeometry.boardSquareSide}`);
	recorder.check('폰 세로 - 위 여백이 좌우 여백과 같은 5%',
		phoneGeometry.boardTop === Math.round(1179 * 0.05)
		&& phoneGeometry.boardSquareMargin * 2 + phoneGeometry.boardSquareSide <= 1179 + 1,
		`${phoneGeometry.boardTop}`);
	recorder.check('폰 세로 - 레이저 격자가 화면 폭의 85% 이상을 쓴다',
		phoneLaser.width >= phone.fullWidth * 0.85,
		`${phoneLaser.width} < ${phone.fullWidth} * 0.85`);
	recorder.check('폰 세로 - 칸 하나가 엄지로 짚을 크기다 (>= 140px)',
		phoneLaser.cellSide >= 140, `${phoneLaser.cellSide}`);
	recorder.check('폰 세로 - 보조 레이아웃이 보드 아래 화면에 들어간다',
		phoneGeometry.auxHeight > 0
		&& phoneGeometry.auxTop + phoneGeometry.auxHeight <= phone.fullHeight,
		`${phoneGeometry.auxTop} + ${phoneGeometry.auxHeight} vs ${phone.fullHeight}`);
}

/**
 * 트레이 슬라이드바 - **부품 크기를 지키고 대신 넘겨 본다.**
 *
 * 예전에는 슬롯 수로 트레이 폭을 나눠 크기를 줄였다. 그래서 레이저의 인벤토리(7칸)에서
 * 부품이 손가락보다 작아져 집을 수가 없었다. 지금은 크기가 화면에서 정해지고
 * (아래 절반의 20%), 한 줄에 다 들어가지 않으면 페이지가 나뉜다.
 */
function testTrayPaging(recorder: TestRecorder): void {
	const profile = getLayoutProfile(EUIDeviceClass.MOBILE);
	const portrait = getDefaultCanvas();
	const area = clampBoardArea({ topInsetPercent: 8, boardAreaPercent: 68, auxAreaPercent: 24 });
	const geometry = computeBoardGeometry(profile, area, portrait);

	// 20% 는 **아래 한계**다. 상한으로 쓰면 트레이가 넉넉한 가로 화면에서 부품이 오히려
	// 지금보다 작아진다 - 그래서 두 기기 규격 모두에서 이 크기 이상이 나오는지를 본다.
	const slotFloor = percentOf(portrait.height, 50) * TRAY_SLOT_LOWER_HALF_RATIO;
	recorder.check('트레이 - 슬롯이 화면 아래 절반의 20% 밑으로 내려가지 않는다',
		geometry.itemSlotSide >= slotFloor - 1,
		`${geometry.itemSlotSide} < ${slotFloor}`);
	recorder.check('트레이 - 슬롯이 트레이 상자를 넘지 않는다',
		geometry.itemSlotSide <= geometry.trayHeight + 1
		&& geometry.itemSlotSide <= geometry.trayWidth + 1,
		`${geometry.itemSlotSide} vs ${geometry.trayWidth}x${geometry.trayHeight}`);

	recorder.check('트레이 - 슬롯이 없으면 페이지도 없다',
		computeTrayPageSize(geometry, 0) === 0 && computeTrayPageCount(0, 0) === 0);

	// 한 개짜리 트레이는 언제나 한 페이지다
	recorder.check('트레이 - 다 들어가면 한 페이지',
		computeTrayPageCount(computeTrayPageSize(geometry, 1), 1) === 1);

	// 레이저의 인벤토리 7칸 - 페이지가 나뉘든 아니든 한 페이지가 폭 안에 들어가야 한다
	const laserSlots = 7;
	const pageSize = computeTrayPageSize(geometry, laserSlots);
	const pageCount = computeTrayPageCount(pageSize, laserSlots);
	recorder.check('트레이 - 한 페이지가 적어도 하나는 담는다', pageSize >= 1, `${pageSize}`);
	recorder.check('트레이 - 페이지를 모으면 슬롯 전부가 나온다',
		pageSize * pageCount >= laserSlots, `${pageSize} x ${pageCount}`);
	const arrowRoom = pageSize < laserSlots ? 2 * geometry.trayArrowWidth : 0;
	recorder.check('트레이 - 한 페이지가 화살표까지 트레이 폭 안에 들어간다',
		pageSize * geometry.itemSlotSide + arrowRoom <= geometry.trayWidth + 1,
		`${pageSize} x ${geometry.itemSlotSide} + ${arrowRoom} > ${geometry.trayWidth}`);

	// 트레이가 넓어지면 페이지가 줄어든다 - 가로 화면에서는 넘길 일이 없어야 한다
	const landscape = resolveCanvas(2340, 1080);
	const wideArea = fitBoardAreaToProfile(fitBoardAreaToCanvas(area, landscape), profile);
	const wideGeometry = computeBoardGeometry(profile, wideArea, landscape);
	// 보드가 화면의 대부분을 가져가면서 트레이는 짧은 변 기준 폭을 쓴다.
	// 한 번에 하나씩 넘기는 상태(예전 세로 화면의 문제)만 아니면 된다.
	recorder.check('트레이 - 가로 화면에서 한 페이지에 여러 개가 보인다',
		computeTrayPageSize(wideGeometry, laserSlots) >= 3,
		`${computeTrayPageSize(wideGeometry, laserSlots)}`);
	recorder.check('트레이 - 가로 화면에서도 슬롯이 20% 밑으로 내려가지 않는다',
		wideGeometry.itemSlotSide
		>= percentOf(landscape.height, 50) * TRAY_SLOT_LOWER_HALF_RATIO - 1,
		`${wideGeometry.itemSlotSide}`);

	// 좁은 화면에서 한 번에 하나씩만 보이지 않는다 - 슬롯을 트레이 높이까지 키우면
	// 부품 일곱 개를 보려고 여섯 번을 넘겨야 했다
	recorder.check('트레이 - 넘겨야 하는 경우에도 한 페이지에 둘 이상 보인다',
		pageCount <= 1 || pageSize >= 2, `${pageSize} x ${pageCount}`);
}

function testModelGuards(recorder: TestRecorder): void {
	const harness = createHarness(EPuzzleId.SWITCH);
	const model = harness.model;
	const game = harness.game;

	recorder.check('가드 - 메인 메뉴에서 start/continue/return/retry/quit 거절',
		model.startNewGame() === false && model.continueGame() === false
		&& model.returnToMenu() === false && model.retry() === false && model.quitToMenu() === false);

	model.selectPuzzle(EPuzzleId.SWITCH);
	recorder.check('가드 - 상세 화면에서 selectPuzzle 거절', model.selectPuzzle(EPuzzleId.SWITCH) === false);
	recorder.check('가드 - 상세 화면에서 retry / playNextLevel 거절',
		model.retry() === false && model.playNextLevel() === false);

	model.startNewGame();
	recorder.check('가드 - 인게임에서 selectPuzzle / start / return 거절',
		model.selectPuzzle(EPuzzleId.SWITCH) === false && model.startNewGame() === false
		&& model.returnToMenu() === false && model.screen === EPuzzleHubScreen.IN_GAME);

	// 일시정지 화면이 아닐 때의 resume 은 무시된다
	model.resumeGame();
	recorder.check('가드 - 인게임에서 resume 무시', model.screen === EPuzzleHubScreen.IN_GAME && game.resumeCount === 0);

	// 결과 화면 → 상세 화면으로 되돌아가는 경로
	game.events.QUEST_CLEAR.publish({ roundsCleared: 1, roundCount: 1, remainingTimeSeconds: 5 });
	recorder.check('가드 - 결과에서 상세로 복귀',
		model.backToDetail() && model.screen === EPuzzleHubScreen.PUZZLE_DETAIL && game.abortCount === 1);
	recorder.check('가드 - 복귀한 상세 화면이 갱신된 진행도를 보여준다',
		model.getDetailView().canContinue && model.getDetailView().continueLevel === 2);

	model.dispose();
}

//#endregion

//#region Switch integration (실제 세션·솔버로 전체 흐름 검증)

/** 솔버가 지목하지 않은 키 캡 하나. FREE 좌표는 아예 키 캡이 없으므로 건너뛴다 */
function findNonSolutionKey(session: SwitchSession, solution: readonly number[]): number | undefined {
	for (let cell = 0; cell < SWITCH_CELL_COUNT; cell++) {
		if (session.board?.getCellAt(cell) === ESwitchCellState.FREE) {
			continue;
		}
		if (solution.indexOf(cell) < 0) {
			return cell;
		}
	}
	return undefined;
}

function testSwitchIntegration(recorder: TestRecorder): void {
	const tables = new SwitchPuzzleTables();
	const events = new SwitchPuzzleEvents();
	const session = new SwitchSession(events, tables, new SwitchLevelGenerator(tables), { seed: 4242 });
	const solver = new SwitchSolver();

	const registry = new PuzzleHubRegistry();
	const model = new PuzzleHubModel(registry, new PuzzleProgressTracker(new MemoryProgressStorage()));

	registry.register(createPuzzleHandle(
		EPuzzleId.SWITCH,
		{
			startLevel: (difficulty, fieldOrdinal) => session.startLevel(difficulty, fieldOrdinal),
			startQuestByDifficulty: (difficulty) => session.startQuestByDifficulty(difficulty),
			resetLevel: () => session.resetRound(),
			pause: () => session.pause(),
			resume: () => session.resume(),
			abort: () => session.abort(),
			getRemainingTimeSeconds: () => session.getRemainingTimeSeconds(),
			getRoundProgress: () => session.getRoundProgress(),
		},
		events,
		buildPuzzleLevelTable(
			(difficulty) => tables.getQuestByDifficulty(difficulty),
			(difficulty) => tables.getFieldsForDifficulty(difficulty).length,
		),
	));

	const handle = registry.getHandle(EPuzzleId.SWITCH);
	const expectedLevels = tables.getFieldsForDifficulty(1).length
		+ tables.getFieldsForDifficulty(2).length
		+ tables.getFieldsForDifficulty(3).length
		+ tables.getFieldsForDifficulty(4).length
		+ tables.getFieldsForDifficulty(5).length;
	recorder.check('통합 - 실제 테이블의 레벨 수가 판 수의 합',
		handle !== undefined && handle.getLevelCount() === expectedLevels,
		`${handle?.getLevelCount()} vs ${expectedLevels}`);

	model.selectPuzzle(EPuzzleId.SWITCH);
	recorder.check('통합 - Start → 1레벨 인게임',
		model.startNewGame() && model.screen === EPuzzleHubScreen.IN_GAME
		&& session.state === ESwitchPuzzleState.PLAYER_INPUT && model.currentLevel === 1);

	// 레벨 하나 = 라운드 하나이므로 세션의 라운드 총계도 1이어야 한다
	recorder.check('통합 - 레벨 모드는 1라운드', session.getRoundProgress().total === 1,
		`${session.getRoundProgress().total}`);

	// --- 리셋: 판은 처음으로, 시간은 흐른 그대로 (worker/NextJob.md 1번) ---
	//
	// **정답이 아닌 칸**을 누른다. 정답 칸을 눌렀다가 그것으로 판이 끝나 버리면
	// 리셋이 거절되는 것이 옳은 동작이라, 리셋을 검증할 기회 자체가 사라진다.
	const untouchedCount = session.getUnpressedKeyCount();
	const solutionAtStart = solver.solve(session.board!.grid, session.board!.mask);
	const wrongKey = findNonSolutionKey(session, solutionAtStart.pressPositions);
	recorder.check('통합 - 정답이 아닌 칸을 찾았다', wrongKey !== undefined, `${wrongKey}`);
	session.pressKey(wrongKey ?? 0);
	session.update(PRESS_SEQUENCE_SECONDS + 0.01);
	recorder.check('통합 - 한 번 눌러 판이 바뀌었다',
		session.getUnpressedKeyCount() !== untouchedCount && model.screen === EPuzzleHubScreen.IN_GAME,
		`${session.getUnpressedKeyCount()} vs ${untouchedCount}`);

	// 시간을 흘려 두고 리셋해야 "시간은 되돌지 않는다" 를 실제로 볼 수 있다
	session.update(3);
	const secondsBeforeReset = session.getRemainingTimeSeconds();
	recorder.check('통합 - 리셋이 통한다', model.resetLevel() && session.state === ESwitchPuzzleState.PLAYER_INPUT);
	recorder.check('통합 - 리셋하면 판이 풀기 전으로 돌아간다',
		session.getUnpressedKeyCount() === untouchedCount,
		`${session.getUnpressedKeyCount()} vs ${untouchedCount}`);
	recorder.check('통합 - 리셋해도 남은 시간은 그대로다',
		session.getRemainingTimeSeconds() === secondsBeforeReset,
		`${session.getRemainingTimeSeconds()} vs ${secondsBeforeReset}`);
	recorder.check('통합 - 리셋해도 화면은 인게임 그대로', model.screen === EPuzzleHubScreen.IN_GAME);

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
	recorder.check('통합 - 1레벨 클리어가 진행도에 남는다',
		model.progress.getClearedLevel(EPuzzleId.SWITCH) === 1);

	// 다음 레벨 → 이번에는 시간 초과로 실패
	recorder.check('통합 - 다음 레벨 → 2레벨 인게임',
		model.playNextLevel() && model.screen === EPuzzleHubScreen.IN_GAME && model.currentLevel === 2);
	session.update(10_000);
	recorder.check('통합 - 시간 초과 → 결과(패배)',
		model.screen === EPuzzleHubScreen.RESULT && model.getLastResult()?.isWin === false);
	recorder.check('통합 - 실패해도 진행도는 1레벨 그대로',
		model.progress.getClearedLevel(EPuzzleId.SWITCH) === 1);

	// HUD 시계 라벨이 세션의 제한 시간을 따라왔는지 (실패 시점 0초)
	recorder.check('통합 - HUD 시계 라벨 0:00', model.getHudView().clockLabel === '0:00');

	// 상세 화면으로 돌아가면 Continue 가 풀려 있어야 한다
	recorder.check('통합 - 결과 → 상세, Continue 가 2레벨을 가리킨다',
		model.backToDetail() && model.getDetailView().canContinue
		&& model.getDetailView().continueLevel === 2);
	recorder.check('통합 - 상세 복귀 시 세션이 IDLE 로', session.state === ESwitchPuzzleState.IDLE);

	model.dispose();
}

//#endregion
