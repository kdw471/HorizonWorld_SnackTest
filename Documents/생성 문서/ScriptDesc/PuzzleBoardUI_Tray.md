# PuzzleBoardUI_Tray.ts — 주석 아카이브

> 원본 스크립트: `PuzzleBoardUI_Tray.ts`
> 걷어낸 주석 31건 / 7,255 B 절감 (29,057 B → 21,802 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Puzzle Board UI Tray - 보조 레이아웃의 **오브젝트 트레이**

판으로 끌어다 쓰는 오브젝트를 늘어놓는 곳이다 (레이저의 미배치 크리스탈). 8개 퍼즐 중
**트레이를 규격에 적은 퍼즐만** 이 화면을 갖는다 (`PuzzleBoardLayoutSpec.itemCount`).
나머지 퍼즐에서는 패널이 이 노드를 아예 마운트하지 않는다
(`PuzzleBoardUIPanel.createAuxContent()` 의 `UINode.if`).

#### 왜 별도 파일인가

트레이는 자기만의 상태를 꽤 들고 있다 - 슬롯 8칸의 내용, 누름 표시, 페이지 계산,
슬롯 크기. 이것이 패널에 섞여 있으면 "터치만 하는 퍼즐" 을 읽는 사람도 트레이의 페이지
계산을 지나쳐 가야 한다. 여기서는 트레이가 자기 Binding 을 소유하고, 패널에는
**작은 창구 몇 개**(`applyView` / `applyItem` / `setPressed`)만 노출한다.

#### 격자와 달리 누를 수 있다

슬롯에서 시작한 드래그는 그대로 격자 칸의 `onEnter` 로 이어지므로, 세션은 트레이에서
집었는지 판에서 집었는지 신경 쓸 필요가 없다.

## `const TRAY_HEIGHT_PERCENT = percentText(TRAY_HEIGHT_USAGE * 100);`

> 원본 L58

#region Style constants

## `const TRAY_HEIGHT_PERCENT = percentText(TRAY_HEIGHT_USAGE * 100);`

> 원본 L60

트레이 상자가 보조 레이아웃 높이에서 차지하는 몫.

**계산과 같은 값을 써야 한다.** `trayGrid()` 는 이 높이를 기준으로 슬롯 크기를 정하는데,
화면이 그보다 크게 그리면 슬롯이 계산보다 커져 가로로 넘친다. 그래서 상수를 따로 두지
않고 배치 규격(`TRAY_HEIGHT_USAGE`)을 그대로 가져다 쓴다.

## `const ITEM_SLOT_GAP_PERCENT = 5;`

> 원본 L68

 트레이 슬롯 사이 간격 (슬롯 대비 %). 칸과 같은 이유로 padding 이다

## `const TRAY_ARROW_HEIGHT_PERCENT = 80;`

> 원본 L70

 페이지 넘김 화살표의 높이 (트레이 대비 %)

## `const TRAY_ARROW_WIDTH_USAGE = 0.42;`

> 원본 L72

 화살표 폭 - 슬롯 한 변 대비. 슬롯보다 확실히 좁아야 슬롯 자리를 뺏지 않는다

## `const TRAY_ARROW_DISABLED_OPACITY = 0.35;`

> 원본 L76

 더 넘어갈 곳이 없을 때 화살표의 진하기

## `const COLOR_DEBUG_FRAME = new Color(1, 0.2, 0.8);`

> 원본 L79

진단 표시(`showTrayDebug`)의 색과 두께.

**슬롯 얼굴이 아니라 형제 층에 그린다.** 얼굴은 내용이 안 보일 때 `opacity: 0` 이 되므로
(`getAccentOpacity`), 그 안에 그린 진단 표시는 정작 확인하고 싶은 경우에 같이 사라진다.
형제로 두면 **내용이 비어 있어도 슬롯 상자는 보인다** - 그것이 "칸은 있는데 내용이
없다(생성 안 됨)" 와 "칸 자체가 접혔다(숨겨짐)" 를 가르는 표시다.

## `const DEBUG_BADGE_RATIO = 0.3;`

> 원본 L89

 진단 배지의 글자 - 슬롯 번호와 상태를 한 글자씩 적는다

## `export type BoardTrayHandlers = {`

> 원본 L92

#endregion

## `export type BoardTrayHandlers = {`

> 원본 L94

트레이가 패널에 되돌려 주는 입력.

**뗌이 둘로 갈리는 것에 주의한다.** 슬롯에서 뗀 것은 "판 밖" 으로 단정하지 않는다 -
슬롯에서 집어 판으로 끌고 간 뒤 칸 위에서 뗐는데 그 뗌이 슬롯으로 올라오는 경우가 있어서,
여기서 밖으로 단정하면 **칸 위에서 뗐는데 부품이 인벤토리로 돌아간다.** 반면 화살표
위에서 뗀 것은 판 밖이 확실하므로 그대로 확정한다 (리셋 버튼과 같은 처리다).

## `onSlotRelease(): void,`

> 원본 L104

 슬롯에서 뗐다 - 마감만 한다 (판 밖으로 단정하지 않는다)

## `onArrowRelease(): void,`

> 원본 L106

 화살표에서 뗐다 - 여기는 판 밖이 확실하다

## `export class BoardTrayRenderer {`

> 원본 L110

오브젝트 트레이 한 벌. 패널이 하나 만들어 두고 `createNode()` 로 트리에 끼운다.

슬롯 노드와 내용 `Binding` 은 **절대 슬롯 번호로 고정**되어 있다. 그래서 페이지를
넘기는 일은 어느 슬롯을 펴고 접을지(`_slotShown`)를 다시 정하는 것이 전부다.

## `private readonly _itemBindings: Binding<PuzzleBoardItemView>[] =`

> 원본 L120

 슬롯 내용 - 자리마다 하나. 목록 길이가 바뀌어도 이 배열은 그대로다

## `private readonly _pressedFlags: Binding<boolean>[] =`

> 원본 L123

 지금 짚고 있는 슬롯 - 칸과 같은 이유로 자리마다 나눠 둔다

## `private readonly _slotShown: Binding<boolean>[] =`

> 원본 L127

그 슬롯이 **지금 페이지에 들어 있는지**.

#### 왜 `DynamicList` 가 아닌가

트레이 슬롯은 "트레이 높이를 꽉 채우는 정사각형"(`height:'100%'` + `aspectRatio:1`)이다.
그런데 `DynamicList` 안에서는 그 `height:'100%'` 가 잡히지 않아 **슬롯이 높이 0 으로
그려졌다** - 화면에 아무것도 보이지 않고, 크기가 0 이니 눌리지도 않았다. 좌우 화살표는
목록 밖(트레이 View 의 직속 자식)이라 멀쩡히 보였고, 그래서 "페이지는 넘어가는데
오브젝트가 없다" 로 나타났다. 본 격자의 칸이 무사한 이유는 칸이 퍼센트가 아니라
`flex: 1` 로 자리를 잡기 때문이다.

슬롯은 최대 8개뿐이라 목록으로 아낄 트리 크기(64kB 한도)가 크지 않다. 그래서 화살표와
**똑같은 자리**(트레이 View 의 직속 자식)에 8개를 그대로 두고, 지금 페이지에 없는
슬롯만 `display: none` 으로 접는다.

## `private readonly _slotSide: Binding<number> = new Binding<number>(0);`

> 원본 L146

슬롯 한 변 (좌표 단위) - **글자 크기를 뽑는 데만 쓴다.**

슬롯의 크기 자체는 상대 배치가 정한다. 그런데 `fontSize` 는 숫자여야 하므로,
그 정사각형이 화면의 몇 % 인지를 좌표 단위로 환산해 여기에 담아 둔다
(`trayGrid().slot`).

## `private readonly _slotHeight: Binding<string> = new Binding<string>('100%');`

> 원본 L155

슬롯 한 칸의 높이 - **트레이 높이를 줄 수로 나눈 %** 다 (`trayGrid`).

폭은 `aspectRatio: 1` 이 여기서 따라오므로, 이 한 값이 슬롯 크기를 통째로 정한다.
줄 수는 부품 수와 화면 비율이 정하므로 런타임에 바뀐다 - 그래서 `Binding` 이다.

## `private readonly _hasPaging: Binding<boolean> = new Binding<boolean>(false);`

> 원본 L163

 넘길 것이 있을 때만 화살표를 그린다

## `private _page: number = 0;`

> 원본 L168

 Binding 은 되읽을 수 없으므로 페이지 상태는 평범한 필드로도 들고 있는다

## `private _rows: number = 0;`

> 원본 L173

 지금 격자의 줄·칸 수 (`trayGrid`) - 진단 줄이 되읽는다

## `private readonly _slotNodeCache: (UINode | undefined)[] = new Array(PUZZLE_BOARD_MAX_ITEMS);`

> 원본 L178

 슬롯 노드도 자리마다 한 번만 만들어 재사용한다 (`BoardGridRenderer` 와 같은 이유)

## `private readonly _isDebug: boolean;`

> 원본 L181

#region Diagnostics (`showTrayDebug`)

## `private readonly _isDebug: boolean;`

> 원본 L183

진단 모드인지 - 패널 prop `showTrayDebug` 를 그대로 받는다.

꺼져 있으면 진단 노드를 **트리에 올리지도 않는다.** 트레이는 슬롯 8벌이라
층을 하나 더 얹으면 노드가 8개 늘어난다 - 평소에 낼 비용이 아니다.

## `private _itemCount: number = 0;`

> 원본 L191

진단이 읽는 **평범한 필드들**. `Binding` 은 되읽을 수 없으므로 따로 들고 있는다.

이 값들이 "크리스탈이 안 보인다" 의 원인을 가른다.
  `_itemCount` 0        - 퍼즐이 트레이를 선언하지 않았거나 프레젠터가 빈 배열을 넘겼다
  `_slotVisible` 전부 false - 슬롯 상자는 있는데 CoreAPI 가 내용을 채우지 않았다
  `_slotShownFlags` false  - 내용은 있는데 페이지에서 접혀 있다 (숨겨진 경우)

## `constructor(metrics: BoardMetrics, handlers: BoardTrayHandlers, isDebug: boolean = false) {`

> 원본 L204

#endregion

## `public applyView(items: PuzzleBoardItemView[]): void {`

> 원본 L212

#region Panel-facing API

## `public applyView(items: PuzzleBoardItemView[]): void {`

> 원본 L214

 레벨이 올라왔다 - 슬롯 내용을 채우고 페이지를 처음으로 되돌린다

## `this._itemCount = items.length;`

> 원본 L216

**실제 슬롯 수만큼만 채운다** - 남는 자리는 접혀 있어 값이 낡아도 그려지지 않는다

## `public applyItem(index: number, item: PuzzleBoardItemView): void {`

> 원본 L233

슬롯 하나가 바뀌었다.

부품을 판에 내려놓으면 그 슬롯이 비므로 **격자를 다시 잡는다** - 남은 부품이 적어질수록
슬롯이 커진다. 내용만 바뀐 경우(집는 중의 실루엣 등)에는 다시 잡지 않는다.

