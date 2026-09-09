# PuzzleBoardUI_Presenter.ts — 주석 아카이브

> 원본 스크립트: `PuzzleBoardUI_Presenter.ts`
> 걷어낸 주석 74건 / 17,270 B 절감 (39,320 B → 22,050 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Puzzle Board UI Presenter - CustomUI 보드의 상태 보관 + 입력 정규화 (순수 계층)

`*_CoreAPI` 와 `PuzzleBoardUI_Panel` 사이에 끼는 유일한 지점이다.

  CoreAPI  --setCell()-->  Presenter  --CELL_CHANGED-->  Panel(Binding)
  CoreAPI  <--onCellUp--   Presenter  <--pointerUp()---  Panel(Pressable)

3D 시절의 `PuzzleTouchRouter`(`Puzzle_HorizonBridge.ts`)가 하던 일을 그대로 이어받되,
**ray-plane 교차가 사라진다.** Pressable 이 이미 어느 칸인지 알려 주기 때문이다.
단일 터치 강제(PUZ_00 §8.1)와 "누른 칸 밖에서 떼면 취소"(PUZ_08 M2) 규칙은 여기 남는다.

#### 누름의 출발지는 둘이다

보조 레이아웃의 오브젝트 트레이가 입력을 받게 되면서, 누름이 **본 격자의 칸**에서 시작할
수도 있고 **트레이의 슬롯**에서 시작할 수도 있다 (레이저: 크리스탈을 트레이에서 집어
판으로 끌어다 놓는다). 출발지가 어디든 이후의 이동·뗌은 같은 경로를 탄다.

  itemDown(slot) ─┐
                  ├─▶ pointerEnter(cell) ... ─▶ pointerUp()
  pointerDown(cell) ┘

그래서 누름도 둘을 합쳐 하나로 센다. 누름이 열려 있는데 새 down 이 오면 **앞 터치의
release 가 유실된 것**으로 보고 앞 누름을 마감한 뒤 새 누름을 연다 - 모바일 `Pressable`
은 누른 요소 밖에서 뗀 release 를 전달하지 않는 경우가 있어, 무시하면 드래그가 영구히
붙잡힌다 (`pointerDown()` 주석).

#### 손을 뗄 때 어느 칸에 놓았다고 볼 것인가

`Pressable` 은 손가락이 떨어질 때 **`onExit` 를 `onRelease` 보다 먼저 보내는 경우가
있다.** 그러면 뗀 순간의 `_hoverCell` 은 이미 "판 밖" 이라, 분명히 칸 위에서 손을
뗐는데도 세션은 "밖에 놓았다" 로 받아 조각을 제자리로 되돌렸다.

그래서 hover 와 별개로 **이번 누름에서 마지막으로 올라가 있던 진짜 칸**
(`_lastInsideCell`)을 따로 들고 있다가, 뗄 때 hover 가 밖이면 그 칸을 쓴다.

  exit(B) → release      hover=밖, 마지막 진짜 칸=B  ->  **B 에 놓는다**
  판 밖으로 나감 → release  pointerLeaveBoard() 가 마지막 칸까지 지웠다  ->  밖에 놓는다

둘을 가르는 것은 `pointerLeaveBoard()` 다. 이것은 격자 밖 배경이 부르는 **명시적인**
신호라, 진짜로 판을 벗어난 경우에만 온다. 칸과 칸 사이를 오갈 때 스쳐 가는 `onExit` 와
뒤섞이지 않는다.

`horizon/core` / `horizon/ui` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `export type PuzzleBoardCellChange = {`

> 원본 L67

#region Types

## `export type PuzzleBoardCellChange = {`

> 원본 L69

 칸 하나가 바뀌었다 - 패널은 이 셀의 Binding 만 갱신한다

## `export type PuzzleBoardItemChange = {`

> 원본 L75

 트레이 슬롯 하나가 바뀌었다

## `export type PuzzleBoardPressHighlight = {`

> 원본 L81

지금 손가락이 짚고 있는 자리.

퍼즐 로직과는 무관한 **순수한 조작 피드백**이다. 어느 퍼즐이든 누르고 있는 칸은
눌린 티가 나야 하는데(PUZ_00 §8.5), 그것을 8개 퍼즐이 저마다 구현하면 같은 코드가
여덟 번 생긴다. 그래서 프레젠터가 한 번만 알리고 패널이 그린다.

각 `*_CoreAPI` 가 칸에 직접 준 강조(`EBoardCellAccent`)가 있으면 그쪽이 이긴다 -
러시아워의 "집어 든 오브젝트" 같은 것이 단순한 누름 표시에 덮이면 안 되기 때문이다.

## `cell: number,`

> 원본 L92

 손가락이 올라가 있는 칸. 짚고 있지 않거나 판 밖이면 `PUZZLE_BOARD_CELL_OUTSIDE`

## `item: number,`

> 원본 L94

 트레이에서 집었다면 그 슬롯. 아니면 `PUZZLE_BOARD_CELL_OUTSIDE`

## `export type PuzzleBoardPressOrigin =`

> 원본 L98

 지금 누름이 어디서 시작했는지

## `export type PuzzleBoardInputHandlers = {`

> 원본 L103

CoreAPI 가 받는 입력 콜백.

탭 퍼즐은 `onCellTap` 하나면 되고, 스위치처럼 "누른 칸에서 떼야 확정" 규칙이 있는 퍼즐은
down/move/up 셋을 그대로 세션에 넘긴다. 드래그 퍼즐도 down/move/up 을 쓴다.

트레이에서 시작한 누름은 `onItemDown` 으로 알리고, 그 뒤의 이동·뗌은 칸에서 시작한 누름과
**똑같이** `onCellMove` / `onCellUp` 으로 나간다. 세션은 출발지를 구분할 필요가 없다.

## `onCellDown?: (cell: number) => void,`

> 원본 L113

 손가락이 칸에 닿았다

## `onCellMove?: (cell: number) => void,`

> 원본 L115

 누른 채로 다른 칸으로 옮겨 갔다. 보드 밖으로 나가면 PUZZLE_BOARD_CELL_OUTSIDE

## `onCellUp?: (cell: number) => void,`

> 원본 L117

 손가락을 뗐다. 뗀 위치가 보드 밖이면 PUZZLE_BOARD_CELL_OUTSIDE

## `onCellTap?: (cell: number) => void,`

> 원본 L119

 누른 칸과 뗀 칸이 같다 - 탭 퍼즐의 편의 콜백

## `onItemDown?: (item: number) => void,`

> 원본 L121

 보조 레이아웃의 오브젝트 슬롯을 집었다 (레이저: 인벤토리에서 크리스탈을 꺼낸다)

## `onItemTap?: (item: number) => void,`

> 원본 L123

 슬롯을 집었다가 판 밖에서 그대로 뗐다 - 끌지 않고 툭 누른 경우

## `onReset?: () => void,`

> 원본 L125

 리셋 버튼을 눌렀다 - 판을 풀기 전 상태로 되돌린다 (남은 시간은 유지)

## `onAction?: () => void,`

> 원본 L127

보조 레이아웃의 큰 액션 버튼을 눌렀다 (`PuzzleBoardLayoutSpec.actionLabel`).
패널이 `onPress`(누르는 순간)로 연결하므로 릴리즈를 기다리지 않는다 - 색 채우기의
STOP 처럼 타이밍이 곧 게임인 입력이 여기로 온다.

## `export class PuzzleBoardPresenter {`

> 원본 L135

#endregion

## `export class PuzzleBoardPresenter {`

> 원본 L137

#region Presenter

## `public readonly LAYOUT_CHANGED = new EventPublisher<PuzzleBoardView>();`

> 원본 L140

 격자 크기·제목이 통째로 바뀌었다 (레벨 로드). 패널은 전체를 다시 반영한다

## `public readonly CELL_CHANGED = new EventPublisher<PuzzleBoardCellChange>();`

> 원본 L142

 칸 하나가 바뀌었다

## `public readonly SIDE_CELL_CHANGED = new EventPublisher<PuzzleBoardCellChange>();`

> 원본 L144

 보조 격자의 칸 하나가 바뀌었다

## `public readonly ITEM_CHANGED = new EventPublisher<PuzzleBoardItemChange>();`

> 원본 L146

 트레이 슬롯 하나가 바뀌었다

## `public readonly INTRO_CHANGED = new EventPublisher<PuzzleBoardIntroView>();`

> 원본 L148

 시작 배너가 떴다/사라졌다. 떠 있는 동안 패널은 보조 레이아웃을 그리지 않는다

## `public readonly PRESS_CHANGED = new EventPublisher<PuzzleBoardPressHighlight>();`

> 원본 L150

 짚고 있는 자리가 바뀌었다 - 패널이 누름 표시를 옮긴다

## `private _press: PuzzleBoardPressOrigin | undefined = undefined;`

> 원본 L158

지금 누름이 시작된 자리. undefined 면 놀고 있다.
하나가 살아 있는데 새 down 이 오면 앞 터치의 release 가 유실된 것으로 보고,
앞 누름을 마지막 칸에 놓아 마감한 뒤 새 누름을 연다 (`pointerDown()` 주석).

## `private _hoverCell: number = PUZZLE_BOARD_CELL_OUTSIDE;`

> 원본 L164

 손가락이 지금 올라가 있는 칸. 보드 밖이면 PUZZLE_BOARD_CELL_OUTSIDE

## `private _lastInsideCell: number = PUZZLE_BOARD_CELL_OUTSIDE;`

> 원본 L166

이번 누름에서 손가락이 **마지막으로 올라가 있던 진짜 칸**.

스쳐 가는 `onExit` 로는 지워지지 않고, 판을 진짜로 벗어났을 때
(`pointerLeaveBoard()`)만 지워진다. 뗄 때 hover 가 밖이면 이 값으로 놓는다
(머리말 "손을 뗄 때 어느 칸에 놓았다고 볼 것인가").

## `private _isIntroInputLocked: boolean = false;`

> 원본 L176

시작 배너가 입력을 잠그고 있는지.

배너 표시(`_intro.isVisible`)와 **따로** 든다 - 배너가 페이드 아웃되는 동안에는
아직 떠 있지만 입력은 이미 열려 있어야 하기 때문이다 (`unlockIntroInput()`).

## `private _pressCell: number = PUZZLE_BOARD_CELL_OUTSIDE;`

> 원본 L184

 마지막으로 알린 누름 표시. 같은 값을 두 번 알리지 않기 위해 들고 있는다

## `private _lostReleaseCount: number = 0;`

> 원본 L188

 유실된 뗌을 새 누름에서 회복한 횟수 - 진단 로그에만 쓴다 (`warnOnLostRelease`)

## `private _batchDepth: number = 0;`

> 원본 L191

리페인트 배치 (`runBatch()`).

0 보다 크면 `setCell()` / `setSideCell()` / `setItem()` 은 스냅샷만 갱신하고 이벤트를
미룬다. 배치가 닫힐 때 **배치 시작 시점의 값과 최종값이 다른 자리만** 한 번 알린다.

페인터가 바탕 → 광선 → 오브젝트 순으로 같은 칸을 덧칠하면, 최종값이 그대로인 칸도
"바탕으로 리셋 → 원래대로" 두 번 나갔다. 패널은 이벤트마다 `Binding.set()` 을 부르고
그것이 곧 브리지 호출이므로(칸 하나에 파생 키 22개), 중간 결과가 프레젠터 밖으로
새는 것이 드롭 프레임 462회 set 의 정체였다 (설계 문서 "Horizon CPU/TypeScript
최적화 가이드 분석" §5·§6-1).

baseline 은 첫 패치 직전의 스냅샷 객체 참조다 - `applyCellPatch()` 가 바뀔 때 새 객체를
만들고 이전 객체를 건드리지 않으므로 복사가 필요 없다. 배열은 규격 크기로 한 번만
잡아 두어 드래그 중 할당이 없다 (방법론 §4.4).

## `public getView(): PuzzleBoardView {`

> 원본 L222

#region Query

## `public get hasActivePress(): boolean {`

> 원본 L245

 지금 누르고 있는 칸이나 슬롯이 있는지

## `public get pressOrigin(): PuzzleBoardPressOrigin | undefined {`

> 원본 L250

 지금 누름이 어디서 시작했는지. 놀고 있으면 undefined

## `public getPressHighlight(): PuzzleBoardPressHighlight {`

> 원본 L255

지금 짚고 있는 자리. 짚고 있지 않으면 둘 다 `PUZZLE_BOARD_CELL_OUTSIDE`.

누름 표시는 **누름이 시작된 칸 위에 손가락이 있을 때만** 켠다 - 손가락을 따라
이웃 칸으로 옮겨 다니지 않는다. 예전에는 hover 칸을 그대로 표시해서, 탭 퍼즐에서
카드를 누른 채 움직이면 지나가는 카드마다 테두리가 켜졌다 ("지속적으로 드래그
계산이 일어나고 있다" 는 피드백). 드래그 퍼즐의 이동 시각화는 세션이 주는
accent(GRABBED/PATH)가 담당하므로 여기서 따라다닐 필요가 없다.

## `public resetLayout(spec: PuzzleBoardLayoutSpec): void {`

> 원본 L281

#endregion

## `public resetLayout(spec: PuzzleBoardLayoutSpec): void {`

> 원본 L283

#region Layout

## `public resetLayout(spec: PuzzleBoardLayoutSpec): void {`

> 원본 L285

격자 규격을 갈아 끼운다 (레벨 로드 / 퍼즐 전환).
칸 내용은 전부 초기화되므로 곧바로 setCell() 로 채운다.

## `this.resetBatchBuffers();`

> 원본 L293

배치 중이었다면 옛 뷰를 가리키던 baseline 은 버린다. LAYOUT_CHANGED 가 새 뷰를
통째로 그리게 하므로, 그 뒤에 오는 setCell 만 새 버퍼에 기록되면 된다

## `public setCell(index: number, patch: PuzzleBoardCellPatch): boolean {`

> 원본 L307

#endregion

## `public setCell(index: number, patch: PuzzleBoardCellPatch): boolean {`

> 원본 L309

#region Cell update

## `public setCell(index: number, patch: PuzzleBoardCellPatch): boolean {`

> 원본 L311

 칸 하나를 갱신한다. 실제로 바뀐 것이 없으면 이벤트를 내지 않는다

## `public setAllCells(patch: PuzzleBoardCellPatch): void {`

> 원본 L358

 모든 칸에 같은 패치를 적용한다 (라운드 정리 등)

## `public setItem(index: number, patch: PuzzleBoardItemPatch): boolean {`

> 원본 L365

 트레이 슬롯 하나를 갱신한다. 실제로 바뀐 것이 없으면 이벤트를 내지 않는다

## `public runBatch<T>(paint: () => T): T {`

> 원본 L393

#endregion

## `public runBatch<T>(paint: () => T): T {`

> 원본 L395

#region Repaint batch

## `public runBatch<T>(paint: () => T): T {`

> 원본 L397

리페인트 한 패스를 배치로 묶는다 - 이유는 `_batchDepth` 주석 참고.

`beginBatch()` / `endBatch()` 를 직접 부르지 않고 이것을 쓴다. 페인터가 예외를 내면
깊이가 걸린 채 남아 이후의 모든 갱신이 조용히 멈추므로, `finally` 로 반드시 닫는다.
중첩해도 된다 - 가장 바깥 배치가 닫힐 때 한 번만 알린다.

## `public endBatch(): void {`

> 원본 L418

 가장 바깥 배치가 닫히면 시작 시점과 값이 달라진 자리만 알린다

## `private resetBatchBuffers(): void {`

> 원본 L473

 규격 크기에 맞춰 baseline 버퍼를 새로 잡고, 기록 중이던 자리를 모두 버린다

## `public beginIntro(text: string = PUZZLE_BOARD_INTRO_TEXT): void {`

> 원본 L483

#endregion

## `public beginIntro(text: string = PUZZLE_BOARD_INTRO_TEXT): void {`

> 원본 L485

#region Intro (레벨 시작 배너)

## `public beginIntro(text: string = PUZZLE_BOARD_INTRO_TEXT): void {`

> 원본 L487

시작 배너를 띄운다. 떠 있는 동안 보조 레이아웃은 그리지 않고,
**보드 입력도 받지 않는다** - 배너가 완전히 사라져야(`endIntro()`) 조작이 열린다.
그래서 CoreAPI 가 레벨 로드에서 `setInputEnabled(true)` 를 먼저 불러도
배너가 떠 있는 동안에는 칸을 눌러도 아무 일이 일어나지 않는다.

**얼마나 떠 있을지는 여기서 정하지 않는다.** 순수 계층에는 타이머가 없으므로
패널이 표시·페이드 아웃을 마친 뒤 `endIntro()` 를 부른다.

## `this.cancelPress();`

> 원본 L500

배너가 뜨면 입력이 얼어붙으므로, 열려 있던 누름을 그대로 두면 영영 안 놓인다

## `public unlockIntroInput(): void {`

> 원본 L507

배너는 아직 떠 있지만 **보드 입력은 먼저 연다** - 패널이 페이드 아웃을 시작할 때 부른다.

예전에는 배너가 완전히 잦아든 뒤에야 입력이 열려, 레벨이 시작되고 약 1초 동안
첫 터치가 그냥 삼켜졌다. 배너는 보조 레이아웃 자리에 뜨므로 판을 가리지 않는다 -
잦아드는 배너를 기다리게 할 이유가 없다. 배너가 **완전히 보이는 동안**만 잠근다.

## `public endIntro(): void {`

> 원본 L518

 배너를 내린다 - 이 시점에 보조 레이아웃이 나타난다. 입력은 보통 페이드 시작에 먼저 열린다

## `public setInputEnabled(isEnabled: boolean): void {`

> 원본 L528

#endregion

## `public setInputEnabled(isEnabled: boolean): void {`

> 원본 L530

#region Input (패널의 Pressable 이 부른다)

## `public setInputEnabled(isEnabled: boolean): void {`

> 원본 L532

 일시정지·연출 중에는 꺼 둔다. 끄면 진행 중이던 누름도 취소된다

## `private canAcceptInput(): boolean {`

> 원본 L543

지금 새 누름을 받을 수 있는지 - 입력 스위치가 켜져 있고, 시작 배너의 잠금이 풀린 뒤여야 한다.
잠금은 배너가 **완전히 보이는 동안**만이다 - 페이드가 시작되면 패널이 `unlockIntroInput()` 으로
먼저 연다 (배너가 다 잦아들 때까지 기다리면 첫 터치가 삼켜져 반응이 느리게 느껴진다).

## `this.warnOnLostRelease('cell');`

> 원본 L557

앞 누름이 열려 있는데 새 down 이 왔다 - **앞 터치의 release 가 유실된 것이다.**

모바일 `Pressable` 은 누른 요소 밖으로 끌고 나가 손을 떼면 release 를 어느
요소에도 전달하지 않는 경우가 있다. 예전처럼 새 down 을 무시하면(단일 터치
강제) 드래그가 영구히 붙잡혀, **다음 탭의 release 가 올 때까지 조각이 놓이지
않았다** - "떼도 안 놓이고 한 번 더 터치해야 놓인다" 신고의 정체다.
3D 시절 터치 라우터(`PuzzleTouchRouter.handleTouchStart`)와 같은 회복 규칙로,
붙잡힌 누름을 마지막으로 올라가 있던 진짜 칸에 놓아 마감하고 새 터치를 받는다.

**회복이 돌았다는 것은 곧 앞 터치의 뗌을 아무도 받지 못했다는 뜻이다.** 플레이어
눈에는 "손을 떼도 안 놓이고 한 번 더 눌러야 놓인다" 로 보이므로, 조용히 고치지 말고
남긴다 - 인월드에서만 재현되는 증상이라 이 줄이 유일한 단서다.

## `return;`

> 원본 L573

보이지 않는 칸은 보드의 일부가 아니다 (스위치의 FREE 좌표 - PUZ_08 §4)

## `this.publishPress();`

> 원본 L579

표시를 먼저 옮긴 뒤 세션에 알린다. 세션이 칸을 다시 칠하더라도 누름 표시는
칸 상태와 별개로 관리되므로 서로 덮어쓰지 않는다.

## `public itemDown(item: number): void {`

> 원본 L587

보조 레이아웃의 오브젝트 슬롯을 집었다.

아직 판 위가 아니므로 hover 는 보드 밖에서 시작한다. 곧바로 떼면 `onItemTap`,
판으로 끌고 가면 그때부터는 칸에서 시작한 누름과 완전히 같은 경로다.

## `this.warnOnLostRelease('item');`

> 원본 L598

pointerDown() 과 같은 회복 규칙 - 유실된 release 를 새 down 에서 마감한다

## `this._lastInsideCell = PUZZLE_BOARD_CELL_OUTSIDE;`

> 원본 L607

아직 판에 들어오지 않았다 - 여기서 그대로 떼면 "판 밖" 이 맞다

## `public requestReset(): boolean {`

> 원본 L615

리셋 버튼을 눌렀다 - 판을 풀기 전 상태로 되돌린다.

입력이 꺼져 있을 때(일시정지·결과 화면)는 받지 않는다. 진행 중이던 누름은
되돌아갈 판이 사라지므로 먼저 마감한다.

## `public requestAction(): boolean {`

> 원본 L630

보조 레이아웃의 큰 액션 버튼을 눌렀다 - 타이밍 입력이므로 지체 없이 세션에 넘긴다.
리셋과 같은 게이트(입력 꺼짐 무시)를 쓰되, 진행 중 누름은 취소하지 않는다 -
액션 버튼은 격자 누름과 영역이 겹치지 않아 서로 방해할 일이 없다.

## `public pointerEnter(cell: number): void {`

> 원본 L643

누른 채로 다른 칸에 들어갔다.
보이지 않는 칸(보드의 구멍)에 들어간 것은 보드 밖으로 나간 것과 같게 다룬다.

## `public pointerExit(cell: number): void {`

> 원본 L662

누른 채로 이 칸에서 빠져나갔다 - 스위치의 "다운한 칸 밖" 판정에 쓴다 (PUZ_08 M2).

**칸 번호를 받는 것이 중요하다.** A→B 로 옮겨 갈 때 UI 는 `onExit(A)` 와 `onEnter(B)` 를
내는데 둘의 순서가 보장되지 않는다. 지금 올라가 있는 칸이 A 일 때만 밖으로 처리하면
어느 순서로 와도 결과가 같다.

## `public pointerLeaveBoard(): void {`

> 원본 L676

격자 바깥 영역으로 나갔다 (패널 배경). 지금 칸이 무엇이든 밖으로 만든다.

**여기서만 "마지막 진짜 칸" 까지 지운다.** 칸끼리 오갈 때 스쳐 가는 `onExit` 와 달리
이것은 격자 밖 배경이 보내는 명시적인 신호라, 판을 진짜로 벗어났다고 볼 수 있다.

## `public pointerUp(): void {`

> 원본 L690

손가락을 뗐다.

뗀 칸은 출발지가 칸이든 슬롯이든 언제나 `onCellUp` 으로 나간다 - 세션이 드랍 지점만
알면 되기 때문이다. 그 위에 편의 콜백이 하나 더 붙는다.
  칸에서 시작해 같은 칸에서 뗐다  -> onCellTap
  슬롯에서 시작해 판 밖에서 뗐다  -> onItemTap (끌지 않고 툭 누른 경우)

## `const releasedCell = this._hoverCell !== PUZZLE_BOARD_CELL_OUTSIDE`

> 원본 L703

뗄 때 `onExit` 가 먼저 와서 hover 가 지워졌더라도, 마지막으로 올라가 있던 칸에
놓은 것으로 본다. 판을 진짜로 벗어났다면 그 값도 이미 밖이다 (머리말 참고).

## `private warnOnLostRelease(kind: string): void {`

> 원본 L724

진행 중이던 누름을 좌표 없이 마감한다.

패널이 내려가거나 입력이 꺼질 때 부른다. 부르지 않으면 세션의 입력 컨트롤러가
"누르고 있는 중" 으로 남아 다음 터치를 거절한다.


앞 누름이 열린 채 새 누름이 들어왔다 - **뗌이 유실됐다는 증거**를 남긴다.

회복 자체는 `pointerUp()` 이 하지만, 회복이 돌았다는 사실은 사라지면 안 된다.
뗌은 칸·격자 상자·보조 영역·전면 캐처·Focused Interaction 스트림 다섯 곳에서 오는데
그 다섯이 전부 오지 않았다는 뜻이라, 어떤 상황에서 그런지는 인월드 로그로만 좁힐 수 있다.
몇 번째 드래그에서 났는지 보이도록 지금까지 회복한 횟수를 함께 적는다.

