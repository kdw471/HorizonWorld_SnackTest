# CardMatch_Board.ts — 주석 아카이브

> 원본 스크립트: `CardMatch_Board.ts`
> 걷어낸 주석 34건 / 3,274 B 절감 (12,331 B → 9,057 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Card Match Board - 포탈 타일 상태 머신 (PUZ_06)

사양 §3 게임 플로우 / §4 예외 처리 / §9.2~§9.4, §9.6 구현.

타일 상태 머신 (§9.2)
  HIDDEN -> REVEALED -> (MATCHED | HIDDEN),  별도로 BOMB_REVEALED

핵심 규칙
  - 한 번에 최대 2개까지 활성화 (§3.4)
  - 판정 연출 중에 세 번째 타일을 눌러도 된다. 그러면 직전 판정을 즉시 마무리하고
    새 선택으로 넘어간다 (§4 / §9.4)
  - 폭탄이 나오면 완료되지 않은 타일들의 오브젝트 배정을 섞고, 그 동안 입력과
    제한 시간을 모두 멈춘다 (§4 / §9.3)
  - 완료된 타일과 드러난 폭탄 타일은 재선택 불가 (§4)

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `private _revealedIndexes: number[] = [];`

> 원본 L45

 지금 열려 있는 타일 index (최대 2개)

## `private _pendingResolveSeconds: number = 0;`

> 원본 L47

 짝이 틀려 되돌아가기를 기다리는 중이면 남은 시간

## `private _bombShuffleRemaining: number = 0;`

> 원본 L50

 폭탄 셔플 연출이 끝나기까지 남은 시간

## `public get isInputLocked(): boolean {`

> 원본 L69

 폭탄 셔플 중에는 유저가 상호작용할 수 없다 - §4

## `public get isTimerPaused(): boolean {`

> 원본 L74

 폭탄 셔플 중에는 제한 시간이 멈춘다 - §4

## `public get hasPendingResolve(): boolean {`

> 원본 L79

 짝 판정 연출이 진행 중인지

## `public getTile(index: number): CardTile | undefined {`

> 원본 L103

#region Lookup

## `public getRemainingObjectTileCount(): number {`

> 원본 L119

 아직 맞추지 못한 오브젝트 타일 수 (폭탄 제외)

## `public isSolved(): boolean {`

> 원본 L130

클리어 판정 - §2 / §9.6.
"폭탄이 아닌 모든 타일이 MATCHED" 이면 클리어.
마지막에 남은 타일이 폭탄뿐인 상황도 클리어다.

## `public reveal(index: number): RevealResult {`

> 원본 L149

#endregion

## `public reveal(index: number): RevealResult {`

> 원본 L151

#region Reveal (§3 / §4 / §9.4)

## `public reveal(index: number): RevealResult {`

> 원본 L153

포탈 타일을 활성화한다.

판정 연출 중에 눌러도 받아 준다. 그때는 직전 판정을 **즉시 마무리하고** 새 선택으로 넘어간다.
사양 §4 의 "하나의 포탈 타일을 활성화하는 중에 두 번째 포탈을 활성화하는 것도 가능함" 과
§9.4 의 요구를 함께 만족시킨다.

## `if (this.isInputLocked) {`

> 원본 L171

§4 - 폭탄이 활성화된 동안에는 조작이 불가하다

## `let didResolvePending = false;`

> 원본 L190

직전 판정이 아직 연출 중이면 즉시 마무리한다 - §9.4

## `if (this._revealedIndexes.length >= MAX_REVEALED_TILES) {`

> 원본 L197

이미 2개가 열려 있으면 (판정 대기가 아닌 경우) 먼저 정리한다

## `if (tile.isBomb) {`

> 원본 L202

폭탄이면 셔플 - §3.3

## `const first = this.getTile(this._revealedIndexes[0]);`

> 원본 L235

두 번째 타일이 열렸다 - 결과를 결정한다 (§3.5)

## `this._hasPendingResolve = true;`

> 원본 L259

짝이 틀렸다 - 잠시 보여 준 뒤 되돌아간다

## `public update(deltaSeconds: number): { hiddenTileIndexes: number[], didFinishBombShuffle: boolean } {`

> 원본 L274

#endregion

## `public update(deltaSeconds: number): { hiddenTileIndexes: number[], didFinishBombShuffle: boolean } {`

> 원본 L276

#region Update

## `public update(deltaSeconds: number): { hiddenTileIndexes: number[], didFinishBombShuffle: boolean } {`

> 원본 L278

판정 연출과 폭탄 셔플 타이머를 진행시킨다.
되돌아간 타일 index 를 돌려준다 (없으면 빈 배열).

## `return { hiddenTileIndexes: [], didFinishBombShuffle: didFinishBombShuffle };`

> 원본 L291

셔플 중에는 판정 연출도 진행하지 않는다

## `public resolvePending(): void {`

> 원본 L309

 대기 중인 판정을 즉시 마무리한다 (틀린 짝을 되돌린다)

## `public flushBombShuffle(): void {`

> 원본 L316

 폭탄 셔플 연출을 즉시 끝낸다 (라운드 전환 등)

## `private hideRevealed(): void {`

> 원본 L321

#endregion

## `private hideRevealed(): void {`

> 원본 L323

#region Internal

## `private hideRevealed(): void {`

> 원본 L325

 열려 있던 타일들을 뒷면으로 되돌린다

## `private shuffleUnmatchedObjects(): number[] {`

> 원본 L336

완료되지 않은 타일들의 오브젝트 배정을 섞는다 - §3.3 / §9.3.
완료(MATCHED)된 타일과 이미 드러난 폭탄 타일은 건드리지 않는다.

## `const payloads = targets.map((tile) => ({ objectId: tile.objectId, isBomb: tile.isBomb }));`

> 원본 L352

오브젝트 배정과 폭탄 여부를 함께 섞는다 - §8 "Bomb와 Object의 위치는 랜덤으로 변환된다"

## `public toLevel(puzzleId: string, difficulty: number): CardMatchLevel {`

> 원본 L366

#endregion

## `public toLevel(puzzleId: string, difficulty: number): CardMatchLevel {`

> 원본 L368

#region Serialization

## `public toDebugString(): string {`

> 원본 L391

 디버그용 격자 덤프. `#` 뒷면 / `*` 폭탄(드러남) / `o` 완료 / 그 외는 오브젝트 id 첫 글자

## `}`

> 원본 L422

#endregion

