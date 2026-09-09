# 가이드 — 기획 CSV 를 갱신했을 때

> 대상: `Documents/기획서 및 데이터 구조/DataTable/*.csv` 를 기획팀이 갱신한 뒤 코드에 반영하는 절차
> 관련 문서: `../데이터 테이블 구조/PUZ_00_데이터테이블_적용_총괄.md` (변환 파이프라인 전체), `타입체크와_테스트_실행.md`

---

## 1. 공통 절차

```bash
cd Documents/Tools
python build_<퍼즐>.py          # -> scripts/<퍼즐>_FieldData.ts 재생성
```

그다음 `타입체크와_테스트_실행.md` 의 §1~§3 을 돌린다.
변환기가 배치 규칙 위반을 콘솔에 찍고, 테스트가 같은 규칙을 한 번 더 검사한다.

**`*_FieldData.ts` 는 자동 생성 파일이므로 직접 고치지 않는다.**
손으로 고친 내용은 다음 변환에서 전부 사라진다.

---

## 2. 퍼즐별 변환기와 사전 작업

| 퍼즐 | 변환기 | 생성물 | 사전에 돌려야 하는 것 |
|---|---|---|---|
| PUZ_01 레이저 | `build_laser.py` | `Laser_FieldData.ts` | — |
| PUZ_02 러시아워 | `build_rushhour.py` | `RushHour_FieldData.ts` | **`rushhour_minmoves.json`** (§3.1) |
| PUZ_03 정렬 | `build_colorsort.py` | `ColorSort_FieldData.ts` | — |
| PUZ_04 색 채우기 | `build_colorfill.py` | `ColorFill_FieldData.ts` | — |
| PUZ_05 연결 | `build_flow.py` | `Flow_FieldData.ts` | — |
| PUZ_06 카드 맞추기 | `build_cardmatch.py` | `CardMatch_FieldData.ts` | — |
| PUZ_07 슬라이드 | `build_slidepuzzle.py` | `SlidePuzzle_FieldData.ts` | — |
| PUZ_08 스위치 | `build_switch.py` | `Switch_FieldData.ts` | **`switch_minpresses.json`** (§3.2) |

---

## 3. 사전 계산이 필요한 두 퍼즐

### 3.1 러시아워 — 최소 이동 수

판을 추가·수정했다면 `rushhour_minmoves.json` 을 다시 만들어야 한다.

```bash
# 임시 폴더에서 RUSH_HOUR_FIELD_TABLE 을 순회하며 solver.solve(board, {maxStates: 2000000})
# 결과를 Documents/Tools/rushhour_minmoves.json 으로 저장한 뒤 build_rushhour.py 재실행
```

없으면 전부 `-1` 로 들어가며, **그래도 플레이에는 지장이 없다.**

### 3.2 스위치 — 최소 누름 수

```bash
cd Documents/Tools
python switch_minpresses.py switch_minpresses.json   # 1) 최소 누름 수 재계산
python build_switch.py                               # 2) Switch_FieldData.ts 재생성
```

**배치가 바뀌면 1번을 반드시 먼저 돌려야 한다.** `switch_minpresses.json` 이 낡으면
`shuffleCount` 가 실제 최소 해와 어긋나고, 검증기가 "최소 해가 K를 넘는다" 로 거부한다.
값이 없는 판은 `-1` 로 들어가며 변환기가 문제로 보고한다.

---

## 4. 변환기가 콘솔에 찍는 검증 항목

| 퍼즐 | 검사 내용 |
|---|---|
| PUZ_01 레이저 | 배치 규칙 위반 |
| PUZ_02 러시아워 | 겹침 · 필드 이탈 · 동일 선상 위반 |
| PUZ_03 정렬 | 스택 구멍 · 비활성 케이스에 들어간 건전지 · 색상 개수 배수 위반 · 블랙 건전지 최상단 노출 |
| PUZ_04 색 채우기 | "18칸에 안 들어가는 판" |
| PUZ_05 연결 | 영역별 색 쌍 어긋남(출발만 있고 도착이 없음) · 색 쌍이 없는 고립 영역 · 색 쌍 중복으로 색을 바꾼 경우(`~` 로 시작) |
| PUZ_06 카드 맞추기 | 값이 비어 건너뛴 행(`~` 로 시작) · 짝수가 아닌 오브젝트 타일 수 · 짝 수보다 종류가 모자라는 오브젝트 그룹 |
| PUZ_07 슬라이드 | 3·4 가 아닌 분할 개수 · 오브젝트 테이블에 없는 이미지를 가리키는 행 · 어느 판도 쓰지 않는 이미지 |
| PUZ_08 스위치 | 오브젝트 테이블에 없는 도장 · 중앙 비트가 없는 도장 · 키 캡 2개 미만 / 시작부터 완성된 판 · 최소 누름 수 미검증 행 |

---

## 5. CSV 외에 함께 손봐야 하는 것

| 상황 | 추가 작업 |
|---|---|
| 색 채우기 난이도별 속도·구성 변경 | `ColorFill_DataTables.ts` 의 난이도 테이블(생성기 전용)도 같이 손봐야 폴백 생성기가 기획 의도와 어긋나지 않는다 |
| 카드 맞추기 난이도 2/4/6 행이 채워짐 | 변환기가 자동 포함하고 `fieldIndexes` 도 계산식이라 그대로 반영된다. **난이도 6 을 추가하려면** `CardMatch_DataTables.ts` 난이도 테이블에 D6 행만 더한다 |
| 카드 맞추기 필드 크기 확대 | 오브젝트 풀도 함께 늘려야 한다 (필요한 종류 수 < 보유 종류 수 조건) |
| 리소스 경로 확정 | `meshPath` / `imagePath` / `materialId` 를 CSV 에서 교체하면 된다 |
