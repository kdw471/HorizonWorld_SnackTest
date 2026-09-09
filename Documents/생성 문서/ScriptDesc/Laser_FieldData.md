# Laser_FieldData.ts — 주석 아카이브

> 원본 스크립트: `Laser_FieldData.ts`
> 걷어낸 주석 10건 / 1,599 B 절감 (20,832 B → 19,233 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

!!! 자동 생성 파일 — 직접 수정하지 말 것 !!!

생성기: Documents/Tools/build_fielddata.py
원본  : Documents/기획서 및 데이터 구조/DataTable/NPUZ_01_FieldData.csv, Documents/기획서 및 데이터 구조/DataTable/NPUZ_01_ObjectData.csv

레이저 퍼즐(PUZ_01) 기획 필드 테이블 75판.
난이도별 판 수: D1 3판, D2 20판, D3 21판, D4 11판, D5 10판, D6 10판

인코딩: `인덱스|기믹|고정크리스탈|인벤토리`
  기믹        : <종류><색><칸>  종류 E 발사체 / R 수신체 / Y 중계체 / K 해골, 색 R/G/B/-
  고정크리스탈 : <종류><방향><칸>  종류 T 삼각 / X 십자 / F 흡수, 방향 1 ◸ 2 ◹ 3 ◺ 4 ◿ / -
  인벤토리    : <종류><방향>
  칸          : A1..G7 (행 A~G = 전체 그리드 0~6, 열 1~7 = 0~6)

발사체/수신체는 테두리, 중계체/해골/고정크리스탈은 안쪽 5x5 에만 놓인다 (§2 / §5.1).
발사 방향은 테두리 위치에서 유도되므로(getInwardDirection) 따로 저장하지 않는다.

## `import type { LaserFieldTableEntry } from 'Laser_DataTables';`

> 원본 L29

타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다

## `export type LaserCsvObjectRow = {`

> 원본 L32

 원본 CSV 오브젝트 테이블 한 행

## `movable: boolean,`

> 원본 L35

 true 면 인벤토리로 지급되는 이동 크리스탈, false 면 필드 고정물

## `category: string,`

> 원본 L37

 01 발사체 / 02 수신체 / 03 중계체 / 04 해골 / 05 삼각 / 06 십자 / 07 흡수

## `color: string,`

> 원본 L39

 01 R / 02 G / 03 B / 00 무색

## `export const LASER_CSV_OBJECT_ROWS: LaserCsvObjectRow[] = [`

> 원본 L45

 NPUZ_01_ObjectData.csv 전체 (40행)

## `const RAW_LEVELS: string[] = [`

> 원본 L89

 NPUZ_01_FieldData.csv 전체 (75행) - 위 인코딩 규칙 참조

## `function parseCell(token: string): { row: number, col: number } {`

> 원본 L188

 'C3' -> 전체 그리드 좌표

## `const difficulty = parseInt(puzzleId.substring(5, 7), 10);`

> 원본 L213

인덱스 10자리 = 80 + 0 + 퍼즐(2) + 난이도(2) + 순서(3)

