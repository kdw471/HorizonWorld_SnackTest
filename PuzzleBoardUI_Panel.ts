/**
 * Puzzle Board UI Panel - 퍼즐 보드를 Custom UI 로 그리는 표현 계층
 *
 * **3D 키 캡/타일을 대체한다.** 8개 퍼즐이 전부 2D 격자이므로 월드에 오브젝트를 두는 대신
 * 여기서 격자를 직접 그린다 (`Documents/생성 문서/설계/2026-09-02_멀티플레이_플랫폼에서_싱글플레이_구현_방안.md` §3.2).
 *
 * 이렇게 바꾸면 멀티플레이의 세 가지 장벽이 한꺼번에 사라진다.
 *   - Local 소유 Custom UI 는 그 플레이어에게만 렌더된다 -> `setVisibilityForPlayers` 가 필요 없다
 *   - 복제할 3D 엔티티가 없다 -> 플레이어별 리그가 엔티티 2~3개로 끝난다
 *   - `position`/`visible`/`tintColor` 네트워크 동기화가 사라진다 -> 남의 화면이 같이 바뀌지 않는다
 *
 * ## 화면 구성 - **퍼센트와 flex 뿐, 픽셀은 없다**
 *
 *      ┌──────────────────────────────┐
 *      │  topInsetPercent (비워 둔다)   │  ← 상태바·노치·호라이즌 버튼 자리 + 퍼즐 제목
 *      │ ┌──────────────────────────┐ │
 *      │ │      보드 (정사각형)       │ │  flex: 7   `aspectRatio:1` + `maxWidth`
 *      │ │   그 안에 정사각 칸 격자    │ │            격자 상자는 판 대비 %
 *      │ └──────────────────────────┘ │
 *      │ ┌──────────────────────────┐ │
 *      │ │ < 트레이 > · 미니격자 · Reset │ │  flex: 3   (보조 레이아웃)
 *      │ └──────────────────────────┘ │
 *      │  bottomInsetPercent + [Menu]  │  ← 홈 인디케이터 자리 + 일시정지 버튼
 *      └──────────────────────────────┘
 *
 * 참고 구현은 `Documents/SampleHtml/index.html` 이다. CSS 의 `flex: 7 / 3`,
 * `aspect-ratio: 1`, `repeat(N, 1fr)` 가 그대로 옮겨져 있다.
 *
 * **이 구조로 전면 개편한 이유**는 2026-09-03 실기 측정이다. 화면에서 읽은 픽셀
 * (`screenWidth/Height`)과 패널이 실제로 그려지는 좌표계의 **단위가 달랐고**, 그래서 픽셀로
 * 계산한 판이 화면의 40% 밖에 쓰지 못했다. 같은 측정에서 퍼센트와 flex 는 전부 정확했다.
 * 자세한 내용과 판정 근거는 `PuzzleUI_RelativeLayout` 머리말에 있다.
 *
 * 판은 **정사각형**이다. 그 안에서 격자 상자만 판의 비율(4행 8열이면 100%x50%)을 가지므로,
 * 판 모양과 무관하게 **칸은 언제나 정사각형**이다 (`computeGridBox`). 트레이의 부품은
 * 트레이 높이를 꽉 채우고, 한 줄에 다 들어가지 않으면 좌우 화살표로 넘겨 본다 -
 * 크기를 줄이면 부품이 손가락보다 작아져 집을 수가 없다.
 *
 * 보조 레이아웃에 들어가는 셋은 이렇다.
 *   - **오브젝트 트레이** 판으로 끌어다 쓰는 오브젝트 (레이저의 미배치 크리스탈). 누를 수 있다
 *   - **정보 미니 격자** 푸는 데 필요한 정보 (스위치의 동시 눌림 영역). 표시 전용이다
 *   - **리셋 버튼**      판을 풀기 전 상태로 되돌린다. **남은 시간은 되돌리지 않는다**
 *
 * 레벨이 시작되면 보조 레이아웃 자리에 `GameStart` 배너가 `introSeconds` 동안 떴다가
 * `introFadeSeconds` 동안 **페이드 아웃**되고, 완전히 사라진 뒤에 보조 레이아웃이 나타난다.
 * 배너가 떠 있는 동안에는 **보드 입력도 막힌다** - 게이트는 프레젠터에 있고
 * (`PuzzleBoardPresenter.canAcceptInput()`), 여는 시점은 여기의 타이머가 `endIntro()` 로
 * 정한다. 배너를 켜는 것은 각 `*_CoreAPI` 다 (`presenter.beginIntro()`).
 *
 * ## 붙이는 법
 *
 *   1. Custom UI gizmo 를 만들고 이 스크립트를 붙인다.
 *      - 화면에 겹쳐 띄우려면 Display Mode = **Screen Overlay**
 *      - 월드에 판이 서 있게 하려면 Display Mode = **Spatial(World Space)**
 *   2. 실행 모드를 **Local** 로 두고 `Puzzle_LocalOwnership` 의 targets 에 이 엔티티를 넣는다.
 *      소유권이 넘어오지 않으면 서버 인스턴스는 빈 화면만 그린다.
 *   3. 같은 클라이언트의 `*_CoreAPI` 가 `PuzzleBoardStage.instance.mount()` 를 부르면
 *      그 보드가 여기에 나타난다. 패널 쪽에 퍼즐별 설정은 없다.
 *
 * ## 이 파일이 맡는 것과 맡지 않는 것
 *
 * 화면 조각은 저마다 자기 파일에 있고, 이 파일은 **틀과 배선**만 맡는다.
 *
 *   `PuzzleBoardUI_Grid`   본 격자              - 8개 퍼즐이 전부 쓴다
 *   `PuzzleBoardUI_Tray`   오브젝트 트레이       - 규격에 `itemCount` 를 적은 퍼즐만
 *   `PuzzleBoardUI_Side`   정보 미니 격자        - 규격에 `side` 를 적은 퍼즐만
 *   `PuzzleBoardUI_Parts`  셋이 나눠 쓰는 어휘    - 색·조작 강조·칸 위에 겹치는 층들
 *
 * 셋은 **자기 상태(Binding)를 스스로 들고** 있고, 패널은 프레젠터에게서 받은 스냅샷을
 * 그쪽으로 넘겨 주기만 한다 (`applyView()`). 그래서 터치만 하는 퍼즐을 좇아 읽는 사람이
 * 트레이의 페이지 계산을 지나쳐 갈 일이 없다.
 *
 * **선택 조각은 선언한 퍼즐만 마운트한다.** 트레이·미니 격자·액션 버튼은 `display: none`
 * 이 아니라 `UINode.if` 로 가른다 - 숨긴 노드는 그려지지만 않을 뿐 트리에 남아 Binding 을
 * 들고 있기 때문이다 (`createAuxContent()`).
 *
 * ## 왜 격자를 `DynamicList` 로 그리는가 - **패널 크기 한도 64kB**
 *
 * `initializeUI()` 가 돌려주는 트리는 통째로 직렬화되어 패널에 실리고, 그 크기가 64kB 를
 * 넘으면 컴포넌트가 **아예 만들어지지 않는다**
 * (`Failed to instantiate ... The UI (86236B) exceeds the maximum allowed size of 64kB`).
 *
 * 예전에는 최대 격자(9×9)의 칸 81개를 여기서 전부 만들어 두고 격자 밖은 `display: none` 으로
 * 숨겼다. 칸 하나의 트리(누름 껍데기·얼굴·글자·무늬·테두리·고리)가 81벌 복제되어 86kB 가
 * 되었고 그래서 한도를 넘었다. 지금은 `DynamicList` 가 `renderItem` 을 런타임에 부르므로
 * **트리에는 템플릿 한 벌만** 실린다 (자세한 내용은 `PuzzleBoardUI_Grid` 머리말).
 *
 * 그 때문에 **UI 트리의 자리(슬롯)와 퍼즐의 칸 번호가 다르다.**
 *
 *   슬롯 번호 = row * PUZZLE_BOARD_MAX_COLS + col      (고정 9열 기준, Binding 배열의 색인)
 *   칸  번호 = row * 현재 colCount        + col        (퍼즐 로직이 쓰는 row-major)
 *
 * 둘을 오가는 곳이 이 파일이다 - 렌더러는 슬롯 번호만, 프레젠터는 칸 번호만 쓴다
 * (`applyGridCell()` / `applyPress()` / `toCellIndex()`).
 */

import { Color, PropTypes } from 'horizon/core';
import { AnimatedBinding, Animation, Binding, Easing, Pressable, Text, UIComponent, UINode, View } from 'horizon/ui';
import {
	PuzzleBoardRelativeLayout,
	auxAreaFraction,
	percentText,
	resolveRelativeLayout,
} from 'PuzzleUI_RelativeLayout';
import { createLayoutProbe } from 'PuzzleUI_LayoutProbe';
import { SubscriptionBag } from 'Utility_Events';
import {
	BOARD_COLOR_BACKGROUND,
	PUZZLE_BOARD_MAX_COLS,
	PUZZLE_BOARD_MENU_LABEL,
	PUZZLE_BOARD_RESET_LABEL,
	PuzzleBoardView,
} from 'PuzzleBoardUI_Definitions';
import {
	EUIDeviceClass,
	PUZZLE_UI_CANVAS_HEIGHT,
	PUZZLE_UI_CANVAS_WIDTH,
	PuzzleUICanvas,
	PuzzleUILayoutProfile,
	canvasPixelScale,
	clampNumber,
	fitFontSize,
	getDefaultCanvas,
	getLayoutProfile,
	makeCanvas,
	resolveCanvas,
	toUIDeviceClass,
} from 'PuzzleUI_Layout';
import {
	PuzzleBoardCellChange,
	PuzzleBoardItemChange,
	PuzzleBoardPressHighlight,
	PuzzleBoardPresenter,
	PuzzleBoardStage,
} from 'PuzzleBoardUI_Presenter';
import { PuzzleTextureLibrary } from 'PuzzleBoardUI_TextureLibrary';
import {
	BoardMetrics,
	COLOR_RESET_BUTTON,
	COLOR_TEXT,
	NO_PRESSED_SLOT,
	toColor,
} from 'PuzzleBoardUI_Parts';
import { BoardGridRenderer } from 'PuzzleBoardUI_Grid';
import { BoardTrayRenderer } from 'PuzzleBoardUI_Tray';
import { BoardSideRenderer } from 'PuzzleBoardUI_Side';

//#region Style constants

/**
 * 화면 전체의 바탕.
 *
 * 칸·슬롯의 색과 조작 강조 규칙, 그 위에 겹쳐 놓는 층들은 전부
 * `PuzzleBoardUI_Parts` 에 있다 - 격자와 트레이가 같은 규칙을 나눠 쓰기 때문이다.
 */
const COLOR_PANEL_BACKGROUND = toColor(BOARD_COLOR_BACKGROUND);
/** 보조 레이아웃의 바탕 - 본 격자와 구분되도록 한 단계 밝다 */
const COLOR_AUX_BACKGROUND = new Color(0.11, 0.12, 0.17);

/**
 * `screenPixelRatio` 의 기본값 - 실기 측정값(1179 / 590 = 2) 이다.
 *
 * **prop 기본값과 반드시 같아야 한다.** 필드 초기화 시점에는 `this.props` 가 아직 없어서
 * prop 을 읽을 수 없기 때문에, 그때는 이 상수가 대신 쓰인다 (`_pixelRatio` 주석).
 */
const DEFAULT_SCREEN_PIXEL_RATIO = 2;

/**
 * 보조 레이아웃 안쪽의 비율 - 전부 **자기 부모 대비 %** 다.
 *
 * 픽셀이 하나도 없으므로 어느 기기에서든 같은 모양으로 그려진다. 예전에는 이 값들이
 * 픽셀이었고, 그 픽셀이 화면에 몇 배로 그려지는지 알 수 없어
 * 트레이와 리셋 버튼이 화면 절반 크기로 나왔다.
 */
const AUX_AREA_WIDTH_PERCENT = '94%';
/** 리셋 버튼이 보조 레이아웃에서 쓰는 가로 %와 세로 비율 */
const RESET_WIDTH_PERCENT = '20%';
const RESET_HEIGHT_USAGE = 0.7;

/**
 * 화면 아래 오른쪽에 떠 있는 Menu(일시정지) 버튼.
 *
 * 격자 위에 겹쳐 그리므로 **판보다 확실히 밝게** 잡는다 - 어느 퍼즐의 어떤 색 칸 위에
 * 올라가도 버튼으로 읽혀야 한다.
 */
const COLOR_MENU_BUTTON = new Color(0.24, 0.27, 0.36);
/** 격자를 조금이라도 덜 가리려고 살짝 비친다. 글자는 그대로 읽힌다 */
const MENU_BUTTON_OPACITY = 0.92;
/** Menu 버튼의 세로 크기 (아래 여백 띠 대비 %) 와 알약 모양의 가로 배수 */
const MENU_BUTTON_HEIGHT_PERCENT = '72%';
const MENU_BUTTON_WIDTH_RATIO = 2.6;

//#endregion

export class PuzzleBoardUIPanel extends UIComponent<typeof PuzzleBoardUIPanel> {
	public static propsDefinition = {
		/**
		 * 보드 제목 줄을 그릴지.
		 *
		 * 기본은 꺼짐이다. 메인 UI 의 HUD 가 이미 좌측 상단에 레벨을, 중앙에 남은 초를
		 * 표시하므로 제목까지 그리면 위쪽이 세 줄이 된다.
		 */
		showTitle: { type: PropTypes.Boolean, default: false },
		/**
		 * 화면 **위**에 비워 둘 세로 % - 상태바·노치와 호라이즌 자체 버튼(`...`/`≡`) 자리다.
		 *
		 * 이 패널은 화면 전체를 덮고 **상태바 뒤까지 그려진다** (실기 스크린샷으로 확인).
		 * 여백을 두지 않으면 판의 첫 줄이 시계와 노치에 가린다. 퍼즐 제목도 이 자리에 앉는다.
		 */
		topInsetPercent: { type: PropTypes.Number, default: 6 },
		/**
		 * 화면 **아래**에 비워 둘 세로 % - `Menu` 버튼 띠와 홈 인디케이터 자리다.
		 *
		 * 위아래 여백을 뺀 나머지가 **7:3** 으로 갈려 본 격자 영역과 보조 레이아웃이 된다.
		 * 그 7:3 은 기획이 정한 화면 구성이라 prop 으로 열지 않는다.
		 */
		bottomInsetPercent: { type: PropTypes.Number, default: 8 },
		/**
		 * 보드 정사각형이 쓰는 **가로 %** - 나머지가 좌우 여백으로 반씩 나뉜다.
		 *
		 * 96 이면 좌우에 각각 2% 가 남는다. 세로로 긴 화면에서는 이 값이 판 크기를 정하고,
		 * 가로로 긴 화면에서는 아래 `boardHeightPercent` 가 정한다 - 둘 중 작은 쪽이
		 * 자동으로 이긴다 (`aspectRatio` + `maxWidth`, `PuzzleUI_RelativeLayout` 머리말 §1).
		 */
		boardWidthPercent: { type: PropTypes.Number, default: 96 },
		/**
		 * 보드 정사각형이 **본 격자 영역의 세로**에서 쓰는 %.
		 *
		 * 남는 세로가 보조 레이아웃과의 틈이 된다. 100 으로 두면 판이 트레이에 바로 붙는다.
		 */
		boardHeightPercent: { type: PropTypes.Number, default: 94 },
		/**
		 * `screenWidth/Height` 읽기값을 **패널 좌표 단위**로 옮기는 배율.
		 *
		 * 실기 측정(`showLayoutProbe` 의 `D` 상자)에서 패널 좌표 1 단위가 디바이스 실픽셀
		 * 1 이었고, 읽기값은 긴 변을 1280 으로 정규화한 값이었다 - 1179x2556 폰이
		 * 590x1280 으로 읽혔으므로 배율이 2 다.
		 *
		 * **배치는 이 값을 쓰지 않는다.** `fontSize`/`borderWidth`/`borderRadius` 처럼
		 * `horizon/ui` 에 상대 단위가 없는 곳에만 쓴다. 그래서 이 값이 틀린 기기에서도
		 * 판과 트레이는 정확히 그려지고 글자만 조금 크거나 작아진다.
		 *
		 * 재는 법: 스크린샷의 실제 가로 픽셀 ÷ 로그의 `screen` 가로.
		 */
		screenPixelRatio: { type: PropTypes.Number, default: 2 },
		/** 칸 사이 간격 (%) */
		cellGapPercent: { type: PropTypes.Number, default: 1.2 },
		/**
		 * `GameStart` 배너가 **완전히 보이는 채로** 떠 있는 시간 (초).
		 *
		 * 이 시간이 지나면 `introFadeSeconds` 동안 페이드 아웃되고, 완전히 사라진 뒤에야
		 * 보조 레이아웃이 나타난다. **보드 입력은 페이드가 시작될 때 이미 열린다**
		 * (`startIntroFade()` -> `unlockIntroInput()`). 그래서 이 값이 곧 입력 잠금 시간이다 -
		 * 반응성 우선으로 짧게 둔다.
		 */
		introSeconds: { type: PropTypes.Number, default: 0.45 },
		/** 배너가 페이드 아웃되는 시간 (초). 0 이면 즉시 사라진다. 입력은 페이드 중에도 열려 있다 */
		introFadeSeconds: { type: PropTypes.Number, default: 0.3 },
		/** 보드가 없을 때도 배경을 그릴지. 기본은 꺼서 퍼즐 밖에서는 투명해진다 */
		drawBackgroundWhenEmpty: { type: PropTypes.Boolean, default: false },
		/**
		 * 텍스처에 칸 색을 입힐지 (기본 꺼짐).
		 *
		 * 켜면 그림의 밝기를 유지한 채 `fill` 색으로 물들인다. **회색조 한 장으로 여러 상태를
		 * 표현할 때** 쓴다 - 스위치 키 캡 그림 하나로 눌림(초록)과 안 눌림(빨강)을 모두 그리는 식이다.
		 * 이미 색이 칠해진 그림을 쓸 거면 꺼 둔다.
		 */
		tintTexturesWithFill: { type: PropTypes.Boolean, default: false },

		/**
		 * 캔버스 크기를 직접 못박는다 (px). 둘 다 0 이면 화면 비율에서 자동으로 잡는다.
		 *
		 * `player.screenWidth/screenHeight` 가 실제 화면과 다르게 오는 기기를 만났을 때의
		 * 탈출구다. **보드 패널과 허브 패널에 같은 값을 넣어야 한다** - 다르면 같은 `%` 가
		 * 서로 다른 픽셀이 되어 HUD 바가 보드 위로 파고든다.
		 */
		canvasWidth: { type: PropTypes.Number, default: 0 },
		canvasHeight: { type: PropTypes.Number, default: 0 },

		/**
		 * 레이아웃 실측값을 화면 왼쪽 아래에 띄운다 (디버그).
		 *
		 * `screenWidth/Height` 원본 읽기값 · 캔버스 크기 · 격자 칸 크기가 그대로 나온다.
		 * 실기에서 "UI 가 화면 일부만 쓴다 / 크기가 이상하다" 가 보이면 이것을 켜고
		 * 스크린샷을 찍으면 원인을 바로 좁힐 수 있다. 콘솔 로그와 같은 값이다.
		 */
		showLayoutDebug: { type: PropTypes.Boolean, default: false },
		/**
		 * 레이아웃 프로브만 그린다 (디버그). 게임 화면은 뜨지 않는다.
		 *
		 * 상대 배치(`%`/`flex`/`aspectRatio`)가 실기에서 어떻게 그려지는지를 스크린샷 한 장으로
		 * 재는 화면이다. 배치를 상대 배치로 다시 짜기 전에 그 전제를 확정하려고 만들었다 -
		 * 읽는 법은 `PuzzleUI_LayoutProbe` 머리말의 표에 있다.
		 *
		 * 입력을 받는 노드가 없으므로 켠 채로는 퍼즐을 할 수 없다. 재고 나면 다시 끈다.
		 */
		showLayoutProbe: { type: PropTypes.Boolean, default: false },
		/**
		 * 오브젝트 트레이의 상태를 진단한다 (디버그) - "부품이 안 보인다" 전용.
		 *
		 * 켜면 두 가지가 함께 나온다.
		 *   - 슬롯마다 **형광 테두리 상자**와 `번호+상태`(`0V` / `3.`)가 그려진다.
		 *     상자는 보이는데 그 안이 비었으면 **내용이 생성되지 않은 것**이고,
		 *     상자 자체가 안 보이면 **접혔거나 크기가 0 인 것**이다 (`BoardTrayRenderer`).
		 *   - 화면 아래 진단 줄과 콘솔에 `tray items=.. vis=.. page=.. slots=VVV____` 가
		 *     나온다. 읽는 법은 `BoardTrayRenderer.describeDebug()` 의 표에 있다.
		 *
		 * 이 값이 켜져 있으면 `showLayoutDebug` 가 꺼져 있어도 진단 줄은 뜬다.
		 */
		showTrayDebug: { type: PropTypes.Boolean, default: false },
	};

	/**
	 * Custom UI gizmo 의 패널 크기 (px). 초기화 뒤에는 바꿀 수 없다.
	 *
	 * 메인 UI 와 **같은 캔버스**를 쓴다 (`PuzzleUI_Layout`). 두 패널이 다른 캔버스를 쓰면
	 * 같은 `%` 가 서로 다른 픽셀이 되어 HUD 바와 보드 여백이 어긋난다.
	 */
	/**
	 * 캔버스 크기 (px).
	 *
	 * **`readonly` 가 아니다.** `initializeUI()` 에서 플레이어의 실제 화면 비율에 맞춰
	 * 다시 잡는다 - 그래야 Screen Overlay 가 화면을 꽉 채우고 옆으로 월드가 새지 않는다
	 * (`PuzzleUI_Layout.resolveCanvas()`). 초기값은 화면 크기를 읽지 못할 때의 기본값이다.
	 */
	protected panelWidth: number = PUZZLE_UI_CANVAS_WIDTH;
	protected panelHeight: number = PUZZLE_UI_CANVAS_HEIGHT;

	/** 이 플레이어의 캔버스. `resolveLayout()` 에서 한 번 정하고 바뀌지 않는다 */
	private _canvas: PuzzleUICanvas = getDefaultCanvas();

	/**
	 * 화면 세로를 **패널 좌표 단위**로 나타낸 값.
	 *
	 * 실기 측정에서 좌표 1 단위가 디바이스 실픽셀 1 이었고, `screenHeight` 읽기값은 긴 변을
	 * 1280 으로 정규화한 값이었다 (`PuzzleUI_RelativeLayout` 머리말). 그 차이를 메우는 것이
	 * `screenPixelRatio` prop 이다. **배치는 이 값을 쓰지 않는다** - 글자·테두리처럼
	 * `horizon/ui` 에 상대 단위가 없는 곳에만 쓴다.
	 */
	private get screenUnitsHeight(): number {
		const reading = this._rawScreenHeight > 0 ? this._rawScreenHeight : this._canvas.height;
		return Math.max(1, reading * this._pixelRatio);
	}

	/**
	 * `screenPixelRatio` prop 을 담아 두는 자리. `resolveLayout()` 에서 채운다.
	 *
	 * **여기서 `this.props` 를 직접 읽으면 안 된다.** 클래스 필드 초기화 시점에는
	 * `this.props` 가 아직 undefined 라 컴포넌트가 **아예 만들어지지 않는다**
	 * (`Failed to instantiate ... Cannot read properties of undefined`).
	 * 그래서 값을 필드에 담아 두고, 기본값은 상수에서 가져온다.
	 *
	 * 같은 함정이 `Binding.derive()` 에도 있다 - 파생 함수를 그 자리에서 한 번 부르므로,
	 * 아직 대입되지 않은 것을 그 안에서 건드리면 같은 오류가 난다
	 * (`BoardGridRenderer._cellFontSize` 가 생성자에서 만들어지는 이유다).
	 */
	private _pixelRatio: number = DEFAULT_SCREEN_PIXEL_RATIO;

	/**
	 * 기준 캔버스(세로 1180) 픽셀로 튜닝한 상수를 좌표 단위로 환산하는 배율.
	 * 글자 한계·테두리 두께처럼 해상도와 무관해야 하는 값에 곱한다.
	 */
	private get pxScale(): number {
		return canvasPixelScale(this.screenUnitsHeight);
	}

	/** 화면 세로 대비 비율을 좌표 단위로 - 글자 크기의 기준을 상대 배치에서 뽑을 때 쓴다 */
	private units(fractionOfScreenHeight: number): number {
		return Math.max(1, Math.round(fractionOfScreenHeight * this.screenUnitsHeight));
	}

	/** 보조 레이아웃의 높이 (좌표 단위) - 그 안의 글자 크기가 여기서 나온다 */
	private get auxHeightUnits(): number {
		return this.units(auxAreaFraction(this._layout));
	}

	/** 기준 캔버스 픽셀 값을 실제 캔버스 픽셀로 (최소 1px) */
	private px(referencePixels: number): number {
		return Math.max(1, Math.round(referencePixels * this.pxScale));
	}

	/** 강조 테두리 두께를 실제 캔버스 픽셀로 - 0(테두리 없음)은 0 그대로 둔다 */
	private scaleBorderWidth(referenceWidth: number): number {
		return referenceWidth <= 0 ? 0 : this.px(referenceWidth);
	}
	/** 이 플레이어의 기기 규격. `initializeUI()` 에서 한 번 정하고 바뀌지 않는다 */
	private _profile: PuzzleUILayoutProfile = getLayoutProfile(EUIDeviceClass.DESKTOP);

	/**
	 * 확정한 상대 배치 - **여백 %와 7:3 분할뿐이고 픽셀은 하나도 없다**
	 * (`PuzzleUI_RelativeLayout`).
	 */
	private _layout: PuzzleBoardRelativeLayout = resolveRelativeLayout();

	/**
	 * 화면 가로/세로 비율.
	 *
	 * 읽기값의 **단위는 믿을 수 없지만 비율은 믿을 수 있다** (머리말). 글자 크기를 뽑을 때
	 * "보드 정사각형이 화면의 몇 % 인가" 를 계산하는 데만 쓴다.
	 */
	private _screenAspect: number = 1;

	/** `screenWidth/Height` 원본 읽기값 - 디버그 표시용. 캔버스 계산 전에 담아 둔다 */
	private _rawScreenWidth: number = 0;
	private _rawScreenHeight: number = 0;

	/** 화면에 띄우는 레이아웃 실측값 (`showLayoutDebug`) - 콘솔 로그와 같은 내용이다 */
	private readonly _layoutDebug: Binding<string> = new Binding<string>('');

	/** 디버그 문자열을 다시 만든다. 화면에 그대로 나가는 값이므로 영어다 */
	private updateLayoutDebug(): void {
		this._layoutDebug.set(
			`screen ${Math.round(this._rawScreenWidth)}x${Math.round(this._rawScreenHeight)}`
			+ ` ar ${Math.round(this._screenAspect * 100) / 100}`
			+ ` ${this._canvas.isLandscape ? 'landscape' : 'portrait'} ${this._profile.deviceClass}`
			+ ` | inset ${Math.round(this._layout.topInsetPercent)}/${Math.round(this._layout.bottomInsetPercent)}`
			+ ` | flex ${this._layout.boardFlex}:${this._layout.auxFlex}`
			+ ` | board ${this._layout.boardWidthPercent}%x${this._layout.boardHeightPercent}%`
			+ ` | grid ${this._grid?.gridBoxLabel ?? '-'}`
			+ ` | units ${Math.round(this.screenUnitsHeight)} cell ${this._grid?.cellSideUnits ?? 0}`
			// 트레이 진단은 켰을 때만 붙인다 - 평소에는 줄이 길어질 뿐이다
			+ (this.props?.showTrayDebug === true ? ` | ${this._tray?.describeDebug() ?? 'tray -'}` : ''));
	}

	private readonly _stageSubscriptions: SubscriptionBag = new SubscriptionBag();
	private _presenterSubscriptions: SubscriptionBag = new SubscriptionBag();
	private _presenter: PuzzleBoardPresenter | undefined = undefined;

	/** 배너를 내리는 예약. 새 레벨이 겹쳐 들어오면 앞의 예약을 버린다 */
	private _introTimeoutId: number | undefined = undefined;

	//#region Bindings

	/**
	 * 화면 조각들이 나눠 갖는 상태.
	 *
	 * **격자·트레이·미니 격자의 Binding 은 여기 없다.** 셋은 각자 자기 파일에서 자기
	 * 상태를 들고 있고(`BoardGridRenderer` / `BoardTrayRenderer` / `BoardSideRenderer`),
	 * 패널은 프레젠터에게서 받은 것을 그쪽으로 넘기기만 한다. 여기 남은 것은 **셋 중
	 * 어느 것에도 속하지 않는** 화면 전체의 상태다 - 보드가 올라와 있는지, 제목, 배너,
	 * 액션 버튼, 그리고 텍스처 등록 세대.
	 */
	private readonly _hasBoard: Binding<boolean> = new Binding<boolean>(false);
	private readonly _title: Binding<string> = new Binding<string>('');

	/** 보조 레이아웃의 셋 중 무엇을 마운트할지 - 퍼즐이 규격에 적은 것만 켜진다 */
	private readonly _hasSide: Binding<boolean> = new Binding<boolean>(false);
	private readonly _hasItems: Binding<boolean> = new Binding<boolean>(false);
	private readonly _hasAction: Binding<boolean> = new Binding<boolean>(false);
	/**
	 * 보조 레이아웃의 큰 액션 버튼 라벨 (`PuzzleBoardLayoutSpec.actionLabel`).
	 * 색 채우기의 STOP 처럼 "타이밍에 맞춰 한 번" 이 조작의 전부인 퍼즐이 쓴다.
	 * `onPress`(누르는 순간)로 연결해 릴리즈를 기다리지 않는다.
	 */
	private readonly _actionLabel: Binding<string> = new Binding<string>('');

	/**
	 * 텍스처 등록이 바뀐 횟수.
	 *
	 * 그림과 글자 판정이 "칸 스냅샷 + 이 값" 에서 파생한다. 칸이 그대로여도 이 값이
	 * 바뀌면 다시 계산되므로, **CoreAPI 가 패널보다 늦게 에셋을 등록해도** 그림이 붙는다.
	 * 칸 내용을 건드리지 않으므로 드래그 중에 끼어들어도 안전하다.
	 * 렌더러들은 `BoardMetrics.textureEpoch` 로 이 Binding 을 받아 쓴다.
	 */
	private readonly _textureEpoch: Binding<number> = new Binding<number>(0);
	private _textureEpochValue: number = 0;

	/** 배너가 떠 있는 동안 보조 레이아웃은 그리지 않는다 */
	private readonly _isIntroVisible: Binding<boolean> = new Binding<boolean>(false);
	private readonly _introText: Binding<string> = new Binding<string>('');
	/** 배너의 페이드 아웃용 불투명도 - 1 로 떠서 `introFadeSeconds` 동안 0 으로 잦아든다 */
	private readonly _introOpacity: AnimatedBinding = new AnimatedBinding(1);

	//#endregion

	//#region Renderers (화면 조각들)

	/**
	 * 화면 조각 셋. **`initializeUI()` 에서 한 번 만든다** - 생성자에서 `this.props`
	 * (칸 간격)를 읽어야 하는데 클래스 필드 초기화 시점에는 아직 props 가 없기 때문이다
	 * (`_pixelRatio` 주석과 같은 함정).
	 *
	 * 서버 인스턴스는 트리를 만들지 않으므로 셋 다 `undefined` 로 남는다 - 그래서
	 * 접근은 전부 `?.` 다.
	 */
	private _grid: BoardGridRenderer | undefined = undefined;
	private _tray: BoardTrayRenderer | undefined = undefined;
	private _side: BoardSideRenderer | undefined = undefined;

	/**
	 * 렌더러들에게 넘기는 환산기 묶음.
	 *
	 * **값이 아니라 함수로 넘긴다.** 배율과 배치는 `resolveLayout()` 이 정하고, 글자 크기는
	 * 런타임 파생 안에서도 다시 계산되므로 복사해 두면 낡는다 (`BoardMetrics` 주석).
	 */
	private createMetrics(): BoardMetrics {
		return {
			px: (referencePixels: number) => this.px(referencePixels),
			units: (fraction: number) => this.units(fraction),
			scaleBorderWidth: (referenceWidth: number) => this.scaleBorderWidth(referenceWidth),
			auxHeightUnits: () => this.auxHeightUnits,
			pixelScale: () => this.pxScale,
			fontScale: () => this._profile.fontScale,
			layout: () => this._layout,
			screenAspect: () => this._screenAspect,
			textureEpoch: this._textureEpoch,
			tintTexturesWithFill: () => this.props.tintTexturesWithFill === true,
		};
	}

	//#endregion

	/**
	 * 지금 격자의 실제 크기. Binding 은 읽을 수 없으므로 평범한 필드로도 들고 있는다.
	 * 슬롯 <-> 칸 번호 변환과 입력 판정에 쓴다.
	 */
	private _gridRowCount: number = 0;
	private _gridColCount: number = 0;

	//#region Lifecycle

	public initializeUI(): UINode {
		// 소유권이 넘어오지 않은 서버 인스턴스는 아무것도 그리지 않는다
		// (PuzzleUI_MainPanel 과 같은 규약 - `Documents/생성 문서/가이드/에디터_퍼즐_셋업.md` §1.2)
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			return View({});
		}

		this.resolveLayout();

		// 프로브 모드에서는 이 화면만 그린다 - 게임 노드가 섞이면 측정이 흐려진다.
		// `resolveLayout()` 뒤에 두어 실측값 한 줄(`_layoutDebug`)을 같이 띄운다:
		// 스크린샷 하나에 "코드가 믿는 숫자" 와 "실제로 그려진 모습" 이 함께 담겨야 대조가 된다.
		if (this.props.showLayoutProbe === true) {
			return createLayoutProbe(this._layoutDebug);
		}

		// **화면 조각 셋을 여기서 만든다.** 생성자가 `this.props` 를 읽으므로 필드
		// 초기화가 아니라 이 시점이어야 한다 (`_grid` 주석). 셋은 자기 상태를 스스로 들고
		// 있고, 패널은 프레젠터에게서 받은 것을 넘겨 주기만 한다.
		const metrics = this.createMetrics();
		const grid = new BoardGridRenderer(metrics, {
			onCellPress: (row, col) => this.onCellPress(row, col),
			onCellEnter: (row, col) => this.onCellEnter(row, col),
			onCellExit: (row, col) => this.onCellExit(row, col),
			onCellRelease: () => this.onCellRelease(),
		}, this.props.cellGapPercent);
		const tray = new BoardTrayRenderer(metrics, {
			onItemDown: (index) => { this._presenter?.itemDown(index); },
			// 슬롯에서 뗀 것은 마감만, 화살표에서 뗀 것은 판 밖으로 확정한다
			// (`BoardTrayHandlers` 주석 - 둘을 같게 두면 칸 위에서 뗀 부품이 인벤토리로 돌아간다)
			onSlotRelease: () => this.onCellRelease(),
			onArrowRelease: () => this.onAuxAreaRelease(),
		}, this.props.showTrayDebug === true);
		const side = new BoardSideRenderer(metrics);
		this._grid = grid;
		this._tray = tray;
		this._side = side;

		// **세로 흐름 하나가 화면 전부다** - 참고 구현(`Documents/SampleHtml/index.html`)의
		// `#app-container` 와 같은 구조다. 절대 배치는 화면 전체를 덮는 뗌 마감 레이어와
		// 칸 위에 겹쳐 그리는 층들에만 남는다.
		const root = View({
			children: [
				this.createReleaseCatcher(),
				this.createTopInset(),
				this.createBoardArea(grid),
				this.createAuxArea(tray, side),
				this.createBottomInset(),
				this.createLayoutDebug(),
			],
			style: {
				width: '100%',
				height: '100%',
				flexDirection: 'column',
				// **여백(padding)을 주지 않는다.** 위아래 여백은 흐름 안의 상자
				// (`createTopInset`/`createBottomInset`)가 자기 몫으로 가진다 - 그래야
				// 7:3 분할이 그 여백을 뺀 나머지에서 정확히 갈린다.
				backgroundColor: COLOR_PANEL_BACKGROUND,
				opacity: this._hasBoard.derive((hasBoard) =>
					(hasBoard === true || this.props.drawBackgroundWhenEmpty === true ? 1 : 0)),
			},
		});

		this.connectStage();
		return root;
	}

	/**
	 * 캔버스 크기를 패널에 반영한다.
	 *
	 * **`preStart()` 에서 한 번, `initializeUI()` 에서 한 번** 부른다. 런타임이
	 * `panelWidth`/`panelHeight` 를 언제 읽는지 문서에 없어서, 둘 중 어느 쪽이 먼저 와도
	 * 크기가 잡히도록 양쪽에 건다. 같은 값을 두 번 넣는 것이라 부작용이 없다.
	 *
	 * **이 값이 좌표계를 정하지는 않는다.** 2026-09-03 측정에서 `panelHeight` 를 1280 에서
	 * 590 으로 바꿔도 화면에 그려지는 크기가 그대로였다 (`PuzzleUI_RelativeLayout` 머리말).
	 * 그래서 배치는 이 값에 기대지 않는다 - 여기서 잡는 캔버스는 기기 판정(`isLandscape`)과
	 * 허브 패널과의 규약을 위해 남아 있다.
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
			// 원본 읽기값을 그대로 담아 둔다 - 디버그 표시(`createLayoutDebug`)가 이 값을 보여 준다
			this._rawScreenWidth = player.screenWidth.get();
			this._rawScreenHeight = player.screenHeight.get();
			this._canvas = resolveCanvas(this._rawScreenWidth, this._rawScreenHeight);
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

	/**
	 * 이 플레이어의 배치를 확정한다.
	 *
	 * **픽셀을 계산하지 않는다.** 화면에서 읽는 것은 기기 종류와 **가로/세로 비율**뿐이고,
	 * 나머지는 전부 퍼센트와 flex 다 (`PuzzleUI_RelativeLayout` 머리말). 예전에는 여기서
	 * 격자 한 변까지 픽셀로 확정했는데, 그 픽셀이 화면에 몇 배로 그려지는지를 알 수 없어
	 * 판이 화면의 40% 밖에 쓰지 못했다.
	 */
	private resolveLayout(): void {
		const player = this.entity.owner.get();
		this._profile = getLayoutProfile(toUIDeviceClass(String(player.deviceType.get())));

		// 캔버스는 기기 판정(`isLandscape`)과 허브 패널과의 규약을 위해 그대로 잡는다.
		// 배치에는 쓰지 않는다 - 여기서 나오는 픽셀이 화면 픽셀과 다르다는 것이 이번 측정의 결론이다.
		this.applyCanvasSize();
		this._screenAspect = this._rawScreenHeight > 0
			? this._rawScreenWidth / this._rawScreenHeight
			: this._canvas.width / Math.max(1, this._canvas.fullHeight);

		// 글자·테두리 환산 배율을 먼저 받아 둔다 (`_pixelRatio` 주석 - 여기서만 prop 을 읽는다)
		this._pixelRatio = clampNumber(this.props.screenPixelRatio, 0.25, 8);

		this._layout = resolveRelativeLayout({
			topInsetPercent: this.props.topInsetPercent,
			bottomInsetPercent: this.props.bottomInsetPercent,
			boardWidthPercent: this.props.boardWidthPercent,
			boardHeightPercent: this.props.boardHeightPercent,
		});

		// 확정한 배치를 스테이지에 실어 둔다 - 드래그 스트림(제안 1)이 화면 좌표를 격자
		// 좌표로 바꿀 때 **패널이 실제로 그린 값**을 그대로 쓰게 하기 위해서다.
		PuzzleBoardStage.instance.setScreenGeometry({
			layout: this._layout,
			screenAspect: this._screenAspect,
		});

		console.log(`[PuzzleBoardUIPanel] Layout for ${this._profile.deviceClass}: `
			+ `screen reads ${Math.round(this._rawScreenWidth)}x${Math.round(this._rawScreenHeight)}, `
			+ `aspect ${Math.round(this._screenAspect * 100) / 100} `
			+ `(${this._canvas.isLandscape ? 'landscape' : 'portrait'}), `
			+ `insets ${Math.round(this._layout.topInsetPercent)}%/${Math.round(this._layout.bottomInsetPercent)}%, `
			+ `board ${this._layout.boardFlex}:${this._layout.auxFlex} split, `
			+ `square ${this._layout.boardWidthPercent}% wide.`);
		this.updateLayoutDebug();
	}

	public dispose(): void {
		this.clearIntroTimeout();
		this.detachPresenter();
		this._stageSubscriptions.disconnect();
	}

	//#endregion

	//#region Stage wiring

	private connectStage(): void {
		const stage = PuzzleBoardStage.instance;
		this._stageSubscriptions.addRange(
			stage.MOUNTED.subscribe((presenter) => this.attachPresenter(presenter)),
			stage.UNMOUNTED.subscribe(() => this.detachPresenter()),
			// 에셋 등록은 CoreAPI 의 start() 에서 오므로 이 패널보다 늦을 수 있다.
			// 세대만 올려 주면 이미 그려진 칸들의 그림이 다시 계산된다.
			PuzzleTextureLibrary.instance.CHANGED.subscribe(() => this.bumpTextureEpoch()),
		);

		// CoreAPI 가 이 패널보다 먼저 mount() 를 불렀을 수 있다 (등록 순서는 보장되지 않는다)
		const current = stage.current;
		if (current !== undefined) {
			this.attachPresenter(current);
		}
	}

	private attachPresenter(presenter: PuzzleBoardPresenter): void {
		this.detachPresenter();
		this._presenter = presenter;
		this._presenterSubscriptions = new SubscriptionBag(
			presenter.LAYOUT_CHANGED.subscribe((view) => this.applyView(view)),
			presenter.CELL_CHANGED.subscribe((change) => this.applyGridCell(change)),
			presenter.SIDE_CELL_CHANGED.subscribe((change) => this.applySideCell(change)),
			presenter.ITEM_CHANGED.subscribe((change) => this.applyItem(change)),
			presenter.INTRO_CHANGED.subscribe((intro) => this.applyIntro(intro.isVisible, intro.text)),
			presenter.PRESS_CHANGED.subscribe((press) => this.applyPress(press)),
		);
		this.applyView(presenter.getView());
		this.applyPress(presenter.getPressHighlight());
		const intro = presenter.getIntro();
		this.applyIntro(intro.isVisible, intro.text);
		this._hasBoard.set(true);
	}

	private detachPresenter(): void {
		if (this._presenter === undefined) {
			return;
		}
		this.clearIntroTimeout();
		this._presenterSubscriptions.disconnect();
		this._presenter = undefined;
		this._gridRowCount = 0;
		this._gridColCount = 0;
		this._hasBoard.set(false);
		this._hasSide.set(false);
		this._hasItems.set(false);
		this._hasAction.set(false);
		this._actionLabel.set('');
		this._introOpacity.stopAnimation();
		this._isIntroVisible.set(false);
		// 화면 조각들은 각자 자기 상태를 되돌린다
		this._grid?.reset();
		this._tray?.reset();
		this._side?.reset();
	}

	//#endregion

	//#region View application

	/**
	 * 보드 전체를 다시 반영한다 (레벨 로드 / 퍼즐 전환).
	 *
	 * **패널은 규격을 해석하고 나눠 주기만 한다.** 격자·트레이·미니 격자를 어떻게 그릴지는
	 * 각 렌더러가 안다. 여기서 정하는 것은 셋 중 무엇을 마운트할지(`_hasItems` 등)와,
	 * 어느 것에도 속하지 않는 제목·액션 버튼이다.
	 */
	private applyView(view: PuzzleBoardView): void {
		this._gridRowCount = view.grid.rowCount;
		this._gridColCount = view.grid.colCount;

		this._title.set(view.title);
		this._actionLabel.set(view.actionLabel);
		this._hasAction.set(view.actionLabel !== '');
		this._hasSide.set(view.side !== undefined);
		this._hasItems.set(view.items.length > 0);

		this._grid?.applyView(
			view.grid, view.boardTexture, view.liftGrabbedPiece, view.grabLiftCellRatio);
		this._side?.applyView(view.side);
		this._tray?.applyView(view.items);
		this.updateLayoutDebug();
	}

	private applyGridCell(change: PuzzleBoardCellChange): void {
		if (this._gridColCount <= 0) {
			return;
		}
		// 퍼즐의 칸 번호(현재 열 수 기준)를 UI 트리의 자리 번호(고정 9열 기준)로 바꾼다
		const row = Math.floor(change.index / this._gridColCount);
		const col = change.index % this._gridColCount;
		this._grid?.applyCell(row * PUZZLE_BOARD_MAX_COLS + col, change.cell);
	}

	private applySideCell(change: PuzzleBoardCellChange): void {
		this._side?.applyCell(change.index, change.cell);
	}

	private applyItem(change: PuzzleBoardItemChange): void {
		this._tray?.applyItem(change.index, change.item);
		// 진단 줄은 레벨 로드에서만 갱신되므로, 슬롯이 바뀔 때도 따라오게 한다
		if (this.props.showTrayDebug === true) {
			this.updateLayoutDebug();
		}
	}

	/**
	 * 짚고 있는 자리를 옮긴다.
	 *
	 * 칸 번호(현재 열 수 기준)를 슬롯 번호(고정 9열 기준)로 바꿔 둔다 - 트리의 자리와
	 * 퍼즐의 칸 번호가 다르기 때문이다 (파일 첫머리 주석 참고).
	 */
	private applyPress(press: PuzzleBoardPressHighlight): void {
		this._tray?.setPressed(press.item);

		if (press.cell < 0 || this._gridColCount <= 0) {
			this._grid?.setPressed(NO_PRESSED_SLOT);
			return;
		}
		const row = Math.floor(press.cell / this._gridColCount);
		const col = press.cell % this._gridColCount;
		this._grid?.setPressed(row * PUZZLE_BOARD_MAX_COLS + col);
	}

	/**
	 * 배너를 켜고 끈다.
	 *
	 * 켜질 때 두 단계 예약을 건다: `introSeconds` 동안 완전히 보였다가,
	 * `introFadeSeconds` 동안 페이드 아웃되고, **다 잦아든 뒤에** `endIntro()` 를 부른다.
	 * 그 `endIntro()` 가 보조 레이아웃을 띄우는 동시에 보드 입력을 여는 시점이다
	 * (프레젠터가 배너가 떠 있는 동안 모든 누름을 거른다 - `canAcceptInput()`).
	 * 순수 계층에 타이머를 두지 않고 여기서만 시간을 다룬다.
	 *
	 * `endIntro()` 를 애니메이션 완료 콜백이 아니라 타이머로 부르는 이유: 콜백은 중간에
	 * 끊긴 애니메이션에서도 오므로, 그때 내리면 새로 뜬 배너가 같이 내려간다. 타이머는
	 * 새 배너가 뜰 때 `clearIntroTimeout()` 으로 확실히 버려진다.
	 */
	private applyIntro(isVisible: boolean, text: string): void {
		this._introText.set(text);
		this._isIntroVisible.set(isVisible);

		this.clearIntroTimeout();
		this._introOpacity.stopAnimation();
		if (isVisible === false) {
			return;
		}
		this._introOpacity.set(1);
		const holdSeconds = this.props.introSeconds > 0 ? this.props.introSeconds : 0;
		this._introTimeoutId = this.async.setTimeout(() => this.startIntroFade(), holdSeconds * 1000);
	}

	/**
	 * 배너의 페이드 아웃을 시작하고, 다 잦아드는 시점에 내리는 예약을 건다.
	 *
	 * **입력은 여기서 먼저 연다.** 배너는 보조 레이아웃 자리에 떠서 판을 가리지 않으므로,
	 * 잦아드는 것까지 기다리게 하면 그 시간만큼 레벨 시작 후 첫 터치가 삼켜진다.
	 */
	private startIntroFade(): void {
		this._presenter?.unlockIntroInput();
		const fadeSeconds = this.props.introFadeSeconds > 0 ? this.props.introFadeSeconds : 0;
		if (fadeSeconds > 0) {
			this._introOpacity.set(Animation.timing(0, {
				duration: fadeSeconds * 1000,
				easing: Easing.out(Easing.quad),
			}));
		}
		this._introTimeoutId = this.async.setTimeout(() => {
			this._introTimeoutId = undefined;
			this._presenter?.endIntro();
		}, fadeSeconds * 1000);
	}

	private clearIntroTimeout(): void {
		if (this._introTimeoutId === undefined) {
			return;
		}
		this.async.clearTimeout(this._introTimeoutId);
		this._introTimeoutId = undefined;
	}

	//#endregion

	//#region Input (Pressable -> Presenter)

	/** 슬롯 좌표를 퍼즐의 칸 번호로. 격자 밖이면 undefined */
	private toCellIndex(row: number, col: number): number | undefined {
		if (row >= this._gridRowCount || col >= this._gridColCount) {
			return undefined;
		}
		return row * this._gridColCount + col;
	}

	private onCellPress(row: number, col: number): void {
		const cell = this.toCellIndex(row, col);
		if (cell === undefined) {
			return;
		}
		this._presenter?.pointerDown(cell);
	}

	private onCellEnter(row: number, col: number): void {
		const cell = this.toCellIndex(row, col);
		if (cell === undefined) {
			return;
		}
		this._presenter?.pointerEnter(cell);
	}

	private onCellExit(row: number, col: number): void {
		const cell = this.toCellIndex(row, col);
		if (cell === undefined) {
			return;
		}
		// 칸 번호를 넘기는 이유는 PuzzleBoardPresenter.pointerExit() 주석 참고 (enter/exit 순서 무보장)
		this._presenter?.pointerExit(cell);
	}

	private onCellRelease(): void {
		this._presenter?.pointerUp();
	}

	/**
	 * 격자를 담은 상자에서 손을 뗐다 - **칸이 받지 못한 뗌**을 여기서 마감한다.
	 *
	 * 판을 벗어났다고 단정하지 않는다. `Pressable` 이 칸 위에서 뗀 것을 부모로 올려 보내는
	 * 경우가 있어서, 여기서 "밖" 으로 단정하면 **칸 위에서 뗐는데 조각이 제자리로 돌아간다.**
	 * 프레젠터가 마지막으로 올라가 있던 칸에 놓아 주므로 그대로 마감만 한다.
	 *
	 * 격자와 이 상자 사이의 여백에서 뗀 경우에는 마지막으로 지나온 칸에 놓이는데, 그 편이
	 * 아무 데도 놓이지 않는 것보다 낫다 (worker/NextJob.md 2번).
	 */
	private onBoardAreaRelease(): void {
		this._presenter?.pointerUp();
	}

	/**
	 * 보조 레이아웃에서 손을 뗐다 - 여기는 **판이 아닌 것이 확실하다.**
	 *
	 * 트레이에서 꺼낸 크리스탈을 도로 트레이 쪽에 떨어뜨리는 경우가 그것이다.
	 * 판 밖에 놓은 것으로 확정해야 세션이 인벤토리로 되돌린다 (PUZ_01 §3 3.3).
	 */
	private onAuxAreaRelease(): void {
		this._presenter?.pointerLeaveBoard();
		this._presenter?.pointerUp();
	}

	//#endregion

	//#region Screens

	/**
	 * 패널 전체를 덮는 **뗌 마감 레이어** - "잡은 오브젝트가 손을 떼도 놓이지 않는다" 의 해법.
	 *
	 * 격자 영역과 보조 레이아웃은 각자 Pressable 로 뗌을 받지만, 그 **사이와 바깥**
	 * (HUD 자리 `topInset`, 두 영역 사이의 여백, 안전 여백)은 어느 Pressable 에도 속하지
	 * 않아서, 거기서 손을 떼면 `pointerUp()` 이 오지 않고 조각이 손가락에 붙은 채 남았다
	 * (worker/NextJob.md 2번).
	 *
	 * **다른 형제들보다 먼저(=뒤에 깔리게) 넣는다.** 위에 올리면 격자 칸의 enter/exit 를
	 * 가로채 드래그가 끊긴다. 뒤에 있으면 다른 Pressable 이 받지 못한 입력만 받는다.
	 * "밖" 으로 단정하지 않는 것은 `onBoardAreaRelease()` 와 같은 이유다 - 프레젠터가
	 * 마지막으로 올라가 있던 칸에 놓아 준다.
	 *
	 * 보드가 없을 때는 `display: none` 이라 월드 입력을 막지 않는다.
	 */
	private createReleaseCatcher(): UINode {
		return Pressable({
			children: [],
			onRelease: () => { this._presenter?.pointerUp(); },
			style: {
				position: 'absolute',
				left: 0,
				top: 0,
				// 화면 전부를 덮는다 - 어디서 손을 떼도 놓기 판정이 되어야 한다
				width: '100%',
				height: '100%',
				display: this._hasBoard.derive((hasBoard) => (hasBoard ? 'flex' : 'none')),
			},
		});
	}

	/**
	 * 화면 세로 한가운데, 오른쪽 끝에 떠 있는 **Menu(일시정지) 버튼**.
	 *
	 * 허브의 상단 바에도 같은 기능의 `Pause` 가 있지만 인게임에서는 손이 닿지 않는다.
	 * 이 패널은 화면 전체를 덮는 뗌 마감 레이어(`createReleaseCatcher()`)와 불투명한
	 * 배경을 가진 Screen Overlay 라, 상단 바가 앉기로 한 `topInset` 자리까지 이 패널이
	 * 덮어 버리기 때문이다 - 보드가 올라와 있는 동안 상단 바는 보이지도, 눌리지도 않는다.
	 * 그래서 **보드를 그리는 쪽에** 버튼을 하나 두어 그 문제를 우회한다.
	 *
	 * 누르면 스테이지를 통해 허브로 넘어가고(`PuzzleBoardStage.requestPause()`),
	 * 허브가 세션을 재우면서 시스템 메뉴(Resume / Restart / Return to Main)를 띄운다.
	 * 그때 보드는 내려가므로(`*_CoreAPI.pause()`) 이 버튼도 함께 사라진다.
	 *
	 * 자리는 **세로 정중앙 · 오른쪽 끝**이다. 격자가 모바일에서 폭을 다 쓰므로 어디에 두든
	 * 칸 몇 개는 가리는데, 가장자리가 판의 중심에서 가장 멀다. 알약 하나 크기로 묶어 두는
	 * 것도 같은 이유다.
	 */
	private createMenuButton(): UINode {
		return Pressable({
			children: [
				Text({
					text: PUZZLE_BOARD_MENU_LABEL,
					style: {
						color: COLOR_TEXT,
						fontSize: fitFontSize(this.units(this._layout.bottomInsetPercent / 100), {
							ratio: 0.36, minimum: 14, maximum: 30, scale: this._profile.fontScale, pixelScale: this.pxScale,
						}),
						fontWeight: 'bold',
						textAlign: 'center',
						width: '100%',
					},
				}),
			],
			// `onPress`(누르는 순간) - `onClick` 은 릴리즈 뒤에 와서 탭 한 번에 ~100ms 가 더
			// 걸린다. 모든 버튼이 같은 이유로 onPress 다 (mobile-touch-ux: 반응은 즉각).
			onPress: () => { PuzzleBoardStage.instance.requestPause(); },
			// 끌던 조각을 이 버튼 위에서 떼는 경우도 마감한다 - 판 밖이 확실하므로
			// 부품이 인벤토리로 돌아간다 (리셋 버튼과 같은 처리다)
			onRelease: () => this.onAuxAreaRelease(),
			propagateClick: false,
			style: {
				// **아래 여백 띠 안에 흐름으로 놓는다.** 예전에는 화면 좌표로 띄웠는데, 그
				// 좌표가 화면 픽셀과 달라 판 위로 올라와 칸을 가렸다. 띠의 높이를 거의 다
				// 채우고 폭은 그 세 배인 알약이라, 어느 화면에서도 같은 비율로 보인다.
				height: MENU_BUTTON_HEIGHT_PERCENT,
				aspectRatio: MENU_BUTTON_WIDTH_RATIO,
				marginRight: '2%',
				borderRadius: this.px(24),
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: COLOR_MENU_BUTTON,
				opacity: MENU_BUTTON_OPACITY,
				// 보드가 없을 때는 허브가 자기 화면을 그리고 있다 - 그 위에 뜨면 안 된다
				display: this._hasBoard.derive((hasBoard) => (hasBoard ? 'flex' : 'none')),
			},
		});
	}

	/**
	 * 화면 위에 비워 두는 띠 - 상태바·노치와 호라이즌 자체 버튼(`...`/`≡`) 자리다.
	 *
	 * 실기 스크린샷에서 이 패널은 상태바 **뒤까지** 그려진다. 여백을 두지 않으면 판의
	 * 첫 줄이 시계와 노치에 가린다. 퍼즐 제목도 이 자리에 앉는다.
	 */
	private createTopInset(): UINode {
		return View({
			children: [this.createTitle()],
			style: {
				width: '100%',
				height: percentText(this._layout.topInsetPercent),
				flexDirection: 'row',
				alignItems: 'flex-end',
				justifyContent: 'center',
			},
		});
	}

	/**
	 * 화면 아래에 비워 두는 띠 - `Menu` 버튼과 홈 인디케이터 자리다.
	 *
	 * 버튼을 오른쪽 끝에 두는 이유는 엄지에 가장 가까우면서 판에서 가장 먼 자리이기 때문이다.
	 */
	private createBottomInset(): UINode {
		return View({
			children: [this.createMenuButton()],
			style: {
				width: '100%',
				height: percentText(this._layout.bottomInsetPercent),
				flexDirection: 'row',
				alignItems: 'center',
				justifyContent: 'flex-end',
			},
		});
	}

	/**
	 * 레이아웃 실측값 오버레이 (`showLayoutDebug`) - 화면 왼쪽 아래에 한 줄로 뜬다.
	 *
	 * 실기에서 콘솔을 볼 수 없을 때 스크린샷 한 장으로 화면 읽기값·캔버스·격자 크기를
	 * 확인하기 위한 것이다. 입력을 받지 않는 평범한 Text 라 게임을 방해하지 않는다.
	 */
	private createLayoutDebug(): UINode {
		return Text({
			text: this._layoutDebug,
			style: {
				position: 'absolute',
				left: this.px(8),
				bottom: this.px(8),
				color: COLOR_TEXT,
				fontSize: this.px(10),
				backgroundColor: new Color(0, 0, 0),
				opacity: 0.85,
				// 트레이 진단만 켠 경우에도 이 줄이 있어야 요약을 볼 수 있다
				display: this.props.showLayoutDebug === true || this.props.showTrayDebug === true
					? 'flex'
					: 'none',
			},
		});
	}

	/** 메인 UI 의 HUD 바가 앉을 자리. 아무것도 그리지 않는다 */
	private createTitle(): UINode {
		return Text({
			text: this._title,
			style: {
				// 위 여백 띠(`createTopInset`)가 자리를 잡아 주므로 흐름 그대로 둔다
				color: COLOR_TEXT,
				fontSize: fitFontSize(this.units(this._layout.topInsetPercent / 100), {
					ratio: 0.42, minimum: 18, maximum: 34, scale: this._profile.fontScale, pixelScale: this.pxScale,
				}),
				fontWeight: 'bold',
				textAlign: 'center',
				width: '100%',
				display: this.props.showTitle === true ? 'flex' : 'none',
			},
		});
	}

	/**
	 * 화면 윗부분 - 본 격자만 담는다.
	 *
	 * 바깥을 Pressable 로 감싸 **칸이 받지 못한 뗌**을 받는다. 칸 Pressable 은 전파를
	 * 막지 않으므로(`BoardGridRenderer.createCell()` 주석) 칸 위에서 뗀 것도 여기로
	 * 올라온다. 그래서 `onBoardAreaRelease()` 는 "판 밖" 으로 단정하지 않는다 -
	 * 단정하면 칸 위에서 뗀 조각이 제자리로 돌아간다.
	 */
	private createBoardArea(grid: BoardGridRenderer): UINode {
		return Pressable({
			children: [grid.createNode()],
			onRelease: () => this.onBoardAreaRelease(),
			style: {
				// **화면 세로의 7/10 을 쓰는 흐름 상자다** (`Documents/SampleHtml` 의 `#game-area`).
				// 보드 정사각형은 이 안에서 가운데 정렬로 앉고, 좌우 여백은 그 정사각형이
				// `maxWidth` 로 남긴 만큼 저절로 같아진다.
				flex: this._layout.boardFlex,
				width: '100%',
				flexDirection: 'row',
				alignItems: 'center',
				justifyContent: 'center',
				// 판이 이 상자보다 커지는 일이 없도록 넘치는 부분은 잘라 둔다.
				// 잘려 보이지 않는 곳에 입력 영역만 남는 상태를 막는 두 번째 방어선이다.
				overflow: 'hidden',
				display: this._hasBoard.derive((hasBoard) => (hasBoard ? 'flex' : 'none')),
			},
		});
	}

	/** 텍스처 등록이 바뀌었다 - 세대를 올려 이미 그려진 칸들의 그림을 다시 계산하게 한다 */
	private bumpTextureEpoch(): void {
		this._textureEpochValue++;
		this._textureEpoch.set(this._textureEpochValue);
	}

	/**
	 * 화면 아랫부분 - 보조 레이아웃과 시작 배너가 같은 자리를 쓴다.
	 *
	 * 배너가 떠 있는 동안 보조 레이아웃은 `display: none` 이다. 배너가 내려가야
	 * 보조 레이아웃이 나타난다는 요구를 이 한 쌍의 `display` 로 지킨다.
	 */
	private createAuxArea(tray: BoardTrayRenderer, side: BoardSideRenderer): UINode {
		return Pressable({
			children: [this.createIntroBanner(), this.createAuxContent(tray, side)],
			onRelease: () => this.onAuxAreaRelease(),
			style: {
				// **화면 세로의 3/10 을 쓰는 흐름 상자다** (`Documents/SampleHtml` 의 `#ui-area`).
				// 판과의 틈은 보드 정사각형이 자기 영역에서 `boardHeightPercent` 만 쓰고
				// 남긴 자리다 - 여기에 `margin` 을 주면 7:3 이 그만큼 어긋난다.
				flex: this._layout.auxFlex,
				width: AUX_AREA_WIDTH_PERCENT,
				// 폭을 100% 미만으로 두었으므로 스스로 가운데로 온다 - 루트는 세로 흐름이라
				// 가로 정렬을 건드리지 않는다 (다른 형제는 폭이 100% 라 영향이 없다)
				alignSelf: 'center',
				borderRadius: this.px(14),
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: COLOR_AUX_BACKGROUND,
				display: this._hasBoard.derive((hasBoard) => (hasBoard ? 'flex' : 'none')),
			},
		});
	}

	/** `GameStart` - 보조 레이아웃 자리의 정중앙에 뜼다 */
	private createIntroBanner(): UINode {
		return View({
			children: [
				Text({
					text: this._introText,
					style: {
						color: COLOR_TEXT,
						fontSize: fitFontSize(this.auxHeightUnits, {
							ratio: 0.34, minimum: 24, maximum: 56, scale: this._profile.fontScale, pixelScale: this.pxScale,
						}),
						fontWeight: 'bold',
						textAlign: 'center',
						width: '100%',
					},
				}),
			],
			style: {
				width: '100%',
				height: '100%',
				position: 'absolute',
				alignItems: 'center',
				justifyContent: 'center',
				// 페이드 아웃 - `startIntroFade()` 가 0 으로 잦아들게 한다
				opacity: this._introOpacity,
				display: this._isIntroVisible.derive((visible) => (visible ? 'flex' : 'none')),
			},
		});
	}

	/**
	 * 보조 레이아웃의 내용 - 액션 버튼 · 오브젝트 트레이 · 정보 미니 격자 · 리셋 버튼.
	 *
	 * ## 퍼즐이 선언한 것만 트리에 올린다
	 *
	 * 넷 중 리셋만 모든 퍼즐이 쓰고, 나머지 셋은 **그것을 규격에 적은 퍼즐만** 쓴다
	 * (`PuzzleBoardLayoutSpec` 의 `actionLabel` / `itemCount` / `side`). 그래서 셋은
	 * `display: none` 이 아니라 **`UINode.if` 로 마운트 자체를 가른다.**
	 *
	 * 숨기기와 안 올리기는 다르다. 숨긴 노드는 그려지지만 않을 뿐 트리에 남아 Binding 을
	 * 들고 있다. 트레이는 슬롯 8벌이 실려 있어 노드 60여 개인데, 그것을 스위치·카드
	 * 맞추기처럼 트레이가 없는 퍼즐이 계속 들고 있을 이유가 없다. 규격에 적지 않은
	 * 퍼즐에서는 이제 그 노드가 아예 만들어지지 않는다.
	 *
	 * `initializeUI()` 는 월드 시작에 **한 번만** 돌고 그때는 어떤 퍼즐이 올라올지 모르므로,
	 * 트리에는 넷이 다 들어가되 마운트 여부를 런타임 Binding(`_hasAction`/`_hasItems`/
	 * `_hasSide`)이 정하는 이 방식이 "퍼즐이 자기 UI 를 들고 온다" 에 가장 가깝다.
	 */
	private createAuxContent(tray: BoardTrayRenderer, side: BoardSideRenderer): UINode {
		return View({
			children: [
				this.createActionButton(),
				// 트레이와 미니 격자는 **선언한 퍼즐만** 마운트한다 (아래 주석)
				UINode.if(this._hasItems, tray.createNode()),
				UINode.if(this._hasSide, side.createNode()),
				this.createResetButton(),
			],
			style: {
				width: '100%',
				height: '100%',
				flexDirection: 'row',
				alignItems: 'center',
				justifyContent: 'center',
				display: this._isIntroVisible.derive((visible) => (visible ? 'none' : 'flex')),
			},
		});
	}

	/**
	 * 보조 레이아웃을 채우는 큰 액션 버튼 (색 채우기의 STOP).
	 *
	 * - 남는 폭 전부(flex)를 차지하고 세로도 90% 를 채운다 - 타이밍 입력은 조준할
	 *   필요가 없어야 하므로 버튼이 클수록 좋다 (인터랙션 규격).
	 * - **`onPress`(누르는 순간)** 로 연결한다. `onClick` 은 릴리즈 뒤에 오므로
	 *   타이밍 게임에서는 손가락을 대는 순간과 판정 사이가 벌어진다.
	 */
	private createActionButton(): UINode {
		// **선언한 퍼즐만 마운트한다** (`createAuxContent()` 주석). 예전에는 `display: none`
		// 으로 숨겨서, STOP 을 쓰지 않는 7개 퍼즐도 이 버튼을 트리에 들고 있었다.
		return UINode.if(this._hasAction, Pressable({
			children: [
				Text({
					text: this._actionLabel,
					style: {
						color: COLOR_TEXT,
						fontSize: fitFontSize(this.auxHeightUnits, {
							ratio: 0.34, minimum: 24, maximum: 56, scale: this._profile.fontScale, pixelScale: this.pxScale,
						}),
						fontWeight: 'bold',
						textAlign: 'center',
						width: '100%',
					},
				}),
			],
			onPress: () => { this._presenter?.requestAction(); },
			propagateClick: false,
			style: {
				flex: 1,
				height: '90%',
				marginLeft: '2%',
				marginRight: '2%',
				borderRadius: this.px(14),
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: COLOR_RESET_BUTTON,
			},
		}));
	}

	/**
	 * 리셋 버튼 - 판을 풀기 전 상태로 되돌린다.
	 *
	 * **남은 시간은 되돌리지 않는다.** 시간까지 돌아가면 리셋이 곷 무한 연장이 되기 때문이다
	 * (되돌리는 범위는 세션의 `resetRound()` 가 정한다).
	 */
	private createResetButton(): UINode {
		return Pressable({
			children: [
				Text({
					text: PUZZLE_BOARD_RESET_LABEL,
					style: {
						color: COLOR_TEXT,
						// 글자가 버튼 크기를 따라간다 - 모바일에서 "버튼은 큰데 글자만 작은" 것을 없앱다
						fontSize: fitFontSize(this.units(auxAreaFraction(this._layout) * RESET_HEIGHT_USAGE), {
							ratio: 0.34, minimum: 16, maximum: 34, scale: this._profile.fontScale, pixelScale: this.pxScale,
						}),
						fontWeight: 'bold',
						textAlign: 'center',
						width: '100%',
					},
				}),
			],
			// 누르는 순간 되돌린다 - 릴리즈를 기다리지 않는다 (Menu 버튼과 같은 이유)
			onPress: () => { this._presenter?.requestReset(); },
			// 드래그하던 조각을 이 버튼 위에서 떼는 경우도 마감한다 - 여기는 판 밖이 확실하다
			onRelease: () => this.onAuxAreaRelease(),
			propagateClick: false,
			style: {
				width: RESET_WIDTH_PERCENT,
				height: percentText(RESET_HEIGHT_USAGE * 100),
				marginLeft: '3%',
				marginRight: '2%',
				borderRadius: this.px(12),
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: COLOR_RESET_BUTTON,
			},
		});
	}

	//#endregion
}
UIComponent.register(PuzzleBoardUIPanel);
