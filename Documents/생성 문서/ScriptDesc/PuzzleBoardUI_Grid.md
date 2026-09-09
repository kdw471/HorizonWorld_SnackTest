# PuzzleBoardUI_Grid.ts — 주석 아카이브

> 원본 스크립트: `PuzzleBoardUI_Grid.ts`
> 걷어낸 주석 25건 / 5,991 B 절감 (26,046 B → 20,055 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Puzzle Board UI Grid - **본 격자**

8개 퍼즐이 전부 여기를 쓴다. 판 그림 · 정사각 판 · 칸 격자가 이 파일에 있고,
패널은 `createNode()` 로 받아 화면 위쪽 7/10 자리에 끼우기만 한다.

#### 왜 `DynamicList` 로 그리는가 - 패널 크기 한도 64kB

예전에는 최대 격자(9×9)의 칸 81개를 `initializeUI()` 에서 전부 만들어 두고 격자 밖은
`display: none` 으로 숨겼다. 그런데 `initializeUI()` 가 돌려주는 트리는 통째로
직렬화되어 패널에 실리므로, 칸 하나의 트리(누름 껍데기·얼굴·글자·무늬·테두리·고리)가
81벌 복제되어 86kB 가 되었고 **패널이 아예 만들어지지 않았다**
(`Failed to instantiate ... exceeds the maximum allowed size of 64kB`).

`DynamicList` 는 `renderItem` 을 런타임에 부르므로 트리에는 **템플릿 한 벌만** 실린다.
그래서 9×9 를 유지하면서도 패널 크기가 한도 아래로 내려간다.

칸의 내용은 여전히 `_cellBindings[슬롯]` 이 나른다. 목록이 나르는 것은 자리 번호뿐이라
칸 하나가 바뀔 때 목록을 다시 그리지 않는다 - 드래그 중의 갱신 비용은 예전과 같다.
목록의 길이가 곧 격자의 크기이므로 **행·칸의 `display` 숨김이 필요 없어졌다.**

그래서 **UI 트리의 자리(슬롯)와 퍼즐의 칸 번호가 다르다.**

  슬롯 번호 = row * PUZZLE_BOARD_MAX_COLS + col      (고정 9열 기준, Binding 배열의 색인)
  칸  번호 = row * 현재 colCount        + col        (퍼즐 로직이 쓰는 row-major)

칸 번호를 다루는 쪽(입력·프레젠터)은 패널이고, 여기서는 슬롯 번호만 쓴다.

## `const BOARD_CORNER_RADIUS = 12;`

> 원본 L66

#region Style constants

## `const BOARD_CORNER_RADIUS = 12;`

> 원본 L68

 판 배경 그림의 모서리 둥글기 (px)

## `const BOARD_PANEL_CORNER_RADIUS = 18;`

> 원본 L70

 보드 메인 패널의 모서리 둥글기 (px)

## `const COLOR_BOARD_PANEL = new Color(0.1, 0.11, 0.16);`

> 원본 L72

보드 메인 패널의 바탕 - 화면 배경과 보조 레이아웃 사이의 밝기다.

정사각 판(러시아워 9×9)은 직사각 패널 안에서 가운데로 모이므로 좌우가 남는다.
그 남는 자리가 화면 배경과 같은 색이면 판의 경계가 사라져 "어디까지가 판인지" 가
보이지 않는다. 그래서 패널에 자기 바탕을 준다.

## `export type BoardGridHandlers = {`

> 원본 L81

#endregion

## `export type BoardGridHandlers = {`

> 원본 L83

 격자가 패널에 되돌려 주는 입력 - 전부 **슬롯 좌표(row, col)** 로 온다

## `export class BoardGridRenderer {`

> 원본 L91

 본 격자 한 벌. 패널이 하나 만들어 두고 `createNode()` 로 트리에 끼운다

## `private readonly _cellGapValue: number;`

> 원본 L95

 칸 사이 간격 (칸 대비 %) - 패널 prop 에서 온다

## `private readonly _pressedFlags: Binding<boolean>[] =`

> 원본 L103

손가락이 지금 짚고 있는지를 **자리마다 하나씩** 든 Binding.

칸의 스냅샷과 **따로** 둔다. 그래야 세션이 칸을 다시 칠해도 누름 표시가 지워지지 않고,
반대로 누름 표시가 퍼즐이 준 강조를 덮어쓰지도 않는다 - 둘은 렌더 시점에 합쳐진다.

**전역 슬롯 번호 Binding 하나로 두면 안 된다.** 모든 칸이 그 하나에서 파생하므로,
짚은 자리가 한 칸 옮겨질 때마다 81칸 × 파생 속성 여러 개가 전부 다시 계산되어
탭·드래그마다 조작이 끊겼다. 자리마다 나누면 바뀐 두 자리만 다시 그린다.

## `private readonly _gridWidth: Binding<string> = new Binding<string>('0%');`

> 원본 L116

 격자 상자의 크기 - **정사각 판 대비 %** (`computeGridBox`)

## `private readonly _cellSide: Binding<number> = new Binding<number>(0);`

> 원본 L119

지금 판의 칸 한 변 (좌표 단위). **글자 크기와 띄우기 거리에만 쓴다** -
칸의 크기 자체는 상대 배치가 정한다 (`computeGridBox`).

## `private readonly _grabLift: Binding<number> = new Binding<number>(0);`

> 원본 L124

 집은 조각을 손가락 위로 띄우는 거리 (px) - 칸 크기 × 퍼즐이 준 배수

## `private readonly _liftEnabled: Binding<boolean> = new Binding<boolean>(false);`

> 원본 L126

 집은 조각을 띄울지 - **퍼즐이 정한다** (`PuzzleBoardLayoutSpec.liftGrabbedPiece`)

## `private readonly _boardTexture: Binding<PuzzleTextureKey> = new Binding<PuzzleTextureKey>(NO_TEXTURE);`

> 원본 L128

 판 배경 그림의 키

## `private _cellFontSize: Bindable<number> = 0;`

> 원본 L131

칸 글자 크기 - **파생 하나를 모든 칸이 나눠 쓴다.**

예전에는 칸을 만들 때마다 `_cellSide.derive(...)` 를 불러 파생 바인딩이 81개
등록되었다. 값은 전부 같으므로 하나면 된다 - 패널 데이터 모델에 등록되는 키 수가
곧 재렌더 비용이다.

**필드 초기화가 아니라 생성자에서 만든다.** `derive()` 는 파생 함수를 그 자리에서
한 번 부르는데, 필드 초기화 시점에는 `_metrics` 가 아직 대입되지 않아 그 안에서
`metrics.auxHeightUnits()` 를 타면 터진다 (패널에서 `this.props` 를 필드 초기화 때
읽어 컴포넌트가 통째로 만들어지지 않았던 것과 같은 함정이다).

## `private _grabLiftRatio: number = 0;`

> 원본 L145

 띄우기 배수 - 레벨이 올라올 때 규격에서 받는다

## `private _lastCellSide: number = 0;`

> 원본 L148

 디버그 표시가 읽는 마지막 계산값 - 화면에 그려지는 것과 대조하는 용도다

## `private readonly _rowNodeCache: (UINode | undefined)[] = new Array(PUZZLE_BOARD_MAX_ROWS);`

> 원본 L152

`DynamicList.renderItem` 이 돌려줄 노드를 자리마다 한 번만 만들어 재사용한다.

`renderItem` 은 목록 데이터가 바뀔 때마다(레벨 로드/퍼즐 전환) 다시 불리는데,
그때마다 칸 트리를 새로 만들면 공유 Binding 에서 파생한 Binding 이 판 갈이마다
새로 쌓인다. 자리·내용 Binding 은 처음부터 고정이므로 노드도 한 번 만든 것을
그대로 돌려주면 된다 - 갱신은 Binding 이 알아서 한다.

## `this._cellFontSize = this._cellSide.derive((side) => this.cellFontSize(side));`

> 원본 L167

`_metrics` 를 대입한 **뒤에** 파생을 만든다 (`_cellFontSize` 주석)

## `public applyView(`

> 원본 L171

#region Panel-facing API

## `public applyView(`

> 원본 L173

 레벨이 올라왔다 - 격자 크기와 칸 내용을 전부 다시 잡는다

## `const box = computeGridBox(grid.rowCount, grid.colCount);`

> 원본 L183

격자 상자를 **정사각형 판 대비 %** 로 앉힌다. 판이 정사각형이라 가로 %와 세로 %가
같은 길이 단위이고, 그래서 행·칸을 `flex: 1` 로 나누면 칸이 정확히 정사각형이 된다
(`PuzzleUI_RelativeLayout` 머리말 §2). 픽셀 계산이 사라진 자리다.

## `const cell = this._metrics.units(cellFraction(`

> 원본 L190

칸 한 변을 좌표 단위로도 담아 둔다 - 글자 크기와 띄우기 거리는 숫자여야 한다

## `this._grabLiftRatio = grabLiftCellRatio;`

> 원본 L194

띄우기 배수는 퍼즐이 정한다 - 환산보다 먼저 받아 둔다

