/**
 * # 레이아웃 프로브 - 상대 배치(`%`/`flex`)가 실기에서 어떻게 그려지는지 재는 화면
 *
 * ## 왜 필요한가
 *
 * `PuzzleUI_Layout` 은 `player.screenWidth/screenHeight` 로 읽은 값에서 **절대 픽셀**을
 * 계산해 모든 것을 배치한다. 그런데 그 픽셀이 화면에 몇 배로 그려지는지(패널 좌표 한 칸이
 * 화면 몇 px 인지)를 아직 아무도 모른다. `panelWidth`/`panelHeight` 가 그것을 정한다고
 * 보고 1280 에서 590 으로 바꿔 봤지만 **화면에 그려지는 크기는 그대로였다** - 즉 그 가정이
 * 틀렸다. 반면 루트의 `width: '100%'` 배경은 화면을 정확히 꽉 채우고, 격자 안쪽의
 * `flex: 1` 행·칸도 고르게 나뉜다. 상대 배치는 믿을 수 있다는 뜻이다.
 *
 * 그래서 배치 전체를 상대 배치로 다시 짜기 전에, **상대 배치의 어디까지가 실제로
 * 동작하는지**를 스크린샷 한 장으로 확정하는 것이 이 화면의 목적이다.
 *
 * ## 무엇을 재는가 - 스크린샷에서 이렇게 읽는다
 *
 * | 표식 | 스타일 | 통과 조건 |
 * |---|---|---|
 * | 위/아래 두 색 영역 | `flex: 7` / `flex: 3` | 경계가 화면 세로의 70% 지점 (왼쪽 눈금 7번째 칸 끝) |
 * | **A** (노랑 테두리) | `height: '100%'` + `aspectRatio: 1` + `maxWidth: '100%'` | **정사각형**이고 위 영역 **안에** 들어온다 |
 * | **B** (초록) | `height: '60%'` + `aspectRatio: 1` | 정사각형 (A 가 깨졌을 때 `maxWidth` 탓인지 `aspectRatio` 탓인지 가른다) |
 * | **C** (분홍) | `width: '20%'` | 아래 영역 가로의 정확히 1/5 |
 * | **D** (흰색) | `width: 100, height: 100` 고정 | **화면 폭 대비 몇 % 인지 재면 패널 좌표계의 실제 크기가 나온다** (D 가 화면 폭의 x% 면 좌표계 가로 = 100 / x × 100) |
 * | A 안의 4×4 칸 | 행 `flex: 1` + 칸 `flex: 1` | 16칸이 모두 같은 정사각형 |
 * | 왼쪽 세로 눈금 | 10칸 `flex: 1` | 10등분 - 위 항목들의 위치를 읽는 자 |
 *
 * D 하나만으로도 지금 화면이 왜 40% 만 쓰는지가 숫자로 확정된다.
 *
 * ## 쓰는 법
 *
 * 에디터에서 보드 패널의 `showLayoutProbe` 를 켜면 **이 화면만** 뜬다 (게임 화면은 그리지
 * 않는다 - 다른 노드가 섞이면 측정이 흐려지기 때문이다). 재고 나면 다시 끈다.
 * 입력을 받는 노드가 하나도 없으므로 켠 채로는 퍼즐을 할 수 없다. 기본값은 꺼짐이다.
 */

import { Color } from 'horizon/core';
import { Bindable, Text, UINode, View } from 'horizon/ui';

/** 위(격자) 영역 바탕 - 아래 영역과 뚜렷이 갈려야 7:3 경계를 읽을 수 있다 */
const PROBE_COLOR_TOP_AREA = new Color(0.18, 0.21, 0.31);
/** 아래(보조 레이아웃) 영역 바탕 */
const PROBE_COLOR_BOTTOM_AREA = new Color(0.07, 0.07, 0.07);
/** A - `aspectRatio` + `maxWidth` 정사각형 후보. 실제 보드가 앉을 자리다 */
const PROBE_COLOR_SQUARE_A = new Color(0.91, 0.77, 0.28);
/** B - `aspectRatio` 만 쓴 정사각형 */
const PROBE_COLOR_SQUARE_B = new Color(0.30, 0.69, 0.31);
/** C - 퍼센트 폭 */
const PROBE_COLOR_PERCENT_C = new Color(0.91, 0.36, 0.46);
/** D - 절대 픽셀 100 (좌표계 크기를 재는 자) */
const PROBE_COLOR_PIXELS_D = new Color(1, 1, 1);
/** A 안쪽 4×4 칸 - 두 색이 번갈아 들어가 칸이 정사각형인지 눈으로 보인다 */
const PROBE_COLOR_CELL_DARK = new Color(0.16, 0.17, 0.22);
const PROBE_COLOR_CELL_LIGHT = new Color(0.35, 0.37, 0.45);
/** 왼쪽 세로 눈금 - 10등분 */
const PROBE_COLOR_RULER_ODD = new Color(0.95, 0.95, 0.95);
const PROBE_COLOR_RULER_EVEN = new Color(0.35, 0.35, 0.35);
const PROBE_COLOR_LABEL = new Color(0.05, 0.05, 0.05);
const PROBE_COLOR_CAPTION = new Color(1, 1, 1);

/**
 * 글자 크기 (패널 좌표 단위).
 *
 * **`px()` 로 환산하지 않는다.** 그 환산이 기대대로 그려지는지를 지금 재는 중이라,
 * 프로브의 글자까지 거기에 맡기면 결과가 흐려진다. 좌표계가 1280 이든 590 이든
 * 읽을 수 있는 크기로 그냥 못박는다.
 */
const PROBE_LABEL_FONT_SIZE = 44;
const PROBE_CAPTION_FONT_SIZE = 36;

/** 눈금 칸 수 - 화면 세로를 10등분해 7:3 경계를 눈으로 읽는다 */
const PROBE_RULER_STEPS = 10;
/** A 안에 채울 격자 - 실제 보드와 같은 `flex: 1` 구조다 */
const PROBE_GRID_SIZE = 4;

/** 표식 위에 얹는 이름표. 상자 크기에 영향을 주지 않도록 절대 배치로 띄운다 */
function probeLabel(text: string): UINode {
	return Text({
		text: text,
		style: {
			position: 'absolute',
			left: 0,
			top: 0,
			color: PROBE_COLOR_LABEL,
			fontSize: PROBE_LABEL_FONT_SIZE,
			fontWeight: 'bold',
		},
	});
}

/**
 * A 안에 들어가는 4×4 격자.
 *
 * 실제 보드와 **같은 구조**다 - 행이 `flex: 1`, 칸이 `flex: 1`
 * (`PuzzleBoardUI_Panel.getGridRowNode()`). 부모가 정사각형이면 칸도 정사각형이어야 한다.
 */
function probeGrid(): UINode {
	const rows: UINode[] = [];
	for (let row = 0; row < PROBE_GRID_SIZE; row++) {
		const cells: UINode[] = [];
		for (let col = 0; col < PROBE_GRID_SIZE; col++) {
			cells.push(View({
				style: {
					flex: 1,
					margin: 3,
					backgroundColor: (row + col) % 2 === 0
						? PROBE_COLOR_CELL_DARK
						: PROBE_COLOR_CELL_LIGHT,
				},
			}));
		}
		rows.push(View({ children: cells, style: { flex: 1, flexDirection: 'row' } }));
	}
	return View({
		children: rows,
		style: { width: '100%', height: '100%', flexDirection: 'column' },
	});
}

/** 화면 세로를 10등분하는 왼쪽 눈금 - 7:3 경계와 각 표식의 위치를 읽는 자 */
function probeRuler(): UINode {
	const steps: UINode[] = [];
	for (let index = 0; index < PROBE_RULER_STEPS; index++) {
		steps.push(View({
			style: {
				flex: 1,
				backgroundColor: index % 2 === 0 ? PROBE_COLOR_RULER_ODD : PROBE_COLOR_RULER_EVEN,
			},
		}));
	}
	return View({
		children: steps,
		style: {
			position: 'absolute',
			left: 0,
			top: 0,
			width: '3%',
			height: '100%',
			flexDirection: 'column',
		},
	});
}

/**
 * 프로브 화면 전체.
 *
 * `caption` 에는 보통 `showLayoutDebug` 와 같은 실측값 한 줄을 넘긴다 - 스크린샷 한 장에
 * "코드가 믿는 숫자" 와 "실제로 그려진 모습" 이 같이 담겨야 대조가 된다.
 */
export function createLayoutProbe(caption: Bindable<string>): UINode {
	// 위 70% - 보드가 앉을 자리. A 가 여기 꽉 차는 정사각형이 되어야 한다
	const topArea = View({
		children: [
			View({
				children: [probeGrid(), probeLabel('A aspect+maxWidth')],
				style: {
					// CSS 의 `height: 100%; aspect-ratio: 1; max-width: 100%` 와 같은 뜻이다.
					// Yoga 가 `maxWidth` 를 `aspectRatio` 보다 뒤에 적용하면 정사각형이
					// 영역 안에 들어오고, 아니면 좌우로 삐져나간다 - 그 갈림을 여기서 본다
					height: '100%',
					aspectRatio: 1,
					maxWidth: '100%',
					backgroundColor: PROBE_COLOR_SQUARE_A,
				},
			}),
		],
		style: {
			flex: 7,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: PROBE_COLOR_TOP_AREA,
		},
	});

	// 아래 30% - 보조 레이아웃 자리. 나머지 표식 셋이 나란히 선다
	const bottomArea = View({
		children: [
			View({
				children: [probeLabel('B aspect')],
				style: { height: '60%', aspectRatio: 1, backgroundColor: PROBE_COLOR_SQUARE_B },
			}),
			View({
				children: [probeLabel('C 20%')],
				style: { width: '20%', height: '60%', backgroundColor: PROBE_COLOR_PERCENT_C },
			}),
			View({
				children: [probeLabel('D 100px')],
				style: { width: 100, height: 100, backgroundColor: PROBE_COLOR_PIXELS_D },
			}),
		],
		style: {
			flex: 3,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-around',
			backgroundColor: PROBE_COLOR_BOTTOM_AREA,
		},
	});

	return View({
		children: [
			topArea,
			bottomArea,
			probeRuler(),
			Text({
				text: caption,
				style: {
					position: 'absolute',
					left: '4%',
					bottom: 4,
					color: PROBE_COLOR_CAPTION,
					fontSize: PROBE_CAPTION_FONT_SIZE,
					backgroundColor: new Color(0, 0, 0),
				},
			}),
		],
		style: {
			width: '100%',
			height: '100%',
			flexDirection: 'column',
			backgroundColor: PROBE_COLOR_BOTTOM_AREA,
		},
	});
}
