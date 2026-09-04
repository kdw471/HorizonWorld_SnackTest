/**
 * Puzzle Board UI Tray - 보조 레이아웃의 **오브젝트 트레이**
 *
 * 판으로 끌어다 쓰는 오브젝트를 늘어놓는 곳이다 (레이저의 미배치 크리스탈). 8개 퍼즐 중
 * **트레이를 규격에 적은 퍼즐만** 이 화면을 갖는다 (`PuzzleBoardLayoutSpec.itemCount`).
 * 나머지 퍼즐에서는 패널이 이 노드를 아예 마운트하지 않는다
 * (`PuzzleBoardUIPanel.createAuxContent()` 의 `UINode.if`).
 *
 * ## 왜 별도 파일인가
 *
 * 트레이는 자기만의 상태를 꽤 들고 있다 - 슬롯 8칸의 내용, 누름 표시, 페이지 계산,
 * 슬롯 크기. 이것이 패널에 섞여 있으면 "터치만 하는 퍼즐" 을 읽는 사람도 트레이의 페이지
 * 계산을 지나쳐 가야 한다. 여기서는 트레이가 자기 Binding 을 소유하고, 패널에는
 * **작은 창구 몇 개**(`applyView` / `applyItem` / `setPressed`)만 노출한다.
 *
 * ## 격자와 달리 누를 수 있다
 *
 * 슬롯에서 시작한 드래그는 그대로 격자 칸의 `onEnter` 로 이어지므로, 세션은 트레이에서
 * 집었는지 판에서 집었는지 신경 쓸 필요가 없다.
 */

import { Color } from 'horizon/core';
import { Binding, Pressable, Text, UINode, View } from 'horizon/ui';
import {
	EBoardCellAccent,
	PUZZLE_BOARD_MAX_ITEMS,
	PuzzleBoardItemView,
	createItemView,
	getGlyphRotation,
} from 'PuzzleBoardUI_Definitions';
import {
	TRAY_HEIGHT_USAGE,
	percentText,
	trayGrid,
	trayPageCount,
} from 'PuzzleUI_RelativeLayout';
import { clampNumber, fitFontSize } from 'PuzzleUI_Layout';
import {
	BoardMetrics,
	COLOR_RESET_BUTTON,
	COLOR_TEXT,
	ITEM_CORNER_RADIUS,
	NO_PRESSED_SLOT,
	createBorderOverlay,
	createGlyphFrame,
	createGrabRing,
	createLabelVisibility,
	createSlotBindings,
	createTextureLayer,
	getAccentBorderColor,
	getAccentBorderWidth,
	getAccentOpacity,
	getAccentScale,
	mergePressAccent,
	toColor,
} from 'PuzzleBoardUI_Parts';

//#region Style constants

/**
 * 트레이 상자가 보조 레이아웃 높이에서 차지하는 몫.
 *
 * **계산과 같은 값을 써야 한다.** `trayGrid()` 는 이 높이를 기준으로 슬롯 크기를 정하는데,
 * 화면이 그보다 크게 그리면 슬롯이 계산보다 커져 가로로 넘친다. 그래서 상수를 따로 두지
 * 않고 배치 규격(`TRAY_HEIGHT_USAGE`)을 그대로 가져다 쓴다.
 */
const TRAY_HEIGHT_PERCENT = percentText(TRAY_HEIGHT_USAGE * 100);
/** 트레이 슬롯 사이 간격 (슬롯 대비 %). 칸과 같은 이유로 padding 이다 */
const ITEM_SLOT_GAP_PERCENT = 5;
/** 페이지 넘김 화살표의 높이 (트레이 대비 %) */
const TRAY_ARROW_HEIGHT_PERCENT = 80;
/** 화살표 폭 - 슬롯 한 변 대비. 슬롯보다 확실히 좁아야 슬롯 자리를 뺏지 않는다 */
const TRAY_ARROW_WIDTH_USAGE = 0.42;
const TRAY_ARROW_PREV_LABEL = '<';
const TRAY_ARROW_NEXT_LABEL = '>';
/** 더 넘어갈 곳이 없을 때 화살표의 진하기 */
const TRAY_ARROW_DISABLED_OPACITY = 0.35;

/**
 * 진단 표시(`showTrayDebug`)의 색과 두께.
 *
 * **슬롯 얼굴이 아니라 형제 층에 그린다.** 얼굴은 내용이 안 보일 때 `opacity: 0` 이 되므로
 * (`getAccentOpacity`), 그 안에 그린 진단 표시는 정작 확인하고 싶은 경우에 같이 사라진다.
 * 형제로 두면 **내용이 비어 있어도 슬롯 상자는 보인다** - 그것이 "칸은 있는데 내용이
 * 없다(생성 안 됨)" 와 "칸 자체가 접혔다(숨겨짐)" 를 가르는 표시다.
 */
const COLOR_DEBUG_FRAME = new Color(1, 0.2, 0.8);
const DEBUG_FRAME_WIDTH = 2;
/** 진단 배지의 글자 - 슬롯 번호와 상태를 한 글자씩 적는다 */
const DEBUG_BADGE_RATIO = 0.3;

//#endregion

/**
 * 트레이가 패널에 되돌려 주는 입력.
 *
 * **뗌이 둘로 갈리는 것에 주의한다.** 슬롯에서 뗀 것은 "판 밖" 으로 단정하지 않는다 -
 * 슬롯에서 집어 판으로 끌고 간 뒤 칸 위에서 뗐는데 그 뗌이 슬롯으로 올라오는 경우가 있어서,
 * 여기서 밖으로 단정하면 **칸 위에서 뗐는데 부품이 인벤토리로 돌아간다.** 반면 화살표
 * 위에서 뗀 것은 판 밖이 확실하므로 그대로 확정한다 (리셋 버튼과 같은 처리다).
 */
export type BoardTrayHandlers = {
	onItemDown(index: number): void,
	/** 슬롯에서 뗐다 - 마감만 한다 (판 밖으로 단정하지 않는다) */
	onSlotRelease(): void,
	/** 화살표에서 뗐다 - 여기는 판 밖이 확실하다 */
	onArrowRelease(): void,
};

/**
 * 오브젝트 트레이 한 벌. 패널이 하나 만들어 두고 `createNode()` 로 트리에 끼운다.
 *
 * 슬롯 노드와 내용 `Binding` 은 **절대 슬롯 번호로 고정**되어 있다. 그래서 페이지를
 * 넘기는 일은 어느 슬롯을 펴고 접을지(`_slotShown`)를 다시 정하는 것이 전부다.
 */
export class BoardTrayRenderer {
	private readonly _metrics: BoardMetrics;
	private readonly _handlers: BoardTrayHandlers;

	/** 슬롯 내용 - 자리마다 하나. 목록 길이가 바뀌어도 이 배열은 그대로다 */
	private readonly _itemBindings: Binding<PuzzleBoardItemView>[] =
		createSlotBindings(PUZZLE_BOARD_MAX_ITEMS, createItemView);
	/** 지금 짚고 있는 슬롯 - 칸과 같은 이유로 자리마다 나눠 둔다 */
	private readonly _pressedFlags: Binding<boolean>[] =
		createSlotBindings(PUZZLE_BOARD_MAX_ITEMS, () => false);

	/**
	 * 그 슬롯이 **지금 페이지에 들어 있는지**.
	 *
	 * ## 왜 `DynamicList` 가 아닌가
	 *
	 * 트레이 슬롯은 "트레이 높이를 꽉 채우는 정사각형"(`height:'100%'` + `aspectRatio:1`)이다.
	 * 그런데 `DynamicList` 안에서는 그 `height:'100%'` 가 잡히지 않아 **슬롯이 높이 0 으로
	 * 그려졌다** - 화면에 아무것도 보이지 않고, 크기가 0 이니 눌리지도 않았다. 좌우 화살표는
	 * 목록 밖(트레이 View 의 직속 자식)이라 멀쩡히 보였고, 그래서 "페이지는 넘어가는데
	 * 오브젝트가 없다" 로 나타났다. 본 격자의 칸이 무사한 이유는 칸이 퍼센트가 아니라
	 * `flex: 1` 로 자리를 잡기 때문이다.
	 *
	 * 슬롯은 최대 8개뿐이라 목록으로 아낄 트리 크기(64kB 한도)가 크지 않다. 그래서 화살표와
	 * **똑같은 자리**(트레이 View 의 직속 자식)에 8개를 그대로 두고, 지금 페이지에 없는
	 * 슬롯만 `display: none` 으로 접는다.
	 */
	private readonly _slotShown: Binding<boolean>[] =
		createSlotBindings(PUZZLE_BOARD_MAX_ITEMS, () => false);

	/**
	 * 슬롯 한 변 (좌표 단위) - **글자 크기를 뽑는 데만 쓴다.**
	 *
	 * 슬롯의 크기 자체는 상대 배치가 정한다. 그런데 `fontSize` 는 숫자여야 하므로,
	 * 그 정사각형이 화면의 몇 % 인지를 좌표 단위로 환산해 여기에 담아 둔다
	 * (`trayGrid().slot`).
	 */
	private readonly _slotSide: Binding<number> = new Binding<number>(0);

	/**
	 * 슬롯 한 칸의 높이 - **트레이 높이를 줄 수로 나눈 %** 다 (`trayGrid`).
	 *
	 * 폭은 `aspectRatio: 1` 이 여기서 따라오므로, 이 한 값이 슬롯 크기를 통째로 정한다.
	 * 줄 수는 부품 수와 화면 비율이 정하므로 런타임에 바뀐다 - 그래서 `Binding` 이다.
	 */
	private readonly _slotHeight: Binding<string> = new Binding<string>('100%');

	/** 넘길 것이 있을 때만 화살표를 그린다 */
	private readonly _hasPaging: Binding<boolean> = new Binding<boolean>(false);
	private readonly _canPagePrev: Binding<boolean> = new Binding<boolean>(false);
	private readonly _canPageNext: Binding<boolean> = new Binding<boolean>(false);

	/** Binding 은 되읽을 수 없으므로 페이지 상태는 평범한 필드로도 들고 있는다 */
	private _page: number = 0;
	private _pageSize: number = 0;
	private _pageCount: number = 0;
	private _totalCount: number = 0;
	/** 지금 격자의 줄·칸 수 (`trayGrid`) - 진단 줄이 되읽는다 */
	private _rows: number = 0;
	private _cols: number = 0;
	private _pressedIndex: number = NO_PRESSED_SLOT;

	/** 슬롯 노드도 자리마다 한 번만 만들어 재사용한다 (`BoardGridRenderer` 와 같은 이유) */
	private readonly _slotNodeCache: (UINode | undefined)[] = new Array(PUZZLE_BOARD_MAX_ITEMS);

	//#region Diagnostics (`showTrayDebug`)

	/**
	 * 진단 모드인지 - 패널 prop `showTrayDebug` 를 그대로 받는다.
	 *
	 * 꺼져 있으면 진단 노드를 **트리에 올리지도 않는다.** 트레이는 슬롯 8벌이라
	 * 층을 하나 더 얹으면 노드가 8개 늘어난다 - 평소에 낼 비용이 아니다.
	 */
	private readonly _isDebug: boolean;

	/**
	 * 진단이 읽는 **평범한 필드들**. `Binding` 은 되읽을 수 없으므로 따로 들고 있는다.
	 *
	 * 이 값들이 "크리스탈이 안 보인다" 의 원인을 가른다.
	 *   `_itemCount` 0        - 퍼즐이 트레이를 선언하지 않았거나 프레젠터가 빈 배열을 넘겼다
	 *   `_slotVisible` 전부 false - 슬롯 상자는 있는데 CoreAPI 가 내용을 채우지 않았다
	 *   `_slotShownFlags` false  - 내용은 있는데 페이지에서 접혀 있다 (숨겨진 경우)
	 */
	private _itemCount: number = 0;
	private readonly _slotVisible: boolean[] = new Array(PUZZLE_BOARD_MAX_ITEMS).fill(false);
	private readonly _slotShownFlags: boolean[] = new Array(PUZZLE_BOARD_MAX_ITEMS).fill(false);
	private _slotSideUnits: number = 0;

	//#endregion

	constructor(metrics: BoardMetrics, handlers: BoardTrayHandlers, isDebug: boolean = false) {
		this._metrics = metrics;
		this._handlers = handlers;
		this._isDebug = isDebug;
	}

	//#region Panel-facing API

	/** 레벨이 올라왔다 - 슬롯 내용을 채우고 페이지를 처음으로 되돌린다 */
	public applyView(items: PuzzleBoardItemView[]): void {
		// **실제 슬롯 수만큼만 채운다** - 남는 자리는 접혀 있어 값이 낡아도 그려지지 않는다
		this._itemCount = items.length;
		const limit = Math.min(items.length, PUZZLE_BOARD_MAX_ITEMS);
		for (let slot = 0; slot < PUZZLE_BOARD_MAX_ITEMS; slot++) {
			if (slot >= limit) {
				this._slotVisible[slot] = false;
				continue;
			}
			const item = items[slot];
			const view = item === undefined ? createItemView() : item;
			this._itemBindings[slot].set(view);
			this._slotVisible[slot] = view.isVisible;
		}
		this.resetGrid();
		this.logDebug('applyView');
	}

	/**
	 * 슬롯 하나가 바뀌었다.
	 *
	 * 부품을 판에 내려놓으면 그 슬롯이 비므로 **격자를 다시 잡는다** - 남은 부품이 적어질수록
	 * 슬롯이 커진다. 내용만 바뀐 경우(집는 중의 실루엣 등)에는 다시 잡지 않는다.
	 */
	public applyItem(index: number, item: PuzzleBoardItemView): void {
		const binding = this._itemBindings[index];
		if (binding === undefined) {
			return;
		}
		binding.set(item);
		const wasVisible = this._slotVisible[index];
		this._slotVisible[index] = item.isVisible;
		if (wasVisible !== item.isVisible) {
			this.resetGrid();
		}
		this.logDebug(`applyItem ${index}`);
	}

	/** 짚고 있는 슬롯을 옮긴다 - **바뀐 두 자리의 Binding 만** 갱신한다 */
	public setPressed(index: number): void {
		const next = index < 0 ? NO_PRESSED_SLOT : index;
		if (next === this._pressedIndex) {
			return;
		}
		const previous = this._pressedIndex;
		this._pressedIndex = next;
		if (previous !== NO_PRESSED_SLOT) {
			this._pressedFlags[previous]?.set(false);
		}
		if (next !== NO_PRESSED_SLOT) {
			this._pressedFlags[next]?.set(true);
		}
	}

	/** 보드가 내려갔다 - 전부 접고 누름도 지운다 */
	public reset(): void {
		this._itemCount = 0;
		for (let slot = 0; slot < PUZZLE_BOARD_MAX_ITEMS; slot++) {
			this._slotVisible[slot] = false;
		}
		this.resetGrid();
		this.setPressed(NO_PRESSED_SLOT);
	}

	/**
	 * 트레이가 지금 어떤 상태인지 한 줄로 - **"안 그려졌다" 의 원인을 가르는 값들**이다.
	 *
	 * 화면(`showLayoutDebug` 줄)과 콘솔에 같은 문자열이 나간다. 읽는 법:
	 *
	 * ```
	 * tray items=7 vis=3 page=1/1 size=7 side=88 slots=VVV____
	 * ```
	 *
	 * | 슬롯 글자 | 뜻 | 크리스탈이 안 보인다면 |
	 * |---|---|---|
	 * | `V` | 내용이 있고(visible) 페이지에도 펴져 있다 | 상자와 내용 둘 다 있다 - 그림·색·크기를 본다 |
	 * | `v` | 내용은 있는데 페이지에서 접혔다 | **숨겨진 것이다** - 페이지를 넘기면 나온다 |
	 * | `.` | 펴져 있는데 내용이 비었다 | **생성되지 않은 것이다** - CoreAPI 가 슬롯을 안 채웠다 |
	 * | `_` | 접혀 있고 내용도 비었다 | 남는 슬롯. 정상이다 |
	 *
	 * `items=0` 이면 프레젠터가 슬롯을 하나도 넘기지 않은 것이다 - 그 퍼즐이 트레이를
	 * 규격(`PuzzleBoardLayoutSpec.itemCount`)에 적지 않았거나 보드가 올라오지 않았다.
	 * 화면에 그려지는 값이므로 영어다.
	 */
	public describeDebug(): string {
		let slots = '';
		for (let slot = 0; slot < PUZZLE_BOARD_MAX_ITEMS; slot++) {
			const isShown = this._slotShownFlags[slot];
			const isFilled = this._slotVisible[slot];
			slots += isFilled ? (isShown ? 'V' : 'v') : (isShown ? '.' : '_');
		}
		let visible = 0;
		for (let slot = 0; slot < PUZZLE_BOARD_MAX_ITEMS; slot++) {
			if (this._slotVisible[slot]) {
				visible++;
			}
		}
		return `tray items=${this._itemCount} vis=${visible} filled=${this._totalCount}`
			+ ` grid=${this._rows}x${this._cols}`
			+ ` page=${this._pageCount === 0 ? 0 : this._page + 1}/${this._pageCount}`
			+ ` size=${this._pageSize} side=${this._slotSideUnits} slots=${slots}`;
	}

	/** 진단 모드일 때만 콘솔에 같은 줄을 남긴다 */
	private logDebug(reason: string): void {
		if (this._isDebug === false) {
			return;
		}
		console.log(`[BoardTray] ${reason}: ${this.describeDebug()}`);
	}

	//#endregion

	//#region Paging

	/**
	 * 격자를 화면과 **지금 남아 있는 부품 수**에 맞춰 다시 잡는다.
	 *
	 * ## 왜 선언된 슬롯 수가 아니라 채워진 수인가
	 *
	 * 레이저는 슬롯을 일곱 개 선언하지만 난이도 1 의 부품은 하나뿐이다. 선언한 수로 격자를
	 * 잡으면 빈 슬롯 여섯 개가 자리를 차지해 **부품 하나가 1/9 크기로 그려지고**, 넘길 것도
	 * 없는 페이지가 셋이 된다. 채워진 수로 잡으면 부품 하나는 트레이를 꽉 채운다.
	 *
	 * 채워진 수는 **마지막으로 채워진 자리 + 1** 이다. 레이저처럼 앞에서부터 채우는 경우
	 * 곧 부품 수이고, 중간이 비는 퍼즐에서도 채워진 자리가 페이지 밖으로 밀려나지 않는다.
	 */
	private resetGrid(): void {
		this._totalCount = this.countFilledSlots();
		const grid = trayGrid(
			this._metrics.layout(), this._metrics.screenAspect(), this._totalCount);
		this._rows = grid.rows;
		this._cols = grid.cols;
		this._pageSize = grid.perPage;
		this._pageCount = trayPageCount(this._totalCount, this._pageSize);
		this._hasPaging.set(this._pageCount > 1);

		// 슬롯 크기는 이 한 값이 정한다 - 폭은 `aspectRatio: 1` 이 따라온다
		this._slotHeight.set(percentText(grid.slotHeightPercent));
		this._slotSideUnits = this._metrics.units(grid.slot.ofHeight);
		this._slotSide.set(this._slotSideUnits);

		// 페이지 크기가 바뀌었으므로 첫 페이지부터 다시 보인다
		this.applyPage(0);
	}

	/** 마지막으로 채워진 자리 + 1. 전부 비어 있으면 0 이다 */
	private countFilledSlots(): number {
		for (let slot = PUZZLE_BOARD_MAX_ITEMS - 1; slot >= 0; slot--) {
			if (this._slotVisible[slot]) {
				return slot + 1;
			}
		}
		return 0;
	}

	/** 페이지를 넘긴다. 범위 밖이면 끝 페이지에 머문다 - 감아 돌면 어디까지 봤는지 잃는다 */
	private applyPage(page: number): void {
		const lastPage = Math.max(0, this._pageCount - 1);
		this._page = clampNumber(Math.round(page), 0, lastPage);
		this._canPagePrev.set(this._page > 0);
		this._canPageNext.set(this._page < lastPage);

		// 페이지에 든 슬롯만 펴고 나머지는 접는다 (`_slotShown` 주석).
		// 페이지 크기가 0 이면(보드가 없을 때) 전부 접힌다.
		const first = this._pageSize <= 0 ? 0 : this._page * this._pageSize;
		const last = this._pageSize <= 0
			? 0
			: Math.min(this._totalCount, first + this._pageSize);
		for (let slot = 0; slot < PUZZLE_BOARD_MAX_ITEMS; slot++) {
			const isShown = slot >= first && slot < last;
			this._slotShown[slot].set(isShown);
			// 진단이 되읽을 수 있게 평범한 배열에도 남긴다 (`describeDebug`)
			this._slotShownFlags[slot] = isShown;
		}
	}

	//#endregion

	//#region Nodes

	/**
	 * 트레이 한 벌.
	 *
	 * ## 왜 슬라이드바인가
	 *
	 * 부품 하나의 크기는 화면이 정한다 - 트레이 상자를 채우되 **화면 아래 절반의 20%**
	 * 밑으로는 내려가지 않는다. 예전처럼 슬롯 수로 트레이 폭을 나누면 레이저의 인벤토리
	 * (7칸)에서 부품이 손가락보다 작아져 집을 수가 없었다. 그래서 크기를 지키고, 한 줄에
	 * 다 들어가지 않으면 좌우 화살표로 **넘겨 본다.** 다 들어가는 경우에는 화살표를 그리지
	 * 않는다 - `_hasPaging` 이 그 판정이고, 그때는 화살표 폭까지 슬롯이 쓴다.
	 */
	public createNode(): UINode {
		const slotNodes: UINode[] = [];
		for (let index = 0; index < PUZZLE_BOARD_MAX_ITEMS; index++) {
			slotNodes.push(this.getSlotNode(index));
		}
		const slots = View({
			children: slotNodes,
			style: {
				flex: 1,
				height: '100%',
				flexDirection: 'row',
				// **줄바꿈 격자다.** 슬롯 높이(`_slotHeight`)가 줄 수를 정하고, 한 줄에 다
				// 들어가지 않는 슬롯은 다음 줄로 넘어간다. 줄 수와 칸 수는 `trayGrid()` 가
				// 넘치지 않게 고르므로, 넘어간 줄까지 트레이 안에 들어온다.
				// 메인 메뉴의 퍼즐 격자와 같은 방식이다 (`PuzzleUI_MainPanel` 의 catalog grid).
				flexWrap: 'wrap',
				justifyContent: 'center',
				// 줄이 하나뿐이거나 마지막 줄이 덜 찼을 때 격자를 세로 가운데에 둔다
				alignContent: 'center',
				// 계산이 어긋나도 옆 화면을 침범하지 않게 하는 마지막 안전핀이다.
				// **여기에 기대지 않는다** - 잘려 보이던 예전 배치가 그 실패였다
				overflow: 'hidden',
			},
		});

		return View({
			children: [
				this.createArrow(TRAY_ARROW_PREV_LABEL, -1, this._canPagePrev),
				slots,
				this.createArrow(TRAY_ARROW_NEXT_LABEL, 1, this._canPageNext),
			],
			style: {
				flex: 1,
				height: TRAY_HEIGHT_PERCENT,
				marginLeft: '2%',
				flexDirection: 'row',
				alignItems: 'center',
			},
		});
	}

	/**
	 * 트레이를 넘기는 좌우 화살표.
	 *
	 * 넘길 것이 없으면(`_hasPaging` 이 false) 자리조차 만들지 않는다 - 자리만 비워 두면
	 * 부품 한 칸이 들어갈 폭을 화살표가 계속 붙들고 있게 된다.
	 * 끝 페이지에서는 흐리게 그려 **더 넘어갈 곳이 없다**를 보인다. 감아 돌지 않는 이유는
	 * 어디까지 봤는지를 잃지 않기 위해서다.
	 *
	 * 끌던 부품을 화살표 위에서 떼는 경우도 리셋 버튼과 같은 규칙으로 마감한다 -
	 * 여기는 판 밖이 확실하므로 부품이 인벤토리로 돌아간다.
	 */
	private createArrow(label: string, step: number, isEnabled: Binding<boolean>): UINode {
		// 화살표는 트레이 높이에 비례한다 - 슬롯 하나만큼의 폭을 둘이 나눠 가지지 않도록
		// 슬롯보다 확실히 좁게 잡는다. 글자 크기는 그 폭에서 나온다.
		// 화살표 폭은 지금 슬롯 한 변에 비례한다 - 격자가 잘아지면 화살표도 같이 잘아진다.
		// 글자 크기만 쓰는 값이라 레벨이 올라오기 전(슬롯 0)에는 보조 레이아웃 높이를 쓴다
		const width = Math.max(1, Math.round(
			(this._slotSideUnits > 0 ? this._slotSideUnits : this._metrics.auxHeightUnits())
			* TRAY_ARROW_WIDTH_USAGE));
		return Pressable({
			children: [
				Text({
					text: label,
					style: {
						color: COLOR_TEXT,
						fontSize: fitFontSize(width, {
							ratio: 0.62,
							minimum: 18,
							maximum: 40,
							scale: this._metrics.fontScale(),
							pixelScale: this._metrics.pixelScale(),
						}),
						fontWeight: 'bold',
						textAlign: 'center',
						width: '100%',
					},
				}),
			],
			// 누르는 순간 넘긴다 - 릴리즈를 기다리지 않는다 (Menu 버튼과 같은 이유)
			onPress: () => { this.applyPage(this._page + step); },
			onRelease: () => this._handlers.onArrowRelease(),
			propagateClick: false,
			style: {
				height: percentText(TRAY_ARROW_HEIGHT_PERCENT),
				aspectRatio: TRAY_ARROW_WIDTH_USAGE,
				borderRadius: this._metrics.px(10),
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: COLOR_RESET_BUTTON,
				opacity: isEnabled.derive((canPage) => (canPage ? 1 : TRAY_ARROW_DISABLED_OPACITY)),
				display: this._hasPaging.derive((hasPaging) => (hasPaging ? 'flex' : 'none')),
			},
		});
	}

	/** 슬롯 노드는 자리마다 한 번만 만든다 */
	private getSlotNode(index: number): UINode {
		let node = this._slotNodeCache[index];
		if (node === undefined) {
			node = this.createSlot(this._itemBindings[index], index);
			this._slotNodeCache[index] = node;
		}
		return node;
	}

	/** 트레이 슬롯. 칸과 같은 이유로 `Pressable` 과 "얼굴" 을 나눈다 */
	private createSlot(binding: Binding<PuzzleBoardItemView>, index: number): UINode {
		const metrics = this._metrics;
		// 칸과 같은 이유로 이 슬롯의 플래그에서만 파생한다 (createGridCell 주석)
		const pressedFlag = this._pressedFlags[index];
		const fromAccent = <T>(map: (accent: EBoardCellAccent) => T) => Binding.derive(
			[binding, pressedFlag],
			(item: PuzzleBoardItemView, isPressed: boolean) => map(mergePressAccent(item.accent, isPressed)),
		);

		const scale = fromAccent(getAccentScale);
		// 슬롯 한 변은 레벨이 올라올 때 다시 계산된다 (`_slotSide`).
		// 글자도 슬롯을 따라 커진다 - "슬롯은 큰데 글자만 작은" 것을 만들지 않는다.
		const side = this._slotSide;
		const labelSize = side.derive((slotSide) => fitFontSize(slotSide, {
			ratio: 0.44, minimum: 14, maximum: 40,
			scale: metrics.fontScale(), pixelScale: metrics.pixelScale(),
		}));

		const face = View({
			children: [
				createTextureLayer<PuzzleBoardItemView>(
					metrics, binding, (item) => item.texture, (item) => item.fill, (item) => item.tint,
					ITEM_CORNER_RADIUS),
				// 판 위와 같은 규칙이다 - 그림이 있으면 글자는 물러나고, 방향은 그림이 돌아서 알린다
				UINode.if(
					createLabelVisibility<PuzzleBoardItemView>(
						metrics, binding, (item) => item.label, (item) => item.texture),
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
				),
				Text({
					text: binding.derive((item) => item.caption),
					style: {
						color: binding.derive((item) => toColor(item.labelColor)),
						// `DerivedBinding` 에서 다시 파생할 수 없으므로 원본(슬롯 크기)에서 한 번 더 파생한다
						fontSize: side.derive((slotSide) => Math.max(10, Math.round(
							fitFontSize(slotSide, {
								ratio: 0.44, minimum: 14, maximum: 40,
								scale: metrics.fontScale(), pixelScale: metrics.pixelScale(),
							}) * 0.45))),
						textAlign: 'center',
						width: '100%',
						opacity: 0.8,
					},
				}),
			],
			style: {
				width: '100%',
				height: '100%',
				borderRadius: metrics.px(ITEM_CORNER_RADIUS),
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
				createGlyphFrame(metrics, binding, scale, ITEM_CORNER_RADIUS, slotGap),
				createBorderOverlay(
					metrics,
					Binding.derive(
						[binding, pressedFlag],
						// 테두리 두께는 기준 캔버스 픽셀로 튜닝한 값이라 실제 해상도로 환산한다
						(item: PuzzleBoardItemView, isPressed: boolean) => metrics.scaleBorderWidth(
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
				createGrabRing(
					metrics,
					fromAccent((accent) => (accent === EBoardCellAccent.GRABBED ? 'flex' : 'none')),
					ITEM_SLOT_GAP_PERCENT),
				// 진단 층은 **얼굴의 형제**다 - 내용이 비어 얼굴이 투명해져도 남는다
				this.createDebugOverlay(binding, index, slotGap),
			],
			onPress: () => { this._handlers.onItemDown(index); },
			onRelease: () => this._handlers.onSlotRelease(),
			// 칸과 같은 이유로 전파를 막지 않는다 (`createGridCell()` 주석)
			style: {
				// **자기 줄의 높이를 꽉 채우는 정사각형이다.** 줄 수는 `trayGrid()` 가 화면
				// 비율과 부품 수를 보고 정한다 - 세로로 긴 화면에서는 여러 줄이 되어 슬롯이
				// 작아지고, 그만큼 한 줄에 더 들어간다. 폭은 `aspectRatio` 가 따라온다.
				height: this._slotHeight,
				aspectRatio: 1,
				// 슬롯 하나가 트레이보다 넓은 극단적인 화면에서도 넘치지 않게 한다
				maxWidth: '100%',
				// 지금 페이지에 없는 슬롯은 접는다 - 접힌 슬롯은 자리도 차지하지 않는다
				display: this._slotShown[index].derive((isShown) => (isShown ? 'flex' : 'none')),
				// 칸과 같은 이유로 margin 이 아니라 padding 이다 (죽은 영역을 만들지 않는다)
				padding: slotGap,
				alignItems: 'center',
				justifyContent: 'center',
			},
		});
	}

	/**
	 * 슬롯 하나의 진단 표시 (`showTrayDebug`) - **상자가 있는지 눈으로 가리는 층**이다.
	 *
	 * 슬롯 번호와 내용 유무(`V`/`.`)를 적은 형광 테두리 상자다. 켜 두고 화면을 보면
	 * 세 경우가 한눈에 갈린다.
	 *
	 *   번호 상자가 보이고 그 안이 비었다  -> 슬롯은 그려졌는데 **내용이 없다** (생성 안 됨)
	 *   번호 상자가 아예 안 보인다        -> 슬롯이 접혔거나 크기가 0 이다 (**숨겨짐**)
	 *   번호 상자도 내용도 보인다          -> 트레이는 정상. 색·그림 쪽을 본다
	 *
	 * 얼굴이 아니라 형제로 두는 이유는 머리말의 `COLOR_DEBUG_FRAME` 주석에 있다.
	 * 진단이 꺼져 있으면 **노드를 만들지 않는다** (`UINode.if` 가 아니라 빈 View 도 아니다).
	 */
	private createDebugOverlay(
		binding: Binding<PuzzleBoardItemView>,
		index: number,
		inset: string,
	): UINode {
		if (this._isDebug === false) {
			// 진단이 꺼져 있으면 자리만 차지하지 않는 빈 노드를 둔다
			return View({ children: [], style: { display: 'none', position: 'absolute' } });
		}
		const metrics = this._metrics;
		return View({
			children: [
				Text({
					// 슬롯 번호 + 내용 유무. 상자는 보이는데 글자가 `.` 이면 내용이 없는 것이다
					text: binding.derive((item) => `${index}${item.isVisible ? 'V' : '.'}`),
					style: {
						color: COLOR_DEBUG_FRAME,
						fontSize: this._slotSide.derive((slotSide) => fitFontSize(slotSide, {
							ratio: DEBUG_BADGE_RATIO, minimum: 10, maximum: 24,
							scale: metrics.fontScale(), pixelScale: metrics.pixelScale(),
						})),
						fontWeight: 'bold',
						textAlign: 'center',
						width: '100%',
					},
				}),
			],
			style: {
				position: 'absolute',
				left: inset,
				top: inset,
				right: inset,
				bottom: inset,
				borderRadius: metrics.px(ITEM_CORNER_RADIUS),
				borderWidth: metrics.px(DEBUG_FRAME_WIDTH),
				borderColor: COLOR_DEBUG_FRAME,
				alignItems: 'center',
				justifyContent: 'flex-start',
			},
		});
	}

	//#endregion
}
