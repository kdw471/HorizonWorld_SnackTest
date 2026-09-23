/**
 * # Focused Interaction 드래그 앤 드롭 데모 (테스트 전용)
 *
 * 공식 문서의 Focused Interaction 예제를 그대로 따라 만든 **최소 예제**다.
 * 텍스처 한 장(에디터 prop 으로 갈아 끼운다)을 입힌 오브젝트 하나를 화면에 띄우고,
 * 손가락으로 **잡아 끌어 놓은 자리로 옮긴다.**
 *
 * 이 프로젝트의 퍼즐 로직과는 아무 상관이 없다. 다른 파일을 하나도 import 하지 않으므로
 * 이 파일 하나만 지우면 흔적이 남지 않는다.
 *
 * ## 에디터에 붙이는 법
 *
 *   1. **Custom UI gizmo** 를 하나 만들고 Display Mode 를 **Screen Overlay** 로 둔다.
 *      (화면 전체를 덮어야 한다 - 아래 "좌표계" 참고)
 *   2. 이 스크립트를 그 gizmo 에 붙이고 **Execution Mode 를 Local** 로 바꾼다.
 *      Focused Interaction 과 터치 입력은 클라이언트에서만 흐른다.
 *   3. Local 스크립트는 **소유자가 지정되어야 실행된다.** 빈 엔티티에
 *      `Puzzle_LocalOwnership` 을 붙이고(Default 실행 모드) `targets` 에 이 gizmo 를 넣는다.
 *   4. `texture` prop 에 Texture 애셋(PNG 업로드본)을 끼운다. 비워 두면 단색 사각형이 된다.
 *   5. 월드를 실행하면 자동으로 Focused Interaction 모드에 들어가고(`enterFocusOnStart`),
 *      화면의 오브젝트를 끌어서 옮길 수 있다. `E`(RightGrip)/`F`(RightSecondary) 버튼으로
 *      직접 들어가고 나올 수도 있다 - 공식 문서의 예제와 같은 배치다.
 *
 * ## 좌표계 - 왜 Screen Overlay 여야 하는가
 *
 * `InteractionInfo.screenPosition` 은 **화면 전체**를 0~1 로 정규화한 값이다. 이 예제는
 * 그 값을 패널 안의 `%` 위치로 그대로 쓰기 때문에, 패널이 화면을 꽉 덮고 있어야 손가락과
 * 오브젝트가 어긋나지 않는다. 월드에 떠 있는 패널(World Space)에 쓰려면 화면 좌표 대신
 * `worldRayOrigin`/`worldRayDirection` 으로 레이캐스트를 해야 한다 - 이 예제의 범위 밖이다.
 *
 * ### 세로축 방향
 *
 * 문서에는 0~1 정규화라는 것만 있고 방향이 없다. 이 프로젝트의 기기 실험(2026-09-04)에서
 * **아래가 0** 으로 확인되었다. 그래서 기본값은 뒤집어 쓰고(`screenPositionYIsTopDown: false`),
 * 만약 드래그가 상하로 뒤집혀 보이는 기기를 만나면 이 prop 하나만 켜면 된다.
 *
 * ## 상자 위에 Pressable 을 두지 않는다 - 드래그가 도중에 죽는 원인
 *
 * 이 상자는 **손가락 바로 아래에서 계속 움직인다.** 그 자리에 `Pressable` 을 두면 두 가지가
 * 한꺼번에 문제를 일으킨다.
 *
 *   1. 손가락 아래에서 노드가 빠져나가며 누름이 취소되어, 드래그 도중에 `onRelease` 가 온다.
 *   2. Screen Overlay 의 입력 노드가 터치를 **소비**하면 그 터치의 Focused Interaction
 *      스트림이 더 이상 오지 않는다 (`Puzzle_HorizonBridge` 의 폴백 규칙이 이것 때문에 있다).
 *      스트림이 끊기면 `moved` 도 `ended` 도 오지 않아, **손은 화면에 그대로인데 상자만 멈춘다.**
 *
 * 그래서 기본값(`useItemPressable: false`)에서 상자는 그냥 `View` 이고, **잡기 판정은 스트림의
 * `started` 좌표로 직접 한다**(`hitTest`). 예전 방식과 비교하고 싶으면 `useItemPressable` 을
 * 켜면 되는데, 그때도 **뗌은 스트림만 확정한다** - `onRelease` 는 아직 시작하지 않은 눌림만
 * 정리한다.
 *
 * ## 브릿지 예산 - 스크립트와 화면 사이를 건너는 횟수를 줄인다
 *
 * 이 데모가 실기에서 **주기적으로 얼어붙었다가 순간이동하듯 따라잡던** 원인이다.
 *
 * Local 실행 모드에서 이 스크립트는 소유자의 기기에서 돌고, 패널도 같은 기기가 그린다.
 * 그래도 스크립트(JS VM)와 화면(네이티브 엔진)은 **브릿지**로 갈라져 있어서, 다음은 전부
 * 한 번씩 브릿지를 건너는 일이다:
 *
 *   - `Binding.set()` / `AnimatedBinding.set()` 한 번마다 (JS -> 네이티브)
 *   - `console.log()` 한 번마다 (JS -> 네이티브 - **디버그 로그도 공짜가 아니다**)
 *   - `World.onUpdate` 콜백 한 프레임마다 (네이티브 -> JS)
 *   - Focused Interaction `moved` 이벤트 한 프레임마다 (네이티브 -> JS, 피할 수 없다)
 *
 * 브릿지는 프레임마다 처리할 수 있는 양이 정해져 있어서, 그보다 많이 건너면 **밀렸다가
 * 한꺼번에 처리된다.** 화면에서는 상자가 멈춰 있다가 갑자기 최신 위치로 건너뛰는 것으로
 * 보인다 - 입력이 끊긴 것이 아니라 화면만 밀린 것이다.
 *
 * 그래서 이 파일은 건너는 횟수를 이렇게 줄인다:
 *
 *   1. **입력 콜백은 좌표만 고친다.** 실제로 미는 것은 `uiUpdateHz`(기본 20) 에 맞춰
 *      `flushIfDue()` 가 하고, 값이 지난번과 같으면 밀지 않는다.
 *   2. **보간은 네이티브가 한다.** 위치를 `AnimatedBinding` 으로 들고, 목표값을
 *      `Animation.timing(목표, 다음 갱신까지의 시간)` 으로 민다. 그러면 두 갱신 사이를
 *      화면 쪽이 스스로 채우므로 20Hz 로 밀어도 매 프레임 움직인다. 밀리는 구간이 생겨도
 *      진행 중이던 애니메이션이 계속 돌아 "멈춤" 이 덜 보인다.
 *   3. **`World.onUpdate` 를 쓰지 않는다.** 밀 시점은 `moved` 콜백 안에서 `Date.now()` 로
 *      가른다 - 프레임마다 건너오던 콜백 하나가 통째로 없어진다.
 *   4. **뜨거운 경로에 `console.log` 를 두지 않는다.** 놓을 때 한 줄만 남긴다.
 *
 * `smoothMotion` 을 끄면 2 번을 빼고 즉시 반영(`set(숫자)`)으로 바꿔 비교할 수 있다.
 *
 * ## 멈춤이 어디서 나는지 가르는 디버그 셋
 *
 * 인터넷을 끊어도 멈춤이 재현되어 서버는 제외되었다. 남는 후보는 기기 안의 세 곳이고,
 * 아래 두 장치의 조합으로 가른다.
 *
 *   - **네이티브 펄스** (`showNativePulse`) - 화면 위쪽의 작은 막대. `Animation.repeat` 로
 *     시작할 때 **한 번만** 밀어 두면 그 뒤로는 스크립트가 전혀 관여하지 않고 화면 쪽이
 *     혼자 왕복시킨다. 그래서 이 막대는 "네이티브 렌더 쪽이 살아 있는가" 의 지표다.
 *   - **정지 감지기** (`logStallGaps`) - 50ms 타이머 콜백 사이의 간격(`[VM]`)과 `moved`
 *     콜백 사이의 간격(`[input]`)을 재서 `stallGapMs` 를 넘을 때만 콘솔에 한 줄 남긴다.
 *     평소에는 브릿지를 건너지 않으므로 측정이 부하가 되지 않는다.
 *
 *     | 상자        | 펄스 막대 | 로그               | 결론                              |
 *     |-------------|-----------|--------------------|-----------------------------------|
 *     | 멈춤        | 멈춤      | -                  | 네이티브 렌더/Unity 메인 스레드 히칭 |
 *     | 멈춤        | 움직임    | `[VM] gap` 찍힘    | JS VM 정지 (GC 등)                |
 *     | 멈춤        | 움직임    | 조용               | Binding 갱신 큐가 밀림            |
 *     | 멈춤        | 움직임    | `[input] gap` 만   | 입력 스트림 자체가 끊김           |
 *
 * 놓을 때 남기는 한 줄에 그 드래그의 최대 간격 두 개가 함께 찍힌다.
 *
 * ### 서버로 가는가?
 *
 * `Binding.set(value, players?)` 문서는 값을 "플레이어에게 보낸다" 고 쓰여 있다 - 서버 스크립트
 * 기준의 설명이고, Local 스크립트에서 소유자 자신의 화면을 갱신하는 데 서버를 거칠 이유는
 * 없다. 다만 Local 스크립트의 Binding 값이 서버로도 복제되는지는 타입 정의만으로는 확인할
 * 수 없다. 확인하려면 에디터의 Performance 도구(Utilization / Network)에서 드래그 중 송신량이
 * 늘어나는지를 본다. 플레이어마다 자기 판만 보게 하려면 패널 엔티티에
 * `setVisibilityForPlayers([소유자], PlayerVisibilityMode.VisibleTo)` 를 걸어 다른 클라이언트가
 * 이 오버레이를 아예 그리지 않게 하는 것이 확실하다.
 */

import {
	Asset,
	ButtonIcon,
	CodeBlockEvents,
	InteractionInfo,
	Player,
	PlayerControls,
	PlayerInput,
	PlayerInputAction,
	PropTypes,
	TextureAsset,
} from 'horizon/core';
import {
	AnimatedBinding,
	Animation,
	Binding,
	Easing,
	Image,
	ImageSource,
	Pressable,
	Text,
	UIComponent,
	UINode,
	View,
} from 'horizon/ui';

//#region Constants

const COLOR_BACKDROP = '#0f1420';
const COLOR_ITEM_FALLBACK = '#3b82f6';
const COLOR_BORDER_IDLE = '#9aa7bd';
const COLOR_BORDER_HELD = '#f59e0b';
const COLOR_TEXT = '#e8ecf5';
const COLOR_BUTTON = '#3d4761';
/** 네이티브 펄스 막대와 그 홈 - 상자와 헷갈리지 않게 초록 계열 */
const COLOR_PULSE = '#34d399';
const COLOR_PULSE_TRACK = '#1f2a3a';

/** 화면 비율을 읽지 못했을 때 쓰는 값 (세로로 긴 휴대폰) */
const FALLBACK_SCREEN_ASPECT = 0.46;
/** `uiUpdateHz` 가 0(프레임마다)일 때 애니메이션 한 구간의 길이 (ms) - 한 프레임쯤 */
const FRAME_INTERVAL_MS = 16;
/** 네이티브 펄스 막대가 한쪽 끝에서 반대쪽까지 가는 시간 (ms) */
const PULSE_SWEEP_MS = 1000;
/** VM 심장박동 타이머 간격 (ms). `stallGapMs`(기본 100) 보다 충분히 짧아야 공백이 보인다 */
const STALL_TICK_MS = 50;

//#endregion

function clamp(value: number, min: number, max: number): number {
	if (isFinite(value) === false) {
		return min;
	}
	return Math.min(max, Math.max(min, value));
}

/**
 * 화면 비율(0~1)을 **0.1% 단위**로 반올림한다.
 *
 * 0.1% 는 1000px 화면에서 1px 이라 눈에 띄지 않는데, 단위를 뭉개 두면 손가락이 천천히
 * 움직일 때 같은 값이 나와 **브릿지를 건너는 일 자체가 생략된다** (`flushPosition`).
 */
function quantize(fraction: number): number {
	return Math.round(fraction * 1000) / 1000;
}

/** 이 프레임 입력 배열의 터치 번호들을 `[0,2]` 꼴로 - 공백 로그에 같이 찍는다 */
function describeIndices(list: InteractionInfo[]): string {
	if (list === undefined || list.length === 0) {
		return '[]';
	}
	const indices: number[] = [];
	for (const info of list) {
		indices.push(info.interactionIndex);
	}
	return `[${indices.join(',')}]`;
}

export class FocusDragDemoPanel extends UIComponent<typeof FocusDragDemoPanel> {
	public static propsDefinition = {
		/** 오브젝트에 입힐 그림. Texture 애셋을 끼운다. 비워 두면 단색 사각형이 된다 */
		texture: { type: PropTypes.Asset },
		/** 오브젝트 한 변 - **화면 가로 대비 %**. 정사각형이라 세로도 같은 길이다 */
		itemSizePercent: { type: PropTypes.Number, default: 18 },
		/** 처음 놓이는 자리 (화면 대비 %, 오브젝트 **중심** 기준) */
		startXPercent: { type: PropTypes.Number, default: 50 },
		startYPercent: { type: PropTypes.Number, default: 45 },
		/** 시작하자마자 Focused Interaction 모드에 들어갈지 */
		enterFocusOnStart: { type: PropTypes.Boolean, default: true },
		/** 모드 진입/해제 버튼을 화면 아래에 그릴지 */
		showFocusButton: { type: PropTypes.Boolean, default: true },
		/**
		 * 상자를 `Pressable` 로 만들지 (기본 **꺼짐**).
		 *
		 * 끄면 상자는 입력을 받지 않는 `View` 가 되고 잡기 판정은 스트림 좌표로 한다.
		 * 켜면 예전의 하이브리드(Pressable 로 잡고 스트림으로 옮기기)가 된다 - 드래그가
		 * 도중에 죽는 증상이 이것 때문인지 확인할 때 켜고 비교한다 (머리말).
		 */
		useItemPressable: { type: PropTypes.Boolean, default: false },
		/**
		 * `screenPosition.y` 가 **위가 0** 인지.
		 *
		 * 기기 실험에서는 아래가 0 이었다 (머리말). 드래그가 상하로 뒤집혀 보이면 켠다.
		 */
		screenPositionYIsTopDown: { type: PropTypes.Boolean, default: false },
		/**
		 * 오브젝트를 화면 안에 가둘지 (기본 켬).
		 *
		 * 끄면 손가락을 따라 화면 밖으로 반쯤 나갈 수 있다. **가장자리에서 상자가 멈추는 것이
		 * 답답하다면** 이것을 꺼서 clamp 때문인지 아닌지를 바로 가릴 수 있다.
		 */
		keepInsideScreen: { type: PropTypes.Boolean, default: true },
		/** 놓을 때 이 간격(%)의 격자에 맞춘다. 0 이면 손가락을 뗀 자리 그대로 */
		snapStepPercent: { type: PropTypes.Number, default: 0 },
		/** 배경을 어둡게 깔지. 끄면 월드가 그대로 비친다 */
		drawBackdrop: { type: PropTypes.Boolean, default: true },
		/**
		 * 상자 위치를 화면에 밀어 넣는 **최대 횟수** (초당). 0 이면 `moved` 가 올 때마다 민다.
		 *
		 * 입력이 오는 속도와 화면을 고치는 속도를 갈라 놓는 값이다 (머리말 "브릿지 예산").
		 * `smoothMotion` 이 켜져 있으면 두 갱신 사이를 화면 쪽이 보간하므로 20 으로도 매 프레임
		 * 움직인다. 밀리는 증상이 남으면 15 나 10 으로 내려 본다.
		 */
		uiUpdateHz: { type: PropTypes.Number, default: 20 },
		/**
		 * 갱신 사이를 **화면 쪽이 보간**할지 (기본 켬).
		 *
		 * 켜면 목표값을 `Animation.timing` 으로 밀어 다음 갱신이 올 때쯤 도착하게 한다 - 스크립트가
		 * 건너는 횟수는 그대로인데 움직임은 매 프레임 이어진다. 끄면 즉시 반영이라 `uiUpdateHz`
		 * 만큼만 뚝뚝 움직인다. 둘을 켜고 끄며 비교하면 브릿지가 병목인지 눈으로 확인할 수 있다.
		 */
		smoothMotion: { type: PropTypes.Boolean, default: true },
		/**
		 * 화면 위쪽에 **네이티브만으로 왕복하는 막대**를 띄울지 (디버그, 기본 켬).
		 *
		 * 시작할 때 `Animation.repeat` 를 한 번 밀어 두면 그 뒤로는 스크립트가 손대지 않는다.
		 * 상자가 멈추는 순간 이 막대도 같이 멈추면 네이티브 렌더 쪽이 멈춘 것이고, 막대만
		 * 계속 움직이면 스크립트와 화면 사이 어딘가가 막힌 것이다 (머리말의 표).
		 *
		 * **기본은 끔.** 끝나지 않는 커스텀 애니메이션은 UI 스레드와 메인 스레드를 어긋나게
		 * 하므로 2초 안에 끝내라는 플랫폼 한도가 있다 (`설계/Horizon_실행모드_제약과_규칙.md`
		 * §7). 정지 원인을 가를 때만 켠다.
		 */
		showNativePulse: { type: PropTypes.Boolean, default: false },
		/**
		 * 콜백 사이의 간격이 `stallGapMs` 를 넘으면 콘솔에 남길지 (디버그, 기본 켬).
		 *
		 * `[VM]` 은 50ms 타이머 콜백 사이, `[input]` 은 드래그 중 `moved` 콜백 사이의 간격이다.
		 * 넘을 때만 찍으므로 평소에는 브릿지를 건너지 않는다.
		 */
		logStallGaps: { type: PropTypes.Boolean, default: true },
		/** 이 간격(ms)을 넘는 콜백 공백만 "정지" 로 본다 */
		stallGapMs: { type: PropTypes.Number, default: 100 },
		/** 캔버스 크기 직접 지정 (px). 0 이면 플레이어 화면에서 잡는다 */
		canvasWidth: { type: PropTypes.Number, default: 0 },
		canvasHeight: { type: PropTypes.Number, default: 0 },
	};

	/**
	 * 캔버스 크기 (px). **`readonly` 가 아니다** - 플레이어 화면에 맞춰 다시 잡아야
	 * Screen Overlay 가 화면을 꽉 채운다 (`PuzzleBoardUI_Panel` 과 같은 규약).
	 */
	protected panelWidth: number = 1080;
	protected panelHeight: number = 1080;

	//#region State

	/** 화면 가로/세로 비율. 정사각형 오브젝트의 세로 크기를 화면 비율로 환산할 때 쓴다 */
	private _screenAspect: number = FALLBACK_SCREEN_ASPECT;
	private _texture: ImageSource | null = null;

	/** 오브젝트 **중심**의 화면 좌표 (0~1, 위가 0). 화면에 그리는 값의 원본이다 */
	private _centreX: number = 0.5;
	private _centreY: number = 0.5;

	/** 잡은 순간의 `중심 - 손가락`. 이 차이를 유지해야 잡은 자리 그대로 따라온다 */
	private _grabOffsetX: number = 0;
	private _grabOffsetY: number = 0;

	/**
	 * 지금 따라가고 있는 터치 번호. 드래그가 없으면 `undefined`.
	 * **0 번으로 못박지 않는다** - 잡은 터치를 끝까지 따라가야 두 번째 손가락에 흔들리지 않는다.
	 */
	private _activeIndex: number | undefined = undefined;
	/** Pressable 이 눌렀다고 알렸고, 아직 손가락 좌표를 못 받은 상태 */
	private _pressGrabPending: boolean = false;
	/** 스트림이 몰고 있는 드래그가 살아 있다 */
	private _isDragging: boolean = false;
	private _isFocusMode: boolean = false;

	/** 옮겨 놓고 아직 화면에 반영하지 않았다 */
	private _isPositionDirty: boolean = false;
	/** 마지막으로 민 시각 (ms). `uiUpdateHz` 간격을 재는 기준이다 */
	private _lastFlushMs: number = 0;
	/** 마지막으로 민 값 (왼쪽 위 모서리, 0~1). 같은 값이면 브릿지를 건너지 않는다 */
	private _lastPushedX: number = -1;
	private _lastPushedY: number = -1;

	//#endregion

	//#region 정지 감지 (디버그)

	/** 마지막 `moved` 콜백 시각 (ms). 드래그 밖에서는 0 */
	private _lastMovedMs: number = 0;
	/** 마지막 타이머 콜백 시각 (ms) */
	private _lastTickMs: number = 0;
	/** 정지 감지 타이머. `dispose()` 에서 지운다 */
	private _stallTimerId: number | undefined = undefined;
	/** 이번 드래그에서 본 최대 공백 (ms) - 놓을 때 한 줄에 같이 찍는다 */
	private _maxInputGapMs: number = 0;
	private _maxVmGapMs: number = 0;
	/**
	 * 걸러내기 **전**의 콜백 수. 공백이 났을 때 이 값이 늘었으면 "왔는데 버렸다",
	 * 그대로면 "아예 안 왔다" 다 - `[input] gap` 만으로는 둘을 구분할 수 없다.
	 */
	private _rawMovedCalls: number = 0;
	private _rawMovedAtLastAccepted: number = 0;
	/** 드래그 중에 들어온 `started`/거른 `ended` 수 - 네이티브가 터치를 새로 만들었는지 본다 */
	private _startedDuringDrag: number = 0;
	private _rejectedEndedDuringDrag: number = 0;

	//#endregion

	private _focusInput: PlayerInput | undefined = undefined;
	private _exitInput: PlayerInput | undefined = undefined;

	/**
	 * 상자의 **왼쪽 위 모서리** (화면 비율 0~1). `AnimatedBinding` 이라 목표값만 밀어 두면
	 * 화면 쪽이 스스로 보간한다. `%` 문자열로의 변환은 `interpolate` 가 화면 쪽에서 한다.
	 */
	private readonly _x = new AnimatedBinding(0);
	private readonly _y = new AnimatedBinding(0);
	private readonly _isHeld = new Binding<boolean>(false);
	/** 네이티브 펄스 막대의 위치 (0~1). 시작할 때 한 번 반복 애니메이션을 걸고 다시 건드리지 않는다 */
	private readonly _pulse = new AnimatedBinding(0);

	//#region Lifecycle

	/**
	 * 패널이 만들어지기 전에 캔버스 크기를 잡는다.
	 * `initializeUI()` 에서만 대입하면 런타임이 그보다 먼저 읽는 경우 반영되지 않는다.
	 */
	public preStart(): void {
		this.applyCanvasSize();
	}

	public initializeUI(): UINode {
		// 소유권이 넘어오지 않은 서버 인스턴스는 아무것도 그리지 않는다
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			return View({});
		}

		this.applyCanvasSize();
		this._texture = this.resolveTexture();

		const half = this.itemHalfSize();
		this._centreX = clamp(this.props.startXPercent / 100, half.x, 1 - half.x);
		this._centreY = clamp(this.props.startYPercent / 100, half.y, 1 - half.y);
		// 처음 자리는 애니메이션 없이 바로 놓는다
		this.flushPosition(true);

		return View({
			children: [
				this.createItem(),
				this.createFocusButton(),
				this.createNativePulse(),
			],
			style: {
				width: '100%',
				height: '100%',
				backgroundColor: this.props.drawBackdrop === true ? COLOR_BACKDROP : 'transparent',
			},
		});
	}

	public start(): void {
		super.start();

		// 서버 인스턴스에서는 입력도 모드 전환도 의미가 없다
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			return;
		}

		this.connectInputStream();
		this.connectFocusModeEvents();
		this.connectCustomInputButtons();
		this.startNativePulse();
		this.startStallDetector();

		if (this.props.enterFocusOnStart === true) {
			this.enterFocusMode();
		}
	}

	/**
	 * 소유권이 다른 클라이언트로 넘어가거나 플레이어가 나갈 때 런타임이 부른다
	 * (`설계/Horizon_실행모드_제약과_규칙.md` §2.1 - 그 뒤 `start()` 가 다시 불린다).
	 *
	 * `connect*` 구독과 `this.async` 타이머는 런타임이 스스로 끊지만, **커스텀 입력 버튼과
	 * Focused Interaction 모드는 끊어 주지 않는다.** 포커스 모드를 켠 채로 내려가면 플레이어가
	 * 고정 화면에 갇힌다 (`*_CoreAPI.dispose()` 가 `releaseInteraction()` 을 부르는 이유와 같다).
	 */
	public dispose(): void {
		if (this._stallTimerId !== undefined) {
			this.async.clearInterval(this._stallTimerId);
			this._stallTimerId = undefined;
		}
		if (this._focusInput !== undefined) {
			this._focusInput.disconnect();
			this._focusInput = undefined;
		}
		if (this._exitInput !== undefined) {
			this._exitInput.disconnect();
			this._exitInput = undefined;
		}
		this._pulse.stopAnimation();
		if (this._isFocusMode === true) {
			this._isFocusMode = false;
			this.exitFocusMode();
		}
	}

	//#endregion

	//#region 정지 감지 (디버그)

	/**
	 * 펄스 막대를 **한 번만** 밀어 둔다. `Animation.repeat` 라 화면 쪽이 혼자 왕복시키고,
	 * 그 뒤로 스크립트는 이 Binding 을 다시 건드리지 않는다 - 그래서 이 막대가 멈추면
	 * 스크립트가 아니라 네이티브 렌더 쪽이 멈춘 것이다 (머리말의 표).
	 */
	private startNativePulse(): void {
		if (this.props.showNativePulse !== true) {
			return;
		}
		this._pulse.set(Animation.repeat(Animation.sequence(
			Animation.timing(1, { duration: PULSE_SWEEP_MS, easing: Easing.linear }),
			Animation.timing(0, { duration: PULSE_SWEEP_MS, easing: Easing.linear }),
		)));
	}

	/**
	 * VM 심장박동. 50ms 마다 깨어나 **직전 깨어난 시각과의 간격**만 본다.
	 *
	 * JS VM 이 멈추면(GC 등) 타이머 콜백도 같이 멈췄다가 몰려서 오므로, 첫 콜백의 간격이
	 * 정지 시간만큼 커진다. 넘을 때만 로그를 남기므로 평소에는 브릿지를 건너지 않는다.
	 */
	private startStallDetector(): void {
		if (this.props.logStallGaps !== true || this._stallTimerId !== undefined) {
			return;
		}
		this._stallTimerId = this.async.setInterval(() => {
			const now = Date.now();
			if (this._lastTickMs > 0) {
				const gap = now - this._lastTickMs;
				if (gap > this.props.stallGapMs) {
					this._maxVmGapMs = Math.max(this._maxVmGapMs, gap);
					console.log(`[FocusDragDemo][VM] gap ${gap}ms${this._isDragging ? ' (드래그 중)' : ''}`);
				}
			}
			this._lastTickMs = now;
		}, STALL_TICK_MS);
	}

	/**
	 * 드래그 중 **받아들인** `moved` 콜백 사이의 공백을 잰다. `[VM]` 없이 이것만 찍히면
	 * 입력 스트림 쪽이다.
	 *
	 * 공백이 났을 때 그 사이에 **걸러내기 전 콜백**(`_rawMovedCalls`)이 몇 번 왔는지와
	 * 지금 배열의 터치 번호를 같이 찍는다. 그래야 "아예 안 왔다"(raw 0) 와 "왔는데 번호가
	 * 안 맞아 버렸다"(raw > 0) 가 갈린다.
	 */
	private noteInputGap(list: InteractionInfo[]): void {
		if (this.props.logStallGaps !== true) {
			return;
		}
		const now = Date.now();
		if (this._lastMovedMs > 0) {
			const gap = now - this._lastMovedMs;
			if (gap > this.props.stallGapMs) {
				this._maxInputGapMs = Math.max(this._maxInputGapMs, gap);
				const rawDuringGap = this._rawMovedCalls - this._rawMovedAtLastAccepted - 1;
				console.log(`[FocusDragDemo][input] gap ${gap}ms`
					+ ` /  raw moved: ${rawDuringGap}`
					+ ` / current arr: ${describeIndices(list)} (index: ${this._activeIndex})`
					+ ` / drag.started: ${this._startedDuringDrag}, skipped.ended: ${this._rejectedEndedDuringDrag}`);
			}
		}
		this._lastMovedMs = now;
		this._rawMovedAtLastAccepted = this._rawMovedCalls;
	}

	//#endregion

	//#region Focused Interaction 모드

	private enterFocusMode(): void {
		// Exit 버튼을 남겨 둔다 - 테스트 중에 손으로 빠져나올 수 있어야 한다
		this.entity.owner.get().enterFocusedInteractionMode({ disableFocusExitButton: false });
	}

	private exitFocusMode(): void {
		this.entity.owner.get().exitFocusedInteractionMode();
	}

	/**
	 * 모드 진입/해제를 확인한다.
	 *
	 * `OnPlayerExitedFocusedInteraction` 은 직접 나갈 때뿐 아니라 플레이어가 화면의 Exit
	 * 버튼을 눌렀을 때도 오므로, 잡고 있던 것을 여기서 마감해야 손을 뗀 적이 없는 채로
	 * 드래그가 남지 않는다.
	 */
	private connectFocusModeEvents(): void {
		this.connectCodeBlockEvent(
			this.entity,
			CodeBlockEvents.OnPlayerEnteredFocusedInteraction,
			(player: Player) => {
				this._isFocusMode = true;
			},
		);
		this.connectCodeBlockEvent(
			this.entity,
			CodeBlockEvents.OnPlayerExitedFocusedInteraction,
			(player: Player) => {
				this._isFocusMode = false;
				this.endDrag();
			},
		);
	}

	/** 공식 문서 예제와 같은 배치 - `E` 로 들어가고 `F` 로 나온다 */
	private connectCustomInputButtons(): void {
		this._focusInput = PlayerControls.connectLocalInput(
			PlayerInputAction.RightGrip, ButtonIcon.Interact, this);
		this._focusInput.registerCallback((action: PlayerInputAction, pressed: boolean) => {
			if (pressed === true && this._isFocusMode === false) {
				this.enterFocusMode();
			}
		});

		this._exitInput = PlayerControls.connectLocalInput(
			PlayerInputAction.RightSecondary, ButtonIcon.Drop, this);
		this._exitInput.registerCallback((action: PlayerInputAction, pressed: boolean) => {
			if (pressed === true && this._isFocusMode === true) {
				this.exitFocusMode();
			}
		});
	}

	//#endregion

	//#region 터치 스트림

	/**
	 * 터치의 세 단계를 잇는다. 세 이벤트 모두 **Focused Interaction 모드에서만** 흐른다.
	 *
	 * 배열을 통째로 넘긴다. 손가락은 최대 5 개까지 오는데, 잡은 터치가 배열의 첫 자리에
	 * 있으리라는 보장이 없기 때문이다 (`pickInteraction()`).
	 */
	private connectInputStream(): void {
		this.connectLocalBroadcastEvent(PlayerControls.onFocusedInteractionInputStarted,
			(data: { interactionInfo: InteractionInfo[] }) => this.onInputStarted(data.interactionInfo));
		this.connectLocalBroadcastEvent(PlayerControls.onFocusedInteractionInputMoved,
			(data: { interactionInfo: InteractionInfo[] }) => this.onInputMoved(data.interactionInfo));
		this.connectLocalBroadcastEvent(PlayerControls.onFocusedInteractionInputEnded,
			(data: { interactionInfo: InteractionInfo[] }) => this.onInputEnded(data.interactionInfo));
	}

	/**
	 * 이 프레임의 입력 중 **우리가 따라가는 터치**를 고른다.
	 *
	 * 드래그가 없으면 첫 번째 입력이 후보다. 드래그 중이면 잡을 때의 번호를 찾고,
	 * 없으면 **터치가 하나뿐일 때만** 그것을 이어받는다 - 번호가 재배정되어도 드래그가
	 * 끊기지 않게 하는 안전망이다. 손가락이 여럿인데 번호를 못 찾으면 남의 손가락이므로
	 * `undefined` 를 돌려 무시한다.
	 */
	private pickInteraction(list: InteractionInfo[]): InteractionInfo | undefined {
		if (list === undefined || list.length === 0) {
			return undefined;
		}
		if (this._activeIndex === undefined) {
			return list[0];
		}
		for (const info of list) {
			if (info.interactionIndex === this._activeIndex) {
				return info;
			}
		}
		if (list.length === 1) {
			this._activeIndex = list[0].interactionIndex;
			return list[0];
		}
		return undefined;
	}

	private onInputStarted(list: InteractionInfo[]): void {
		// 이미 끌고 있으면 두 번째 손가락이다 - 데모는 단일 터치만 쓴다.
		// 다만 세어 둔다 - 네이티브가 같은 손가락을 새 터치로 다시 만들었는지 공백 로그에서 본다
		if (this._isDragging === true) {
			this._startedDuringDrag++;
			return;
		}

		const info = this.pickInteraction(list);
		const point = this.toScreenPoint(info);
		if (info === undefined || point === undefined) {
			return;
		}

		// Pressable 이 먼저 "이 노드를 눌렀다" 고 알렸으면 그대로 믿고, 아니면 직접 판정한다
		if (this._pressGrabPending === false && this.hitTest(point.x, point.y) === false) {
			return;
		}

		this.beginDrag(info.interactionIndex, point.x, point.y);
	}

	private onInputMoved(list: InteractionInfo[]): void {
		// 걸러내기 전에 센다 - 공백 로그가 "안 왔다" 와 "버렸다" 를 가르는 근거다
		this._rawMovedCalls++;

		const info = this.pickInteraction(list);
		const point = this.toScreenPoint(info);
		if (info === undefined || point === undefined) {
			return;
		}

		if (this._isDragging === false) {
			// `started` 를 놓쳤는데 Pressable 이 눌림을 잡아 둔 경우 - 여기서 시작한다.
			// 기준점을 지금 좌표로 잡으므로 상자가 손가락 쪽으로 튀지 않는다.
			if (this._pressGrabPending === true) {
				this.beginDrag(info.interactionIndex, point.x, point.y);
			}
			return;
		}

		this.noteInputGap(list);
		this.moveCentreTo(point.x + this._grabOffsetX, point.y + this._grabOffsetY);
		// 밀 때가 되었을 때만 브릿지를 건넌다 - `moved` 는 프레임마다 오지만 화면 갱신은 아니다
		this.flushIfDue();
	}

	private onInputEnded(list: InteractionInfo[]): void {
		const info = this.pickInteraction(list);
		if (info === undefined) {
			// 우리 터치가 아니다 (다른 손가락이 떨어졌다) - 드래그는 그대로 이어 간다.
			// 세어 둔다 - 드래그 중에 이것이 늘면 네이티브가 다른 번호의 터치를 끝내고 있는 것이다
			if (this._isDragging === true) {
				this._rejectedEndedDuringDrag++;
			}
			return;
		}
		if (this._isDragging === false) {
			this.endDrag();
			return;
		}

		// 뗀 자리로 확정한다. 마지막 좌표를 못 읽으면 지금 자리 그대로 둔다
		const point = this.toScreenPoint(info);
		if (point !== undefined) {
			this.moveCentreTo(point.x + this._grabOffsetX, point.y + this._grabOffsetY);
		}
		this.applySnap();
		// 놓은 자리는 간격을 기다리지 않고 바로 확정한다
		this.flushPosition(true);
		this.endDrag();
		console.log(`[FocusDragDemo] dropped at ${(this._centreX * 100).toFixed(1)}%, ${(this._centreY * 100).toFixed(1)}%`
			+ ` / 최대 공백 input ${this._maxInputGapMs}ms vm ${this._maxVmGapMs}ms`
			+ ` / raw moved ${this._rawMovedCalls}회, 드래그 중 started ${this._startedDuringDrag}회, 거른 ended ${this._rejectedEndedDuringDrag}회`);
	}

	/**
	 * `InteractionInfo` 를 화면 좌표(0~1, **위가 0**)로 바꾼다. 값이 없으면 `undefined`.
	 *
	 * 어느 터치인지의 판정은 `pickInteraction()` 이 이미 끝냈다 - 여기서는 좌표만 다룬다.
	 */
	private toScreenPoint(info: InteractionInfo | undefined): { x: number, y: number } | undefined {
		if (info === undefined) {
			return undefined;
		}
		const x = info.screenPosition.x;
		const rawY = info.screenPosition.y;
		if (isFinite(x) === false || isFinite(rawY) === false) {
			return undefined;
		}
		// 기기에서는 아래가 0 이었다 (머리말) - 위가 0 인 좌표로 뒤집어 쓴다
		const y = this.props.screenPositionYIsTopDown === true ? rawY : 1 - rawY;
		return { x: x, y: y };
	}

	//#endregion

	//#region 잡기 / 옮기기

	/** Pressable 이 알려 주는 눌림. 손가락 좌표는 아직 모르고, 첫 스트림 입력이 채운다 */
	private grabFromPressable(): void {
		if (this._isDragging === true) {
			return;
		}
		this._pressGrabPending = true;
		this._isHeld.set(true);
	}

	/**
	 * Pressable 의 뗌 - **스트림이 몰고 있는 드래그는 여기서 절대 끊지 않는다** (머리말).
	 *
	 * 상자가 손가락을 따라 움직이면 손가락 아래에서 노드가 빠져나가면서 누름이 취소되고,
	 * 드래그 도중에 `onRelease` 가 튀어나온다. 그것으로 드래그를 끊으면 **손은 화면에
	 * 그대로인데 상자만 멈춘다.** 아직 스트림이 시작하지 않은 눌림만 여기서 정리한다.
	 */
	private releaseFromPressable(): void {
		if (this._isDragging === true) {
			return;
		}
		if (this._pressGrabPending === false) {
			return;
		}
		this._pressGrabPending = false;
		this._isHeld.set(false);
	}

	/** 손가락 좌표를 알았다 - 이 터치를 끝까지 따라간다 */
	private beginDrag(interactionIndex: number, pointX: number, pointY: number): void {
		this._activeIndex = interactionIndex;
		this._isDragging = true;
		this._pressGrabPending = false;
		this._grabOffsetX = this._centreX - pointX;
		this._grabOffsetY = this._centreY - pointY;
		// 공백 계측은 드래그 단위로 본다
		this._lastMovedMs = 0;
		this._maxInputGapMs = 0;
		this._maxVmGapMs = 0;
		this._rawMovedCalls = 0;
		this._rawMovedAtLastAccepted = 0;
		this._startedDuringDrag = 0;
		this._rejectedEndedDuringDrag = 0;
		this._isHeld.set(true);
	}

	/** 드래그를 닫는다. 상자는 지금 자리에 그대로 남는다 */
	private endDrag(): void {
		this._isDragging = false;
		this._pressGrabPending = false;
		this._activeIndex = undefined;
		this._isHeld.set(false);
	}

	/**
	 * 중심을 옮긴다.
	 *
	 * `keepInsideScreen` 이 켜져 있으면 오브젝트가 화면 밖으로 나가지 않게 가둔다.
	 * **가둘 때 상자는 손가락을 따라가지 못하고 멈춘다** - 정상 동작이다.
	 */
	private moveCentreTo(centreX: number, centreY: number): void {
		if (this.props.keepInsideScreen !== true) {
			this._centreX = centreX;
			this._centreY = centreY;
			this._isPositionDirty = true;
			return;
		}

		const half = this.itemHalfSize();
		this._centreX = clamp(centreX, half.x, 1 - half.x);
		this._centreY = clamp(centreY, half.y, 1 - half.y);
		this._isPositionDirty = true;
	}

	/** 놓을 때 격자에 맞춘다 (`snapStepPercent` 가 0 이면 아무 일도 하지 않는다) */
	private applySnap(): void {
		const step = this.props.snapStepPercent / 100;
		if (isFinite(step) === false || step <= 0) {
			return;
		}
		this.moveCentreTo(Math.round(this._centreX / step) * step, Math.round(this._centreY / step) * step);
	}

	/** 두 갱신 사이의 최소 간격 (ms). `uiUpdateHz` 가 0 이하면 0 - `moved` 마다 민다 */
	private flushIntervalMs(): number {
		const hz = this.props.uiUpdateHz;
		if (isFinite(hz) === false || hz <= 0) {
			return 0;
		}
		return 1000 / clamp(hz, 1, 120);
	}

	/**
	 * 간격이 지났으면 민다. `moved` 콜백이 매번 부른다.
	 *
	 * `World.onUpdate` 대신 여기서 시각을 재는 이유는 머리말 "브릿지 예산" 3 번이다 -
	 * 프레임마다 건너오던 콜백 하나를 없앤다. 손가락이 멈춰 있는 동안은 `moved` 가 와도
	 * 값이 같아 어차피 밀지 않고, 놓을 때는 `onInputEnded` 가 바로 확정한다.
	 */
	private flushIfDue(): void {
		if (this._isPositionDirty === false) {
			return;
		}
		if (Date.now() - this._lastFlushMs < this.flushIntervalMs()) {
			return;
		}
		this.flushPosition(false);
	}

	/**
	 * 상자 위치를 화면에 민다 - **이 파일에서 브릿지를 건너는 유일한 위치 갱신**이다.
	 *
	 * `left`/`top` 은 왼쪽 위 모서리 기준이므로 중심에서 반 칸을 뺀다. 값이 지난번과 같으면
	 * 건너지 않는다.
	 *
	 * `smoothMotion` 이 켜져 있으면 `Animation.timing(목표, 간격)` 으로 민다. 다음 갱신이 올 때쯤
	 * 목표에 도착하도록 길이를 맞춰 두면, 20Hz 로 밀어도 화면 쪽이 매 프레임 사이를 채운다.
	 *
	 * @param force 처음 자리와 놓은 자리처럼 간격·중복 검사 없이 **즉시** 놓아야 하는 경우
	 */
	private flushPosition(force: boolean): void {
		if (force === false && this._isPositionDirty === false) {
			return;
		}

		const half = this.itemHalfSize();
		const x = quantize(this._centreX - half.x);
		const y = quantize(this._centreY - half.y);
		this._isPositionDirty = false;
		if (force === false && x === this._lastPushedX && y === this._lastPushedY) {
			return;
		}

		const intervalMs = this.flushIntervalMs();
		if (this.props.smoothMotion === true && force === false) {
			const config = {
				duration: intervalMs > 0 ? intervalMs : FRAME_INTERVAL_MS,
				easing: Easing.linear,
			};
			this._x.set(Animation.timing(x, config));
			this._y.set(Animation.timing(y, config));
		}
		else {
			this._x.set(x);
			this._y.set(y);
		}

		this._lastPushedX = x;
		this._lastPushedY = y;
		this._lastFlushMs = Date.now();
	}

	/**
	 * 오브젝트 절반 크기를 **화면 비율**로.
	 *
	 * 가로는 prop 그대로지만, 세로는 같은 픽셀 길이라도 화면 비율이 다르다
	 * (정사각형이므로 `세로 화면비율 = 가로 화면비율 x (화면 가로 / 화면 세로)`).
	 * 이 값 하나로 그리기(`flushPosition`)와 판정(`hitTest`)을 모두 맞춘다.
	 */
	private itemHalfSize(): { x: number, y: number } {
		const halfWidth = clamp(this.props.itemSizePercent, 2, 90) / 200;
		return { x: halfWidth, y: halfWidth * this._screenAspect };
	}

	/** 이 화면 좌표가 오브젝트 안인지 */
	private hitTest(pointX: number, pointY: number): boolean {
		const half = this.itemHalfSize();
		return Math.abs(pointX - this._centreX) <= half.x
			&& Math.abs(pointY - this._centreY) <= half.y;
	}

	//#endregion

	//#region 화면

	/**
	 * 끌고 다니는 상자.
	 *
	 * 기본값에서는 **입력을 받지 않는 `View`** 다 - 손가락 아래에 입력 노드가 있으면 그 터치의
	 * 스트림이 끊길 수 있기 때문이다 (머리말). `useItemPressable` 을 켜면 예전처럼 Pressable 로
	 * 잡되, 뗌은 여전히 스트림만 확정한다.
	 *
	 * `left`/`top` 은 0~1 인 `AnimatedBinding` 을 `interpolate` 로 `'0%'`~`'100%'` 에 물린 것이다 -
	 * 숫자 -> 문자열 변환까지 화면 쪽에서 하므로 스크립트는 숫자 하나만 민다.
	 */
	private createItem(): UINode {
		const sizePercent = clamp(this.props.itemSizePercent, 2, 90);
		const style = {
			position: 'absolute' as const,
			left: this._x.interpolate([0, 1], ['0%', '100%']),
			top: this._y.interpolate([0, 1], ['0%', '100%']),
			width: `${sizePercent}%`,
			// 정사각형은 `aspectRatio` 로 만든다 - 화면 비율과 무관하게 정사각형이 된다
			aspectRatio: 1,
			borderRadius: 12,
			borderWidth: this._isHeld.derive((held: boolean) => (held === true ? 4 : 2)),
			borderColor: this._isHeld.derive((held: boolean) => (held === true ? COLOR_BORDER_HELD : COLOR_BORDER_IDLE)),
			// 텍스처가 없으면 단색으로라도 보이게 한다 - prop 을 비운 채로도 테스트가 된다
			backgroundColor: this._texture === null ? COLOR_ITEM_FALLBACK : 'transparent',
		};
		const picture = Image({
			source: this._texture,
			style: { width: '100%', height: '100%', resizeMode: 'contain' },
		});

		if (this.props.useItemPressable !== true) {
			return View({ children: [picture], style: style });
		}
		return Pressable({
			onPress: () => this.grabFromPressable(),
			onRelease: () => this.releaseFromPressable(),
			children: [picture],
			style: style,
		});
	}

	/**
	 * 네이티브 펄스 막대 - 화면 위쪽 왼쪽에서 홈 안을 왕복한다.
	 *
	 * 위치는 `_pulse`(0~1) 를 `interpolate` 로 홈 폭에 물린 것이라, 시작할 때 걸어 둔
	 * 반복 애니메이션이 화면 쪽에서 혼자 돈다. 상자가 멈추는 순간 **이 막대를 본다**.
	 */
	private createNativePulse(): UINode {
		if (this.props.showNativePulse !== true) {
			return View({});
		}
		return View({
			children: [
				View({
					style: {
						position: 'absolute',
						left: this._pulse.interpolate([0, 1], ['0%', '85%']),
						top: 0,
						width: '15%',
						height: '100%',
						borderRadius: 6,
						backgroundColor: COLOR_PULSE,
					},
				}),
			],
			style: {
				position: 'absolute',
				left: '4%',
				top: '3%',
				width: '40%',
				height: '2%',
				borderRadius: 6,
				backgroundColor: COLOR_PULSE_TRACK,
			},
		});
	}

	private createFocusButton(): UINode {
		if (this.props.showFocusButton !== true) {
			return View({});
		}
		return Pressable({
			onClick: () => {
				if (this._isFocusMode === true) {
					this.exitFocusMode();
				}
				else {
					this.enterFocusMode();
				}
			},
			children: [
				Text({
					text: 'Focus 모드 토글',
					style: { color: COLOR_TEXT, fontSize: 18 },
				}),
			],
			style: {
				position: 'absolute',
				left: '30%',
				bottom: '5%',
				width: '40%',
				height: '6%',
				alignItems: 'center',
				justifyContent: 'center',
				borderRadius: 10,
				backgroundColor: COLOR_BUTTON,
			},
		});
	}

	//#endregion

	//#region 설정 읽기

	/**
	 * 캔버스 크기와 화면 비율을 잡는다.
	 *
	 * `screenWidth/screenHeight` 읽기값의 **절대 크기는 믿을 수 없고 비율만 믿을 수 있다**
	 * (이 프로젝트의 실기 측정, `PuzzleUI_RelativeLayout` 머리말). 그래서 배치는 전부 `%` 로
	 * 하고, 읽기값에서는 비율만 뽑아 정사각형 판정에 쓴다.
	 */
	private applyCanvasSize(): void {
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			return;
		}

		let width = this.props.canvasWidth;
		let height = this.props.canvasHeight;
		if (isFinite(width) === false || isFinite(height) === false || width <= 0 || height <= 0) {
			const player = this.entity.owner.get();
			width = player.screenWidth.get();
			height = player.screenHeight.get();
		}
		if (isFinite(width) === false || isFinite(height) === false || width <= 0 || height <= 0) {
			return;
		}

		this._screenAspect = clamp(width / height, 0.2, 5);
		// Screen Overlay 는 짧은 변 기준의 정사각 캔버스에 그린다 (`PuzzleUI_Layout.resolveCanvas`)
		const side = Math.round(clamp(Math.min(width, height), 240, 2048));
		this.panelWidth = side;
		this.panelHeight = side;
	}

	/** prop 에 끼운 애셋을 그림으로. 비어 있으면 `null` - `Image` 가 아무것도 그리지 않는다 */
	private resolveTexture(): ImageSource | null {
		const asset: Asset | undefined | null = this.props.texture;
		if (asset === undefined || asset === null) {
			return null;
		}
		return ImageSource.fromTextureAsset(asset.as(TextureAsset));
	}

	//#endregion
}
UIComponent.register(FocusDragDemoPanel);
