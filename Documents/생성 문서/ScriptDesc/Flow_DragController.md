# Flow_DragController.ts — 주석 아카이브

> 원본 스크립트: `Flow_DragController.ts`
> 걷어낸 주석 20건 / 2,058 B 절감 (5,136 B → 3,078 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Flow Drag Controller - 모바일 단일 터치 그리기 (PUZ_05)

원본 §6 은 VR 기준이지만 이미 "양손을 동시에 사용할 수 없다" 고 못박고 있어
모바일 단일 터치와 자연스럽게 맞는다. 모바일에서는 이렇게 구현한다.

  - **단일 터치 전용.** 조작 중 들어오는 추가 터치는 완전히 무시한다 (§6 양손 금지).
  - 메인 오브젝트(출발점) 또는 이미 그린 경로의 **머리**를 눌러 그리기를 시작한다.
  - 손가락을 끌면 지나간 칸이 순서대로 이어진다. 대각선은 이어지지 않는다 (§5).
  - 그렸던 길을 그대로 되짚으면 서브 오브젝트가 꺼진다 (§6 지우기 / §9.3).
  - **손을 떼도 그린 경로는 그대로 남는다** (§6 그랩 해제).

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `export type FlowDragBeginResult = {`

> 원본 L23

#region Types

## `isResuming?: boolean,`

> 원본 L28

 이어 그리기인지 (이미 그린 경로의 머리를 잡았는지)

## `export type FlowDragPreview = {`

> 원본 L33

 드래그 중 특정 칸 위에 있을 때의 미리보기

## `cell: FlowCell,`

> 원본 L36

 지금 가리키고 있는 칸

## `canExtend: boolean,`

> 원본 L38

 이어질 수 있는지

## `isUndo: boolean,`

> 원본 L40

 이 이동이 지우기인지 - §6

## `extendedCount: number,`

> 원본 L43

 이번 드래그에서 실제로 이어진 칸 수

## `extendedCount: number,`

> 원본 L49

 이번 드래그에서 새로 이어진 칸 수

## `undoneCount: number,`

> 원본 L51

 이번 드래그에서 지운 칸 수

## `isPathComplete: boolean,`

> 원본 L53

 경로가 도착 지점까지 완결되었는지

## `export class FlowDragController {`

> 원본 L57

#endregion

## `public begin(row: number, col: number): FlowDragBeginResult {`

> 원본 L78

#region Drag lifecycle

## `public begin(row: number, col: number): FlowDragBeginResult {`

> 원본 L80

그리기를 시작한다.
출발 메인 오브젝트이거나 이미 그린 경로의 머리여야 한다 (§6).

## `return { isAccepted: false, reason: 'already-drawing' };`

> 원본 L86

단일 터치 전용 - 양손 동시 사용 금지 (§6)

## `public moveTo(row: number, col: number): FlowDragPreview | undefined {`

> 원본 L107

손가락이 지나가는 칸을 알린다.
이어질 수 있으면 잇고, 되짚는 이동이면 지운다.

## `return {`

> 원본 L119

머리 위에 그대로 있는 경우 - 아무 일도 일어나지 않는다

## `public end(): FlowDragEndResult | undefined {`

> 원본 L151

손을 뗀다 - §6 그랩 해제.
그린 경로는 그대로 남고, 손과의 연결만 끊어진다.

## `public cancel(): void {`

> 원본 L174

 그리기를 취소한다. 경로는 그대로 남는다 (§6 과 동일)

## `}`

> 원본 L181

#endregion

