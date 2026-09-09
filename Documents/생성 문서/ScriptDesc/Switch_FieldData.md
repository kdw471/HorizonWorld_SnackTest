# Switch_FieldData.ts — 주석 아카이브

> 원본 스크립트: `Switch_FieldData.ts`
> 걷어낸 주석 3건 / 1,250 B 절감 (23,276 B → 22,026 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

!!! 자동 생성 파일 — 직접 수정하지 말 것 !!!

생성기: Documents/Tools/build_fielddata.py
원본  : Documents/기획서 및 데이터 구조/DataTable/NPUZ_08_FieldData.csv, Documents/기획서 및 데이터 구조/DataTable/NPUZ_08_ObjectData.csv

스위치 퍼즐(PUZ_08) 기획 필드 테이블 87판.
난이도별 (판 수 / 키 캡 수 / 최소 누름 수): D1 (20판 / 9~9칸 / 1~2수), D2 (23판 / 9~9칸 / 2~3수), D3 (14판 / 15~15칸 / 3~7수), D4 (16판 / 21~25칸 / 5~13수), D5 (14판 / 21~25칸 / 4~11수)
도장(3x3 마스크) 20종.

원본 CSV 는 다른 퍼즐과 달리 **초기 눌림 상태를 그대로** 담고 있다.
  0 = 안 눌림(빨강) / 1 = 눌림(녹색, 목표 상태) / 2 = FREE(키 캡 없음)
그래서 이 판들은 역셔플로 만들지 않고 데이터 그대로 로드한다 (`initialRows`).
`shuffleCount` 에는 GF(2) 선형대수로 미리 구한 **최소 누름 수**를 넣었다.

타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다

## `export const SWITCH_CSV_OBJECT_TABLE: SwitchObjectTableEntry[] = [`

> 원본 L19

NPUZ_08_ObjectData.csv 의 도장 20종.
`switchAreaId` 에 원본 오브젝트 ID 를 그대로 쓴다.

## `export const SWITCH_CSV_FIELD_TABLE: SwitchFieldTableEntry[] = [`

> 원본 L46

NPUZ_08_FieldData.csv 전체 (87행).
`index` 는 구현 기본 행(1~5)과 겹치지 않도록 100 부터 매긴다.

