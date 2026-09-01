/**
 * Puzzle UI Model - 메인 UI(퍼즐 허브)의 순수 상태 머신
 *
 * 화면 흐름 (EPuzzleHubScreen)
 *
 *   MAIN_MENU ──selectPuzzle()──▶ DIFFICULTY_SELECT ──startSelected()──▶ IN_GAME
 *       ▲                │back()                                          │
 *       │                ▼                                     pause/resume ⇄ PAUSED
 *       │◀──quitToMenu()──────────────────────────────┐                    │
 *       │                                             │        (퀘스트 종료 이벤트)
 *       └──────────quitToMenu()──── RESULT ◀──────────┴────────────────────┘
 *                                     │retry() ──▶ IN_GAME (같은 퍼즐·난이도 재시작)
 *
 * 규칙
 *   - 레지스트리에 핸들이 없는 퍼즐(아직 *_CoreAPI 미구현)은 선택할 수 없다 → "준비 중"
 *   - 인게임 구독은 시작 시 걸고 **메뉴로 돌아갈 때** 해제한다 (retry 는 구독을 유지)
 *   - 레벨 생성 실패로 시작 즉시 QUEST_FAILED 가 오는 경로도 결과 화면으로 수렴한다
 *     (진행 문서 §8.2 - 세션이 fail() 을 경유해 이벤트를 보장한다)
 *
 * `horizon/core` 에 런타임 의존이 없어 Node 테스트(PuzzleUI_Tests.ts)로 전 화면 전이를 검증한다.
 */

import { EventPublisher, Subscription, SubscriptionBag } from 'Utility_Events';
import { IPuzzleGameHandle, PuzzleHubRegistry } from 'PuzzleUI_Registry';
import {
	EPuzzleHubScreen,
	EPuzzleId,
	PUZZLE_CATALOG,
	PuzzleCatalogView,
	PuzzleHudView,
	PuzzleSelectionView,
	PuzzleUIQuestResult,
	PuzzleUIRoundProgress,
	createEmptyRoundProgress,
	formatClockLabel,
	getCatalogEntry,
} from 'PuzzleUI_Definitions';

//#region Events

/** 표현 계층(PuzzleUI_MainPanel)이 구독하는 뷰 갱신 이벤트 */
export class PuzzleHubEvents {
	public readonly SCREEN_CHANGED = new EventPublisher<EPuzzleHubScreen>();
	/** 핸들 등록으로 "준비 중" 표시가 바뀌었다 */
	public readonly CATALOG_CHANGED = new EventPublisher<PuzzleCatalogView[]>();
	/** 선택된 퍼즐 또는 난이도가 바뀌었다 */
	public readonly SELECTION_CHANGED = new EventPublisher<PuzzleSelectionView>();
	/** 인게임 HUD 갱신 (시간은 세션이 초 단위로 이미 스로틀한다) */
	public readonly HUD_CHANGED = new EventPublisher<PuzzleHudView>();
	/** 결과 화면 데이터가 준비됐다 */
	public readonly RESULT_READY = new EventPublisher<PuzzleUIQuestResult>();
	/** 시작에 실패했다 (알 수 없는 난이도 등) - 토스트 표시용 */
	public readonly START_FAILED = new EventPublisher<EPuzzleId>();
	/** 준비 중(미등록) 퍼즐을 눌렀다 - 토스트 표시용 */
	public readonly LOCKED_PUZZLE_TAPPED = new EventPublisher<EPuzzleId>();
}

//#endregion

export class PuzzleHubModel {
	private readonly _registry: PuzzleHubRegistry;
	private readonly _events: PuzzleHubEvents = new PuzzleHubEvents();
	private readonly _registrySubscription: Subscription;

	private _screen: EPuzzleHubScreen = EPuzzleHubScreen.MAIN_MENU;

	private _selectedPuzzleId: EPuzzleId | undefined = undefined;
	private _selectedDifficulty: number = 1;

	/** 인게임 중인 퍼즐의 핸들. RESULT 화면까지 유지한다 (retry 용) */
	private _activeHandle: IPuzzleGameHandle | undefined = undefined;
	private readonly _questSubscriptions: SubscriptionBag = new SubscriptionBag();

	private _hudTimeSeconds: number = 0;
	private _hudRound: PuzzleUIRoundProgress = createEmptyRoundProgress();
	private _lastResult: PuzzleUIQuestResult | undefined = undefined;

	constructor(registry: PuzzleHubRegistry = PuzzleHubRegistry.instance) {
		this._registry = registry;
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

	public getCatalogView(): PuzzleCatalogView[] {
		return PUZZLE_CATALOG.map((entry) => ({
			id: entry.id,
			displayName: entry.displayName,
			subtitle: entry.subtitle,
			isAvailable: this._registry.isRegistered(entry.id),
		}));
	}

	public getSelectionView(): PuzzleSelectionView {
		const entry = this._selectedPuzzleId === undefined ? undefined : getCatalogEntry(this._selectedPuzzleId);
		const handle = this._selectedPuzzleId === undefined ? undefined : this._registry.getHandle(this._selectedPuzzleId);
		return {
			puzzleId: this._selectedPuzzleId,
			displayName: entry?.displayName ?? '',
			subtitle: entry?.subtitle ?? '',
			difficulties: handle?.getDifficulties() ?? [],
			selectedDifficulty: this._selectedDifficulty,
		};
	}

	public getHudView(): PuzzleHudView {
		const entry = this._selectedPuzzleId === undefined ? undefined : getCatalogEntry(this._selectedPuzzleId);
		return {
			puzzleId: this._selectedPuzzleId,
			displayName: entry?.displayName ?? '',
			difficulty: this._selectedDifficulty,
			remainingTimeSeconds: this._hudTimeSeconds,
			clockLabel: formatClockLabel(this._hudTimeSeconds),
			round: { ...this._hudRound },
		};
	}

	public getLastResult(): PuzzleUIQuestResult | undefined {
		return this._lastResult;
	}

	//#endregion

	//#region Actions (표현 계층의 버튼이 부른다)

	/** 메인 메뉴에서 퍼즐을 골랐다 → 난이도 선택으로 */
	public selectPuzzle(puzzleId: EPuzzleId): boolean {
		if (this._screen !== EPuzzleHubScreen.MAIN_MENU) {
			return false;
		}
		const handle = this._registry.getHandle(puzzleId);
		if (handle === undefined) {
			// 아직 Horizon 통합이 없는 퍼즐 - "준비 중"
			this._events.LOCKED_PUZZLE_TAPPED.publish(puzzleId);
			return false;
		}

		this._selectedPuzzleId = puzzleId;
		const difficulties = handle.getDifficulties();
		this._selectedDifficulty = difficulties.length > 0 ? difficulties[0] : 1;

		this._events.SELECTION_CHANGED.publish(this.getSelectionView());
		this.setScreen(EPuzzleHubScreen.DIFFICULTY_SELECT);
		return true;
	}

	/** 난이도 선택 화면에서 난이도를 바꿨다 (선택 목록에 없는 값은 무시) */
	public selectDifficulty(difficulty: number): boolean {
		if (this._screen !== EPuzzleHubScreen.DIFFICULTY_SELECT) {
			return false;
		}
		const handle = this.getSelectedHandle();
		if (handle === undefined || handle.getDifficulties().indexOf(difficulty) < 0) {
			return false;
		}
		this._selectedDifficulty = difficulty;
		this._events.SELECTION_CHANGED.publish(this.getSelectionView());
		return true;
	}

	/** 난이도 선택 → 메인 메뉴 */
	public back(): boolean {
		if (this._screen !== EPuzzleHubScreen.DIFFICULTY_SELECT) {
			return false;
		}
		this.setScreen(EPuzzleHubScreen.MAIN_MENU);
		return true;
	}

	/** 선택한 퍼즐·난이도로 시작한다 */
	public startSelected(): boolean {
		if (this._screen !== EPuzzleHubScreen.DIFFICULTY_SELECT) {
			return false;
		}
		return this.startQuest();
	}

	/** 결과 화면에서 같은 퍼즐·난이도로 재도전 */
	public retry(): boolean {
		if (this._screen !== EPuzzleHubScreen.RESULT) {
			return false;
		}
		return this.startQuest();
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

	/** 인게임(일시정지 포함)·결과 화면에서 메인 메뉴로 돌아간다 */
	public quitToMenu(): boolean {
		if (this._screen !== EPuzzleHubScreen.IN_GAME
			&& this._screen !== EPuzzleHubScreen.PAUSED
			&& this._screen !== EPuzzleHubScreen.RESULT) {
			return false;
		}
		this.disconnectQuest();
		this.setScreen(EPuzzleHubScreen.MAIN_MENU);
		return true;
	}

	//#endregion

	//#region Internal

	private getSelectedHandle(): IPuzzleGameHandle | undefined {
		return this._selectedPuzzleId === undefined ? undefined : this._registry.getHandle(this._selectedPuzzleId);
	}

	private startQuest(): boolean {
		const handle = this.getSelectedHandle();
		if (handle === undefined) {
			return false;
		}

		// 시작 전에 구독부터 건다 - 레벨 생성 실패 시 QUEST_FAILED 가
		// startQuestByDifficulty() 안에서 동기적으로 발행되기 때문이다 (진행 문서 §8.2)
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
		this._hudTimeSeconds = handle.getRemainingTimeSeconds();
		this._hudRound = createEmptyRoundProgress();

		const didStart = handle.startQuestByDifficulty(this._selectedDifficulty);

		if (this._lastResult !== undefined) {
			// 시작 도중 동기적으로 실패가 확정됐다 (레벨 생성 실패 등) → 이미 RESULT 화면이다
			return false;
		}
		if (didStart === false) {
			// 이벤트 없이 거절됐다 (알 수 없는 난이도 등) - 화면을 유지하고 알린다
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
		// 세션을 IDLE 로 되돌리는 정리 역할이라 안전하다.
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

	private setScreen(screen: EPuzzleHubScreen): void {
		if (this._screen === screen) {
			return;
		}
		this._screen = screen;
		this._events.SCREEN_CHANGED.publish(screen);
	}

	//#endregion
}
