# SlidePuzzle_DataTables.ts — 주석 아카이브

> 원본 스크립트: `SlidePuzzle_DataTables.ts`
> 걷어낸 주석 19건 / 1,553 B 절감 (8,886 B → 7,333 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Slide Puzzle Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_07 §11)

  [PUZ 메인 테이블]       난이도별 제한시간 / 라운드 수 / 소속 퍼즐 ID
  [NPUZ_07_FieldData]     이미지 그룹 ID / 분할 개수 / 섞는 횟수
  [NPUZ_07_ObjectData]    인덱스 / 이미지 경로

PUZ_00 §7.2 에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.

## `export { SLIDEPUZZLE_CSV_FIELD_TABLE };`

> 원본 L20

 기획 CSV 에서 생성한 필드 테이블을 그대로 재수출한다 (테스트/툴에서 참조)

## `export type SlideObjectTableEntry = {`

> 원본 L23

#region Table types

## `export type SlideObjectTableEntry = {`

> 원본 L25

 NPUZ_07_ObjectData 한 행 - §11

## `puzzleObjectId: string,`

> 원본 L28

 이미지 그룹 ID

## `imagePath: string,`

> 원본 L30

 이미지 경로

## `export type SlideFieldTableEntry = {`

> 원본 L34

 NPUZ_07_FieldData 한 행 - §11

## `puzzleObjectId: string,`

> 원본 L39

 이미지 그룹 ID

## `divideNum: number,`

> 원본 L41

 분할 개수 (3 또는 4)

## `shuffleNum: number,`

> 원본 L43

 섞는 횟수

## `roundCount: number,`

> 원본 L50

 퍼즐 퀘스트당 1~3 라운드 - PUZ_00 §3

## `fieldIndexes: number[],`

> 원본 L52

 사용할 필드 데이터 index 들

## `export const DEFAULT_SLIDE_OBJECT_TABLE: SlideObjectTableEntry[] = [`

> 원본 L65

#endregion

## `export const DEFAULT_SLIDE_OBJECT_TABLE: SlideObjectTableEntry[] = [`

> 원본 L67

#region Default data

## `export const DEFAULT_SLIDE_OBJECT_TABLE: SlideObjectTableEntry[] = [`

> 원본 L69

 오브젝트 테이블 초기값 - 퍼즐에 쓸 원본 이미지들

## `export const DEFAULT_SLIDE_FIELD_TABLE: SlideFieldTableEntry[] = [`

> 원본 L79

필드 테이블 초기값.

`iDivideNum` 은 3 또는 4 만 허용된다 (§11).
`iShuffleNum` 이 클수록 어려워진다. 다만 셔플은 합법 이동만 쓰므로 아무리 커도 항상 풀 수 있다 (§8).

## `export const SLIDE_FIELD_TABLE: SlideFieldTableEntry[] =`

> 원본 L93

실제로 쓰는 필드 / 오브젝트 테이블.

기획 CSV(`SlidePuzzle_FieldData.ts`)가 있으면 그것을 쓰고, 없으면 위의 손 배치 행으로 떨어진다.

## `function fieldIndexesFor(difficulty: number): number[] {`

> 원본 L104

 해당 난이도가 쓰는 필드 행의 index 목록

## `{ difficulty: 6, timeLimitSeconds: 330, roundCount: 3, fieldIndexes: fieldIndexesFor(6) },`

> 원본 L117

기획 CSV 최고 난이도. 4분할 55회 셔플 10판이 들어 있다

