/**
 * Noesis Board Panel - 퍼즐 보드를 Noesis UI 로 그리는 표현 계층 (`PuzzleBoardUI_Panel` 의 후계)
 *
 * **퍼즐 쪽은 아무것도 바뀌지 않는다.** 이 패널은 `PuzzleBoardUI_Panel` 과 똑같이
 * `PuzzleBoardStage` 에 마운트된 `PuzzleBoardPresenter` 를 구독하고, 같은 입력 메서드
 * (`pointerDown` / `pointerEnter` / `pointerExit` / `pointerUp` / `itemDown` ...)를 부른다.
 * 그래서 8개 퍼즐의 `*_CoreAPI` 는 어느 패널이 그리고 있는지 모른다 - 에디터에서 어느 gizmo 를
 * 켜느냐로 Custom UI 판과 Noesis 판을 오갈 수 있다.
 *
 * 짝이 되는 XAML 은 `Documents/NoesisSample/NoesisBoard/PuzzleBoard.xaml` 이다
 * (생성기 `Documents/Tools/build_noesis_board_xaml.js`).
 *
 * ## 화면 구성 - `PuzzleBoardUI_Panel` 과 같다
 *
 *      위 여백 6% / 보드(정사각형) 7 : 보조 레이아웃 3 / 아래 여백 8% + Menu
 *
 * 띠와 보드 정사각형은 XAML 의 star 행과 Viewbox 가 나눈다 - 스크립트는 픽셀을 모른다.
 * 보드 안쪽은 **900 x 900 설계 좌표**이고, 칸은 `WrapPanel` 에 칸 번호 순서대로 들어간다.
 * 패널 폭을 `열 수 x 칸 크기` 로 주면 저절로 줄이 바뀌므로, Custom UI 판에 있던
 * "슬롯 번호(고정 9열) <-> 칸 번호(현재 열 수)" 환산이 여기에는 없다.
 *
 * ## 0단계에서 확인된 것에 맞춘 규칙 (`NoesisProbe_Panel.md`)
 *
 *   - **쓸 키는 전부 첫 대입에 넣는다.** 첫 대입 때 없던 키는 바인딩되지 않는다. 그래서 칸 81개·
 *     미니 격자 9개·트레이 8개를 처음부터 만들어 두고, 쓰지 않는 자리는 `Size` 0 으로 접는다.
 *   - **바뀐 속성만 쓴다.** `dataContext` 를 다시 대입하지 않아도 화면이 따라온다. getter 가 우리가
 *     대입한 객체를 그대로 돌려주므로 그 객체에 직접 쓴다 (`assign()` 이 같은 값은 건너뛴다).
 *   - 색은 `'#RRGGBB'` 문자열, 그림은 `ImageSource`, 보임은 `'Visible'`/`'Collapsed'` 로 넘긴다.
 *   - 터치는 `Touch*` 로도, 승격된 `Mouse*` 로도 올 수 있어 같은 누름을 한 번만 받는다 (`isDuplicateDown`).
 *
 * ## Custom UI 와 같이 쓸 때 - **한 번에 하나만 그린다**
 *
 * Noesis 패널은 Custom UI 위에 그려지고 입력도 가져간다 (0단계 T6). 다행히 기존 규약이 이미
 * "한 번에 하나만" 이다 - 일시정지·결과 화면에서는 CoreAPI 가 보드를 `unmount()` 한다. 이 패널은
 * 보드가 내려가면 `setLocalEntityVisibility(false)` 로 자신을 치워 허브(`PuzzleUI_MainPanel`)에
 * 화면과 입력을 돌려준다.
 *
 * ## 아직 옮기지 않은 것 (뒤 단계)
 *
 *   - 네이티브 드래그 조각 계층 (2단계 - `NoesisRushHour_Panel` 방식). 지금은 드래그 퍼즐도
 *     **칸 단위**(down/enter/up)로 동작한다. 그동안 그 퍼즐들의 `continuousDrag` prop 은 꺼 둔다
 *   - 그림 틴트(`tint`), 방향 부품의 그림 회전, 색 띠(`stripes`), 집은 조각 띄우기 (3단계 - 레이저)
 *
 * 누름 강조 규칙은 아직 `PuzzleBoardUI_Parts` 의 순수 함수를 빌려 쓴다. Custom UI 판을 지우는
 * 단계에서 `PuzzleBoardUI_Definitions` 로 옮긴다.
 */

import { Component, PropTypes } from 'horizon/core';
import { IUiViewModelObject, NoesisGizmo } from 'horizon/noesis';
import { ImageSource } from 'horizon/ui';
import { SubscriptionBag } from 'Utility_Events';
import {
	BOARD_COLOR_DROP_INVALID,
	BOARD_COLOR_DROP_VALID,
	BOARD_COLOR_GRABBED,
	BOARD_COLOR_HIGHLIGHT,
	BOARD_COLOR_PATH,
	EBoardCellAccent,
	EBoardCellGlyph,
	PUZZLE_BOARD_CELL_OUTSIDE,
	PUZZLE_BOARD_MAX_CELLS,
	PUZZLE_BOARD_MAX_ITEMS,
	PUZZLE_BOARD_MAX_PIECES,
	PUZZLE_BOARD_SIDE_MAX_CELLS,
	PuzzleBoardCellView,
	PuzzleBoardColor,
	PuzzleBoardItemView,
	PuzzleBoardPieceView,
	PuzzleBoardView,
	PuzzleTextureKey,
	getGlyphBlockedEdges,
} from 'PuzzleBoardUI_Definitions';
import {
	getAccentBorderWidth,
	getAccentOpacity,
	getAccentScale,
	mergePressAccent,
} from 'PuzzleBoardUI_Parts';
import {
	PuzzleBoardCellChange,
	PuzzleBoardItemChange,
	PuzzleBoardPieceChange,
	PuzzleBoardPresenter,
	PuzzleBoardPressHighlight,
	PuzzleBoardStage,
} from 'PuzzleBoardUI_Presenter';
import { PuzzleTextureLibrary } from 'PuzzleBoardUI_TextureLibrary';
import {
	AUX_AREA_FLEX,
	BOARD_AREA_FLEX,
	BOARD_BOTTOM_INSET_PERCENT,
	BOARD_HEIGHT_PERCENT,
	BOARD_TOP_INSET_PERCENT,
	BOARD_WIDTH_PERCENT,
	TRAY_MAX_ROWS,
} from 'PuzzleUI_RelativeLayout';

//#region Style constants

// 아래 셋은 PuzzleBoard.xaml 의 설계 좌표와 같아야 한다 (`build_noesis_board_xaml.js`)
const BOARD_DESIGN_SIZE = 900;
const SIDE_DESIGN_SIZE = 300;
const TRAY_SLOT_SIZE = 100;

/** 칸 사이 간격 - 칸 한 변 대비 (`PuzzleBoardUI_Panel.cellGapPercent` 의 기본값과 같다) */
const CELL_GAP_RATIO = 0.012;
/** 테두리 두께는 기준 픽셀(3/4/5)로 튜닝돼 있다. 칸 한 변 대비로 바꾼다 */
const EDGE_PER_PIXEL_RATIO = 0.011;
const GLYPH_EDGE_RATIO = 0.07;
const CELL_FONT_RATIO = 0.42;
const SIDE_FONT_RATIO = 0.5;
/** `WrapPanel` 폭에 더하는 여유 - 부동소수 오차로 마지막 칸이 다음 줄로 넘어가지 않게 한다 */
const WRAP_SLACK = 0.5;

/**
 * 조각 계층 (`PuzzleBoardPieceView`) - 칸 위를 연속으로 움직이는 조각.
 *
 * 포인터 좌표는 루트 px 로 온다 (`PassEventArgsToCommand`, MoveLab 에서 확인). 조각은 보드 설계 좌표(900)에
 * 있으므로, 루트 px → 보드 px → 설계 좌표 → 격자 좌표로 바꾼다. 보드가 루트의 어디에 몇 px 로 그려지는지는
 * XAML 의 star 값과 `PuzzleUI_RelativeLayout` 의 비율에서 그대로 계산된다 (`layoutBoardRect`).
 */
const PIECE_GAP_RATIO = 0.05;
const PIECE_FONT_RATIO = 0.36;
const PIECE_EDGE_RATIO = 0.04;
/** 놓은 자리에서 스냅 자리까지 미끄러져 들어가는 시간 - MoveLab 에서 자연스럽다고 확인된 값 */
const SNAP_TWEEN_MS = 90;
const SNAP_TWEEN_STEP_MS = 16;
const NO_PIECE = -1;
/**
 * 트레이가 차지하는 자리 - **화면 대비 비율**이다. PuzzleBoard.xaml 의 star 값에서 나온다
 * (보조 영역 행 x 안쪽 84% x 76%, 가로 94% x 트레이 열). 생성기의 값을 바꾸면 같이 바꾼다.
 *
 * 트레이 슬롯은 이 자리의 **가로세로 비**에 맞춰 줄 수를 고른다 (`layoutTray`). 한 줄로만 늘어놓으면
 * 세로로 긴 화면에서는 폭이 먼저 모자라, 슬롯이 자리 높이의 절반도 쓰지 못하고 작아진다.
 */
const AUX_ROW_FRACTION = (100 - BOARD_TOP_INSET_PERCENT - BOARD_BOTTOM_INSET_PERCENT) / 100
	* AUX_AREA_FLEX / (BOARD_AREA_FLEX + AUX_AREA_FLEX);
const TRAY_HEIGHT_FRACTION = AUX_ROW_FRACTION * 0.84 * 0.76;
const TRAY_WIDTH_FRACTION = 0.94 * 0.52;
/** 미니 격자가 없으면 그 열까지 트레이가 쓴다 */
const TRAY_WIDE_WIDTH_FRACTION = 0.94 * 0.74;
/** 루트 크기를 아직 모를 때 가정하는 화면 비 (세로로 긴 휴대폰) */
const FALLBACK_SCREEN_ASPECT = 0.46;

const COLOR_NO_EDGE = '#00000000';
const VISIBLE = 'Visible';
const COLLAPSED = 'Collapsed';

const DUPLICATE_DOWN_WINDOW_MS = 80;
const INTRO_FADE_STEP_MS = 60;

//#endregion

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function toHex(color: PuzzleBoardColor): string {
	const channel = (value: number): string => {
		const text = Math.round(clamp(value, 0, 1) * 255).toString(16).toUpperCase();
		return text.length < 2 ? `0${text}` : text;
	};
	return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

function edgeColorOf(accent: EBoardCellAccent, isHighlighted: boolean): string {
	if (accent === EBoardCellAccent.GRABBED || accent === EBoardCellAccent.GHOST) {
		return toHex(BOARD_COLOR_GRABBED);
	}
	if (accent === EBoardCellAccent.DROP_VALID) {
		return toHex(BOARD_COLOR_DROP_VALID);
	}
	if (accent === EBoardCellAccent.DROP_INVALID) {
		return toHex(BOARD_COLOR_DROP_INVALID);
	}
	if (accent === EBoardCellAccent.PATH) {
		return toHex(BOARD_COLOR_PATH);
	}
	return isHighlighted ? toHex(BOARD_COLOR_HIGHLIGHT) : COLOR_NO_EDGE;
}

/** 값이 같으면 쓰지 않는다 - 쓰는 것 하나하나가 Noesis 쪽으로 넘어가는 갱신이다 */
function assign(target: IUiViewModelObject, key: string, value: string | number | ImageSource | null): void {
	if (target[key] !== value) {
		target[key] = value;
	}
}

export class NoesisBoardPanel extends Component<typeof NoesisBoardPanel> {
	public static propsDefinition = {
		/** 보드 제목을 위 여백에 그릴지. 기본은 꺼짐이다 (`PuzzleBoardUI_Panel.showTitle` 과 같다) */
		showTitle: { type: PropTypes.Boolean, default: false },
		/** 시작 배너가 완전히 보이는 시간과 잦아드는 시간 (`PuzzleBoardUI_Panel` 과 같은 기본값) */
		introSeconds: { type: PropTypes.Number, default: 0.45 },
		introFadeSeconds: { type: PropTypes.Number, default: 0.3 },
		/** 보드가 없을 때 gizmo 를 치울지. 끄면 빈 배경이 남아 허브를 가린다 - 진단용 */
		hideWhenEmpty: { type: PropTypes.Boolean, default: true },
		logToConsole: { type: PropTypes.Boolean, default: false },
	};

	private _gizmo: NoesisGizmo | undefined = undefined;
	private _vm: IUiViewModelObject = {};
	private _cells: IUiViewModelObject[] = [];
	private _sideCells: IUiViewModelObject[] = [];
	private _items: IUiViewModelObject[] = [];

	private _presenter: PuzzleBoardPresenter | undefined = undefined;
	private _presenterSubscriptions = new SubscriptionBag();
	private readonly _stageSubscriptions = new SubscriptionBag();

	private _rootWidth: number = 0;
	private _rootHeight: number = 0;
	private _trayCount: number = 0;
	private _hasSide: boolean = false;

	private _cellCount: number = 0;
	private _cellSize: number = 0;
	private _sideCellSize: number = 0;
	private _pressedCell: number = PUZZLE_BOARD_CELL_OUTSIDE;
	private _pressedItem: number = PUZZLE_BOARD_CELL_OUTSIDE;

	private _lastDownKey: string = '';
	private _lastDownMs: number = 0;

	private _introTimeoutId: number | undefined = undefined;
	private _introFadeId: number | undefined = undefined;

	private _pieces: IUiViewModelObject[] = [];
	private _pieceCount: number = 0;
	private _rowCount: number = 0;
	private _colCount: number = 0;
	/** 격자 상자가 900 설계 좌표 안에서 시작하는 자리 (가운데 정렬이라 긴 쪽은 0) */
	private _gridLeft: number = 0;
	private _gridTop: number = 0;
	/** 보드 정사각형이 루트에서 차지하는 자리 (px) */
	private _boardX: number = 0;
	private _boardY: number = 0;
	private _boardSize: number = 0;
	private _dragPiece: number = NO_PIECE;
	/**
	 * 이 드래그를 몰고 있는 입력원 (`mouse` / `touch`).
	 *
	 * 터치 한 번이 마우스로도 승격되어 두 벌로 오므로 한 벌만 받는다. 다만 **어느 벌이 오는지는
	 * 기기가 정한다** - Down 은 `PreviewTouchDown` 으로 오고 Move 는 `MouseMove` 로만 오는 조합이
	 * 실제로 있다. 그래서 잠금은 고정이 아니라 `_dragMoveCount` 가 0 인 동안에만 갈아탈 수 있다
	 * (`onPointerMove`).
	 */
	private _dragSource: string = '';
	/** 지금 잠긴 입력원에서 받아들인 Move 수 - 0 이면 아직 잠금을 갈아탈 수 있다 */
	private _dragMoveCount: number = 0;
	/** 입력원·종류별로 처음 받은 이벤트 인자의 모양 - 좌표를 못 읽을 때 기기 로그로 확인한다 */
	private readonly _argShapes: { [kind: string]: string } = {};
	private _lastGridRow: number = 0;
	private _lastGridCol: number = 0;
	private readonly _tweens: { [slot: number]: number } = {};

	//#region Lifecycle

	public start(): void {
		// 서버에서 도는 인스턴스는 아무것도 그리지 않는다 (실행모드 규칙 §1).
		// **소유자가 아니라 "지금 어느 기기에서 도는가" 로 가른다** - Shared 모드에서는 소유권이 넘어오지
		// 않아 소유자가 언제나 서버라서, 소유자로 가르면 모든 클라이언트가 여기서 돌아가 버린다.
		// Local 모드에서도 결과는 같다 (서버에서 돌 때만 로컬 플레이어가 서버 플레이어다).
		if (this.world.getLocalPlayer().id === this.world.getServerPlayer().id) {
			return;
		}
		this._gizmo = this.entity.as(NoesisGizmo);
		this._vm = this.buildContext();
		this._gizmo.dataContext = this._vm;
		this.setGizmoVisible(false);
		this.connectStage();
	}

	public dispose(): void {
		this.clearIntroTimers();
		this.stopAllTweens();
		this.detachPresenter();
		this._stageSubscriptions.disconnect();
	}

	//#endregion

	//#region Context

	/** 첫 대입 때 없던 키는 바인딩되지 않으므로, 쓸 키를 전부 여기서 만든다 */
	private buildContext(): IUiViewModelObject {
		this._cells = [];
		for (let index = 0; index < PUZZLE_BOARD_MAX_CELLS; index++) {
			this._cells.push({
				Size: 0,
				Fill: COLOR_NO_EDGE,
				Alpha: 1,
				Tex: null,
				Label: '',
				LabelColor: '#FFFFFF',
				Font: 12,
				Edge: COLOR_NO_EDGE,
				EdgeWidth: '0',
				FaceMargin: '0',
				Glyph: '0',
				OnDown: () => this.onCellDown(index),
				OnEnter: () => this.onCellEnter(index),
				OnLeave: () => this.onCellLeave(index),
			});
		}

		this._sideCells = [];
		for (let index = 0; index < PUZZLE_BOARD_SIDE_MAX_CELLS; index++) {
			this._sideCells.push({
				Size: 0,
				Fill: COLOR_NO_EDGE,
				Alpha: 1,
				Tex: null,
				Label: '',
				LabelColor: '#FFFFFF',
				Font: 12,
				Edge: COLOR_NO_EDGE,
				EdgeWidth: '0',
				FaceMargin: '0',
			});
		}

		this._items = [];
		for (let index = 0; index < PUZZLE_BOARD_MAX_ITEMS; index++) {
			this._items.push({
				Size: 0,
				Fill: COLOR_NO_EDGE,
				Alpha: 1,
				Tex: null,
				Label: '',
				LabelColor: '#FFFFFF',
				Caption: '',
				Edge: COLOR_NO_EDGE,
				EdgeWidth: '0',
				FaceMargin: '0',
				Glyph: '0',
				OnDown: () => this.onItemDown(index),
			});
		}

		this._pieces = [];
		const context: IUiViewModelObject = {};
		for (let index = 0; index < PUZZLE_BOARD_MAX_PIECES; index++) {
			// 조각은 낱개 키로 찍는다 - 배열 항목은 Canvas 자리 지정이 컨테이너에 닿지 않는다
			const slot: IUiViewModelObject = {};
			this._pieces.push(slot);
			const name = `P${index + 1}`;
			context[`${name}Vis`] = COLLAPSED;
			for (const field of ['X', 'Y', 'W', 'H']) {
				context[`${name}${field}`] = 0;
			}
			context[`${name}Alpha`] = 1;
			context[`${name}Fill`] = COLOR_NO_EDGE;
			context[`${name}Tex`] = null;
			context[`${name}Label`] = '';
			context[`${name}LabelColor`] = '#FFFFFF';
			context[`${name}Font`] = 12;
			context[`${name}Edge`] = COLOR_NO_EDGE;
			context[`${name}EdgeWidth`] = '0';
		}

		return {
			...context,
			Title: '',
			TitleVis: COLLAPSED,
			BoardTex: null,
			GridWidth: 0,
			SideWidth: 0,
			SideLabel: '',
			SideVis: COLLAPSED,
			TrayVis: COLLAPSED,
			TrayWideVis: COLLAPSED,
			TrayWidth: 0,
			ActionLabel: '',
			ActionVis: COLLAPSED,
			AuxVis: VISIBLE,
			IntroText: '',
			IntroVis: COLLAPSED,
			IntroAlpha: 1,
			BarFont: 16,
			Cells: this._cells,
			SideCells: this._sideCells,
			Items: this._items,
			OnMouseDown: (args?: unknown) => this.onPointerDown(args, 'mouse'),
			OnMouseMove: (args?: unknown) => this.onPointerMove(args, 'mouse'),
			OnMouseUp: (args?: unknown) => this.onPointerUp(args, 'mouse'),
			OnTouchDown: (args?: unknown) => this.onPointerDown(args, 'touch'),
			OnTouchMove: (args?: unknown) => this.onPointerMove(args, 'touch'),
			OnTouchUp: (args?: unknown) => this.onPointerUp(args, 'touch'),
			OnAuxEnter: () => this.onAuxAreaEnter(),
			OnReset: () => this.onReset(),
			OnAction: () => this.onAction(),
			OnMenu: () => this.onMenu(),
			OnRootWidth: (parameter?: unknown) => this.onRootSize(parameter, true),
			OnRootHeight: (parameter?: unknown) => this.onRootSize(parameter, false),
		};
	}

	private setGizmoVisible(isVisible: boolean): void {
		if (this._gizmo === undefined || (isVisible === false && this.props.hideWhenEmpty === false)) {
			return;
		}
		try {
			this._gizmo.setLocalEntityVisibility(isVisible);
		} catch (error) {
			console.error(`[NoesisBoardPanel] setLocalEntityVisibility(${isVisible}) 실패: ${error}`);
		}
	}

	/**
	 * 루트 크기에서 뽑는 것은 둘뿐이다 - 띠의 글자 크기와 트레이의 줄 수(화면 비).
	 * 보드 안쪽은 Viewbox 가 키우므로 픽셀이 필요 없다.
	 */
	private onRootSize(parameter: unknown, isWidth: boolean): void {
		const value = typeof parameter === 'number' ? parameter : parseFloat(String(parameter));
		if (isNaN(value) || value <= 0) {
			return;
		}
		if (isWidth === true) {
			if (Math.abs(value - this._rootWidth) < 0.5) {
				return;
			}
			this._rootWidth = value;
		} else {
			if (Math.abs(value - this._rootHeight) < 0.5) {
				return;
			}
			this._rootHeight = value;
			assign(this._vm, 'BarFont', Math.round(clamp(value * 0.019, 10, 48)));
		}
		this.layoutTray();
		this.layoutBoardRect();
	}

	/**
	 * 보드 정사각형이 루트의 어디에 몇 px 로 그려지는지 - XAML 의 행 비율과 `PuzzleUI_RelativeLayout` 의
	 * 비율(가로 96% · 영역 세로 94% 안의 정사각형, 가운데)을 그대로 따라 계산한다. 포인터 좌표를
	 * 격자 좌표로 바꾸는 데만 쓴다 (`toGridPoint`) - 그리기는 여전히 XAML 의 몫이다.
	 */
	private layoutBoardRect(): void {
		const width = this._rootWidth;
		const height = this._rootHeight;
		if (width <= 0 || height <= 0) {
			return;
		}
		const top = height * BOARD_TOP_INSET_PERCENT / 100;
		const bottom = height * BOARD_BOTTOM_INSET_PERCENT / 100;
		const areaHeight = (height - top - bottom) * BOARD_AREA_FLEX / (BOARD_AREA_FLEX + AUX_AREA_FLEX);
		this._boardSize = Math.min(width * BOARD_WIDTH_PERCENT / 100, areaHeight * BOARD_HEIGHT_PERCENT / 100);
		this._boardX = (width - this._boardSize) / 2;
		this._boardY = top + (areaHeight - this._boardSize) / 2;
	}

	/**
	 * 트레이 슬롯을 몇 줄로 놓을지 고른다 - `PuzzleUI_RelativeLayout.trayGrid()` 와 같은 규칙이다.
	 * 줄 수(최대 `TRAY_MAX_ROWS`)마다 슬롯 한 변 = min(높이 / 줄 수, 폭 / 칸 수) 를 재서 가장 큰 쪽을 쓴다.
	 * XAML 은 `TrayWidth` 에서 줄을 바꾸고 Viewbox 가 그 결과를 자리에 맞춘다.
	 */
	private layoutTray(): void {
		const vm = this._vm;
		const count = Math.min(this._trayCount, PUZZLE_BOARD_MAX_ITEMS);
		if (count <= 0) {
			assign(vm, 'TrayVis', COLLAPSED);
			assign(vm, 'TrayWideVis', COLLAPSED);
			return;
		}
		const aspect = this._rootWidth > 0 && this._rootHeight > 0
			? this._rootWidth / this._rootHeight
			: FALLBACK_SCREEN_ASPECT;
		// 두 축을 같은 자(화면 세로 = 1)로 잰다
		const width = (this._hasSide === true ? TRAY_WIDTH_FRACTION : TRAY_WIDE_WIDTH_FRACTION) * aspect;
		const height = TRAY_HEIGHT_FRACTION;

		let bestCols = count;
		let bestSide = 0;
		for (let cols = 1; cols <= count; cols++) {
			const rows = Math.ceil(count / cols);
			if (rows > TRAY_MAX_ROWS) {
				continue;
			}
			const side = Math.min(height / rows, width / cols);
			// 같은 크기면 줄이 적은(칸이 많은) 쪽을 남긴다
			if (side >= bestSide) {
				bestSide = side;
				bestCols = cols;
			}
		}
		assign(vm, 'TrayWidth', bestCols * TRAY_SLOT_SIZE + WRAP_SLACK);
		assign(vm, 'TrayVis', this._hasSide === true ? VISIBLE : COLLAPSED);
		assign(vm, 'TrayWideVis', this._hasSide === true ? COLLAPSED : VISIBLE);
	}

	private trace(message: string): void {
		if (this.props.logToConsole === true) {
			console.log(`[NoesisBoardPanel] ${message}`);
		}
	}

	//#endregion

	//#region Stage wiring

	private connectStage(): void {
		const stage = PuzzleBoardStage.instance;
		this._stageSubscriptions.addRange(
			stage.MOUNTED.subscribe((presenter) => this.attachPresenter(presenter)),
			stage.UNMOUNTED.subscribe(() => this.detachPresenter()),
			// 에셋 등록은 CoreAPI 의 start() 에서 오므로 이 패널보다 늦을 수 있다
			PuzzleTextureLibrary.instance.CHANGED.subscribe(() => this.reapplyTextures()),
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
			presenter.PIECE_CHANGED.subscribe((change) => this.applyPiece(change)),
			presenter.INTRO_CHANGED.subscribe((intro) => this.applyIntro(intro.isVisible, intro.text)),
			presenter.PRESS_CHANGED.subscribe((press) => this.applyPress(press)),
		);
		const press = presenter.getPressHighlight();
		this._pressedCell = press.cell;
		this._pressedItem = press.item;
		this.applyView(presenter.getView());
		const intro = presenter.getIntro();
		this.applyIntro(intro.isVisible, intro.text);
		this.setGizmoVisible(true);
		this.trace('board mounted');
	}

	private detachPresenter(): void {
		if (this._presenter === undefined) {
			return;
		}
		this.clearIntroTimers();
		this._presenterSubscriptions.disconnect();
		this._presenter = undefined;
		this._pressedCell = PUZZLE_BOARD_CELL_OUTSIDE;
		this._pressedItem = PUZZLE_BOARD_CELL_OUTSIDE;
		// 허브의 일시정지·결과 화면이 보이고 눌리도록 자리를 비운다 (머리말 "한 번에 하나만")
		this.setGizmoVisible(false);
		this.trace('board unmounted');
	}

	//#endregion

	//#region View application

	/** 보드 전체를 다시 반영한다 (레벨 로드 / 퍼즐 전환) */
	private applyView(view: PuzzleBoardView): void {
		const vm = this._vm;
		const rows = view.grid.rowCount;
		const cols = view.grid.colCount;
		this._cellCount = rows * cols;
		// 칸은 언제나 정사각형이다 - 긴 쪽이 판을 꽉 채운다 (`computeGridBox` 와 같은 규칙)
		this._cellSize = this._cellCount > 0 ? BOARD_DESIGN_SIZE / Math.max(rows, cols) : 0;

		assign(vm, 'Title', view.title);
		assign(vm, 'TitleVis', this.props.showTitle === true && view.title !== '' ? VISIBLE : COLLAPSED);
		assign(vm, 'BoardTex', PuzzleTextureLibrary.instance.resolve(view.boardTexture));
		assign(vm, 'GridWidth', cols * this._cellSize + WRAP_SLACK);
		assign(vm, 'ActionLabel', view.actionLabel);
		assign(vm, 'ActionVis', view.actionLabel !== '' ? VISIBLE : COLLAPSED);
		this._trayCount = view.items.length;
		this._hasSide = view.side !== undefined;
		this.layoutTray();

		for (let index = 0; index < PUZZLE_BOARD_MAX_CELLS; index++) {
			this.writeCell(this._cells[index], view.grid.cells[index], this._cellSize, index === this._pressedCell, CELL_FONT_RATIO);
		}

		// 조각 계층 - 격자 상자와 같은 원점·같은 칸 크기를 쓴다 (격자는 900 안에 가운데 정렬된다)
		this._rowCount = rows;
		this._colCount = cols;
		this._gridLeft = (BOARD_DESIGN_SIZE - cols * this._cellSize) / 2;
		this._gridTop = (BOARD_DESIGN_SIZE - rows * this._cellSize) / 2;
		this._pieceCount = Math.min(view.pieces.length, PUZZLE_BOARD_MAX_PIECES);
		this.stopAllTweens();
		this._dragPiece = NO_PIECE;
		for (let index = 0; index < PUZZLE_BOARD_MAX_PIECES; index++) {
			this.writePiece(index, view.pieces[index]);
		}

		const side = view.side;
		const sideCount = side === undefined ? 0 : side.rowCount * side.colCount;
		this._sideCellSize = side === undefined || sideCount <= 0
			? 0
			: SIDE_DESIGN_SIZE / Math.max(side.rowCount, side.colCount);
		assign(vm, 'SideVis', side !== undefined ? VISIBLE : COLLAPSED);
		assign(vm, 'SideLabel', side !== undefined ? side.label : '');
		assign(vm, 'SideWidth', side !== undefined ? side.colCount * this._sideCellSize + WRAP_SLACK : 0);
		for (let index = 0; index < PUZZLE_BOARD_SIDE_MAX_CELLS; index++) {
			const cell = side !== undefined ? side.cells[index] : undefined;
			this.writeCell(this._sideCells[index], cell, this._sideCellSize, false, SIDE_FONT_RATIO);
		}

		for (let index = 0; index < PUZZLE_BOARD_MAX_ITEMS; index++) {
			this.writeItem(this._items[index], view.items[index], index === this._pressedItem);
		}
	}

	private applyGridCell(change: PuzzleBoardCellChange): void {
		const target = this._cells[change.index];
		if (target === undefined || change.index >= this._cellCount) {
			return;
		}
		this.writeCell(target, change.cell, this._cellSize, change.index === this._pressedCell, CELL_FONT_RATIO);
	}

	private applySideCell(change: PuzzleBoardCellChange): void {
		const target = this._sideCells[change.index];
		if (target !== undefined) {
			this.writeCell(target, change.cell, this._sideCellSize, false, SIDE_FONT_RATIO);
		}
	}

	private applyItem(change: PuzzleBoardItemChange): void {
		const target = this._items[change.index];
		if (target !== undefined) {
			this.writeItem(target, change.item, change.index === this._pressedItem);
		}
	}

	/**
	 * 조각이 바뀌었다. 끌고 있는 조각은 그 자리에 바로 놓고(손가락을 따라가는 중이다), 나머지는
	 * 지금 자리에서 새 자리까지 짧게 미끄러진다 - 놓은 뒤의 스냅, 다른 조각의 이동이 이 경로다.
	 */
	private applyPiece(change: PuzzleBoardPieceChange): void {
		const slot = change.index;
		if (slot >= PUZZLE_BOARD_MAX_PIECES) {
			return;
		}
		const wasVisible = this._vm[`P${slot + 1}Vis`] === VISIBLE;
		const fromX = this._vm[`P${slot + 1}X`];
		const fromY = this._vm[`P${slot + 1}Y`];
		this.writePiece(slot, change.piece);
		if (slot === this._dragPiece || wasVisible === false || change.piece.isVisible === false
			|| typeof fromX !== 'number' || typeof fromY !== 'number') {
			return;
		}
		const toX = this._vm[`P${slot + 1}X`] as number;
		const toY = this._vm[`P${slot + 1}Y`] as number;
		if (Math.abs(toX - fromX) < 0.5 && Math.abs(toY - fromY) < 0.5) {
			return;
		}
		this.tweenPiece(slot, fromX, fromY, toX, toY);
	}

	/** 조각 스냅샷을 바인딩 값으로 - 자리는 격자 좌표 x 칸 크기, 간격만큼 안쪽 */
	private writePiece(slot: number, piece: PuzzleBoardPieceView | undefined): void {
		const vm = this._vm;
		const name = `P${slot + 1}`;
		if (piece === undefined || piece.isVisible === false || this._cellSize <= 0) {
			assign(vm, `${name}Vis`, COLLAPSED);
			return;
		}
		const cell = this._cellSize;
		const gap = cell * PIECE_GAP_RATIO;
		const texture = this.resolveTexture(piece.texture);
		assign(vm, `${name}Vis`, VISIBLE);
		assign(vm, `${name}X`, this._gridLeft + piece.col * cell + gap);
		assign(vm, `${name}Y`, this._gridTop + piece.row * cell + gap);
		assign(vm, `${name}W`, Math.max(0, piece.colSpan * cell - gap * 2));
		assign(vm, `${name}H`, Math.max(0, piece.rowSpan * cell - gap * 2));
		assign(vm, `${name}Alpha`, getAccentOpacity(true, piece.accent));
		assign(vm, `${name}Fill`, toHex(piece.fill));
		assign(vm, `${name}Tex`, texture);
		assign(vm, `${name}Label`, texture === null ? piece.label : '');
		assign(vm, `${name}LabelColor`, toHex(piece.labelColor));
		assign(vm, `${name}Font`, Math.round(cell * PIECE_FONT_RATIO));
		assign(vm, `${name}Edge`, edgeColorOf(piece.accent, false));
		assign(vm, `${name}EdgeWidth`, (getAccentBorderWidth(piece.accent, false) * cell * PIECE_EDGE_RATIO / 5).toFixed(1));
	}

	private tweenPiece(slot: number, fromX: number, fromY: number, toX: number, toY: number): void {
		this.stopTween(slot);
		const startMs = Date.now();
		const keyX = `P${slot + 1}X`;
		const keyY = `P${slot + 1}Y`;
		this._tweens[slot] = this.async.setInterval(() => {
			const progress = clamp((Date.now() - startMs) / SNAP_TWEEN_MS, 0, 1);
			const eased = 1 - (1 - progress) * (1 - progress);
			assign(this._vm, keyX, fromX + (toX - fromX) * eased);
			assign(this._vm, keyY, fromY + (toY - fromY) * eased);
			if (progress >= 1) {
				this.stopTween(slot);
			}
		}, SNAP_TWEEN_STEP_MS);
	}

	private stopTween(slot: number): void {
		const id = this._tweens[slot];
		if (id !== undefined) {
			this.async.clearInterval(id);
			delete this._tweens[slot];
		}
	}

	private stopAllTweens(): void {
		for (const key of Object.keys(this._tweens)) {
			this.stopTween(Number(key));
		}
	}

	/** 짚고 있는 자리가 옮겨졌다 - 앞뒤 두 자리만 다시 쓴다 */
	private applyPress(press: PuzzleBoardPressHighlight): void {
		const presenter = this._presenter;
		if (presenter === undefined) {
			return;
		}
		const previousCell = this._pressedCell;
		const previousItem = this._pressedItem;
		this._pressedCell = press.cell;
		this._pressedItem = press.item;

		for (const index of [previousCell, press.cell]) {
			const cell = index >= 0 ? presenter.getCell(index) : undefined;
			if (cell !== undefined && this._cells[index] !== undefined) {
				this.writeCell(this._cells[index], cell, this._cellSize, index === this._pressedCell, CELL_FONT_RATIO);
			}
		}
		for (const index of [previousItem, press.item]) {
			const item = index >= 0 ? presenter.getItem(index) : undefined;
			if (item !== undefined && this._items[index] !== undefined) {
				this.writeItem(this._items[index], item, index === this._pressedItem);
			}
		}
	}

	/** 그림이 늦게 등록됐다 - 지금 화면의 그림 자리를 전부 다시 푼다 */
	private reapplyTextures(): void {
		const presenter = this._presenter;
		if (presenter !== undefined) {
			this.applyView(presenter.getView());
		}
	}

	/**
	 * 칸 하나의 스냅샷을 바인딩 값으로 옮긴다. 본 격자와 미니 격자가 같이 쓴다.
	 *
	 * 확대·축소(`GRABBED` 1.1배, `GHOST` 0.86배)는 변환이 아니라 **얼굴의 여백**으로 낸다 -
	 * 입력을 받는 칸의 자리는 그대로이고 그 안의 얼굴만 커지고 작아진다 (Custom UI 판에서
	 * `Pressable` 과 얼굴을 나눴던 것과 같은 이유다).
	 */
	private writeCell(
		target: IUiViewModelObject,
		cell: PuzzleBoardCellView | undefined,
		size: number,
		isPressed: boolean,
		fontRatio: number,
	): void {
		if (cell === undefined || size <= 0) {
			assign(target, 'Size', 0);
			return;
		}
		const accent = mergePressAccent(cell.accent, isPressed);
		const texture = this.resolveTexture(cell.texture);
		const gap = size * CELL_GAP_RATIO;

		assign(target, 'Size', size);
		assign(target, 'Fill', toHex(cell.fill));
		assign(target, 'Alpha', getAccentOpacity(cell.isVisible, accent));
		assign(target, 'Tex', texture);
		// 그림이 있으면 글자는 물러난다 (`createLabelVisibility` 와 같은 규칙)
		assign(target, 'Label', texture === null ? cell.label : '');
		assign(target, 'LabelColor', toHex(cell.labelColor));
		assign(target, 'Font', Math.round(size * fontRatio));
		assign(target, 'Edge', edgeColorOf(accent, cell.isHighlighted));
		assign(target, 'EdgeWidth', (getAccentBorderWidth(accent, cell.isHighlighted) * size * EDGE_PER_PIXEL_RATIO).toFixed(1));
		assign(target, 'FaceMargin', (gap + (1 - getAccentScale(accent)) * size / 2).toFixed(1));
		if (target.Glyph !== undefined) {
			assign(target, 'Glyph', this.glyphThickness(cell.glyph, size));
		}
	}

	private writeItem(target: IUiViewModelObject, item: PuzzleBoardItemView | undefined, isPressed: boolean): void {
		if (item === undefined) {
			assign(target, 'Size', 0);
			return;
		}
		const accent = mergePressAccent(item.accent, isPressed);
		const texture = this.resolveTexture(item.texture);
		const size = TRAY_SLOT_SIZE;

		// 다 쓴 슬롯도 자리는 지킨다 - 남은 슬롯이 옆으로 밀리면 집으려던 것이 달아난다
		assign(target, 'Size', size);
		assign(target, 'Fill', toHex(item.fill));
		assign(target, 'Alpha', getAccentOpacity(item.isVisible, accent));
		assign(target, 'Tex', texture);
		assign(target, 'Label', texture === null ? item.label : '');
		assign(target, 'LabelColor', toHex(item.labelColor));
		assign(target, 'Caption', item.caption);
		assign(target, 'Edge', edgeColorOf(accent, item.isHighlighted));
		assign(target, 'EdgeWidth', (getAccentBorderWidth(accent, item.isHighlighted) * size * EDGE_PER_PIXEL_RATIO).toFixed(1));
		assign(target, 'FaceMargin', (size * 0.06 + (1 - getAccentScale(accent)) * size / 2).toFixed(1));
		assign(target, 'Glyph', this.glyphThickness(item.glyph, size));
	}

	private resolveTexture(key: PuzzleTextureKey): ImageSource | null {
		return PuzzleTextureLibrary.instance.resolve(key);
	}

	/** 광선을 되돌리는 변에만 두꺼운 테두리 - `Thickness` 문자열 "좌,상,우,하" */
	private glyphThickness(glyph: EBoardCellGlyph, size: number): string {
		if (glyph === EBoardCellGlyph.NONE) {
			return '0';
		}
		const edges = getGlyphBlockedEdges(glyph);
		const width = (size * GLYPH_EDGE_RATIO).toFixed(1);
		return `${edges.left ? width : '0'},${edges.top ? width : '0'},${edges.right ? width : '0'},${edges.bottom ? width : '0'}`;
	}

	//#endregion

	//#region Intro banner

	/**
	 * 배너를 켜고 끈다. 시간 규칙은 `PuzzleBoardUI_Panel.applyIntro()` 와 같다 - `introSeconds` 동안
	 * 완전히 보였다가, 잦아들기 시작할 때 입력을 먼저 열고, 다 잦아든 뒤에 `endIntro()` 를 부른다.
	 */
	private applyIntro(isVisible: boolean, text: string): void {
		const vm = this._vm;
		this.clearIntroTimers();
		assign(vm, 'IntroText', text);
		assign(vm, 'IntroVis', isVisible === true ? VISIBLE : COLLAPSED);
		// 배너가 떠 있는 동안 보조 레이아웃은 그리지 않는다
		assign(vm, 'AuxVis', isVisible === true ? COLLAPSED : VISIBLE);
		if (isVisible === false) {
			return;
		}
		assign(vm, 'IntroAlpha', 1);
		const holdMs = Math.max(0, this.props.introSeconds) * 1000;
		this._introTimeoutId = this.async.setTimeout(() => this.startIntroFade(), holdMs);
	}

	private startIntroFade(): void {
		this._introTimeoutId = undefined;
		this._presenter?.unlockIntroInput();

		const fadeMs = Math.max(0, this.props.introFadeSeconds) * 1000;
		const steps = Math.max(1, Math.floor(fadeMs / INTRO_FADE_STEP_MS));
		let step = 0;
		this._introFadeId = this.async.setInterval(() => {
			step++;
			assign(this._vm, 'IntroAlpha', Math.max(0, 1 - step / steps));
			if (step >= steps) {
				this.clearIntroTimers();
				this._presenter?.endIntro();
			}
		}, fadeMs / steps);
	}

	private clearIntroTimers(): void {
		if (this._introTimeoutId !== undefined) {
			this.async.clearTimeout(this._introTimeoutId);
			this._introTimeoutId = undefined;
		}
		if (this._introFadeId !== undefined) {
			this.async.clearInterval(this._introFadeId);
			this._introFadeId = undefined;
		}
	}

	//#endregion

	//#region Input (XAML command -> Presenter)

	/**
	 * 터치 한 번이 `TouchDown` 과 승격된 `MouseLeftButtonDown` 으로 두 번 올 수 있다.
	 * 두 번째를 그대로 넘기면 프레젠터가 "앞 누름의 뗌이 유실됐다" 로 읽고, 누르는 순간 반응하는
	 * 퍼즐(카드 맞추기)은 같은 칸을 두 번 뒤집는다.
	 */
	private isDuplicateDown(key: string): boolean {
		const now = Date.now();
		const isRepeat = this._lastDownKey === key && now - this._lastDownMs < DUPLICATE_DOWN_WINDOW_MS;
		this._lastDownKey = key;
		this._lastDownMs = now;
		return isRepeat;
	}

	private onCellDown(index: number): void {
		// 조각을 집은 누름이다 - 조각 밑의 칸이 같은 누름을 또 받는다 (Preview 로 조각이 먼저 받았다)
		if (this._dragPiece !== NO_PIECE) {
			return;
		}
		if (index >= this._cellCount || this.isDuplicateDown(`cell${index}`) === true) {
			return;
		}
		this._presenter?.pointerDown(index);
	}

	private onCellEnter(index: number): void {
		if (index < this._cellCount) {
			this._presenter?.pointerEnter(index);
		}
	}

	private onCellLeave(index: number): void {
		if (index < this._cellCount) {
			this._presenter?.pointerExit(index);
		}
	}

	private onItemDown(index: number): void {
		if (this.isDuplicateDown(`item${index}`) === true) {
			return;
		}
		this._presenter?.itemDown(index);
	}

	/**
	 * 루트가 받는 뗌. 어디서 떼든 여기로 올라온다 - 여러 번 와도 한 번만 일한다.
	 *
	 * **뗌 이벤트가 어느 요소에서 올라왔는지는 보지 않는다.** 터치의 뗌은 손가락 밑의 요소가 아니라
	 * **터치가 시작된 요소**에서 올라올 수 있다. 예전에는 보조 영역의 뗌을 "판 밖에 놓았다" 로 읽었는데,
	 * 트레이에서 집은 부품은 어디에 놓든 뗌이 트레이(보조 영역)에서 올라와 매번 인벤토리로 되돌아갔다.
	 * 손가락이 어디 있는지는 Enter / Leave 로만 좇고, 놓을 칸은 프레젠터가 그 기록에서 정한다.
	 */
	private onPointerUp(args: unknown, source: string): void {
		const point = this.readPoint(args, `${source}Up`);
		if (this._dragPiece === NO_PIECE) {
			this._presenter?.pointerUp();
			return;
		}
		// **뗌은 어느 입력원에서 오든 받는다 - 먼저 도착한 쪽이 이 드래그를 마감한다.**
		//
		// 터치가 마우스로도 승격되어 뗌이 두 벌 오지만, 두 번째는 `_dragPiece` 가 이미 비어 있어
		// 위에서 걸린다. 예전처럼 "이 드래그를 몰던 입력원의 뗌만" 받으면, Down 과 Up 이 서로 다른
		// 벌로 오는 기기에서 **아무도 드래그를 닫지 않아** 조각이 붙잡힌 채 남고 다음 터치가
		// 유실 회복(`PuzzleBoardPresenter.pointerUp`)으로 마감된다 - 손을 떼도 안 놓이는 증상이다.
		// **놓는 자리는 마지막 Move 의 좌표다 - Up 인자의 좌표는 쓰지 않는다.**
		//
		// 실기(2026-09-23)에서 Up 인자의 좌표는 Move 와 다른 기준으로 왔다. 그 값을 그대로 컨트롤러에
		// 넣으면 잡은 지점 대비 delta 가 어긋나, 손을 떼는 순간 조각이 **드래그 내내 보여 주던 칸과
		// 다른 칸**으로 간다 - 크게 어긋나면 이동 범위의 끝(= 대개 원래 자리)으로 잘리고, 조금만
		// 어긋나도 절반 근처에서는 스냅 판정이 그대로 뒤집힌다. "블록이 절반을 넘겼는지가 기준이
		// 아닌 것 같다" 는 신고가 여기서 나왔다.
		//
		// 한 칸 안쪽이면 채택하는 타협도 두지 않는다 - 절반 판정을 뒤집는 데는 한 칸이 필요 없다.
		// 실기에서 검증된 `NoesisMoveLab` 도 같은 이유로 Up 의 좌표를 읽지 않는다. Move 는 입력
		// 해상도로 오므로 마지막 Move 와 실제로 뗀 자리의 차이는 몇 px 안이다.
		if (this.props.logToConsole === true) {
			this.trace(`up source=${source} lock=${this._dragSource} moves=${this._dragMoveCount} slot=${this._dragPiece} `
				+ `dropGrid=(${this._lastGridRow.toFixed(2)},${this._lastGridCol.toFixed(2)}) `
				+ `upPx=${point === undefined ? 'none' : `(${point.x.toFixed(1)},${point.y.toFixed(1)})`} (unused) `
				+ `board=(${this._boardX.toFixed(1)},${this._boardY.toFixed(1)},${this._boardSize.toFixed(1)})`);
		}
		this._dragPiece = NO_PIECE;
		this._dragMoveCount = 0;
		this._presenter?.pieceDrop(this._lastGridRow, this._lastGridCol);
	}

	/**
	 * 조각 계층의 누름 - 루트가 Preview 로 가장 먼저 받는다. 포인터 밑에 집을 수 있는 조각이 있으면
	 * 조각 드래그가 되고, 없으면 아무것도 하지 않는다 (칸의 자기 Down 이 뒤따라 칸 경로를 탄다).
	 */
	private onPointerDown(args: unknown, source: string): void {
		const point = this.readPoint(args, `${source}Down`);
		const presenter = this._presenter;
		if (point === undefined || presenter === undefined || this._pieceCount <= 0 || this._cellSize <= 0) {
			return;
		}
		if (this._dragPiece !== NO_PIECE) {
			return;
		}
		if (this.toGridPoint(point) === false) {
			// 보드 사각형을 아직 모른다 - 루트 크기가 오지 않았다는 뜻이다 (XAML 의 root-size 트리거).
			// 옛 좌표로 아무 조각이나 집는 대신 이 누름을 버린다. 크기는 이 누름과 함께 오므로
			// 다음 누름부터는 정상이다.
			this.trace(`down ignored - board rect unknown (root=${this._rootWidth.toFixed(0)}x${this._rootHeight.toFixed(0)})`);
			return;
		}
		const slot = this.hitPiece(this._lastGridRow, this._lastGridCol);
		if (slot === NO_PIECE) {
			return;
		}
		if (presenter.pieceGrab(slot, this._lastGridRow, this._lastGridCol) === false) {
			return;
		}
		this.stopTween(slot);
		this._dragPiece = slot;
		this._dragSource = source;
		this._dragMoveCount = 0;
		// 같은 누름이 조각 밑 칸의 Down 으로 또 오는 것을 중복으로 거른다
		this._lastDownKey = 'piece';
		this._lastDownMs = Date.now();
	}

	/**
	 * 끌고 있다 - **입력원 잠금은 첫 Move 를 받을 때까지만 잠정적이다.**
	 *
	 * 터치 한 번이 마우스로도 승격되므로 한 벌만 받아야 하는데, 기기에 따라 Down 은 터치로 오고
	 * Move 는 마우스로만 오는 조합이 있다. 잠금을 고정하면 그 조합에서 **Move 가 전부 버려져**
	 * 조각이 잡은 자리에 붙박이고, 뗄 때는 움직인 적이 없으니 원래 칸에 그대로 놓인다 -
	 * "모바일에서만 드롭하면 제자리로 돌아간다" 의 정체다. 그래서 잠긴 쪽이 아직 한 번도
	 * Move 를 주지 않았다면 새로 온 쪽으로 갈아탄다. 한 번이라도 받은 뒤에는 갈아타지 않는다 -
	 * 두 벌이 모두 흐르는 기기에서 좌표가 섞이면 조각이 떨린다.
	 */
	private onPointerMove(args: unknown, source: string): void {
		if (this._dragPiece === NO_PIECE) {
			return;
		}
		if (source !== this._dragSource) {
			if (this._dragMoveCount > 0) {
				return;
			}
			this.trace(`move source switched ${this._dragSource} -> ${source} (no move from the locked source yet)`);
			this._dragSource = source;
		}
		const point = this.readPoint(args, `${source}Move`);
		if (point === undefined) {
			return;
		}
		if (this.toGridPoint(point) === false) {
			return;
		}
		// 좌표까지 읽어낸 Move 만 센다 - 잠금을 갈아탈지 정하는 값이라 "왔지만 못 쓴" Move 는 0 이어야 한다
		this._dragMoveCount++;
		this._presenter?.pieceDrag(this._lastGridRow, this._lastGridCol);
	}

	/**
	 * 이벤트 인자의 좌표 - 문서의 MouseMove 예제는 `{ position: { x, y } }` 다. 터치는 이름이 다를 수 있어 몇 가지를 본다.
	 *
	 * **종류별 첫 인자는 모양을 그대로 찍는다** (`kind` = `mouseDown`·`touchMove`…). PC 와 모바일에서
	 * 인자의 모양이나 좌표의 기준이 다른지는 인월드 로그로만 확인할 수 있고, 좌표를 못 읽으면
	 * (`undefined`) 드래그가 아예 열리지 않아 "모바일에서 동작하지 않는다" 로 보인다.
	 * `NoesisMoveLab_Panel.readPoint` 와 같은 진단이다.
	 */
	private readPoint(args: unknown, kind: string): { x: number; y: number } | undefined {
		if (this._argShapes[kind] === undefined) {
			let text = '';
			try {
				text = JSON.stringify(args);
			} catch (error) {
				text = `unserializable ${typeof args}`;
			}
			this._argShapes[kind] = (text === undefined ? String(args) : text).slice(0, 200);
			this.trace(`first ${kind} args: ${this._argShapes[kind]} `
				+ `root=(${this._rootWidth.toFixed(0)}x${this._rootHeight.toFixed(0)}) `
				+ `board=(${this._boardX.toFixed(1)},${this._boardY.toFixed(1)},${this._boardSize.toFixed(1)})`);
		}
		if (typeof args !== 'object' || args === null) {
			return undefined;
		}
		const bag = args as { [key: string]: unknown };
		for (const key of ['position', 'touchPoint', 'touchPosition', 'point']) {
			const candidate = bag[key] as { x?: unknown; y?: unknown } | undefined;
			if (candidate !== undefined && candidate !== null && typeof candidate.x === 'number' && typeof candidate.y === 'number') {
				return { x: candidate.x, y: candidate.y };
			}
		}
		if (typeof bag.x === 'number' && typeof bag.y === 'number') {
			return { x: bag.x, y: bag.y };
		}
		return undefined;
	}

	/**
	 * 루트 px → 보드 px → 900 설계 좌표 → 격자 좌표(실수). 결과는 `_lastGridRow/Col` 에 남는다.
	 *
	 * **보드 사각형을 아직 모르면 false 다.** 예전에는 그냥 돌아갔는데, 그러면 `_lastGridRow/Col` 에
	 * 직전 값(첫 터치라면 0,0)이 남아 호출부가 그것을 진짜 좌표로 읽는다. 루트 크기는 `Loaded` 가
	 * dataContext 보다 먼저 오면 유실될 수 있고 그때는 보드 사각형이 0 이라, 조용히 넘기면
	 * "그 기기에서만 잡히지 않는다" 로 나타난다.
	 */
	private toGridPoint(point: { x: number; y: number }): boolean {
		if (this._boardSize <= 0 || this._cellSize <= 0) {
			return false;
		}
		const designX = (point.x - this._boardX) / this._boardSize * BOARD_DESIGN_SIZE;
		const designY = (point.y - this._boardY) / this._boardSize * BOARD_DESIGN_SIZE;
		this._lastGridCol = (designX - this._gridLeft) / this._cellSize;
		this._lastGridRow = (designY - this._gridTop) / this._cellSize;
		return true;
	}

	/** 이 격자 좌표 위에 있는 조각 - 나중에 그려진(위에 있는) 것부터 본다 */
	private hitPiece(row: number, col: number): number {
		const presenter = this._presenter;
		if (presenter === undefined) {
			return NO_PIECE;
		}
		for (let slot = this._pieceCount - 1; slot >= 0; slot--) {
			const piece = presenter.getPiece(slot);
			if (piece === undefined || piece.isVisible === false || piece.isInteractive === false) {
				continue;
			}
			if (row >= piece.row && row < piece.row + piece.rowSpan && col >= piece.col && col < piece.col + piece.colSpan) {
				return slot;
			}
		}
		return NO_PIECE;
	}

	/**
	 * 누른 채로 보조 레이아웃에 들어왔다 - 판을 진짜로 벗어난 것이다. 여기서 떼면 판 밖에 놓은 것이
	 * 되어 세션이 부품을 인벤토리로 되돌린다 (PUZ_01 §3 3.3). 다시 판으로 돌아가면 칸의 Enter 가
	 * 자리를 되살린다. 누르고 있지 않을 때는 프레젠터가 무시한다.
	 */
	private onAuxAreaEnter(): void {
		this._presenter?.pointerLeaveBoard();
	}

	private onReset(): void {
		this._presenter?.requestReset();
	}

	private onAction(): void {
		if (this.isDuplicateDown('action') === true) {
			return;
		}
		this._presenter?.requestAction();
	}

	private onMenu(): void {
		PuzzleBoardStage.instance.requestPause();
	}

	//#endregion
}
Component.register(NoesisBoardPanel);
