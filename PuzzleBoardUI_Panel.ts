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
 * 사라지고, **사라진 뒤에** 보조 레이아웃이 나타난다. 배너를 내리는 타이머만 여기 있고,
 * 배너를 켜는 것은 각 `*_CoreAPI` 다 (`presenter.beginIntro()`).
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
 * ## 왜 격자를 `DynamicList` 로 그리는가 - **패널 크기 한도 64kB**
 *
 * `initializeUI()` 가 돌려주는 트리는 통째로 직렬화되어 패널에 실리고, 그 크기가 64kB 를
 * 넘으면 컴포넌트가 **아예 만들어지지 않는다**
 * (`Failed to instantiate ... The UI (86236B) exceeds the maximum allowed size of 64kB`).
 *
 * 예전에는 최대 격자(9×9)의 칸 81개를 여기서 전부 만들어 두고 격자 밖은 `display: none` 으로
 * 숨겼다. 칸 하나의 트리(누름 껍데기·얼굴·글자·무늬·테두리·고리 = 노드 6개)가 81벌 복제되어
 * 86kB 가 되었고 그래서 한도를 넘었다.
 *
 * `DynamicList` 는 `renderItem` 을 런타임에 부르므로 **트리에는 템플릿 한 벌만** 실린다.
 * 그래서 9×9 를 유지하고 연출도 하나도 줄이지 않은 채로 패널이 1.5kB 대로 내려간다.
 * 격자를 줄이는 선택지는 없었다 - 러시아워가 도착 포인트를 올려 놓는 테두리 링까지 합쳐
 * 9×9 를 쓴다 (`RushHour_Definitions.RUSH_HOUR_FULL_GRID_SIZE`).
 *
 * 칸의 **내용**은 여전히 미리 만들어 둔 `_cellBindings[슬롯]` 이 나른다. 목록이 나르는 것은
 * 자리 번호뿐이라, 칸 하나가 바뀔 때 목록을 다시 그리지 않고 그 칸의 Binding 만 갱신한다 -
 * 드래그 중의 갱신 비용은 예전과 같다. 목록의 길이가 곧 격자의 크기이므로 행·칸을
 * `display: none` 으로 숨기던 일은 없어졌다.
 *
 * 그래서 **UI 트리의 자리(슬롯)와 퍼즐의 칸 번호가 다르다.**
 *
 *   슬롯 번호 = row * PUZZLE_BOARD_MAX_COLS + col      (고정 9열 기준, Binding 배열의 색인)
 *   칸  번호 = row * 현재 colCount        + col        (퍼즐 로직이 쓰는 row-major)
 *
 * 둘을 오가는 것이 `toSlotIndex()` / `toCellIndex()` 다.
 */

import { Color, PropTypes } from 'horizon/core';
import { Bindable, Binding, DynamicList, Image, Pressable, Text, UIComponent, UINode, View } from 'horizon/ui';
import {
	PuzzleBoardRelativeLayout,
	auxAreaFraction,
	cellFraction,
	computeGridBox,
	percentText,
	resolveRelativeLayout,
	traySlotFraction,
	traySlotsPerPage,
	trayPageCount,
} from 'PuzzleUI_RelativeLayout';
import { createLayoutProbe } from 'PuzzleUI_LayoutProbe';
import { SubscriptionBag } from 'Utility_Events';
import {
	BOARD_COLOR_BACKGROUND,
	BOARD_COLOR_DROP_INVALID,
	BOARD_COLOR_DROP_VALID,
	BOARD_COLOR_GRABBED,
	BOARD_COLOR_HIGHLIGHT,
	BOARD_COLOR_PATH,
	BOARD_COLOR_TEXT,
	EBoardCellAccent,
	PUZZLE_BOARD_MAX_CELLS,
	PUZZLE_BOARD_MAX_COLS,
	PUZZLE_BOARD_MAX_ITEMS,
	PUZZLE_BOARD_MAX_ROWS,
	PUZZLE_BOARD_MENU_LABEL,
	PUZZLE_BOARD_RESET_LABEL,
	PUZZLE_BOARD_SIDE_MAX_CELLS,
	PUZZLE_BOARD_SIDE_MAX_COLS,
	PUZZLE_BOARD_SIDE_MAX_ROWS,
	NO_TEXTURE,
	PuzzleBoardCellView,
	PuzzleBoardColor,
	PuzzleBoardItemView,
	PuzzleBoardView,
	PuzzleTextureKey,
	BOARD_COLOR_GLYPH_EDGE,
	BOARD_GLYPH_EDGE_WIDTH,
	BoardGlyphEdges,
	EBoardCellGlyph,
	createCellView,
	createItemView,
	getGlyphBlockedEdges,
	getGlyphRotation,
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

//#region Style constants

/** 강조된 칸의 테두리 두께 (px) */
const HIGHLIGHT_BORDER_WIDTH = 3;
/** 칸 얼굴의 모서리 둥글기 (px) - 테두리 오버레이가 같은 값을 써야 겹쳐 보인다 */
const CELL_CORNER_RADIUS = 8;
const ITEM_CORNER_RADIUS = 10;
/** 판 배경 그림의 모서리 둥글기 (px) */
const BOARD_CORNER_RADIUS = 12;
/** 트레이 슬롯 사이 간격 (px). 칸과 같은 이유로 padding 이다 */
const ITEM_SLOT_GAP_PERCENT = 5;
/** 숨긴 칸의 불투명도 - 0 이면 자리는 차지하되 보이지 않는다 (격자 모양이 유지된다) */
const HIDDEN_CELL_OPACITY = 0;

function toColor(color: PuzzleBoardColor): Color {
	return new Color(color.r, color.g, color.b);
}

const COLOR_PANEL_BACKGROUND = toColor(BOARD_COLOR_BACKGROUND);
const COLOR_HIGHLIGHT = toColor(BOARD_COLOR_HIGHLIGHT);
const COLOR_NO_BORDER = new Color(0, 0, 0);
const COLOR_TEXT = toColor(BOARD_COLOR_TEXT);
const COLOR_GRABBED = toColor(BOARD_COLOR_GRABBED);
const COLOR_DROP_VALID = toColor(BOARD_COLOR_DROP_VALID);
const COLOR_DROP_INVALID = toColor(BOARD_COLOR_DROP_INVALID);
const COLOR_PATH = toColor(BOARD_COLOR_PATH);
/** 부품 무늬(막힌 변)의 테두리 색 */
const COLOR_GLYPH_EDGE = toColor(BOARD_COLOR_GLYPH_EDGE);

//#endregion

//#region Drag accent presentation

/**
 * 조작 강조(`EBoardCellAccent`)를 실제 픽셀로 옮기는 규칙.
 *
 * `Pressable` 은 콜백에 좌표를 주지 않으므로(`horizon/ui` 의 `Callback` 은 `Player` 하나만
 * 받는다) 조각이 손가락을 픽셀 단위로 따라다니게 만들 수는 없다. 대신 **칸 단위로 따라오는
 * 조각을 눈에 띄게** 만든다 - 집은 조각은 커지고 빛나며, 원래 있던 자리에는
 * 옅은 실루엣이 남는다. 그래서 손가락에 가려도 "내가 이것을 끌고 있다" 가 보인다 (PUZ_00 §8.5).
 * (그림자는 모바일 렌더 비용 때문에 쓰지 않는다 - createGridCell 얼굴 주석)
 */

/** 집은 조각이 떠오르는 정도 - 1.1 이면 10% 커진다 */
const GRABBED_SCALE = 1.1;

/**
 * 집은 조각을 **손가락 위쪽으로 띄우는** 거리 - **칸 한 변의 배수**다.
 *
 * 터치한 칸 위에 그대로 그리면 손가락이 조각을 가려 무엇을 옮기는지 보이지 않는다
 * (모바일 드래그 UX 의 표준 해법 - 카드 게임·매치3 이 다 이렇게 한다). 조각의 얼굴만
 * 위로 밀어 손가락 위로 내밀고, **놓을 자리는 원래 칸의 테두리·고리가 그대로 표시**하므로
 * 조준은 달라지지 않는다.
 *
 * **배수 자체는 퍼즐이 정한다** (`PuzzleBoardLayoutSpec.grabLiftCellRatio` - 지금은
 * 레이저의 `dragLiftCells` prop). 패널 상수였던 것을 규격으로 옮겨, 오프셋을 에디터에서
 * 조정할 수 있게 했다. 여기에는 배수를 받아 픽셀로 바꾸는 계산만 남는다
 * (`grabLiftPixels()`).
 */
/** 원래 자리에 남는 실루엣의 크기 - 살짝 작게 그려 "빠져나갔다" 가 보이게 한다 */
const GHOST_SCALE = 0.86;
/** 실루엣의 불투명도 */
const GHOST_OPACITY = 0.3;
/** 놓을 자리 표시의 테두리 두께 (px) */
const DROP_BORDER_WIDTH = 4;
/** 집은 조각의 테두리 두께 (px) */
const GRABBED_BORDER_WIDTH = 5;

/** 아무 자리도 짚고 있지 않을 때의 슬롯 번호 */
const NO_PRESSED_SLOT = -1;

/**
 * 고리가 칸 밖으로 번지는 양 (px).
 *
 * 고리는 `Pressable` 기준으로 놓이는데, 칸 사이 간격이 `padding` 으로 들어오면서
 * 그 기준 상자가 얼굴보다 간격만큼 커졌다. 그만큼 값을 줄여 고리가 얼굴에 붙어 보이게 한다.
 */
const GRAB_RING_SPREAD_PERCENT = 2;
/** 고리의 고정 진하기 - 애니메이션을 걸지 않는 이유는 `createGrabRing()` 주석 참고 */
const GRAB_RING_OPACITY = 0.8;

/**
 * 퍼즐이 칸에 준 강조와 "지금 짚고 있다" 를 합친다.
 *
 * 퍼즐이 준 것이 언제나 이긴다. 러시아워에서 집어 든 오브젝트(`GRABBED`)나 실루엣(`GHOST`)이
 * 단순한 누름 표시에 덮이면, 정작 보여야 할 조작이 가려지기 때문이다. 퍼즐이 아무것도 주지
 * 않은 칸만 눌린 티가 난다 - 탭으로 푸는 퍼즐(카드 맞추기·슬라이드 등)이 여기 해당한다.
 */
function mergePressAccent(accent: EBoardCellAccent, isPressed: boolean): EBoardCellAccent {
	if (accent !== EBoardCellAccent.NONE) {
		return accent;
	}
	return isPressed ? EBoardCellAccent.GRABBED : EBoardCellAccent.NONE;
}

function getAccentScale(accent: EBoardCellAccent): number {
	if (accent === EBoardCellAccent.GRABBED) {
		return GRABBED_SCALE;
	}
	if (accent === EBoardCellAccent.GHOST) {
		return GHOST_SCALE;
	}
	return 1;
}

/** 조작 강조가 있으면 그것이 테두리를 차지하고, 없을 때만 퍼즐 상태(`isHighlighted`)가 쓴다 */
function getAccentBorderWidth(accent: EBoardCellAccent, isHighlighted: boolean): number {
	if (accent === EBoardCellAccent.GRABBED) {
		return GRABBED_BORDER_WIDTH;
	}
	if (accent === EBoardCellAccent.DROP_VALID || accent === EBoardCellAccent.DROP_INVALID) {
		return DROP_BORDER_WIDTH;
	}
	if (accent === EBoardCellAccent.GHOST || accent === EBoardCellAccent.PATH) {
		return HIGHLIGHT_BORDER_WIDTH;
	}
	return isHighlighted ? HIGHLIGHT_BORDER_WIDTH : 0;
}

function getAccentBorderColor(accent: EBoardCellAccent, isHighlighted: boolean): Color {
	if (accent === EBoardCellAccent.GRABBED || accent === EBoardCellAccent.GHOST) {
		return COLOR_GRABBED;
	}
	if (accent === EBoardCellAccent.DROP_VALID) {
		return COLOR_DROP_VALID;
	}
	if (accent === EBoardCellAccent.DROP_INVALID) {
		return COLOR_DROP_INVALID;
	}
	if (accent === EBoardCellAccent.PATH) {
		return COLOR_PATH;
	}
	return isHighlighted ? COLOR_HIGHLIGHT : COLOR_NO_BORDER;
}

/**
 * 자리(슬롯)마다 하나씩 `Binding` 을 만들어 둔다.
 *
 * `DynamicList` 의 `renderItem` 은 자리 번호만 받으므로, 그 자리의 내용은 여기서 만든
 * `Binding` 이 나른다. 목록의 길이가 바뀌어도 이 배열은 그대로다 - 그래야 칸 하나가
 * 바뀔 때 목록 전체를 다시 그리지 않고 그 칸의 `Binding` 만 갱신할 수 있다.
 */
function createSlotBindings<T>(count: number, createValue: () => T): Binding<T>[] {
	const bindings: Binding<T>[] = [];
	for (let index = 0; index < count; index++) {
		bindings.push(new Binding<T>(createValue()));
	}
	return bindings;
}

/** `DynamicList` 에 넘길 자리 번호 목록 - `[0, 1, ... count-1]` */
function indexRange(count: number): number[] {
	const indices: number[] = [];
	for (let index = 0; index < count; index++) {
		indices.push(index);
	}
	return indices;
}

/** 보이지 않는 칸은 0, 실루엣은 옅게, 나머지는 그대로 */
function getAccentOpacity(isVisible: boolean, accent: EBoardCellAccent): number {
	if (isVisible === false) {
		return HIDDEN_CELL_OPACITY;
	}
	return accent === EBoardCellAccent.GHOST ? GHOST_OPACITY : 1;
}
/** 보조 레이아웃의 바탕 - 본 격자와 구분되도록 한 단계 밝다 */
const COLOR_AUX_BACKGROUND = new Color(0.11, 0.12, 0.17);
const COLOR_RESET_BUTTON = new Color(0.32, 0.34, 0.42);
/**
 * 보드 메인 패널의 바탕 - 화면 배경과 보조 레이아웃 사이의 밝기다.
 *
 * 정사각 판(러시아워 9×9)은 직사각 패널 안에서 가운데로 모이므로 좌우가 남는다.
 * 그 남는 자리가 화면 배경과 같은 색이면 판의 경계가 사라져 "어디까지가 판인지" 가
 * 보이지 않는다. 그래서 패널에 자기 바탕을 준다.
 */
const COLOR_BOARD_PANEL = new Color(0.1, 0.11, 0.16);
/** 보드 메인 패널의 모서리 둥글기 (px) */
const BOARD_PANEL_CORNER_RADIUS = 18;

/**
 * `screenPixelRatio` 의 기본값 - 실기 측정값(1179 / 590 = 2) 이다.
 *
 * **prop 기본값과 반드시 같아야 한다.** 필드 초기화 시점에는 `this.props` 가 아직 없어서
 * prop 을 읽을 수 없기 때문에, 그때는 이 상수가 대신 쓰인다 (`_pixelRatio` 주석).
 */
const DEFAULT_SCREEN_PIXEL_RATIO = 2;
/** `cellGapPercent` 의 기본값 - 위와 같은 이유로 상수로도 둔다 */
const DEFAULT_CELL_GAP_PERCENT = 1.2;

/**
 * 트레이 슬라이드바의 화살표 라벨.
 *
 * **ASCII 로만 둔다.** 화면에 그대로 나가는 글자라, 폰트에 없는 글리프(◀ ▶)를 쓰면
 * 기기에 따라 빈 네모로 떨어진다. 방향만 보이면 되므로 부등호로 충분하다.
 */
/**
 * 보조 레이아웃 안쪽의 비율 - 전부 **자기 부모 대비 %** 다.
 *
 * 픽셀이 하나도 없으므로 어느 기기에서든 같은 모양으로 그려진다. 예전에는 이 값들이
 * 픽셀이었고, 그 픽셀이 화면에 몇 배로 그려지는지 알 수 없어
 * 트레이와 리셋 버튼이 화면 절반 크기로 나왔다.
 */
const AUX_AREA_WIDTH_PERCENT = '94%';
/** 트레이 상자가 보조 레이아웃 세로에서 쓰는 % - 슬롯이 이 높이를 꽉 채운다 */
const TRAY_HEIGHT_PERCENT = '82%';
/** 넘기기 화살표: 트레이 세로의 %와 그 높이 대비 가로 비율 (좁은 알약) */
const TRAY_ARROW_HEIGHT_PERCENT = 80;
const TRAY_ARROW_WIDTH_USAGE = 0.42;
/** 정보 미니 격자가 보조 레이아웃 세로에서 쓰는 비율 (글자 크기 환산용) */
const SIDE_GRID_HEIGHT_USAGE = 0.6;
/** 리셋 버튼이 보조 레이아웃에서 쓰는 가로 %와 세로 비율 */
const RESET_WIDTH_PERCENT = '20%';
const RESET_HEIGHT_USAGE = 0.7;

const TRAY_ARROW_PREV_LABEL = '<';
const TRAY_ARROW_NEXT_LABEL = '>';
/** 더 넘어갈 곳이 없는 화살표의 진하기 */
const TRAY_ARROW_DISABLED_OPACITY = 0.35;

/**
 * 화면 중앙 오른쪽에 떠 있는 Menu(일시정지) 버튼.
 *
 * 격자 위에 겹쳐 그리므로 **판보다 확실히 밝게** 잡는다 - 어느 퍼즐의 어떤 색 칸 위에
 * 올라가도 버튼으로 읽혀야 한다.
 */
const COLOR_MENU_BUTTON = new Color(0.24, 0.27, 0.36);
/** 격자를 조금이라도 덜 가리려고 살짝 비친다. 글자는 그대로 읽힌다 */
const MENU_BUTTON_OPACITY = 0.92;
/**
 * Menu 버튼의 세로 크기 (캔버스 대비 %).
 *
 * 기기 프로필의 최소 버튼 높이를 따르되 위아래로 묶어 둔다 - 모바일(12%)에서 엄지로 누를
 * 만하고, 그보다 커지면 격자를 필요 이상으로 가린다.
 */
const MENU_BUTTON_HEIGHT_PERCENT = '72%';
const MENU_BUTTON_WIDTH_RATIO = 2.6;
/** 알약 모양 - 높이의 몇 배를 가로로 쓸지 */

/**
 * 버튼의 세로 중심을 화면의 어디에 둘지 (캔버스 대비 %).
 *
 * 화면을 위아래로 반 나눈 그 경계다. 상단 바가 보드 패널에 가려 손이 닿지 않으므로
 * (`createMenuButton()` 주석) 어느 쪽 절반에서 놀던 엄지든 같은 거리에 오게 둔다.
 */


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
		/** `GameStart` 배너가 떠 있는 시간 (초) */
		introSeconds: { type: PropTypes.Number, default: 1.5 },
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
	 * **여기서 `this.props` 를 직접 읽으면 안 된다.** 클래스 필드 초기화(`_cellFontSize` 의
	 * `derive`)가 이 게터를 타는데, 그 시점에는 `this.props` 가 아직 undefined 라
	 * 컴포넌트가 **아예 만들어지지 않는다**
	 * (`Failed to instantiate ... Cannot read properties of undefined`).
	 * 그래서 값을 필드에 담아 두고, 기본값은 상수에서 가져온다.
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
	/** 마지막으로 잰 격자 칸 한 변 (좌표 단위) - 레벨이 올라올 때 채워진다 */
	private _debugCellSide: number = 0;
	/** 마지막으로 잰 격자 상자 크기 (판 대비 %) - 레벨이 올라올 때 채워진다 */
	private _debugGridBox: string = '-';

	/** 디버그 문자열을 다시 만든다. 화면에 그대로 나가는 값이므로 영어다 */
	private updateLayoutDebug(): void {
		this._layoutDebug.set(
			`screen ${Math.round(this._rawScreenWidth)}x${Math.round(this._rawScreenHeight)}`
			+ ` ar ${Math.round(this._screenAspect * 100) / 100}`
			+ ` ${this._canvas.isLandscape ? 'landscape' : 'portrait'} ${this._profile.deviceClass}`
			+ ` | inset ${Math.round(this._layout.topInsetPercent)}/${Math.round(this._layout.bottomInsetPercent)}`
			+ ` | flex ${this._layout.boardFlex}:${this._layout.auxFlex}`
			+ ` | board ${this._layout.boardWidthPercent}%x${this._layout.boardHeightPercent}%`
			+ ` | grid ${this._debugGridBox}`
			+ ` | units ${Math.round(this.screenUnitsHeight)} cell ${this._debugCellSide}`);
	}

	private readonly _stageSubscriptions: SubscriptionBag = new SubscriptionBag();
	private _presenterSubscriptions: SubscriptionBag = new SubscriptionBag();
	private _presenter: PuzzleBoardPresenter | undefined = undefined;

	/** 배너를 내리는 예약. 새 레벨이 겹쳐 들어오면 앞의 예약을 버린다 */
	private _introTimeoutId: number | undefined = undefined;

	//#region Bindings

	private readonly _hasBoard: Binding<boolean> = new Binding<boolean>(false);
	private readonly _title: Binding<string> = new Binding<string>('');
	/** 슬롯 번호(고정 9열 기준)로 인덱싱한다. 칸 번호가 아니다 */
	private readonly _cellBindings: Binding<PuzzleBoardCellView>[] =
		createSlotBindings(PUZZLE_BOARD_MAX_CELLS, createCellView);
	/** `DynamicList` 가 지금 그릴 행/열 - 이 목록의 길이가 곧 격자의 크기다 */
	private readonly _rowIndices: Binding<number[]> = new Binding<number[]>([]);
	private readonly _colIndices: Binding<number[]> = new Binding<number[]>([]);

	private readonly _hasSide: Binding<boolean> = new Binding<boolean>(false);
	private readonly _sideLabel: Binding<string> = new Binding<string>('');
	private readonly _sideRowCount: Binding<number> = new Binding<number>(0);
	private readonly _sideColCount: Binding<number> = new Binding<number>(0);
	private readonly _sideCellBindings: Binding<PuzzleBoardCellView>[] =
		createSlotBindings(PUZZLE_BOARD_SIDE_MAX_CELLS, createCellView);
	private readonly _sideRowIndices: Binding<number[]> = new Binding<number[]>([]);
	private readonly _sideColIndices: Binding<number[]> = new Binding<number[]>([]);

	private readonly _hasItems: Binding<boolean> = new Binding<boolean>(false);
	private readonly _itemBindings: Binding<PuzzleBoardItemView>[] =
		createSlotBindings(PUZZLE_BOARD_MAX_ITEMS, createItemView);
	private readonly _itemIndices: Binding<number[]> = new Binding<number[]>([]);

	/**
	 * 텍스처 등록이 바뀐 횟수.
	 *
	 * `Image` 의 source 는 "칸 스냅샷 + 이 값" 에서 파생한다. 칸이 그대로여도 이 값이
	 * 바뀌면 다시 계산되므로, **CoreAPI 가 패널보다 늦게 에셋을 등록해도** 그림이 붙는다.
	 * 칸 내용을 건드리지 않으므로 드래그 중에 끼어들어도 안전하다.
	 */
	private readonly _textureEpoch: Binding<number> = new Binding<number>(0);
	private _textureEpochValue: number = 0;

	/** 판 배경 그림의 키 */
	private readonly _boardTexture: Binding<PuzzleTextureKey> = new Binding<PuzzleTextureKey>(NO_TEXTURE);

	/**
	 * 집은 조각을 손가락 위로 띄울지 - **퍼즐이 정한다** (`PuzzleBoardLayoutSpec.liftGrabbedPiece`).
	 *
	 * 레이저처럼 부품을 끌어다 놓는 퍼즐만 켠다. 탭·밀기 퍼즐에서 조각이 손가락과 다른
	 * 칸 위에 떠 보이면 오히려 조준을 흐린다는 피드백으로, 띄우기는 기본 꺼짐이 됐다.
	 */
	private readonly _liftEnabled: Binding<boolean> = new Binding<boolean>(false);

	/**
	 * 보조 레이아웃의 큰 액션 버튼 (`PuzzleBoardLayoutSpec.actionLabel`).
	 * 색 채우기의 STOP 처럼 "타이밍에 맞춰 한 번" 이 조작의 전부인 퍼즐이 쓴다.
	 * `onPress`(누르는 순간)로 연결해 릴리즈를 기다리지 않는다.
	 */
	private readonly _actionLabel: Binding<string> = new Binding<string>('');
	private readonly _hasAction: Binding<boolean> = new Binding<boolean>(false);

	/**
	 * 트레이 슬롯 한 변 (좌표 단위) - **글자 크기를 뽑는 데만 쓴다.**
	 *
	 * 슬롯의 크기 자체는 상대 배치가 정한다 (`height:'100%' + aspectRatio:1` - 트레이 높이를
	 * 꽉 채우는 정사각형). 그런데 `fontSize` 는 숫자여야 하므로, 그 정사각형이 화면의 몇 %
	 * 인지를 좌표 단위로 환산해 여기에 담아 둔다 (`traySlotFraction`).
	 */
	private readonly _itemSlotSide: Binding<number> = new Binding<number>(0);

	/**
	 * 트레이를 넘기는 슬라이드바의 상태.
	 *
	 * `_itemIndices` 에는 **지금 페이지의 슬롯 번호만** 넣는다. 슬롯 노드와 내용 Binding 은
	 * 절대 슬롯 번호로 캐시되어 있으므로, 목록의 내용만 바꾸면 페이지가 넘어간다.
	 */
	private readonly _hasItemPaging: Binding<boolean> = new Binding<boolean>(false);
	private readonly _canPagePrev: Binding<boolean> = new Binding<boolean>(false);
	private readonly _canPageNext: Binding<boolean> = new Binding<boolean>(false);
	/** Binding 은 되읽을 수 없으므로 페이지 상태는 평범한 필드로도 들고 있는다 */
	private _itemPage: number = 0;
	private _itemPageSize: number = 0;
	private _itemPageCount: number = 0;
	private _itemTotalCount: number = 0;

	/** 격자 전체 크기 (px) - 행·열 수가 정해져야 알 수 있으므로 레벨이 올라올 때 채운다 */
	private readonly _gridWidth: Binding<string> = new Binding<string>('0%');
	private readonly _gridHeight: Binding<string> = new Binding<string>('0%');
	/**
	 * 지금 판의 칸 한 변 (좌표 단위). **글자 크기와 띄우기 거리에만 쓴다** -
	 * 칸의 크기 자체는 상대 배치가 정한다 (`computeGridBox`).
	 * 글자 크기와 띄우기 거리가 전부 여기서 파생한다.
	 */
	private readonly _cellSide: Binding<number> = new Binding<number>(0);
	/** 집은 조각을 손가락 위로 띄우는 거리 (px) - 칸 크기 × 퍼즐이 준 배수 */
	private readonly _grabLift: Binding<number> = new Binding<number>(0);
	/** 띄우기 배수 - 레벨이 올라올 때 규격에서 받는다 (`PuzzleBoardLayoutSpec.grabLiftCellRatio`) */
	private _grabLiftRatio: number = 0;

	/** 배너가 떠 있는 동안 보조 레이아웃은 그리지 않는다 */
	private readonly _isIntroVisible: Binding<boolean> = new Binding<boolean>(false);
	private readonly _introText: Binding<string> = new Binding<string>('');

	/**
	 * 칸 글자 크기 - **파생 하나를 모든 칸이 나눠 쓴다.**
	 *
	 * 예전에는 칸을 만들 때마다 `_rowCount.derive(...)` 를 불러 파생 바인딩이 81개
	 * 등록되었다. 값은 전부 같으므로 하나면 된다 - 패널 데이터 모델에 등록되는 키 수가
	 * 곧 재렌더 비용이다.
	 */
	private readonly _cellFontSize = this._cellSide.derive((side) => this.cellFontSize(side));

	/**
	 * 손가락이 지금 짚고 있는지를 **자리마다 하나씩** 든 Binding.
	 *
	 * 칸의 스냅샷과 **따로** 둔다. 그래야 세션이 칸을 다시 칠해도 누름 표시가 지워지지 않고,
	 * 반대로 누름 표시가 퍼즐이 준 강조를 덮어쓰지도 않는다 - 둘은 렌더 시점에 합쳐진다.
	 *
	 * **전역 슬롯 번호 Binding 하나로 두면 안 된다.** 모든 칸이 그 하나에서 파생하므로,
	 * 짚은 자리가 한 칸 옮겨질 때마다 81칸 × 파생 속성 여러 개가 전부 다시 계산되어
	 * 탭·드래그마다 조작이 끊겼다. 자리마다 나누면 바뀐 두 자리만 다시 그린다.
	 */
	private readonly _pressedSlotFlags: Binding<boolean>[] =
		createSlotBindings(PUZZLE_BOARD_MAX_CELLS, () => false);
	private readonly _pressedItemFlags: Binding<boolean>[] =
		createSlotBindings(PUZZLE_BOARD_MAX_ITEMS, () => false);
	/** 지금 짚고 있는 자리의 번호. Binding 은 되읽을 수 없으므로 평범한 필드로 들고 있는다 */
	private _pressedSlotIndex: number = NO_PRESSED_SLOT;
	private _pressedItemIndex: number = NO_PRESSED_SLOT;

	//#endregion

	/**
	 * 지금 격자의 실제 크기. Binding 은 읽을 수 없으므로 평범한 필드로도 들고 있는다.
	 * 슬롯 <-> 칸 번호 변환과 입력 판정에 쓴다.
	 */
	private _gridRowCount: number = 0;
	private _gridColCount: number = 0;

	/**
	 * `DynamicList.renderItem` 이 돌려줄 노드를 자리마다 한 번만 만들어 재사용한다.
	 *
	 * `renderItem` 은 목록 데이터가 바뀔 때마다(레벨 로드/퍼즐 전환) 다시 불리는데,
	 * 그때마다 칸 트리를 새로 만들면 공유 Binding(`_rowCount`, `_rowIndices` 등)에서 파생한
	 * Binding 이 판 갈이마다 새로 쌓인다. 자리·내용 Binding 은 처음부터 고정이므로
	 * 노드도 한 번 만든 것을 그대로 돌려주면 된다 - 갱신은 Binding 이 알아서 한다.
	 */
	private readonly _rowNodeCache: (UINode | undefined)[] = new Array(PUZZLE_BOARD_MAX_ROWS);
	private readonly _cellNodeCache: (UINode | undefined)[] = new Array(PUZZLE_BOARD_MAX_CELLS);
	private readonly _sideRowNodeCache: (UINode | undefined)[] = new Array(PUZZLE_BOARD_SIDE_MAX_ROWS);
	private readonly _sideCellNodeCache: (UINode | undefined)[] = new Array(PUZZLE_BOARD_SIDE_MAX_CELLS);
	private readonly _itemNodeCache: (UINode | undefined)[] = new Array(PUZZLE_BOARD_MAX_ITEMS);

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

		// **세로 흐름 하나가 화면 전부다** - 참고 구현(`Documents/SampleHtml/index.html`)의
		// `#app-container` 와 같은 구조다. 절대 배치는 화면 전체를 덮는 뗌 마감 레이어와
		// 칸 위에 겹쳐 그리는 층들에만 남는다.
		const root = View({
			children: [
				this.createReleaseCatcher(),
				this.createTopInset(),
				this.createBoardArea(),
				this.createAuxArea(),
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
		this._rowIndices.set([]);
		this._colIndices.set([]);
		this._hasSide.set(false);
		this._sideRowIndices.set([]);
		this._sideColIndices.set([]);
		this._hasItems.set(false);
		this.resetItemPaging(0);
		this.applyItemPage(0);
		this._gridWidth.set('0%');
		this._gridHeight.set('0%');
		this._cellSide.set(0);
		this._liftEnabled.set(false);
		this._isIntroVisible.set(false);
		this._actionLabel.set('');
		this._hasAction.set(false);
		this.setPressedSlot(NO_PRESSED_SLOT);
		this.setPressedItem(NO_PRESSED_SLOT);
	}

	//#endregion

	//#region View application

	/** 격자 전체를 다시 반영한다 (레벨 로드 / 퍼즐 전환) */
	private applyView(view: PuzzleBoardView): void {
		this._gridRowCount = view.grid.rowCount;
		this._gridColCount = view.grid.colCount;

		this._title.set(view.title);
		this._boardTexture.set(view.boardTexture);
		this._liftEnabled.set(view.liftGrabbedPiece);
		this._actionLabel.set(view.actionLabel);
		this._hasAction.set(view.actionLabel !== '');

		// 격자 상자를 **정사각형 판 대비 %** 로 앉힌다. 판이 정사각형이라 가로 %와 세로 %가
		// 같은 길이 단위이고, 그래서 행·칸을 `flex: 1` 로 나누면 칸이 정확히 정사각형이 된다
		// (`PuzzleUI_RelativeLayout` 머리말 §2). 픽셀 계산이 사라진 자리다.
		const box = computeGridBox(view.grid.rowCount, view.grid.colCount);
		this._gridWidth.set(percentText(box.widthPercent));
		this._gridHeight.set(percentText(box.heightPercent));

		// 칸 한 변을 좌표 단위로도 담아 둔다 - 글자 크기와 띄우기 거리는 숫자여야 한다
		const cell = this.units(
			cellFraction(this._layout, this._screenAspect, view.grid.rowCount, view.grid.colCount).ofHeight);
		this._cellSide.set(cell);
		// 띄우기 배수는 퍼즐이 정한다 - 환산보다 먼저 받아 둔다
		this._grabLiftRatio = view.grabLiftCellRatio;
		this._grabLift.set(this.grabLiftPixels(cell));
		this._debugCellSide = cell;
		this._debugGridBox = `${view.grid.rowCount}x${view.grid.colCount} `
			+ `${Math.round(box.widthPercent)}%x${Math.round(box.heightPercent)}%`;
		this.updateLayoutDebug();

		// 슬롯 크기는 화면이 정하므로 레벨과 무관하다. 레벨이 정하는 것은 **몇 개씩 넘겨 볼지**다.
		this._itemSlotSide.set(this.units(traySlotFraction(this._layout, this._screenAspect).ofHeight));
		this.resetItemPaging(view.items.length);

		// **새 격자 안의 자리만 채운다.** 격자 밖 자리는 목록이 짧아지며 트리에서 내려가므로
		// 값이 낡아 있어도 그려지지 않고, 나중에 더 큰 격자가 올라오면 그 레벨 로드가
		// 자기 격자 안의 자리를 전부 다시 채운다. 예전처럼 최대 격자(81칸)를 매번 돌면
		// 레벨 로드마다 안 쓰는 자리까지 Binding 갱신이 나가 판 갈이가 무거워진다.
		const rowLimit = Math.min(view.grid.rowCount, PUZZLE_BOARD_MAX_ROWS);
		const colLimit = Math.min(view.grid.colCount, PUZZLE_BOARD_MAX_COLS);
		for (let row = 0; row < rowLimit; row++) {
			for (let col = 0; col < colLimit; col++) {
				const slot = row * PUZZLE_BOARD_MAX_COLS + col;
				const cell = view.grid.cells[row * view.grid.colCount + col];
				this._cellBindings[slot].set(cell === undefined ? createCellView() : cell);
			}
		}

		// 목록의 길이가 곧 격자의 크기다. **칸의 내용을 먼저 채운 뒤에** 목록을 늘린다 -
		// 반대로 하면 새 격자가 앞 레벨의 칸을 한 프레임 보여 준다.
		this._rowIndices.set(indexRange(Math.min(view.grid.rowCount, PUZZLE_BOARD_MAX_ROWS)));
		this._colIndices.set(indexRange(Math.min(view.grid.colCount, PUZZLE_BOARD_MAX_COLS)));

		const side = view.side;
		this._hasSide.set(side !== undefined);
		this._sideLabel.set(side === undefined ? '' : side.label);
		this._sideRowCount.set(side === undefined ? 0 : side.rowCount);
		this._sideColCount.set(side === undefined ? 0 : side.colCount);

		// 본 격자와 같은 이유로 미니 격자도 실제 크기만큼만 채운다
		const sideRowLimit = side === undefined ? 0 : Math.min(side.rowCount, PUZZLE_BOARD_SIDE_MAX_ROWS);
		const sideColLimit = side === undefined ? 0 : Math.min(side.colCount, PUZZLE_BOARD_SIDE_MAX_COLS);
		for (let row = 0; row < sideRowLimit; row++) {
			for (let col = 0; col < sideColLimit; col++) {
				const slot = row * PUZZLE_BOARD_SIDE_MAX_COLS + col;
				const cell = side === undefined ? undefined : side.cells[row * side.colCount + col];
				this._sideCellBindings[slot].set(cell === undefined ? createCellView() : cell);
			}
		}

		this._sideRowIndices.set(indexRange(side === undefined
			? 0 : Math.min(side.rowCount, PUZZLE_BOARD_SIDE_MAX_ROWS)));
		this._sideColIndices.set(indexRange(side === undefined
			? 0 : Math.min(side.colCount, PUZZLE_BOARD_SIDE_MAX_COLS)));

		this._hasItems.set(view.items.length > 0);
		// 트레이도 실제 슬롯 수만큼만 채운다 - 격자와 같은 이유다
		const itemLimit = Math.min(view.items.length, PUZZLE_BOARD_MAX_ITEMS);
		for (let slot = 0; slot < itemLimit; slot++) {
			const item = view.items[slot];
			this._itemBindings[slot].set(item === undefined ? createItemView() : item);
		}
		this.applyItemPage(0);
	}

	/**
	 * 슬롯 수가 바뀌었으니 페이지를 다시 잡는다.
	 *
	 * 슬롯 크기는 화면이 정하므로(화면 아래 절반의 20%) 다 들어가지 않는 일이 생긴다.
	 * 그때 크기를 줄이는 대신 페이지를 나눈다 - 크기를 줄이면 부품이 손가락보다 작아져
	 * 집을 수가 없다 (`PuzzleUI_RelativeLayout.traySlotsPerPage`).
	 */
	private resetItemPaging(itemCount: number): void {
		this._itemTotalCount = Math.min(Math.max(0, itemCount), PUZZLE_BOARD_MAX_ITEMS);
		this._itemPageSize = traySlotsPerPage(this._layout, this._screenAspect, this._itemTotalCount);
		this._itemPageCount = trayPageCount(this._itemTotalCount, this._itemPageSize);
		this._hasItemPaging.set(this._itemPageCount > 1);
	}

	/** 페이지를 넘긴다. 범위 밖이면 끝 페이지에 머문다 - 감아 돌면 어디까지 봤는지 잃는다 */
	private applyItemPage(page: number): void {
		const lastPage = Math.max(0, this._itemPageCount - 1);
		this._itemPage = clampNumber(Math.round(page), 0, lastPage);
		this._canPagePrev.set(this._itemPage > 0);
		this._canPageNext.set(this._itemPage < lastPage);

		if (this._itemPageSize <= 0) {
			this._itemIndices.set([]);
			return;
		}
		const first = this._itemPage * this._itemPageSize;
		const last = Math.min(this._itemTotalCount, first + this._itemPageSize);
		const indices: number[] = [];
		for (let slot = first; slot < last; slot++) {
			indices.push(slot);
		}
		this._itemIndices.set(indices);
	}

	private applyGridCell(change: PuzzleBoardCellChange): void {
		if (this._gridColCount <= 0) {
			return;
		}
		const row = Math.floor(change.index / this._gridColCount);
		const col = change.index % this._gridColCount;
		const slot = row * PUZZLE_BOARD_MAX_COLS + col;
		const binding = this._cellBindings[slot];
		if (binding === undefined) {
			return;
		}
		binding.set(change.cell);
	}

	private applySideCell(change: PuzzleBoardCellChange): void {
		const side = this._presenter?.getView().side;
		if (side === undefined || side.colCount <= 0) {
			return;
		}
		const row = Math.floor(change.index / side.colCount);
		const col = change.index % side.colCount;
		const binding = this._sideCellBindings[row * PUZZLE_BOARD_SIDE_MAX_COLS + col];
		if (binding === undefined) {
			return;
		}
		binding.set(change.cell);
	}

	private applyItem(change: PuzzleBoardItemChange): void {
		const binding = this._itemBindings[change.index];
		if (binding === undefined) {
			return;
		}
		binding.set(change.item);
	}

	/**
	 * 짚고 있는 자리를 옮긴다.
	 *
	 * 칸 번호(현재 열 수 기준)를 슬롯 번호(고정 9열 기준)로 바꿔 둔다 - 트리의 자리와
	 * 퍼즐의 칸 번호가 다르기 때문이다 (파일 첫머리 주석 참고).
	 */
	private applyPress(press: PuzzleBoardPressHighlight): void {
		this.setPressedItem(press.item < 0 ? NO_PRESSED_SLOT : press.item);

		if (press.cell < 0 || this._gridColCount <= 0) {
			this.setPressedSlot(NO_PRESSED_SLOT);
			return;
		}
		const row = Math.floor(press.cell / this._gridColCount);
		const col = press.cell % this._gridColCount;
		this.setPressedSlot(row * PUZZLE_BOARD_MAX_COLS + col);
	}

	/** 짚고 있는 자리를 옮긴다 - **바뀐 두 자리의 Binding 만** 갱신한다 (필드 주석 참고) */
	private setPressedSlot(slot: number): void {
		if (slot === this._pressedSlotIndex) {
			return;
		}
		const previous = this._pressedSlotIndex;
		this._pressedSlotIndex = slot;
		if (previous !== NO_PRESSED_SLOT) {
			this._pressedSlotFlags[previous]?.set(false);
		}
		if (slot !== NO_PRESSED_SLOT) {
			this._pressedSlotFlags[slot]?.set(true);
		}
	}

	private setPressedItem(item: number): void {
		if (item === this._pressedItemIndex) {
			return;
		}
		const previous = this._pressedItemIndex;
		this._pressedItemIndex = item;
		if (previous !== NO_PRESSED_SLOT) {
			this._pressedItemFlags[previous]?.set(false);
		}
		if (item !== NO_PRESSED_SLOT) {
			this._pressedItemFlags[item]?.set(true);
		}
	}

	/**
	 * 배너를 켜고 끈다.
	 *
	 * 켜질 때 `introSeconds` 뒤에 내리는 예약을 건다. 배너를 내리는 것이 곧 보조 레이아웃이
	 * 나타나는 시점이라, 순수 계층에 타이머를 두지 않고 여기서만 시간을 다룬다.
	 */
	private applyIntro(isVisible: boolean, text: string): void {
		this._introText.set(text);
		this._isIntroVisible.set(isVisible);

		this.clearIntroTimeout();
		if (isVisible === false) {
			return;
		}
		const seconds = this.props.introSeconds > 0 ? this.props.introSeconds : 0;
		this._introTimeoutId = this.async.setTimeout(() => {
			this._introTimeoutId = undefined;
			this._presenter?.endIntro();
		}, seconds * 1000);
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
			onClick: () => { PuzzleBoardStage.instance.requestPause(); },
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
				display: this.props.showLayoutDebug === true ? 'flex' : 'none',
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
	 * 바깥을 Pressable 로 감싸 **칸이 받지 못한 뗌**을 받는다. 칸 Pressable 은
	 * `propagateClick: false` 라 보통은 여기까지 올라오지 않지만, 올라오더라도
	 * 놓기 판정이 깨지지 않도록 `onBoardAreaRelease()` 는 "밖" 으로 단정하지 않는다.
	 */
	private createBoardArea(): UINode {
		return Pressable({
			children: [this.createBoardPanel()],
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

	/**
	 * 본 격자.
	 *
	 * **`DynamicList` 로 그린다 - 패널 크기 한도(64kB) 때문이다.**
	 *
	 * 예전에는 최대 격자(9×9)의 칸 81개를 `initializeUI()` 에서 전부 만들어 두고 격자 밖은
	 * `display: none` 으로 숨겼다. 그런데 `initializeUI()` 가 돌려주는 트리는 통째로
	 * 직렬화되어 패널에 실리므로, 칸 하나의 트리(누름 껍데기·얼굴·글자·무늬·테두리·고리)가
	 * 81벌 복제되어 86kB 가 되었고 **패널이 아예 만들어지지 않았다**
	 * (`Failed to instantiate ... exceeds the maximum allowed size of 64kB`).
	 *
	 * `DynamicList` 는 `renderItem` 을 런타임에 부르므로 트리에는 **템플릿 한 벌만** 실린다.
	 * 그래서 9×9 를 유지하면서도 패널 크기가 한도 아래로 내려간다.
	 *
	 * 칸의 내용은 여전히 `_cellBindings[슬롯]` 이 나른다. 목록이 나르는 것은 자리 번호뿐이라
	 * 칸 하나가 바뀔 때 목록을 다시 그리지 않는다 - 드래그 중의 갱신 비용은 예전과 같다.
	 * 목록의 길이가 곧 격자의 크기이므로 **행·칸의 `display` 숨김이 필요 없어졌다.**
	 *
	 * **칸은 언제나 정사각형이다.** 격자 상자를 판의 비율대로 잡는 것이 그 방법이다 -
	 * 4행 8열이면 가로 100% · 세로 50%, 9행 3열이면 세로 100% · 가로 33% 다
	 * (`computeGridBox`). 판이 정사각형이라 두 퍼센트가 같은 길이 단위이므로, 그 안에서
	 * 행·칸을 `flex: 1` 로 나누면 칸이 정확한 정사각형으로 떨어진다.
	 *
	 * 예전에는 격자 상자를 판과 같은 정사각형으로 두고 행·열을 `flex: 1` 로 나눴다.
	 * 그러면 4행 8열(정렬)이나 5행 6열(색 채우기) 같은 판에서 칸이 눌리거나 늘어나
	 * 연결 퍼즐의 경로와 러시아워의 차량 비율이 실제 판과 달라 보였다.
	 */
	private createGrid(): UINode {
		const rows = DynamicList<number>({
			data: this._rowIndices,
			renderItem: (row: number) => this.getGridRowNode(row),
			style: {
				width: '100%',
				height: '100%',
				flexDirection: 'column',
			},
		});

		// **크기는 정사각형 판 대비 퍼센트다.** 판이 정사각형이라 가로 %와 세로 %가 같은
		// 길이 단위이고(`PuzzleUI_RelativeLayout` 머리말 §2), 그래서 4행 8열이든 9x9든
		// 칸이 정확한 정사각형으로 떨어진다. 행·열 수는 레벨마다 다르므로 Binding 으로 나른다.
		//
		// 판 그림은 격자 **뒤에** 깔린다. 칸 사이 간격으로 비쳐 보이므로 나무판·회로기판처럼
		// 판 전체의 재질을 표현할 때 쓴다 (칸마다 다른 그림은 `cell.texture` 다).
		return View({
			children: [this.createBoardTextureLayer(), rows],
			style: {
				width: this._gridWidth,
				height: this._gridHeight,
			},
		});
	}

	/**
	 * 보드 메인 패널 - **본 격자 영역 안에서 가장 큰 정사각형**이다.
	 *
	 * 세로로 긴 폰에서는 `boardWidthPercent`(화면 가로) 가, 가로로 긴 화면에서는
	 * `boardHeightPercent`(영역 세로) 가 크기를 정한다. 둘 중 작은 쪽이 자동으로 이기므로
	 * 화면 방향을 보고 분기할 필요가 없다 (`PuzzleUI_RelativeLayout` 머리말 §1).
	 *
	 * 격자는 이 안에 판 비율대로 앉는다. 정사각형이 아닌 판(정렬 퍼즐의 4행 8열)은 위아래에
	 * 자리가 남는데, 패널 바탕이 없으면 그 남는 자리가 화면 배경과 구분되지 않아 판의
	 * 경계가 사라진다. 그래서 패널을 격자와 따로 그린다.
	 */
	private createBoardPanel(): UINode {
		return View({
			children: [this.createGrid()],
			style: {
				// **정사각형을 만드는 한 줄.** 세로를 꽉 채우되 가로가 모자라면 가로에 맞춘다 -
				// CSS 의 `min(가로, 세로)` 와 같고, 실기 프로브에서 확인한 동작이다
				// (`PuzzleUI_RelativeLayout` 머리말 §1). 화면 방향에 따른 분기가 필요 없다.
				height: percentText(this._layout.boardHeightPercent),
				aspectRatio: 1,
				maxWidth: percentText(this._layout.boardWidthPercent),
				borderRadius: this.px(BOARD_PANEL_CORNER_RADIUS),
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: COLOR_BOARD_PANEL,
			},
		});
	}

	private createBoardTextureLayer(): UINode {
		const library = PuzzleTextureLibrary.instance;
		const source = Binding.derive(
			[this._boardTexture, this._textureEpoch],
			(key: PuzzleTextureKey, _epoch: number) => library.resolve(key),
		);
		const hasTexture = Binding.derive(
			[this._boardTexture, this._textureEpoch],
			(key: PuzzleTextureKey, _epoch: number) => library.resolve(key) !== null,
		);
		// 그림이 없으면 노드를 올리지 않는다 - `createTextureLayer()` 와 같은 이유다
		return UINode.if(hasTexture, Image({
			source: source,
			style: {
				position: 'absolute',
				width: '100%',
				height: '100%',
				borderRadius: this.px(BOARD_CORNER_RADIUS),
				resizeMode: 'cover',
			},
		}));
	}

	/** 행 노드를 자리마다 한 번만 만든다 - 이유는 `_rowNodeCache` 주석 참고 */
	private getGridRowNode(row: number): UINode {
		let node = this._rowNodeCache[row];
		if (node === undefined) {
			node = DynamicList<number>({
				data: this._colIndices,
				renderItem: (col: number) => this.getGridCellNode(row, col),
				style: { flex: 1, width: '100%', flexDirection: 'row' },
			});
			this._rowNodeCache[row] = node;
		}
		return node;
	}

	private getGridCellNode(row: number, col: number): UINode {
		const slot = row * PUZZLE_BOARD_MAX_COLS + col;
		let node = this._cellNodeCache[slot];
		if (node === undefined) {
			node = this.createGridCell(this._cellBindings[slot], row, col);
			this._cellNodeCache[slot] = node;
		}
		return node;
	}

	/**
	 * 칸 하나.
	 *
	 * ## 왜 `Pressable` 과 "얼굴" 을 나누는가
	 *
	 * `Pressable` 에는 **크기를 바꾸는 스타일을 절대 걸지 않는다.** 예전에는 집은 칸을
	 * `transform: scale` 로 1.1배 키웠는데, 커진 칸이 이웃 칸을 덮어 이웃의 `onEnter` 가
	 * 늦게 떴다. 손가락은 이미 옆 칸에 가 있는데 조각이 따라오지 않아 **드래그가 끈적하게**
	 * 느껴지는 원인이었다.
	 *
	 * 그래서 `Pressable` 은 격자 한 칸의 자리만 지키는 투명한 껍데기로 두고, 색·테두리·그림자·
	 * 확대는 그 안에 겹쳐 놓은 층들이 맡는다. 입력 판정 영역은 언제나 칸 하나 그대로다.
	 *
	 * ## 왜 테두리와 무늬를 얼굴에서 떼어 냈는가
	 *
	 * 조작 강조(집음/놓을 자리/길)는 칸마다 테두리 두께를 0 -> 3 / 4 / 5 px 로 바꿔 놓는다.
	 * 이것을 **얼굴 자신의 `borderWidth` 로 주면 얼굴의 내용 상자가 그만큼 줄어든다.**
	 * 드래그 한 번에 여러 칸의 테두리가 켜졌다 꺼지면서 칸 안의 글자와 무늬가 매번 다시
	 * 자리를 잡았고, 그것이 "드래그 중에 판 격자가 조금씩 어긋난다" 로 보였다.
	 *
	 * 지금은 테두리와 무늬를 **`position: absolute` 층**으로 따로 그린다. 절대 배치된 층은
	 * 형제의 배치에 영향을 주지 않으므로, 드래그 내내 격자의 기하는 한 픽셀도 움직이지 않는다.
	 */
	private createGridCell(binding: Binding<PuzzleBoardCellView>, row: number, col: number): UINode {
		const slot = row * PUZZLE_BOARD_MAX_COLS + col;

		/**
		 * 칸의 스냅샷과 "짚고 있는가" 를 렌더 시점에 합친다.
		 *
		 * 둘을 따로 두는 이유는 서로 덮어쓰지 않게 하기 위해서다 - 세션이 칸을 다시 칠해도
		 * 누름 표시는 지워지지 않고, 누름 표시가 퍼즐이 준 강조를 가리지도 않는다.
		 * 누름은 **이 자리의 플래그**에서만 파생한다 - 전역 슬롯 번호에서 파생하면
		 * 짚은 자리가 옮겨질 때마다 81칸 전부가 다시 계산된다 (필드 주석 참고).
		 */
		const pressedFlag = this._pressedSlotFlags[slot];
		const fromAccent = <T>(map: (accent: EBoardCellAccent) => T) => Binding.derive(
			[binding, pressedFlag],
			(cell: PuzzleBoardCellView, isPressed: boolean) => map(mergePressAccent(cell.accent, isPressed)),
		);

		const scale = fromAccent(getAccentScale);
		const inset = this.cellGapPercent;

		// 집은 조각을 손가락 위로 띄운다 - 이유와 거리 규칙은 "Drag accent presentation" 머리말 참고.
		// **띄우기는 퍼즐이 켠 경우에만 한다** (`_liftEnabled` - 지금은 레이저만 켠다).
		// 나머지 퍼즐은 예전처럼 확대·테두리·고리로만 강조한다.
		// `_rowCount`/`_liftEnabled` 는 레벨 로드 때만 바뀌므로 드래그 중 전체 재계산은 없다.
		const lift = Binding.derive(
			[binding, pressedFlag, this._grabLift, this._liftEnabled],
			(cell: PuzzleBoardCellView, isPressed: boolean, liftPixels: number, isLiftEnabled: boolean) =>
				(isLiftEnabled && mergePressAccent(cell.accent, isPressed) === EBoardCellAccent.GRABBED
					? -liftPixels
					: 0),
		);

		const face = View({
			children: [
				// 그림이 색 위에, 글자 아래에 온다 - 텍스처가 있어도 라벨은 읽혀야 한다
				this.createTextureLayer<PuzzleBoardCellView>(
					binding, (cell) => cell.texture, (cell) => cell.fill, CELL_CORNER_RADIUS),
				// 글자가 없는 칸은 Text 노드를 올리지 않는다 - 대부분의 퍼즐에서 대부분의 칸이
				// 빈 라벨이라, 상시 마운트하면 81개의 Text 가 렌더·글자 배치 비용만 낸다
				UINode.if(
					binding.derive((cell) => cell.label !== ''),
					Text({
						text: binding.derive((cell) => cell.label),
						style: {
							color: binding.derive((cell) => toColor(cell.labelColor)),
							// 글자는 칸 크기를 따라간다 - 판이 작을수록 작게, 클수록 크게.
							// 파생 하나를 모든 칸이 나눠 쓴다 (`_cellFontSize` 주석).
							fontSize: this._cellFontSize,
							fontWeight: 'bold',
							textAlign: 'center',
							width: '100%',
							// 방향이 있는 부품은 글자를 돌려 그린다 - `L` 은 직각 코너를, `T` 는 막힌 변을
							// 그대로 본뜬 모양이라 돌리는 것만으로 네 방향이 구분된다
							transform: [{ rotate: binding.derive((cell) => getGlyphRotation(cell.glyph)) }],
						},
					}),
				),
			],
			style: {
				width: '100%',
				height: '100%',
				borderRadius: this.px(CELL_CORNER_RADIUS),
				alignItems: 'center',
				justifyContent: 'center',
				opacity: Binding.derive(
					[binding, pressedFlag],
					(cell: PuzzleBoardCellView, isPressed: boolean) =>
						getAccentOpacity(cell.isVisible, mergePressAccent(cell.accent, isPressed)),
				),
				backgroundColor: binding.derive((cell) => toColor(cell.fill)),
				// 집은 조각은 위로 떠오르고 살짝 커져서 손가락에 가리지 않는다.
				// 입력 판정은 바깥 Pressable 이 하므로 여기서 아무리 움직여도 안전하다.
				transform: [{ translateY: lift }, { scale: scale }],
				// 그림자는 쓰지 않는다 - 부드러운 그림자는 모바일에서 가장 비싼 스타일이라
				// 81칸이 저마다 선언하면 판 전체가 무거워진다. 집은 조각의 강조는
				// 확대(scale)·굵은 테두리·고리로 충분하다.
			},
		});

		return Pressable({
			children: [
				face,
				this.createGlyphFrame(binding, scale, CELL_CORNER_RADIUS, inset),
				this.createBorderOverlay(
					Binding.derive(
						[binding, pressedFlag],
						// 테두리 두께는 기준 캔버스 픽셀로 튜닝한 값이라 실제 해상도로 환산한다
						(cell: PuzzleBoardCellView, isPressed: boolean) => this.scaleBorderWidth(
							getAccentBorderWidth(mergePressAccent(cell.accent, isPressed), cell.isHighlighted)),
					),
					Binding.derive(
						[binding, pressedFlag],
						(cell: PuzzleBoardCellView, isPressed: boolean) =>
							getAccentBorderColor(mergePressAccent(cell.accent, isPressed), cell.isHighlighted),
					),
					scale,
					CELL_CORNER_RADIUS,
					inset,
				),
				this.createGrabRing(
					fromAccent((accent) => (accent === EBoardCellAccent.GRABBED ? 'flex' : 'none')),
					this.cellGapValue),
			],
			onPress: () => this.onCellPress(row, col),
			onEnter: () => this.onCellEnter(row, col),
			onExit: () => this.onCellExit(row, col),
			onRelease: () => this.onCellRelease(),
			propagateClick: false,
			style: {
				flex: 1,
				// 칸 사이 간격은 `margin` 이 아니라 `padding` 으로 낸다.
				//
				// margin 이면 간격이 **어느 칸에도 속하지 않는 죽은 영역**이 되어, 옆 칸으로
				// 끌고 갈 때 손가락이 그 위를 지나는 동안 "판 밖" 으로 읽힌다. 그 순간 끌던
				// 조각이 사라졌다 나타나 깜빡였다. padding 이면 간격까지 칸의 입력 영역이라
				// 이웃 칸끼리 맞닿고, 손가락은 언제나 어느 한 칸 위에 있다.
				//
				// %로 주는 이유: 칸이 정사각형이라 네 방향이 같은 길이가 되고, 겹쳐 놓는
				// 층들도 같은 %를 쓰면 얼굴에 정확히 맞는다 (`cellGapPercent`).
				padding: inset,
				alignItems: 'center',
				justifyContent: 'center',
			},
		});
	}

	/**
	 * 칸 사이 간격 - **칸 하나 대비 %** 다.
	 *
	 * 칸이 정사각형이므로 네 방향이 모두 같은 길이가 된다. Yoga 가 여백 퍼센트를 네 방향
	 * 모두 부모의 *가로* 로 계산하는 함정(`PuzzleUI_Layout` 머리말 §4)이 여기서는 오히려
	 * 도움이 된다 - 부모(칸)가 정사각형이라 가로 기준이 곧 세로 기준이다.
	 *
	 * 예전에는 판 크기에서 픽셀로 뽑았다. 그러면 9x9 판에서 간격이 칸의 절반을 먹었고,
	 * 무엇보다 그 픽셀이 화면에 몇 배로 그려지는지 알 수 없었다. 칸 대비 %로 주면 판이
	 * 몇 칸이든 간격이 칸에서 차지하는 몫이 같다.
	 */
	private get cellGapValue(): number {
		// `initializeUI()` 안에서만 불리므로 `this.props` 가 있지만, 없을 때도 죽지 않게 둔다 -
		// 필드 초기화에서 prop 을 읽어 컴포넌트가 통째로 만들어지지 않은 전례가 있다 (`_pixelRatio`)
		const requested = this.props === undefined ? DEFAULT_CELL_GAP_PERCENT : this.props.cellGapPercent;
		return clampNumber(requested, 0, 20);
	}

	/** 위 값을 스타일에 그대로 넣는 문자열로 */
	private get cellGapPercent(): string {
		return percentText(this.cellGapValue);
	}

	/** 지금 격자에서 칸 글자의 크기 (px). 칸이 정사각형이라 한 변만 있으면 된다 */
	private cellFontSize(cellSide: number): number {
		// 판이 아직 없으면 보드 영역 높이를 기준으로 둔다 - 어차피 그려지지 않는 값이다
		const side = cellSide > 0 ? cellSide : this.auxHeightUnits;
		return fitFontSize(side, { ratio: 0.5, minimum: 12, maximum: 44, scale: this._profile.fontScale, pixelScale: this.pxScale });
	}

	/**
	 * 집은 조각을 띄울 거리 (px) - **칸 한 변 × 퍼즐이 준 배수** 그대로다.
	 *
	 * 칸 크기는 이미 실제 해상도 픽셀이므로 해상도 배율을 따로 곱하지 않는다.
	 * 예전의 상·하한 클램프(64~150 기준픽셀)는 버렸다 - 배수가 에디터에서 조정하는
	 * 파라미터가 되면서, 클램프가 조정값을 조용히 무시하는 함정이 되기 때문이다.
	 */
	private grabLiftPixels(cellSide: number): number {
		const side = cellSide > 0 ? cellSide : this.auxHeightUnits;
		return Math.round(Math.max(0, side * this._grabLiftRatio));
	}

	/**
	 * 조작 강조 테두리 - **얼굴과 겹쳐 놓는 절대 배치 층**이다.
	 *
	 * 테두리를 얼굴에 직접 주면 얼굴의 내용 상자가 두께만큼 줄어들어 안의 글자가 움직인다.
	 * 드래그 중에는 여러 칸의 강조가 칸 이동마다 켜졌다 꺼지므로 그 흔들림이 누적돼
	 * 격자가 어긋나 보였다. 절대 배치 층은 형제의 배치를 건드리지 않는다.
	 *
	 * `inset` 은 칸 사이 간격이다. 절대 배치는 `Pressable` 의 바깥 상자를 기준으로 하므로,
	 * 그만큼 안으로 밀어야 얼굴과 정확히 겹친다.
	 */
	private createBorderOverlay(
		borderWidth: Bindable<number>,
		borderColor: Bindable<Color>,
		scale: Bindable<number>,
		cornerRadius: number,
		inset: string,
	): UINode {
		return View({
			children: [],
			style: {
				position: 'absolute',
				left: inset,
				top: inset,
				right: inset,
				bottom: inset,
				// 모서리 둥글기는 기준 캔버스 픽셀 - 좌표 단위로 환산해야 얼굴과 겹쳐 보인다
				borderRadius: this.px(cornerRadius),
				borderWidth: borderWidth,
				borderColor: borderColor,
				transform: [{ scale: scale }],
			},
		});
	}

	/**
	 * 부품 무늬 - **광선을 되돌리는 변에만 두꺼운 테두리를 그린다** (`EBoardCellGlyph`).
	 *
	 * 레이저 퍼즐의 직각 삼각형은 직각 코너에 붙은 두 변이, T자는 막힌 한 변이 여기 그려진다.
	 * 그것만으로 "이 부품은 위쪽으로는 광선을 보내지 않는다" 가 보인다.
	 * 이미지 애셋 없이 칸 자체를 무늬로 쓰므로 리소스를 늘리지 않는다.
	 */
	private createGlyphFrame(
		binding: Binding<PuzzleBoardCellView> | Binding<PuzzleBoardItemView>,
		scale: Bindable<number>,
		cornerRadius: number,
		inset: string,
	): UINode {
		// 무늬 테두리 두께도 기준 캔버스 픽셀이라 좌표 단위로 환산한다
		const edge = (pick: (edges: BoardGlyphEdges) => boolean) =>
			binding.derive((view: { glyph: EBoardCellGlyph }) =>
				(pick(getGlyphBlockedEdges(view.glyph)) ? this.px(BOARD_GLYPH_EDGE_WIDTH) : 0));

		// 무늬가 없는 칸은 노드를 올리지 않는다 - 무늬는 레이저 퍼즐만 쓰므로,
		// 나머지 퍼즐에서는 칸마다 빈 테두리 View 를 상시 마운트할 이유가 없다
		const hasGlyph = binding.derive(
			(view: { glyph: EBoardCellGlyph }) => view.glyph !== EBoardCellGlyph.NONE);

		return UINode.if(hasGlyph, View({
			children: [],
			style: {
				position: 'absolute',
				left: inset,
				top: inset,
				right: inset,
				bottom: inset,
				borderRadius: this.px(cornerRadius),
				borderTopWidth: edge((edges) => edges.top),
				borderBottomWidth: edge((edges) => edges.bottom),
				borderLeftWidth: edge((edges) => edges.left),
				borderRightWidth: edge((edges) => edges.right),
				borderColor: COLOR_GLYPH_EDGE,
				transform: [{ scale: scale }],
			},
		}));
	}

	/** 텍스처 등록이 바뀌었다 - 세대를 올려 이미 그려진 칸들의 그림을 다시 계산하게 한다 */
	private bumpTextureEpoch(): void {
		this._textureEpochValue++;
		this._textureEpoch.set(this._textureEpochValue);
	}

	/**
	 * 칸·슬롯 얼굴 위에 까는 그림 한 장.
	 *
	 * 색(`fill`) 위에 덮이므로, 그림이 없는 요소는 예전과 똑같이 색으로만 그려진다.
	 * `tintTexturesWithFill` 을 켜면 회색조 그림 한 장이 칸 색으로 물들어 여러 상태를
	 * 한 장으로 표현할 수 있다.
	 *
	 * **`source` 가 칸 스냅샷과 텍스처 세대 둘 다에서 파생하는 이유**는 등록 순서 때문이다.
	 * CoreAPI 가 이 패널보다 늦게 에셋을 넣어도 세대가 오르면 다시 계산된다.
	 */
	private createTextureLayer<T>(
		binding: Binding<T>,
		getTexture: (view: T) => PuzzleTextureKey,
		getFill: (view: T) => PuzzleBoardColor,
		cornerRadius: number,
	): UINode {
		const library = PuzzleTextureLibrary.instance;
		// `DerivedBinding` 에서 다시 파생할 수는 없으므로 원본에서 두 번 파생한다
		const source = Binding.derive(
			[binding, this._textureEpoch],
			(view: T, _epoch: number) => library.resolve(getTexture(view)),
		);
		const hasTexture = Binding.derive(
			[binding, this._textureEpoch],
			(view: T, _epoch: number) => library.resolve(getTexture(view)) !== null,
		);

		// 그림이 없는 요소는 `Image` **노드 자체를 올리지 않는다** (`UINode.if`).
		// 예전에는 81칸 전부에 빈 Image 를 상시 마운트하고 `display` 로만 숨겼는데,
		// 그림을 안 쓰는 퍼즐에서도 칸마다 Image 노드가 트리에 남아 렌더·갱신 비용을 냈다.
		// 모바일 UI 의 기본 수칙대로 "안 보이는 것은 트리에서 뺀다".
		return UINode.if(hasTexture, Image({
			source: source,
			style: {
				position: 'absolute',
				width: '100%',
				height: '100%',
				borderRadius: this.px(cornerRadius),
				// 판이 정사각형이 아닌 퍼즐에서도 칸이 늘어나 보이지 않도록 잘라 채운다
				resizeMode: 'cover',
				tintColor: this.props.tintTexturesWithFill === true
					? binding.derive((view) => toColor(getFill(view)))
					: undefined,
				tintOperation: 'multiply',
			},
		}));
	}

	/**
	 * 집은 조각을 감싸는 광채 고리.
	 *
	 * 칸 위에 겹쳐 그리는 테두리만 있는 `View` 다. `Pressable` 의 자식이라 입력을 가로채지
	 * 않는다 - 격자 전체를 덮는 오버레이를 따로 두면 그 아래 칸들이 눌리지 않게 된다.
	 *
	 * **애니메이션을 걸지 않는다.** 예전에는 공유 `AnimatedBinding` 의 보간 두 개
	 * (opacity·scale)를 모든 칸의 고리가 구독해, 81칸 기준 보간 소비자만 162개가
	 * 패널에 등록되었다. 고리는 뜨고 지는 것만으로 충분히 보이므로 고정값으로 그린다.
	 */
	private createGrabRing(display: Bindable<'none' | 'flex'>, insetPercent: number): UINode {
		// 고리는 얼굴 바로 밖에 붙는다. 절대 배치 기준은 간격까지 포함한 칸 상자이므로
		// 간격만큼 안으로 들어간 뒤 약간만 밖으로 번진다. 간격이 칸 대비 %라 번짐도 %다.
		const offset = percentText(Math.max(0, insetPercent - GRAB_RING_SPREAD_PERCENT));
		return View({
			children: [],
			style: {
				position: 'absolute',
				left: offset,
				top: offset,
				right: offset,
				bottom: offset,
				borderRadius: this.px(12),
				borderWidth: this.px(2),
				borderColor: COLOR_GRABBED,
				display: display,
				opacity: GRAB_RING_OPACITY,
			},
		});
	}

	/**
	 * 화면 아랫부분 - 보조 레이아웃과 시작 배너가 같은 자리를 쓴다.
	 *
	 * 배너가 떠 있는 동안 보조 레이아웃은 `display: none` 이다. 배너가 내려가야
	 * 보조 레이아웃이 나타난다는 요구를 이 한 쌍의 `display` 로 지킨다.
	 */
	private createAuxArea(): UINode {
		return Pressable({
			children: [this.createIntroBanner(), this.createAuxContent()],
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
				display: this._isIntroVisible.derive((visible) => (visible ? 'flex' : 'none')),
			},
		});
	}

	private createAuxContent(): UINode {
		return View({
			children: [this.createActionButton(), this.createItemTray(), this.createSide(), this.createResetButton()],
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
		return Pressable({
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
				display: this._hasAction.derive((hasAction) => (hasAction ? 'flex' : 'none')),
			},
		});
	}

	/**
	 * 오브젝트 트레이 - 판으로 끌어다 쓰는 오브젝트를 늘어놓는다 (레이저의 미배치 크리스탈).
	 *
	 * **격자와 달리 누를 수 있다.** 슬롯에서 시작한 드래그는 그대로 격자 칸의 `onEnter` 로
	 * 이어지므로, 세션은 트레이에서 집었는지 판에서 집었는지 신경 쓸 필요가 없다.
	 *
	 * ## 왜 슬라이드바인가
	 *
	 * 부품 하나의 크기는 화면이 정한다 - 트레이 상자를 채우되 **화면 아래 절반의 20%**
	 * 밑으로는 내려가지 않는다 (`itemSlotSide`). 예전처럼 슬롯 수로 트레이 폭을 나누면
	 * 레이저의 인벤토리(7칸)에서 부품이 손가락보다 작아져 집을 수가 없었다. 그래서 크기를
	 * 지키고, 한 줄에 다 들어가지 않으면 좌우 화살표로 **넘겨 본다.** 다 들어가는 경우에는
	 * 화살표를 그리지 않는다 - `_hasItemPaging` 이 그 판정이고, 그때는 화살표 폭까지 슬롯이 쓴다.
	 */
	private createItemTray(): UINode {
		const slots = DynamicList<number>({
			data: this._itemIndices,
			renderItem: (index: number) => this.getItemSlotNode(index),
			style: {
				flex: 1,
				height: '100%',
				flexDirection: 'row',
				alignItems: 'center',
				justifyContent: 'center',
				// 슬롯이 트레이 폭을 넘어가면 마지막 슬롯이 화면 밖으로 밀려 집을 수 없게 된다
				overflow: 'hidden',
			},
		});

		return View({
			children: [
				this.createTrayArrow(TRAY_ARROW_PREV_LABEL, -1, this._canPagePrev),
				slots,
				this.createTrayArrow(TRAY_ARROW_NEXT_LABEL, 1, this._canPageNext),
			],
			style: {
				flex: 1,
				height: TRAY_HEIGHT_PERCENT,
				marginLeft: '2%',
				flexDirection: 'row',
				alignItems: 'center',
				display: this._hasItems.derive((hasItems) => (hasItems ? 'flex' : 'none')),
			},
		});
	}

	/**
	 * 트레이를 넘기는 좌우 화살표.
	 *
	 * 넘길 것이 없으면(`_hasItemPaging` 이 false) 자리조차 만들지 않는다 - 자리만 비워 두면
	 * 부품 한 칸이 들어갈 폭을 화살표가 계속 붙들고 있게 된다.
	 * 끝 페이지에서는 흐리게 그려 **더 넘어갈 곳이 없다**를 보인다. 감아 돌지 않는 이유는
	 * 어디까지 봤는지를 잃지 않기 위해서다.
	 *
	 * 끌던 부품을 화살표 위에서 떼는 경우도 리셋 버튼과 같은 규칙으로 마감한다 -
	 * 여기는 판 밖이 확실하므로 부품이 인벤토리로 돌아간다.
	 */
	private createTrayArrow(label: string, step: number, isEnabled: Binding<boolean>): UINode {
		// 화살표는 트레이 높이에 비례한다 - 슬롯 하나만큼의 폭을 둘이 나눠 가지지 않도록
		// 슬롯보다 확실히 좁게 잡는다. 글자 크기는 그 폭에서 나온다.
		const width = this.units(traySlotFraction(this._layout, this._screenAspect).ofHeight
			* TRAY_ARROW_WIDTH_USAGE);
		return Pressable({
			children: [
				Text({
					text: label,
					style: {
						color: COLOR_TEXT,
						fontSize: fitFontSize(width, {
							ratio: 0.62, minimum: 18, maximum: 40, scale: this._profile.fontScale, pixelScale: this.pxScale,
						}),
						fontWeight: 'bold',
						textAlign: 'center',
						width: '100%',
					},
				}),
			],
			onClick: () => { this.applyItemPage(this._itemPage + step); },
			onRelease: () => this.onAuxAreaRelease(),
			propagateClick: false,
			style: {
				height: percentText(TRAY_ARROW_HEIGHT_PERCENT),
				aspectRatio: TRAY_ARROW_WIDTH_USAGE,
				borderRadius: this.px(10),
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: COLOR_RESET_BUTTON,
				opacity: isEnabled.derive((canPage) => (canPage ? 1 : TRAY_ARROW_DISABLED_OPACITY)),
				display: this._hasItemPaging.derive((hasPaging) => (hasPaging ? 'flex' : 'none')),
			},
		});
	}

	/** 트레이 슬롯 노드도 자리마다 한 번만 만든다 (`_rowNodeCache` 주석) */
	private getItemSlotNode(index: number): UINode {
		let node = this._itemNodeCache[index];
		if (node === undefined) {
			node = this.createItemSlot(this._itemBindings[index], index);
			this._itemNodeCache[index] = node;
		}
		return node;
	}

	/** 트레이 슬롯. 칸과 같은 이유로 `Pressable` 과 "얼굴" 을 나눈다 */
	private createItemSlot(binding: Binding<PuzzleBoardItemView>, index: number): UINode {
		// 칸과 같은 이유로 이 슬롯의 플래그에서만 파생한다 (createGridCell 주석)
		const pressedFlag = this._pressedItemFlags[index];
		const fromAccent = <T>(map: (accent: EBoardCellAccent) => T) => Binding.derive(
			[binding, pressedFlag],
			(item: PuzzleBoardItemView, isPressed: boolean) => map(mergePressAccent(item.accent, isPressed)),
		);

		const scale = fromAccent(getAccentScale);
		// 슬롯 한 변은 레벨이 올라올 때 격자 칸 크기에 맞춰 다시 계산된다 (`_itemSlotSide`).
		// 글자도 슬롯을 따라 커진다 - "슬롯은 큰데 글자만 작은" 것을 만들지 않는다.
		const side = this._itemSlotSide;
		const labelSize = side.derive((slotSide) =>
			fitFontSize(slotSide, { ratio: 0.44, minimum: 14, maximum: 40, scale: this._profile.fontScale, pixelScale: this.pxScale }));

		const face = View({
			children: [
				this.createTextureLayer<PuzzleBoardItemView>(
					binding, (item) => item.texture, (item) => item.fill, ITEM_CORNER_RADIUS),
				Text({
					text: binding.derive((item) => item.label),
					style: {
						color: binding.derive((item) => toColor(item.labelColor)),
						fontSize: labelSize,
						fontWeight: 'bold',
						textAlign: 'center',
						width: '100%',
						// 판 위와 같은 규칙으로 방향을 보인다 - 집기 전에 고를 수 있게
						transform: [{ rotate: binding.derive((item) => getGlyphRotation(item.glyph)) }],
					},
				}),
				Text({
					text: binding.derive((item) => item.caption),
					style: {
						color: binding.derive((item) => toColor(item.labelColor)),
						// `DerivedBinding` 에서 다시 파생할 수 없으므로 원본(슬롯 크기)에서 한 번 더 파생한다
						fontSize: side.derive((slotSide) => Math.max(10, Math.round(
							fitFontSize(slotSide, { ratio: 0.44, minimum: 14, maximum: 40, scale: this._profile.fontScale, pixelScale: this.pxScale })
							* 0.45))),
						textAlign: 'center',
						width: '100%',
						opacity: 0.8,
					},
				}),
			],
			style: {
				width: '100%',
				height: '100%',
				borderRadius: this.px(ITEM_CORNER_RADIUS),
				alignItems: 'center',
				justifyContent: 'center',
				opacity: Binding.derive(
					[binding, pressedFlag],
					(item: PuzzleBoardItemView, isPressed: boolean) =>
						getAccentOpacity(item.isVisible, mergePressAccent(item.accent, isPressed)),
				),
				backgroundColor: binding.derive((item) => toColor(item.fill)),
				transform: [{ scale: scale }],
				// 그림자는 쓰지 않는다 - 칸과 같은 이유다 (createGridCell 의 얼굴 주석)
			},
		});

		// 슬롯 간격도 슬롯 대비 % - 슬롯이 정사각형이라 칸과 같은 규칙이 그대로 적용된다
		const slotGap = percentText(ITEM_SLOT_GAP_PERCENT);
		return Pressable({
			children: [
				face,
				this.createGlyphFrame(binding, scale, ITEM_CORNER_RADIUS, slotGap),
				this.createBorderOverlay(
					Binding.derive(
						[binding, pressedFlag],
						// 테두리 두께는 기준 캔버스 픽셀로 튜닝한 값이라 실제 해상도로 환산한다
						(item: PuzzleBoardItemView, isPressed: boolean) => this.scaleBorderWidth(
							getAccentBorderWidth(mergePressAccent(item.accent, isPressed), item.isHighlighted)),
					),
					Binding.derive(
						[binding, pressedFlag],
						(item: PuzzleBoardItemView, isPressed: boolean) =>
							getAccentBorderColor(mergePressAccent(item.accent, isPressed), item.isHighlighted),
					),
					scale,
					ITEM_CORNER_RADIUS,
					slotGap,
				),
				this.createGrabRing(
					fromAccent((accent) => (accent === EBoardCellAccent.GRABBED ? 'flex' : 'none')),
					ITEM_SLOT_GAP_PERCENT),
			],
			onPress: () => { this._presenter?.itemDown(index); },
			onRelease: () => this.onCellRelease(),
			propagateClick: false,
			style: {
				// **트레이 높이를 꽉 채우는 정사각형이다.** 예전에는 픽셀로 못박았는데, 그
				// 픽셀이 화면에 몇 배로 그려지는지 알 수 없었다. 넘치는 슬롯은 크기를 줄이는
				// 대신 넘겨 본다 (`traySlotsPerPage`) - 그래서 여기서 폭을 걱정할 필요가 없다.
				height: '100%',
				aspectRatio: 1,
				// 칸과 같은 이유로 margin 이 아니라 padding 이다 (죽은 영역을 만들지 않는다)
				padding: slotGap,
				alignItems: 'center',
				justifyContent: 'center',
			},
		});
	}

	/** 정보 미니 격자 - 스위치의 3×3 스위치 영역 (PUZ_08 §9.5). 표시 전용이라 누를 수 없다 */
	private createSide(): UINode {
		// 글자 크기에만 쓰는 좌표 단위 - 상자 자체는 아래에서 퍼센트로 잡는다
		const sideSide = this.units(auxAreaFraction(this._layout) * SIDE_GRID_HEIGHT_USAGE);

		// 본 격자와 같은 이유로 `DynamicList` 다 (`createGrid()` 주석)
		const grid = DynamicList<number>({
			data: this._sideRowIndices,
			renderItem: (row: number) => this.getSideRowNode(row),
			// 미니 격자도 정사각형이다 - 세로를 채우고 가로를 거기에 맞춘다
			style: { height: '82%', aspectRatio: 1, flexDirection: 'column', marginTop: '2%' },
		});

		const label = Text({
			text: this._sideLabel,
			style: {
				color: COLOR_TEXT,
				fontSize: fitFontSize(sideSide, { ratio: 0.14, minimum: 11, maximum: 20, scale: this._profile.fontScale, pixelScale: this.pxScale }),
				textAlign: 'center',
				width: '100%',
				opacity: 0.8,
			},
		});

		return View({
			children: [label, grid],
			style: {
				height: '84%',
				marginLeft: '3%',
				alignItems: 'center',
				display: this._hasSide.derive((hasSide) => (hasSide ? 'flex' : 'none')),
			},
		});
	}

	/** 미니 격자의 행/칸 노드도 본 격자와 같은 이유로 재사용한다 (`_rowNodeCache` 주석) */
	private getSideRowNode(row: number): UINode {
		let node = this._sideRowNodeCache[row];
		if (node === undefined) {
			node = DynamicList<number>({
				data: this._sideColIndices,
				renderItem: (col: number) => this.getSideCellNode(row, col),
				style: { flex: 1, width: '100%', flexDirection: 'row' },
			});
			this._sideRowNodeCache[row] = node;
		}
		return node;
	}

	private getSideCellNode(row: number, col: number): UINode {
		const slot = row * PUZZLE_BOARD_SIDE_MAX_COLS + col;
		let node = this._sideCellNodeCache[slot];
		if (node === undefined) {
			node = this.createSideCell(this._sideCellBindings[slot]);
			this._sideCellNodeCache[slot] = node;
		}
		return node;
	}

	/** 정보 미니 격자의 칸 하나 - 표시 전용이라 색과 진하기만 있다 */
	private createSideCell(binding: Binding<PuzzleBoardCellView>): UINode {
		return View({
			children: [],
			style: {
				flex: 1,
				margin: '4%',
				borderRadius: this.px(6),
				opacity: binding.derive((cell) => (cell.isVisible ? 1 : HIDDEN_CELL_OPACITY)),
				backgroundColor: binding.derive((cell) => toColor(cell.fill)),
			},
		});
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
			onClick: () => { this._presenter?.requestReset(); },
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
