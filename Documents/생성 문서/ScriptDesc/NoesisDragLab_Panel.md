# NoesisDragLab_Panel — Noesis UI 격자 보드 드래그 앤 드롭 실험 (테스트 전용)

> 원본: `NoesisDragLab_Panel.ts` (클래스 `NoesisDragLabPanel`)
> XAML: `Documents/NoesisSample/NoesisDragLab/DragLabA_CellEvents.xaml`, `DragLabB_NativeDrag.xaml`
> 관련: `DragLab_Panel.md` (같은 실험의 Custom UI 판)

## 목적

퍼즐 보드 UI 를 Custom UI 에서 Noesis UI 로 옮길지 정하기 전에, **격자 보드 위 드래그 앤 드롭이
Noesis 에서 되는지**를 직접 확인하는 실험 패널이다. 퍼즐 로직과 무관하고 다른 프로젝트 파일을
import 하지 않는다. 스크립트 하나와 XAML 폴더만 지우면 흔적이 없다.

`horizon/noesis` 가 스크립트에 주는 것은 `dataContext`(값과 함수) 하나뿐이다. **포인터 좌표를 받는
API 가 없다.** 그래서 드래그는 다음 둘 중 하나로만 만들 수 있고, 이 실험은 둘을 한 장씩 시험한다.

| 장 | 방식 | 끄는 동안 스크립트 호출 | 움직임 |
|---|---|---|---|
| **A** `DragLabA_CellEvents.xaml` | 칸마다 Down/Enter/Up 이벤트를 `InvokeCommandAction` 으로 스크립트에 보낸다. 스크립트가 보드를 갖고 칸 표시를 바꾼다 | 칸을 넘을 때마다 1회 | 칸 단위 (조각이 손가락을 따라오지 않고 칸이 강조된다) |
| **B** `DragLabB_NativeDrag.xaml` | `MouseDragElementBehavior` 가 Noesis 안에서 조각을 끈다. X/Y 를 TwoWay 로 묶어 두고, 놓을 때만 스크립트가 읽어 칸에 스냅한다 | 없음 (놓을 때 1회) | 자유 이동 + 놓을 때 스냅 |

두 장은 **같은 스크립트·같은 dataContext** 를 쓴다. gizmo 의 Root XAML 만 바꿔 끼우면 된다.
한 파일로 합치지 않은 까닭은, 런타임이 `MouseDragElementBehavior` 를 모르면 XAML 전체가 로드되지
않아 A 장 시험까지 막히기 때문이다.

## 에디터에 붙이는 법

1. `Documents/NoesisSample/NoesisDragLab/` 폴더를 Noesis 프로젝트 에셋으로 임포트한다
   (Noesis Studio 프로젝트를 쓰고 있다면 그 프로젝트에 XAML 두 개를 넣고 다시 임포트한다).
2. **NoesisUI gizmo** 를 만들고 에셋을 지정한 뒤 Root XAML 을 `DragLabA_CellEvents.xaml` 로 둔다.
   Display Mode 는 Screen Overlay, 입력은 **Interactive, blocking** 으로 둔다.
3. gizmo 에 `NoesisDragLab_Panel` 스크립트를 붙인다. 먼저 **Default 실행 모드**로 시험하고,
   그다음 **Local** 로 바꿔 지연을 비교한다 (Local 이면 `Puzzle_LocalOwnership` 의 `targets` 에 넣는다).
4. 스크립트 설정의 API 목록에서 **`horizon/noesis`** 가 켜져 있어야 컴파일된다.
5. B 장은 Root XAML 을 `DragLabB_NativeDrag.xaml` 로 바꿔서 시험한다.

화면은 좌상단에 고정 픽셀 크기로 그린다(Viewbox 를 쓰지 않는다). B 장의 X/Y 가 화면 배율과 섞이지
않게 하려는 것이다. 기기에서 너무 작거나 잘리면 그 자체가 기록할 결과다.

## 화면

| 위치 | 내용 |
|---|---|
| 둘째·셋째 줄 (회색) | 계측. `A down/enter/up  mouse 3/7/3  touch 0/0/0` = 입력원별로 스크립트에 도착한 이벤트 수. `B drops … two-way via getter` = 놓기 횟수, 입력원별 Up 수, TwoWay 값이 어디로 돌아왔는지 |
| 격자 | 4×4. 조각 셋(빨강·파랑·청록). A 장에서 노란 테두리 = 출발 칸, 초록 = 놓을 수 있는 칸, 빨강 = 막힌 칸, 흰색 = 선택됨 |
| `reset` | 보드와 계측을 처음으로 |
| `update: reassign / mutate` | 갱신 방식 전환. reassign = `dataContext` 에 같은 객체를 다시 대입, mutate = 대입 없이 속성만 변경 |
| 오른쪽 글자 | 최근 로그 7줄 (콘솔에도 `[NoesisDragLab]` 로 나간다). B 장은 그 위에 Noesis 가 보는 X/Y 를 실시간으로 보여준다 |

A 장에는 **탭-탭 대안**이 들어 있다. 조각을 눌렀다 그 자리에서 떼면 선택되고(흰 테두리), 빈 칸을
누르면 옮겨진다. Enter 이벤트가 오지 않는 환경에서 쓸 수 있는 최소한의 조작이다.

## 확인할 것

순서대로 본다. 앞 단계가 안 되면 뒤는 볼 필요가 없다.

| # | 확인 | 되면 | 안 되면 |
|---|---|---|---|
| 1 | A 장이 뜨고 격자·조각·버튼이 보인다 | XAML 로드, `ItemsControl`+배열 바인딩, `DataTrigger` 가 된다 | 콘솔의 XAML 오류를 본다. `b:` 네임스페이스 오류면 Interactivity 자체가 없는 것 — 버튼 `Command` 만으로는 드래그를 만들 수 없다 |
| 2 | `reset` 을 누르면 로그가 늘어난다 | `Command` → 함수 호출, 그리고 reassign 갱신이 된다 | 실행 모드를 바꿔 본다 |
| 3 | `update: mutate` 로 바꾼 뒤에도 화면이 따라온다 | 런타임이 속성 변경을 추적한다 → 실제 구현은 mutate 로 간다 | 매번 대입해야 한다. 큰 보드에서 대입 1회 비용을 재 봐야 한다 |
| 4 | A 장에서 조각을 누른 채 옆 칸으로 밀면 `enter` 수가 오르고 초록 칸이 따라온다 | 칸 단위 드래그가 된다 | 누른 칸이 입력을 붙잡는 것. 탭-탭만 가능 |
| 5 | 4 번을 **모바일 터치**로 반복한다. `mouse` 와 `touch` 중 어느 쪽 수가 오르는지 본다 | 터치에서도 된다 | 데스크톱만 된다면 모바일 퍼즐에는 못 쓴다 |
| 6 | B 장에서 조각이 손가락을 따라 끌린다 | `MouseDragElementBehavior` 지원. 끄는 동안 스크립트가 돌지 않으니 Custom UI 의 끊김 문제가 구조적으로 없다 | B 방식 불가 |
| 7 | B 장에서 끄는 동안 오른쪽 위 X/Y 숫자가 바뀐다 | TwoWay 가 Noesis 안에서는 써진다 | TwoWay 미지원 |
| 8 | B 장에서 놓으면 로그에 `snap C2` 가 찍히고 조각이 칸에 붙는다. `two-way via` 가 `getter`/`object` 중 무엇인지 본다 | 값이 스크립트까지 돌아온다 = **B 방식 성립** | `no X/Y change` 만 찍히면 값이 스크립트로 안 온다. 좌표가 엉뚱한 칸으로 가면 로그의 `x … y …` 값을 알려주면 원점을 맞춘다 |

## 판단 기준

- **6·7·8 이 모바일에서 다 된다** → Noesis 전환을 검토할 만하다. 끄는 동안 스크립트·바인딩 갱신이
  0 회라서 `DragLab_Panel` 에서 재던 입력 공백·set 횟수 문제가 아예 생기지 않는다.
- **4·5 만 된다** → 칸 단위 조작인 퍼즐(스위치, 카드 맞추기, 색 채우기)은 옮길 수 있다. 조각이 손가락을
  따라와야 하는 퍼즐(러시아워, 슬라이드)은 Custom UI 에 남긴다.
- **탭-탭만 된다 / 모바일에서 안 된다** → 드래그가 있는 보드는 전환하지 않는다. HUD·메뉴처럼 입력이
  단순한 패널만 Noesis 후보로 둔다.

## 아직 모르는 것 (이 실험으로 알아내려는 것)

공식 문서 본문을 확인하지 못한 채 NoesisGUI 일반 동작을 근거로 짰다. 아래는 가정이다.

- Horizon 의 Noesis 런타임에 Interactivity(`EventTrigger`, `InvokeCommandAction`,
  `MouseDragElementBehavior`)가 들어 있다.
- 배열 항목 안의 함수도 `Command` 로 묶인다 (칸마다 클로저를 넣었다. 안 되면 루트 함수 +
  `CommandParameter` 로 바꾼다).
- `MouseDragElementBehavior` 의 X/Y 는 루트 기준 좌표다. 부모 기준이어도 같은 값이 되도록 조각을
  원점에 놓인 루트 Canvas 의 직계 자식으로 두었다.
- 테마가 로드되어 있지 않을 수 있어 `Button`·`ItemsControl` 템플릿을 XAML 에 직접 적었다.
