/**
 * Puzzle UI Main Panel - 메인 UI(퍼즐 허브)의 Horizon 표현 계층
 *
 * 순수 로직(PuzzleUI_Model)의 뷰 이벤트를 Binding 에 흘려 넣고,
 * 버튼(Pressable)을 모델의 액션으로 연결하는 것이 전부다. 화면 전이 규칙은
 * 한 줄도 여기 있지 않다 (PUZ_00 §7.1 로직과 표현의 분리).
 *
 * ## 화면 구성
 *
 *   메인 메뉴      - 8개 퍼즐 격자 **2열 × 4행** (미등록 퍼즐은 어둡게 + "준비 중")
 *   퍼즐 상세      - 고른 퍼즐이 화면을 꽉 채우고, 아래 세 버튼을 **세로로** 놓는다
 *                      Start    1레벨부터
 *                      Continue 마지막으로 클리어한 레벨의 다음부터 (기록 없으면 잠김)
 *                      Return   메인 메뉴로
 *   인게임 HUD     - 상단 바만 표시하고 보드를 가리지 않는다
 *   시스템 메뉴    - 반투명 오버레이. 뜨는 동안 타이머가 멈춘다
 *                      Resume         닫고 다시 푼다 (시간이 이어서 흐른다)
 *                      Restart Level  이 레벨을 처음부터 - 타이머도 초기화
 *                      Return to Main 메인 메뉴로
 *   결과           - 승패 + 통계 + 아래 버튼
 *                      클리어 Restart / Next Level / Return to Main  (세 개)
 *                      실패   Restart / Return to Main               (두 개)
 *
 * ## 인게임 상단 바 (worker/NextJob.md 1번)
 *
 *      ┌──────────────────────────────────────┐
 *      │  LV 3 / 24          07        [MENU] │
 *      └──────────────────────────────────────┘
 *        좌측 = 레벨       중앙 = 남은 초   우측 = 시스템 메뉴
 *
 * 남은 시간은 **초 단위 숫자 하나**다. 10초 미만이 되면 그 숫자가 빨갛게 점멸하고
 * `countdownSound` 로 지정한 오디오가 1초마다 울린다. 오디오를 지정하지 않으면
 * 점멸만 하고 조용히 지나간다 - 소리는 있으면 좋은 것이지 없으면 안 되는 것이 아니다.
 *
 * 보드 패널(`PuzzleBoardUIPanel`)은 위쪽 `topInsetPercent` 만큼을 비워 두므로 자리로만
 * 보면 이 바와 겹치지 않는다. 둘 다 Screen Overlay 라 세로 비율로 자리를 나눠 갖는다.
 *
 * **다만 인게임에서는 이 바가 실제로 보이지 않는다.** 보드 패널이 화면 전체를 덮는
 * 불투명 배경과 뗌 마감 레이어를 깔기 때문이다 (`PuzzleBoardUI_Panel.createMenuButton()`
 * 주석 - 그래서 일시정지 버튼이 보드 쪽에도 하나 있다). 그 자리를 판에 돌려주려고
 * `topInsetPercent` 는 8% 까지 내려가 있다. 이 바를 보드 위로 올리게 되는 날에는
 * 보드 쪽 `topInsetPercent` 를 `HUD_BAR_HEIGHT_PERCENT` + 상단 안전 여백만큼 다시 키워야 한다.
 *
 * ## 붙이는 법
 *
 *   1. Custom UI gizmo 를 만들어 이 스크립트를 붙이고 Display Mode 를 **Screen Overlay** 로 둔다.
 *   2. 실행 모드를 **Local** 로 두고, `Puzzle_LocalOwnership` 의 targets 에 이 엔티티를 추가한다
 *      (소유권이 안 넘어오면 서버 인스턴스는 빈 화면만 그린다).
 *   3. 같은 클라이언트에서 도는 각 퍼즐의 `*_CoreAPI` 가 `PuzzleHubRegistry` 에 핸들을
 *      등록하면 그 퍼즐이 자동으로 "준비 중" 에서 풀린다. CoreAPI 의 `autoStart` 는
 *      **기본값이 꺼짐**이라, 게임은 언제나 이 메뉴에서 시작한다.
 *   4. 진행도를 영구 저장하려면 에디터에서 변수 그룹을 하나 만든다
 *      (`PuzzleUI_PersistentProgress.ts` 머리말 참조). 안 만들어도 게임은 돌고,
 *      그 경우 진행도는 세션 동안만 유지된다.
 *
 * 모바일 지침 (PUZ_00 §8)
 *   - 버튼은 화면 폭의 40% 이상, 세로 8% 이상으로 잡아 엄지로 누르기 넉넉하게 한다
 *   - 인게임에서는 상단 바 외에 아무것도 그리지 않는다 - 보드와 손가락을 가리지 않는다 (§8.5)
 *   - **화면 규격은 `PuzzleUI_Layout` 이 정한다.** 기기별 안전 여백을 물리고, 글자 크기는
 *     버튼의 실제 픽셀 높이에서 도출한다 - 버튼이 커지면 글자도 함께 커진다
 *
 * ## 재입장
 *
 * 이 패널이 만들어질 때 `bootToMainMenu()` 가 돌아 **언제나 메인 메뉴에서 시작한다.**
 * 진행도는 영구 변수에서 다시 읽으므로 그대로 남는다.
 */

import { AudioGizmo, Color, PropTypes } from 'horizon/core';
import { Binding, Pressable, Text, UIComponent, UINode, View } from 'horizon/ui';
import { SubscriptionBag } from 'Utility_Events';
import { PuzzleHubModel } from 'PuzzleUI_Model';
import { PuzzleBoardStage } from 'PuzzleBoardUI_Presenter';
import {
	EUIDeviceClass,
	PUZZLE_UI_CANVAS_HEIGHT,
	PUZZLE_UI_CANVAS_WIDTH,
	PuzzleUICanvas,
	PuzzleUILayoutProfile,
	PuzzleUISafeAreaPixels,
	canvasPixelScale,
	computeSafeAreaPixels,
	fitFontSize,
	getCatalogColumns,
	makeCanvas,
	getDefaultCanvas,
	getLayoutProfile,
	getUsableHeightPercent,
	percentOf,
	resolveCanvas,
	toUIDeviceClass,
	verticalPixels,
} from 'PuzzleUI_Layout';
import { MemoryProgressStorage, PuzzleProgressTracker } from 'PuzzleUI_Progress';
import {
	DEFAULT_PROGRESS_VARIABLE_KEY,
	HorizonProgressStorage,
	canUsePersistentStorage,
} from 'PuzzleUI_PersistentProgress';
import {
	EPuzzleHubScreen,
	EPuzzleId,
	HUD_CRITICAL_BLINK_SECONDS,
	PUZZLE_CATALOG,
	PuzzleUIQuestResult,
	formatClockLabel,
	getCatalogEntry,
} from 'PuzzleUI_Definitions';

//#region Style constants

const COLOR_BACKGROUND = new Color(0.08, 0.09, 0.13);
const COLOR_PANEL = new Color(0.14, 0.16, 0.22);
const COLOR_BUTTON = new Color(0.22, 0.45, 0.85);
const COLOR_BUTTON_DIM = new Color(0.2, 0.22, 0.28);
const COLOR_CONTINUE = new Color(0.2, 0.62, 0.45);
const COLOR_DANGER = new Color(0.75, 0.25, 0.25);
const COLOR_WIN = new Color(0.25, 0.75, 0.4);
const COLOR_LOSE = new Color(0.85, 0.3, 0.3);
const COLOR_TEXT = Color.white;
/** 초읽기(10초 미만) 카운트다운 숫자 */
const COLOR_TIME_CRITICAL = new Color(0.95, 0.25, 0.25);

/** 메인 메뉴 격자는 2열 × 4행 고정 (카탈로그 8종) */
const CATALOG_COLUMNS_PORTRAIT = 2;
/** 격자가 좌우로 쓰는 폭 (%) - 남는 8% 는 버튼 사이 여백이다 */
const CATALOG_WIDTH_BUDGET_PERCENT = 88;
/** 퍼즐 격자가 쓰는 세로 (%) - 제목 줄을 뺀 나머지 */
const CATALOG_GRID_HEIGHT_PERCENT = 82;

/**
 * 인게임 상단 바의 높이 (%).
 * MENU 버튼이 이 안에 있으므로 엄지로 누를 수 있는 높이가 나와야 한다 - 7% 였을 때
 * 버튼이 4mm 남짓이라 "손가락에 다 가려진다" 는 피드백이 있었다.
 *
 * 이 바를 보드 위로 올리게 되면 보드 패널의 `topInsetPercent` 가 이 값 + 상단 안전 여백
 * 이상이어야 겹치지 않는다. 지금은 보드가 이 바를 덮으므로 그 자리를 판이 쓰고 있다
 * (파일 머리말).
 */
const HUD_BAR_HEIGHT_PERCENT = 10;

/**
 * 일시정지 버튼의 라벨.
 * 예전에는 'MENU' 였는데 "일시정지 버튼이 없다" 로 읽혔다 - 누르면 타이머가 멈추고
 * Resume / Restart / Return to Main 이 뜨는, 사실상의 일시정지 버튼이므로 그대로 부른다.
 */
const PAUSE_BUTTON_LABEL = 'Pause';

const TOAST_SECONDS = 2;

//#endregion

type CatalogSlot = {
	id: EPuzzleId,
	subtitle: Binding<string>,
	progressLabel: Binding<string>,
	isAvailable: Binding<boolean>,
}

export class PuzzleUIMainPanel extends UIComponent<typeof PuzzleUIMainPanel> {
	public static propsDefinition = {
		/**
		 * 진행도를 담을 플레이어 영구 변수 키 (`그룹이름:변수이름`).
		 *
		 * 에디터에 그 변수 그룹이 없으면 자동으로 메모리 저장으로 떨어진다 - 게임은 그대로 돌고
		 * 진행도가 세션 동안만 유지될 뿐이다. 어느 쪽으로 붙었는지는 시작 시 콘솔에 찍힌다.
		 * 비워 두면 영구 저장을 아예 시도하지 않는다.
		 */
		progressVariableKey: { type: PropTypes.String, default: DEFAULT_PROGRESS_VARIABLE_KEY },
		/**
		 * 남은 시간이 10초 미만일 때 1초마다 울릴 Audio gizmo (선택).
		 *
		 * 비워 두면 소리 없이 숫자만 점멸한다. 이 플레이어에게만 들리게 하려면 gizmo 를
		 * 이 패널과 같은 Local 소유로 두면 된다.
		 */
		countdownSound: { type: PropTypes.Entity },

		/**
		 * 캔버스 크기를 직접 못박는다 (px). 둘 다 0 이면 화면 비율에서 자동으로 잡는다.
		 *
		 * `player.screenWidth/screenHeight` 가 실제 화면과 다르게 오는 기기를 만났을 때의
		 * 탈출구다. **보드 패널과 허브 패널에 같은 값을 넣어야 한다** - 다르면 같은 `%` 가
		 * 서로 다른 픽셀이 되어 HUD 바가 보드 위로 파고든다.
		 */
		canvasWidth: { type: PropTypes.Number, default: 0 },
		canvasHeight: { type: PropTypes.Number, default: 0 },
	};

	/**
	 * 보드 패널과 **같은 캔버스**를 쓴다 (`PuzzleUI_Layout`).
	 * 다른 캔버스를 쓰면 같은 `%` 가 서로 다른 픽셀이 되어 HUD 바가 보드 위로 파고든다.
	 *
	 * **`readonly` 가 아니다.** `initializeUI()` 에서 플레이어의 실제 화면 비율에 맞춰
	 * 다시 잡는다 - 그래야 Screen Overlay 가 화면을 꽉 채우고 옆으로 월드가 새지 않는다.
	 * 보드 패널도 같은 플레이어를 보고 같은 계산을 하므로 둘의 캔버스는 언제나 같다.
	 */
	protected panelWidth: number = PUZZLE_UI_CANVAS_WIDTH;
	protected panelHeight: number = PUZZLE_UI_CANVAS_HEIGHT;

	/** 이 플레이어의 캔버스. `resolveLayout()` 에서 한 번 정하고 바뀌지 않는다 */
	private _canvas: PuzzleUICanvas = getDefaultCanvas();
	/** 메인 메뉴 격자의 열 수 - 세로 화면 2, 가로 화면 4 */
	private _catalogColumns: number = CATALOG_COLUMNS_PORTRAIT;
	/**
	 * 안전 여백 (px).
	 *
	 * **퍼센트가 아니라 픽셀이다.** Yoga 는 `padding`/`margin` 의 퍼센트를 네 방향 모두
	 * 부모의 *가로* 로 계산하므로, 가로 화면에서 위아래 여백이 세 배 넘게 부푼다
	 * (`PuzzleUI_Layout` 머리말 §4).
	 */
	private _safeArea: PuzzleUISafeAreaPixels = { top: 0, bottom: 0, left: 0, right: 0 };

	private _model: PuzzleHubModel | undefined = undefined;

	/**
	 * 보드 스테이지 구독 - 보드 위 Menu 버튼의 일시정지 요청을 받는다.
	 *
	 * 스테이지는 **모듈 싱글턴**이라 이 패널보다 오래 산다. 재입장으로 패널이 다시 만들어질
	 * 때 정리하지 않으면 버려진 모델을 가리키는 구독이 겹쳐 쌓이므로 `dispose()` 에서 끊는다.
	 */
	private readonly _stageSubscriptions: SubscriptionBag = new SubscriptionBag();

	/** 이 플레이어의 기기 규격. `initializeUI()` 에서 한 번 정하고 바뀌지 않는다 */
	private _profile: PuzzleUILayoutProfile = getLayoutProfile(EUIDeviceClass.DESKTOP);
	/** 안전 여백을 물리고 남는 세로 길이 (px). 버튼 글자 크기가 여기서 나온다 */
	private _usableHeight: number = PUZZLE_UI_CANVAS_HEIGHT;

	private readonly _screen: Binding<string> = new Binding<string>(EPuzzleHubScreen.MAIN_MENU as string);

	private readonly _catalogSlots: CatalogSlot[] = [];

	private readonly _detailTitle: Binding<string> = new Binding('');
	private readonly _detailSubtitle: Binding<string> = new Binding('');
	private readonly _detailProgress: Binding<string> = new Binding('');
	private readonly _startLabel: Binding<string> = new Binding('Start');
	private readonly _continueLabel: Binding<string> = new Binding('Continue');
	private readonly _canContinue: Binding<boolean> = new Binding<boolean>(false);

	/** 좌측 상단 - "LV 3 / 24" */
	private readonly _hudLevel: Binding<string> = new Binding('');
	/** 상단 중앙 - 남은 초 하나 */
	private readonly _hudSeconds: Binding<string> = new Binding('0');
	private readonly _hudRound: Binding<string> = new Binding('');
	/** 초읽기(10초 미만)인지 - 숫자 색이 여기서 갈린다 */
	private readonly _isTimeCritical: Binding<boolean> = new Binding<boolean>(false);
	/** 점멸의 켜짐/꺼짐. 초읽기가 아닐 때는 언제나 켜짐이다 */
	private readonly _isBlinkOn: Binding<boolean> = new Binding<boolean>(true);

	private readonly _resultTitle: Binding<string> = new Binding('');
	private readonly _resultDetail: Binding<string> = new Binding('');
	private readonly _resultColor: Binding<Color> = new Binding(COLOR_WIN);
	private readonly _hasNextLevel: Binding<boolean> = new Binding<boolean>(false);

	private readonly _toastText: Binding<string> = new Binding('');
	private readonly _toastVisible: Binding<boolean> = new Binding<boolean>(false);
	private _toastTimeoutId: number | undefined = undefined;

	/** 점멸 인터벌. 초읽기에 들어갈 때만 돌고 나오면 멈춘다 */
	private _blinkIntervalId: number | undefined = undefined;
	/** 지금 초읽기 상태인지 (Binding 은 읽을 수 없어 따로 들고 있는다) */
	private _isCriticalActive: boolean = false;
	/** 마지막으로 소리를 낸 초. 같은 초에 두 번 울리지 않게 한다 */
	private _lastBeepSecond: number = -1;

	//#region Lifecycle

	public initializeUI(): UINode {
		// 소유권이 넘어오지 않은 서버 인스턴스는 아무것도 그리지 않는다
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			return View({});
		}

		this.resolveLayout();

		this._model = new PuzzleHubModel(undefined, this.createProgressTracker());
		this.subscribeToModel(this._model);
		this.subscribeToBoardStage();

		const root = View({
			children: [
				this.createMainMenuScreen(),
				this.createDetailScreen(),
				this.createHudBar(),
				this.createPausedOverlay(),
				this.createResultScreen(),
				this.createToast(),
			],
			style: {
				width: '100%',
				height: '100%',
				position: 'absolute',
				// **여기에는 여백을 주지 않는다.**
				//
				// 예전에는 안전 여백을 이 뿌리에 padding 으로 걸었는데, 그러면 각 화면의
				// 배경이 여백 **안쪽**에만 칠해져 패널 가장자리가 투명하게 남았다.
				// 그 틈으로 월드가 그대로 비쳤다 - "UI 가 화면을 꽉 채우지 않고 옆으로
				// 월드가 보인다" 의 정체다.
				//
				// 이제 여백은 각 화면이 자기 안에서 물린다 (`screenPadding()`).
				// 배경은 패널 끝까지 칠해지고, 글자와 버튼만 안전 영역 안으로 들어온다.
			},
		});

		// 초기 뷰 반영 (등록이 이 패널보다 먼저 끝난 CoreAPI 도 있을 수 있다)
		this.applyCatalog();
		this.bootToMainMenu();
		return root;
	}

	/**
	 * 캔버스 크기를 패널에 반영한다.
	 *
	 * **`preStart()` 에서 한 번, `initializeUI()` 에서 한 번** 부른다. 런타임이
	 * `panelWidth`/`panelHeight` 를 언제 읽는지 문서에 없어서, 둘 중 어느 쪽이 먼저 와도
	 * 크기가 잡히도록 양쪽에 건다. 같은 값을 두 번 넣는 것이라 부작용이 없다.
	 *
	 * 에디터에서 `canvasWidth`/`canvasHeight` 를 넣었으면 그 값을 그대로 쓰고,
	 * 아니면 플레이어의 화면 비율에서 뽑는다.
	 */
	private applyCanvasSize(): void {
		// 서버 인스턴스는 화면이 없다. 읽어 봐야 의미 없는 값이 나온다.
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			return;
		}
		const override = makeCanvas(this.props.canvasWidth, this.props.canvasHeight);
		if (override !== undefined) {
			this._canvas = override;
		}
		else {
			const player = this.entity.owner.get();
			this._canvas = resolveCanvas(player.screenWidth.get(), player.screenHeight.get());
		}
		this.panelWidth = this._canvas.width;
		this.panelHeight = this._canvas.height;
	}

	/**
	 * 패널이 만들어지기 전에 캔버스 크기를 잡는다.
	 * `initializeUI()` 에서만 대입하면 런타임이 그보다 먼저 크기를 읽는 경우 반영되지 않는다.
	 */
	public preStart(): void {
		this.applyCanvasSize();
	}

	/** 이 플레이어의 기기와 **화면 비율**에 맞는 규격을 정한다 */
	private resolveLayout(): void {
		const player = this.entity.owner.get();
		this._profile = getLayoutProfile(toUIDeviceClass(String(player.deviceType.get())));

		// 캔버스를 화면 비율에 맞춰야 Screen Overlay 가 화면을 꽉 채운다.
		// 맞추지 않으면 남는 자리로 월드가 보인다 (`PuzzleUI_Layout` 머리말 §3).
		this.applyCanvasSize();
		this._catalogColumns = getCatalogColumns(this._canvas);

		this._safeArea = computeSafeAreaPixels(this._profile, this._canvas);
		this._usableHeight = percentOf(this.panelHeight, getUsableHeightPercent(this._profile));
		console.log(`[PuzzleHub] Layout for ${this._profile.deviceClass}: `
			+ `canvas ${this._canvas.width}x${this._canvas.height} `
			+ `(${this._canvas.isLandscape ? 'landscape' : 'portrait'}), `
			+ `${this._catalogColumns} menu columns.`);
	}

	/**
	 * 허브를 메인 메뉴에서 시작시킨다 - **재입장 문제를 막는 자리**이다.
	 *
	 * 플레이어가 월드를 나갔다 다시 들어오면 소유권이 다시 넘어오면서 이 패널이 다시
	 * 만들어진다. 그러나 `PuzzleHubRegistry` 와 `PuzzleBoardStage` 는 **모듈 싱글턴**이라
	 * 앞서 돌던 세션과 화면에 올라가 있던 보드가 그대로 남아 있다. 정리하지 않으면
	 * 재입장 직후에 메인 메뉴 대신 **직전에 풀던 레벨이 다시 떠버린다.**
	 *
	 * 진행도는 이 정리에 포함되지 않는다 - 영구 변수에서 다시 읽어 그대로 보여 준다
	 * (`createProgressTracker()`). 그래서 "메인 메뉴로 들어오되 진도는 남아 있다" 가 된다.
	 *
	 * `*_CoreAPI` 의 `autoStart` 는 이 정리에 걸릴 수 있다. 원래 그 옵션은 허브 없이 퍼즐
	 * 하나만 시험할 때 쓰는 개발용이고 기본값도 꺼짐이다 - 게임은 언제나 이 메뉴에서 시작한다.
	 */
	private bootToMainMenu(): void {
		// 어느 쪽이 먼저 살아나는지 보장되지 않으므로 둘 다 친다.
		// 레지스트리에 남은 핸들은 모델이, 핸들이 바뀜 뒤도 남아 있는 보드는 스테이지가 정리한다.
		this._model?.resetToMainMenu();
		PuzzleBoardStage.instance.reset();
	}

	public dispose(): void {
		this.stopCountdownBlink();
		this._stageSubscriptions.disconnect();
		this._model?.dispose();
		this._model = undefined;
	}

	/**
	 * 영구 저장을 쓸 수 있으면 쓰고, 아니면 메모리로 떨어진다.
	 * 어느 쪽으로 붙었는지 로그로 남긴다 - "Continue 가 왜 초기화되죠" 를 콘솔만 보고 답하기 위해서다.
	 */
	private createProgressTracker(): PuzzleProgressTracker {
		const key = this.props.progressVariableKey ?? '';
		const player = this.entity.owner.get();

		if (canUsePersistentStorage(this.world, player, key)) {
			console.log(`[PuzzleHub] Progress is stored in the persistent variable "${key}".`);
			return new PuzzleProgressTracker(new HorizonProgressStorage(this.world, player, key));
		}

		console.log('[PuzzleHub] Progress is kept in memory only; it resets when the player leaves. '
			+ 'Create the persistent variable group to keep it (see PuzzleUI_PersistentProgress.ts).');
		return new PuzzleProgressTracker(new MemoryProgressStorage());
	}

	//#endregion

	//#region Model wiring (모델 이벤트 → Binding)

	/**
	 * 보드 위의 Menu 버튼을 상단 바의 Pause 와 같은 자리로 잇는다.
	 *
	 * 인게임에서는 보드 패널이 화면을 덮어 상단 바의 Pause 를 누를 수 없다
	 * (`PuzzleBoardUI_Panel.createMenuButton()`). 그래서 보드 쪽 버튼이 스테이지로 요청을
	 * 올리고, 그것을 여기서 받아 **똑같은 `pauseGame()`** 을 부른다 - 일시정지 규칙은
	 * 여전히 모델 하나에만 있다. 인게임이 아닐 때 모델이 무시하는 것도 그대로다.
	 */
	private subscribeToBoardStage(): void {
		this._stageSubscriptions.add(
			PuzzleBoardStage.instance.PAUSE_REQUESTED.subscribe(() => { this._model?.pauseGame(); }));
	}

	private subscribeToModel(model: PuzzleHubModel): void {
		model.events.SCREEN_CHANGED.subscribe((screen) => {
			this._screen.set(screen as string);
			if (screen === EPuzzleHubScreen.RESULT) {
				this._hasNextLevel.set(model.canPlayNextLevel());
			}
			if (screen !== EPuzzleHubScreen.IN_GAME) {
				// 인게임을 벗어나면 초읽기는 끝이다. 남겨 두면 결과 화면 뒤에서 인터벌이 계속 돈다
				this.applyTimeCritical(false, 0);
			}
		});

		model.events.CATALOG_CHANGED.subscribe(() => this.applyCatalog());

		model.events.DETAIL_CHANGED.subscribe(() => this.applyDetail());

		model.events.HUD_CHANGED.subscribe((hud) => {
			this._hudLevel.set(hud.levelLabel);
			this._hudSeconds.set(hud.secondsLabel);
			this._hudRound.set(hud.round.total > 1 ? `R ${hud.round.current}/${hud.round.total}` : '');
			this.applyTimeCritical(hud.isTimeCritical, hud.remainingTimeSeconds);
		});

		model.events.RESULT_READY.subscribe((result) => this.applyResult(result));

		model.events.LOCKED_PUZZLE_TAPPED.subscribe((puzzleId) => {
			const entry = getCatalogEntry(puzzleId);
			this.showToast(`${entry?.displayName ?? puzzleId} is not available yet.`);
		});

		model.events.START_FAILED.subscribe(() => {
			this.showToast('Could not start the puzzle. Please try again.');
		});
	}

	private applyCatalog(): void {
		const model = this._model;
		if (model === undefined) {
			return;
		}
		const catalog = model.getCatalogView();
		for (const slot of this._catalogSlots) {
			const entry = catalog.find((item) => item.id === slot.id);
			if (entry === undefined) {
				continue;
			}
			slot.isAvailable.set(entry.isAvailable);
			slot.subtitle.set(entry.isAvailable ? entry.subtitle : 'Coming soon');
			slot.progressLabel.set(entry.isAvailable ? `${entry.clearedLevel} / ${entry.levelCount}` : '');
		}
	}

	private applyDetail(): void {
		const model = this._model;
		if (model === undefined) {
			return;
		}
		const detail = model.getDetailView();
		this._detailTitle.set(detail.displayName);
		this._detailSubtitle.set(detail.subtitle);
		this._detailProgress.set(detail.clearedLevel > 0
			? `Cleared ${detail.clearedLevel} / ${detail.levelCount} levels`
			: `${detail.levelCount} levels  ·  No progress yet`);

		this._startLabel.set('Start');
		this._canContinue.set(detail.canContinue);
		this._continueLabel.set(detail.canContinue
			? (detail.isCompleted ? `Continue  ·  LV ${detail.continueLevel} (last)` : `Continue  ·  LV ${detail.continueLevel}`)
			: 'Continue  ·  No progress');
	}

	private applyResult(result: PuzzleUIQuestResult): void {
		const model = this._model;
		const entry = getCatalogEntry(result.puzzleId);
		this._resultTitle.set(result.isWin ? 'Clear!' : 'Failed');
		this._resultColor.set(result.isWin ? COLOR_WIN : COLOR_LOSE);
		this._hasNextLevel.set(model?.canPlayNextLevel() ?? false);

		const levelLabel = model !== undefined && model.currentLevel > 0 ? `LV ${model.currentLevel}  ·  ` : '';
		this._resultDetail.set(
			`${entry?.displayName ?? ''}  ·  ${levelLabel}Time left ${formatClockLabel(result.remainingTimeSeconds)}`);
	}

	/**
	 * 초읽기 상태를 반영한다 - 빨간 점멸 + 1초마다 소리 (worker/NextJob.md 1번).
	 *
	 * 점멸은 인터벌 하나로 하고, 소리는 **초가 바뀔 때만** 낸다. 세션이 TIME_CHANGED 를
	 * 초 단위로 스로틀하므로 여기서 초를 다시 세도 값이 튀지 않는다.
	 */
	private applyTimeCritical(isCritical: boolean, remainingSeconds: number): void {
		if (isCritical !== this._isCriticalActive) {
			this._isCriticalActive = isCritical;
			this._isTimeCritical.set(isCritical);
			if (isCritical) {
				this._lastBeepSecond = -1;
				this.startCountdownBlink();
			}
			else {
				this.stopCountdownBlink();
			}
		}
		if (isCritical === false) {
			return;
		}

		const second = Math.ceil(remainingSeconds);
		if (second === this._lastBeepSecond) {
			return;
		}
		this._lastBeepSecond = second;
		this.playCountdownSound();
	}

	private startCountdownBlink(): void {
		if (this._blinkIntervalId !== undefined) {
			return;
		}
		this._isBlinkOn.set(false);
		let isOn = false;
		this._blinkIntervalId = this.async.setInterval(() => {
			isOn = isOn === false;
			this._isBlinkOn.set(isOn);
		}, HUD_CRITICAL_BLINK_SECONDS * 1000);
	}

	private stopCountdownBlink(): void {
		if (this._blinkIntervalId !== undefined) {
			this.async.clearInterval(this._blinkIntervalId);
			this._blinkIntervalId = undefined;
		}
		// 점멸을 멈출 때는 반드시 "켜짐" 으로 되돌린다 - 꺼진 채로 멈추면 숫자가 사라진다
		this._isBlinkOn.set(true);
	}

	/** 오디오 gizmo 를 지정하지 않았으면 조용히 넘어간다 - 소리는 필수가 아니다 */
	private playCountdownSound(): void {
		const sound = this.props.countdownSound;
		if (sound === undefined || sound === null) {
			return;
		}
		sound.as(AudioGizmo).play();
	}

	/**
	 * 화면 비율로 잡은 상자에 들어갈 글자 크기를 구한다.
	 *
	 * `heightPercent` 는 그 상자가 차지하는 세로 비율(%)이다. 안전 여백을 물린 실제
	 * 픽셀 높이로 바꾸고 거기서 글자 크기를 도출한다 - 그래야 **버튼이 커지면 글자도
	 * 함께 커진다.** 고정 px 로 두면 모바일에서 버튼만 크고 글자는 작은 화면이 된다.
	 */
	private fontFor(
		heightPercent: number,
		options: { ratio?: number, minimum?: number, maximum?: number },
	): number {
		return fitFontSize(percentOf(this._usableHeight, heightPercent), {
			ratio: options.ratio,
			minimum: options.minimum,
			maximum: options.maximum,
			scale: this._profile.fontScale, pixelScale: canvasPixelScale(this._canvas.height),
		});
	}

	private showToast(message: string): void {
		this._toastText.set(message);
		this._toastVisible.set(true);
		if (this._toastTimeoutId !== undefined) {
			this.async.clearTimeout(this._toastTimeoutId);
		}
		this._toastTimeoutId = this.async.setTimeout(() => {
			this._toastVisible.set(false);
			this._toastTimeoutId = undefined;
		}, TOAST_SECONDS * 1000);
	}

	//#endregion

	//#region Screens

	/**
	 * 화면 하나가 안쪽에 물릴 안전 여백 (px).
	 *
	 * 배경은 패널 끝까지 칠하고 내용만 이만큼 들여 놓는다. 뿌리에 걸면 배경까지 들여져
	 * 가장자리로 월드가 비친다 (`initializeUI()` 주석).
	 */
	private screenPadding(): { paddingTop: number, paddingBottom: number, paddingLeft: number, paddingRight: number } {
		return {
			paddingTop: this._safeArea.top,
			paddingBottom: this._safeArea.bottom,
			paddingLeft: this._safeArea.left,
			paddingRight: this._safeArea.right,
		};
	}

	/**
	 * 캔버스 세로의 몇 % 를 픽셀로.
	 *
	 * **세로 여백은 반드시 이것을 거친다.** `marginTop: '26%'` 처럼 퍼센트로 주면 Yoga 가
	 * 그것을 *가로* 의 26% 로 계산해, 가로 화면에서 여백이 세 배 넘게 부푼다
	 * (`PuzzleUI_Layout` 머리말 §4).
	 */
	private vh(percent: number): number {
		return verticalPixels(this._canvas, percent);
	}

	/** 화면 표시 여부를 screen 바인딩에서 파생한다 */
	private visibleWhen(check: (screen: string) => boolean) {
		return this._screen.derive((screen) => (check(screen) ? 'flex' : 'none'));
	}

	/** 메인 메뉴 - 퍼즐 8종을 2열 × 4행으로 놓는다 */
	private createMainMenuScreen(): UINode {
		// 8종을 열 수로 나눈 행 수만큼 세로를 쪼갠다. 가로 화면은 4열 x 2행이라
		// 버튼이 세로로 두 배 커지고, 세로 화면은 예전 그대로 2열 x 4행이다.
		const rowCount = Math.ceil(PUZZLE_CATALOG.length / this._catalogColumns);
		// 격자 영역(82%)을 행 수로 나누고, 버튼 사이 여백(위아래 2%씩)을 뺀다
		const buttonHeightPercent = Math.max(8, Math.floor(CATALOG_GRID_HEIGHT_PERCENT / rowCount) - 4);
		const catalogButtonHeightPercent = `${buttonHeightPercent}%`;
		const buttonHeight = percentOf(this._usableHeight, buttonHeightPercent);
		const title = Text({
			text: 'Puzzle Hub',
			style: {
				color: COLOR_TEXT,
				fontSize: this.fontFor(10, { ratio: 0.32, minimum: 26, maximum: 52 }),
				fontWeight: 'bold',
				textAlign: 'center',
				width: '100%',
				height: '10%',
				marginTop: this.vh(4),
			},
		});

		const buttons: UINode[] = [];
		for (const entry of PUZZLE_CATALOG) {
			const subtitle = new Binding<string>('Coming soon');
			const progressLabel = new Binding<string>('');
			const isAvailable = new Binding<boolean>(false);
			this._catalogSlots.push({
				id: entry.id,
				subtitle: subtitle,
				progressLabel: progressLabel,
				isAvailable: isAvailable,
			});

			buttons.push(Pressable({
				children: [
					Text({
						text: entry.displayName,
						style: {
							color: COLOR_TEXT,
							// 글자가 버튼 크기를 따라간다 - 모바일에서 글자만 작게 남는 것을 없앱다
							fontSize: fitFontSize(buttonHeight, {
								ratio: 0.17, minimum: 18, maximum: 34, scale: this._profile.fontScale, pixelScale: canvasPixelScale(this._canvas.height),
							}),
							fontWeight: 'bold',
							textAlign: 'center',
							width: '100%',
						},
					}),
					Text({
						text: subtitle,
						style: {
							color: COLOR_TEXT,
							fontSize: fitFontSize(buttonHeight, {
								ratio: 0.1, minimum: 12, maximum: 20, scale: this._profile.fontScale, pixelScale: canvasPixelScale(this._canvas.height),
							}),
							textAlign: 'center',
							width: '100%',
							opacity: 0.75,
						},
					}),
					Text({
						text: progressLabel,
						style: {
							color: COLOR_TEXT,
							fontSize: fitFontSize(buttonHeight, {
								ratio: 0.09, minimum: 11, maximum: 18, scale: this._profile.fontScale, pixelScale: canvasPixelScale(this._canvas.height),
							}),
							textAlign: 'center',
							width: '100%',
							opacity: 0.6,
							marginTop: 2,
						},
					}),
				],
				style: {
					// 세로 화면 2열 x 4행 / 가로 화면 4열 x 2행.
					// 폭 = 88% / 열 수, 좌우 여백 2% 씩이 더해져 한 줄에 딱 맞는다.
					width: `${Math.floor(CATALOG_WIDTH_BUDGET_PERCENT / this._catalogColumns)}%`,
					height: catalogButtonHeightPercent,
					margin: this.vh(2),
					borderRadius: 12,
					justifyContent: 'center',
					backgroundColor: isAvailable.derive((available) => (available ? COLOR_BUTTON : COLOR_BUTTON_DIM)),
					opacity: isAvailable.derive((available) => (available ? 1 : 0.55)),
				},
				onClick: () => { this._model?.selectPuzzle(entry.id); },
			}));
		}

		const grid = View({
			children: buttons,
			style: {
				width: '92%',
				height: `${CATALOG_GRID_HEIGHT_PERCENT}%`,
				alignSelf: 'center',
				flexDirection: 'row',
				flexWrap: 'wrap',
				justifyContent: 'center',
				alignContent: 'center',
			},
		});

		return View({
			children: [title, grid],
			style: {
				width: '100%',
				height: '100%',
				position: 'absolute',
				// 배경은 패널 끝까지, 내용만 안전 영역 안으로
				...this.screenPadding(),
				backgroundColor: COLOR_BACKGROUND,
				display: this.visibleWhen((screen) => screen === EPuzzleHubScreen.MAIN_MENU),
			},
		});
	}

	/**
	 * 퍼즐 상세 - 고른 퍼즐이 화면을 꽉 채우고 Start / Continue / Return 을 세로로 놓는다.
	 * 세 버튼의 폭·높이·간격을 같게 두어 엄지로 잘못 누르는 일을 줄인다 (PUZ_00 §8).
	 */
	private createDetailScreen(): UINode {
		const title = Text({
			text: this._detailTitle,
			style: {
				color: COLOR_TEXT,
				fontSize: this.fontFor(10, { ratio: 0.36, minimum: 28, maximum: 54 }),
				fontWeight: 'bold',
				textAlign: 'center',
				width: '100%',
				marginTop: this.vh(12),
			},
		});
		const subtitle = Text({
			text: this._detailSubtitle,
			style: {
				color: COLOR_TEXT,
				fontSize: this.fontFor(5, { ratio: 0.32, minimum: 14, maximum: 26 }),
				textAlign: 'center',
				width: '100%',
				opacity: 0.8,
				marginTop: this.vh(2),
			},
		});
		const progress = Text({
			text: this._detailProgress,
			style: {
				color: COLOR_TEXT,
				fontSize: this.fontFor(4, { ratio: 0.32, minimum: 12, maximum: 22 }),
				textAlign: 'center',
				width: '100%',
				opacity: 0.65,
				marginTop: this.vh(2),
			},
		});

		const buttons = View({
			children: [
				this.createDetailButton(this._startLabel, COLOR_BUTTON, undefined, () => {
					this._model?.startNewGame();
				}),
				this.createDetailButton(this._continueLabel, COLOR_CONTINUE, this._canContinue, () => {
					if (this._model?.continueGame() === false) {
						this.showToast('No saved progress yet. Use Start to begin.');
					}
				}),
				this.createDetailButton(new Binding<string>('Return'), COLOR_BUTTON_DIM, undefined, () => {
					this._model?.returnToMenu();
				}),
			],
			style: {
				width: '100%',
				marginTop: this.vh(10),
				// 세로 배치 - 세 버튼이 위에서 아래로 쌓인다
				flexDirection: 'column',
				alignItems: 'center',
			},
		});

		return View({
			children: [title, subtitle, progress, buttons],
			style: {
				width: '100%',
				height: '100%',
				position: 'absolute',
				...this.screenPadding(),
				backgroundColor: COLOR_BACKGROUND,
				display: this.visibleWhen((screen) => screen === EPuzzleHubScreen.PUZZLE_DETAIL),
			},
		});
	}

	/**
	 * 상세 화면의 버튼 하나.
	 * `isEnabled` 를 주면 꺼졌을 때 어둡게 그린다 (Continue 의 "기록 없음" 상태).
	 */
	private createDetailButton(
		label: Binding<string>,
		color: Color,
		isEnabled: Binding<boolean> | undefined,
		onClick: () => void,
	): UINode {
		const height = Math.max(11, this._profile.minButtonHeightPercent);
		return Pressable({
			children: [
				Text({
					text: label,
					style: {
						color: COLOR_TEXT,
						fontSize: this.fontFor(height, { ratio: 0.34, minimum: 18, maximum: 40 }),
						fontWeight: 'bold',
						textAlign: 'center',
						width: '100%',
					},
				}),
			],
			style: {
				width: '64%',
				height: `${height}%`,
				marginBottom: this.vh(4),
				borderRadius: 14,
				justifyContent: 'center',
				backgroundColor: isEnabled === undefined
					? color
					: isEnabled.derive((enabled) => (enabled ? color : COLOR_BUTTON_DIM)),
				opacity: isEnabled === undefined
					? 1
					: isEnabled.derive((enabled) => (enabled ? 1 : 0.5)),
			},
			onClick: onClick,
		});
	}

	/**
	 * 인게임에서는 상단 바만 그린다 - 보드와 손가락을 가리지 않는다 (PUZ_00 §8.5).
	 *
	 *   좌측 레벨 · 중앙 남은 초 · 우측 일시정지
	 *
	 * 좌우 블록의 폭을 같게(`22%`) 잡아 가운데 숫자가 **화면 정중앙**에 오게 한다.
	 * 라운드 표시는 레벨 밑에 작게 붙인다 - 한 판짜리 레벨에서는 빈 문자열이라 보이지 않는다.
	 */
	private createHudBar(): UINode {
		const levelBlock = View({
			children: [
				Text({
					text: this._hudLevel,
					style: {
						color: COLOR_TEXT,
						fontSize: this.fontFor(HUD_BAR_HEIGHT_PERCENT, { ratio: 0.36, minimum: 16, maximum: 30 }),
						fontWeight: 'bold',
						textAlign: 'left',
						width: '100%',
					},
				}),
				Text({
					text: this._hudRound,
					style: {
						color: COLOR_TEXT,
						fontSize: this.fontFor(HUD_BAR_HEIGHT_PERCENT, { ratio: 0.22, minimum: 11, maximum: 20 }),
						textAlign: 'left',
						width: '100%',
						opacity: 0.7,
					},
				}),
			],
			style: { width: '22%', justifyContent: 'center' },
		});

		// 초읽기에 들어가면 빨갛게, 그리고 opacity 를 껐다 켜며 점멸한다.
		// 글자를 지웠다 그리면 폭이 흔들리므로 투명도만 바꾼다.
		const secondsText = Text({
			text: this._hudSeconds,
			style: {
				color: this._isTimeCritical.derive((critical) => (critical ? COLOR_TIME_CRITICAL : COLOR_TEXT)),
				fontSize: this.fontFor(HUD_BAR_HEIGHT_PERCENT, { ratio: 0.6, minimum: 24, maximum: 46 }),
				fontWeight: 'bold',
				textAlign: 'center',
				flex: 1,
				opacity: this._isBlinkOn.derive((isOn) => (isOn ? 1 : 0.15)),
			},
		});

		const pauseBlock = View({
			children: [
				Pressable({
					children: [
						Text({
							text: PAUSE_BUTTON_LABEL,
							style: {
								color: COLOR_TEXT,
								fontSize: this.fontFor(HUD_BAR_HEIGHT_PERCENT, { ratio: 0.4, minimum: 16, maximum: 28 }),
								fontWeight: 'bold',
								textAlign: 'center',
								width: '100%',
							},
						}),
					],
					style: {
						// 블록(22%) 대부분을 버튼에 준다 - 라벨보다 히트 영역이 커야 엄지로 누를 수 있다
						width: '85%',
						height: '96%',
						alignSelf: 'flex-end',
						borderRadius: 10,
						justifyContent: 'center',
						backgroundColor: COLOR_PANEL,
					},
					onClick: () => { this._model?.pauseGame(); },
				}),
			],
			style: { width: '22%', justifyContent: 'center' },
		});

		return View({
			children: [levelBlock, secondsText, pauseBlock],
			style: {
				width: '94%',
				height: `${HUD_BAR_HEIGHT_PERCENT}%`,
				alignSelf: 'center',
				// 뿌리에 여백이 없으므로 안전 영역만큼 스스로 내려온다.
				// 보드 패널의 `topInsetPercent` 가 비워 둔 자리에 그대로 앉아야 한다.
				marginTop: this._safeArea.top + this.vh(2),
				position: 'absolute',
				flexDirection: 'row',
				alignItems: 'center',
				display: this.visibleWhen((screen) =>
					screen === EPuzzleHubScreen.IN_GAME || screen === EPuzzleHubScreen.PAUSED),
			},
		});
	}

	/**
	 * 시스템 메뉴 - 인게임 상단 바의 메뉴 버튼을 누르면 뜼다.
	 *
	 * **뜼는 순간 타이머가 멈춘다** - 버튼은 모델의 `pauseGame()` 을 부르고, 그것이
	 * 세션을 재우므로 남은 시간이 줄지 않는다. 보드도 함께 내려가 이 화면이 가려지지 않는다.
	 *
	 *   Resume         이 화면을 닫고 시간이 다시 흐른다
	 *   Restart Level  지금 레벨을 처음부터 다시 - **타이머도 초기화된다**
	 *   Return to Main 메인 메뉴로 돌아간다 (퍼즐은 버려진다)
	 *
	 * 세을 같은 크기로 놓고 위험도 순서대로 쌓는다 - 엄지로 잘못 누르는 일을 줄인다 (PUZ_00 §8).
	 */
	private createPausedOverlay(): UINode {
		const title = Text({
			text: 'Paused',
			style: {
				color: COLOR_TEXT,
				fontSize: this.fontFor(9, { ratio: 0.36, minimum: 24, maximum: 46 }),
				fontWeight: 'bold',
				textAlign: 'center',
				width: '100%',
				marginTop: this.vh(26),
			},
		});

		return View({
			children: [
				title,
				this.createPauseButton('Resume', COLOR_BUTTON, () => { this._model?.resumeGame(); }),
				this.createPauseButton('Restart', COLOR_CONTINUE, () => { this._model?.restartLevel(); }),
				this.createPauseButton('Return to Main', COLOR_DANGER, () => { this._model?.quitToMenu(); }),
			],
			style: {
				width: '100%',
				height: '100%',
				position: 'absolute',
				...this.screenPadding(),
				backgroundColor: new Color(0.03, 0.03, 0.05),
				opacity: 0.92,
				display: this.visibleWhen((screen) => screen === EPuzzleHubScreen.PAUSED),
			},
		});
	}

	/** 시스템 메뉴의 버튼 하나. 세을 같은 크기로 둔다 */
	private createPauseButton(label: string, color: Color, onClick: () => void): UINode {
		const height = Math.max(10, this._profile.minButtonHeightPercent);
		return Pressable({
			children: [
				Text({
					text: label,
					style: {
						color: COLOR_TEXT,
						fontSize: this.fontFor(height, { ratio: 0.32, minimum: 16, maximum: 36 }),
						fontWeight: 'bold',
						textAlign: 'center',
						width: '100%',
					},
				}),
			],
			style: {
				width: '64%',
				height: `${height}%`,
				alignSelf: 'center',
				marginTop: this.vh(5),
				borderRadius: 14,
				justifyContent: 'center',
				backgroundColor: color,
			},
			onClick: onClick,
		});
	}

	/**
	 * 결과 화면 (worker/NextJob.md 1번).
	 *
	 *   클리어 Restart / Next Level / Return to Main
	 *   실패   Restart / Return to Main
	 *
	 * `Next Level` 하나만 승패에 따라 나타났다 사라진다. 마지막 레벨을 깼을 때도 갈 곳이
	 * 없으므로 숨긴다 - 눌러도 아무 일이 없는 버튼을 남겨 두지 않는다.
	 */
	private createResultScreen(): UINode {
		const title = Text({
			text: this._resultTitle,
			style: {
				color: this._resultColor,
				fontSize: this.fontFor(10, { ratio: 0.36, minimum: 28, maximum: 54 }),
				fontWeight: 'bold',
				textAlign: 'center',
				width: '100%',
				marginTop: this.vh(24),
			},
		});

		const detail = Text({
			text: this._resultDetail,
			style: {
				color: COLOR_TEXT,
				fontSize: this.fontFor(4, { ratio: 0.34, minimum: 13, maximum: 24 }),
				textAlign: 'center',
				width: '100%',
				marginTop: this.vh(3),
				opacity: 0.85,
			},
		});

		const restartButton = this.createResultButton('Restart', COLOR_BUTTON, undefined, () => {
			this._model?.retry();
		});

		// 이겼고 다음 레벨이 남았을 때만 나온다
		const nextButton = this.createResultButton('Next Level', COLOR_CONTINUE, this._hasNextLevel, () => {
			this._model?.playNextLevel();
		});

		const menuButton = this.createResultButton('Return to Main', COLOR_BUTTON_DIM, undefined, () => {
			this._model?.quitToMenu();
		});

		return View({
			children: [title, detail, restartButton, nextButton, menuButton],
			style: {
				width: '100%',
				height: '100%',
				position: 'absolute',
				...this.screenPadding(),
				backgroundColor: new Color(0.03, 0.03, 0.05),
				opacity: 0.94,
				display: this.visibleWhen((screen) => screen === EPuzzleHubScreen.RESULT),
			},
		});
	}

	/**
	 * 결과 화면의 버튼 하나. 셋의 크기를 같게 두어 어느 것이 기본인지 헷갈리지 않게 한다.
	 * `isVisible` 을 주면 그 조건일 때만 나타난다 (Next Level).
	 */
	private createResultButton(
		label: string,
		color: Color,
		isVisible: Binding<boolean> | undefined,
		onClick: () => void,
	): UINode {
		const height = Math.max(10, this._profile.minButtonHeightPercent);
		return Pressable({
			children: [
				Text({
					text: label,
					style: {
						color: COLOR_TEXT,
						fontSize: this.fontFor(height, { ratio: 0.34, minimum: 17, maximum: 38 }),
						fontWeight: 'bold',
						textAlign: 'center',
						width: '100%',
					},
				}),
			],
			style: {
				width: '62%',
				height: `${height}%`,
				alignSelf: 'center',
				marginTop: this.vh(4),
				borderRadius: 14,
				justifyContent: 'center',
				backgroundColor: color,
				display: isVisible === undefined
					? 'flex'
					: isVisible.derive((visible) => (visible ? 'flex' : 'none')),
			},
			onClick: onClick,
		});
	}

	private createToast(): UINode {
		return View({
			children: [
				Text({
					text: this._toastText,
					style: {
						color: COLOR_TEXT,
						fontSize: this.fontFor(6, { ratio: 0.34, minimum: 13, maximum: 24 }),
						textAlign: 'center',
						width: '100%',
					},
				}),
			],
			style: {
				width: '80%',
				height: '6%',
				alignSelf: 'center',
				position: 'absolute',
				// 아래쪽 안전 영역(홈 인디케이터·Horizon 이동 버튼) 위로 띄운다
				bottom: this._safeArea.bottom + this.vh(2),
				borderRadius: 12,
				justifyContent: 'center',
				backgroundColor: COLOR_PANEL,
				opacity: 0.95,
				display: this._toastVisible.derive((visible) => (visible ? 'flex' : 'none')),
			},
		});
	}

	//#endregion
}
UIComponent.register(PuzzleUIMainPanel);
