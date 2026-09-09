# Switch_DataTables.ts — 주석 아카이브

> 원본 스크립트: `Switch_DataTables.ts`
> 걷어낸 주석 23건 / 2,891 B 절감 (12,344 B → 9,453 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Switch Puzzle Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_08 §8)

  [PUZ 메인 테이블]       난이도별 제한시간 / 라운드 수 / 소속 퍼즐 ID
  [NPUZ_08_FieldData]     스위치 영역 ID / 키 캡 레이아웃(5×5, FREE 포함) / 역셔플 누름 횟수 K
  [NPUZ_08_ObjectData]    스위치 영역 ID / sSwitchArray (3×3 마스크)

PUZ_00 §7.2 에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.

§5 상태 표기 노트: 문서 도식의 라벨과 텍스트 정의가 상이하므로,
구현은 **1 = 눌림(녹색/목표), 0 = 안 눌림(빨강)** 으로 통일한다.
외부 데이터가 반대 표기라면 임포터에서 한 번만 매핑한다.

## `export { SWITCH_CSV_FIELD_TABLE };`

> 원본 L25

 기획 CSV 에서 생성한 필드 테이블을 그대로 재수출한다 (테스트/툴에서 참조)

## `export type SwitchObjectTableEntry = {`

> 원본 L28

#region Table types

## `export type SwitchObjectTableEntry = {`

> 원본 L30

 NPUZ_08_ObjectData 한 행 - §8. 라운드마다 다른 스위치 영역을 제공한다 (§6)

## `switchAreaId: string,`

> 원본 L32

 스위치 영역 ID

## `name: string,`

> 원본 L34

 표시용 이름

## `maskRows: string[],`

> 원본 L36

 sSwitchArray - 3×3 마스크 ('0'/'1' 3행). 중앙은 항상 '1' (§6)

## `export type SwitchFieldTableEntry = {`

> 원본 L40

 NPUZ_08_FieldData 한 행 - §8

## `switchAreaId: string,`

> 원본 L45

 이 필드가 쓰는 스위치 영역 ID

## `layoutRows: string[],`

> 원본 L47

 키 캡 배치 (5행 × 5글자). 'O' = 키 캡, '.' = FREE (§4)

## `initialRows?: string[],`

> 원본 L49

초기 눌림 상태 (5행 × 5글자). '1' 눌림 / '0' 안 눌림 / '.' FREE.

기획 CSV(NPUZ_08)는 배치를 직접 담고 있으므로 이 값이 있으면 **그대로 로드**한다.
없으면 목표 상태에서 `shuffleCount` 번 역셔플해 배치를 만든다 (§9.4).

## `shuffleCount: number,`

> 원본 L56

역셔플 누름 횟수 K - §9.4. 난이도의 1차 결정 요소.
`initialRows` 가 있는 행에서는 **검증된 최소 누름 수**를 담는다.

## `roundCount: number,`

> 원본 L66

 퍼즐 퀘스트당 1~3 라운드 - PUZ_00 §3

## `fieldIndexes: number[],`

> 원본 L68

 사용할 필드 데이터 index 들

## `export const DEFAULT_SWITCH_OBJECT_TABLE: SwitchObjectTableEntry[] = [`

> 원본 L81

#endregion

## `export const DEFAULT_SWITCH_OBJECT_TABLE: SwitchObjectTableEntry[] = [`

> 원본 L83

#region Default data

## `export const DEFAULT_SWITCH_OBJECT_TABLE: SwitchObjectTableEntry[] = [`

> 원본 L85

오브젝트 테이블 초기값 - 스위치 영역(sSwitchArray) 카탈로그.
모든 마스크는 중앙 '1' 을 포함한다 (§6). 마스크가 복잡할수록 어렵다 (§9.4).

## `const LAYOUT_FULL_5X5 = [`

> 원본 L98

 5×5 전체 사용 레이아웃 - §4 도식 좌측

## `const LAYOUT_CENTER_3X3 = [`

> 원본 L107

 중앙 3×3 만 사용 - §4 도식 우측 예시

## `const LAYOUT_DIAMOND = [`

> 원본 L116

 FREE 구멍이 있는 변형 레이아웃 - 난이도용 (§9.4 "FREE 비율로 조절")

## `export const DEFAULT_SWITCH_FIELD_TABLE: SwitchFieldTableEntry[] = [`

> 원본 L125

필드 테이블 초기값.
난이도는 K(역셔플 누름 횟수), 사용 칸 수(FREE 비율), 마스크 복잡도로 조절한다 (§9.4).
K 는 사용 칸 수 이하여야 한다 - 역셔플이 서로 다른 칸만 누르기 때문이다.

## `export const SWITCH_FIELD_TABLE: SwitchFieldTableEntry[] =`

> 원본 L138

실제로 쓰는 필드 / 오브젝트 테이블.

기획 CSV(`Switch_FieldData.ts`)가 있으면 그것을 쓰고, 없으면 위의 손 배치 행으로 떨어진다.
도장(마스크)은 기본 6종 뒤에 기획 20종을 이어 붙인다.

## `function fieldIndexesFor(difficulty: number): number[] {`

> 원본 L150

 해당 난이도가 쓰는 필드 행의 index 목록

