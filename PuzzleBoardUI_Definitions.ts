/**
 * Puzzle Board UI Definitions - CustomUI 로 그리는 퍼즐 보드의 어휘
 *
 * 8개 퍼즐의 보드는 전부 2D 격자다. 그래서 키 캡·타일 같은 **3D 오브젝트를 두지 않고
 * Custom UI 패널에 격자를 직접 그린다** (`Documents/생성 문서/설계/2026-09-02_멀티플레이_플랫폼에서_싱글플레이_구현_방안.md` §3.2 B안).
 *
 * 이 파일은 그 격자의 **표현 스냅샷 타입**만 정의한다. `horizon/core` 와 `horizon/ui` 에
 * 런타임 의존이 없어 Node 테스트로 검증된다 (PUZ_00 §7.1).
 *
 * ## 왜 Color 가 아니라 {r,g,b} 인가
 *
 * `horizon/core` 의 `Color` 를 여기서 쓰면 순수 계층이 깨진다. 색은 0~1 실수 셋으로만
 * 들고 다니고, 실제 `Color` 변환은 표현 계층(`PuzzleBoardUI_Panel`)에서 한 번만 한다.
 *
 * ## 화면 구성 (worker/NextJob.md 1번)
 *
 *   화면 위쪽  본 격자 - **정사각형 비율** 고정
 *   화면 아래쪽 보조 레이아웃 - 셋을 담는다
 *              (1) 오브젝트 트레이(`items`)  퍼즐을 푸는 데 쓰는 오브젝트 (레이저의 크리스탈 등)
 *              (2) 정보 미니 격자(`side`)    푸는 데 필요한 정보 (스위치의 동시 눌림 영역 등)
 *              (3) 리셋 버튼                 판을 풀기 전 상태로 되돌린다 (남은 시간은 유지)
 *
 * 레벨 시작 직후에는 보조 레이아웃 자리에 `GameStart`(`PuzzleBoardIntroView`)가 잠깐 떴다가
 * 사라지고, **사라진 뒤에** 보조 레이아웃이 나타난다.
 *
 * ## 텍스처는 "키" 로만 들고 다닌다
 *
 * 칸·슬롯·판 배경에 그림을 입힐 수 있다(`texture`). 다만 여기 들어가는 값은
 * **논리적인 이름**(`'switch.pressed'` 같은 문자열)이지 `TextureAsset` 이 아니다.
 * 실제 에셋은 각 퍼즐의 `*_CoreAPI` 가 에디터 prop 으로 받아
 * `PuzzleBoardUI_TextureLibrary` 에 등록하고, 그림으로 바꾸는 일은 표현 계층
 * (`PuzzleBoardUI_Panel`)이 한 번만 한다.
 *
 * 색을 `{r,g,b}` 로 들고 다니는 것과 같은 이유다 - 순수 계층이 `horizon/*` 를 건드리는
 * 순간 Node 테스트가 돌지 않는다. 텍스처를 지정하지 않았거나(`''`) 에셋이 아직 등록되지
 * 않은 키는 예전처럼 `fill` 색만 칠한다. **그래서 텍스처는 언제나 선택 사항이다.**
 *
 * ## 격자 최대 크기
 *
 * Custom UI 트리는 `initializeUI()` 에서 **한 번만** 만들어지므로, 패널은 여기 정의된
 * 최대 크기만큼 셀을 미리 만들어 두고 실제 격자 밖의 셀은 `display: none` 으로 숨긴다.
 * 8개 퍼즐 중 가장 큰 판이 러시아워의 9×9(`RUSH_HOUR_FULL_GRID_SIZE`)라 9 로 잡는다.
 */

//#region Sizes

/** 패널이 미리 만들어 두는 격자 행 수 상한 - 러시아워 9×9 가 가장 크다 */
export const PUZZLE_BOARD_MAX_ROWS = 9;
/** 패널이 미리 만들어 두는 격자 열 수 상한 */
export const PUZZLE_BOARD_MAX_COLS = 9;
export const PUZZLE_BOARD_MAX_CELLS = PUZZLE_BOARD_MAX_ROWS * PUZZLE_BOARD_MAX_COLS;

/** 보조 격자(스위치의 3×3 영역 미니 UI 등) 상한 - PUZ_08 §9.5 */
export const PUZZLE_BOARD_SIDE_MAX_ROWS = 3;
export const PUZZLE_BOARD_SIDE_MAX_COLS = 3;
export const PUZZLE_BOARD_SIDE_MAX_CELLS = PUZZLE_BOARD_SIDE_MAX_ROWS * PUZZLE_BOARD_SIDE_MAX_COLS;

/**
 * 보조 레이아웃의 오브젝트 슬롯 상한.
 * 8개 중 트레이를 가장 많이 쓰는 레이저의 인벤토리가 최대 5칸이라 8이면 넉넉하다 (PUZ_01 §3.2).
 */
export const PUZZLE_BOARD_MAX_ITEMS = 8;

/** 보드 밖을 가리키는 셀 번호. 드래그가 판을 벗어났을 때 이 값이 온다 (PUZ_00 §8.4) */
export const PUZZLE_BOARD_CELL_OUTSIDE = -1;

/** 레벨 시작 배너 문구. 화면에 그대로 나가므로 영어다 */
export const PUZZLE_BOARD_INTRO_TEXT = 'GameStart';

/** 리셋 버튼 라벨 */
export const PUZZLE_BOARD_RESET_LABEL = 'Reset';

/**
 * 일시정지 버튼 라벨.
 *
 * 허브의 상단 바에도 같은 기능의 `Pause` 가 있지만, 인게임에서는 보드 패널이 그 위를
 * 덮어 손이 닿지 않는다 (`PuzzleBoardUI_Panel.createMenuButton()`). 그래서 보드 쪽에도
 * 하나 두고, 그것을 눌러도 뜨는 화면이 시스템 메뉴라는 뜻으로 `Menu` 라 부른다.
 */
export const PUZZLE_BOARD_MENU_LABEL = 'Menu';

//#endregion

//#region Color

/** 0~1 범위의 RGB. `horizon/core` 의 Color 로는 표현 계층에서만 바꾼다 */
export type PuzzleBoardColor = {
	r: number,
	g: number,
	b: number,
}

export function boardColor(r: number, g: number, b: number): PuzzleBoardColor {
	return { r: r, g: g, b: b };
}

/** 칸이 비어 있을 때(오브젝트가 없는 좌표)의 바탕색 */
export const BOARD_COLOR_EMPTY = boardColor(0.12, 0.13, 0.18);
/** 격자 배경 */
export const BOARD_COLOR_BACKGROUND = boardColor(0.08, 0.09, 0.13);
export const BOARD_COLOR_TEXT = boardColor(1, 1, 1);
/** 선택·드래그 중인 칸의 테두리 */
export const BOARD_COLOR_HIGHLIGHT = boardColor(0.95, 0.8, 0.25);

/**
 * 텍스처를 물들이지 않는 값 - 흰색이다.
 *
 * 그림은 `multiply` 로 물드므로 흰색을 곱하면 원본 그대로다. 그래서 이 값이 곧
 * "틴트 없음" 이고, 틴트를 쓰지 않는 퍼즐은 예전과 똑같이 그려진다 (`PuzzleBoardCellView.tint`).
 */
export const BOARD_COLOR_NO_TINT = boardColor(1, 1, 1);

//#endregion

//#region Texture

/**
 * 칸·슬롯에 입힐 그림의 **논리적인 이름**.
 *
 * 퍼즐마다 자기 요소의 키를 정한다 (`'laser.crystal'`, `'switch.pressed'` ...).
 * 충돌을 피하려고 `퍼즐.요소` 꼴로 적되, 규칙을 강제하지는 않는다 -
 * 등록되지 않은 키는 조용히 무시되므로 잘못 적어도 색으로 그려질 뿐 깨지지 않는다.
 */
export type PuzzleTextureKey = string;

/** 텍스처 없음. `fill` 색만 칠한다 */
export const NO_TEXTURE: PuzzleTextureKey = '';

/**
 * 텍스처 키를 만든다. 빈 조각이 섞이면 `NO_TEXTURE` 를 돌려준다 -
 * 에디터에서 에셋을 비워 둔 요소를 실수로 등록하지 않기 위해서다.
 */
export function textureKey(puzzleId: string, element: string): PuzzleTextureKey {
	if (puzzleId === '' || element === '') {
		return NO_TEXTURE;
	}
	return `${puzzleId}.${element}`;
}

//#endregion

//#region Drag accent (조작이 눈에 보이게 하는 강조)

/**
 * 칸이 지금 **조작의 어느 단계에 있는지**.
 *
 * `isHighlighted` 와는 다른 축이다. `isHighlighted` 는 퍼즐의 *상태*를 알린다
 * (레이저의 켜진 수신체, 카드의 뒤집힌 패, 정렬의 완성된 케이스). 반면 이 값은
 * **지금 손가락이 무엇을 하고 있는지**를 알린다. 둘은 같은 칸에 동시에 붙을 수 있다.
 *
 * ## 왜 필요한가
 *
 * Custom UI 의 `Pressable` 은 콜백에 **좌표를 주지 않는다** - 어느 칸에 들어왔는지만
 * 알 수 있다. 그래서 손가락을 픽셀 단위로 따라다니는 실루엣은 만들 수 없고, 대신
 * **칸 단위로 조각이 손가락을 따라오게** 한다. 그것만으로는 "내가 지금 이걸 끌고 있다"가
 * 잘 보이지 않으므로, 끌고 있는 조각은 떠오르게(`GRABBED`) 하고 원래 자리에는
 * 실루엣(`GHOST`)을 남긴다. 실제 연출은 표현 계층(`PuzzleBoardUI_Panel`)이 정한다.
 */
export enum EBoardCellAccent {
	/** 조작과 무관한 평범한 칸 */
	NONE = 'NONE',
	/** 지금 손가락에 붙어 따라오는 조각 - 떠오르고 빛난다 */
	GRABBED = 'GRABBED',
	/** 집어 든 조각이 원래 있던 자리 - 실루엣만 옅게 남는다 */
	GHOST = 'GHOST',
	/** 지금 놓으면 여기 들어간다 */
	DROP_VALID = 'DROP_VALID',
	/** 여기에는 놓을 수 없다 */
	DROP_INVALID = 'DROP_INVALID',
	/** 조각이 지나갈 수 있는 길 - 러시아워의 이동 가능 구간 등 */
	PATH = 'PATH',
}

/** 집어 든 조각의 테두리·광채 */
export const BOARD_COLOR_GRABBED = boardColor(1, 0.95, 0.6);
/** 놓을 수 있는 자리 */
export const BOARD_COLOR_DROP_VALID = boardColor(0.35, 0.9, 0.5);
/** 놓을 수 없는 자리 */
export const BOARD_COLOR_DROP_INVALID = boardColor(0.95, 0.35, 0.35);
/** 지나갈 수 있는 길 */
export const BOARD_COLOR_PATH = boardColor(0.55, 0.7, 0.95);

//#endregion

//#region Glyph (칸에 그리는 방향성 있는 "부품 무늬")

/**
 * 칸 위에 그리는 **부품 무늬**. 색과 글자만으로는 구분되지 않는 *방향*을 알린다.
 *
 * ## 왜 필요한가
 *
 * 레이저 퍼즐의 크리스탈은 같은 종류라도 방향에 따라 전혀 다르게 동작한다.
 * 직각 삼각형은 직각 코너가 어디냐에 따라 **어느 두 변이 광선을 되돌리는지**가 갈리고,
 * T자는 **어느 한 변이 막혀 있는지**가 갈린다. 그런데 예전에는 삼각형을 전부
 * 빗금 두 종류로만 그려서, 좌하단 직각과 우상단 직각이 화면에서 똑같아 보였다.
 * "어떤 게 아래만 반사되고 어떤 게 위만 반사되는지 알 수 없다" 는 신고가 그것이다.
 *
 * ## 어떻게 그리는가
 *
 * 이미지 애셋을 쓰지 않고 **칸 자체를 무늬로 만든다.** 표현 계층이 두 가지를 한다.
 *   1. 광선을 되돌리는(막힌) 변에 **두꺼운 테두리**를 그린다 - `getGlyphBlockedEdges()`
 *   2. 칸의 글자를 **돌려서** 그린다 - `getGlyphRotationDegrees()`
 *      `L` 은 두 평면이 만나는 직각을, `T` 는 막힌 변을 그대로 본뜬 모양이라
 *      돌리기만 하면 네 방향이 전부 다르게 보인다.
 *
 * 덕분에 노드를 크게 늘리지 않고(칸당 무늬 판 하나) 방향이 한눈에 들어온다.
 */
export enum EBoardCellGlyph {
	/** 방향이 없는 평범한 칸 */
	NONE = 'NONE',
	/** 직각 삼각형 거울 - 이름은 **직각 코너**(두 평면이 만나는 곳)의 위치다 */
	CORNER_TOP_LEFT = 'CORNER_TOP_LEFT',
	CORNER_TOP_RIGHT = 'CORNER_TOP_RIGHT',
	CORNER_BOTTOM_LEFT = 'CORNER_BOTTOM_LEFT',
	CORNER_BOTTOM_RIGHT = 'CORNER_BOTTOM_RIGHT',
	/** T자 - 이름은 **막힌 변**의 위치다. 나머지 세 방향으로 뻗는다 */
	BLOCKED_UP = 'BLOCKED_UP',
	BLOCKED_DOWN = 'BLOCKED_DOWN',
	BLOCKED_LEFT = 'BLOCKED_LEFT',
	BLOCKED_RIGHT = 'BLOCKED_RIGHT',
}

/** 무늬 테두리(막힌 변)의 색 - 칸 색이 무엇이든 눈에 남도록 밝게 둔다 */
export const BOARD_COLOR_GLYPH_EDGE = boardColor(0.98, 0.92, 0.55);

/** 무늬 테두리 한 변의 두께 (px). 표현 계층이 그대로 쓴다 */
export const BOARD_GLYPH_EDGE_WIDTH = 5;

/** 광선을 되돌리는(막힌) 변들. 표현 계층은 이 변에만 두꺼운 테두리를 그린다 */
export type BoardGlyphEdges = {
	top: boolean,
	bottom: boolean,
	left: boolean,
	right: boolean,
}

export function getGlyphBlockedEdges(glyph: EBoardCellGlyph): BoardGlyphEdges {
	switch (glyph) {
		// 직각 삼각형: 직각 코너에 붙은 두 변이 평면이다 (광선이 되돌아간다)
		case EBoardCellGlyph.CORNER_TOP_LEFT: return { top: true, bottom: false, left: true, right: false };
		case EBoardCellGlyph.CORNER_TOP_RIGHT: return { top: true, bottom: false, left: false, right: true };
		case EBoardCellGlyph.CORNER_BOTTOM_LEFT: return { top: false, bottom: true, left: true, right: false };
		case EBoardCellGlyph.CORNER_BOTTOM_RIGHT: return { top: false, bottom: true, left: false, right: true };
		// T자: 막힌 변 하나
		case EBoardCellGlyph.BLOCKED_UP: return { top: true, bottom: false, left: false, right: false };
		case EBoardCellGlyph.BLOCKED_DOWN: return { top: false, bottom: true, left: false, right: false };
		case EBoardCellGlyph.BLOCKED_LEFT: return { top: false, bottom: false, left: true, right: false };
		case EBoardCellGlyph.BLOCKED_RIGHT: return { top: false, bottom: false, left: false, right: true };
		default: return { top: false, bottom: false, left: false, right: false };
	}
}

/**
 * 칸의 글자를 몇 도 돌려 그릴지.
 *
 * 기준 모양은 글자 자신이다.
 *   `L` 은 왼쪽 변 + 아래쪽 변  -> 직각이 좌하단 (0도)
 *   `T` 는 위쪽 변이 막히고 아래/좌/우로 뻗는다 -> 막힌 변이 위 (0도)
 * 시계 방향으로 90도씩 돌리면 네 방향이 모두 나온다.
 */
export function getGlyphRotationDegrees(glyph: EBoardCellGlyph): number {
	switch (glyph) {
		case EBoardCellGlyph.CORNER_BOTTOM_LEFT: return 0;
		case EBoardCellGlyph.CORNER_TOP_LEFT: return 90;
		case EBoardCellGlyph.CORNER_TOP_RIGHT: return 180;
		case EBoardCellGlyph.CORNER_BOTTOM_RIGHT: return 270;
		case EBoardCellGlyph.BLOCKED_UP: return 0;
		case EBoardCellGlyph.BLOCKED_RIGHT: return 90;
		case EBoardCellGlyph.BLOCKED_DOWN: return 180;
		case EBoardCellGlyph.BLOCKED_LEFT: return 270;
		default: return 0;
	}
}

/** 표현 계층이 그대로 스타일에 넣는 문자열 (예: `"90deg"`) */
export function getGlyphRotation(glyph: EBoardCellGlyph): string {
	return `${getGlyphRotationDegrees(glyph)}deg`;
}

//#endregion

//#region Cell

/**
 * 칸 하나의 표현 스냅샷.
 *
 * 퍼즐 로직은 이 타입을 모른다. 각 `*_CoreAPI` 가 세션 이벤트를 받아 이 모양으로 번역한다.
 */
export type PuzzleBoardCellView = {
	/** false 면 칸 자체를 그리지 않는다 (스위치의 FREE 좌표 - PUZ_08 §4) */
	isVisible: boolean,
	/**
	 * false 면 이 칸에서 **누름을 시작할 수 없다** (인터랙션 규격 - 정적 오브젝트/배경).
	 *
	 * 정적인 칸은 눌러도 누름 표시·세션 호출이 아예 일어나지 않는다. 단, 이미 시작된
	 * 드래그가 이 칸 **위를 지나가는 것**은 막지 않는다 - 빈 칸 위로 조각을 끌고 가는
	 * 것이 드래그 퍼즐의 기본 동작이기 때문이다 (프레젠터의 hover 는 isVisible 만 본다).
	 * 기본값은 true - 정적으로 둘 칸만 각 CoreAPI 가 명시적으로 끈다.
	 */
	isInteractive: boolean,
	fill: PuzzleBoardColor,
	/** 칸에 입힐 텍스처 키. `NO_TEXTURE` 면 색만 칠한다 */
	texture: PuzzleTextureKey,
	/**
	 * 텍스처를 물들일 색 (`multiply`). 기본값 `BOARD_COLOR_NO_TINT`(흰색)는 원본 그대로다.
	 *
	 * **`fill` 과 따로 두는 이유**는 둘이 서로 다른 일을 하기 때문이다. `fill` 은 그림이
	 * 없을 때의 바탕색이라 바탕(테두리·배치 영역)처럼 어두운 값이 들어간다. 그 어두운 색을
	 * 그대로 그림에 곱하면 그림이 새까매진다. 반면 틴트는 **그림에 입히고 싶은 색**이다 -
	 * 레이저의 빨강 수신체 그림 한 장이 색깔별 수신체가 되는 식이다. 그래서 색을 입히고
	 * 싶은 칸만 각 퍼즐이 골라서 준다.
	 */
	tint: PuzzleBoardColor,
	/** 칸 위 글자. 빈 문자열이면 그리지 않는다 */
	label: string,
	labelColor: PuzzleBoardColor,
	/** 테두리 강조 (선택된 말, 드래그 중인 경로) */
	isHighlighted: boolean,
	/** 지금 이 칸이 조작의 어느 단계에 있는지 - `isHighlighted` 와 겹쳐 붙을 수 있다 */
	accent: EBoardCellAccent,
	/** 방향이 있는 부품 무늬 (레이저 크리스탈 등). 없으면 `NONE` */
	glyph: EBoardCellGlyph,
}

export function createCellView(): PuzzleBoardCellView {
	return {
		isVisible: false,
		isInteractive: true,
		fill: BOARD_COLOR_EMPTY,
		texture: NO_TEXTURE,
		tint: BOARD_COLOR_NO_TINT,
		label: '',
		labelColor: BOARD_COLOR_TEXT,
		isHighlighted: false,
		accent: EBoardCellAccent.NONE,
		glyph: EBoardCellGlyph.NONE,
	};
}

/** 칸 갱신 시 넘기는 부분 패치. 지정하지 않은 필드는 그대로 둔다 */
export type PuzzleBoardCellPatch = {
	isVisible?: boolean,
	isInteractive?: boolean,
	fill?: PuzzleBoardColor,
	texture?: PuzzleTextureKey,
	tint?: PuzzleBoardColor,
	label?: string,
	labelColor?: PuzzleBoardColor,
	isHighlighted?: boolean,
	accent?: EBoardCellAccent,
	glyph?: EBoardCellGlyph,
}

/** 패치를 적용한 새 스냅샷. 바뀐 것이 없으면 `undefined` 를 돌려준다 (불필요한 재렌더 방지) */
export function applyCellPatch(cell: PuzzleBoardCellView, patch: PuzzleBoardCellPatch): PuzzleBoardCellView | undefined {
	// 드래그 중 판 전체를 되칠하는 경로에서는 호출 대부분이 "이미 같은 값" 이다.
	// 그 경우 스냅샷 객체를 만들지 않고 바로 빠져나가, 매 이동마다 수십 개씩 생기던
	// 임시 객체(GC 압박)를 없앤다.
	if ((patch.isVisible === undefined || patch.isVisible === cell.isVisible)
		&& (patch.isInteractive === undefined || patch.isInteractive === cell.isInteractive)
		&& (patch.fill === undefined || isSameColor(patch.fill, cell.fill))
		&& (patch.texture === undefined || patch.texture === cell.texture)
		&& (patch.tint === undefined || isSameColor(patch.tint, cell.tint))
		&& (patch.label === undefined || patch.label === cell.label)
		&& (patch.labelColor === undefined || isSameColor(patch.labelColor, cell.labelColor))
		&& (patch.isHighlighted === undefined || patch.isHighlighted === cell.isHighlighted)
		&& (patch.accent === undefined || patch.accent === cell.accent)
		&& (patch.glyph === undefined || patch.glyph === cell.glyph)) {
		return undefined;
	}
	return {
		isVisible: patch.isVisible ?? cell.isVisible,
		isInteractive: patch.isInteractive ?? cell.isInteractive,
		fill: patch.fill ?? cell.fill,
		texture: patch.texture ?? cell.texture,
		tint: patch.tint ?? cell.tint,
		label: patch.label ?? cell.label,
		labelColor: patch.labelColor ?? cell.labelColor,
		isHighlighted: patch.isHighlighted ?? cell.isHighlighted,
		accent: patch.accent ?? cell.accent,
		glyph: patch.glyph ?? cell.glyph,
	};
}

export function isSameColor(left: PuzzleBoardColor, right: PuzzleBoardColor): boolean {
	return left.r === right.r && left.g === right.g && left.b === right.b;
}

export function isSameCellView(left: PuzzleBoardCellView, right: PuzzleBoardCellView): boolean {
	return left.isVisible === right.isVisible
		&& left.isInteractive === right.isInteractive
		&& left.texture === right.texture
		&& left.label === right.label
		&& left.isHighlighted === right.isHighlighted
		&& left.accent === right.accent
		&& left.glyph === right.glyph
		&& isSameColor(left.fill, right.fill)
		&& isSameColor(left.tint, right.tint)
		&& isSameColor(left.labelColor, right.labelColor);
}

//#endregion

//#region Item (보조 레이아웃의 오브젝트 트레이)

/**
 * 보조 레이아웃에 놓이는 오브젝트 슬롯 하나.
 *
 * 칸(`PuzzleBoardCellView`)과 거의 같지만 **누를 수 있고 개수 자막이 붙는다**.
 * 레이저의 미배치 크리스탈처럼 "판 밖에 있고 판으로 끌어다 놓는" 오브젝트가 여기 들어간다.
 * 예전에는 이런 오브젝트를 본 격자의 여분 열에 그렸는데, 보조 레이아웃이 입력을 받게 되면서
 * 본 격자는 순수하게 판만 담게 됐다.
 */
export type PuzzleBoardItemView = {
	/** false 면 슬롯 자체를 그리지 않는다 (다 쓴 슬롯) */
	isVisible: boolean,
	fill: PuzzleBoardColor,
	/** 슬롯에 입힐 텍스처 키. `NO_TEXTURE` 면 색만 칠한다 */
	texture: PuzzleTextureKey,
	/** 그림을 물들일 색. 기본값 `BOARD_COLOR_NO_TINT`(흰색)는 원본 그대로다 (칸과 같은 규칙) */
	tint: PuzzleBoardColor,
	label: string,
	labelColor: PuzzleBoardColor,
	/** 슬롯 아래 작은 글씨 (남은 개수 등). 빈 문자열이면 그리지 않는다 */
	caption: string,
	/** 지금 집어 든 / 고른 슬롯 */
	isHighlighted: boolean,
	/**
	 * 슬롯이 조작의 어느 단계에 있는지.
	 * 트레이에서 집어 판으로 끌고 가는 동안 원래 슬롯은 `GHOST` 가 되어 빈자리처럼 보인다.
	 */
	accent: EBoardCellAccent,
	/** 방향이 있는 부품 무늬. 판 위의 칸과 같은 규칙으로 그린다 */
	glyph: EBoardCellGlyph,
}

export function createItemView(): PuzzleBoardItemView {
	return {
		isVisible: false,
		fill: BOARD_COLOR_EMPTY,
		texture: NO_TEXTURE,
		tint: BOARD_COLOR_NO_TINT,
		label: '',
		labelColor: BOARD_COLOR_TEXT,
		caption: '',
		isHighlighted: false,
		accent: EBoardCellAccent.NONE,
		glyph: EBoardCellGlyph.NONE,
	};
}

export type PuzzleBoardItemPatch = {
	isVisible?: boolean,
	fill?: PuzzleBoardColor,
	texture?: PuzzleTextureKey,
	tint?: PuzzleBoardColor,
	label?: string,
	labelColor?: PuzzleBoardColor,
	caption?: string,
	isHighlighted?: boolean,
	accent?: EBoardCellAccent,
	glyph?: EBoardCellGlyph,
}

export function applyItemPatch(item: PuzzleBoardItemView, patch: PuzzleBoardItemPatch): PuzzleBoardItemView | undefined {
	// applyCellPatch 와 같은 이유로, 바뀐 것이 없으면 객체를 만들지 않는다
	if ((patch.isVisible === undefined || patch.isVisible === item.isVisible)
		&& (patch.fill === undefined || isSameColor(patch.fill, item.fill))
		&& (patch.texture === undefined || patch.texture === item.texture)
		&& (patch.tint === undefined || isSameColor(patch.tint, item.tint))
		&& (patch.label === undefined || patch.label === item.label)
		&& (patch.labelColor === undefined || isSameColor(patch.labelColor, item.labelColor))
		&& (patch.caption === undefined || patch.caption === item.caption)
		&& (patch.isHighlighted === undefined || patch.isHighlighted === item.isHighlighted)
		&& (patch.accent === undefined || patch.accent === item.accent)
		&& (patch.glyph === undefined || patch.glyph === item.glyph)) {
		return undefined;
	}
	return {
		isVisible: patch.isVisible ?? item.isVisible,
		fill: patch.fill ?? item.fill,
		texture: patch.texture ?? item.texture,
		tint: patch.tint ?? item.tint,
		label: patch.label ?? item.label,
		labelColor: patch.labelColor ?? item.labelColor,
		caption: patch.caption ?? item.caption,
		isHighlighted: patch.isHighlighted ?? item.isHighlighted,
		accent: patch.accent ?? item.accent,
		glyph: patch.glyph ?? item.glyph,
	};
}

export function isSameItemView(left: PuzzleBoardItemView, right: PuzzleBoardItemView): boolean {
	return left.isVisible === right.isVisible
		&& left.texture === right.texture
		&& left.label === right.label
		&& left.caption === right.caption
		&& left.isHighlighted === right.isHighlighted
		&& left.accent === right.accent
		&& left.glyph === right.glyph
		&& isSameColor(left.fill, right.fill)
		&& isSameColor(left.tint, right.tint)
		&& isSameColor(left.labelColor, right.labelColor);
}

//#endregion

//#region Intro (레벨 시작 배너)

/**
 * 보조 레이아웃 자리에 잠깐 뜨는 시작 배너.
 *
 * `isVisible` 이 true 인 동안 보조 레이아웃은 그리지 않는다 - 배너가 사라진 **뒤에**
 * 보조 레이아웃이 나타나야 하기 때문이다. 얼마나 떠 있을지(타이머)는 표현 계층이 정한다.
 */
export type PuzzleBoardIntroView = {
	isVisible: boolean,
	text: string,
}

//#endregion

//#region Layout / View

export type PuzzleBoardGridView = {
	rowCount: number,
	colCount: number,
	/** row-major. 길이는 항상 rowCount * colCount */
	cells: PuzzleBoardCellView[],
}

export type PuzzleBoardSideView = {
	rowCount: number,
	colCount: number,
	/** 보조 격자 위에 표시할 짧은 이름 (예: "스위치 영역") */
	label: string,
	cells: PuzzleBoardCellView[],
}

/** 패널이 한 번에 받아 그리는 보드 전체 스냅샷 */
export type PuzzleBoardView = {
	/** 패널 상단 제목. 보통 퍼즐 표시 이름 */
	title: string,
	grid: PuzzleBoardGridView,
	/** 보조 레이아웃의 정보 미니 격자. 쓰지 않는 퍼즐은 undefined */
	side: PuzzleBoardSideView | undefined,
	/** 보조 레이아웃의 오브젝트 트레이. 쓰지 않는 퍼즐은 빈 배열 */
	items: PuzzleBoardItemView[],
	/** 격자 뒤에 까는 판 그림. `NO_TEXTURE` 면 깔지 않는다 */
	boardTexture: PuzzleTextureKey,
	/** 집은 조각을 손가락 위로 띄울지 (`PuzzleBoardLayoutSpec.liftGrabbedPiece`) */
	liftGrabbedPiece: boolean,
	/** 집은 조각을 띄우는 거리 - 칸 한 변의 배수 (`PuzzleBoardLayoutSpec.grabLiftCellRatio`) */
	grabLiftCellRatio: number,
	/** 보조 레이아웃의 큰 액션 버튼 라벨. 빈 문자열이면 그리지 않는다 (`PuzzleBoardLayoutSpec.actionLabel`) */
	actionLabel: string,
}

/** 프레젠터를 만들 때 넘기는 격자 규격 */
export type PuzzleBoardLayoutSpec = {
	title: string,
	rowCount: number,
	colCount: number,
	/** 보조 레이아웃의 정보 미니 격자 (스위치의 동시 눌림 영역 등) */
	side?: {
		rowCount: number,
		colCount: number,
		label: string,
	},
	/** 보조 레이아웃의 오브젝트 슬롯 수. 생략하면 트레이를 그리지 않는다 */
	itemCount?: number,
	/** 트레이 위에 표시할 짧은 이름 (예: "Crystals") */
	itemLabel?: string,
	/**
	 * 격자 뒤에 까는 판 그림의 키. 칸 사이 간격으로 비쳐 보이므로 나무판·회로기판처럼
	 * 판 전체의 재질을 표현할 때 쓴다. 생략하면 깔지 않는다.
	 */
	boardTexture?: PuzzleTextureKey,
	/**
	 * 집은 조각을 **손가락 위쪽으로 띄워** 그릴지. 생략하면 띄우지 않는다.
	 *
	 * 트레이에서 부품을 꺼내 판 위로 끌고 다니는 퍼즐(레이저)만 켠다 - 손가락이 부품을
	 * 가리면 무엇을 옮기는지 보이지 않기 때문이다. 칸을 짚거나 한 칸씩 미는 퍼즐이 켜면
	 * 조각이 손가락과 다른 칸 위에 떠 보여 오히려 조준을 흐린다는 피드백이 있었다.
	 */
	liftGrabbedPiece?: boolean,
	/**
	 * 집은 조각을 손가락 위로 띄우는 거리 - **칸 한 변의 배수**다. 생략하면 기본값
	 * (`PUZZLE_BOARD_DEFAULT_GRAB_LIFT_RATIO`), 0 이면 손가락 바로 밑에 그린다.
	 *
	 * `liftGrabbedPiece` 가 켜진 퍼즐(레이저)만 의미가 있다. 값은 그 퍼즐의 CoreAPI prop
	 * (`Laser_CoreAPI.dragLiftCells`)에서 조정한다 - 튜닝 지점을 에디터에 두기 위해서다.
	 */
	grabLiftCellRatio?: number,
	/**
	 * 보조 레이아웃을 채우는 **큰 액션 버튼**의 라벨. 생략하면 그리지 않는다.
	 *
	 * 색 채우기의 STOP 처럼 "타이밍에 맞춰 한 번 누른다" 가 조작의 전부인 퍼즐이 쓴다.
	 * 격자 칸 대신 엄지 폭보다 훨씬 큰 버튼 하나가 입력을 받고, 패널은 이 버튼을
	 * `onPress`(누르는 순간)로 연결해 반응이 릴리즈를 기다리지 않는다.
	 */
	actionLabel?: string,
}

export function createGridView(rowCount: number, colCount: number): PuzzleBoardGridView {
	const cells: PuzzleBoardCellView[] = [];
	for (let index = 0; index < rowCount * colCount; index++) {
		cells.push(createCellView());
	}
	return { rowCount: rowCount, colCount: colCount, cells: cells };
}

export function createItemViews(count: number): PuzzleBoardItemView[] {
	const items: PuzzleBoardItemView[] = [];
	for (let index = 0; index < count; index++) {
		items.push(createItemView());
	}
	return items;
}

export function createBoardView(spec: PuzzleBoardLayoutSpec): PuzzleBoardView {
	const side = spec.side;
	return {
		title: spec.title,
		grid: createGridView(spec.rowCount, spec.colCount),
		side: side === undefined
			? undefined
			: {
				rowCount: side.rowCount,
				colCount: side.colCount,
				label: side.label,
				cells: createGridView(side.rowCount, side.colCount).cells,
			},
		items: createItemViews(Math.max(0, spec.itemCount ?? 0)),
		boardTexture: spec.boardTexture ?? NO_TEXTURE,
		liftGrabbedPiece: spec.liftGrabbedPiece === true,
		grabLiftCellRatio: resolveGrabLiftRatio(spec.grabLiftCellRatio),
		actionLabel: spec.actionLabel ?? '',
	};
}

/**
 * 띄우기 배수의 기본값 - 손가락 폭을 넘길 만큼 띄우되 옆 칸으로 오해할 만큼은 아니다.
 * 예전에 패널 상수(`GRAB_LIFT_CELL_RATIO`)였던 값을 퍼즐이 조정할 수 있게 규격으로 옮겼다.
 */
export const PUZZLE_BOARD_DEFAULT_GRAB_LIFT_RATIO = 0.9;

/** 띄우기 배수를 다듬는다 - 음수는 0(안 띄움), 못 쓰는 값은 기본값 */
function resolveGrabLiftRatio(ratio: number | undefined): number {
	if (ratio === undefined || isFinite(ratio) === false) {
		return PUZZLE_BOARD_DEFAULT_GRAB_LIFT_RATIO;
	}
	return Math.max(0, ratio);
}

/** 격자 좌표 -> 셀 번호 (row-major). 보드 밖이면 PUZZLE_BOARD_CELL_OUTSIDE */
export function toBoardCellIndex(row: number, col: number, colCount: number, rowCount: number): number {
	if (row < 0 || row >= rowCount || col < 0 || col >= colCount) {
		return PUZZLE_BOARD_CELL_OUTSIDE;
	}
	return row * colCount + col;
}

/**
 * 규격이 패널이 그릴 수 있는 범위 안인지 검사한다.
 * 위반 사유는 콘솔로 나가므로 영어로 적는다.
 */
export function validateBoardLayout(spec: PuzzleBoardLayoutSpec): string[] {
	const violations: string[] = [];
	if (spec.rowCount < 1 || spec.rowCount > PUZZLE_BOARD_MAX_ROWS) {
		violations.push(`rowCount ${spec.rowCount} is out of range (1..${PUZZLE_BOARD_MAX_ROWS}).`);
	}
	if (spec.colCount < 1 || spec.colCount > PUZZLE_BOARD_MAX_COLS) {
		violations.push(`colCount ${spec.colCount} is out of range (1..${PUZZLE_BOARD_MAX_COLS}).`);
	}
	const side = spec.side;
	if (side !== undefined) {
		if (side.rowCount < 1 || side.rowCount > PUZZLE_BOARD_SIDE_MAX_ROWS) {
			violations.push(`side.rowCount ${side.rowCount} is out of range (1..${PUZZLE_BOARD_SIDE_MAX_ROWS}).`);
		}
		if (side.colCount < 1 || side.colCount > PUZZLE_BOARD_SIDE_MAX_COLS) {
			violations.push(`side.colCount ${side.colCount} is out of range (1..${PUZZLE_BOARD_SIDE_MAX_COLS}).`);
		}
	}
	const itemCount = spec.itemCount;
	if (itemCount !== undefined && (itemCount < 0 || itemCount > PUZZLE_BOARD_MAX_ITEMS)) {
		violations.push(`itemCount ${itemCount} is out of range (0..${PUZZLE_BOARD_MAX_ITEMS}).`);
	}
	return violations;
}

//#endregion
