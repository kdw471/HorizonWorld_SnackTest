# RushHour_DataTables.ts — 주석 아카이브

> 원본 스크립트: `RushHour_DataTables.ts`
> 걷어낸 주석 39건 / 2,529 B 절감 (16,442 B → 13,913 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Rush Hour Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_02 §10)

  [PUZ 메인 테이블]      기본 룰(라운드, 제한 시간), 난이도 그룹과 소속 퍼즐 관리
  [러시아워 필드 테이블]  개별 퍼즐의 오브젝트 배치 좌표 / 개수
  [오브젝트 테이블]      기믹/오브젝트의 기능, 리소스, 상태별 연출

PUZ_00 §7.2 요구사항에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.
아래 DEFAULT_* 데이터는 초기값이며, 실제 운영 데이터는
`RushHourTables.load*()` 로 교체할 수 있다.

## `export { RUSHHOUR_CSV_FIELD_TABLE };`

> 원본 L27

 기획 CSV 에서 생성한 필드 테이블을 그대로 재수출한다 (테스트/툴에서 참조)

## `export type RushHourDifficultyConfig = {`

> 원본 L30

#region Table types

## `export type RushHourDifficultyConfig = {`

> 원본 L32

 난이도별 기본 룰 - PUZ 메인 테이블 (PUZ_02 §10)

## `timeLimitSeconds: number,`

> 원본 L35

 난이도별 제한시간 (초)

## `roundCount: number,`

> 원본 L37

 난이도별 라운드 개수 (퍼즐 퀘스트당 1~3 라운드, PUZ_00 §3)

## `goalCount: number,`

> 원본 L39

 목표 오브젝트 개수. 난이도 3 이상부터 2개 (§5.1)

## `blockerCountMin: number,`

> 원본 L41

 방해 오브젝트 최소/최대 개수 (§5.2 "수량은 난이도에 따라 달라진다")

## `blockerLengths: readonly number[],`

> 원본 L44

 사용할 방해 오브젝트 길이 (1x1 ~ 4x1)

## `minimumMovesMin: number,`

> 원본 L46

 채택 기준이 되는 BFS 최소 이동 수 범위 (§11.2 난이도 스케일링)

## `export type PuzMainTableEntry = {`

> 원본 L51

 PUZ 메인 테이블 한 행

## `questId: string,`

> 원본 L53

 러시아워 퀘스트 ID

## `difficulty: number,`

> 원본 L56

 퍼즐의 난이도

## `timeLimitSeconds: number,`

> 원본 L58

 난이도별 제한시간 / 라운드 개수

## `puzzleIds: string[],`

> 원본 L61

 난이도에 속한 퍼즐 ID

## `export type RushHourPlacement = {`

> 원본 L65

 필드 테이블의 오브젝트 배치 한 건

## `objectId: string,`

> 원본 L67

 오브젝트 테이블의 오브젝트 ID

## `row: number,`

> 원본 L69

 오브젝트 배치 좌표 값 (플레이 로컬 좌표 0..6, 좌측·상단 칸)

## `export type RushHourFieldTableEntry = {`

> 원본 L77

 러시아워 필드 테이블 한 행

## `puzzleId: string,`

> 원본 L79

 퍼즐 ID

## `endPoints: RushHourEndPoint[],`

> 원본 L82

 도착 포인트 (전체 9x9 그리드 좌표, 꼭짓점 제외) - §4

## `placements: RushHourPlacement[],`

> 원본 L84

 배치된 오브젝트 좌표 값

## `objectCount: number,`

> 원본 L86

 배치된 오브젝트의 개수

## `minimumMoves: number,`

> 원본 L88

 사전 검증된 BFS 최소 이동 수. 미검증이면 -1

## `export type RushHourResourceInfo = {`

> 원본 L92

 오브젝트 리소스 정보

## `meshPath: string,`

> 원본 L94

 스태틱 메쉬 경로 또는 Horizon Asset Id

## `scale: number,`

> 원본 L96

 1칸 기준 스케일 배수

## `export type RushHourStateVisual = {`

> 원본 L100

 상태별 연출 정보

## `materialId: string,`

> 원본 L102

 머티리얼 / 색상 프리셋 이름

## `vfxId: string,`

> 원본 L104

 파티클 뱅크 id (없으면 빈 문자열)

## `sfxId: string,`

> 원본 L106

 사운드 뱅크 id (없으면 빈 문자열)

## `export type RushHourObjectTableEntry = {`

> 원본 L110

 오브젝트 테이블 한 행

## `objectId: string,`

> 원본 L112

 오브젝트 ID

## `size: number,`

> 원본 L114

 길이(칸 수) 1~4

## `defaultOrientation: EOrientation,`

> 원본 L116

 기본 이동 축. 1x1 은 FREE

## `resource: RushHourResourceInfo,`

> 원본 L119

 리소스 정보

## `stateVisuals: { [state: string]: RushHourStateVisual },`

> 원본 L121

 상태별 연출 정보 - PUZ_00 §5 (On / Off / Fault)

## `const NO_VFX = '';`

> 원본 L125

#endregion

## `const NO_VFX = '';`

> 원본 L127

#region Default data

