# RushHour_DragController.ts — 주석 아카이브

> 원본 스크립트: `RushHour_DragController.ts`
> 걷어낸 주석 55건 / 7,516 B 절감 (18,004 B → 10,488 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Rush Hour Drag Controller - 모바일 단일 터치 드래그 앤 드롭 조작

모바일 사양 `Documents/Prompts/Rush_Hour_Mobile_Specification.md` §7 / §8 / §9 구현.

  §8 단일 터치 전용 : 동시에 한 오브젝트만 드래그. 조작 중 들어오는 추가 터치는 완전히 무시.
  §8 히트박스 보정  : 터치 지점 중심부에 가장 가까운 오브젝트 하나만 선택.
  §8 화면 이탈      : 포인터가 영역 밖으로 나가도 드래그는 유지되고 최외곽 경계에 고정.
  §7 스냅           : 드래그 종료 시 중심이 위치한 칸으로 반올림 스냅. 막히면 막히기 직전 칸.
  §9 USB 결합       : 도착 포인트 전면(READY)에서 슬롯 방향으로 더 끌면 꽂히고,
                      반대로 끌면 다시 뽑힌다. 꽂힌 상태는 3칸을 점유한다.

이 클래스는 horizon/core 에 의존하지 않는 순수 로직이다 (PUZ_00 §7.1).
화면 좌표 -> 보드 격자 좌표(실수) 변환은 어댑터 계층의 책임이며,
이 컨트롤러는 이미 변환된 "플레이 로컬 격자 좌표(실수)"만 받는다.

## `export enum EDragAxis {`

> 원본 L30

#region Types

## `export enum EDragAxis {`

> 원본 L32

 드래그가 움직이는 축

## `ROW = 'ROW',`

> 원본 L34

 세로 이동 - row 값이 변한다

## `COL = 'COL',`

> 원본 L36

 가로 이동 - col 값이 변한다

## `UNDECIDED = 'UNDECIDED',`

> 원본 L38

 1x1(FREE) 오브젝트가 아직 축을 확정하지 않은 상태

## `reason?: string,`

> 원본 L45

 거절 사유 (디버그/로그용)

## `export type DragVisualState = {`

> 원본 L49

 어댑터가 매 프레임 오브젝트를 그릴 때 쓰는 상태

## `row: number,`

> 원본 L52

 현재 표시할 연속 좌표 (플레이 로컬, 실수). 좌측·상단 블록 중심 기준

## `dockProgress: number,`

> 원본 L56

 슬롯으로 밀어 넣은 정도 0..1 (§9). 1 에 가까울수록 결합 직전

## `isDocked: boolean,`

> 원본 L58

 현재 꽂혀 있는지

## `export type DragEndResult = {`

> 원본 L62

 드래그 종료 결과

## `move?: RushHourMove,`

> 원본 L65

 실제로 칸을 이동했다면 그 이동 내용

## `didDock: boolean,`

> 원본 L67

 이번 드래그로 USB 가 꽂혔는지 (§9)

## `didUndock: boolean,`

> 원본 L69

 이번 드래그로 USB 가 뽑혔는지 (§9)

## `row: number,`

> 원본 L71

 스냅이 끝난 최종 격자 좌표

## `selectionRadiusInCells?: number,`

> 원본 L77

터치 지점에서 이 거리(칸 단위) 안에 있는 오브젝트까지 선택 대상으로 본다 - §8 히트박스 보정.
0.5 면 칸 경계까지, 그보다 크면 살짝 빗나간 터치도 잡아준다.

## `axisLockThresholdInCells?: number,`

> 원본 L82

1x1(FREE) 오브젝트의 축을 확정하는 데 필요한 최소 이동량(칸 단위).
이보다 적게 움직이면 아직 축을 정하지 않는다.

## `dockThreshold?: number,`

> 원본 L87

결합/분리를 확정하는 슬롯 진입 비율 (0..1) - §9.
0.5 면 슬롯 쪽으로 반 칸 이상 밀어 넣었을 때 꽂힌다.

## `const DEFAULT_AXIS_LOCK_THRESHOLD = 0.12;`

> 원본 L95

0.25 였을 때 1x1 오브젝트가 "끌었는데 따라오지 않는다" 로 느껴졌다 (감도 신고).
칸 단위 입력에서는 한 칸을 넘어가는 순간이 첫 이동량이므로, 임계값을 낮춰
축이 더 일찍 확정되게 한다. 0 으로 두지 않는 이유: 탭 수준의 지터로 축이
잘못 잠기는 것은 막아야 한다 (§7).

## `const DOCK_TRAVEL_IN_CELLS = 1;`

> 원본 L104

 결합 시 USB 가 슬롯 안으로 더 들어가는 칸 수 (§9 - 총 3칸 점유)

## `export class RushHourDragController {`

> 원본 L107

#endregion

## `private _originRow: number = 0;`

> 원본 L118

 드래그를 시작한 시점의 오브젝트 격자 좌표

## `private _touchOriginRow: number = 0;`

> 원본 L121

 드래그를 시작한 시점의 터치 격자 좌표

## `private _minValue: number = 0;`

> 원본 L125

 축 방향 이동 가능 범위 (오브젝트 좌표 기준, 결합 슬롯 포함)

## `private _dockValue: number | undefined = undefined;`

> 원본 L128

 결합이 가능한 경우의 슬롯 좌표. 불가능하면 undefined

## `private _flushValue: number = 0;`

> 원본 L130

 결합 판정에 쓰는 밀착 좌표

## `private _currentValue: number = 0;`

> 원본 L133

 현재 표시 중인 연속 축 좌표

## `private _beginValue: number = 0;`

> 원본 L135

드래그 시작 시점의 축 좌표. update() 의 기준점이다.
결합된 USB 는 저장 좌표(밀착)가 아니라 슬롯 좌표에서 드래그가 시작되므로,
저장 좌표를 기준으로 삼으면 첫 update 만으로 반 칸 이상 이동한 셈이 되어
탭 수준의 지터에도 분리가 확정돼 버린다 (§9 반 칸 드래그 규칙 위반).

## `private _wasDockedOnBegin: boolean = false;`

> 원본 L142

 드래그 시작 시점의 결합 여부

## `public findPieceAt(gridRow: number, gridCol: number): RushHourPiece | undefined {`

> 원본 L160

#region Selection

## `public findPieceAt(gridRow: number, gridCol: number): RushHourPiece | undefined {`

> 원본 L162

터치 지점에서 가장 가까운 선택 가능 오브젝트를 찾는다 - §8.
오브젝트가 점유한 각 칸의 중심까지의 거리를 재고, 가장 가까운 하나만 돌려준다.

## `public begin(gridRow: number, gridCol: number): DragBeginResult {`

> 원본 L188

#endregion

## `public begin(gridRow: number, gridCol: number): DragBeginResult {`

> 원본 L190

#region Drag lifecycle

## `public begin(gridRow: number, gridCol: number): DragBeginResult {`

> 원본 L192

드래그를 시작한다 - §8.
이미 다른 오브젝트를 조작 중이면 추가 터치를 완전히 무시한다 (단일 터치 전용).

## `return { isAccepted: false, reason: 'already-dragging' };`

> 원본 L198

멀티터치 차단 - §8

## `public rebaseTouchOrigin(gridRow: number, gridCol: number): boolean {`

> 원본 L233

터치 기준점을 실제 터치 좌표로 되돌려 잡는다 - 아직 움직이기 전에만 부른다.

`begin()` 이 받는 좌표는 칸 `Pressable` 이 알려 준 **칸 중심(정수)** 이다. 그 뒤의
`update()` 가 연속 좌표로 오면, 칸 가장자리를 잡은 경우 손가락이 거의 움직이지 않았는데도
delta 가 반 칸을 넘어 오브젝트가 한 칸 튄다. 화면 좌표 스트림이 실제 터치 지점을 알려 주면
여기로 기준점만 바꾼다 - 오브젝트의 시작 위치(`_beginValue`)와 이동 범위는 그대로다.
이미 축을 정하고 움직인 뒤(1x1 의 축 확정 포함)에는 기준점을 옮기면 오브젝트가 튀므로 무시한다.

## `public update(gridRow: number, gridCol: number): DragVisualState | undefined {`

> 원본 L254

드래그 위치를 갱신한다 - §7 / §8.
포인터가 퍼즐 영역 밖으로 나가도 드래그는 유지되며, 이동 가능한 최외곽에 고정된다.

## `return this.buildVisualState();`

> 원본 L263

NaN 좌표(평면 뒤 ray 등)는 경계 클램프를 통과해 _currentValue 를 오염시키므로 무시한다

## `const absRow = Math.abs(rowDelta);`

> 원본 L271

1x1(FREE) 은 처음 유의미하게 움직인 방향으로 축을 확정한다 - §7 "허용된 축 값만 유지"

## `this._beginValue = this.getOriginValue();`

> 원본 L279

축이 정해지면 기준 좌표의 의미(행/열)가 바뀌므로 다시 잡는다 (1x1 은 결합이 없다)

## `this._currentValue = Math.min(this._maxValue, Math.max(this._minValue, desired));`

> 원본 L286

영역 밖으로 나가도 경계에 고정 - §8

## `public end(): DragEndResult | undefined {`

> 원본 L292

드래그를 끝내고 스냅한다 - §7.
결합/분리 판정도 여기서 확정한다 - §9.

## `if (dockValue !== undefined) {`

> 원본 L312

슬롯 진입 판정 - §9

## `this.snapPieceToAxisValue(pieceId, axis, flushValue);`

> 원본 L318

먼저 밀착 위치까지 이동시킨 뒤 꽂는다

## `if (didUndock === false && this._board.getGoalStatus(pieceId) === EGoalStatus.READY) {`

> 원본 L331

**도착 포인트에 닿기만 해도 꽂힌다.**
슬롯 쪽으로 반 칸 더 미는 조작(§9)은 판 밖의 테두리 칸을 짚어야 해서
눈에 보이지 않고, "USB 를 삽입구에 붙였는데 클리어가 안 된다" 는 신고로 이어졌다.
그래서 밀착까지 끌어온 것만으로 결합을 확정한다. 반 칸 더 미는 조작도 그대로 동작한다.

방금 뽑은(didUndock) 드래그는 제외한다 - 뽑자마자 다시 꽂혀 분리가 불가능해진다.

## `public cancel(): void {`

> 원본 L353

 드래그를 취소하고 오브젝트를 원래 칸에 그대로 둔다

## `private getOriginValue(): number {`

> 원본 L358

#endregion

## `private getOriginValue(): number {`

> 원본 L360

#region Internal

## `private recomputeRange(): void {`

> 원본 L366

현재 축에서 이동 가능한 연속 범위를 다시 계산한다.
드래그 중에는 다른 오브젝트가 움직이지 않으므로 시작 시점에 한 번 구해두면 된다.

## `private recomputeDockRange(pieceId: string, origin: number): void {`

> 원본 L394

목표 USB 가 이번 드래그로 슬롯까지 갈 수 있으면, 이동 범위를 슬롯 쪽으로 1칸 더 넓힌다 - §9.
이미 꽂혀 있는 경우에도 범위를 넓혀 두어야 반대 방향으로 끌어 뽑을 수 있다.

## `const flush = getFlushAxisValue(piece, endPoint);`

> 원본 L420

밀착 좌표는 **도착 포인트에서 거꾸로 푼다.** 플레이 공간의 바깥 변으로 가정하면
도착 포인트가 7x7 안쪽에 있는 기획 CSV 판에서 영원히 어긋난다 (getFlushAxisValue 주석).

## `const status = this._board.getGoalStatus(pieceId);`

> 원본 L424

이번 드래그로 밀착 위치까지 갈 수 있어야 결합 후보가 된다.
꽂힌 USB 는 보드 좌표가 곧 밀착 좌표이므로 (dock 전에 밀착까지 옮긴다) 언제나 후보다.

## `private snapPieceToAxisValue(pieceId: string, axis: EDragAxis, value: number): RushHourMove | undefined {`

> 원본 L444

 축 좌표를 실제 보드 이동으로 옮긴다

## `}`

> 원본 L504

#endregion

