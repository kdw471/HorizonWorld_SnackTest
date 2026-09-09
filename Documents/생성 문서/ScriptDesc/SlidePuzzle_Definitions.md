# SlidePuzzle_Definitions.ts — 주석 아카이브

> 원본 스크립트: `SlidePuzzle_Definitions.ts`
> 걷어낸 주석 57건 / 3,714 B 절감 (10,046 B → 6,332 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Slide Puzzle - Core Definitions (PUZ_07 슬라이드 퍼즐 / N-퍼즐)

사양: `Documents/Prompts/PUZ_07_슬라이드퍼즐.md` (+ PUZ_00 공통 기반)
인터랙션: 모바일 **탭(단일 터치)**. 조각을 누르면 빈 칸으로 미끄러진다.

이 계층은 `horizon/core` 에 런타임 의존이 없는 순수 로직이다 (PUZ_00 §7.1).

보드 모델 (§12.1)
----------------
  board: number[]  길이 n*n (n = iDivideNum)
  값은 원본 타일 인덱스이며, 빈 칸은 `n*n - 1` 을 sentinel 로 쓴다.
  완성 상태는 `board[i] === i` 이고, 빈 칸은 언제나 마지막 자리에 온다 (§4).

## 파일 머리말

> 원본 L16

#region Constants - 규격 및 사이즈 (§4, 그대로 사용)

## 파일 머리말

> 원본 L18

 완성된 이미지 한 변 (cm)

## `export const PIECE_THICKNESS_CM = 4;`

> 원본 L21

 이미지 조각 두께 (cm)

## `export const PIECE_INTERACTION_HEIGHT_CM = 7;`

> 원본 L24

 조각 인터랙션 영역 높이 (cm). 가로·세로는 이미지 조각과 동일하다

## `export const HAND_POINT_COLLIDER_CM = { width: 50, height: 20, depth: 40 };`

> 원본 L27

 핸드 포인트 변경 콜리전 (cm) - PUZ_00 §4 와 동일한 값

## `export type PieceMetrics = {`

> 원본 L30

 분할 수별 조각 규격 (cm) - §4

## `pieceSizeCm: number,`

> 원본 L32

 조각 한 변

## `gapCm: number,`

> 원본 L34

 조각 간격

## `export const PIECE_MOVE_SECONDS = 0.12;`

> 원본 L43

이동 연출 시간 (초). 기획서 §6 원안은 0.25초였으나 "터치 후 반응이 굼뜨다" 는
피드백으로 줄였다 - 이동 중 입력 잠금 시간도 그만큼 짧아져 연타가 빨라진다.

## `export const SUCCESS_IMAGE_SECONDS = 1;`

> 원본 L49

 완성 시 원본 이미지를 보여 주는 시간 (초) - §9

## `export const HOVER_EMISSIVE_COLOR = '#FF5C41';`

> 원본 L52

 호버 Emissive 색상 - §5

## `export const SFX_PIECE_HOVER = 'S_PieceHover_SFX';`

> 원본 L55

 사운드 ID - §5 / §6 / §9

## `export enum ESlideInputState {`

> 원본 L60

#endregion

## `export enum ESlideInputState {`

> 원본 L62

#region Enums

## `export enum ESlideInputState {`

> 원본 L64

 입력 잠금 상태 - §12.3

## `IDLE = 'IDLE',`

> 원본 L66

 조작 가능

## `MOVING = 'MOVING',`

> 원본 L68

 조각이 미끄러지는 중 - 모든 칸의 인터랙션이 불가 (§6)

## `LOCKED_CLEARED = 'LOCKED_CLEARED',`

> 원본 L70

 완성되어 모든 인터랙션이 불가 (§5)

## `export enum ESlideMoveOutcome {`

> 원본 L74

 조각을 누른 결과

## `REJECTED = 'REJECTED',`

> 원본 L76

 입력이 거절되었다

## `MOVING = 'MOVING',`

> 원본 L78

 빈 칸으로 미끄러지기 시작했다

## `IS_BLANK = 'IS_BLANK',`

> 원본 L85

 빈 칸 자체를 눌렀다

## `NOT_ADJACENT_TO_BLANK = 'NOT_ADJACENT_TO_BLANK',`

> 원본 L87

 사방에 빈 칸이 없어 움직일 수 없다 - §5

## `MOVE_IN_PROGRESS = 'MOVE_IN_PROGRESS',`

> 원본 L89

 다른 조각이 이동 중이다 - §6

## `ALREADY_CLEARED = 'ALREADY_CLEARED',`

> 원본 L91

 이미 완성되어 조작할 수 없다 - §5

## `export enum ESlidePuzzleState {`

> 원본 L95

 퍼즐 진행 상태 머신

## `export type SlideMoveResult = {`

> 원본 L111

#endregion

## `export type SlideMoveResult = {`

> 원본 L113

#region Data types

## `export type SlideMoveResult = {`

> 원본 L115

 조각을 누른 결과

## `fromPosition: number,`

> 원본 L119

 누른 조각의 보드 위치

## `toPosition: number,`

> 원본 L121

 조각이 이동할 자리 (= 이동 전 빈 칸 위치)

## `tileIndex: number,`

> 원본 L123

 이동하는 원본 타일 인덱스

## `export type SlidePuzzleLevel = {`

> 원본 L127

 한 판의 배치 정보

## `divideNum: number,`

> 원본 L131

 분할 개수 (3 또는 4) - §11 iDivideNum

## `board: number[],`

> 원본 L133

 섞인 보드. board[위치] = 원본 타일 인덱스

## `shuffleNum: number,`

> 원본 L135

 섞은 횟수 - §11 iShuffleNum

## `imagePath: string,`

> 원본 L137

 원본 이미지 경로 - §11 sImagePath

## `misplacedPieceCount: number,`

> 원본 L146

 아직 제자리가 아닌 조각 수

## `export function getPieceMetrics(divideNum: number): PieceMetrics | undefined {`

> 원본 L161

#endregion

## `export function getPieceMetrics(divideNum: number): PieceMetrics | undefined {`

> 원본 L163

#region Helpers

## `export function getPieceMetrics(divideNum: number): PieceMetrics | undefined {`

> 원본 L165

 분할 수에 맞는 조각 규격을 돌려준다 - §4

## `export function getLayoutTotalCm(divideNum: number): number | undefined {`

> 원본 L170

조각 규격이 완성 이미지 크기와 맞는지 확인한다 - §4.
  조각 * n + 간격 * (n - 1) === 35cm
예) 3x3: 11.5 * 3 + 0.25 * 2 = 35 / 4x4: 8.6 * 4 + 0.2 * 3 = 35

## `export function createSolvedBoard(divideNum: number): number[] {`

> 원본 L183

 완성 상태의 보드 - board[i] === i

## `export function getBlankTileIndex(divideNum: number): number {`

> 원본 L192

 빈 칸을 나타내는 sentinel 값 - §4 "언제나 제일 마지막 조각이 비어있다"

## `export function findBlankPosition(board: readonly number[], divideNum: number): number {`

> 원본 L197

 빈 칸이 지금 있는 보드 위치

## `export function toRowCol(position: number, divideNum: number): { row: number, col: number } {`

> 원본 L202

 위치 -> 행/열

## `export function toPosition(row: number, col: number, divideNum: number): number {`

> 원본 L207

 행/열 -> 위치

## `export function areAdjacent(left: number, right: number, divideNum: number): boolean {`

> 원본 L212

 두 위치가 상하좌우로 인접한지

## `export function getMovablePositions(board: readonly number[], divideNum: number): number[] {`

> 원본 L221

 빈 칸에 인접한 조각들의 위치 목록 - §12.2

## `export function isBoardSolved(board: readonly number[]): boolean {`

> 원본 L246

 완성 판정 - §12.6 "board[i] === i for all i"

## `export function countMisplaced(board: readonly number[], divideNum: number): number {`

> 원본 L256

 제자리가 아닌 조각 수 (빈 칸 제외)

## `export function isBoardSolvable(board: readonly number[], divideNum: number): boolean {`

> 원본 L282

15-퍼즐의 풀이 가능성 판정.
역순 셔플로 만든 배치는 언제나 풀 수 있지만, 외부에서 들어온 데이터를 검증할 때 쓴다.

홀수 폭(3x3)이면 전치 수가 짝수여야 하고,
짝수 폭(4x4)이면 (전치 수 + 빈 칸의 행 번호를 아래에서부터 센 값)이 홀수여야 한다.

## `export type RandomSource = () => number;`

> 원본 L316

#endregion

## `export type RandomSource = () => number;`

> 원본 L318

#region Random

## `export function createSeededRandom(seed: number): RandomSource {`

> 원본 L322

 mulberry32

## `(파일 끝)`

> 원본 L342

#endregion

