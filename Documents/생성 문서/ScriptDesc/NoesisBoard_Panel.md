# NoesisBoard_Panel — 퍼즐 보드를 Noesis UI 로 그리는 표현 계층

> 원본: `NoesisBoard_Panel.ts` (클래스 `NoesisBoardPanel`)
> XAML: `Documents/NoesisSample/NoesisBoard/PuzzleBoard.xaml`
> (생성기 `Documents/Tools/build_noesis_board_xaml.js` — XAML 은 직접 고치지 않는다)
> 관련: `PuzzleBoardUI_Panel.md` (같은 역할의 Custom UI 판), `PuzzleBoardUI_Presenter.md` (둘이 같이 구독하는 계약),
> `NoesisProbe_Panel.md` (이 설계의 근거가 된 0단계 확인)

## 무엇인가

`PuzzleBoardUI_Panel` 의 후계다. **퍼즐 쪽은 아무것도 바뀌지 않는다** — 이 패널은 Custom UI 판과 똑같이
`PuzzleBoardStage` 에 마운트된 `PuzzleBoardPresenter` 를 구독하고 같은 입력 메서드를 부른다. 8개 퍼즐의
`*_CoreAPI` 는 어느 패널이 그리고 있는지 모르므로, **에디터에서 어느 gizmo 를 켜느냐**로 두 판을 오갈 수 있다.

```
*_CoreAPI ──mount()──▶ PuzzleBoardStage ──MOUNTED──▶ NoesisBoardPanel ──dataContext──▶ PuzzleBoard.xaml
    ▲                                                        │
    └────── pointerDown / Enter / Exit / Up · itemDown · requestReset / Action ◀── Command
```

## Noesis 전면 전환에서의 위치 (1단계)

| 단계 | 내용 | 상태 |
|---|---|---|
| 0 | 미확인 항목 검증 (`NoesisProbe_Panel`) | 끝 |
| 1 | 이 패널 — 프레젠터 계약 그대로 Noesis 로 그린다. 8개 퍼즐이 칸 단위 입력으로 동작 | 레이저 확인 |
| **2** | **조각 계층 — 포인터 좌표로 스크립트가 끄는 조각 + 러시아워** (아래 "조각 계층") | **구현, 실기 확인 대기** |
| 3 | 레이저·정렬 — 자유 드래그 조각, 트레이→보드, 그림 틴트·회전·색 띠 | |
| 4 | 연결(Flow) — 칸 Enter 이벤트가 터치에서 오는 것이 확인돼 칸 단위 그대로 간다. 다듬기만 | |
| 5 | `PuzzleUI_MainPanel` 전환, Custom UI 판·Focused Interaction 스트림 삭제 | |

### 0단계 결과가 정한 것

| 결과 | 이 패널에서 |
|---|---|
| 속성만 바꿔도 화면이 따라온다. getter 는 우리가 대입한 객체를 그대로 돌려준다 | `dataContext` 는 시작할 때 한 번만 대입하고, 이후에는 **바뀐 속성만** 그 객체에 쓴다 (`assign()`) |
| 첫 대입 때 없던 키는 바인딩되지 않는다 | 칸 81 · 미니 격자 9 · 트레이 8 자리를 처음부터 만들고, 안 쓰는 자리는 `Size` 0 |
| `'#RRGGBB'` → 색, `ImageSource` → 그림(null → 그림 전환 포함), `'Visible'/'Collapsed'` 통과 | 프레젠터의 임의 RGB·텍스처 키를 그대로 쓴다. `PuzzleTextureLibrary` 도 그대로 |
| 누른 채 옆 칸으로 밀면 터치 Enter 가 온다 | 드래그 퍼즐도 조각 계층 없이 **칸 단위로는 지금 동작한다** |
| Viewbox 안에서 끌기·좌표 환산이 맞다 | 배치를 전부 XAML 에 맡겼다 — 스크립트는 픽셀을 모른다 |
| **배열 항목의 X/Y TwoWay 는 모바일에서 놓은 자리가 돌아오지 않는다** | 2단계의 조각은 낱개 키(`P1X`…) 고정 자리로 찍는다 |
| **Noesis 는 Custom UI 위에 그려지고 입력도 가져간다** | 아래 "한 번에 하나만" |

### 한 번에 하나만 그린다

기존 규약이 이미 그렇다 — 일시정지·결과·중단에서 CoreAPI 가 보드를 `unmount()` 한다 (gizmo 끼리 z-order 를
코드로 정할 수 없어서). 이 패널은 보드가 내려가면 `setLocalEntityVisibility(false)` 로 **자신을 치워**
허브(`PuzzleUI_MainPanel`)에 화면과 입력을 돌려주고, 다시 올라오면 켠다. 인게임 중 허브의 상단 바가 가려지는
것도 Custom UI 판과 같다 (그래서 `Menu` 버튼이 보드 쪽에 있다).

## 화면

`PuzzleBoardUI_Panel` 과 같은 규격 — 위 여백 6% / 보드 7 : 보조 3 / 아래 여백 8%.

| 영역 | 내용 |
|---|---|
| 위 여백 | 제목 (`showTitle` 을 켰을 때만) |
| 보드 | 가로 96% · 영역 세로 94% 안의 정사각형 Viewbox, 안쪽은 **900×900 설계 좌표**. 판 그림(`boardTexture`) 위에 칸 |
| 보조 레이아웃 | 트레이 **또는** 액션 버튼(누르는 순간 반응, `ClickMode=Press`) · 미니 격자 · `Reset`. 시작 배너가 떠 있는 동안은 배너가 이 자리를 차지한다 |
| 아래 여백 | `Menu` → `PuzzleBoardStage.requestPause()` |

칸은 `WrapPanel` 에 **칸 번호 순서대로** 들어가고, 폭을 `열 수 × 칸 크기` 로 주면 저절로 줄이 바뀐다.
Custom UI 판의 "슬롯 번호(고정 9열) ↔ 칸 번호" 환산이 없다. 칸은 언제나 정사각형이고 긴 쪽이 판을 채운다.

칸 하나 = 입력을 받는 투명한 상자(간격 포함 — 이웃과 맞닿아 죽은 영역이 없다) + 그 안의 얼굴.
얼굴은 색 → 그림 → 글자(그림이 있으면 물러난다) → 부품 무늬 → 강조 테두리 순으로 겹친다. 집은 칸의
확대(1.1배)·실루엣의 축소(0.86배)는 변환이 아니라 **얼굴의 여백**으로 내므로 입력 영역은 움직이지 않는다.

## 조각 계층 (2단계)

드래그 퍼즐의 말은 칸에 칠하지 않고 **격자 위를 연속으로 움직이는 조각**(`PuzzleBoardPieceView`, 규격의
`pieceCount`)으로 그린다. MoveLab 에서 "스크립트가 좌표를 받아 끌어도 네이티브만큼 부드럽다" 가 확인돼 이 방식으로 갔다.

```
루트 PreviewTouchDown / PreviewMouseLeftButtonDown (인자째)
  ─▶ 패널: 루트 px → 보드 px → 900 설계 좌표 → 격자 좌표(실수)  ─▶ 조각 맞히기(hitPiece)
  ─▶ presenter.pieceGrab(slot, row, col) ─▶ CoreAPI onPieceGrab ─▶ session.beginDrag + rebaseDragOrigin
루트 Move ─▶ presenter.pieceDrag(row, col) ─▶ CoreAPI: session.updateDrag(잘라낸 연속 좌표) ─▶ setPiece(row, col) ─▶ 패널이 그 자리에 바로 놓는다
루트 Up   ─▶ presenter.pieceDrop(row, col) ─▶ CoreAPI: finalizeDrag(스냅·결합) ─▶ setPiece(확정 자리) ─▶ 패널이 90ms 미끄러뜨린다
```

- **위치는 언제나 퍼즐 쪽이 정한다.** 축 고정·막힘·결합(`RushHour_DragController`)이 그대로 쓰이므로 규칙이
  두 벌이 되지 않는다. 패널은 좌표를 바꾸고 조각을 그릴 뿐이다.
- 조각은 낱개 키(`P1X` … `P20EdgeWidth`, 20자리 = `PUZZLE_BOARD_MAX_PIECES`)다. 배열 항목은 Canvas 자리 지정이
  컨테이너에 닿지 않고, 모바일 TwoWay 문제도 있었다. 조각은 입력을 받지 않는 그림이고 루트가 좌표로 판정한다.
- 보드가 루트의 어디에 몇 px 로 그려지는지는 XAML 의 star 값과 `PuzzleUI_RelativeLayout` 의 비율에서 계산한다
  (`layoutBoardRect`). Probe T5 에서 이 환산이 맞는 것이 확인됐다.
- 끌고 있는 조각은 이동마다 그 자리에 바로 놓고, 놓은 뒤·다른 조각의 이동은 90ms 미끄러진다 (`tweenPiece`).
- 조각 밑 칸의 자기 Down 은 같은 누름이므로 무시한다 (Preview 로 루트가 먼저 받는다). 터치·승격 마우스 중
  먼저 잡은 쪽이 그 드래그를 몬다.

러시아워는 `pieceLayer` prop(기본 켬)으로 이 경로를 탄다 - `onCellDown/Move/Up` 대신 `onPieceGrab/Drag/Drop` 을
등록하고, `applyGridVisuals()` 는 바탕·길·도착 포인트·실루엣만 칠하며 말은 `applyPieceVisuals()` 가 조각으로 쓴다.
Focused Interaction 스트림은 뗌 안전망으로만 남는다. **Custom UI 판을 쓸 때는 `pieceLayer` 를 끈다** (그 판은
조각을 그리지 않는다).

## 입력

| XAML | 스크립트 | 프레젠터 |
|---|---|---|
| 칸 `MouseLeftButtonDown` / `TouchDown` | `onCellDown` (80ms 안의 같은 칸 중복은 버린다) | `pointerDown(cell)` |
| 칸 `MouseEnter` / `TouchEnter` | `onCellEnter` | `pointerEnter(cell)` |
| 칸 `MouseLeave` / `TouchLeave` | `onCellLeave` | `pointerExit(cell)` |
| 루트 `PreviewMouseLeftButtonDown` / `PreviewTouchDown` (인자째) | `onPointerDown` | 조각을 맞히면 `pieceGrab(slot, row, col)`. 아니면 아무것도 안 한다 (칸의 자기 Down 이 뒤따른다) |
| 루트 `MouseMove` / `TouchMove` (인자째) | `onPointerMove` | `pieceDrag(row, col)` — 조각 드래그 중일 때만 |
| 루트 `MouseLeftButtonUp` / `TouchUp` (인자째) | `onPointerUp` | 조각 드래그 중이면 **마지막으로 받아들인 Move 의 좌표**로 `pieceDrop(row, col)`, 아니면 `pointerUp()` — 여러 번 와도 한 번만 일한다. Up 인자의 좌표는 읽지 않는다 (아래 "Up 의 좌표") |
| 보조 영역 `MouseEnter` / `TouchEnter` | `onAuxAreaEnter` | `pointerLeaveBoard()` — 누른 채 보조 영역에 들어오면 판을 벗어난 것. 여기서 떼면 판 밖에 놓은 것이 된다 |
| 트레이 슬롯 `…Down` | `onItemDown` | `itemDown(item)` |
| `Reset` / 액션 / `Menu` | | `requestReset()` / `requestAction()` / `requestPause()` |

**뗌 이벤트가 어느 요소에서 올라왔는지는 보지 않는다.** 터치의 뗌은 손가락 밑의 요소가 아니라 **터치가 시작된
요소**에서 올라올 수 있다. 처음에는 Custom UI 판을 그대로 본떠 "보조 영역에서 올라온 뗌 = 판 밖에 놓았다" 로
읽었는데, 트레이에서 집은 부품은 어디에 놓든 뗌이 트레이(보조 영역)에서 올라와 **매번 인벤토리로 되돌아갔다**
(2026-09-21 레이저 실기). 손가락이 어디 있는지는 Enter / Leave 로만 좇고, 놓을 칸은 프레젠터가 그 기록
(`_hoverCell` / `_lastInsideCell`)에서 정한다.

### Up 의 좌표 — 조각 드래그도 같은 이유로 마지막 Move 에 놓는다

조각 계층은 처음에 Up 인자(`PassEventArgsToCommand`)의 좌표로 놓을 자리를 정했는데, 모바일 실기(2026-09-23)에서
**격자 안에서 손가락을 떼면 조각이 원래 자리로 돌아갔다** (PC 는 정상). 결정적인 관찰이 둘 있었다 — **격자 밖에서
떼면** 마지막 자리에 놓였고, 끌던 손가락을 그대로 둔 채 **다른 손가락으로 화면을 건드려도** 지금 자리에 놓였다.
후자의 경로는 Focused Interaction 의 뗌 안전망(`onStreamRelease` → `pointerUp` → `onPieceCancel`)이라 좌표를 새로
넣지 않고 컨트롤러가 마지막 Move 까지 반영해 둔 값으로 바로 확정한다. 즉 컨트롤러의 값은 뗄 때까지 맞고, 정상 뗌이
놓는 순간 한 번 더 넣던 좌표 — **격자 안의 칸 위에서 올라온 Up 인자의 좌표가 Move 와 다른 기준**이었다. 그 값을
넣으면 잡은 지점 대비 delta 가 크게 어긋나 이동 범위의 끝으로 잘리고, 러시아워는 대개 한쪽이 막혀 있어 그 끝이 곧
원래 자리다. "마지막 Move 에서 한 칸 안이면 채택" 으로는 부족했다 — Up 좌표가 누른 지점으로 오면 한 칸 드래그는
그 검사를 통과한다.

지금은 **정상 뗌도 안전망과 같은 경로**다. 패널은 Up 인자의 좌표를 읽지 않고 마지막으로 받아들인 Move 의 격자
좌표를 넘기며, `RushHourCoreAPI.onPieceDrop` 은 그 좌표를 다시 넣지 않고(`onPieceCancel` 과 같이) 확정만 한다.
다른 기준으로 온 Move 는 `onPointerMove` 의 튐 검사가 거른다 — 루트 밖의 px 좌표이거나 직전 Move 에서 한 이벤트
만에 `MOVE_MAX_JUMP_CELLS`(3칸)보다 멀리 뛴 좌표는 버리고 직전 자리를 유지한다. 실기에서 검증된 `NoesisMoveLab` 도
Up 의 좌표를 읽지 않는다.

### 트레이의 줄 수

트레이 슬롯은 `PuzzleUI_RelativeLayout.trayGrid()` 와 같은 규칙으로 줄 수를 고른다 — 줄 수(최대 3)마다
슬롯 한 변 = min(높이 / 줄 수, 폭 / 칸 수) 를 재서 가장 큰 쪽. XAML 은 `TrayWidth` 에서 줄을 바꾸고 Viewbox 가
결과를 자리에 맞춘다. 처음에는 한 줄로만 늘어놓았는데, 세로로 긴 화면에서는 폭이 먼저 모자라 슬롯이 화면 폭의
9.8% 로 줄었다 (레이저 5칸). 지금은 3칸 × 2줄이 되어 17.8% 다. 미니 격자가 없는 퍼즐은 그 열까지 트레이가 쓴다.
화면 비는 루트 크기(`OnRootWidth` / `OnRootHeight`)에서 뽑고, 아직 모르면 세로로 긴 휴대폰(0.46)으로 가정한다.

터치 한 번이 `TouchDown` 과 승격된 `MouseLeftButtonDown` 으로 두 번 올 수 있다. 두 번째를 넘기면 프레젠터가
"앞 누름의 뗌이 유실됐다" 로 읽고, 누르는 순간 반응하는 퍼즐(카드 맞추기)이 같은 칸을 두 번 뒤집는다.

## 에디터에 붙이는 법

1. `Documents/NoesisSample/NoesisBoard/` 를 Noesis 에셋으로 임포트하고, NoesisUI gizmo 의 Root XAML 을
   `PuzzleBoard.xaml` 로 둔다. Display Mode = Screen Overlay, 입력 = Interactive, blocking.
2. `NoesisBoard_Panel` 을 붙이고 실행 모드를 **Local** 로 둔다. **`Puzzle_LocalOwnership` 의 `targets` 에 이 gizmo 를 넣는다.**
3. **Custom UI 보드 gizmo(`PuzzleBoardUI_Panel`)는 끈다** (targets 에서도 뺀다). 둘 다 켜 두면 둘 다 그린다.
   `PuzzleUI_MainPanel` 은 그대로 둔다.
4. 러시아워는 `RushHour_CoreAPI` 의 **`pieceLayer` 를 켠 채**(기본) 둔다 - 조각 계층으로 끈다. 아직 조각 계층이 없는
   드래그 퍼즐(레이저·정렬·연결)은 `*_CoreAPI` 에서 **`continuousDrag` 를 끈다.** Focused Interaction 스트림은
   Custom UI 판이 알려 주는 화면 기하를 쓰므로 이 패널과는 맞지 않는다 (5단계에서 지운다).
5. XAML 을 바꿨으면 에셋을 **다시 임포트**한다 - 이번(2단계)에 루트 포인터 트리거와 조각 자리 20개가 들어갔다.

| prop | 기본 | 뜻 |
|---|---|---|
| `showTitle` | false | 보드 제목을 위 여백에 그릴지 |
| `introSeconds` / `introFadeSeconds` | 0.45 / 0.3 | 시작 배너가 완전히 보이는 시간 / 잦아드는 시간 (Custom UI 판과 같다) |
| `hideWhenEmpty` | true | 보드가 없을 때 gizmo 를 치울지. 끄면 빈 배경이 허브를 가린다 — 진단용 |
| `logToConsole` | false | mount / unmount 를 콘솔에 남긴다 |

## 확인할 것

| # | 확인 | 안 되면 |
|---|---|---|
| 1 | 메인 메뉴(Custom UI)가 평소처럼 보이고 눌린다 — **이 패널이 자신을 치웠다** | `setLocalEntityVisibility(false)` 가 입력을 놓아주지 않는 것. 콘솔 오류와 함께 알려 주면 다른 방법(엔티티 visible, 입력 모드)으로 바꾼다 |
| 2 | 퍼즐을 시작하면 보드가 뜬다. 칸이 정사각형이고 판이 가운데 정사각형으로 꽉 찬다 | 칸이 한 줄로 늘어서거나 겹치면 `WrapPanel`/`Size` 바인딩 문제 — 스크린샷 |
| 3 | 색·글자·그림·강조 테두리가 Custom UI 판과 같게 보인다 | `[NOESIS] Binding failed` 문구 (특히 `EdgeWidth`·`FaceMargin`·`Glyph` — 문자열 → Thickness 변환은 이번이 처음이다) |
| 4 | **카드 맞추기·슬라이드**: 한 번 누르면 한 번만 반응한다 | 두 번 뒤집히면 중복 거르기 창(80ms)을 넓힌다 |
| 5 | **스위치**: 미니 격자가 보이고, 캡을 누른 채 벗어나면 취소된다 | |
| 6 | **색 채우기**: `STOP` 이 누르는 순간 반응한다 | 뗄 때 반응하면 `ClickMode=Press` 미지원 — 버튼을 칸처럼 `…Down` 트리거로 바꾼다 |
| 7 | `Menu` → 일시정지 화면이 **보이고 눌리고**, Resume 하면 보드가 돌아온다 | 1번과 같은 원인 |
| 8 | 드래그 퍼즐이 칸 단위로라도 풀린다 (`continuousDrag` 끈 상태) | 2단계 전까지의 임시 동작이다. 막히는 퍼즐만 알려 주면 된다 |
| 9 | 시작 배너가 떴다가 잦아들고 보조 레이아웃이 나타난다 | |
| 10 | **러시아워**: 말이 칸 위에 조각으로 뜨고, 집으면 노란 테두리, **손가락에 붙어 연속으로** 따라온다 | 조각이 안 보이면 XAML 재임포트 여부. 집히지 않으면 좌표 환산 - 누른 자리와 조각 자리가 얼마나 어긋나는지 |
| 11 | **러시아워**: 막힌 방향으로 끌면 **끄는 동안** 다른 말 앞에서 멈추고, 놓으면 칸에 미끄러져 들어간다 | |
| 12 | **러시아워**: USB 를 포트까지 밀면 반 칸 들어가 꽂히고 클리어된다. 부드러움이 MoveLab 과 같다 | |

## 아직 옮기지 않은 것

- 조각 계층을 **레이저·정렬**에 붙이기 (3단계) - 트레이에서 판으로 끌어오는 조각, 자유 이동 조각.
- **그림 틴트(`tint`)** — Noesis `Image` 에는 multiply 틴트가 없다. 3단계에서 대안을 정한다 (색별 그림, 또는 마스크).
- **방향 부품의 그림 회전, 색 띠(`stripes`), 집은 조각 띄우기(`liftGrabbedPiece`)** — 레이저 전용, 3단계.
- 트레이 페이지 넘김(화살표) — 8칸까지는 3줄 안에 다 들어가므로 넘길 일이 없다. 레이저 인벤토리는 최대 5칸이다.
- 누름 강조 규칙은 아직 `PuzzleBoardUI_Parts` 의 순수 함수를 빌려 쓴다. 5단계에서 `PuzzleBoardUI_Definitions` 로 옮긴다.

## 검증한 것과 못 한 것

- **검증함 (Horizon 밖, 실제 `PuzzleBoardPresenter` + 스텁)**: XAML 의 모든 바인딩 키가 첫 대입에 있다(40개) /
  4×5 보드가 20칸·4줄로 접힌다 / 미니 격자·트레이·액션·제목 / 터치+승격 마우스 중복 누름 1회 처리 /
  누른 채 옆 칸 → 뗌 (`down7 move8 up8`) / 트레이에서 집어 보조 영역에 떨어뜨림 (`item1 … up-1`) /
  칸 하나 변경은 그 칸만 / 배너 → 페이드 → `endIntro` / unmount 에서 gizmo 숨김.
- **검증함 (조각 계층, 실제 `RushHourCoreAPI` + 스텁)**: 판 `8000202001` 로드 → 조각 6개가 자리에, 칸에는 말이 안 칠해짐 / 터치+승격 마우스 Down 1회 처리 / USB 를 +4칸 끌어도 +1(막힘)에서 멈추고 축이 고정됨 / 놓으면 보드가 +1 로 스냅 / 솔버의 6수를 포인터 이벤트로 재생 → 결합 → 클리어 → unmount → gizmo 숨김.
- **못 함 (실기)**: 조각 계층 전부 (좌표 환산의 실제 정확도, Preview 이벤트 순서, 조각 트윈), 숨긴 gizmo 가 입력을 놓아주는가, 문자열 → `Thickness`, `WrapPanel` 줄바꿈, `ClickMode=Press`,
  81칸 첫 대입·레벨 로드 비용.
