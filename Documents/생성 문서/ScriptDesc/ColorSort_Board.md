# ColorSort_Board.ts — 주석 아카이브

> 원본 스크립트: `ColorSort_Board.ts`
> 걷어낸 주석 32건 / 3,156 B 절감 (11,122 B → 7,966 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Color Sort Board - 케이스 스택의 순수 상태 머신 (PUZ_03)

사양 §6 핵심 이동 규칙 / §10.2 유효성 검사 순서 / §10.3 데드락 감지 / §10.5 클리어 판정.

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `private readonly _lockedCaseIndexes = new Set<number>();`

> 원본 L28

 드래그 중이거나 리스폰 대기 중이라 잠긴 케이스 - §8 드랍

## `this.revealExposedBatteries();`

> 원본 L41

시작 시점에 노출된 미공개 건전지를 공개한다 - §7

## `public getCase(index: number): BatteryCase | undefined {`

> 원본 L49

#region Lookup

## `public getCaseState(index: number): ECaseState {`

> 원본 L58

 케이스 상태 4종 - §4

## `public isCaseOperable(index: number): boolean {`

> 원본 L73

 조작 가능한 상태인지 (열림)

## `public getGrabCount(index: number): number {`

> 원본 L83

 이 케이스에서 함께 집히는 개수 - §8 그랩 "같은 색상이 연속될 때는 같이 잡힌다"

## `public lockCase(index: number): void {`

> 원본 L92

#endregion

## `public lockCase(index: number): void {`

> 원본 L94

#region Lock (§8 드랍 - 리스폰될 때까지 케이스는 잠금 상태)

## `public canMove(fromIndex: number, toIndex: number): MoveCheck {`

> 원본 L112

#endregion

## `public canMove(fromIndex: number, toIndex: number): MoveCheck {`

> 원본 L114

#region Move validation (§10.2)

## `public canMove(fromIndex: number, toIndex: number): MoveCheck {`

> 원본 L116

이동 유효성 검사 - §10.2 가 지정한 순서를 그대로 따른다.
  (a) 출발 케이스가 비어있지 않은가
  (b) 최상단 동일색 런의 길이 k(1~3) 산출
  (c) 목적지가 비었거나 최상단 색이 동일한가
  (d) 목적지 잔여 공간 >= k 인가
하나라도 실패하면 이동 불가 + 미리보기 비활성.

## `if (this.isCaseOperable(fromIndex) === false) {`

> 원본 L135

닫힘 / 비활성 / 잠금 케이스는 손댈 수 없다 - §4, §8

## `if (source.batteries.length === 0) {`

> 원본 L143

(a)

## `const count = getMovableCount(source);`

> 원본 L148

(b)

## `const destinationTop = getTopBattery(destination);`

> 원본 L155

(c)

## `if (top.isRevealed === false) {`

> 원본 L158

§10.3 - 미공개 건전지는 색 비교가 불가능하므로 빈 케이스로만 이동할 수 있다

## `if (getRemainingSpace(destination) < count) {`

> 원본 L167

(d) - §6 "옮겨지는 수가 남은 공간을 넘으면 이동되지 않는다"

## `public move(fromIndex: number, toIndex: number): ColorSortMove | undefined {`

> 원본 L175

이동을 수행한다. 유효하지 않으면 undefined 를 돌려주고 보드를 바꾸지 않는다.
이동 후 노출된 미공개 건전지를 공개하고(§7), 완성된 케이스를 닫는다(§4).

## `const completedBefore = new Set<number>();`

> 원본 L185

이동 전에 이미 완성돼 있던 케이스를 기억해 둔다.
closedCaseIndexes 는 "이번 이동으로 새로 닫힌" 케이스만 담아야
닫힘 연출/SFX 가 매 이동마다 반복 재생되지 않는다.

## `public revealExposedBatteries(): string[] {`

> 원본 L220

#endregion

## `public revealExposedBatteries(): string[] {`

> 원본 L222

#region Reveal (§7 블랙 건전지)

## `public revealExposedBatteries(): string[] {`

> 원본 L224

최상단에 노출된 미공개 건전지를 공개한다 - §7.
공개된 건전지 id 목록을 돌려준다.

## `public getValidMoves(): { fromCaseIndex: number, toCaseIndex: number, count: number }[] {`

> 원본 L240

#endregion

## `public getValidMoves(): { fromCaseIndex: number, toCaseIndex: number, count: number }[] {`

> 원본 L242

#region Deadlock & clear (§10.3 / §10.5)

## `public getValidMoves(): { fromCaseIndex: number, toCaseIndex: number, count: number }[] {`

> 원본 L244

 지금 가능한 모든 이동

## `public isDeadlocked(): boolean {`

> 원본 L258

데드락 감지 - §2 / §10.3.
유효한 이동이 하나도 없으면 즉시 실패 처리한다.
이미 클리어된 상태는 데드락이 아니다.

## `public isSolved(): boolean {`

> 원본 L270

클리어 판정 - §2 / §4.
"건전지가 들어 있는 모든 케이스가 같은 색으로 가득 차 닫혔는가"

같은 색이 두 케이스에 나뉘어 있어도 각각 가득 찼다면 클리어다.
기획 데이터(NPUZ_03)에는 한 색을 8개 쓰는 판이 13개 있어서,
색마다 케이스 하나씩이라고 가정하면 그 판들은 애초에 끝낼 수 없다.

## `public clone(): ColorSortBoard {`

> 원본 L297

#endregion

## `public clone(): ColorSortBoard {`

> 원본 L299

#region Serialization

## `public getStateKey(): string {`

> 원본 L314

 솔버/중복 상태 판정용 키. 케이스 순서는 의미가 없으므로 정렬해 정규화한다

## `const stack = batteryCase.batteries`

> 원본 L321

숨겨진 색까지 구분해야 솔버가 서로 다른 상태를 뭉뚱그리지 않는다.
미공개 건전지는 색 뒤에 '*' 를 붙여 표시한다.

