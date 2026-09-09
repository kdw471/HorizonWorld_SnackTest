# ColorFill_Definitions.ts — 주석 아카이브

> 원본 스크립트: `ColorFill_Definitions.ts`
> 걷어낸 주석 51건 / 3,047 B 절감 (8,525 B → 5,478 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Color Fill Puzzle - Core Definitions (PUZ_04 색 채우기 / 다이얼 타이밍)

사양: `Documents/Prompts/PUZ_04_색채우기퍼즐.md` (+ PUZ_00 공통 기반)
인터랙션: 모바일 **탭(단일 터치)**. 이 퍼즐은 배치가 아니라 반응속도/타이밍 퍼즐이라
          드래그가 없고 "터치 = 방향 반전 (+ 오염 칸 위면 정화)" 하나로 끝난다.

이 계층은 `horizon/core` 에 런타임 의존이 없는 순수 로직이다 (PUZ_00 §7.1).

모델 (§8.1)
----------
  slots: Slot[18]          // 각 20도
  Slot = { isActive, state: CLEAN | CONTAMINATED }
  needle = { angleDeg, direction: +1 | -1, speedDegPerSec }
  reverseDelaySeconds

## 파일 머리말

> 원본 L18

#region Constants

## 파일 머리말

> 원본 L20

 다이얼 칸 수 - §3 "다이얼은 18칸으로 나누어진다"

## `export const DEGREES_PER_SLOT = 360 / DIAL_SLOT_COUNT;`

> 원본 L23

 한 칸이 차지하는 각도 - §3 "최소 단위인 한 칸은 20도" (18 x 20 = 360)

## `export const DIRECTION_CLOCKWISE = 1;`

> 원본 L26

 시계방향 회전 - §6 "퍼즐 시작 시 시계방향으로 회전을 시작한다"

## `export enum ESlotState {`

> 원본 L30

#endregion

## `export enum ESlotState {`

> 원본 L32

#region Enums

## `export enum ESlotState {`

> 원본 L34

 칸의 오염 상태 - §8.1

## `CLEAN = 'CLEAN',`

> 원본 L36

 정화된 영역

## `CONTAMINATED = 'CONTAMINATED',`

> 원본 L38

 오염 영역. 붉은 색상으로 표시한다 (§3)

## `export enum EColorFillState {`

> 원본 L42

 퍼즐 진행 상태 머신

## `export enum ETouchOutcome {`

> 원본 L58

 터치가 만들어낸 결과 - §6

## `IGNORED = 'IGNORED',`

> 원본 L60

 입력이 무시되었다 (방향 전환 딜레이 중 입력 잠금 등)

## `REVERSE_ONLY = 'REVERSE_ONLY',`

> 원본 L62

 방향 반전만 예약되었다

## `PURIFY_AND_REVERSE = 'PURIFY_AND_REVERSE',`

> 원본 L64

 오염 덩어리를 정화하고 방향 반전도 예약되었다

## `export type DialSlot = {`

> 원본 L68

#endregion

## `export type DialSlot = {`

> 원본 L70

#region Data types

## `export type DialSlot = {`

> 원본 L72

 다이얼 한 칸

## `isActive: boolean,`

> 원본 L75

 활성화 영역인지 - §4. 비활성 칸은 정화 대상이 아니다

## `export type DialNeedle = {`

> 원본 L80

 회전 바늘 - §6

## `angleDeg: number,`

> 원본 L82

 0 이상 360 미만

## `direction: number,`

> 원본 L84

 +1 시계방향 / -1 반시계방향

## `export type TouchResult = {`

> 원본 L89

 터치 처리 결과

## `slotIndex: number,`

> 원본 L92

 터치 시점의 칸 index

## `purifiedSlotIndexes: number[],`

> 원본 L94

 이번 터치로 정화된 칸 index 목록

## `didScheduleReverse: boolean,`

> 원본 L96

 방향 반전이 예약되었는지

## `export type ColorFillLevel = {`

> 원본 L100

 한 판의 배치 정보

## `slots: DialSlot[],`

> 원본 L104

 18칸 전체의 초기 상태

## `needleSpeedDegPerSec: number,`

> 원본 L106

 바늘 회전 속도 (도/초)

## `reverseDelaySeconds: number,`

> 원본 L108

 방향 전환 딜레이(초) - §6

## `startAngleDeg: number,`

> 원본 L110

 시작 각도

## `remainingContaminatedCount: number,`

> 원본 L119

 남은 오염 칸 수

## `export function wrapSlotIndex(index: number): number {`

> 원본 L134

#endregion

## `export function wrapSlotIndex(index: number): number {`

> 원본 L136

#region Ring helpers (원형 배열)

## `export function wrapSlotIndex(index: number): number {`

> 원본 L138

 인덱스를 0..17 범위로 감싼다

## `export function wrapAngle(angleDeg: number): number {`

> 원본 L144

 각도를 0 이상 360 미만으로 감싼다

## `export function getSlotIndexFromAngle(angleDeg: number): number {`

> 원본 L149

 각도가 속한 칸 index - §8.2 "현재 칸 인덱스 = floor(angle / 20)"

## `export function getSlotCenterAngle(index: number): number {`

> 원본 L154

 칸의 중심 각도

## `export function getSlotDistance(from: number, to: number, direction: number): number {`

> 원본 L159

`from` 에서 `to` 까지 `direction` 방향으로 갈 때 지나는 칸 수.
같은 칸이면 0 이다.

## `export function cloneSlot(slot: DialSlot): DialSlot {`

> 원본 L172

#endregion

## `export function cloneSlot(slot: DialSlot): DialSlot {`

> 원본 L174

#region Slot helpers

## `export function createSlots(): DialSlot[] {`

> 원본 L191

 18칸을 모두 비활성·정화 상태로 만든다

## `export function getContiguousContaminatedRun(slots: readonly DialSlot[], index: number): number[] {`

> 원본 L200

`index` 를 포함하는 연속 오염 덩어리의 칸 index 들 - §5 / §8.3.
원형 배열이므로 17 <-> 0 을 넘나드는 wrap-around 를 고려한다.
`index` 가 오염 칸이 아니면 빈 배열이다.

## `for (let step = 1; step < DIAL_SLOT_COUNT; step++) {`

> 원본 L213

뒤쪽으로 확장

## `for (let step = 1; step < DIAL_SLOT_COUNT; step++) {`

> 원본 L222

앞쪽으로 확장

## `break;`

> 원본 L229

18칸이 전부 오염된 경우 한 바퀴를 다 돌았다

## `export function getContaminatedGroups(slots: readonly DialSlot[]): number[][] {`

> 원본 L239

 서로 떨어져 있는 오염 덩어리들 - 밸런싱 시뮬레이션과 검증에 쓴다

## `export type RandomSource = () => number;`

> 원본 L278

#endregion

## `export type RandomSource = () => number;`

> 원본 L280

#region Random

## `export function createSeededRandom(seed: number): RandomSource {`

> 원본 L284

 mulberry32

## `(파일 끝)`

> 원본 L314

#endregion

