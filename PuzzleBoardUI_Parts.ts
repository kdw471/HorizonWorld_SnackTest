/**
 * Puzzle Board UI Parts - 칸과 슬롯이 함께 쓰는 **표현 어휘**
 *
 * 보드 화면은 크게 넷으로 나뉜다.
 *
 *   `PuzzleBoardUI_Panel`  화면 틀·수명주기·프레젠터 연결 (조립하는 쪽)
 *   `PuzzleBoardUI_Grid`   본 격자
 *   `PuzzleBoardUI_Tray`   보조 레이아웃의 오브젝트 트레이
 *   `PuzzleBoardUI_Side`   보조 레이아웃의 정보 미니 격자
 *
 * 이 파일은 그 넷이 **공통으로 쓰는 것만** 담는다 - 색, 조작 강조 규칙, 그리고 칸·슬롯
 * 위에 겹쳐 놓는 층 다섯(그림·글자 판정·테두리·무늬·고리)이다. 격자와 트레이는 그리는
 * 대상이 다를 뿐 이 층들을 같은 규칙으로 쌓으므로, 여기 한 벌만 두고 둘이 나눠 쓴다.
 *
 * ## `BoardMetrics` - 픽셀 환산을 넘겨받는 창구
 *
 * 여기 있는 함수들은 `UIComponent` 의 메서드가 아니라서 `this.px()` 같은 환산기를 쓸 수
 * 없다. 그래서 패널이 자기 환산기를 `BoardMetrics` 한 덩어리로 묶어 넘긴다. **값이 아니라
 * 함수로 넘기는 이유**는 살아 있어야 하기 때문이다 - 배율은 `resolveLayout()` 이 정하고,
 * 글자 크기는 런타임에도 다시 계산된다(`Binding.derive` 안에서 불린다).
 */

import { Color } from 'horizon/core';
import { Bindable, Binding, Image, UINode, View } from 'horizon/ui';
import {
	BOARD_COLOR_DROP_INVALID,
	BOARD_COLOR_DROP_VALID,
	BOARD_COLOR_GLYPH_EDGE,
	BOARD_COLOR_GRABBED,
	BOARD_COLOR_HIGHLIGHT,
	BOARD_COLOR_PATH,
	BOARD_COLOR_TEXT,
	BOARD_GLYPH_EDGE_WIDTH,
	BoardGlyphEdges,
	EBoardCellAccent,
	EBoardCellGlyph,
	PuzzleBoardCellView,
	PuzzleBoardColor,
	PuzzleBoardItemView,
	PuzzleTextureKey,
	getGlyphBlockedEdges,
	getGlyphRotation,
} from 'PuzzleBoardUI_Definitions';
import { PuzzleBoardRelativeLayout, percentText } from 'PuzzleUI_RelativeLayout';
import { PuzzleTextureLibrary } from 'PuzzleBoardUI_TextureLibrary';

//#region Metrics (패널이 넘겨주는 환산기)

/**
 * 픽셀·좌표 환산과 확정된 배치를 렌더러에게 넘기는 묶음.
 *
 * 전부 **함수**다. 배율과 배치는 `PuzzleBoardUIPanel.resolveLayout()` 이 정하고,
 * 글자 크기는 런타임 파생 안에서도 불리므로 값을 복사해 두면 낡는다.
 */
export type BoardMetrics = {
	/** 기준 캔버스(세로 1180) 픽셀 -> 실제 캔버스 픽셀 (최소 1) */
	px(referencePixels: number): number,
	/** 화면 세로 대비 비율 -> 좌표 단위. 글자 크기의 기준이 여기서 나온다 */
	units(fractionOfScreenHeight: number): number,
	/** 강조 테두리 두께 환산 - 0(테두리 없음)은 0 그대로 둔다 */
	scaleBorderWidth(referenceWidth: number): number,
	/** 보조 레이아웃 높이 (좌표 단위) - 기준 크기가 아직 없을 때의 대체값 */
	auxHeightUnits(): number,
	/** `fitFontSize` 에 넘길 기준 캔버스 배율 */
	pixelScale(): number,
	/** 기기 규격이 정한 글자 배율 */
	fontScale(): number,
	/** 확정된 상대 배치 - 여백 %와 7:3 분할 */
	layout(): PuzzleBoardRelativeLayout,
	/** 화면 가로/세로 비율 */
	screenAspect(): number,
	/** 텍스처 등록 세대. 그림과 글자 판정이 여기서 같이 파생한다 */
	textureEpoch: Binding<number>,
	/** 그림을 칸 색(`fill`)으로 물들일지 - 패널 prop `tintTexturesWithFill` */
	tintTexturesWithFill(): boolean,
};

//#endregion

//#region Colours

export function toColor(color: PuzzleBoardColor): Color {
	return new Color(color.r, color.g, color.b);
}

export const COLOR_HIGHLIGHT = toColor(BOARD_COLOR_HIGHLIGHT);
export const COLOR_NO_BORDER = new Color(0, 0, 0);
export const COLOR_TEXT = toColor(BOARD_COLOR_TEXT);
export const COLOR_GRABBED = toColor(BOARD_COLOR_GRABBED);
export const COLOR_DROP_VALID = toColor(BOARD_COLOR_DROP_VALID);
export const COLOR_DROP_INVALID = toColor(BOARD_COLOR_DROP_INVALID);
export const COLOR_PATH = toColor(BOARD_COLOR_PATH);
/** 부품 무늬(막힌 변)의 테두리 색 */
export const COLOR_GLYPH_EDGE = toColor(BOARD_COLOR_GLYPH_EDGE);
/** 보조 레이아웃의 버튼 바탕 - 리셋 버튼과 트레이 화살표가 같이 쓴다 */
export const COLOR_RESET_BUTTON = new Color(0.32, 0.34, 0.42);

//#endregion

//#region Corner radii

/** 칸 얼굴의 모서리 둥글기 (px) - 테두리 오버레이가 같은 값을 써야 겹쳐 보인다 */
export const CELL_CORNER_RADIUS = 8;
/** 트레이 슬롯의 모서리 둥글기 (px) */
export const ITEM_CORNER_RADIUS = 10;

//#endregion

//#region Drag accent presentation

/**
 * 조작 강조(`EBoardCellAccent`)를 실제 픽셀로 옮기는 규칙.
 *
 * `Pressable` 은 콜백에 좌표를 주지 않으므로(`horizon/ui` 의 `Callback` 은 `Player` 하나만
 * 받는다) 조각이 손가락을 픽셀 단위로 따라다니게 만들 수는 없다. 대신 **칸 단위로 따라오는
 * 조각을 눈에 띄게** 만든다 - 집은 조각은 커지고 빛나며, 원래 있던 자리에는
 * 옅은 실루엣이 남는다. 그래서 손가락에 가려도 "내가 이것을 끌고 있다" 가 보인다 (PUZ_00 §8.5).
 * (그림자는 모바일 렌더 비용 때문에 쓰지 않는다 - `createGridCell()` 얼굴 주석)
 */

/** 강조된 칸의 테두리 두께 (px) */
const HIGHLIGHT_BORDER_WIDTH = 3;
/** 집은 조각이 떠오르는 정도 - 1.1 이면 10% 커진다 */
const GRABBED_SCALE = 1.1;
/** 원래 자리에 남는 실루엣의 크기 - 살짝 작게 그려 "빠져나갔다" 가 보이게 한다 */
const GHOST_SCALE = 0.86;
/** 실루엣의 불투명도 */
const GHOST_OPACITY = 0.3;
/** 놓을 자리 표시의 테두리 두께 (px) */
const DROP_BORDER_WIDTH = 4;
/** 집은 조각의 테두리 두께 (px) */
const GRABBED_BORDER_WIDTH = 5;
/** 숨긴 칸의 불투명도 - 0 이면 자리는 차지하되 보이지 않는다 (격자 모양이 유지된다) */
const HIDDEN_CELL_OPACITY = 0;

/**
 * 고리가 칸 밖으로 번지는 양 (px).
 *
 * 고리는 `Pressable` 기준으로 놓이는데, 칸 사이 간격이 `padding` 으로 들어오면서
 * 그 기준 상자가 얼굴보다 간격만큼 커졌다. 그만큼 값을 줄여 고리가 얼굴에 붙어 보이게 한다.
 */
const GRAB_RING_SPREAD_PERCENT = 2;
/** 고리의 고정 진하기 - 애니메이션을 걸지 않는 이유는 `createGrabRing()` 주석 참고 */
const GRAB_RING_OPACITY = 0.8;

/** 아무 자리도 짚고 있지 않을 때의 슬롯 번호 */
export const NO_PRESSED_SLOT = -1;

/**
 * 퍼즐이 칸에 준 강조와 "지금 짚고 있다" 를 합친다.
 *
 * 퍼즐이 준 것이 언제나 이긴다. 러시아워에서 집어 든 오브젝트(`GRABBED`)나 실루엣(`GHOST`)이
 * 단순한 누름 표시에 덮이면, 정작 보여야 할 조작이 가려지기 때문이다. 퍼즐이 아무것도 주지
 * 않은 칸만 눌린 티가 난다 - 탭으로 푸는 퍼즐(카드 맞추기·슬라이드 등)이 여기 해당한다.
 */
export function mergePressAccent(accent: EBoardCellAccent, isPressed: boolean): EBoardCellAccent {
	if (accent !== EBoardCellAccent.NONE) {
		return accent;
	}
	return isPressed ? EBoardCellAccent.GRABBED : EBoardCellAccent.NONE;
}

export function getAccentScale(accent: EBoardCellAccent): number {
	if (accent === EBoardCellAccent.GRABBED) {
		return GRABBED_SCALE;
	}
	if (accent === EBoardCellAccent.GHOST) {
		return GHOST_SCALE;
	}
	return 1;
}

/** 조작 강조가 있으면 그것이 테두리를 차지하고, 없을 때만 퍼즐 상태(`isHighlighted`)가 쓴다 */
export function getAccentBorderWidth(accent: EBoardCellAccent, isHighlighted: boolean): number {
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

export function getAccentBorderColor(accent: EBoardCellAccent, isHighlighted: boolean): Color {
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

/** 보이지 않는 칸은 0, 실루엣은 옅게, 나머지는 그대로 */
export function getAccentOpacity(isVisible: boolean, accent: EBoardCellAccent): number {
	if (isVisible === false) {
		return HIDDEN_CELL_OPACITY;
	}
	return accent === EBoardCellAccent.GHOST ? GHOST_OPACITY : 1;
}

//#endregion

//#region Slot helpers

/**
 * 자리(슬롯)마다 하나씩 `Binding` 을 만들어 둔다.
 *
 * `DynamicList` 의 `renderItem` 은 자리 번호만 받으므로, 그 자리의 내용은 여기서 만든
 * `Binding` 이 나른다. 목록의 길이가 바뀌어도 이 배열은 그대로다 - 그래야 칸 하나가
 * 바뀔 때 목록 전체를 다시 그리지 않고 그 칸의 `Binding` 만 갱신할 수 있다.
 */
export function createSlotBindings<T>(count: number, createValue: () => T): Binding<T>[] {
	const bindings: Binding<T>[] = [];
	for (let index = 0; index < count; index++) {
		bindings.push(new Binding<T>(createValue()));
	}
	return bindings;
}

/** `DynamicList` 에 넘길 자리 번호 목록 - `[0, 1, ... count-1]` */
export function indexRange(count: number): number[] {
	const indices: number[] = [];
	for (let index = 0; index < count; index++) {
		indices.push(index);
	}
	return indices;
}

//#endregion

//#region Overlays (칸·슬롯 위에 겹쳐 놓는 층들)

/**
 * 칸·슬롯의 글자를 그릴지 - **글자가 있고, 그 자리에 그림이 없을 때만** 그린다.
 *
 * 글자(`L`·`T`·`E`·`R` ...)는 그림이 없을 때 종류를 알리는 대체 표시다. 그림을 끼운
 * 오브젝트 위에 글자까지 얹으면 그림을 가려 무엇인지 오히려 알아보기 어렵다 - 그래서
 * 그림이 등록된 요소는 글자를 생략한다. 방향은 글자 대신 **그림 자체가 돌아가서**
 * 알린다 (`createTextureLayer()`).
 *
 * 텍스처 세대에서 같이 파생하는 이유는 그림 자체와 같다 - CoreAPI 가 패널보다 늦게
 * 에셋을 등록해도 그때 글자가 물러난다.
 *
 * **반환 타입을 `Bindable<boolean>` 으로 못박는다.** `derive()` 가 돌려주는
 * `DerivedBinding` 은 `horizon/ui` 가 내보내지 않는 타입이라, 추론에 맡기면 에디터가
 * 선언 파일(`.d.ts`)을 만들 때 그 이름을 적지 못해 컴파일이 깨진다
 * (`TS4058: ... has or is using name 'DerivedBinding' ... but cannot be named`).
 * 로컬 `tsc --noEmit` 은 선언을 만들지 않으므로 이 오류를 잡지 못한다 -
 * `가이드/타입체크와_테스트_실행.md` §2.1 참고.
 */
export function createLabelVisibility<T>(
	metrics: BoardMetrics,
	binding: Binding<T>,
	getLabel: (view: T) => string,
	getTexture: (view: T) => PuzzleTextureKey,
): Bindable<boolean> {
	const library = PuzzleTextureLibrary.instance;
	return Binding.derive(
		[binding, metrics.textureEpoch],
		(view: T, _epoch: number) =>
			getLabel(view) !== '' && library.resolve(getTexture(view)) === null,
	);
}

/**
 * 칸·슬롯 얼굴 위에 까는 그림 한 장.
 *
 * 색(`fill`) 위에 덮이므로, 그림이 없는 요소는 예전과 똑같이 색으로만 그려진다.
 *
 * ## 색 입히기 (틴트)
 *
 * 그림은 `tint` 색으로 물든다(`multiply`). 기본값이 흰색이라 아무것도 하지 않으면
 * 원본 그대로이고, 색을 준 칸만 물든다 - 레이저의 빨강 수신체처럼 **그림 한 장으로
 * 색깔별 오브젝트를 그리는** 방식이다 (`PuzzleBoardCellView.tint`).
 *
 * 예전부터 있던 `tintTexturesWithFill` prop 을 켜면 대신 칸의 `fill` 로 물든다 -
 * 회색조 그림 한 장으로 눌림/안 눌림 같은 *상태*를 그리던 퍼즐을 위한 것이라 그대로 뒀다.
 *
 * ## 방향 (회전)
 *
 * 방향이 있는 부품(`glyph`)은 **그림 자체를 돌려 그린다.** 삼각형 크리스탈은 직각
 * 코너가, T자는 막힌 변이 어디냐에 따라 동작이 다른데, 그림이 한 방향으로만 그려져 있으면
 * 네 방향이 화면에서 똑같아 보인다. 회전 각도는 글자를 돌리던 것과 같은 규칙을 쓴다
 * (`getGlyphRotation`) - 그림의 **기준 모양**이 `L`(직각이 좌하단), `T`(막힌 변이 위)와
 * 같은 방향으로 그려져 있어야 네 방향이 맞아떨어진다.
 *
 * **`source` 가 칸 스냅샷과 텍스처 세대 둘 다에서 파생하는 이유**는 등록 순서 때문이다.
 * CoreAPI 가 이 패널보다 늦게 에셋을 넣어도 세대가 오르면 다시 계산된다.
 */
export function createTextureLayer<T extends { glyph: EBoardCellGlyph }>(
	metrics: BoardMetrics,
	binding: Binding<T>,
	getTexture: (view: T) => PuzzleTextureKey,
	getFill: (view: T) => PuzzleBoardColor,
	getTint: (view: T) => PuzzleBoardColor,
	cornerRadius: number,
): UINode {
	const library = PuzzleTextureLibrary.instance;
	// `DerivedBinding` 에서 다시 파생할 수는 없으므로 원본에서 두 번 파생한다
	const source = Binding.derive(
		[binding, metrics.textureEpoch],
		(view: T, _epoch: number) => library.resolve(getTexture(view)),
	);
	const hasTexture = Binding.derive(
		[binding, metrics.textureEpoch],
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
			borderRadius: metrics.px(cornerRadius),
			// 판이 정사각형이 아닌 퍼즐에서도 칸이 늘어나 보이지 않도록 잘라 채운다
			resizeMode: 'cover',
			tintColor: metrics.tintTexturesWithFill()
				? binding.derive((view) => toColor(getFill(view)))
				: binding.derive((view) => toColor(getTint(view))),
			tintOperation: 'multiply',
			// 방향이 있는 부품은 그림째 돌아간다 - 방향 없는 칸은 0도라 그대로다
			transform: [{ rotate: binding.derive((view) => getGlyphRotation(view.glyph)) }],
		},
	}));
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
export function createBorderOverlay(
	metrics: BoardMetrics,
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
			borderRadius: metrics.px(cornerRadius),
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
export function createGlyphFrame(
	metrics: BoardMetrics,
	binding: Binding<PuzzleBoardCellView> | Binding<PuzzleBoardItemView>,
	scale: Bindable<number>,
	cornerRadius: number,
	inset: string,
): UINode {
	// 무늬 테두리 두께도 기준 캔버스 픽셀이라 좌표 단위로 환산한다
	const edge = (pick: (edges: BoardGlyphEdges) => boolean) =>
		binding.derive((view: { glyph: EBoardCellGlyph }) =>
			(pick(getGlyphBlockedEdges(view.glyph)) ? metrics.px(BOARD_GLYPH_EDGE_WIDTH) : 0));

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
			borderRadius: metrics.px(cornerRadius),
			borderTopWidth: edge((edges) => edges.top),
			borderBottomWidth: edge((edges) => edges.bottom),
			borderLeftWidth: edge((edges) => edges.left),
			borderRightWidth: edge((edges) => edges.right),
			borderColor: COLOR_GLYPH_EDGE,
			transform: [{ scale: scale }],
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
export function createGrabRing(
	metrics: BoardMetrics,
	display: Bindable<'none' | 'flex'>,
	insetPercent: number,
): UINode {
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
			borderRadius: metrics.px(12),
			borderWidth: metrics.px(2),
			borderColor: COLOR_GRABBED,
			display: display,
			opacity: GRAB_RING_OPACITY,
		},
	});
}

//#endregion
