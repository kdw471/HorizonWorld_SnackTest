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
/**
 * 한 페이지에 이보다 많이 넣지 않는다 - 넘어가면 부품이 손가락보다 작아진다.
 *
 * 짝이던 `TRAY_MIN_VISIBLE_SLOTS`(적어도 셋은 보이게)는 없앴다. 들어갈 자리가 없는데도
 * 셋을 펴다가 부품이 잘려 나간 것이 2026-09-04 의 버그였다 (`trayGrid` 머리말).
 * 지금은 **들어가는 배치만 고르고**, 그래도 모자라면 줄을 쌓는다.
 */
export const TRAY_MAX_VISIBLE_SLOTS = 8;
/**
 * 트레이를 몇 줄까지 쌓을지.
 *
 * 줄을 늘리면 슬롯이 그만큼 작아진다 (슬롯 한 변 = 트레이 높이 / 줄 수). 세 줄이면
 * 슬롯이 트레이 높이의 1/3 인데, 그 아래로 내려가면 부품이 손가락보다 작아진다.
 */
export const TRAY_MAX_ROWS = 3;

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
 * 화면 -> 격자 변환에 필요한 전부 - 패널이 확정한 상대 배치와 화면 비율.
 *
 * 패널(`PuzzleBoardUI_Panel.resolveLayout`)이 이 두 값을 `PuzzleBoardStage` 에 실어 두면,
 * 드래그 스트림(`Puzzle_HorizonBridge.PuzzleScreenDragStream`)이 Focused Interaction 의
 * 정규화 화면 좌표를 아래 `screenPointToGridPoint()` 로 격자 좌표로 바꾼다
 * (드래그 반응속도 개선 제안 §3 제안 1).
 */
export type PuzzleScreenGridGeometry = {
	layout: PuzzleBoardRelativeLayout,
	/** 화면 가로/세로. 읽기값의 단위는 못 믿어도 비율은 믿을 수 있다 (머리말) */
	screenAspect: number,
};

/** 연속 격자 좌표 - 정수가 칸 중심이다. 드래그 컨트롤러가 받는 형태 그대로다 */
export type PuzzleContinuousGridPoint = {
	row: number,
	col: number,
};

/**
 * **정규화 화면 좌표(0~1) -> 연속 격자 좌표** (제안 1 의 핵심 변환).
 *
 * 패널의 상대 배치를 그대로 따라 격자 사각형을 화면 비율로 복원한다.
 *
 *   세로 흐름: topInset -> 본 격자 영역(boardAreaFraction) -> 보조 -> bottomInset
 *   보드 정사각형: 본 격자 영역의 세로 boardHeightPercent%, 화면 가로 boardWidthPercent%
 *                 중 작은 쪽 (`boardSquareFraction`) - 영역 안에서 상하좌우 중앙 정렬
 *   격자 상자: 정사각 판 대비 cols/span x rows/span (`computeGridBox`) - 판 안에서 중앙 정렬
 *
 * 반환은 **연속 좌표**다 - 정수가 칸 중심이고, 격자 밖이면 범위를 벗어난 값이 나온다.
 * 잘라내지 않는 것이 §8.4 (판 밖으로 나가도 드래그 유지) 규약이다 - 경계 클램프는
 * 각 퍼즐의 드래그 컨트롤러가 담당한다. 좌표를 만들 수 없으면 undefined.
 *
 * `screenY` 는 **화면 위가 0** 인 값으로 가정한다. Focused Interaction 의 `screenPosition`
 * 이 반대(아래가 0)로 오는 것이 기기 실험에서 확인되면 호출부가 `1 - y` 로 뒤집는다
 * (`Puzzle_HorizonBridge` 의 `SCREEN_POSITION_Y_IS_TOP_DOWN`).
 */
export function screenPointToGridPoint(
	geometry: PuzzleScreenGridGeometry,
	rowCount: number,
	colCount: number,
	screenX: number,
	screenY: number,
): PuzzleContinuousGridPoint | undefined {
	if (isFinite(screenX) === false || isFinite(screenY) === false) {
		return undefined;
	}
	const rows = Math.max(0, Math.floor(rowCount));
	const cols = Math.max(0, Math.floor(colCount));
	const span = Math.max(rows, cols);
	if (span <= 0) {
		return undefined;
	}

	const layout = geometry.layout;
	// 보드 정사각형의 한 변 - 화면 가로 대비 / 세로 대비 (같은 길이의 두 표현)
	const square = boardSquareFraction(layout, geometry.screenAspect);
	if (square.ofWidth <= 0 || square.ofHeight <= 0) {
		return undefined;
	}

	// 판은 본 격자 영역 안에서 상하좌우 중앙 정렬이다 (`createBoardArea` 의 center 정렬)
	const squareLeft = (1 - square.ofWidth) / 2;
	const boardAreaTop = layout.topInsetPercent / 100;
	const squareTop = boardAreaTop + (boardAreaFraction(layout) - square.ofHeight) / 2;

	// 격자 상자는 판 대비 cols/span x rows/span 이고 판 안에서 중앙 정렬이다 (`computeGridBox`)
	const gridWidth = square.ofWidth * cols / span;
	const gridHeight = square.ofHeight * rows / span;
	const gridLeft = squareLeft + (square.ofWidth - gridWidth) / 2;
	const gridTop = squareTop + (square.ofHeight - gridHeight) / 2;

	// 칸 한 변 - 판 한 변을 span 으로 나눈 값 (`cellFraction` 과 같은 규칙)
	const cellWidth = square.ofWidth / span;
	const cellHeight = square.ofHeight / span;

	// 정수 = 칸 중심. 칸 c 의 구간은 [gridLeft + c*cell, gridLeft + (c+1)*cell] 이다
	return {
		row: (screenY - gridTop) / cellHeight - 0.5,
		col: (screenX - gridLeft) / cellWidth - 0.5,
	};
}

/**
 * 트레이를 몇 줄 몇 칸으로 늘어놓을지 - **부품이 잘리지 않게 하는 계산**이다.
 *
 * ## 왜 한 줄로는 안 되는가
 *
 * 예전에는 슬롯을 한 줄로만 늘어놓고 "트레이 폭 / 슬롯 한 변" 으로 몇 개가 들어가는지
 * 셌다. 그런데 슬롯은 **트레이 높이를 꽉 채우는 정사각형**이라, 세로로 긴 화면에서는
 * 슬롯 하나가 화면 폭의 절반 가까이 된다. 실측(iPhone, 590x1280 읽기값, 비율 0.46)에서
 * 슬롯 한 변이 화면 폭의 44% 였고, 그래서 한 줄에 **하나밖에** 들어가지 않았다.
 *
 * 그런데도 계산은 `TRAY_MIN_VISIBLE_SLOTS`(3) 로 끌어올린 3 을 돌려주었다. 들어가지도
 * 않는 셋을 편 뒤 `overflow: hidden` 이 양옆을 잘라내서, 가운데 슬롯만 보이고 **정작
 * 부품이 든 첫 슬롯은 화면 밖으로 잘려 나갔다.** "크리스탈이 아예 안 보인다" 의 정체다.
 *
 * ## 대신 줄을 쌓는다
 *
 * 폭이 모자라면 슬롯을 줄여 억지로 밀어 넣는 대신 **여러 줄로 나눈다.** 줄이 늘면 슬롯
 * 한 변(= 트레이 높이 / 줄 수)이 작아지고, 그만큼 한 줄에 더 많이 들어간다. 그래서
 * 부품 수와 화면 비율에 따라 1x1 · 2x2 · 3x3 이 자연히 나온다.
 *
 * ## 고르는 규칙
 *
 * 열 수를 1 부터 훑으며 **슬롯이 가장 커지는 배치**를 고른다. 후보가 성립하려면 둘 다
 * 만족해야 한다.
 *
 *   줄 수 = ceil(부품 수 / 열 수) 가 `TRAY_MAX_ROWS` 이하   (너무 잘아지지 않게)
 *   열 수 x 슬롯 한 변 <= 트레이 폭                          (**가로로 넘치지 않게**)
 *
 * 두 번째 조건이 이 함수의 핵심이다 - 넘치는 배치는 애초에 후보가 되지 않으므로,
 * 잘려서 안 보이는 슬롯이 생길 수 없다.
 *
 * 부품이 너무 많아 어느 배치도 성립하지 않으면 그때만 페이지를 나눈다 (화살표로 넘긴다).
 */
export type PuzzleTrayGrid = {
	/** 줄 수 */
	rows: number,
	/** 한 줄에 놓는 칸 수 */
	cols: number,
	/** 한 페이지에 실제로 늘어놓는 슬롯 수 (부품 수를 넘지 않는다) */
	perPage: number,
	/** 슬롯 한 변이 화면에서 차지하는 비율 - 글자 크기가 여기서 나온다 */
	slot: PuzzleScreenFraction,
	/**
	 * 슬롯 한 변을 **트레이 높이 대비 %** 로 나타낸 값 - 패널이 그대로 스타일에 넣는다.
	 *
	 * 슬롯은 `height: 이 값 + aspectRatio: 1` 로 그려지므로, 이 한 값이 슬롯 크기를 통째로
	 * 정한다. 100/rows 가 아닌 이유는 **가로가 모자랄 때는 세로를 다 쓰지 않기** 때문이다
	 * (`trayGrid` 의 `min`).
	 */
	slotHeightPercent: number,
};

export function trayGrid(
	layout: PuzzleBoardRelativeLayout,
	screenAspect: number,
	slotCount: number,
): PuzzleTrayGrid {
	const aspect = clamp(screenAspect, 0.1, 10);
	const total = Math.max(0, Math.floor(slotCount));
	if (total <= 0) {
		return { rows: 0, cols: 0, perPage: 0, slot: { ofWidth: 0, ofHeight: 0 }, slotHeightPercent: 100 };
	}

	// **두 축을 같은 자로 잰다.** 트레이 세로를 화면 '가로' 단위로 옮겨 두면
	// 폭과 높이를 직접 견줄 수 있다 (화면 세로 1 = 화면 가로 1/aspect).
	const trayWidth = TRAY_WIDTH_USAGE;
	const trayHeight = auxAreaFraction(layout) * TRAY_HEIGHT_USAGE / aspect;

	const shown = Math.min(total, TRAY_MAX_VISIBLE_SLOTS);
	let best: PuzzleTrayGrid | undefined = undefined;
	for (let cols = 1; cols <= shown; cols++) {
		const rows = Math.ceil(shown / cols);
		if (rows > TRAY_MAX_ROWS) {
			continue;
		}
		// **두 제약을 한꺼번에 건다.** 세로로는 줄 수만큼 나눠 갖고, 가로로는 칸 수만큼
		// 나눠 갖는다. 둘 중 작은 쪽이 슬롯 크기이므로 어느 쪽으로도 넘치지 않는다.
		const side = Math.min(trayHeight / rows, trayWidth / cols);
		if (best !== undefined && side <= best.slot.ofWidth) {
			// 이미 더 큰 슬롯을 찾았다. 같은 크기면 줄이 적은 앞의 후보를 남긴다
			continue;
		}
		best = makeTrayGrid(rows, cols, shown, side, aspect, trayHeight);
	}
	if (best !== undefined) {
		return best;
	}

	// 부품이 너무 많아 `TRAY_MAX_ROWS` 로도 한 페이지에 담기지 않는다 -
	// 가장 잘게 쪼갠 뒤 나머지는 화살표로 넘긴다.
	const rows = TRAY_MAX_ROWS;
	const side = Math.min(trayHeight / rows, trayWidth);
	const cols = side > 0 ? Math.max(1, Math.floor(trayWidth / side)) : 1;
	return makeTrayGrid(rows, cols, Math.max(1, Math.min(total, rows * cols)), side, aspect, trayHeight);
}

/** 고른 배치를 `PuzzleTrayGrid` 로 - 높이 %는 트레이 높이 대비다 (`slotHeightPercent`) */
function makeTrayGrid(
	rows: number,
	cols: number,
	perPage: number,
	side: number,
	aspect: number,
	trayHeight: number,
): PuzzleTrayGrid {
	return {
		rows: rows,
		cols: cols,
		perPage: perPage,
		slot: { ofWidth: side, ofHeight: side * aspect },
		// 슬롯과 트레이를 같은 자(가로 단위)로 재고 있으므로 비율이 그대로 %가 된다
		slotHeightPercent: trayHeight > 0 ? clamp(100 * side / trayHeight, 1, 100) : 100,
	};
}

/**
 * 한 페이지에 늘어놓을 슬롯 수 - `trayGrid()` 가 정한 값 그대로다.
 * 페이지 계산만 필요한 곳에서 쓴다.
 */
export function traySlotsPerPage(
	layout: PuzzleBoardRelativeLayout,
	screenAspect: number,
	slotCount: number,
): number {
	return trayGrid(layout, screenAspect, slotCount).perPage;
}

/** 슬롯 수와 페이지 크기에서 전체 페이지 수 */
export function trayPageCount(slotCount: number, perPage: number): number {
	const total = Math.max(0, Math.floor(slotCount));
	const size = Math.max(1, Math.floor(perPage));
	return total <= 0 ? 0 : Math.ceil(total / size);
}
