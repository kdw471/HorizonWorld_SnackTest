# NoesisMoveLab_Panel — 포인터 좌표를 받아 스크립트가 끄는 러시아워 (테스트 전용)

> 원본: `NoesisMoveLab_Panel.ts` (클래스 `NoesisMoveLabPanel`)
> XAML: `Documents/NoesisSample/NoesisMoveLab/MoveLab.xaml`
> (생성기 `Documents/Tools/build_noesis_movelab_xaml.js` — XAML 은 직접 고치지 않는다)
> 관련: `NoesisRushHour_Panel.md` (같은 판을 **네이티브 드래그**로 끄는 짝)

## 목적

공식 문서의 MouseMove 예제로 **스크립트가 포인터 좌표를 받을 수 있다**는 것을 알게 됐다.

```xml
<b:EventTrigger EventName="MouseMove">
  <b:InvokeCommandAction Command="{Binding mouseMove}" PassEventArgsToCommand="True"/>
</b:EventTrigger>
```
```ts
mouseMove: (args) => { const { position } = args as { position: { x: number, y: number } }; ... }
```

지금까지는 "`horizon/noesis` 에는 좌표를 받는 길이 없다" 를 전제로, 끄는 것을 `MouseDragElementBehavior` 에
맡기고 놓을 때만 TwoWay 로 X/Y 를 읽었다. 좌표가 오면 **스크립트가 직접 끌 수 있고**, 그러면 네이티브
드래그로는 못 하던 것 — 끄는 동안 다른 조각에 막히기, 놓을 자리 미리보기, 스냅 연출 — 을 자유롭게 짤 수 있다.
남은 질문은 하나였다: **그래도 네이티브만큼 부드러운가.** 2026-09-22 실기 결과 — **대등하게 부드러웠다.**
그래서 2단계의 조각 계층은 **스크립트 구동**으로 간다 (`NoesisBoard_Panel` 의 조각 계층).

## `NoesisRushHour_Panel` 과의 차이 — 같은 판·같은 화면, 끄는 방식만 다르다

| | NoesisRushHour (네이티브) | NoesisMoveLab (스크립트) |
|---|---|---|
| 끄는 주체 | `MouseDragElementBehavior` | 스크립트가 Move 마다 `TranslateTransform` 의 X/Y 를 쓴다 |
| 끄는 동안 스크립트 | 0회 | Move 이벤트마다 1회 |
| 다른 조각에 막힘 | 놓을 때만 (끄는 동안 지나간다) | **끄는 동안 막힌다** — 잡는 순간 `getMaxSteps()` 로 갈 수 있는 구간을 재 둔다 |
| 놓을 때 | 순간 스냅 | 90ms 동안 미끄러져 들어간다 (스크립트 트윈) |
| 어느 조각을 집었나 | 조각 요소가 직접 입력을 받는다 | 조각은 그림일 뿐. 루트가 입력을 받고 스크립트가 좌표로 판정한다 (`getPieceAt`) |
| 좌표 | TwoWay 로 돌아온 X/Y (루트 px) | 이벤트 인자의 `position` (루트 px 라고 **가정**) |

## 화면이 아예 뜨지 않을 때 — XAML 세 장으로 가른다

이 패널만 쓰는 새 문법이 둘이다. **하나라도 런타임이 모르면 XAML 로드가 통째로 실패해서 아무것도
그려지지 않는다** (빈 화면이 아니라 화면이 없다).

| Root XAML | 포인터 인자 | 조각 자리 | 여기까지 뜨면 |
|---|---|---|---|
| `MoveLabMini.xaml` | 없음 | `Canvas.Left/Top` | 전부 검증된 문법뿐이다. **이것도 안 뜨면 XAML 내용이 아니라 에셋·gizmo·스크립트 설정 문제** |
| `MoveLabCanvas.xaml` | `PassEventArgsToCommand` | `Canvas.Left/Top` | Mini 는 뜨는데 이것이 안 뜨면 **`PassEventArgsToCommand` 가 원인** |
| `MoveLab.xaml` | `PassEventArgsToCommand` | `TranslateTransform` 바인딩 | Canvas 는 뜨는데 이것이 안 뜨면 **transform 바인딩이 원인** |

셋 다 **같은 스크립트·같은 dataContext** 를 쓴다. gizmo 의 Root XAML 만 바꿔 끼우면 된다.
`MoveLabCanvas` 가 뜨면 그대로 써도 기능 차이가 없다 (자리 잡는 방법만 다르다).

무엇이 보이는지도 단서다.

| 보이는 것 | 뜻 |
|---|---|
| 아무것도 없다 (뒤가 비친다) | XAML 이 로드되지 않았다 → 위 표로 가른다 |
| 어두운 화면에 `Reset` 버튼만, 글자는 비어 있다 | XAML 은 떴는데 `dataContext` 가 안 들어왔다 → 실행 모드가 **Default** 이거나 (Noesis 는 Default 에서 동작하지 않는다) 스크립트가 안 붙었다 |
| 글자는 나오는데 판이 없다 | 루트 크기 보고가 안 온 것. 아래 진단 줄의 `root 0x0` 을 확인한다 |

콘솔의 `[NOESIS]` 줄이 가장 정확한 답이다 — 로드 실패는 모르는 타입·속성의 이름을 찍어 준다.

## 에디터에 붙이는 법

1. `Documents/NoesisSample/NoesisMoveLab/` 를 Noesis 에셋으로 임포트하고 Root XAML 을 `MoveLab.xaml` 로 둔다.
2. `NoesisMoveLab_Panel` 을 붙인다. 실행 모드는 **Local(+`Puzzle_LocalOwnership`) 이든 Shared 든 된다** —
   서버 판별을 소유자가 아니라 `getLocalPlayer()` 로 한다. Shared 를 시험해 보기에도 좋은 패널이다 (의존하는 것이 없다).
3. 다른 Noesis 패널은 같은 월드에서 꺼 둔다.

## 화면

`TAP TO START` → 조각을 끈다. 보조 레이아웃의 `rate` 버튼은 Move 를 화면에 반영하는 최소 간격을 바꾼다
(`every move` → `16ms` → `33ms` → `50ms`). 맨 아래 회색 글자가 계측이다.

```
root 590x1278  moves/s 69  last 448,545  touch drop P4  E3 -> E5  docked
mouseDown {"position":{"x":10,"y":10}}
mouseMove {"position":{"x":254.5,"y":534.1}}
touchDown {...}
```

첫 줄 = 루트 크기 · **초당 Move 이벤트 수** · 마지막 좌표 · 마지막 사건. 그 아래 = **이벤트 종류별로 처음 받은 인자**.

## 확인할 것

| # | 확인 | 뜻 |
|---|---|---|
| 1 | PC 에서 조각을 끌면 따라오고, `mouseMove {"position":…}` 이 찍힌다 | 문서대로 좌표가 온다 |
| 2 | **모바일 터치**에서도 끌린다. 아래에 `mouseMove` 와 `touchMove` 중 **무엇이 찍히는지**, 인자 모양이 어떤지 | 터치가 마우스로 승격되는지, 터치 인자의 좌표 키가 무엇인지. `touchMove` 의 인자에 좌표가 다른 이름으로 들어 있으면 그 글자를 알려 주면 맞춘다 |
| 3 | 집은 자리가 손가락과 맞는다 (조각의 집은 지점이 손가락 밑에 그대로 있다) | `position` 이 루트 px 기준이라는 가정이 맞다. 일정하게 어긋나면 기준이 다른 것 — 첫 줄의 `last x,y` 와 누른 위치를 비교해 알려 준다 |
| 4 | **USB 를 오른쪽으로 세게 끌어도 세로 블록 앞에서 멈춘다** | 끄는 동안 막힘 — 네이티브 방식으로는 못 하던 것 |
| 5 | **부드러움을 `NoesisRushHour` 와 같은 기기에서 비교한다.** `moves/s` 가 몇인지도 본다 | 이것이 핵심 판단이다. 대등하면 2단계의 조각 계층을 **스크립트 구동**으로 간다 (막힘·미리보기·연출이 자유롭다). 눈에 띄게 끊기면 네이티브 드래그를 유지하고 좌표는 미리보기에만 쓴다 |
| 6 | `rate` 를 `33ms` · `50ms` 로 바꿔 끌어 본다 | 매 Move 마다 쓰는 것이 부담이라면 간격을 둘 때 오히려 나아진다. 어느 값에서 가장 자연스러운지 |
| 7 | 놓을 때 미끄러져 들어가는 것이 자연스럽다 | 스크립트 트윈(16ms 간격 set)이 쓸 만한가. 끊기면 Storyboard 로 바꾼다 |

## 검증한 것과 못 한 것

- **검증함 (Horizon 밖, 스텁)**: XAML 바인딩 키 131개가 첫 대입에 전부 있다 / USB 를 4칸 끌어도 1칸(자유 구간)에서
  멈추고 다른 축은 움직이지 않는다 / 드래그 중 다른 입력원(touch ↔ mouse)의 Move 는 무시 / 놓으면 트윈 뒤 칸에
  정확히 앉는다 / 솔버의 최소 해 6수를 터치 이벤트(어긋난 좌표)로 재생 → 결합 → `CLEAR!`.
- **못 함 (실기)**: `PassEventArgsToCommand` 가 실제로 넘기는 인자 모양(특히 터치), `position` 의 기준 좌표계,
  `TranslateTransform` 바인딩, Move 이벤트 빈도와 그때의 부드러움.
