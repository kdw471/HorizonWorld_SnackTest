# ColorSort_FieldData.ts — 주석 아카이브

> 원본 스크립트: `ColorSort_FieldData.ts`
> 걷어낸 주석 10건 / 1,855 B 절감 (11,234 B → 9,379 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

!!! 자동 생성 파일 — 직접 수정하지 말 것 !!!

생성기: Documents/Tools/build_fielddata.py
원본  : Documents/기획서 및 데이터 구조/DataTable/NPUZ_03_FieldData.csv, Documents/기획서 및 데이터 구조/DataTable/NPUZ_03_ObjectData.csv

정렬 퍼즐(PUZ_03) 기획 필드 테이블 60판.
난이도별 판 수: D1 10판, D2 10판, D3 10판, D4 10판, D5 10판, D6 10판
난이도별 블랙(미지) 건전지 총 개수: D1 0개, D2 0개, D3 0개, D4 0개, D5 165개, D6 210개

인코딩: `인덱스|케이스1;케이스2;...;케이스8`
  케이스 : '-' 비활성 / '.' 활성 빈 케이스(여분) / 그 외는 **아래에서 위로** 쌓인 건전지 색 문자열
  색     : R O Y G B I V P (뒤에 '?' 가 붙으면 블랙(미지) 건전지 - §7)

원본 CSV 는 행 A~D 가 위에서 아래 순서다. 구현 쪽 배열은 아래 -> 위 순서라 뒤집어 넣었다.
(A행에 블랙 건전지가 한 번도 오지 않는 것으로 A = 최상단임을 확인했다 - §7 "최상단에 위치할 수 없다")

## `import type { ColorSortFieldTableEntry } from 'ColorSort_DataTables';`

> 원본 L24

타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다

## `export type ColorSortCsvObjectRow = {`

> 원본 L27

 원본 CSV 오브젝트 테이블 한 행

## `category: string,`

> 원본 L30

 01 일반 건전지 / 02 블랙(미지) 건전지 / 00 케이스·덮개

## `color: string,`

> 원본 L32

 01 R ~ 08 P / 00 색 없음

## `export const COLORSORT_CSV_OBJECT_ROWS: ColorSortCsvObjectRow[] = [`

> 원본 L38

 NPUZ_03_ObjectData.csv 전체 (18행)

## `const RAW_LEVELS: string[] = [`

> 원본 L60

 NPUZ_03_FieldData.csv 전체 (60행) - 위 인코딩 규칙 참조

## `const COLOR_BY_LETTER: { [letter: string]: EBatteryColor } = {`

> 원본 L124

기획 CSV 의 색 코드 -> 구현 색상 enum.
기획 데이터는 R O Y G B I(인디고) V(바이올렛) P 8종을 쓰고 구현은 10종을 정의하고 있어,
인디고/바이올렛을 남는 슬롯에 대응시켰다. 실제로 보이는 색은 오브젝트 테이블의 메쉬가 정한다.

## `const difficulty = parseInt(puzzleId.substring(5, 7), 10);`

> 원본 L143

인덱스 10자리 = 80 + 0 + 퍼즐(2) + 난이도(2) + 순서(3)

## `const isRevealed = token.charAt(position + 1) !== '?';`

> 원본 L167

색 뒤에 '?' 가 붙어 있으면 블랙(미지) 건전지다 - §7

