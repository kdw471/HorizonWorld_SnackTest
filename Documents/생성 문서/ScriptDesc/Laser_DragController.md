# Laser_DragController.ts — 주석 아카이브

> 원본 스크립트: `Laser_DragController.ts`
> 걷어낸 주석 30건 / 3,015 B 절감 (9,315 B → 6,300 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Laser Drag Controller - 모바일 단일 터치 드래그 앤 드롭 (PUZ_01)

러시아워와 같은 조작 규격을 따른다.
  - 동시에 한 개의 크리스탈만 드래그한다. 조작 중 들어오는 추가 터치는 완전히 무시한다.
  - 터치 지점에 가장 가까운 대상 하나만 선택한다 (히트박스 보정).
  - 포인터가 영역 밖으로 나가도 드래그는 유지되고, 놓으면 원래 자리로 돌아간다.
  - 놓았을 때 중심이 위치한 칸으로 반올림 스냅한다.

러시아워와 다른 점: 크리스탈은 **인벤토리에서 필드로** 옮기거나
**필드에서 회수**할 수 있다. 방향은 배치 후 바꿀 수 없다 (§3 3.4).

좌표는 어댑터가 변환한 "배치 로컬 격자 좌표(실수)" 를 받는다.
`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `export enum EDragOrigin {`

> 원본 L23

#region Types

## `export enum EDragOrigin {`

> 원본 L25

 드래그가 어디에서 시작했는지

## `INVENTORY = 'INVENTORY',`

> 원본 L27

 인벤토리 슬롯에서 꺼내는 중

## `BOARD = 'BOARD',`

> 원본 L29

 이미 필드에 놓인 것을 옮기는 중

## `export type LaserDragVisualState = {`

> 원본 L40

 어댑터가 매 프레임 크리스탈을 그릴 때 쓰는 상태

## `row: number,`

> 원본 L44

 현재 표시할 연속 좌표 (배치 로컬, 실수)

## `targetRow?: number,`

> 원본 L47

 놓으면 들어갈 칸. 놓을 수 없으면 undefined

## `isValidTarget: boolean,`

> 원본 L50

 지금 놓아도 되는 자리인지 - 하이라이트 색 결정에 쓴다

## `didPlace: boolean,`

> 원본 L57

 필드에 놓였는지

## `didReturnToInventory: boolean,`

> 원본 L59

 인벤토리로 회수되었는지

## `row?: number,`

> 원본 L61

 놓인 칸 (didPlace 일 때만)

## `selectionRadiusInCells?: number,`

> 원본 L68

 터치 지점에서 이 거리(칸 단위) 안의 크리스탈까지 선택 대상으로 본다

## `export class LaserDragController {`

> 원본 L74

#endregion

## `private _sourceRow: number = 0;`

> 원본 L82

 BOARD 에서 시작했을 때의 원래 칸 - 취소 시 되돌린다

## `public findCrystalAt(gridRow: number, gridCol: number, movableOnly: boolean = false): LaserCrystal | undefine…`

> 원본 L102

#region Selection

## `public findCrystalAt(gridRow: number, gridCol: number, movableOnly: boolean = false): LaserCrystal | undefine…`

> 원본 L104

 터치 지점에서 가장 가까운, 필드에 놓인 크리스탈

## `public beginFromInventory(crystalId: string): LaserDragBeginResult {`

> 원본 L128

#endregion

## `public beginFromInventory(crystalId: string): LaserDragBeginResult {`

> 원본 L130

#region Drag lifecycle

## `public beginFromInventory(crystalId: string): LaserDragBeginResult {`

> 원본 L132

 인벤토리 슬롯의 크리스탈을 집는다

## `return { isAccepted: false, reason: 'already-dragging' };`

> 원본 L135

단일 터치 전용 - 조작 중 추가 터치는 무시

## `public beginFromBoard(gridRow: number, gridCol: number): LaserDragBeginResult {`

> 원본 L151

필드에 놓인 크리스탈을 집어 옮긴다.
고정 크리스탈은 집을 수 없다 (§4.3).

## `const crystal = this.findCrystalAt(gridRow, gridCol, true);`

> 원본 L160

반경 안의 "움직일 수 있는" 크리스탈 중 최근접을 고른다.
고정 크리스탈이 조금 더 가깝다는 이유로 드래그 전체가 거절되면 안 된다 (PUZ_00 §8.2).

## `if (this.findCrystalAt(gridRow, gridCol) !== undefined) {`

> 원본 L164

이동 가능 필터로 못 찾았는데 무필터로는 찾았다면 반경 안에 고정 크리스탈뿐이다

## `public update(gridRow: number, gridCol: number): LaserDragVisualState | undefined {`

> 원본 L188

 드래그 위치를 갱신한다. 영역 밖으로 나가도 드래그는 유지된다

## `public end(): LaserDragEndResult | undefined {`

> 원본 L213

손을 뗀다.
  - 배치 영역의 빈 칸 위면 그 칸에 스냅해 놓는다
  - 그 밖이면: 인벤토리에서 꺼낸 것은 인벤토리로 돌아가고,
    필드에서 집은 것은 인벤토리로 회수된다 (§3 3.3 - 다시 놓을 수 있다)

## `if (origin === EDragOrigin.BOARD) {`

> 원본 L233

영역 밖에 놓았다 - 필드에 있던 것은 인벤토리로 회수한다

## `return { crystalId: crystalId, origin: origin, didPlace: false, didReturnToInventory: true };`

> 원본 L243

인벤토리에서 꺼낸 것은 그대로 인벤토리에 남는다

## `public cancel(): void {`

> 원본 L272

 드래그를 취소한다. 크리스탈은 원래 자리에 그대로 남는다

## `private reset(): void {`

> 원본 L277

#endregion

