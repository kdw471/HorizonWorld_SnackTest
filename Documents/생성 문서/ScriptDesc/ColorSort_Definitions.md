# ColorSort_Definitions.ts — 주석 아카이브

> 원본 스크립트: `ColorSort_Definitions.ts`
> 걷어낸 주석 52건 / 3,721 B 절감 (9,089 B → 5,368 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Color Sort Puzzle - Core Definitions (PUZ_03 정렬 퍼즐 / 건전지 색 분류)

사양: `Documents/Prompts/PUZ_03_정렬퍼즐.md` (+ PUZ_00 공통 기반)
인터랙션: 모바일 터치 / 드래그 앤 드롭 (단일 터치 전용)

이 계층은 `horizon/core` 에 런타임 의존이 없는 순수 로직이다 (PUZ_00 §7.1).

모델
----
  case[i] = stack<Battery>   (용량 4)
  Battery = { color, isRevealed }

스택의 마지막 원소가 "최상단(top)" 이다. 그랩/드래그는 항상 최상단부터 집는다.

## 파일 머리말

> 원본 L17

#region Constants

## 파일 머리말

> 원본 L19

 케이스 하나에 들어가는 건전지 수 - §3 "케이스 종류는 1가지이며 건전지 4개가 들어갈 수 있다"

## `export const TOTAL_CASE_COUNT = 8;`

> 원본 L22

 필드에 배치되는 케이스 총 개수 - §3 "필드 위에는 총 8개의 케이스가 배치된다"

## `export const MIN_SPARE_CASE_COUNT = 1;`

> 원본 L25

 여분(빈) 케이스 개수 범위 - §4 "최소 1개, 최대 6개 제공"

## `export const MAX_MOVE_RUN = 3;`

> 원본 L29

 한 번에 옮길 수 있는 최대 개수 - §6 "한 번에 이동할 수 있는 오브젝트 수량은 1 ~ 3개"

## `export const TOTAL_BATTERY_COLOR_COUNT = 10;`

> 원본 L32

 건전지 색상 총 가짓수 - §5 "색상은 총 10가지"

## `export const OUT_OF_BOUNDS_RESPAWN_SECONDS = 2;`

> 원본 L35

 영역 밖에 드랍했을 때 이전 위치로 되돌아가기까지의 시간(초) - §8 드랍

## `export enum EBatteryColor {`

> 원본 L38

#endregion

## `export enum EBatteryColor {`

> 원본 L40

#region Enums

## `export enum EBatteryColor {`

> 원본 L42

 건전지 색상 10종 - §5

## `export enum ECaseState {`

> 원본 L69

 케이스 상태 4종 - §4

## `OPEN = 'OPEN',`

> 원본 L71

 조작 가능한 상태. 비었거나 색이 섞여 있으면 열림을 유지한다

## `CLOSED_COMPLETE = 'CLOSED_COMPLETE',`

> 원본 L73

 같은 색 건전지로 가득 차 닫힌 상태

## `DISABLED = 'DISABLED',`

> 원본 L75

 퍼즐 시작 시 사용할 수 없는 케이스

## `LOCKED = 'LOCKED',`

> 원본 L77

 드래그 중이거나 리스폰 대기 중이라 잠긴 상태 - §8 드랍

## `export enum EMoveRejection {`

> 원본 L81

 이동이 거절된 이유 - 미리보기 비활성 사유로도 쓴다 (§10.2)

## `SOURCE_EMPTY = 'SOURCE_EMPTY',`

> 원본 L85

 (a) 출발 케이스가 비어 있다

## `SOURCE_NOT_OPEN = 'SOURCE_NOT_OPEN',`

> 원본 L87

 출발 케이스가 닫혔거나 비활성이거나 잠겨 있다

## `DESTINATION_NOT_OPEN = 'DESTINATION_NOT_OPEN',`

> 원본 L89

 목적지가 닫혔거나 비활성이거나 잠겨 있다

## `COLOR_MISMATCH = 'COLOR_MISMATCH',`

> 원본 L91

 (c) 목적지가 비어 있지도 않고 최상단 색도 다르다

## `NOT_ENOUGH_SPACE = 'NOT_ENOUGH_SPACE',`

> 원본 L93

 (d) 목적지 잔여 공간이 부족하다

## `UNKNOWN_NEEDS_EMPTY = 'UNKNOWN_NEEDS_EMPTY',`

> 원본 L95

 미공개 건전지는 빈 케이스로만 이동할 수 있다 - §10.3

## `export enum EColorSortState {`

> 원본 L99

 퍼즐 진행 상태 머신

## `export enum EColorSortFailReason {`

> 원본 L115

 실패 사유 - §2

## `DEADLOCK = 'DEADLOCK',`

> 원본 L118

 이동시킬 수 있는 목표 오브젝트가 없음 (데드락)

## `LEVEL_LOAD_FAILED = 'LEVEL_LOAD_FAILED',`

> 원본 L120

 레벨을 만들지 못함 (테이블 설정 오류 등) - 결과 이벤트 없이 멈추지 않도록 실패로 처리한다

## `export type Battery = {`

> 원본 L124

#endregion

## `export type Battery = {`

> 원본 L126

#region Data types

## `export type Battery = {`

> 원본 L128

건전지 한 개 - §5 / §7.
`color` 는 언제나 실제 색을 담고 있고, `isRevealed` 가 false 면 유저에게 `?` 로 보인다.

## `isRevealed: boolean,`

> 원본 L135

 false 면 블랙(미지) 건전지 - §7

## `export type BatteryCase = {`

> 원본 L139

 케이스 한 개 - 아래가 바닥, 배열 마지막이 최상단

## `isActive: boolean,`

> 원본 L145

 퍼즐 시작 시 사용 가능한 케이스인지 - §3 "난이도에 따라 활성화되는 케이스의 수량이 달라진다"

## `export type MoveCheck = {`

> 원본 L149

 이동 유효성 검사 결과 - §10.2

## `count: number,`

> 원본 L152

 함께 옮겨지는 건전지 수 (1~3)

## `export type ColorSortMove = {`

> 원본 L157

 실제로 수행된 이동

## `revealedBatteryIds: string[],`

> 원본 L163

 이 이동으로 공개된 건전지 id - §7

## `closedCaseIndexes: number[],`

> 원본 L165

 이 이동으로 닫힌 케이스 index - §4

## `export type ColorSortLevel = {`

> 원본 L169

 한 판의 배치 정보

## `cases: BatteryCase[],`

> 원본 L173

 케이스별 초기 건전지 배치 (아래 -> 위)

## `colorCount: number,`

> 원본 L175

 사용된 색상 수

## `export function cloneBattery(battery: Battery): Battery {`

> 원본 L198

#endregion

## `export function cloneBattery(battery: Battery): Battery {`

> 원본 L200

#region Helpers

## `export function isCaseComplete(batteryCase: BatteryCase): boolean {`

> 원본 L225

 케이스가 같은 색으로 가득 찼는지 - §4 "가득 참 -> 닫힘"

## `if (battery.isRevealed === false || battery.color !== first.color) {`

> 원본 L233

미공개 건전지가 남아 있으면 완성으로 보지 않는다

## `export function getTopBattery(batteryCase: BatteryCase): Battery | undefined {`

> 원본 L241

 최상단 건전지

## `export function getTopRunLength(batteryCase: BatteryCase): number {`

> 원본 L249

최상단부터 이어지는 같은 색 건전지의 개수.
미공개 건전지는 단일로만 움직이므로 언제나 1 이다 - §7.

## `export function getMovableCount(batteryCase: BatteryCase): number {`

> 원본 L273

 실제로 함께 옮겨지는 개수 - §6 "한 번에 이동할 수 있는 수량은 1~3개"

## `export type RandomSource = () => number;`

> 원본 L282

#endregion

## `export type RandomSource = () => number;`

> 원본 L284

#region Random

## `export function createSeededRandom(seed: number): RandomSource {`

> 원본 L288

 mulberry32

## `(파일 끝)`

> 원본 L318

#endregion

