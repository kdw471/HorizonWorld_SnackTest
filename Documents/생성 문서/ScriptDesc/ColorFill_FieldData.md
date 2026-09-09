# ColorFill_FieldData.ts — 주석 아카이브

> 원본 스크립트: `ColorFill_FieldData.ts`
> 걷어낸 주석 10건 / 1,774 B 절감 (9,717 B → 7,943 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

!!! 자동 생성 파일 — 직접 수정하지 말 것 !!!

생성기: Documents/Tools/build_fielddata.py
원본  : Documents/기획서 및 데이터 구조/DataTable/NPUZ_04_FieldData.csv, Documents/기획서 및 데이터 구조/DataTable/NPUZ_04_ObjectData.csv

색 채우기 퍼즐(PUZ_04) 기획 필드 테이블 164판.
난이도별 판 수: D1 13판, D2 19판, D3 27판, D4 13판, D5 28판, D6 64판
난이도별 바늘 속도(도/초): D1 180, D2 270, D3 360, D4 450, D5 540, D6 720
라운드 수(iCount): 3

인코딩: `인덱스|다이얼18칸|바늘속도`
  다이얼 : 18글자. '1' 오염(=활성) 칸 / '0' 비활성 칸
  바늘속도: 초당 회전 각도

원본 CSV 의 `sObjectDivideID` 는 "6/7" 처럼 **오염 덩어리 각각의 칸 수**만 담고 있고
어느 각도에 놓이는지는 없다. 변환기가 덩어리 사이 간격을 최대한 고르게 벌려 18칸 위에 배치했다.
활성 영역은 오염 칸과 같게 잡는다 (기획 데이터에 "활성이지만 깨끗한 칸" 정보가 없다).

## `import type { ColorFillFieldTableEntry } from 'ColorFill_DataTables';`

> 원본 L25

타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다

## `export type ColorFillCsvObjectRow = {`

> 원본 L28

 원본 CSV 오브젝트 테이블 한 행

## `category: string,`

> 원본 L31

 01 활성화 다이얼 / 02 비활성화 다이얼

## `export const COLORFILL_CSV_OBJECT_ROWS: ColorFillCsvObjectRow[] = [`

> 원본 L38

 NPUZ_04_ObjectData.csv 전체 (2행)

## `const RAW_LEVELS: string[] = [`

> 원본 L44

 NPUZ_04_FieldData.csv 전체 (164행) - 위 인코딩 규칙 참조

## `const REVERSE_DELAY_BY_DIFFICULTY: number[] = [0.3, 0.3, 0.35, 0.35, 0.4, 0.4];`

> 원본 L212

방향 전환 딜레이(초). 기획 CSV 에 없는 값이라 난이도별로 여기서 준다 - §6.
난이도가 올라갈수록 바늘이 빨라지므로 딜레이도 조금씩 늘린다.

## `const difficulty = parseInt(puzzleId.substring(5, 7), 10);`

> 원본 L221

인덱스 10자리 = 80 + 0 + 퍼즐(2) + 난이도(2) + 순서(3)

## `isActive: isContaminated,`

> 원본 L233

활성 영역 == 오염 영역 (원본에 "활성이지만 깨끗한 칸" 정보가 없다)

## `export const COLORFILL_CSV_FIELD_TABLE: ColorFillFieldTableEntry[] = RAW_LEVELS.map(decodeLevel);`

> 원본 L250

 기획 CSV 에서 뽑은 색 채우기 필드 테이블 (164판)

