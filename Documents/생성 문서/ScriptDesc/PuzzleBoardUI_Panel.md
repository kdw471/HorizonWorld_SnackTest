# PuzzleBoardUI_Panel.ts — 주석 아카이브

> 원본 스크립트: `PuzzleBoardUI_Panel.ts`
> 걷어낸 주석 41건 / 17,658 B 절감 (59,839 B → 42,181 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Puzzle Board UI Panel - 퍼즐 보드를 Custom UI 로 그리는 표현 계층

**3D 키 캡/타일을 대체한다.** 8개 퍼즐이 전부 2D 격자이므로 월드에 오브젝트를 두는 대신
여기서 격자를 직접 그린다 (`Documents/생성 문서/설계/2026-09-02_멀티플레이_플랫폼에서_싱글플레이_구현_방안.md` §3.2).

이렇게 바꾸면 멀티플레이의 세 가지 장벽이 한꺼번에 사라진다.
  - Local 소유 Custom UI 는 그 플레이어에게만 렌더된다 -> `setVisibilityForPlayers` 가 필요 없다
  - 복제할 3D 엔티티가 없다 -> 플레이어별 리그가 엔티티 2~3개로 끝난다
  - `position`/`visible`/`tintColor` 네트워크 동기화가 사라진다 -> 남의 화면이 같이 바뀌지 않는다

#### 화면 구성 - **퍼센트와 flex 뿐, 픽셀은 없다**

     ┌──────────────────────────────┐
     │  topInsetPercent (비워 둔다)   │  ← 상태바·노치·호라이즌 버튼 자리 + 퍼즐 제목
     │ ┌──────────────────────────┐ │
     │ │      보드 (정사각형)       │ │  flex: 7   `aspectRatio:1` + `maxWidth`
     │ │   그 안에 정사각 칸 격자    │ │            격자 상자는 판 대비 %
     │ └──────────────────────────┘ │
     │ ┌──────────────────────────┐ │
     │ │ < 트레이 > · 미니격자 · Reset │ │  flex: 3   (보조 레이아웃)
     │ └──────────────────────────┘ │
     │  bottomInsetPercent + [Menu]  │  ← 홈 인디케이터 자리 + 일시정지 버튼
     └──────────────────────────────┘

참고 구현은 `Documents/SampleHtml/index.html` 이다. CSS 의 `flex: 7 / 3`,
`aspect-ratio: 1`, `repeat(N, 1fr)` 가 그대로 옮겨져 있다.

**이 구조로 전면 개편한 이유**는 2026-09-03 실기 측정이다. 화면에서 읽은 픽셀
(`screenWidth/Height`)과 패널이 실제로 그려지는 좌표계의 **단위가 달랐고**, 그래서 픽셀로
계산한 판이 화면의 40% 밖에 쓰지 못했다. 같은 측정에서 퍼센트와 flex 는 전부 정확했다.
자세한 내용과 판정 근거는 `PuzzleUI_RelativeLayout` 머리말에 있다.

판은 **정사각형**이다. 그 안에서 격자 상자만 판의 비율(4행 8열이면 100%x50%)을 가지므로,
판 모양과 무관하게 **칸은 언제나 정사각형**이다 (`computeGridBox`). 트레이의 부품은
트레이 높이를 꽉 채우고, 한 줄에 다 들어가지 않으면 좌우 화살표로 넘겨 본다 -
크기를 줄이면 부품이 손가락보다 작아져 집을 수가 없다.

보조 레이아웃에 들어가는 셋은 이렇다.
  - **오브젝트 트레이** 판으로 끌어다 쓰는 오브젝트 (레이저의 미배치 크리스탈). 누를 수 있다
  - **정보 미니 격자** 푸는 데 필요한 정보 (스위치의 동시 눌림 영역). 표시 전용이다
  - **리셋 버튼**      판을 풀기 전 상태로 되돌린다. **남은 시간은 되돌리지 않는다**

레벨이 시작되면 보조 레이아웃 자리에 `GameStart` 배너가 `introSeconds` 동안 떴다가
`introFadeSeconds` 동안 **페이드 아웃**되고, 완전히 사라진 뒤에 보조 레이아웃이 나타난다.
배너가 떠 있는 동안에는 **보드 입력도 막힌다** - 게이트는 프레젠터에 있고
(`PuzzleBoardPresenter.canAcceptInput()`), 여는 시점은 여기의 타이머가 `endIntro()` 로
정한다. 배너를 켜는 것은 각 `*_CoreAPI` 다 (`presenter.beginIntro()`).

#### 붙이는 법

  1. Custom UI gizmo 를 만들고 이 스크립트를 붙인다.
     - 화면에 겹쳐 띄우려면 Display Mode = **Screen Overlay**
     - 월드에 판이 서 있게 하려면 Display Mode = **Spatial(World Space)**
  2. 실행 모드를 **Local** 로 두고 `Puzzle_LocalOwnership` 의 targets 에 이 엔티티를 넣는다.
     소유권이 넘어오지 않으면 서버 인스턴스는 빈 화면만 그린다.
  3. 같은 클라이언트의 `*_CoreAPI` 가 `PuzzleBoardStage.instance.mount()` 를 부르면
     그 보드가 여기에 나타난다. 패널 쪽에 퍼즐별 설정은 없다.

#### 이 파일이 맡는 것과 맡지 않는 것

화면 조각은 저마다 자기 파일에 있고, 이 파일은 **틀과 배선**만 맡는다.

  `PuzzleBoardUI_Grid`   본 격자              - 8개 퍼즐이 전부 쓴다
  `PuzzleBoardUI_Tray`   오브젝트 트레이       - 규격에 `itemCount` 를 적은 퍼즐만
  `PuzzleBoardUI_Side`   정보 미니 격자        - 규격에 `side` 를 적은 퍼즐만
  `PuzzleBoardUI_Parts`  셋이 나눠 쓰는 어휘    - 색·조작 강조·칸 위에 겹치는 층들

셋은 **자기 상태(Binding)를 스스로 들고** 있고, 패널은 프레젠터에게서 받은 스냅샷을
그쪽으로 넘겨 주기만 한다 (`applyView()`). 그래서 터치만 하는 퍼즐을 좇아 읽는 사람이
트레이의 페이지 계산을 지나쳐 갈 일이 없다.

**선택 조각은 선언한 퍼즐만 마운트한다.** 트레이·미니 격자·액션 버튼은 `display: none`
이 아니라 `UINode.if` 로 가른다 - 숨긴 노드는 그려지지만 않을 뿐 트리에 남아 Binding 을
들고 있기 때문이다 (`createAuxContent()`).

#### 왜 격자를 `DynamicList` 로 그리는가 - **패널 크기 한도 64kB**

`initializeUI()` 가 돌려주는 트리는 통째로 직렬화되어 패널에 실리고, 그 크기가 64kB 를
넘으면 컴포넌트가 **아예 만들어지지 않는다**
(`Failed to instantiate ... The UI (86236B) exceeds the maximum allowed size of 64kB`).

예전에는 최대 격자(9×9)의 칸 81개를 여기서 전부 만들어 두고 격자 밖은 `display: none` 으로
숨겼다. 칸 하나의 트리(누름 껍데기·얼굴·글자·무늬·테두리·고리)가 81벌 복제되어 86kB 가
되었고 그래서 한도를 넘었다. 지금은 `DynamicList` 가 `renderItem` 을 런타임에 부르므로
**트리에는 템플릿 한 벌만** 실린다 (자세한 내용은 `PuzzleBoardUI_Grid` 머리말).

그 때문에 **UI 트리의 자리(슬롯)와 퍼즐의 칸 번호가 다르다.**

  슬롯 번호 = row * PUZZLE_BOARD_MAX_COLS + col      (고정 9열 기준, Binding 배열의 색인)
  칸  번호 = row * 현재 colCount        + col        (퍼즐 로직이 쓰는 row-major)

둘을 오가는 곳이 이 파일이다 - 렌더러는 슬롯 번호만, 프레젠터는 칸 번호만 쓴다
(`applyGridCell()` / `applyPress()` / `toCellIndex()`).

## `const COLOR_PANEL_BACKGROUND = toColor(BOARD_COLOR_BACKGROUND);`

> 원본 L148

#region Style constants

## `const COLOR_PANEL_BACKGROUND = toColor(BOARD_COLOR_BACKGROUND);`

> 원본 L150

화면 전체의 바탕.

칸·슬롯의 색과 조작 강조 규칙, 그 위에 겹쳐 놓는 층들은 전부
`PuzzleBoardUI_Parts` 에 있다 - 격자와 트레이가 같은 규칙을 나눠 쓰기 때문이다.

## `const COLOR_AUX_BACKGROUND = new Color(0.11, 0.12, 0.17);`

> 원본 L157

 보조 레이아웃의 바탕 - 본 격자와 구분되도록 한 단계 밝다

## `const DEFAULT_SCREEN_PIXEL_RATIO = 2;`

> 원본 L160

`screenPixelRatio` 의 기본값 - 실기 측정값(1179 / 590 = 2) 이다.

**prop 기본값과 반드시 같아야 한다.** 필드 초기화 시점에는 `this.props` 가 아직 없어서
prop 을 읽을 수 없기 때문에, 그때는 이 상수가 대신 쓰인다 (`_pixelRatio` 주석).

## `const AUX_AREA_WIDTH_PERCENT = '94%';`

> 원본 L168

보조 레이아웃 안쪽의 비율 - 전부 **자기 부모 대비 %** 다.

픽셀이 하나도 없으므로 어느 기기에서든 같은 모양으로 그려진다. 예전에는 이 값들이
픽셀이었고, 그 픽셀이 화면에 몇 배로 그려지는지 알 수 없어
트레이와 리셋 버튼이 화면 절반 크기로 나왔다.

## `const RESET_WIDTH_PERCENT = '20%';`

> 원본 L176

 리셋 버튼이 보조 레이아웃에서 쓰는 가로 %와 세로 비율

## `const COLOR_MENU_BUTTON = new Color(0.24, 0.27, 0.36);`

> 원본 L180

화면 아래 오른쪽에 떠 있는 Menu(일시정지) 버튼.

격자 위에 겹쳐 그리므로 **판보다 확실히 밝게** 잡는다 - 어느 퍼즐의 어떤 색 칸 위에
올라가도 버튼으로 읽혀야 한다.

## `const MENU_BUTTON_OPACITY = 0.92;`

> 원본 L187

 격자를 조금이라도 덜 가리려고 살짝 비친다. 글자는 그대로 읽힌다

## `const MENU_BUTTON_HEIGHT_PERCENT = '72%';`

> 원본 L189

 Menu 버튼의 세로 크기 (아래 여백 띠 대비 %) 와 알약 모양의 가로 배수

## `export class PuzzleBoardUIPanel extends UIComponent<typeof PuzzleBoardUIPanel> {`

> 원본 L193

#endregion

## `showTitle: { type: PropTypes.Boolean, default: false },`

> 원본 L197

보드 제목 줄을 그릴지.

기본은 꺼짐이다. 메인 UI 의 HUD 가 이미 좌측 상단에 레벨을, 중앙에 남은 초를
표시하므로 제목까지 그리면 위쪽이 세 줄이 된다.

## `topInsetPercent: { type: PropTypes.Number, default: 6 },`

> 원본 L204

화면 **위**에 비워 둘 세로 % - 상태바·노치와 호라이즌 자체 버튼(`...`/`≡`) 자리다.

이 패널은 화면 전체를 덮고 **상태바 뒤까지 그려진다** (실기 스크린샷으로 확인).
여백을 두지 않으면 판의 첫 줄이 시계와 노치에 가린다. 퍼즐 제목도 이 자리에 앉는다.

## `bottomInsetPercent: { type: PropTypes.Number, default: 8 },`

> 원본 L211

화면 **아래**에 비워 둘 세로 % - `Menu` 버튼 띠와 홈 인디케이터 자리다.

위아래 여백을 뺀 나머지가 **7:3** 으로 갈려 본 격자 영역과 보조 레이아웃이 된다.
그 7:3 은 기획이 정한 화면 구성이라 prop 으로 열지 않는다.

## `boardWidthPercent: { type: PropTypes.Number, default: 96 },`

> 원본 L218

보드 정사각형이 쓰는 **가로 %** - 나머지가 좌우 여백으로 반씩 나뉜다.

96 이면 좌우에 각각 2% 가 남는다. 세로로 긴 화면에서는 이 값이 판 크기를 정하고,
가로로 긴 화면에서는 아래 `boardHeightPercent` 가 정한다 - 둘 중 작은 쪽이
자동으로 이긴다 (`aspectRatio` + `maxWidth`, `PuzzleUI_RelativeLayout` 머리말 §1).

## `boardHeightPercent: { type: PropTypes.Number, default: 94 },`

> 원본 L226

보드 정사각형이 **본 격자 영역의 세로**에서 쓰는 %.

남는 세로가 보조 레이아웃과의 틈이 된다. 100 으로 두면 판이 트레이에 바로 붙는다.

## `screenPixelRatio: { type: PropTypes.Number, default: 2 },`

> 원본 L232

`screenWidth/Height` 읽기값을 **패널 좌표 단위**로 옮기는 배율.

실기 측정(`showLayoutProbe` 의 `D` 상자)에서 패널 좌표 1 단위가 디바이스 실픽셀
1 이었고, 읽기값은 긴 변을 1280 으로 정규화한 값이었다 - 1179x2556 폰이
590x1280 으로 읽혔으므로 배율이 2 다.

**배치는 이 값을 쓰지 않는다.** `fontSize`/`borderWidth`/`borderRadius` 처럼
`horizon/ui` 에 상대 단위가 없는 곳에만 쓴다. 그래서 이 값이 틀린 기기에서도
판과 트레이는 정확히 그려지고 글자만 조금 크거나 작아진다.

재는 법: 스크린샷의 실제 가로 픽셀 ÷ 로그의 `screen` 가로.

## `cellGapPercent: { type: PropTypes.Number, default: 1.2 },`

> 원본 L246

 칸 사이 간격 (%)

## `introSeconds: { type: PropTypes.Number, default: 0.45 },`

> 원본 L248

`GameStart` 배너가 **완전히 보이는 채로** 떠 있는 시간 (초).

이 시간이 지나면 `introFadeSeconds` 동안 페이드 아웃되고, 완전히 사라진 뒤에야
보조 레이아웃이 나타난다. **보드 입력은 페이드가 시작될 때 이미 열린다**
(`startIntroFade()` -> `unlockIntroInput()`). 그래서 이 값이 곧 입력 잠금 시간이다 -
반응성 우선으로 짧게 둔다.

## `introFadeSeconds: { type: PropTypes.Number, default: 0.3 },`

> 원본 L257

 배너가 페이드 아웃되는 시간 (초). 0 이면 즉시 사라진다. 입력은 페이드 중에도 열려 있다

## `drawBackgroundWhenEmpty: { type: PropTypes.Boolean, default: false },`

> 원본 L259

 보드가 없을 때도 배경을 그릴지. 기본은 꺼서 퍼즐 밖에서는 투명해진다

## `tintTexturesWithFill: { type: PropTypes.Boolean, default: false },`

> 원본 L261

텍스처에 칸 색을 입힐지 (기본 꺼짐).

켜면 그림의 밝기를 유지한 채 `fill` 색으로 물들인다. **회색조 한 장으로 여러 상태를
표현할 때** 쓴다 - 스위치 키 캡 그림 하나로 눌림(초록)과 안 눌림(빨강)을 모두 그리는 식이다.
이미 색이 칠해진 그림을 쓸 거면 꺼 둔다.

## `canvasWidth: { type: PropTypes.Number, default: 0 },`

> 원본 L270

캔버스 크기를 직접 못박는다 (px). 둘 다 0 이면 화면 비율에서 자동으로 잡는다.

`player.screenWidth/screenHeight` 가 실제 화면과 다르게 오는 기기를 만났을 때의
탈출구다. **보드 패널과 허브 패널에 같은 값을 넣어야 한다** - 다르면 같은 `%` 가
서로 다른 픽셀이 되어 HUD 바가 보드 위로 파고든다.

## `showLayoutDebug: { type: PropTypes.Boolean, default: false },`

> 원본 L280

레이아웃 실측값을 화면 왼쪽 아래에 띄운다 (디버그).

`screenWidth/Height` 원본 읽기값 · 캔버스 크기 · 격자 칸 크기가 그대로 나온다.
실기에서 "UI 가 화면 일부만 쓴다 / 크기가 이상하다" 가 보이면 이것을 켜고
스크린샷을 찍으면 원인을 바로 좁힐 수 있다. 콘솔 로그와 같은 값이다.

## `showLayoutProbe: { type: PropTypes.Boolean, default: false },`

> 원본 L288

레이아웃 프로브만 그린다 (디버그). 게임 화면은 뜨지 않는다.

상대 배치(`%`/`flex`/`aspectRatio`)가 실기에서 어떻게 그려지는지를 스크린샷 한 장으로
재는 화면이다. 배치를 상대 배치로 다시 짜기 전에 그 전제를 확정하려고 만들었다 -
읽는 법은 `PuzzleUI_LayoutProbe` 머리말의 표에 있다.

입력을 받는 노드가 없으므로 켠 채로는 퍼즐을 할 수 없다. 재고 나면 다시 끈다.

## `showTrayDebug: { type: PropTypes.Boolean, default: false },`

> 원본 L298

오브젝트 트레이의 상태를 진단한다 (디버그) - "부품이 안 보인다" 전용.

켜면 두 가지가 함께 나온다.
  - 슬롯마다 **형광 테두리 상자**와 `번호+상태`(`0V` / `3.`)가 그려진다.
    상자는 보이는데 그 안이 비었으면 **내용이 생성되지 않은 것**이고,
    상자 자체가 안 보이면 **접혔거나 크기가 0 인 것**이다 (`BoardTrayRenderer`).
  - 화면 아래 진단 줄과 콘솔에 `tray items=.. vis=.. page=.. slots=VVV____` 가
    나온다. 읽는 법은 `BoardTrayRenderer.describeDebug()` 의 표에 있다.

이 값이 켜져 있으면 `showLayoutDebug` 가 꺼져 있어도 진단 줄은 뜬다.

## `protected panelWidth: number = PUZZLE_UI_CANVAS_WIDTH;`

> 원본 L313

Custom UI gizmo 의 패널 크기 (px). 초기화 뒤에는 바꿀 수 없다.

메인 UI 와 **같은 캔버스**를 쓴다 (`PuzzleUI_Layout`). 두 패널이 다른 캔버스를 쓰면
같은 `%` 가 서로 다른 픽셀이 되어 HUD 바와 보드 여백이 어긋난다.


캔버스 크기 (px).

**`readonly` 가 아니다.** `initializeUI()` 에서 플레이어의 실제 화면 비율에 맞춰
다시 잡는다 - 그래야 Screen Overlay 가 화면을 꽉 채우고 옆으로 월드가 새지 않는다
(`PuzzleUI_Layout.resolveCanvas()`). 초기값은 화면 크기를 읽지 못할 때의 기본값이다.

## `private _canvas: PuzzleUICanvas = getDefaultCanvas();`

> 원본 L329

 이 플레이어의 캔버스. `resolveLayout()` 에서 한 번 정하고 바뀌지 않는다

## `private get screenUnitsHeight(): number {`

> 원본 L332

화면 세로를 **패널 좌표 단위**로 나타낸 값.

실기 측정에서 좌표 1 단위가 디바이스 실픽셀 1 이었고, `screenHeight` 읽기값은 긴 변을
1280 으로 정규화한 값이었다 (`PuzzleUI_RelativeLayout` 머리말). 그 차이를 메우는 것이
`screenPixelRatio` prop 이다. **배치는 이 값을 쓰지 않는다** - 글자·테두리처럼
`horizon/ui` 에 상대 단위가 없는 곳에만 쓴다.

## `private _pixelRatio: number = DEFAULT_SCREEN_PIXEL_RATIO;`

> 원본 L345

`screenPixelRatio` prop 을 담아 두는 자리. `resolveLayout()` 에서 채운다.

**여기서 `this.props` 를 직접 읽으면 안 된다.** 클래스 필드 초기화 시점에는
`this.props` 가 아직 undefined 라 컴포넌트가 **아예 만들어지지 않는다**
(`Failed to instantiate ... Cannot read properties of undefined`).
그래서 값을 필드에 담아 두고, 기본값은 상수에서 가져온다.

같은 함정이 `Binding.derive()` 에도 있다 - 파생 함수를 그 자리에서 한 번 부르므로,
아직 대입되지 않은 것을 그 안에서 건드리면 같은 오류가 난다
(`BoardGridRenderer._cellFontSize` 가 생성자에서 만들어지는 이유다).

## `private get pxScale(): number {`

> 원본 L359

기준 캔버스(세로 1180) 픽셀로 튜닝한 상수를 좌표 단위로 환산하는 배율.
글자 한계·테두리 두께처럼 해상도와 무관해야 하는 값에 곱한다.

## `private units(fractionOfScreenHeight: number): number {`

> 원본 L367

 화면 세로 대비 비율을 좌표 단위로 - 글자 크기의 기준을 상대 배치에서 뽑을 때 쓴다

## `private get auxHeightUnits(): number {`

> 원본 L372

 보조 레이아웃의 높이 (좌표 단위) - 그 안의 글자 크기가 여기서 나온다

## `private px(referencePixels: number): number {`

> 원본 L377

 기준 캔버스 픽셀 값을 실제 캔버스 픽셀로 (최소 1px)

## `private scaleBorderWidth(referenceWidth: number): number {`

> 원본 L382

 강조 테두리 두께를 실제 캔버스 픽셀로 - 0(테두리 없음)은 0 그대로 둔다

## `private _profile: PuzzleUILayoutProfile = getLayoutProfile(EUIDeviceClass.DESKTOP);`

> 원본 L386

 이 플레이어의 기기 규격. `initializeUI()` 에서 한 번 정하고 바뀌지 않는다

## `private _layout: PuzzleBoardRelativeLayout = resolveRelativeLayout();`

> 원본 L389

확정한 상대 배치 - **여백 %와 7:3 분할뿐이고 픽셀은 하나도 없다**
(`PuzzleUI_RelativeLayout`).

## `private _screenAspect: number = 1;`

> 원본 L395

화면 가로/세로 비율.

읽기값의 **단위는 믿을 수 없지만 비율은 믿을 수 있다** (머리말). 글자 크기를 뽑을 때
"보드 정사각형이 화면의 몇 % 인가" 를 계산하는 데만 쓴다.

## `private _rawScreenWidth: number = 0;`

> 원본 L403

 `screenWidth/Height` 원본 읽기값 - 디버그 표시용. 캔버스 계산 전에 담아 둔다

## `private readonly _layoutDebug: Binding<string> = new Binding<string>('');`

> 원본 L407

 화면에 띄우는 레이아웃 실측값 (`showLayoutDebug`) - 콘솔 로그와 같은 내용이다

## `private updateLayoutDebug(): void {`

> 원본 L410

 디버그 문자열을 다시 만든다. 화면에 그대로 나가는 값이므로 영어다

