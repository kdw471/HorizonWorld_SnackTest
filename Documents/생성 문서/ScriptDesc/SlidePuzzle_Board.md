# SlidePuzzle_Board.ts — 주석 아카이브

> 원본 스크립트: `SlidePuzzle_Board.ts`
> 걷어낸 주석 25건 / 2,505 B 절감 (9,140 B → 6,635 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Slide Puzzle Board - 조각 배치와 이동 잠금의 순수 상태 머신 (PUZ_07)

사양 §5 인터랙션 / §6 이동 연출 / §8 섞는 로직 / §12 구현 요구사항.

입력 잠금 상태 (§12.3)
  IDLE -> MOVING(0.25초, 전체 입력 잠금) -> IDLE,  완성 시 LOCKED_CLEARED

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `private _moveRemaining: number = 0;`

> 원본 L36

 이동 연출이 끝나기까지 남은 시간

## `private _movingFrom: number = -1;`

> 원본 L38

 이동 연출 중인 조각 정보 - 연출 계층이 참조한다

## `public get isInputAccepted(): boolean {`

> 원본 L54

 지금 입력을 받을 수 있는지 - §5 / §6

## `public getTileAt(position: number): number | undefined {`

> 원본 L84

#region Query

## `public getMovablePositions(): number[] {`

> 원본 L97

 지금 움직일 수 있는 조각들의 위치 - §5 "사방에 비어있는 칸이 존재하는 경우에만"

## `public canHover(position: number): boolean {`

> 원본 L105

이 조각에 호버 Emissive 를 켤 수 있는지 - §5.
인접한 빈 칸이 없으면 켜지 않는다.

## `public press(position: number): SlideMoveResult {`

> 원본 L124

#endregion

## `public press(position: number): SlideMoveResult {`

> 원본 L126

#region Move (§5 / §6 / §12.3)

## `public press(position: number): SlideMoveResult {`

> 원본 L128

조각을 눌러 빈 칸으로 미끄러뜨린다.
이동 중에는 모든 칸의 입력이 막히고, 완성 후에는 영구히 막힌다.

## `return rejected(ESlideRejection.ALREADY_CLEARED);`

> 원본 L142

§5 - 퍼즐이 완성 판정되면 즉시 모든 인터랙션이 불가능해진다

## `return rejected(ESlideRejection.MOVE_IN_PROGRESS);`

> 원본 L146

§6 - 조각이 이동하는 동안에는 모든 칸의 인터랙션이 불가하다

## `public update(deltaSeconds: number): { didFinishMove: boolean, didClear: boolean } {`

> 원본 L183

이동 연출 타이머를 진행시킨다.
연출이 끝나면 완성 여부를 판정한다 - §12.6 "매 이동 완료 시점에 검사".

## `public flushMove(): boolean {`

> 원본 L201

 이동 연출을 즉시 끝낸다

## `public shuffle(random: RandomSource, shuffleNum: number): number {`

> 원본 L222

#endregion

## `public shuffle(random: RandomSource, shuffleNum: number): number {`

> 원본 L224

#region Shuffle (§8 / §12.2)

## `public shuffle(random: RandomSource, shuffleNum: number): number {`

> 원본 L226

완성 상태에서 역순으로 섞는다 - §8.

**직전 이동을 그대로 되돌리는 수는 배제한다.** 그래야 제자리걸음 없이 잘 섞인다.
이 방식은 합법 이동만 사용하므로 **항상 풀 수 있는 배치**를 보장한다.
무작위 순열 셔플은 절반이 풀 수 없는 배치가 되므로 절대 쓰면 안 된다 (§8).

실제로 몇 번 움직였는지 돌려준다.

## `let previousPosition = -1;`

> 원본 L239

직전 이동에서 조각이 들어간 자리. 그 자리를 다시 고르면 되돌리는 수가 된다.

## `const pool = candidates.length > 0 ? candidates : all;`

> 원본 L248

되돌리기를 빼고 나면 후보가 없을 수 있다. 그때만 제약을 푼다.

## `previousPosition = blank;`

> 원본 L258

조각이 방금 이동해 들어간 자리 = 이전 빈 칸. 다음에 그 자리를 고르면 되돌리는 수다.

## `public clone(): SlidePuzzleBoard {`

> 원본 L267

#endregion

## `public clone(): SlidePuzzleBoard {`

> 원본 L269

#region Serialization

## `public toDebugString(): string {`

> 원본 L291

 디버그용 격자 덤프. 빈 칸은 점으로 표시한다

## `const text = String(value);`

> 원본 L299

padStart 는 ES2017 이라 Horizon 에디터 lib 에 없을 수 있다. 폭 2 고정이므로 직접 채운다.

## `}`

> 원본 L308

#endregion

