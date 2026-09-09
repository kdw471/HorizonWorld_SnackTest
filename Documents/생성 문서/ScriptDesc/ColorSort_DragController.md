# ColorSort_DragController.ts — 주석 아카이브

> 원본 스크립트: `ColorSort_DragController.ts`
> 걷어낸 주석 29건 / 4,028 B 절감 (9,596 B → 5,568 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Color Sort Drag Controller - 모바일 단일 터치 드래그 앤 드롭 (PUZ_03)

원본 사양 §8 은 VR 기준(양손 그랩)이다. 모바일에서는 다음과 같이 대체한다.

  - **단일 터치 전용.** 동시에 한 뭉치만 집는다. 조작 중 추가 터치는 완전히 무시한다.
    따라서 §8 의 "양손 그랩" 과 "같은 케이스의 오브젝트를 2개 이상 잡을 수 없다" 는
    구조적으로 성립하지 않으므로 별도 처리가 필요 없다.
  - 그랩 시 **최상위 오브젝트만** 집힌다. 단 같은 색이 연속되면 함께 집힌다 (최대 3개, §6).
  - 드래그 중 올바른 케이스 위에 있으면 **미리보기가 활성화**되고, 놓을 수 없으면 비활성이다.
  - **영역 밖에서 드랍하면 2초 후 이전 위치에 리스폰**되며, 그때까지 해당 케이스는 잠금이다 (§8 드랍).

구현상 드래그 중에도 건전지는 케이스에 그대로 둔다. 화면에서 손에 붙어 보이는 것은 연출이며,
로직상으로는 드랍이 확정될 때 한 번에 이동한다. 이렇게 하면 드래그 도중 상태가 갈라지지 않는다.

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `export type ColorSortDragBeginResult = {`

> 원본 L28

#region Types

## `count?: number,`

> 원본 L33

 함께 집힌 개수 (1~3)

## `batteries?: Battery[],`

> 원본 L35

 집힌 건전지들 - 연출용

## `export type ColorSortDragPreview = {`

> 원본 L40

 드래그 중 특정 케이스 위에 있을 때의 미리보기 - §8 드랍

## `hoverCaseIndex?: number,`

> 원본 L43

 지금 가리키고 있는 케이스. 영역 밖이면 undefined

## `isPreviewActive: boolean,`

> 원본 L46

 미리보기 활성 여부. 놓을 수 없는 위치에서는 false

## `didMove: boolean,`

> 원본 L54

 이동이 성사되었는지

## `isRespawning: boolean,`

> 원본 L57

 영역 밖/무효 위치에 놓아 리스폰 대기에 들어갔는지 - §8

## `export type ColorSortRespawnResult = {`

> 원본 L62

 리스폰이 끝났을 때 알려줄 정보

## `export class ColorSortDragController {`

> 원본 L67

#endregion

## `private _respawns: { caseIndex: number, remaining: number }[] = [];`

> 원본 L77

리스폰 대기 중인 케이스들과 남은 시간.
앞선 리스폰이 끝나기 전에 다른 케이스를 또 영역 밖에 드랍할 수 있으므로
슬롯 하나가 아니라 목록으로 관리한다. 각 드랍은 자기만의 2초를 온전히 기다린다 (§8).

## `public begin(caseIndex: number): ColorSortDragBeginResult {`

> 원본 L101

#region Drag lifecycle

## `public begin(caseIndex: number): ColorSortDragBeginResult {`

> 원본 L103

케이스의 최상단 뭉치를 집는다 - §8 그랩.
닫힘/비활성/잠금 케이스에서는 집을 수 없다.

## `return { isAccepted: false, reason: 'already-dragging' };`

> 원본 L109

단일 터치 전용 - 조작 중 추가 터치는 무시

## `public hover(caseIndex: number | undefined): ColorSortDragPreview | undefined {`

> 원본 L138

드래그 중 가리키는 케이스를 갱신한다 - §8 드랍 미리보기.
`caseIndex` 가 undefined 면 퍼즐 영역 밖을 가리키는 중이다.

## `isPreviewActive: check.isValid,`

> 원본 L165

놓을 수 없는 위치에서는 미리보기가 활성화되지 않는다

## `public end(dropCaseIndex?: number): ColorSortDragEndResult | undefined {`

> 원본 L171

손을 뗀다.
  - 유효한 케이스 위면 이동을 확정한다.
  - 영역 밖이거나 놓을 수 없는 위치면 **2초 뒤 이전 위치로 리스폰**하며,
    그때까지 출발 케이스를 잠근다 (§8 드랍).

## `const target = dropCaseIndex === undefined`

> 원본 L183

NaN(평면 뒤 릴리즈 등 좌표를 만들 수 없는 드랍)은 명시적인 "영역 밖 드랍"으로 취급한다.
undefined(인자 생략)와 달리 마지막 hover 케이스로 폴백하지 않는다 - 폴백하면
케이스 위를 지나던 드래그가 평면 뒤에서 끝났을 때 의도치 않은 이동이 확정된다.

## `return {`

> 원본 L194

집었던 케이스 위에 그대로 놓은 경우 - 이동도 벌점도 없다.
건전지가 이미 "이전 위치"에 있으므로 리스폰 대기(2초 잠금)를 걸 이유가 없다.

## `this.beginRespawn(fromCaseIndex);`

> 원본 L229

영역 밖에 드랍

## `public cancel(): void {`

> 원본 L240

 드래그를 취소한다 (일시정지 등). 리스폰 대기 없이 즉시 놓아준다

## `public update(deltaSeconds: number): ColorSortRespawnResult[] {`

> 원본 L247

#endregion

## `public update(deltaSeconds: number): ColorSortRespawnResult[] {`

> 원본 L249

#region Respawn timer (§8 드랍)

## `public update(deltaSeconds: number): ColorSortRespawnResult[] {`

> 원본 L251

리스폰 타이머를 진행시킨다. 매 프레임 세션이 호출한다.
이번 프레임에 리스폰이 끝난 케이스들을 돌려주고 잠금을 푼다.

## `public getRespawnRemainingSeconds(): number {`

> 원본 L276

 리스폰까지 남은 시간(초). 여러 건이면 가장 오래 남은 시간

## `public flushRespawn(): void {`

> 원본 L285

 대기 중인 리스폰을 전부 즉시 끝낸다 (라운드 전환 등)

## `this._respawns.push({ caseIndex: caseIndex, remaining: this._respawnSeconds });`

> 원본 L294

잠긴 케이스는 다시 집을 수 없으므로 같은 케이스가 중복 등록될 일은 없다

## `}`

> 원본 L299

#endregion

