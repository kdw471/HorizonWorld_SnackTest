# SlidePuzzle_FieldData.ts — 주석 아카이브

> 원본 스크립트: `SlidePuzzle_FieldData.ts`
> 걷어낸 주석 3건 / 1,198 B 절감 (11,302 B → 10,104 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

!!! 자동 생성 파일 — 직접 수정하지 말 것 !!!

생성기: Documents/Tools/build_fielddata.py
원본  : Documents/기획서 및 데이터 구조/DataTable/NPUZ_07_FieldData.csv, Documents/기획서 및 데이터 구조/DataTable/NPUZ_07_ObjectData.csv

슬라이드 퍼즐(PUZ_07) 기획 필드 테이블 60판.
난이도별 (판 수 / 분할 / 섞는 횟수): D1 (10판 / 3분할 / 8회), D2 (10판 / 3분할 / 13회), D3 (10판 / 3분할 / 20회), D4 (10판 / 4분할 / 17회), D5 (10판 / 4분할 / 35회), D6 (10판 / 4분할 / 55회)
이미지 20장. 각 판이 서로 다른 이미지를 쓴다.

원본 CSV 는 배치를 담지 않는다. (이미지 ID / 분할 개수 / 섞는 횟수) 세 값뿐이고,
실제 조각 배치는 런타임에 **합법 이동만으로 섞어서** 만든다 - 항상 풀 수 있는 배치가 보장된다.

타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다

## `export const SLIDEPUZZLE_CSV_OBJECT_TABLE: SlideObjectTableEntry[] = [`

> 원본 L17

NPUZ_07_ObjectData.csv 전체 (20행).
이 퍼즐은 이미지 하나가 곧 그룹 하나라, `puzzleObjectId` 에 원본 ID 를 그대로 쓴다.

## `export const SLIDEPUZZLE_CSV_FIELD_TABLE: SlideFieldTableEntry[] = [`

> 원본 L44

NPUZ_07_FieldData.csv 전체 (60행).
`index` 는 구현 기본 행(1~5)과 겹치지 않도록 100 부터 매긴다.

