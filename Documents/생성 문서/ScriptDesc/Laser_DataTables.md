# Laser_DataTables.ts — 주석 아카이브

> 원본 스크립트: `Laser_DataTables.ts`
> 걷어낸 주석 21건 / 1,544 B 절감 (14,565 B → 13,021 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Laser Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_01 §7)

  [레이저 메인 테이블]    난이도별 제한시간 / 라운드 수 / 소속 퍼즐 ID
  [레이저 필드 테이블]    퍼즐별 기믹 배치 좌표 + 지급 크리스탈 종류와 개수
  [레이저 오브젝트 테이블] 크리스탈/기믹의 기능·리소스·상태별 연출

PUZ_00 §7.2 에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.

## `export { LASER_CSV_FIELD_TABLE };`

> 원본 L28

 기획 CSV 에서 생성한 필드 테이블을 그대로 재수출한다 (테스트/툴에서 참조)

## `export type LaserDifficultyConfig = {`

> 원본 L31

#region Table types

## `export type LaserDifficultyConfig = {`

> 원본 L33

 난이도별 기본 룰

## `roundCount: number,`

> 원본 L37

 퍼즐 퀘스트당 1~3 라운드 - PUZ_00 §3

## `solutionCrystalCount: number,`

> 원본 L39

 해를 이루는 크리스탈 수 (레벨 생성기의 경로 꺾임 횟수)

## `spareCrystalCount: number,`

> 원본 L41

 해에 필요 없는 여분 크리스탈 수 - §3 3.3 "모두 사용하지 않아도 클리어 가능"

## `relayCount: number,`

> 원본 L43

 반드시 경유해야 하는 중계체 수 - §3 4.1

## `skullCount: number,`

> 원본 L45

 피해야 하는 해골 수 - §3 4.2

## `beamCount: number,`

> 원본 L47

 발사체-수신체 쌍의 수

## `export type LaserMainTableEntry = {`

> 원본 L51

 메인 테이블 한 행

## `export type LaserFieldTableEntry = {`

> 원본 L61

 필드 테이블 한 행

## `gimmicks: LaserGimmick[],`

> 원본 L65

 기본 기믹 배치 좌표값 (전체 7x7 좌표)

## `presetCrystals: LaserPlacedCrystal[],`

> 원본 L67

 시작부터 필드에 놓여 있는 크리스탈 (배치 로컬 5x5 좌표)

## `inventory: LaserCrystal[],`

> 원본 L69

 지급되는 크리스탈 종류와 개수

## `export type LaserObjectTableEntry = {`

> 원본 L84

 오브젝트 테이블 한 행

## `crystalType?: ECrystalType,`

> 원본 L87

 크리스탈이면 종류, 기믹이면 종류

## `description: string,`

> 원본 L90

 기능 설명 (기획 참조용)

## `stateVisuals: { [state: string]: LaserStateVisual },`

> 원본 L93

 상태별 연출 정보 - PUZ_00 §5 (On / Off / Fault)

## `function makeStateVisuals(prefix: string): { [state: string]: LaserStateVisual } {`

> 원본 L97

#endregion

## `function makeStateVisuals(prefix: string): { [state: string]: LaserStateVisual } {`

> 원본 L99

#region Default data

