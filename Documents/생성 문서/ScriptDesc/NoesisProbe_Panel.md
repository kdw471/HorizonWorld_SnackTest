# NoesisProbe_Panel — Noesis 전면 전환 0단계 확인 장 (테스트 전용)

> 원본: `NoesisProbe_Panel.ts` (클래스 `NoesisProbePanel`)
> XAML: `Documents/NoesisSample/NoesisProbe/Probe.xaml`
> 관련: `NoesisDragLab_Panel.md`, `NoesisRushHour_Panel.md`

## 목적

퍼즐 보드 뷰를 Noesis 로 전면 전환하기 전에, **설계를 가르는 미확인 항목**을 한 장에서 확인한다.
결과에 따라 1단계(Noesis 보드 패널)의 구조가 달라지므로 먼저 한다.

## 이미 확인된 것 (이 장의 전제)

| 항목 | 근거 |
|---|---|
| Local 실행 모드 + `Puzzle_LocalOwnership` 에서 동작 | 러시아워 샘플 |
| 네이티브 드래그, X/Y TwoWay (낱개 키), `ConstrainToParentBounds` | DragLab B, 러시아워 샘플 |
| `CommandParameter` + `ElementName` 으로 루트 크기 전달 | 러시아워 샘플 (`(xaml)`) |
| 배열 → `ItemsControl`, `DataTemplate`, 문자열 `DataTrigger`, 배열 항목 안의 함수 = `Command` | DragLab A |
| **누른 채 옆 칸으로 밀면 터치 Enter 이벤트가 온다** → Flow 경로 그리기·Switch 이탈 취소가 칸 이벤트로 된다 | DragLab A (`touch enter`) |
| **속성만 바꿔도 화면이 따라온다 (mutate)** → 바뀐 칸만 쓰면 된다 | DragLab A |
| 첫 대입 때 없던 키는 바인딩되지 않는다 (`NoesisBindingModel_1`) → **쓸 키를 전부 첫 대입에 넣는다** | 콘솔 오류 |

## 에디터에 붙이는 법

1. `Documents/NoesisSample/NoesisProbe/` 를 Noesis 에셋으로 임포트하고, NoesisUI gizmo 의 Root XAML 을
   `Probe.xaml` 로 둔다. 실행 모드·입력 설정·`Puzzle_LocalOwnership` 은 러시아워 샘플과 같게 둔다.
2. `NoesisProbe_Panel` 을 붙이고 **`texture` prop 에 아무 Texture 애셋이나 끼운다** (퍼즐에 쓰던 것이면 된다).
3. T6 을 볼 때만 Custom UI `PuzzleUI_MainPanel` gizmo 를 같이 켠다.

## 확인할 것

화면을 한 번 누르면 루트 크기가 들어오고 조각 셋(P1, A1, A2)이 아래 놀이터 칸에 앉는다.

| # | 하는 일 | 되면 | 안 되면 (설계에 미치는 영향) |
|---|---|---|---|
| **T1** | `colour` 를 누른다 | 왼쪽 상자(`Background=Binding`)·가운데 상자(`Brush.Color=Binding`)의 색이 바뀐다. **어느 쪽이 바뀌는지**가 결과다 | 둘 다 안 되면 칸 색을 임의 RGB 로 줄 수 없다 → 퍼즐별 고정 색 상태(`DataTrigger`)로 바꿔야 한다 |
| | `vis` 를 누른다 | 노란 상자가 사라졌다 나타난다 | 숨김은 `Opacity` 0/1 로 한다 |
| **T2** | 시작 직후 첫째 상자와 격자의 0·10·20…번 칸을 본다 | 그림이 보인다 = `ImageSource` 바인딩이 Local 에서 된다 | 텍스처를 Noesis 에셋 묶음에 넣고 이름으로 참조해야 한다 (PNG 재수집 필요) |
| | `load late` 를 누른다 | 둘째 상자와 5·15·25…번 칸에 그림이 나타난다 = null → 그림 전환이 된다 | 그림이 있을 자리는 첫 대입부터 투명 그림이라도 넣어 둬야 한다 |
| **T3** | `repaint` 를 몇 번 누른다 | 81칸이 한꺼번에 바뀐다. 로그의 `162 sets  Nms script` 와 **눈에 보이는 멈칫**을 본다 | 레벨 시작 때 전 칸을 칠하는 비용이다. 크면 레벨 전환을 배너로 가린다 |
| | `auto: on` 을 켜고 **조각을 끈다** | 100ms 마다 6칸이 바뀌는 중에도 끌기가 부드럽다 | 끄는 중 강조(놓을 자리 표시)를 넣을 수 없다 → 놓을 때만 반영 |
| **T4** | A1·A2(배열 조각)를 끌어 놓는다 | 로그에 `A1(array) via … -> slot c3 r1` 이 찍히고 칸에 붙는다 = 배열 항목의 TwoWay 가 된다 | 조각을 고정 개수 낱개 키(`P1X`…)로 찍는다 (러시아워 샘플 방식 그대로) |
| **T5** | P1 을 끌어 놓는다. 끌 때 손가락을 정확히 따라오는지도 본다 | `design x,y` 가 놓은 자리와 맞고 칸에 정확히 붙는다 = **Viewbox 안에서도 환산이 맞다** | 보드를 XAML 레이아웃에 맡길 수 없다 → 러시아워 샘플처럼 스크립트가 루트 px 로 배치한다 |
| **T6** | `PuzzleUI_MainPanel` 을 같이 켠다 | ① 어느 쪽이 위에 그려지는가 ② Probe 패널 **바깥**(위·아래 12%)에서 MainPanel 의 버튼이 눌리는가 ③ Noesis 입력을 blocking / nonblocking 으로 바꾸면 달라지는가 | 둘을 겹쳐 쓸 수 없으면 HUD·Menu 도 보드 패널 안에 그려야 한다 → MainPanel 전환을 앞당긴다 |

콘솔에 `[NOESIS] Binding failed` 가 찍히면 그 문구가 가장 정확한 답이다 (예: 문자열 → Brush 변환 실패).
로그 첫 줄 `dataContext getter returns …` 도 알려 주면 좋다 — 갱신을 어느 객체에 써야 하는지가 정해진다.
