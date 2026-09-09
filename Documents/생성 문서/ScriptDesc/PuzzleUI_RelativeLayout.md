# PuzzleUI_RelativeLayout.ts — 주석 아카이브

> 원본 스크립트: `PuzzleUI_RelativeLayout.ts`
> 걷어낸 주석 22건 / 5,491 B 절감 (20,727 B → 15,236 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

### 보드 화면의 상대 배치 규격 - 픽셀을 쓰지 않는다

#### 왜 이 모듈이 따로 있는가

`PuzzleUI_Layout` 은 `player.screenWidth/screenHeight` 읽기값에서 **절대 픽셀**을 계산해
배치했다. 그런데 2026-09-03 실기 측정(`showLayoutProbe`)에서 **읽기값의 단위가 패널
좌표계와 다르다**는 것이 확인되었다.

- 패널 좌표 1 단위 = **디바이스 실픽셀 1** (프로브의 `D` 상자 100 단위가 실측 100px 로 그려졌다)
- 그런데 `screenWidth/screenHeight` 는 **긴 변을 1280 으로 정규화한** 값을 준다
  (실측 1179x2556 폰이 590x1280 으로 읽혔다)
- `panelWidth`/`panelHeight` 를 바꿔도 이 좌표계는 변하지 않는다 (1280 -> 590 으로 줄여도 그대로였다)

즉 **읽기값에서 얻을 수 있는 믿을 만한 정보는 화면 비율뿐이고, 절대 크기는 알 수 없다.**
반대로 같은 측정에서 상대 배치는 전부 정확하게 동작했다.

| 확인한 것 | 결과 |
|---|---|
| `flex: 7` / `flex: 3` | 화면 세로의 69.5% 에서 갈렸다 |
| `height:'100%'` + `aspectRatio:1` + `maxWidth:'100%'` | **정사각형**이고 영역 안에 들어왔다 (CSS 의 `min()` 과 같은 동작) |
| `width: '20%'` | 영역 폭의 정확히 1/5 |
| 행 `flex:1` + 칸 `flex:1` | 4x4 칸이 모두 같은 정사각형 |

그래서 보드 화면은 **퍼센트와 flex 로만** 짠다. 이 모듈은 그 퍼센트를 계산한다.

#### 핵심 요령 두 가지

##### 1. 정사각형은 `aspectRatio` + `maxWidth` 로 만든다

`height:'100%' + aspectRatio:1 + maxWidth:'<n>%'` 는 "세로를 꽉 채우되 가로가 모자라면
가로에 맞춘다", 즉 `min(가로, 세로)` 다. 화면이 세로로 길든 가로로 길든 분기가 필요 없다.

##### 2. 정사각형 부모 안에서는 `width:'x%'` 와 `height:'x%'` 가 같은 길이다

격자는 판마다 행·열 수가 다른데(4행 8열, 5행 6열, 9x9...), 칸은 **언제나 정사각형**이어야
한다. `aspectRatio` 는 `Bindable` 이 아니라 레벨마다 바꿀 수 없다. 그런데 부모(보드 판)가
정사각형이므로, 자식에 준 `width:'80%'` 와 `height:'80%'` 는 **물리적으로 같은 길이**가 된다.
그래서 격자 상자를

    width  = 100 * colCount / max(rowCount, colCount) %
    height = 100 * rowCount / max(rowCount, colCount) %

로 주면 (`computeGridBox`) 칸이 정확히 정사각형이 된다. 둘 다 `Bindable<DimensionValue>` 라
레벨마다 갈아 끼울 수 있다.

#### 픽셀이 남는 곳 - 글자와 테두리뿐

`fontSize`/`borderWidth`/`borderRadius` 는 `horizon/ui` 에 상대 단위가 없어 숫자여야 한다.
그 숫자만 `screenPixelRatio`(읽기값 -> 좌표계 배율, 실기 측정값 2)를 거쳐 환산한다
(`toUnits`). **배치는 이 배율을 쓰지 않는다.** 배율이 틀린 기기에서도 판은 정확히
그려지고 글자만 조금 크거나 작아진다.

## 파일 머리말

> 원본 L55

 본 격자 영역과 보조 레이아웃의 세로 비율 - 참고 구현(`Documents/SampleHtml`)과 같은 7:3

## `export const BOARD_TOP_INSET_PERCENT = 6;`

> 원본 L59

 화면 위에 비워 둘 세로 % - 상태바·노치와 호라이즌 자체 버튼(`...`/`≡`) 자리다

## `export const BOARD_BOTTOM_INSET_PERCENT = 8;`

> 원본 L61

 화면 아래에 비워 둘 세로 % - `Menu` 버튼 띠와 홈 인디케이터 자리다

## `export const BOARD_WIDTH_PERCENT = 96;`

> 원본 L63

 보드 정사각형이 쓰는 가로 % - 나머지가 좌우 여백으로 반씩 나뉜다

## `export const BOARD_HEIGHT_PERCENT = 94;`

> 원본 L65

 보드 정사각형이 본 격자 영역의 세로에서 쓰는 % - 아래 보조 레이아웃과의 틈이 나머지다

## `const MAX_TOTAL_INSET_PERCENT = 40;`

> 원본 L68

 위아래 여백의 합이 이 값을 넘으면 판이 남는 자리가 없다

## `const MAX_SINGLE_INSET_PERCENT = 25;`

> 원본 L70

 한 쪽 여백의 상한

## `export const TRAY_HEIGHT_USAGE = 0.78;`

> 원본 L73

 트레이가 보조 레이아웃 세로에서 쓰는 비율

## `export const TRAY_WIDTH_USAGE = 0.66;`

> 원본 L75

 트레이가 보조 레이아웃 가로에서 쓰는 비율 - 나머지는 리셋 버튼과 여백이다

## `export const TRAY_MAX_VISIBLE_SLOTS = 8;`

> 원본 L77

한 페이지에 이보다 많이 넣지 않는다 - 넘어가면 부품이 손가락보다 작아진다.

짝이던 `TRAY_MIN_VISIBLE_SLOTS`(적어도 셋은 보이게)는 없앴다. 들어갈 자리가 없는데도
셋을 펴다가 부품이 잘려 나간 것이 2026-09-04 의 버그였다 (`trayGrid` 머리말).
지금은 **들어가는 배치만 고르고**, 그래도 모자라면 줄을 쌓는다.

## `export const TRAY_MAX_ROWS = 3;`

> 원본 L85

트레이를 몇 줄까지 쌓을지.

줄을 늘리면 슬롯이 그만큼 작아진다 (슬롯 한 변 = 트레이 높이 / 줄 수). 세 줄이면
슬롯이 트레이 높이의 1/3 인데, 그 아래로 내려가면 부품이 손가락보다 작아진다.

## `export type PuzzleBoardRelativeRequest = {`

> 원본 L93

 에디터에서 넘어오는 요청값. 전부 생략 가능하고, 생략하면 위 기본값이 쓰인다

## `export type PuzzleBoardRelativeLayout = {`

> 원본 L101

 다듬어 확정한 상대 배치. **여기에 픽셀은 하나도 없다**

## `topInsetPercent: number,`

> 원본 L103

 화면 위/아래에 비워 두는 세로 %

## `boardFlex: number,`

> 원본 L106

 본 격자 영역 : 보조 레이아웃 = 7 : 3

## `boardWidthPercent: number,`

> 원본 L109

 보드 정사각형이 쓰는 가로 % (화면 대비) 와 세로 % (본 격자 영역 대비)

## `export type PuzzleGridBoxPercent = {`

> 원본 L114

 격자 상자의 크기 - **정사각형 부모 대비 %**. 둘 다 같은 단위라 칸이 정사각형이 된다

## `export type PuzzleScreenFraction = {`

> 원본 L120

 화면 대비 비율로 나타낸 길이. 같은 길이를 가로 기준과 세로 기준 둘로 들고 있는다

## `ofWidth: number,`

> 원본 L122

 화면 **가로** 대비 비율

## `ofHeight: number,`

> 원본 L124

 화면 **세로** 대비 비율

## `export function percentText(value: number): string {`

> 원본 L135

 스타일에 그대로 넣는 퍼센트 문자열 (`'96%'`). 소수점 두 자리까지 남긴다

