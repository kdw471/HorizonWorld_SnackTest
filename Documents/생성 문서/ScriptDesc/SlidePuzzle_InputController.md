# SlidePuzzle_InputController.ts — 주석 아카이브

> 원본 스크립트: `SlidePuzzle_InputController.ts`
> 걷어낸 주석 19건 / 2,289 B 절감 (4,219 B → 1,930 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Slide Puzzle Input Controller - 모바일 단일 터치 입력 (PUZ_07)

원본 §5 는 VR 양손 기준으로 "먼저 눌린 조각 하나만 이동되며 두 번째 인터랙션은 무시된다" 고 정한다.
모바일에서도 멀티터치가 가능하므로 같은 규칙을 적용한다.

  - **같은 프레임에 여러 조각이 눌리면 타임스탬프가 빠른 쪽만 채택**하고 나머지는 폐기한다 (§12.4).
  - 조각이 이동하는 0.25초 동안에는 모든 칸의 입력이 막힌다 (§6).
  - 완성 판정이 나면 즉시 모든 입력이 막힌다 (§5).

호버는 VR 개념이지만, 모바일에서도 "지금 누를 수 있는 조각"을 미리 표시하는 데 그대로 쓴다.
인접한 빈 칸이 없는 조각에는 Emissive 를 켜지 않는다 (§5).

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `export type SlideTouchInput = {`

> 원본 L24

 같은 프레임에 들어온 입력 하나

## `position: number,`

> 원본 L26

 조각의 보드 위치

## `timestampMs: number,`

> 원본 L28

 입력 시각 (ms). 작을수록 먼저 눌린 것이다

## `private _pendingInputs: SlideTouchInput[] = [];`

> 원본 L35

 이번 프레임에 모인 입력들

## `public canHighlight(position: number): boolean {`

> 원본 L42

#region Hover (§5)

## `public canHighlight(position: number): boolean {`

> 원본 L44

이 조각에 호버 Emissive(#FF5C41)를 켤 수 있는지 - §5.
인접한 빈 칸이 없거나 입력이 잠긴 상태면 켜지 않는다.

## `public getHighlightablePositions(): number[] {`

> 원본 L52

 지금 누를 수 있는 조각들 - UI 가 한 번에 표시할 때 쓴다

## `public queueTouch(position: number, timestampMs: number): void {`

> 원본 L57

#endregion

## `public queueTouch(position: number, timestampMs: number): void {`

> 원본 L59

#region Touch

## `public queueTouch(position: number, timestampMs: number): void {`

> 원본 L61

터치를 접수한다. 즉시 처리하지 않고 이번 프레임의 후보로 모아 둔다.
`flush()` 에서 가장 먼저 눌린 하나만 채택한다 (§5 / §12.4).

## `public flush(): SlideMoveResult | undefined {`

> 원본 L69

모인 입력 중 **타임스탬프가 가장 빠른 하나만** 처리하고 나머지는 폐기한다 - §12.4.
처리할 입력이 없으면 undefined 를 돌려준다.

## `public touch(position: number): SlideMoveResult {`

> 원본 L91

터치를 즉시 하나만 처리한다 (단일 터치가 보장되는 경우의 간편 경로).
큐에 남아 있던 입력은 버린다.

## `public clearPending(): void {`

> 원본 L100

 모아 둔 입력을 버린다 (일시정지, 라운드 전환 등)

## `public get pendingCount(): number {`

> 원본 L105

 이번 프레임에 모인 입력 수 - 디버그/테스트용

## `public get isInputAccepted(): boolean {`

> 원본 L110

#endregion

## `public get isInputAccepted(): boolean {`

> 원본 L112

 지금 입력을 받을 수 있는지

## `public peekRejection(position: number): ESlideRejection {`

> 원본 L117

 거절 사유만 미리 확인한다 (UI 피드백용)

## `public static didMove(result: SlideMoveResult | undefined): boolean {`

> 원본 L128

 마지막 결과가 실제 이동이었는지 판별하는 편의 함수

