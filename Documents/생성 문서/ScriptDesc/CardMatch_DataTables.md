# CardMatch_DataTables.ts — 주석 아카이브

> 원본 스크립트: `CardMatch_DataTables.ts`
> 걷어낸 주석 26건 / 3,073 B 절감 (16,225 B → 13,152 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Card Match Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_06 §8)

  [PUZ 메인 테이블]        난이도별 제한시간 / 라운드 수 / 소속 퍼즐 ID
  [NPUZ_06_FieldData]      필드 크기 / 폭탄 수 / 오브젝트 타일 수 / 오브젝트 그룹 ID
  [NPUZ_06_ObjectData]     오브젝트 ID / 타입 / 챕터 / 그룹 / 메쉬 경로 / 레벨 사이즈

PUZ_00 §7.2 에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.

#### 데이터 검증이 특히 중요하다

§8 은 `iObjectTile = (sTileArrayX x sTileArrayY) - iBombTile` 이며 **반드시 짝수** 라고 못박고 있다.
홀수면 짝을 맞출 수 없는 오브젝트가 하나 남아 클리어가 불가능해진다.
§9.1 에 따라 이 경우를 **데이터 검증 단계에서 에러로 처리**한다.

## `export { CARDMATCH_CSV_FIELD_TABLE };`

> 원본 L28

 기획 CSV 에서 생성한 필드 테이블을 그대로 재수출한다 (테스트/툴에서 참조)

## `export type CardObjectTableEntry = {`

> 원본 L31

#region Table types

## `export type CardObjectTableEntry = {`

> 원본 L33

 NPUZ_06_ObjectData 한 행 - §8

## `type: ECardObjectType,`

> 원본 L36

 타입 (일반 / 함정)

## `chapter: number,`

> 원본 L38

 챕터 (1 / 2 / 3 / 4)

## `objectGroupId: string,`

> 원본 L40

 퍼즐 오브젝트 그룹 ID

## `meshPath: string,`

> 원본 L42

 스태틱 메쉬 경로

## `levelSize: number,`

> 원본 L44

 레벨 사이즈

## `export type CardFieldTableEntry = {`

> 원본 L48

 NPUZ_06_FieldData 한 행 - §8

## `objectGroupId: string,`

> 원본 L53

 NPUZ_06_ObjectData 의 iObjectGroupID 를 참조

## `tileArrayX: number,`

> 원본 L55

 필드의 X열

## `tileArrayY: number,`

> 원본 L57

 필드의 Y열

## `bombTile: number,`

> 원본 L59

 각 라운드에 등장하는 폭탄의 수

## `objectTile: number,`

> 원본 L61

 (X x Y) - bombTile. 반드시 짝수여야 한다

## `roundCount: number,`

> 원본 L68

 퍼즐 퀘스트당 1~3 라운드 - PUZ_00 §3

## `fieldIndexes: number[],`

> 원본 L70

 사용할 필드 데이터 index 들

## `mismatchRevealSeconds: number,`

> 원본 L72

 짝이 틀렸을 때 보여 주는 시간(초)

## `bombShuffleSeconds: number,`

> 원본 L74

 폭탄 셔플 연출 시간(초)

## `export const DEFAULT_CARD_OBJECT_TABLE: CardObjectTableEntry[] = [`

> 원본 L87

#endregion

## `export const DEFAULT_CARD_OBJECT_TABLE: CardObjectTableEntry[] = [`

> 원본 L89

#region Default data

## `export const DEFAULT_CARD_OBJECT_TABLE: CardObjectTableEntry[] = [`

> 원본 L91

오브젝트 테이블 초기값 - 포탈에서 나오는 오브젝트들.

주의: 그룹별 종류 수가 그 그룹을 쓰는 필드의 **pairs 수 이상**이어야 한다.
(pairs = ((X x Y) - bomb) / 2). 모자라면 `validateFieldData()` 가 데이터 오류로 거부한다.
  GROUP_CH1 4종  -> 3x3 필드(pairs 4)까지
  GROUP_CH2 8종  -> 5x3 필드(pairs 7)까지
  GROUP_CH3 12종 -> 5x5 필드(pairs 12)까지

## `export const DEFAULT_CARD_FIELD_TABLE: CardFieldTableEntry[] = [`

> 원본 L128

필드 테이블 초기값 - §5 난이도별 타일 수.

  난이도 1   : 9칸 (3x3)
  난이도 2~3 : 15칸 (3x5)
  난이도 4~5 : 25칸 (5x5)

`objectTile` 은 반드시 짝수여야 하므로, 홀수 칸 배치에서는 폭탄 수를 홀수로 맞춘다.
예) 9칸 - 폭탄 1개 = 8개(짝수) / 15칸 - 폭탄 1개 = 14개(짝수) / 25칸 - 폭탄 1개 = 24개(짝수)

## `export const CARD_MATCH_CSV_OBJECT_TABLE: CardObjectTableEntry[] = CARDMATCH_CSV_OBJECT_ROWS.map((row) => ({`

> 원본 L146

기획 CSV(`NPUZ_06_ObjectData.csv`) 65행을 오브젝트 테이블 행으로 변환한 것.
GROUP_0 은 폭탄(함정) 한 종, GROUP_1~4 는 챕터별 오브젝트 세트다.

## `export const CARD_FIELD_TABLE: CardFieldTableEntry[] = CARDMATCH_CSV_FIELD_TABLE`

> 원본 L159

실제로 쓰는 필드 테이블.

기획 CSV 는 난이도 1 / 3 / 5 만 채워져 있고 2 / 4 / 6 행은 값이 전부 0(미작성)이다.
그래서 CSV 행을 먼저 놓고, **CSV 가 다루지 않는 난이도**만 기존 손 배치 행으로 메운다.

## `function fieldIndexesFor(difficulty: number): number[] {`

> 원본 L169

 해당 난이도가 쓰는 필드 행의 index 목록

