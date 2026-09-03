/**
 * # 보드 화면의 상대 배치 규격 - 픽셀을 쓰지 않는다
 *
 * ## 왜 이 모듈이 따로 있는가
 *
 * `PuzzleUI_Layout` 은 `player.screenWidth/screenHeight` 읽기값에서 **절대 픽셀**을 계산해
 * 배치했다. 그런데 2026-09-03 실기 측정(`showLayoutProbe`)에서 **읽기값의 단위가 패널
 * 좌표계와 다르다**는 것이 확인되었다.
 *
 * - 패널 좌표 1 단위 = **디바이스 실픽셀 1** (프로브의 `D` 상자 100 단위가 실측 100px 로 그려졌다)
 * - 그런데 `screenWidth/screenHeight` 는 **긴 변을 1280 으로 정규화한** 값을 준다
 *   (실측 1179x2556 폰이 590x1280 으로 읽혔다)
 * - `panelWidth`/`panelHeight` 를 바꿔도 이 좌표계는 변하지 않는다 (1280 -> 590 으로 줄여도 그대로였다)
 *
 * 즉 **읽기값에서 얻을 수 있는 믿을 만한 정보는 화면 비율뿐이고, 절대 크기는 알 수 없다.**
 * 반대로 같은 측정에서 상대 배치는 전부 정확하게 동작했다.
 *
 * | 확인한 것 | 결과 |
 * |---|---|
 * | `flex: 7` / `flex: 3` | 화면 세로의 69.5% 에서 갈렸다 |
 * | `height:'100%'` + `aspectRatio:1` + `maxWidth:'100%'` | **정사각형**이고 영역 안에 들어왔다 (CSS 의 `min()` 과 같은 동작) |
 * | `width: '20%'` | 영역 폭의 정확히 1/5 |
 * | 행 `flex:1` + 칸 `flex:1` | 4x4 칸이 모두 같은 정사각형 |
 *
 * 그래서 보드 화면은 **퍼센트와 flex 로만** 짠다. 이 모듈은 그 퍼센트를 계산한다.
 *
 * ## 핵심 요령 두 가지
 *
 * ### 1. 정사각형은 `aspectRatio` + `maxWidth` 로 만든다
 *
 * `height:'100%' + aspectRatio:1 + maxWidth:'<n>%'` 는 "세로를 꽉 채우되 가로가 모자라면
 * 가로에 맞춘다", 즉 `min(가로, 세로)` 다. 화면이 세로로 길든 가로로 길든 분기가 필요 없다.
 *
 * ### 2. 정사각형 부모 안에서는 `width:'x%'` 와 `height:'x%'` 가 같은 길이다
 *
 * 격자는 판마다 행·열 수가 다른데(4행 8열, 5행 6열, 9x9...), 칸은 **언제나 정사각형**이어야
 * 한다. `aspectRatio` 는 `Bindable` 이 아니라 레벨마다 바꿀 수 없다. 그런데 부모(보드 판)가
 * 정사각형이므로, 자식에 준 `width:'80%'` 와 `height:'80%'` 는 **물리적으로 같은 길이**가 된다.
 * 그래서 격자 상자를
 *
 *     width  = 100 * colCount / max(rowCount, colCount) %
 *     height = 100 * rowCount / max(rowCount, colCount) %
 *
 * 로 주면 (`computeGridBox`) 칸이 정확히 정사각형이 된다. 둘 다 `Bindable<DimensionValue>` 라
 * 레벨마다 갈아 끼울 수 있다.
 *
 * ## 픽셀이 남는 곳 - 글자와 테두리뿐
 *
 * `fontSize`/`borderWidth`/`borderRadius` 는 `horizon/ui` 에 상대 단위가 없어 숫자여야 한다.
 * 그 숫자만 `screenPixelRatio`(읽기값 -> 좌표계 배율, 실기 측정값 2)를 거쳐 환산한다
 * (`toUnits`). **배치는 이 배율을 쓰지 않는다.** 배율이 틀린 기기에서도 판은 정확히
 * 그려지고 글자만 조금 크거나 작아진다.
 */

/** 본 격자 영역과 보조 레이아웃의 세로 비율 - 참고 구현(`Documents/SampleHtml`)과 같은 7:3 */
export const BOARD_AREA_FLEX = 7;
export const AUX_AREA_FLEX = 3;

/** 화면 위에 비워 둘 세로 % - 상태바·노치와 호라이즌 자체 버튼(`...`/`≡`) 자리다 */
export const BOARD_TOP_INSET_PERCENT = 6;
/** 화면 아래에 비워 둘 세로 % - `Menu` 버튼 띠와 홈 인디케이터 자리다 */
export const BOARD_BOTTOM_INSET_PERCENT = 8;
/** 보드 정사각형이 쓰는 가로 % - 나머지가 좌우 여백으로 반씩 나뉜다 */
export const BOARD_WIDTH_PERCENT = 96;
/** 보드 정사각형이 본 격자 영역의 세로에서 쓰는 % - 아래 보조 레이아웃과의 틈이 나머지다 */
export const BOARD_HEIGHT_PERCENT = 94;

/** 위아래 여백의 합이 이 값을 넘으면 판이 남는 자리가 없다 */
const MAX_TOTAL_INSET_PERCENT = 40;
/** 한 쪽 여백의 상한 */
const MAX_SINGLE_INSET_PERCENT = 25;

/** 트레이가 보조 레이아웃 세로에서 쓰는 비율 */
export const TRAY_HEIGHT_USAGE = 0.78;
/** 트레이가 보조 레이아웃 가로에서 쓰는 비율 - 나머지는 리셋 버튼과 여백이다 */
export const TRAY_WIDTH_USAGE = 0.66;
/** 한 페이지에 적어도 보이게 할 슬롯 수 - 이보다 적게 보이면 넘기기가 고역이 된다 */
export const TRAY_MIN_VISIBLE_SLOTS = 3;
/** 한 페이지에 이보다 많이 넣지 않는다 - 넘어가면 부품이 손가락보다 작아진다 */
export const TRAY_MAX_VISIBLE_SLOTS = 8;

/** 에디터에서 넘어오는 요청값. 전부 생략 가능하고, 생략하면 위 기본값이 쓰인다 */
export type PuzzleBoardRelativeRequest = {
	topInsetPercent?: number,
	bottomInsetPercent?: number,
	boardWidthPercent?: number,
	boardHeightPercent?: number,
};

/** 다듬어 확정한 상대 배치. **여기에 픽셀은 하나도 없다** */
export type PuzzleBoardRelativeLayout = {
	/** 화면 위/아래에 비워 두는 세로 % */
	topInsetPercent: number,
	bottomInsetPercent: number,
	/** 본 격자 영역 : 보조 레이아웃 = 7 : 3 */
	boardFlex: number,
	auxFlex: number,
	/** 보드 정사각형이 쓰는 가로 % (화면 대비) 와 세로 % (본 격자 영역 대비) */
	boardWidthPercent: number,
	boardHeightPercent: number,
};

/** 격자 상자의 크기 - **정사각형 부모 대비 %**. 둘 다 같은 단위라 칸이 정사각형이 된다 */
export type PuzzleGridBoxPercent = {
	widthPercent: number,
	heightPercent: number,
};

/** 화면 대비 비율로 나타낸 길이. 같은 길이를 가로 기준과 세로 기준 둘로 들고 있는다 */
export type PuzzleScreenFraction = {
	/** 화면 **가로** 대비 비율 */
	ofWidth: number,
	/** 화면 **세로** 대비 비율 */
	ofHeight: number,
};

function clamp(value: number, low: number, high: number): number {
	if (isFinite(value) === false) {
		return low;
	}
	return Math.min(high, Math.max(low, value));
}

/** 스타일에 그대로 넣는 퍼센트 문자열 (`'96%'`). 소수점 두 자리까지 남긴다 */
export function percentText(value: number): string {
	return `${Math.round(clamp(value, 0, 100) * 100) / 100}%`;
}

/**
 * 요청값을 화면에 들어가는 범위로 다듬는다.
 *
 * 위아래 여백의 합이 너무 크면 판이 앉을 자리가 없어지므로 둘을 같은 비율로 줄인다.
 * 7:3 분할은 **고정**이다 - 그 비율은 기획이 정한 화면 구성이고, 여백만 기기·기획에 따라 준다.
 */
export function resolveRelativeLayout(request: PuzzleBoardRelativeRequest = {}): PuzzleBoardRelativeLayout {
	let top = clamp(request.topInsetPercent ?? BOARD_TOP_INSET_PERCENT, 0, MAX_SINGLE_INSET_PERCENT);
	let bottom = clamp(request.bottomInsetPercent ?? BOARD_BOTTOM_INSET_PERCENT, 0, MAX_SINGLE_INSET_PERCENT);
	const total = top + bottom;
	if (total > MAX_TOTAL_INSET_PERCENT) {
		const shrink = MAX_TOTAL_INSET_PERCENT / total;
		top = top * shrink;
		bottom = bottom * shrink;
	}
	return {
		topInsetPercent: top,
		bottomInsetPercent: bottom,
		boardFlex: BOARD_AREA_FLEX,
		auxFlex: AUX_AREA_FLEX,
		boardWidthPercent: clamp(request.boardWidthPercent ?? BOARD_WIDTH_PERCENT, 10, 100),
		boardHeightPercent: clamp(request.boardHeightPercent ?? BOARD_HEIGHT_PERCENT, 10, 100),
	};
}

/**
 * 격자 상자의 크기를 **정사각형 부모 대비 %** 로 낸다.
 *
 * 긴 쪽이 100% 를 쓰고 짧은 쪽이 그 비율만큼 줄어든다. 부모가 정사각형이므로 두 퍼센트는
 * 같은 길이 단위이고, 그래서 행·칸을 `flex: 1` 로 나누면 칸이 정확히 정사각형이 된다
 * (머리말 §2). 판이 없을 때(0행 0열)는 0% 를 돌려주어 아무것도 그려지지 않게 한다.
 */
export function computeGridBox(rowCount: number, colCount: number): PuzzleGridBoxPercent {
	const rows = Math.max(0, Math.floor(rowCount));
	const cols = Math.max(0, Math.floor(colCount));
	const span = Math.max(rows, cols);
	if (span <= 0) {
		return { widthPercent: 0, heightPercent: 0 };
	}
	return {
		widthPercent: 100 * cols / span,
		heightPercent: 100 * rows / span,
	};
}

/** 본 격자 영역이 화면 세로에서 차지하는 비율 */
export function boardAreaFraction(layout: PuzzleBoardRelativeLayout): number {
	const usable = Math.max(0, 100 - layout.topInsetPercent - layout.bottomInsetPercent) / 100;
	return usable * layout.boardFlex / (layout.boardFlex + layout.auxFlex);
}

/** 보조 레이아웃이 화면 세로에서 차지하는 비율 */
export function auxAreaFraction(layout: PuzzleBoardRelativeLayout): number {
	const usable = Math.max(0, 100 - layout.topInsetPercent - layout.bottomInsetPercent) / 100;
	return usable * layout.auxFlex / (layout.boardFlex + layout.auxFlex);
}

/**
 * 보드 정사각형 한 변이 화면에서 차지하는 비율.
 *
 * **배치에는 쓰지 않는다** - 배치는 `aspectRatio` + `maxWidth` 가 알아서 한다
 * (머리말 §1). 이 값이 필요한 곳은 글자 크기뿐이다: 칸이 화면의 몇 % 인지를 알아야
 * 칸 안의 글자 크기를 정할 수 있다.
 *
 * `screenAspect` 는 화면 가로/세로다. 읽기값의 **단위는 못 믿어도 비율은 믿을 수 있다** -
 * 그래서 이 계산만은 읽기값에서 해도 안전하다.
 */
export function boardSquareFraction(
	layout: PuzzleBoardRelativeLayout,
	screenAspect: number,
): PuzzleScreenFraction {
	const aspect = clamp(screenAspect, 0.1, 10);
	const byWidth = layout.boardWidthPercent / 100;
	// 세로 예산을 가로 단위로 옮긴다 - 화면 세로 1 은 화면 가로 (1 / aspect) 이다
	const byHeight = boardAreaFraction(layout) * (layout.boardHeightPercent / 100) / aspect;
	const ofWidth = Math.max(0, Math.min(byWidth, byHeight));
	return { ofWidth: ofWidth, ofHeight: ofWidth * aspect };
}

/**
 * 격자 칸 한 변이 화면에서 차지하는 비율.
 *
 * 격자 상자가 정사각형 판의 긴 쪽을 100% 로 쓰므로, 칸 한 변은 판 한 변을
 * **행·열 중 많은 쪽**으로 나눈 값이다 (`computeGridBox` 와 같은 규칙).
 */
export function cellFraction(
	layout: PuzzleBoardRelativeLayout,
	screenAspect: number,
	rowCount: number,
	colCount: number,
): PuzzleScreenFraction {
	const span = Math.max(1, Math.max(Math.floor(rowCount), Math.floor(colCount)));
	const board = boardSquareFraction(layout, screenAspect);
	return { ofWidth: board.ofWidth / span, ofHeight: board.ofHeight / span };
}

/**
 * 트레이 슬롯 한 변이 화면에서 차지하는 비율.
 *
 * 슬롯은 정사각형이고 트레이 높이를 꽉 채운다 (`height:'100%' + aspectRatio:1`).
 * 그래서 세로 기준 비율이 곧 슬롯 크기다.
 */
export function traySlotFraction(
	layout: PuzzleBoardRelativeLayout,
	screenAspect: number,
): PuzzleScreenFraction {
	const aspect = clamp(screenAspect, 0.1, 10);
	const ofHeight = auxAreaFraction(layout) * TRAY_HEIGHT_USAGE;
	return { ofHeight: ofHeight, ofWidth: ofHeight / aspect };
}

/**
 * 한 페이지에 늘어놓을 슬롯 수.
 *
 * 슬롯은 트레이 높이만 한 정사각형이므로, 트레이 폭을 슬롯 한 변으로 나누면 몇 개가
 * 들어가는지 나온다. **두 길이 다 화면 비율로만 표현되므로 절대 픽셀이 필요 없다** -
 * 픽셀로 나누던 예전 계산(`computeTrayPageSize`)이 이것으로 대체된다.
 *
 * 좁은 화면에서 한 번에 하나씩만 보이면 부품 일곱 개를 보려고 여섯 번을 넘겨야 하므로
 * 최소 세 개는 보이게 하고(그만큼 슬롯이 작아진다), 반대로 너무 많이 넣어 부품이
 * 손가락보다 작아지지 않도록 위도 막는다.
 */
export function traySlotsPerPage(
	layout: PuzzleBoardRelativeLayout,
	screenAspect: number,
	slotCount: number,
): number {
	const total = Math.max(0, Math.floor(slotCount));
	if (total <= 0) {
		return 0;
	}
	const slot = traySlotFraction(layout, screenAspect);
	const trayWidth = TRAY_WIDTH_USAGE;
	const fits = slot.ofWidth > 0 ? Math.floor(trayWidth / slot.ofWidth) : TRAY_MIN_VISIBLE_SLOTS;
	const perPage = clamp(fits, TRAY_MIN_VISIBLE_SLOTS, TRAY_MAX_VISIBLE_SLOTS);
	return Math.max(1, Math.min(total, Math.floor(perPage)));
}

/** 슬롯 수와 페이지 크기에서 전체 페이지 수 */
export function trayPageCount(slotCount: number, perPage: number): number {
	const total = Math.max(0, Math.floor(slotCount));
	const size = Math.max(1, Math.floor(perPage));
	return total <= 0 ? 0 : Math.ceil(total / size);
}
