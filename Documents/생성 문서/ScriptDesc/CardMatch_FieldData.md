# CardMatch_FieldData.ts — 주석 아카이브

> 원본 스크립트: `CardMatch_FieldData.ts`
> 걷어낸 주석 5건 / 1,260 B 절감 (19,364 B → 18,104 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

!!! 자동 생성 파일 — 직접 수정하지 말 것 !!!

생성기: Documents/Tools/build_fielddata.py
원본  : Documents/기획서 및 데이터 구조/DataTable/NPUZ_06_FieldData.csv, Documents/기획서 및 데이터 구조/DataTable/NPUZ_06_ObjectData.csv

카드 맞추기 퍼즐(PUZ_06) 기획 필드 테이블 30판 (원본 60행 중 30행은 아직 값이 비어 있어 제외).
난이도별 판 수: D1 10판, D3 10판, D5 10판
배치별 판 수: 3x3 10판, 3x5 10판, 5x5 10판
오브젝트 그룹별 종류 수: GROUP_0 1종, GROUP_1 15종, GROUP_2 17종, GROUP_3 15종, GROUP_4 17종

원본 CSV 는 배치를 직접 적지 않고 **필드 규격**만 담는다.
(오브젝트 그룹 ID / X열 / Y열 / 폭탄 수) 실제 타일 배치와 짝 배정은 런타임 생성기가 만든다.

타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다

## `export type CardMatchCsvObjectRow = {`

> 원본 L18

 원본 CSV 오브젝트 테이블 한 행

## `groupId: string,`

> 원본 L21

 GROUP_0 은 폭탄(함정), GROUP_1~4 는 챕터별 오브젝트 세트

## `export const CARDMATCH_CSV_OBJECT_ROWS: CardMatchCsvObjectRow[] = [`

> 원본 L27

 NPUZ_06_ObjectData.csv 전체 (65행)

## `export const CARDMATCH_CSV_FIELD_TABLE: CardFieldTableEntry[] = [`

> 원본 L96

NPUZ_06_FieldData.csv 에서 값이 채워진 30행.

`index` 는 구현이 원래 들고 있던 기본 행(1~5)과 겹치지 않도록 100 부터 매긴다.
`puzzleId` 는 원본 인덱스를 그대로 쓴다.

