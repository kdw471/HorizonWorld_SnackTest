# Switch_Definitions.ts — 주석 아카이브

> 원본 스크립트: `Switch_Definitions.ts`
> 걷어낸 주석 52건 / 4,055 B 절감 (12,764 B → 8,709 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Switch Puzzle - Core Definitions (PUZ_08 스위치 퍼즐 / Lights Out 변형)

사양: `Documents/Prompts/PUZ_08_스위치퍼즐.md` (+ PUZ_00 공통 기반)
인터랙션: 모바일 **탭(단일 터치)**. 키 캡을 누르면 3×3 스위치 영역이 반전된다.

이 계층은 `horizon/core` 에 런타임 의존이 없는 순수 로직이다 (PUZ_00 §7.1).

보드 모델 (§9.1)
----------------
  grid: ESwitchCellState[]  길이 25 (5×5 고정, §4)
  값은 PRESSED(1) / UNPRESSED(0) / FREE(-1).
  FREE 좌표에는 아무런 오브젝트가 생성되지 않으며 (§4) 상호작용·토글 모두 불가하다.

  mask: number[]  길이 9 (3×3, §6 sSwitchArray). mask[4](중앙) == 1 고정.
  플레이어가 (r, c)를 누르면 값이 1인 오프셋의 키 캡이 XOR 반전된다.
  판 밖 오프셋과 FREE 칸은 영향 없음 - 랩어라운드 금지 (§9.2).

## 파일 머리말

> 원본 L20

#region Constants - 규격 및 사이즈 (§3, 그대로 사용)

## 파일 머리말

> 원본 L22

 키 판 한 변 (5×5 고정) - §4

## `export const SWITCH_CELL_COUNT = SWITCH_BOARD_SIZE * SWITCH_BOARD_SIZE;`

> 원본 L25

 키 판 칸 수

## `export const SWITCH_MASK_SIZE = 3;`

> 원본 L28

 스위치 영역(마스크) 한 변 - §6 "3×3 기준"

## `export const SWITCH_MASK_CENTER_INDEX = 4;`

> 원본 L31

 마스크의 중앙 인덱스. mask[4] == 1 고정 - §6 "중앙은 항상 포함"

## `export const KEY_PLATE_SIZE_CM = 7;`

> 원본 L34

 단일 키 판 (1×1) 한 변 (cm) - §3

## `export const KEY_BOARD_SIZE_CM = 35;`

> 원본 L37

 완성된 키 판 (5×5) 한 변 (cm) - §3. 7cm × 5 = 35cm

## `export const KEY_CAP_SIZE_CM = 6;`

> 원본 L40

 키 캡 (1×1) 한 변 (cm) - §3

## `export const KEY_CAP_COLLISION_CM = 7;`

> 원본 L43

 키 캡 조작 콜리전 한 변 (cm) - §3 "조작 콜리전 표기는 7cm × 7cm"

## `export const HAND_POINT_COLLIDER_CM = { width: 50, height: 20, depth: 40 };`

> 원본 L46

 핸드 포인트 변경 콜리전 (cm) - PUZ_00 §4 와 동일한 값

## `export const BOARD_SPAWN_SECONDS = 1;`

> 원본 L49

 키 판 생성 연출 - 모든 타일 생성 소요 시간 (초) - §4

## `export const INITIAL_PRESS_SECONDS = 0.2;`

> 원본 L52

 생성 직후 키 캡이 필드데이터에 따라 동시에 눌리는 연출 (초) - §4

## `export const PRESS_AREA_DELAY_SECONDS = 0.05;`

> 원본 L55

조작 연출 타이밍 - §7
  0.0초 중앙의 키 캡을 누름 → 딜레이 뒤 영향받는 키 캡 연출 재생 → 시퀀스 끝에 모든 연출 종료

기획서 §7 원안은 0.2초 / 0.4초였다. 그런데 모바일 실기에서는 플랫폼의 터치 지연이
그 위에 더해져 "누르고 반응이 없다" 로 느껴졌다. 체감 즉시 반응(~0.1초 이내)이 되도록
연출 시간을 최소로 줄였다 - 순서(누름 → 영향 영역 → 종료)는 그대로 유지된다.

## `export enum ESwitchCellState {`

> 원본 L66

#endregion

## `export enum ESwitchCellState {`

> 원본 L68

#region Enums

## `export enum ESwitchCellState {`

> 원본 L70

 키 캡 한 칸의 상태 - §5. 1 = 눌림(녹색/목표), 0 = 안 눌림(빨강), FREE = 오브젝트 없음 (§4)

## `export enum ESwitchInputState {`

> 원본 L77

 입력 잠금 상태

## `IDLE = 'IDLE',`

> 원본 L79

 조작 가능

## `SEQUENCE = 'SEQUENCE',`

> 원본 L81

 누름 연출(0.4초)이 재생 중 - 추가 입력 불가 (§7)

## `LOCKED_CLEARED = 'LOCKED_CLEARED',`

> 원본 L83

 완성되어 모든 인터랙션이 불가

## `export enum ESwitchPressOutcome {`

> 원본 L87

 키 캡을 누른 결과

## `REJECTED = 'REJECTED',`

> 원본 L89

 입력이 거절되었다

## `PRESSED = 'PRESSED',`

> 원본 L91

 눌림이 확정되어 토글이 일어났다

## `FREE_CELL = 'FREE_CELL',`

> 원본 L98

 FREE 칸에는 키 캡이 없다 - §4

## `SEQUENCE_IN_PROGRESS = 'SEQUENCE_IN_PROGRESS',`

> 원본 L100

 누름 연출이 재생 중이다 - §7

## `ALREADY_CLEARED = 'ALREADY_CLEARED',`

> 원본 L102

 이미 완성되어 조작할 수 없다

## `RELEASED_OUTSIDE = 'RELEASED_OUTSIDE',`

> 원본 L104

 누른 자리 밖에서 손을 떼어 취소되었다 - §7 부분 누름 (모바일 대체)

## `NO_ACTIVE_TOUCH = 'NO_ACTIVE_TOUCH',`

> 원본 L106

 진행 중인 터치가 없다

## `TOUCH_ALREADY_ACTIVE = 'TOUCH_ALREADY_ACTIVE',`

> 원본 L108

 이미 다른 터치가 진행 중이다 - §7 "먼저 들어간 손만 인식"

## `export enum ESwitchPuzzleState {`

> 원본 L112

 퍼즐 진행 상태 머신

## `export type SwitchPressResult = {`

> 원본 L128

#endregion

## `export type SwitchPressResult = {`

> 원본 L130

#region Data types

## `export type SwitchPressResult = {`

> 원본 L132

 키 캡을 누른 결과

## `position: number,`

> 원본 L136

 누른 칸의 위치

## `toggledPositions: number[],`

> 원본 L138

 이번 누름으로 반전된 칸들 (누른 칸 포함) - §6

## `export type SwitchLevel = {`

> 원본 L142

 한 판의 배치 정보

## `grid: ESwitchCellState[],`

> 원본 L146

 5×5 키 판. FREE / UNPRESSED / PRESSED - §9.1

## `mask: number[],`

> 원본 L148

 3×3 스위치 영역 마스크 (sSwitchArray) - §6

## `switchAreaId: string,`

> 원본 L150

 스위치 영역 ID - §8

## `shuffleCount: number,`

> 원본 L152

 역셔플 누름 횟수 K - §9.4

## `shuffledPresses: number[],`

> 원본 L154

 역셔플에 실제로 누른 위치들. 이 배치가 K수 이내로 풀린다는 증명이다

## `unpressedKeyCount: number,`

> 원본 L163

 아직 눌리지 않은 키 캡 수

## `export function toRowCol(position: number): { row: number, col: number } {`

> 원본 L178

#endregion

## `export function toRowCol(position: number): { row: number, col: number } {`

> 원본 L180

#region Helpers - 좌표

## `export function toRowCol(position: number): { row: number, col: number } {`

> 원본 L182

 위치 -> 행/열

## `export function toPosition(row: number, col: number): number {`

> 원본 L187

 행/열 -> 위치

## `export function toCoordLabel(position: number): string {`

> 원본 L196

 좌표 표기 A1~E5 (세로 A~E / 가로 1~5) - §4

## `export function parseSwitchMask(rows: readonly string[]): number[] | undefined {`

> 원본 L202

#endregion

## `export function parseSwitchMask(rows: readonly string[]): number[] | undefined {`

> 원본 L204

#region Helpers - 마스크 (§6)

## `export function parseSwitchMask(rows: readonly string[]): number[] | undefined {`

> 원본 L206

마스크 문자열('0'/'1' 3행)을 3×3 배열로 파싱한다.
예) ['010', '111', '010'] → 십자 영역

## `export function getMaskViolations(mask: readonly number[]): string[] {`

> 원본 L229

 마스크가 §6 을 만족하는지 - 3×3, 0/1, 중앙 항상 포함

