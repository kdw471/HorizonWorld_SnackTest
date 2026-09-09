# ColorSort_DataTables.ts — 주석 아카이브

> 원본 스크립트: `ColorSort_DataTables.ts`
> 걷어낸 주석 17건 / 1,336 B 절감 (12,785 B → 11,449 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Color Sort Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_03 §9)

  [PUZ 메인 테이블]        난이도별 제한시간 / 라운드 수 / 소속 퍼즐 ID
  [정렬 퍼즐 필드 테이블]   퍼즐별 오브젝트 배치 좌표 / 종류 / 개수 / 활성 케이스 수량
  [오브젝트 테이블]        오브젝트 ID / 리소스 / 상태별 연출

PUZ_00 §7.2 에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.

## `export { COLORSORT_CSV_FIELD_TABLE };`

> 원본 L25

 기획 CSV 에서 생성한 필드 테이블을 그대로 재수출한다 (테스트/툴에서 참조)

## `export type ColorSortDifficultyConfig = {`

> 원본 L28

#region Table types

## `export type ColorSortDifficultyConfig = {`

> 원본 L30

 난이도별 기본 룰

## `roundCount: number,`

> 원본 L34

 퍼즐 퀘스트당 1~3 라운드 - PUZ_00 §3

## `colorCount: number,`

> 원본 L36

 사용할 색상 수. 색상 하나당 케이스 하나를 채운다

## `spareCaseCount: number,`

> 원본 L38

 여분(빈) 케이스 수 - §4 (1~6)

## `shuffleMoveCount: number,`

> 원본 L40

 완성 상태에서 역방향으로 섞는 횟수. 클수록 어렵다

## `unknownBatteryCount: number,`

> 원본 L42

 블랙(미지) 건전지 수 - §7

## `export type ColorSortFieldTableEntry = {`

> 원본 L55

 필드 테이블 한 행

## `cases: BatteryCase[],`

> 원본 L59

 케이스별 배치. 배열 순서가 케이스 index 이며, 각 배열은 아래 -> 위 순서다

## `activeCaseCount: number,`

> 원본 L61

 활성화된 케이스의 수량 - §3

## `colorCount: number,`

> 원본 L63

 배치된 건전지 종류(색상) 수

## `batteryCount: number,`

> 원본 L65

 배치된 건전지 총 개수

## `stateVisuals: { [state: string]: ColorSortStateVisual },`

> 원본 L84

 상태별 연출 정보 - PUZ_00 §5 / §4 케이스 상태 4종

## `function makeCaseVisuals(prefix: string): { [state: string]: ColorSortStateVisual } {`

> 원본 L88

#endregion

## `function makeCaseVisuals(prefix: string): { [state: string]: ColorSortStateVisual } {`

> 원본 L90

#region Default data

