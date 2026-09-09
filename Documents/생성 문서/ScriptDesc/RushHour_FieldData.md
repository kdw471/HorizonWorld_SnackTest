# RushHour_FieldData.ts — 주석 아카이브

> 원본 스크립트: `RushHour_FieldData.ts`
> 걷어낸 주석 11건 / 1,759 B 절감 (13,937 B → 12,178 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

!!! 자동 생성 파일 — 직접 수정하지 말 것 !!!

생성기: Documents/Tools/build_fielddata.py
원본  : Documents/기획서 및 데이터 구조/DataTable/NPUZ_02_FieldData.csv, Documents/기획서 및 데이터 구조/DataTable/NPUZ_02_ObjectData.csv

러시아워 퍼즐(PUZ_02) 기획 필드 테이블 53판.
난이도별 판 수: D1 3판, D2 10판, D3 10판, D4 10판, D5 10판, D6 10판
도착 포인트 개수별 판 수: 1개 38판, 2개 15판

인코딩: `인덱스|도착포인트|오브젝트|최소이동수`
  도착포인트 : <변><색><칸>       변 T/B/L/R = 목표에서 봤을 때 포인트가 있는 쪽, 색 R/B
  오브젝트   : <길이><축><색><칸>  축 V 세로 / H 가로 / F 자유(1x1), 색 R·B 는 목표 USB, - 는 방해물
  칸         : A1..G7 (좌측·상단 칸 기준, 기획서 §7)
  최소이동수 : BFS 솔버로 미리 구한 값. -1 은 탐색 상한 안에 못 구한 미검증 판

원본 CSV 는 오브젝트를 "머리 칸" 한 곳에만 적고 몸통이 머리 반대쪽으로 뻗는 형식이라,
변환하면서 좌측·상단 칸 기준으로 바꿨다. 도착 포인트도 원본은 7x7 안쪽 좌표라
전체 9x9 좌표로 옮긴다(로컬 + 1).

## `import type { RushHourFieldTableEntry, RushHourPlacement } from 'RushHour_DataTables';`

> 원본 L28

타입만 가져온다 - 런타임 순환 참조를 만들지 않기 위해 `import type` 을 쓴다

## `export type RushHourCsvObjectRow = {`

> 원본 L31

 원본 CSV 오브젝트 테이블 한 행

## `kind: string,`

> 원본 L34

 1 목표 USB / 2 방해 블록 / 3 도착 포인트

## `axis: number,`

> 원본 L37

 1 세로 / 2 가로 / 3 없음(1x1) / 0 없음

## `head: number,`

> 원본 L39

 1 U / 2 D / 3 L / 4 R / 0 없음

## `color: string,`

> 원본 L41

 1 빨강 / 2 파랑 / 0 무색

## `export const RUSHHOUR_CSV_OBJECT_ROWS: RushHourCsvObjectRow[] = [`

> 원본 L46

 NPUZ_02_ObjectData.csv 전체 (23행)

## `const RAW_LEVELS: string[] = [`

> 원본 L73

 NPUZ_02_FieldData.csv 전체 (53행) - 위 인코딩 규칙 참조

## `function parseCell(token: string): { row: number, col: number } {`

> 원본 L149

 'C3' -> 플레이 로컬 좌표

## `const difficulty = parseInt(puzzleId.substring(5, 7), 10);`

> 원본 L164

인덱스 10자리 = 80 + 0 + 퍼즐(2) + 난이도(2) + 순서(3)

