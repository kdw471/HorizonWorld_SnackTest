# Laser_Definitions.ts — 주석 아카이브

> 원본 스크립트: `Laser_Definitions.ts`
> 걷어낸 주석 75건 / 7,236 B 절감 (17,514 B → 10,278 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Laser Hacking Puzzle - Core Definitions (PUZ_01)

사양: `Documents/Prompts/PUZ_01_레이저퍼즐.md` (+ PUZ_00 공통 기반)
인터랙션: 모바일 터치 / 드래그 앤 드롭 (단일 터치 전용)

이 계층은 `horizon/core` 에 런타임 의존이 없는 순수 로직이다 (PUZ_00 §7.1).

좌표계
------
  전체 그리드 7 x 7
   └ 바깥 테두리 1칸 = 발사체 / 수신체 / 중계체 배치 영역 (플레이어 이용 불가, §2 / §5.1)
   └ 중앙 5 x 5     = 크리스탈 배치 영역 (§5.0)

  crystal.row / crystal.col  -> 배치 로컬 좌표 0..4
  gimmick.row / gimmick.col  -> 전체 그리드 좌표 0..6

## 파일 머리말

> 원본 L19

#region Constants

## 파일 머리말

> 원본 L21

 전체 그리드 한 변 (테두리 포함)

## `export const LASER_PLACEMENT_GRID_SIZE = 5;`

> 원본 L23

 크리스탈 배치 영역 한 변 - §5.0 "크리스탈 배치 영역은 5×5 고정"

## `export const LASER_PLACEMENT_ORIGIN = 1;`

> 원본 L25

 배치 영역이 시작되는 전체 그리드 인덱스

## `export const LASER_MAX_INVENTORY_SLOTS = 10;`

> 원본 L29

인벤토리 슬롯 최대 개수.

기획서 §2 는 "최대 5개"로 적고 있으나, 실제 기획 데이터 테이블
`NPUZ_01_FieldData.csv` 는 슬롯 컬럼을 `sUseMoveObjectID1..10` 10개로 두고
최대 9개까지 사용한다. 데이터 쪽이 더 최신이므로 상한을 10으로 맞춘다.
(절차적 생성기는 난이도 테이블 값에 따라 여전히 5개 이하만 만든다)

## `export const LASER_SPEC_INVENTORY_SLOTS = 5;`

> 원본 L39

 기획서 §2 원문 상한. UI 슬롯 레이아웃 기준값으로만 참고한다

## `export const LASER_MAX_TRACE_SEGMENTS = 4096;`

> 원본 L42

 광선 추적 시 허용하는 최대 세그먼트 수 (무한 루프 방어용 상한)

## `export enum ELaserDirection {`

> 원본 L45

#endregion

## `export enum ELaserDirection {`

> 원본 L47

#region Enums

## `export enum ELaserDirection {`

> 원본 L49

광선 진행 방향.
팔각 크리스탈이 대각선 4방향으로 분배하므로 대각선도 필요하다 (§4.1).

## `export enum ELaserColor {`

> 원본 L64

레이저 색상 - §3 2.1, §5.
색이 곧 레이어(층)이므로, 색이 다른 광선끼리는 교차해도 간섭하지 않는다.

## `export enum ECrystalType {`

> 원본 L74

 크리스탈 5종 - §4.1

## `TRIANGLE = 'TRIANGLE',`

> 원본 L76

 직각 삼각형: 빗변으로 들어온 광선을 직각 반사. 평면(직각변)으로 들어오면 되돌아간다

## `OCTAGON = 'OCTAGON',`

> 원본 L78

 팔각: 입사 방향과 무관하게 대각선 4방향으로 분배

## `CROSS = 'CROSS',`

> 원본 L80

 십자: 입사 방향과 무관하게 직각 4방향으로 분배

## `TEE = 'TEE',`

> 원본 L82

 T자: 입사 방향과 무관하게 2~3방향으로 분배

## `FLOWER = 'FLOWER',`

> 원본 L84

 꽃: 모든 방향의 광선을 흡수

## `export enum ETriangleCorner {`

> 원본 L88

직각 삼각형 크리스탈의 방향 4종 - §4.1.

사양은 "상/하/좌/우"로 적고 있으나 반사 계산에는 **직각 코너의 위치**가 필요하므로
코너 기준으로 정의한다. 리소스 이름과의 매핑은 오브젝트 테이블에서 한다.

예) BOTTOM_LEFT = 직각이 좌하단. 직각변은 왼쪽/아래, 빗변은 좌상단→우하단 (`\`).
    오른쪽에서 들어온 광선(LEFT 진행)은 빗변에 맞아 UP 으로 꺾이고,
    왼쪽에서 들어온 광선(RIGHT 진행)은 직각변에 맞아 되돌아간다.

## `export enum ETeeBlockedSide {`

> 원본 L105

T자 크리스탈의 방향 4종 - §4.1 (ㅓ/ㅗ/ㅜ/ㅏ).
값은 T 의 "등"이 향하는 쪽이 아니라 **막힌 쪽**을 뜻한다.
예) BLOCKED_DOWN = ㅗ 모양. 위/왼쪽/오른쪽 3방향으로 뻗는다.

## `export enum EGimmickType {`

> 원본 L117

 플레이어가 조작할 수 없는 기믹 - §4.2 / §4.3

## `EMITTER = 'EMITTER',`

> 원본 L119

 발사체 - 레이저 시작점

## `RECEIVER = 'RECEIVER',`

> 원본 L121

 수신체 - 레이저 목표점

## `RELAY = 'RELAY',`

> 원본 L123

 중계체 - 반드시 경유해야 하는 오브젝트

## `SKULL = 'SKULL',`

> 원본 L125

 해골 크리스탈 - 닿으면 모든 수신체가 Fault

## `FIXED_CRYSTAL = 'FIXED_CRYSTAL',`

> 원본 L127

 고정 크리스탈 - 필드에 박혀 있어 유저가 옮길 수 없다 (§4.3)

## `export enum EObjectState {`

> 원본 L131

 공통 오브젝트 상태 - PUZ_00 §5 / §6

## `export enum ELaserState {`

> 원본 L138

 퍼즐 진행 상태 머신

## `export type LaserCell = {`

> 원본 L154

#endregion

## `export type LaserCell = {`

> 원본 L156

#region Data types

## `export type LaserCrystal = {`

> 원본 L163

 크리스탈 한 개. 방향은 배치 후 바꿀 수 없다 (§3 3.4)

## `corner?: ETriangleCorner,`

> 원본 L167

 TRIANGLE 일 때만 의미가 있다

## `blockedSide?: ETeeBlockedSide,`

> 원본 L169

 TEE 일 때만 의미가 있다

## `export type LaserPlacedCrystal = LaserCrystal & {`

> 원본 L173

 필드에 놓인 크리스탈 (배치 로컬 좌표 0..4)

## `isFixed: boolean,`

> 원본 L177

 고정 크리스탈이면 true - 유저가 회수할 수 없다 (§4.3)

## `export type LaserGimmick = {`

> 원본 L181

테두리에 놓인 기믹 (전체 그리드 좌표 0..6).
발사체는 필드 안쪽을 향해 쏘고, 수신체는 자기 칸에 도달한 광선을 받는다.

## `colors: ELaserColor[],`

> 원본 L190

보유 색상.
발사체/수신체는 1개, 중계체는 여러 개를 가질 수 있다 (§3 4.1.1).
해골/고정 크리스탈은 색이 없으므로 빈 배열이다.

## `crystal?: LaserCrystal,`

> 원본 L196

 FIXED_CRYSTAL 일 때 어떤 크리스탈인지

## `export type LaserBeamSegment = {`

> 원본 L200

 광선 한 구간 - 연출/디버그용

## `from: LaserCell,`

> 원본 L203

 전체 그리드 좌표

## `export type LaserTraceResult = {`

> 원본 L209

 광선 추적 결과

## `litReceiverIds: string[],`

> 원본 L212

 올바른 색을 수신해 On 이 된 수신체 id

## `visitedRelayIds: string[],`

> 원본 L214

 광선이 경유한 중계체 id (색이 맞는 경우만)

## `didHitSkull: boolean,`

> 원본 L216

 해골에 광선이 닿았는지 - 닿으면 모든 수신체가 Fault (§3 4.2.1)

## `objectStates: Map<string, EObjectState>,`

> 원본 L218

 오브젝트별 상태 - 연출용

## `export type LaserLevel = {`

> 원본 L222

 한 판의 배치 정보

## `presetCrystals: LaserPlacedCrystal[],`

> 원본 L227

 시작부터 필드에 놓여 있는 크리스탈 (고정 크리스탈 포함)

## `inventory: LaserCrystal[],`

> 원본 L229

 플레이어에게 지급되는 크리스탈 (§3 3.2)

## `const DIRECTION_DELTAS: { [key: string]: LaserCell } = {`

> 원본 L251

#endregion

## `const DIRECTION_DELTAS: { [key: string]: LaserCell } = {`

> 원본 L253

#region Direction helpers

## `export function toFullGridIndex(localIndex: number): number {`

> 원본 L303

#endregion

## `export function toFullGridIndex(localIndex: number): number {`

> 원본 L305

#region Coordinate helpers

## `export function toFullGridIndex(localIndex: number): number {`

> 원본 L307

 배치 로컬 좌표 -> 전체 그리드 좌표

## `export function toPlacementLocalIndex(fullIndex: number): number {`

> 원본 L312

 전체 그리드 좌표 -> 배치 로컬 좌표

## `export function isInsidePlacementArea(row: number, col: number): boolean {`

> 원본 L317

 크리스탈 배치 영역(5x5) 안인지 - §5.1 "주변 1칸 테두리는 플레이어가 이용할 수 없다"

## `export function isInsideFullGrid(row: number, col: number): boolean {`

> 원본 L322

 전체 그리드(7x7) 안인지

## `export function isBorderCell(row: number, col: number): boolean {`

> 원본 L327

 전체 그리드의 테두리 칸인지 (기믹 배치 구역)

## `export function getInwardDirection(row: number, col: number): ELaserDirection | undefined {`

> 원본 L336

테두리에 놓인 발사체가 필드 안쪽을 향해 쏘는 방향.
꼭짓점에 놓이면 안쪽 대각선을 향한다.

## `export function reflectTriangle(corner: ETriangleCorner, incoming: ELaserDirection): ELaserDirection[] {`

> 원본 L358

#endregion

## `export function reflectTriangle(corner: ETriangleCorner, incoming: ELaserDirection): ELaserDirection[] {`

> 원본 L360

#region Crystal behaviour (§3 3.0 / §4.1)

## `export function reflectTriangle(corner: ETriangleCorner, incoming: ELaserDirection): ELaserDirection[] {`

> 원본 L362

직각 삼각형 크리스탈의 반사 - §4.1.

직각 코너에 붙어 있는 두 변이 "평면(직각변)"이고, 나머지 한 변이 빗변이다.
빗변으로 들어온 광선은 직각으로 꺾이고, 평면으로 들어온 광선은 되돌아간다.

예) BOTTOM_LEFT (직각이 좌하단, 빗변은 `\` 방향):
    - 평면: 왼쪽 변, 아래쪽 변  -> 이쪽으로 들어오면 반대 방향으로 되돌아간다
    - 빗변: LEFT 진행 -> UP, DOWN 진행 -> RIGHT (그리고 그 역)

## `if (isDiagonal(incoming)) {`

> 원본 L373

대각선으로 들어온 광선은 빗변/평면 구분이 모호하므로 흡수한다.

## `const flatIncoming: { [key: string]: ELaserDirection[] } = {`

> 원본 L378

각 코너에서 "평면(직각변)"이 마주보는 진행 방향.
예) BOTTOM_LEFT 은 왼쪽 변과 아래쪽 변이 평면이므로,
    왼쪽에서 들어오는(RIGHT 진행) 광선과 아래에서 들어오는(UP 진행) 광선이 평면에 닿는다.

## `return [getOppositeDirection(incoming)];`

> 원본 L389

§4.1 "평면 방향으로 들어오는 레이저는 되돌아간다"

## `const isBackslash = corner === ETriangleCorner.BOTTOM_LEFT || corner === ETriangleCorner.TOP_RIGHT;`

> 원본 L393

빗변 반사. BOTTOM_LEFT / TOP_RIGHT 는 `\` 거울, BOTTOM_RIGHT / TOP_LEFT 는 `/` 거울이다.

## `export function getTeeArms(blockedSide: ETeeBlockedSide): ELaserDirection[] {`

> 원본 L411

 T자 크리스탈이 뻗는 3방향 - §4.1

## `export function getCrystalOutputs(crystal: LaserCrystal, incoming: ELaserDirection): ELaserDirection[] {`

> 원본 L425

크리스탈에 광선이 들어왔을 때 나가는 방향들 - §3 3.0.
빈 배열이면 흡수된 것이다.

## `return [];`

> 원본 L432

§4.1 "모든 방향에서 들어오는 레이저를 흡수"

## `return DIAGONAL_DIRECTIONS.slice();`

> 원본 L436

§4.1 "입사 방향과 무관하게 대각선 4방향으로 분배"

## `return ORTHOGONAL_DIRECTIONS.slice();`

> 원본 L440

§4.1 "입사 방향과 무관하게 직각 4방향으로 분배"

## `const arms = getTeeArms(crystal.blockedSide ?? ETeeBlockedSide.BLOCKED_DOWN);`

> 원본 L444

§4.1 "입사 방향과 무관하게 2~3방향으로 분배"
3개의 팔 중, 들어온 쪽으로 되돌아가는 방향은 제외해 2~3방향이 된다.

## `export function cloneCrystal(crystal: LaserCrystal): LaserCrystal {`

> 원본 L456

#endregion

## `export function cloneCrystal(crystal: LaserCrystal): LaserCrystal {`

> 원본 L458

#region Misc helpers

## `export type RandomSource = () => number;`

> 원본 L502

 재현 가능한 난수 (mulberry32)

## `(파일 끝)`

> 원본 L534

#endregion

