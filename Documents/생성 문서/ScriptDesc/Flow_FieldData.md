# Flow_FieldData.ts — 주석 아카이브

> 원본 스크립트: `Flow_FieldData.ts`
> 걷어낸 주석 11건 / 1,606 B 절감 (13,251 B → 11,645 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

!!! 자동 생성 파일 — 직접 수정하지 말 것 !!!

생성기: Documents/Tools/build_fielddata.py
원본  : Documents/기획서 및 데이터 구조/DataTable/NPUZ_05_FieldData.csv, Documents/기획서 및 데이터 구조/DataTable/NPUZ_05_ObjectData.csv

연결 퍼즐(PUZ_05) 기획 필드 테이블 120판.
난이도별 판 수: D1 20판, D2 20판, D3 20판, D4 20판, D5 20판, D6 20판
난이도별 색상 쌍 수: D1 2~5, D2 3~4, D3 3~6, D4 3~7, D5 3~6, D6 3~8
난이도별 타일 수: D1 15~36, D2 25~30, D3 32~49, D4 37~47, D5 42~46, D6 49~49

인코딩: `인덱스|49글자`
  49글자 = 7x7 을 A1..A7,B1..B7,... 순서로 이어 붙인 것
    '.'  타일 없음
    '#'  서브 전구 (색 없음)
    대문자 R O Y G B I V P  메인 전구 **출발**
    소문자 r o y g b i v p  메인 전구 **도착**

## `import type { FlowFieldTableEntry } from 'Flow_DataTables';`

> 원본 L26

타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다

## `export type FlowCsvObjectRow = {`

> 원본 L29

 원본 CSV 오브젝트 테이블 한 행

## `category: string,`

> 원본 L32

 01 메인(출발) / 02 메인(도착) / 03 서브

## `color: string,`

> 원본 L34

 01 R ~ 08 P / 00 무색

## `export const FLOW_CSV_OBJECT_ROWS: FlowCsvObjectRow[] = [`

> 원본 L40

 NPUZ_05_ObjectData.csv 전체 (17행)

## `const RAW_LEVELS: string[] = [`

> 원본 L61

 NPUZ_05_FieldData.csv 전체 (120행) - 위 인코딩 규칙 참조

## `const COLOR_BY_LETTER: { [letter: string]: EFlowColor } = {`

> 원본 L185

기획 CSV 의 색 코드 -> 구현 색상 enum.
기획은 R O Y G B I(인디고) V(바이올렛) P 8종, 구현도 8종이라 1:1 대응한다.
(인디고/바이올렛은 구현의 CYAN/PURPLE 슬롯을 쓴다. 실제 색은 메쉬가 정한다)

## `const difficulty = parseInt(puzzleId.substring(5, 7), 10);`

> 원본 L204

인덱스 10자리 = 80 + 0 + 퍼즐(2) + 난이도(2) + 순서(3)

## `const isStart = symbol === symbol.toUpperCase();`

> 원본 L230

대문자 = 출발, 소문자 = 도착

## `export const FLOW_CSV_FIELD_TABLE: FlowFieldTableEntry[] = RAW_LEVELS.map(decodeLevel);`

> 원본 L259

 기획 CSV 에서 뽑은 연결 퍼즐 필드 테이블 (120판)

