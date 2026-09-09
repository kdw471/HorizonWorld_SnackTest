/**
 * Puzzle UI Model - 메인 UI(퍼즐 허브)의 순수 상태 머신
 *
 * 화면 흐름 (EPuzzleHubScreen)
 *
 *   MAIN_MENU ──selectPuzzle()──▶ PUZZLE_DETAIL ──startNewGame()───▶ IN_GAME
 *   (2열×4행 격자)     │              (꽉 찬 상세)  └continueGame()──▶ IN_GAME
 *       ▲             │returnToMenu()                                  │
 *       │             ▼                                     pause/resume ⇄ PAUSED
 *       │◀────────────────────────────────────────┐                    │
 *       │                                         │        (퀘스트 종료 이벤트)
 *       └──────────quitToMenu()──── RESULT ◀──────┴─────────────────────┘
 *                                     │retry()    ──▶ IN_GAME (같은 레벨 재도전)
 *                                     │nextLevel()──▶ IN_GAME (다음 레벨)
 *
 * ## 레벨
 *
 * **레벨 하나 = 퀘스트 라운드 하나 = 기획 판 하나.** 난이도 오름차순으로 판을 이어 붙인
 * 것이 레벨 목록이며(`buildPuzzleLevelTable`), 상세 화면의 두 버튼이 그 위를 움직인다.
 *
 *   Start    -> 1레벨
 *   Continue -> 마지막으로 클리어한 레벨의 다음 (기록이 없으면 잠김)
 *
 * 진행도는 `PuzzleProgressTracker` 가 들고 있고, 클리어할 때마다 여기서 기록한다.
 *
 * ## 규칙
 *
 *   - 레지스트리에 핸들이 없는 퍼즐(아직 *_CoreAPI 미등록)은 선택할 수 없다 -> "준비 중"
 *   - 인게임 구독은 시작 시 걸고 **메뉴로 돌아갈 때** 해제한다 (retry 는 구독을 유지)
 *   - 레벨 생성 실패로 시작 즉시 QUEST_FAILED 가 오는 경로도 결과 화면으로 수렴한다
 *     (세션이 fail() 을 경유해 이벤트를 보장한다)
 *   - **진행도 기록은 승리했을 때만.** 실패는 진행도를 건드리지 않는다
 *
 * `horizon/core` 에 런타임 의존이 없어 Node 테스트(PuzzleUI_Tests.ts)로 전 화면 전이를 검증한다.
 */

import { EventPublisher, Subscription, SubscriptionBag } from 'Utility_Events';
import { IPuzzleGameHandle, PuzzleHubRegistry } from 'PuzzleUI_Registry';
import { PuzzleProgressTracker } from 'PuzzleUI_Progress';
import {
	EPuzzleHubScreen,
	EPuzzleId,
	PUZZLE_CATALOG,
	PuzzleCatalogView,
	PuzzleDetailView,
	PuzzleHudView,
	PuzzleUIQuestResult,
	PuzzleUIRoundProgress,
	createEmptyRoundProgress,
	formatClockLabel,
	formatLevelLabel,
	formatSecondsLabel,
	getCatalogEntry,
	isTimeCritical,
} from 'PuzzleUI_Definitions';

//#region Events

/** 표현 계층(PuzzleUI_MainPanel)이 구독하는 뷰 갱신 이벤트 */
export class PuzzleHubEvents {
	public readonly SCREEN_CHANGED = new EventPublisher<EPuzzleHubScreen>();
	/** 핸들 등록 또는 진행도 변화로 격자 표시가 바뀌었다 */
	public readonly CATALOG_CHANGED = new EventPublisher<PuzzleCatalogView[]>();
	/** 상세 화면의 표시 내용이 바뀌었다 (퍼즐 선택, 진행도 갱신) */
	public readonly DETAIL_CHANGED = new EventPublisher<PuzzleDetailView>();
	/** 인게임 HUD 갱신 (시간은 세션이 초 단위로 이미 스로틀한다) */
	public readonly HUD_CHANGED = new EventPublisher<PuzzleHudView>();
	/** 결과 화면 데이터가 준비됐다 */
	public readonly RESULT_READY = new EventPublisher<PuzzleUIQuestResult>();
	/** 시작에 실패했다 (레벨 범위 밖 등) - 토스트 표시용 */
	public readonly START_FAILED = new EventPublisher<EPuzzleId>();
	/** 준비 중(미등록) 퍼즐을 눌렀다 - 토스트 표시용 */
	public readonly LOCKED_PUZZLE_TAPPED = new EventPublisher<EPuzzleId>();
}

//#endregion

export class PuzzleHubModel {
	private readonly _registry: PuzzleHubRegistry;
	private readonly _progress: PuzzleProgressTracker;
	private readonly _events: PuzzleHubEvents = new PuzzleHubEvents();
	private readonly _registrySubscription: Subscription;

	private _screen: EPuzzleHubScreen = EPuzzleHubScreen.MAIN_MENU;

	private _selectedPuzzleId: EPuzzleId | undefined = undefined;
	/** 지금 플레이 중이거나 막 끝낸 레벨 번호 (1-based). 0 이면 플레이한 적 없음 */
	private _currentLevel: number = 0;

	/** 인게임 중인 퍼즐의 핸들. RESULT 화면까지 유지한다 (retry / nextLevel 용) */
	private _activeHandle: IPuzzleGameHandle | undefined = undefined;
	private readonly _questSubscriptions: SubscriptionBag = new SubscriptionBag();

	private _hudTimeSeconds: number = 0;
	private _hudRound: PuzzleUIRoundProgress = createEmptyRoundProgress();
	private _lastResult: PuzzleUIQuestResult | undefined = undefined;

	constructor(
		registry: PuzzleHubRegistry = PuzzleHubRegistry.instance,
		progress: PuzzleProgressTracker = new PuzzleProgressTracker(),
	) {
		this._registry = registry;
		this._progress = progress;
		this._registrySubscription = registry.HANDLE_REGISTERED.subscribe(() => {
			this._events.CATALOG_CHANGED.publish(this.getCatalogView());
		});
	}

	public dispose(): void {
		this.disconnectQuest();
		this._registrySubscription.disconnect();
	}

	//#region View queries (표현 계층의 초기 렌더용)

	public get events(): PuzzleHubEvents {
		return this._events;
	}

	public get screen(): EPuzzleHubScreen {
		return this._screen;
	}

	public get progress(): PuzzleProgressTracker {
		return this._progress;
	}

	/** 지금 플레이 중인 레벨 번호 (1-based). 0 이면 없음 */
	public get currentLevel(): number {
		return this._currentLevel;
	}

	public getCatalogView(): PuzzleCatalogView[] {
		return PUZZLE_CATALOG.map((entry) => {
			const handle = this._registry.getHandle(entry.id);
			return {
				id: entry.id,
				displayName: entry.displayName,
				subtitle: entry.subtitle,
				isAvailable: handle !== undefined,
				levelCount: handle?.getLevelCount() ?? 0,
				clearedLevel: this._progress.getClearedLevel(entry.id),
			};
		});
	}

	public getDetailView(): PuzzleDetailView {
		const puzzleId = this._selectedPuzzleId;
		const entry = puzzleId === undefined ? undefined : getCatalogEntry(puzzleId);
		const handle = puzzleId === undefined ? undefined : this._registry.getHandle(puzzleId);
		const levelCount = handle?.getLevelCount() ?? 0;

		if (puzzleId === undefined) {
			return {
				puzzleId: undefined,
				displayName: '',
				subtitle: '',
				levelCount: 0,
				clearedLevel: 0,
				continueLevel: 1,
				canContinue: false,
				isCompleted: false,
			};
		}

		return {
			puzzleId: puzzleId,
			displayName: entry?.displayName ?? '',
			subtitle: entry?.subtitle ?? '',
			levelCount: levelCount,
			clearedLevel: this._progress.getClearedLevel(puzzleId),
			continueLevel: this._progress.getContinueLevel(puzzleId, levelCount),
			canContinue: this._progress.hasProgress(puzzleId),
			isCompleted: this._progress.isCompleted(puzzleId, levelCount),
		};
	}

	public getHudView(): PuzzleHudView {
		const entry = this._selectedPuzzleId === undefined ? undefined : getCatalogEntry(this._selectedPuzzleId);
		const levelCount = this._activeHandle?.getLevelCount() ?? 0;
		return {
			puzzleId: this._selectedPuzzleId,
			displayName: entry?.displayName ?? '',
			level: this._currentLevel,
			levelCount: levelCount,
			levelLabel: formatLevelLabel(this._currentLevel, levelCount),
			remainingTimeSeconds: this._hudTimeSeconds,
			clockLabel: formatClockLabel(this._hudTimeSeconds),
			secondsLabel: formatSecondsLabel(this._hudTimeSeconds),
			isTimeCritical: isTimeCritical(this._hudTimeSeconds),
			round: { ...this._hudRound },
		};
	}

	public getLastResult(): PuzzleUIQuestResult | undefined {
		return this._lastResult;
	}

	/** 결과 화면에서 "다음 레벨" 을 누를 수 있는지 - 이겼고 마지막 레벨이 아닐 때 */
	public canPlayNextLevel(): boolean {
		if (this._lastResult === undefined || this._lastResult.isWin === false) {
			return false;
		}
		const levelCount = this._activeHandle?.getLevelCount() ?? 0;
		return this._currentLevel > 0 && this._currentLevel < levelCount;
	}

	//#endregion

	//#region Actions (표현 계층의 버튼이 부른다)

	/** 메인 메뉴에서 퍼즐을 골랐다 → 상세 화면(꽉 찬 퍼즐 UI)으로 */
	public selectPuzzle(puzzleId: EPuzzleId): boolean {
		if (this._screen !== EPuzzleHubScreen.MAIN_MENU) {
			return false;
		}
		if (this._registry.getHandle(puzzleId) === undefined) {
			// 아직 Horizon 통합이 없는 퍼즐 - "준비 중"
			this._events.LOCKED_PUZZLE_TAPPED.publish(puzzleId);
			return false;
		}

		this._selectedPuzzleId = puzzleId;
		this.publishDetail();
		this.setScreen(EPuzzleHubScreen.PUZZLE_DETAIL);
		return true;
	}

	/** 상세 화면 → 메인 메뉴 (Return 버튼) */
	public returnToMenu(): boolean {
		if (this._screen !== EPuzzleHubScreen.PUZZLE_DETAIL) {
			return false;
		}
		this._selectedPuzzleId = undefined;
		this.setScreen(EPuzzleHubScreen.MAIN_MENU);
		return true;
	}

	/** Start - 1레벨부터 시작한다 */
	public startNewGame(): boolean {
		if (this._screen !== EPuzzleHubScreen.PUZZLE_DETAIL) {
			return false;
		}
		return this.startLevel(1);
	}

	/**
	 * Continue - 마지막으로 클리어한 레벨의 다음 레벨부터 시작한다.
	 * 클리어 기록이 없으면 아무 일도 하지 않는다 (버튼이 잠겨 있어야 한다).
	 */
	public continueGame(): boolean {
		if (this._screen !== EPuzzleHubScreen.PUZZLE_DETAIL) {
			return false;
		}
		const detail = this.getDetailView();
		if (detail.canContinue === false) {
			return false;
		}
		return this.startLevel(detail.continueLevel);
	}

	/** 결과 화면에서 같은 레벨 재도전 */
	public retry(): boolean {
		if (this._screen !== EPuzzleHubScreen.RESULT) {
			return false;
		}
		return this.startLevel(this._currentLevel);
	}

	/** 결과 화면에서 다음 레벨로 (이겼을 때만) */
	public playNextLevel(): boolean {
		if (this._screen !== EPuzzleHubScreen.RESULT || this.canPlayNextLevel() === false) {
			return false;
		}
		return this.startLevel(this._currentLevel + 1);
	}

	/**
	 * 지금 판을 풀기 전 상태로 되돌린다 (보조 레이아웃의 Reset 버튼).
	 *
	 * 보드 패널의 Reset 버튼은 프레젠터를 통해 CoreAPI 로 바로 가지만, 메인 UI 쪽에도
	 * 같은 경로를 열어 둔다 - 일시정지 화면 등에서 리셋을 붙일 자리이자,
	 * 화면 상태와 무관하게 리셋이 새는 일이 없는지 검증할 지점이다.
	 */
	public resetLevel(): boolean {
		if (this._screen !== EPuzzleHubScreen.IN_GAME) {
			return false;
		}
		return this._activeHandle?.resetLevel() ?? false;
	}

	public pauseGame(): void {
		if (this._screen !== EPuzzleHubScreen.IN_GAME) {
			return;
		}
		// 화면 전환은 onPaused 이벤트에서 한다 - 세션이 비활성이면 무시되는 것까지 세션 규칙을 따른다
		this._activeHandle?.pause();
	}

	public resumeGame(): void {
		if (this._screen !== EPuzzleHubScreen.PAUSED) {
			return;
		}
		this._activeHandle?.resume();
	}

	/**
	 * 지금 레벨을 처음부터 다시 시작한다 - 일시정지 화면의 **Restart Level**.
	 *
	 * 보조 레이아웃의 Reset 버튼(`resetLevel()`)과 다르다.
	 *   Reset         판만 되돌리고 **남은 시간은 그대로** 둔다
	 *   Restart Level 레벨을 다시 열어 **타이머까지 초기화**한다
	 *
	 * 일시정지 중에도 동작해야 한다 - 그 버튼이 떠 있는 곳이 바로 일시정지 화면이다.
	 * 세션은 `startLevel()` 에서 상태를 통째로 다시 잡으므로 멈춰 있는 상태도 그대로 풀린다.
	 */
	public restartLevel(): boolean {
		if (this._screen !== EPuzzleHubScreen.PAUSED && this._screen !== EPuzzleHubScreen.IN_GAME) {
			return false;
		}
		if (this._currentLevel <= 0) {
			return false;
		}
		return this.startLevel(this._currentLevel);
	}

	/**
	 * 어떤 화면에 있든 메인 메뉴로 되돌리고 돌던 퍼즐을 전부 정리한다.
	 *
	 * 허브가 새로 시작할 때(재입장 포함) 부른다. `quitToMenu()` 가 인게임·결과 화면에서만
	 * 동작하는 것과 달리, 여기는 **무조건** 메인 메뉴로 맞춘다. 진행도는 건드리지 않는다 -
	 * 저장된 클리어 기록은 `PuzzleProgressTracker` 가 따로 들고 있기 때문이다.
	 */
	public resetToMainMenu(): void {
		this.disconnectQuest();
		// 레지스트리는 싱글턴이라 앞선 생의 핸들이 남아 있을 수 있다.
		// _activeHandle 하나만 끊으면 그들이 그대로 화면에 남는다.
		this._registry.abortAll();
		this._selectedPuzzleId = undefined;
		this._currentLevel = 0;
		this._lastResult = undefined;
		this._hudTimeSeconds = 0;
		this._hudRound = createEmptyRoundProgress();
		this.setScreen(EPuzzleHubScreen.MAIN_MENU);
		this._events.CATALOG_CHANGED.publish(this.getCatalogView());
	}

	/** 인게임(일시정지 포함)·결과 화면에서 메인 메뉴로 돌아간다 */
	public quitToMenu(): boolean {
		if (this._screen !== EPuzzleHubScreen.IN_GAME
			&& this._screen !== EPuzzleHubScreen.PAUSED
			&& this._screen !== EPuzzleHubScreen.RESULT) {
			return false;
		}
		this.disconnectQuest();
		this._selectedPuzzleId = undefined;
		this._currentLevel = 0;
		this.setScreen(EPuzzleHubScreen.MAIN_MENU);
		return true;
	}

	/** 결과 화면에서 이 퍼즐의 상세 화면으로 돌아간다 */
	public backToDetail(): boolean {
		if (this._screen !== EPuzzleHubScreen.RESULT) {
			return false;
		}
		this.disconnectQuest();
		this._currentLevel = 0;
		if (this._selectedPuzzleId === undefined) {
			this.setScreen(EPuzzleHubScreen.MAIN_MENU);
			return true;
		}
		this.publishDetail();
		this.setScreen(EPuzzleHubScreen.PUZZLE_DETAIL);
		return true;
	}

	//#endregion

	//#region Internal

	private getSelectedHandle(): IPuzzleGameHandle | undefined {
		return this._selectedPuzzleId === undefined ? undefined : this._registry.getHandle(this._selectedPuzzleId);
	}

	/** Start / Continue / retry / nextLevel 이 모두 거치는 단 하나의 시작 경로 */
	private startLevel(level: number): boolean {
		const handle = this.getSelectedHandle();
		if (handle === undefined) {
			return false;
		}
		if (level < 1 || level > handle.getLevelCount()) {
			this._events.START_FAILED.publish(handle.puzzleId);
			return false;
		}

		// 시작 전에 구독부터 건다 - 레벨 생성 실패 시 QUEST_FAILED 가
		// startLevel() 안에서 동기적으로 발행되기 때문이다
		if (this._activeHandle !== handle) {
			this.disconnectQuest();
			this._activeHandle = handle;
			this._questSubscriptions.addRange(...handle.subscribeQuestEvents({
				onTimeChanged: this.onTimeChanged.bind(this),
				onRoundProgressChanged: this.onRoundProgressChanged.bind(this),
				onQuestEnded: this.onQuestEnded.bind(this),
				onPaused: this.onPaused.bind(this),
				onResumed: this.onResumed.bind(this),
			}));
		}

		this._lastResult = undefined;
		this._currentLevel = level;
		this._hudTimeSeconds = handle.getRemainingTimeSeconds();
		this._hudRound = createEmptyRoundProgress();

		const didStart = handle.startLevel(level);

		if (this._lastResult !== undefined) {
			// 시작 도중 동기적으로 실패가 확정됐다 (레벨 생성 실패 등) → 이미 RESULT 화면이다
			return false;
		}
		if (didStart === false) {
			// 이벤트 없이 거절됐다 - 화면을 유지하고 알린다
			this._events.START_FAILED.publish(handle.puzzleId);
			return false;
		}

		this._hudTimeSeconds = handle.getRemainingTimeSeconds();
		this._hudRound = handle.getRoundProgress();
		this.publishHud();
		this.setScreen(EPuzzleHubScreen.IN_GAME);
		return true;
	}

	private disconnectQuest(): void {
		// 진행 중이던 퀘스트는 버려지고, 이미 끝난 퀘스트(RESULT 경유)에도 abort 는
		// 세션을 IDLE 로 되돌리고 보드를 화면에서 내리는 정리 역할이라 안전하다.
		this._activeHandle?.abort();
		this._questSubscriptions.disconnect();
		this._activeHandle = undefined;
	}

	private onTimeChanged(seconds: number): void {
		this._hudTimeSeconds = seconds;
		this.publishHud();
	}

	private onRoundProgressChanged(progress: PuzzleUIRoundProgress): void {
		this._hudRound = { ...progress };
		this.publishHud();
	}

	private onQuestEnded(result: PuzzleUIQuestResult): void {
		this._lastResult = result;

		// 이겼을 때만 진행도를 올린다. 이미 더 앞서 있으면 tracker 가 뒤로 물리지 않는다.
		if (result.isWin && this._currentLevel > 0) {
			if (this._progress.recordCleared(result.puzzleId, this._currentLevel)) {
				this._events.CATALOG_CHANGED.publish(this.getCatalogView());
			}
		}

		this._events.RESULT_READY.publish(result);
		this.setScreen(EPuzzleHubScreen.RESULT);
	}

	private onPaused(): void {
		if (this._screen === EPuzzleHubScreen.IN_GAME) {
			this.setScreen(EPuzzleHubScreen.PAUSED);
		}
	}

	private onResumed(): void {
		if (this._screen === EPuzzleHubScreen.PAUSED) {
			this.setScreen(EPuzzleHubScreen.IN_GAME);
		}
	}

	private publishHud(): void {
		this._events.HUD_CHANGED.publish(this.getHudView());
	}

	private publishDetail(): void {
		this._events.DETAIL_CHANGED.publish(this.getDetailView());
	}

	private setScreen(screen: EPuzzleHubScreen): void {
		if (this._screen === screen) {
			return;
		}
		this._screen = screen;
		this._events.SCREEN_CHANGED.publish(screen);
	}

	//#endregion
}
