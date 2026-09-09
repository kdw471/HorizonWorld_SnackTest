# RushHour_Definitions.ts — 주석 아카이브

> 원본 스크립트: `RushHour_Definitions.ts`
> 걷어낸 주석 75건 / 7,004 B 절감 (15,404 B → 8,400 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Rush Hour (USB Sliding Block) Puzzle - Core Definitions

Source: Documents/[HID] PUZ_02러시아워_시스템 기획서_Ver.1.0.6.pdf
Prompt: Documents/Prompts/PUZ_02_러시아워퍼즐.md (+ PUZ_00 공통 기반)

PUZ_00 §7.1 요구사항에 따라 이 계층은 "순수 로직" 이다.
horizon/core 에 대한 런타임 의존이 없으므로 2D 프로토타입/테스트에서 동일하게 검증할 수 있다.

좌표계
------
 - 전체 그리드: 9 x 9 (기획서 §3, 보이지 않는 테두리 링 포함), 세로 A~I / 가로 1~9
 - 플레이 공간: 중앙 7 x 7 (로컬 좌표 A1~G7)
 - 오브젝트(piece)의 row/col 은 항상 "플레이 로컬 좌표" 0..6 이며,
   기획서 §7 의 "오브젝트의 중심 = 좌측·상단 1x1 블록" 규칙에 따라 좌측·상단 칸을 가리킨다.
 - 도착 포인트(endPoint)는 테두리 링에 존재하므로 "전체 그리드 좌표" 0..8 로 저장한다.

## 파일 머리말

> 원본 L19

#region Constants

## 파일 머리말

> 원본 L21

 전체 그리드 한 변의 칸 수 (보이지 않는 테두리 링 포함) - 기획서 §3

## `export const RUSH_HOUR_PLAY_GRID_SIZE = 7;`

> 원본 L23

 실제 플레이 공간 한 변의 칸 수 - 기획서 §3

## `export const RUSH_HOUR_PLAY_ORIGIN = 1;`

> 원본 L25

 플레이 공간이 시작되는 전체 그리드 인덱스 (테두리 링 1칸)

## `export const RUSH_HOUR_PLAY_MAX_INDEX = RUSH_HOUR_PLAY_GRID_SIZE - 1;`

> 원본 L27

 플레이 로컬 좌표의 최대 인덱스

## `export const MAX_END_POINTS = 2;`

> 원본 L30

 도착 포인트 최대 개수 - 기획서 §4 ("2개 초과 불가")

## `export const MAX_GOAL_OBJECTS = 2;`

> 원본 L32

 레벨당 목표 오브젝트 최대 개수 - 기획서 §5.1

## `export const MULTI_GOAL_MIN_DIFFICULTY = 3;`

> 원본 L34

 추가 목표 오브젝트가 등장하기 시작하는 난이도 - 기획서 §5.1

## `export const GOAL_OBJECT_LENGTH = 2;`

> 원본 L37

 목표 오브젝트(USB)의 크기 1x2 - 기획서 §5.1

## `export const DOCKED_OCCUPANCY_LENGTH = 3;`

> 원본 L39

 USB 가 꽂힌 상태에서 점유하는 칸 수 - 기획서 §9

## `export const BLOCKER_LENGTHS: readonly number[] = [1, 2, 3, 4];`

> 원본 L42

 방해 오브젝트가 가질 수 있는 길이 (1x1 / 2x1 / 3x1 / 4x1) - 기획서 §5.2

## `export const AREA_OCCUPANCY_TOLERANCE_METERS = 0.001;`

> 원본 L45

 타일 영역 점유 배타성 허용 오차 1mm - 기획서 §7

## `export enum EOrientation {`

> 원본 L48

#endregion

## `export enum EOrientation {`

> 원본 L50

#region Enums

## `export enum EOrientation {`

> 원본 L52

오브젝트의 이동 축 - 기획서 §5.2 / §11.1
1x1 오브젝트만 FREE(전 방향 이동) 를 가진다.

## `export enum EPieceColor {`

> 원본 L62

 목표 오브젝트 / 도착 포인트 색상 - 기획서 §4, §5.1

## `NEUTRAL = 'NEUTRAL',`

> 원본 L66

 방해 오브젝트처럼 색 판정이 없는 경우

## `export enum EEdge {`

> 원본 L70

 9x9 테두리 링에서 도착 포인트가 위치할 수 있는 변

## `export enum EMoveDirection {`

> 원본 L78

 한 번의 슬라이드가 향하는 방향

## `export enum EObjectState {`

> 원본 L86

 공통 오브젝트 상태 - PUZ_00 §5

## `export enum EGoalStatus {`

> 원본 L93

 목표 오브젝트(USB)의 결합 진행 상태 - 기획서 §9

## `BLOCKED = 'BLOCKED',`

> 원본 L95

 도착 포인트와 동일 선상이지만 아직 도달하지 못함

## `READY = 'READY',`

> 원본 L97

 도착 포인트에 도달, 유저가 꽂을 수 있는 상태

## `DOCKED = 'DOCKED',`

> 원본 L99

 실제로 꽂힌 상태 (3칸 점유)

## `export enum ERushHourState {`

> 원본 L103

 러시아워 퍼즐 진행 상태 머신 - PUZ_00 §7.1

## `export enum ERushHourResult {`

> 원본 L115

 퍼즐 승패 - 기획서 §2

## `export type RushHourCell = {`

> 원본 L121

#endregion

## `export type RushHourCell = {`

> 원본 L123

#region Data types

## `export type RushHourCell = {`

> 원본 L125

 격자 한 칸. 어떤 좌표계인지는 사용처가 명시한다.

## `export type RushHourPiece = {`

> 원본 L131

보드 위의 오브젝트 한 개 - 기획서 §11.1
`{id, size, orientation(H|V|FREE), row, col, color, isGoal}`

## `size: number,`

> 원본 L137

 길이(칸 수). 목표 오브젝트는 항상 2, 방해 오브젝트는 1~4

## `row: number,`

> 원본 L140

 플레이 로컬 좌표 0..6, 상단 칸

## `col: number,`

> 원본 L142

 플레이 로컬 좌표 0..6, 좌측 칸

## `export type RushHourEndPoint = {`

> 원본 L148

 도착 포인트 - 기획서 §4. 전체 그리드(9x9) 좌표를 사용한다.

## `row: number,`

> 원본 L152

 전체 그리드 좌표 0..8

## `col: number,`

> 원본 L154

 전체 그리드 좌표 0..8

## `color: EPieceColor,`

> 원본 L156

 동일 선상의 목표 오브젝트와 같은 색상 - 기획서 §4

## `export type RushHourLevel = {`

> 원본 L160

 완성된 한 판의 배치 정보

## `minimumMoves: number,`

> 원본 L166

 BFS 솔버가 구한 최소 이동 수 - 기획서 §11.2

## `export type RushHourMove = {`

> 원본 L170

 한 번의 슬라이드 조작

## `steps: number,`

> 원본 L174

 이동한 칸 수 (1 이상)

## `export type RushHourResultData = {`

> 원본 L178

 퍼즐 종료 결과

## `export type RushHourRoundProgress = {`

> 원본 L186

 라운드 슬롯 표시용 진행도 - PUZ_00 §2.1 / §3

## `current: number,`

> 원본 L188

 1-based 현재 라운드

## `export type RushHourValidationResult = {`

> 원본 L194

 레벨 생성기 / 배치 검증 결과 - 기획서 §6

## `export function toFullGridIndex(localIndex: number): number {`

> 원본 L200

#endregion

## `export function toFullGridIndex(localIndex: number): number {`

> 원본 L202

#region Coordinate helpers

## `export function toFullGridIndex(localIndex: number): number {`

> 원본 L204

 플레이 로컬 좌표 -> 전체 9x9 그리드 좌표

## `export function toPlayLocalIndex(fullIndex: number): number {`

> 원본 L209

 전체 9x9 그리드 좌표 -> 플레이 로컬 좌표

## `export function isInsidePlayField(row: number, col: number): boolean {`

> 원본 L214

 플레이 공간(7x7) 안의 좌표인지

## `export function getPieceCells(piece: RushHourPiece): RushHourCell[] {`

> 원본 L219

오브젝트가 점유하는 모든 칸 (플레이 로컬 좌표).
FREE(1x1) 는 언제나 한 칸이다.

## `export function canMoveOnAxis(orientation: EOrientation, direction: EMoveDirection): boolean {`

> 원본 L240

 오브젝트가 해당 방향으로 이동할 수 있는 축을 가졌는지 - 기획서 §5.2

## `export function getDirectionDelta(direction: EMoveDirection): RushHourCell {`

> 원본 L251

 방향 -> (rowDelta, colDelta)

## `export function getAllowedDirections(orientation: EOrientation): EMoveDirection[] {`

> 원본 L261

 오브젝트가 이동할 수 있는 모든 방향 - 기획서 §5.2

## `export function getOrientationForEdge(edge: EEdge): EOrientation {`

> 원본 L272

 도착 포인트가 놓인 변이 요구하는 목표 오브젝트의 이동 축 - 기획서 §5.1

## `export function getDirectionTowardsEdge(edge: EEdge): EMoveDirection {`

> 원본 L280

 도착 포인트를 향해 목표 오브젝트가 나아가야 하는 방향

## `export function getEndPointLaneIndex(endPoint: RushHourEndPoint): number {`

> 원본 L290

도착 포인트와 "동일 선상"인 플레이 로컬 인덱스.
TOP/BOTTOM 이면 열(col), LEFT/RIGHT 이면 행(row) 이다.

## `export function isOnEndPointLane(piece: RushHourPiece, endPoint: RushHourEndPoint): boolean {`

> 원본 L301

 오브젝트가 도착 포인트와 동일 선상에 있는지 - 기획서 §5.1 (배치 필수 조건)

## `export function hasReachedEndPoint(piece: RushHourPiece, endPoint: RushHourEndPoint): boolean {`

> 원본 L313

목표 오브젝트가 도착 포인트에 도달했는지 - 기획서 §2 (클리어 조건).

판정은 "목표의 앞머리 칸이 도착 포인트 칸에 맞닿았는가" 하나로 통일한다.

  - 절차적 생성기가 만드는 판: 도착 포인트가 9x9 테두리 링에 있으므로
    "플레이 공간의 해당 변에 밀착" 과 결과가 완전히 같다.
  - 기획 CSV(NPUZ_02) 로 만든 판: 도착 포인트가 7x7 안쪽 가장자리 칸에 있고
    USB 는 그 앞 칸까지 와서 꽂힌다(꽂히면 §9 대로 3칸 = USB 2칸 + 포인트 1칸).

## `const topFull = toFullGridIndex(piece.row);`

> 원본 L331

도착 포인트는 전체 9x9 좌표, 오브젝트는 플레이 로컬 좌표라 한쪽으로 맞춘다

## `export function getFlushAxisValue(piece: RushHourPiece, endPoint: RushHourEndPoint): number {`

> 원본 L342

목표 오브젝트가 도착 포인트에 "밀착" 하는 이동 축 좌표 (플레이 로컬).

`hasReachedEndPoint()` 가 참이 되는 단 하나의 좌표를 거꾸로 푼 값이다.
축은 도착 포인트가 놓인 변이 정한다 - TOP/BOTTOM 이면 row, LEFT/RIGHT 이면 col.

#### 왜 필요한가

결합(§9)은 "밀착한 자리에서 슬롯 쪽으로 반 칸 더" 인데, 예전에는 그 밀착 자리를
**플레이 공간의 바깥 변**(0 또는 size-1)으로 가정했다. 절차적 생성 판은 도착 포인트가
9x9 테두리 링에 있어 그 가정이 맞지만, 기획 CSV(NPUZ_02) 판은 도착 포인트가 7x7 안쪽
가장자리 칸에 있어 USB 가 그 **앞 칸**까지밖에 못 간다. 그래서 밀착 판정이 영원히 거짓이
되고 USB 를 꽂을 수 없어 판이 클리어되지 않았다. 여기서 좌표를 직접 구해 그 가정을 없앤다.

## `case EEdge.TOP: return toPlayLocalIndex(endPoint.row + 1);`

> 원본 L358

topFull === endPoint.row + 1

## `case EEdge.BOTTOM: return toPlayLocalIndex(endPoint.row - piece.size);`

> 원본 L360

topFull + size - 1 === endPoint.row - 1

## `case EEdge.LEFT: return toPlayLocalIndex(endPoint.col + 1);`

> 원본 L362

leftFull === endPoint.col + 1

## `default: return toPlayLocalIndex(endPoint.col - piece.size);`

> 원본 L364

leftFull + size - 1 === endPoint.col - 1

## `export function isEndPointInsidePlayField(endPoint: RushHourEndPoint): boolean {`

> 원본 L369

 도착 포인트가 플레이 공간(7x7) 안의 칸인지 - 기획 CSV 판이 여기에 해당한다

## `export function getEndPointCandidates(): { edge: EEdge, row: number, col: number }[] {`

> 원본 L374

 9x9 테두리 링에서 꼭짓점을 제외한 모든 도착 포인트 후보 좌표 - 기획서 §4

## `export function clonePiece(piece: RushHourPiece): RushHourPiece {`

> 원본 L387

 오브젝트를 값 복사한다 (솔버 / 되돌리기용)

## `export function cloneLevel(level: RushHourLevel): RushHourLevel {`

> 원본 L400

 레벨을 값 복사한다

## `export type RandomSource = () => number;`

> 원본 L417

#endregion

## `export type RandomSource = () => number;`

> 원본 L419

#region Random

## `export type RandomSource = () => number;`

> 원본 L421

 재현 가능한 난수. 레벨 생성 결과를 시드로 재현하기 위해 사용한다.

## `export function createSeededRandom(seed: number): RandomSource {`

> 원본 L424

 mulberry32

## `(파일 끝)`

> 원본 L454

#endregion

