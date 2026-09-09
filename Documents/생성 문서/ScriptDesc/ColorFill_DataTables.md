# ColorFill_DataTables.ts — 주석 아카이브

> 원본 스크립트: `ColorFill_DataTables.ts`
> 걷어낸 주석 25건 / 4,581 B 절감 (14,964 B → 10,383 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Color Fill Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_04 §7)

  [PUZ 메인 테이블]       난이도별 제한시간 / 라운드 수 / 소속 퍼즐 ID
  [색 채우기 필드 테이블]  퍼즐별 정화 / 오염 영역 값
  [오브젝트 테이블]       오브젝트 ID / 리소스 / 상태별 연출

PUZ_00 §7.2 에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.

## `export { COLORFILL_CSV_FIELD_TABLE };`

> 원본 L20

 기획 CSV 에서 생성한 필드 테이블을 그대로 재수출한다 (테스트/툴에서 참조)

## `export type ColorFillDifficultyConfig = {`

> 원본 L23

#region Table types

## `export type ColorFillDifficultyConfig = {`

> 원본 L25

 난이도별 기본 룰 - §4 다이얼 영역 테이블

## `roundCount: number,`

> 원본 L29

 퍼즐 퀘스트당 1~3 라운드 - PUZ_00 §3

## `activeSlotCount: number,`

> 원본 L31

 활성화 영역의 칸 수 - §4

## `contaminationGroupSizes: number[],`

> 원본 L33

오염 덩어리(그룹) 각각의 칸 수 - §4.
예) [5, 5] 는 5칸짜리 오염 덩어리 2개. 덩어리끼리는 서로 붙지 않게 배치된다.

## `needleSpeedDegPerSec: number,`

> 원본 L38

 바늘 회전 속도 (도/초) - §6 "난이도별로 다른 회전 속도"

## `reverseDelaySeconds: number,`

> 원본 L40

 방향 전환 딜레이 (초) - §6

## `export type ColorFillFieldTableEntry = {`

> 원본 L53

 필드 테이블 한 행 - §7 "정화 / 오염 영역 값"

## `slots: DialSlot[],`

> 원본 L57

 18칸 전체의 초기 상태

## `contaminatedCount: number,`

> 원본 L62

 오염 칸 총 개수

## `materialId: string,`

> 원본 L68

 정화 머티리얼 - §5 "MI_NPUZ_04_Safescale, Set - MainColor (0 -> 1)"

## `scalarParameterName: string,`

> 원본 L70

 애니메이션 대상 파라미터 이름

## `mainColor: number,`

> 원본 L76

 MainColor 스칼라 값 - §5 (오염 0 -> 정화 1)

## `const PURIFY_MATERIAL_ID = 'MI_NPUZ_04_Safescale';`

> 원본 L89

#endregion

## `const PURIFY_MATERIAL_ID = 'MI_NPUZ_04_Safescale';`

> 원본 L91

#region Default data

## `const PURIFY_MATERIAL_ID = 'MI_NPUZ_04_Safescale';`

> 원본 L93

 정화 머티리얼 - §5

## `[ESlotState.CONTAMINATED]: { materialId: PURIFY_MATERIAL_ID, mainColor: 0, vfxId: '', sfxId: '' },`

> 원본 L103

§5 - Set MainColor (0 -> 1)

## `export const COLOR_FILL_CSV_OBJECT_TABLE: ColorFillObjectTableEntry[] = COLORFILL_CSV_OBJECT_ROWS.map((row) =…`

> 원본 L131

기획 CSV(`NPUZ_04_ObjectData.csv`) 2행을 오브젝트 테이블 행으로 변환한 것.

원본에는 활성화 다이얼 / 비활성화 다이얼 두 행만 있고 메쉬 경로는 아직 `FREE`(미정)다.
기본 행 뒤에 붙으므로 `getObject('DIAL_SLOT')` 같은 기존 조회는 그대로 동작한다.

## `export const DEFAULT_COLOR_FILL_DIFFICULTY_TABLE: ColorFillDifficultyConfig[] = [`

> 원본 L151

난이도 테이블 초기값.

#### 사양 §4 표의 모순과 그 처리

원본 §4 표는 다음과 같다.

| 난이도 | 1 | 2 | 3 | 4 | 5 | 6 |
| 활성 칸 | 12 | 10 | 8 | 8 | 6 | 6 |
| 오염 칸 | 12-13 | 10 | 12-14 | 5/5 | 3/3/3 | 2/2/2/2 |

오염 영역은 활성 영역의 부분집합이어야 하는데 아래 난이도에서 오염이 활성보다 많다.

  - 난이도 1: 활성 12 < 오염 13
  - 난이도 3: 활성 8  < 오염 12~14
  - 난이도 4: 활성 8  < 오염 5+5 = 10
  - 난이도 5: 활성 6  < 오염 3+3+3 = 9
  - 난이도 6: 활성 6  < 오염 2+2+2+2 = 8

원본 PDF 표가 옮겨지며 어긋난 것으로 보인다.

#### 기획 데이터 테이블(NPUZ_04)로 대체했다

`Documents/기획서 및 데이터 구조/DataTable/NPUZ_04_FieldData.csv` 164판의 실측값이 정본이다.
아래 값은 그 통계(난이도별 최빈 구성 / 실제 회전 속도 / iCount)로 채웠다.

| 난이도 | 1 | 2 | 3 | 4 | 5 | 6 |
| 판 수 | 13 | 19 | 27 | 13 | 28 | 64 |
| 덩어리 수 | 2 | 3 | 3 | 4 | 5 | 6 |
| 최빈 구성 | 6/7 | 4/5/6 | 3/4/5 | 3/3/4/4 | 2/2/2/3/3 | 1/1/1/2/2/2 |
(난이도 4만 생성기 여유를 위해 3/3/3/4 로 낮춰 잡았다)
| 회전 속도 | 180 | 270 | 360 | 450 | 540 | 720 |

이 테이블은 이제 **절차적 생성기 전용**이다. 실제 플레이 판은 기획 CSV 에서 나온다.

#### 제한 시간은 실측으로 잡았다

사양에 제한 시간 수치가 없어 자동 플레이 봇으로 재서 정했다.
이 퍼즐은 **한 번의 터치가 오염 덩어리를 통째로 정화**하므로 필요한 터치가 덩어리 수만큼뿐이고,
다이얼 한 바퀴가 2~4초라 놓쳐도 곧 다시 기회가 온다. 그래서 소요 시간이 본질적으로 짧다.

봇 실측(레벨 30개, 90퍼센타일): D1 0.8초 ~ D6 4.1초.
반응 지연을 0.6초까지 늘려도 전부 클리어했다.
사람은 좁은 타이밍 창을 여러 번 놓치므로 실측의 5~7배를 제한 시간으로 잡았다.
처음에 60~100초로 잡았던 값은 근거 없이 헐거웠다.

## `difficulty: 4,`

> 원본 L226

CSV 최빈 구성은 3/3/4/4(합 14)지만 그러면 18칸이 꽉 차 여백이 칸마다 1개뿐이라
생성기가 만들 수 있는 배치가 사실상 하나뿐이 된다. 여유를 두려고 합 13짜리 구성을 쓴다.

## `export const DEFAULT_COLOR_FILL_FIELD_TABLE: ColorFillFieldTableEntry[] = [];`

> 원본 L256

 필드 테이블 초기값. 비어 있으면 레벨 생성기가 런타임에 만든다 (PUZ_00 §7.3)

## `export const COLOR_FILL_FIELD_TABLE: ColorFillFieldTableEntry[] =`

> 원본 L259

실제로 쓰는 필드 테이블.

기획 CSV(`ColorFill_FieldData.ts`)가 있으면 그것을 쓴다.
난이도에 해당하는 행이 하나도 없으면 세션이 절차적 생성기로 폴백한다.

## `(파일 끝)`

> 원본 L421

#endregion

