# NoesisRushHour_Panel — Noesis UI 퍼즐 보드판 + 러시아워 한 판 (테스트 전용)

> 원본: `NoesisRushHour_Panel.ts` (클래스 `NoesisRushHourPanel`)
> XAML: `Documents/NoesisSample/NoesisRushHour/RushHourBoard.xaml`
> (생성기 `Documents/Tools/build_noesis_rushhour_xaml.js` — XAML 은 직접 고치지 않는다)
> 관련: `NoesisDragLab_Panel.md` (이 방식의 근거가 된 실험), `PuzzleBoardUI_Panel.md` (같은 화면 규격의 Custom UI 판)

## 목적

`NoesisDragLab` 의 **B 방식**(Noesis 가 네이티브로 끌고, 놓을 때만 스크립트가 스냅)이 실기에서
동작했다. 이 패널은 그 방식을 **기존 퍼즐 보드판과 같은 화면 규격**에 올리고, 그 위에서 러시아워
한 판을 끝까지 풀 수 있게 한 것이다. Custom UI 판과 나란히 놓고 전환 여부를 판단하는 데 쓴다.

퍼즐 규칙은 새로 짜지 않았다. `RushHour_Board`(이동·막힘·결합·클리어)와
`RushHour_DataTables`(기획 CSV 53판)를 그대로 쓰고, 비율 상수는 `PuzzleUI_RelativeLayout` 에서
가져온다. **새로 쓴 것은 뷰 계층뿐이다.**

## 화면 규격

`PuzzleBoardUI_Panel` 과 같다 — 위 여백 6% / 보드 7 : 보조 3 / 아래 여백 8%, 보드는 가로 96%·
보드 영역 세로 94% 안에 들어가는 정사각형.

| 영역 | 누가 배치하나 | 내용 |
|---|---|---|
| 위 여백 | XAML star 행 | 제목(`Rush Hour D2 #001`), 이동 수 |
| 보드 | **스크립트 (루트 px)** | 7×7 격자, 도착 포인트, 조각, 입력 잠금 겸 배너 |
| 보조 레이아웃 | XAML star 행 | 안내 글, `Reset` |
| 아래 여백 | XAML star 행 | 진단 글(테스트용), `Menu` |

### 왜 보드만 스크립트가 배치하는가

`MouseDragElementBehavior` 의 X/Y 는 **루트 기준 px** 이다. NoesisGUI 소스
(`Noesis/Managed` 의 `MouseDragElementBehavior.cs`)에서 확인했다 — 끌 때는 요소 로컬 좌표의
이동량을 `TranslateTransform` 에 더하고, 끝나면 `TransformToAncestor(root)` 로 X/Y 를 적으며,
밖에서 X/Y 를 넣으면 `PointFromScreen` 으로 그 자리에 옮긴다.

놓인 X/Y 를 칸으로 바꾸려면 보드가 루트의 어디에 몇 px 로 그려졌는지 스크립트가 알아야 한다.
보드를 XAML 레이아웃(Viewbox 등)에 맡기면 그 값을 돌려받을 길이 없다. 그래서 거꾸로 했다.

1. XAML 이 루트의 `ActualWidth` / `ActualHeight` 를 `CommandParameter` 로 스크립트에 알린다
   (`OnRootWidth` / `OnRootHeight`). `Loaded` · `SizeChanged` · 화면을 누를 때 보낸다.
2. 스크립트가 `PuzzleUI_RelativeLayout` 의 비율로 보드 정사각형·칸·조각의 px 를 계산해 바인딩으로
   넘긴다. **격자와 조각이 같은 숫자를 쓰므로 어긋날 수 없다.**

시작 배너가 `TAP TO START` 인 것도 이 때문이다. dataContext 가 `Loaded` 보다 늦게 들어가면 그
보고를 놓치는데, 화면을 누르는 순간 같은 트리거가 크기를 다시 보내므로 **플레이 전에는 반드시
크기를 안다.**

## 조각이 움직이는 방식

- 조각마다 **자기 줄 전체를 덮는 트랙**(Canvas)이 부모이고 `ConstrainToParentBounds="True"` 다.
  가로 조각은 자기 행, 세로 조각은 자기 열, 1×1 은 보드 전체. **축 고정과 보드 밖 이탈 방지는
  Noesis 가 네이티브로 한다.**
- **끄는 동안 스크립트는 한 번도 돌지 않는다.** 놓으면 `OnP{n}Up` 하나가 오고, 스크립트가 TwoWay 로
  돌아온 X/Y 를 칸 좌표(실수)로 바꿔 `RushHourBoard.snapFromContinuous()` 에 넘긴다.
- **다른 조각에 막히는 것은 놓는 순간에 반영된다.** 끄는 동안에는 다른 조각 위를 지나갈 수 있고,
  놓으면 막히기 직전 칸으로 돌아간다. 트랙을 "지금 갈 수 있는 구간"만큼만 잡으면 네이티브로 막을 수
  있지만, 트랙의 위치가 바뀌면 그 안의 조각이 같이 밀린 뒤에 X/Y 재대입으로 되돌아오는 한두 프레임의
  튐이 생겨서 쓰지 않았다. 전환을 결정한다면 이 부분이 남은 과제다.
- 목표 USB 가 도착 포인트에 밀착하면 결합(dock)을 확정하고(`RushHour_DragController.end()` 와 같은
  규칙), 슬롯 쪽으로 반 칸 들어간 자리에 그린다. 모든 목표가 결합되면 `CLEAR!` 배너가 뜨고 입력이 잠긴다.

### X/Y 를 두 번 넣는 이유

X/Y 는 "요소의 현재 위치"를 기준으로 계산되므로, **트랙이 아직 배치되기 전에 들어간 X/Y 는 어긋난
자리에 놓인다.** 그래서 배치를 바꾼 뒤 150ms · 600ms 에 X/Y 를 다시 넣는다(`reassertPositions`).
같은 값은 바인딩이 변경으로 보지 않으므로 0.01px 를 번갈아 더한다. 놓을 때마다도 전체를 다시 넣어
스스로 바로잡힌다.

### 색을 Opacity 로 고르는 이유

조각 얼굴은 회색(방해물) 위에 빨강·파랑 층을 겹치고 `Opacity` 를 0/1 로 묶었다. 숫자 바인딩은
DragLab 에서 검증됐고, 문자열→Brush 변환이나 `DataTrigger` 는 아직 검증하지 못했기 때문이다.

## 에디터에 붙이는 법

1. `Documents/NoesisSample/NoesisRushHour/` 를 Noesis 에셋으로 임포트한다 (DragLab 때와 같다).
2. NoesisUI gizmo 의 Root XAML 을 `RushHourBoard.xaml` 로 둔다. Display Mode = Screen Overlay,
   입력 = Interactive, blocking. **DragLab 이 동작했던 실행 모드를 그대로 쓴다.**
3. gizmo 에 `NoesisRushHour_Panel` 을 붙인다.
4. 다른 Noesis/Custom UI 보드 패널은 같은 월드에서 꺼 둔다.

| prop | 기본 | 뜻 |
|---|---|---|
| `puzzleId` | `8000202001` | 기획 CSV 의 판 번호 (`RushHour_FieldData.ts`). 조각이 12개를 넘는 판은 자리가 모자라 기본 판으로 돌아간다 |
| `rootWidth` / `rootHeight` | 0 | 0 이면 XAML 이 알려 주는 루트 크기를 쓴다. **그 보고가 오지 않을 때만** 직접 적는다 |
| `logToConsole` | true | `[NoesisRushHour]` 로 콘솔에도 남긴다 |

기본 판 `8000202001` 은 난이도 2, 조각 6개, 최소 6수다. 풀이:
세로 3칸(A5)을 아래로 3칸 → 가로 2칸(C6)을 왼쪽으로 3칸 → 세로 3칸(D5)을 다시 위로 3칸 →
가로 2칸(D6)을 왼쪽으로 2칸 → 세로 3칸(E6)을 위로 3칸 → USB 를 오른쪽으로 2칸 (솔버가 구한 최소 해).

## 확인할 것

| # | 확인 | 안 되면 |
|---|---|---|
| 1 | 화면이 뜨고 위·보조·아래 띠가 화면을 꽉 채운다 | XAML 로드 오류를 콘솔에서 본다 |
| 2 | 아래 진단 글에 `root 1179x2556 (xaml)` 처럼 크기가 찍히고 보드가 가운데 정사각형으로 나온다 | `root size bad parameter (...)` 면 `CommandParameter` 가 다른 형태로 온 것 — 괄호 안 내용을 알려 주면 맞춘다. `not reported` 면 `rootWidth`/`rootHeight` prop 에 직접 적는다 (먼저 아무 값이나 넣고 보드가 화면에 맞을 때까지 조정) |
| 3 | `TAP TO START` 를 누르면 배너가 사라지고 조각이 **칸에 정확히 앉아** 있다 | 조각이 격자에서 일정하게 밀려 있으면 재대입 시점(`REASSERT_DELAYS_MS`)을 늘린다 |
| 4 | 조각이 자기 축으로만 끌리고 보드 밖으로 나가지 않는다 | `ConstrainToParentBounds` 미동작 — 놓을 때 축 성분만 쓰므로 규칙은 지켜지지만 끄는 느낌이 다르다 |
| 5 | 놓으면 칸에 붙고, 막힌 방향으로 끌면 막히기 직전 칸으로 돌아온다. 진단 글 둘째 줄에 `P4 x … y …  E3 -> E5  steps 2` | 칸이 한 칸씩 어긋나면 그 줄을 알려 준다 |
| 6 | USB 를 포트 앞까지 밀면 반 칸 들어가고 `CLEAR!` | — |
| 7 | `Reset` 이 처음 배치로 되돌린다 | — |
| 8 | **끄는 동안 끊김이 있는가** — Custom UI 판(`PuzzleBoardUI_Panel` 의 러시아워)과 같은 기기에서 비교한다 | 이것이 전환 여부의 핵심 판단 근거다 |

## 검증한 것과 못 한 것

- **검증함 (Horizon 밖, 스텁으로 실행)**: 크기 보고(숫자·문자열 두 형태) → 배치 → 솔버의 최소 해
  6수를 손가락처럼 어긋난 좌표로 놓기 → 결합 → `CLEAR!`. 중복 Up 무시, 막힌 끌기, 벽 너머 끌기,
  끌지 않은 탭, prop 크기 우선.
- **못 함 (실기에서 확인해야 함)**: `CommandParameter` + `ElementName` 바인딩이 Horizon 에서 값을
  넘기는지, `ConstrainToParentBounds` 동작, 트랙 안에서의 X/Y 재대입 타이밍, 12자리 × 바인딩 11개의
  로드 비용.
