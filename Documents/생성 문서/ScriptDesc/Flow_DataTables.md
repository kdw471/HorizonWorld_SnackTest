# Flow_DataTables.ts — 주석 아카이브

> 원본 스크립트: `Flow_DataTables.ts`
> 걷어낸 주석 20건 / 1,713 B 절감 (11,951 B → 10,238 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Flow Data Tables - 3계층 테이블 (PUZ_00 §6, PUZ_05 §8)

  [PUZ 메인 테이블]      난이도별 제한시간 / 라운드 수 / 소속 퍼즐 ID
  [연결 퍼즐 필드 테이블]  퍼즐별 타일 생성 좌표 / 오브젝트 배치 좌표 / 수량
  [오브젝트 테이블]      메인 / 서브 오브젝트 ID 와 리소스

PUZ_00 §7.2 에 따라 모든 수치는 하드코딩하지 않고 이 테이블에서 읽는다.

## `export { FLOW_CSV_FIELD_TABLE };`

> 원본 L24

 기획 CSV 에서 생성한 필드 테이블을 그대로 재수출한다 (테스트/툴에서 참조)

## `export const FLOW_TILE_MASKS: { [name: string]: string[] } = {`

> 원본 L27

#region Tile masks (§3)

## `export const FLOW_TILE_MASKS: { [name: string]: string[] } = {`

> 원본 L29

사양 §3 에 예시로 제시된 타일 비트맵들.
1 = 타일 있음, 0 = 없음. 각 마스크는 7줄 x 7글자다.

## `FULL: [`

> 원본 L34

 전체 49칸

## `HOLES: [`

> 원본 L44

네 귀퉁이 안쪽에 구멍이 뚫린 형태 (§3 예시 1).

주의: 이 마스크는 이분 그래프 불균형이 3이라 **해밀턴 경로가 존재할 수 없다**
(45칸 = 21 / 24). 그래서 경로 분해 방식 생성기가 쓸 수 없어 난이도 설정에서 제외했다.
손으로 배치한 필드 테이블에서는 쓸 수 있다.

## `CROSS: [`

> 원본 L60

 십자 형태 (§3 예시 2)

## `STAIR: [`

> 원본 L70

 계단 형태 (§3 예시 3)

## `SPLIT: [`

> 원본 L80

 가운데가 갈라진 형태 (§3 예시 4)

## `export type FlowDifficultyConfig = {`

> 원본 L92

#endregion

## `export type FlowDifficultyConfig = {`

> 원본 L94

#region Table types

## `roundCount: number,`

> 원본 L99

 퍼즐 퀘스트당 1~3 라운드 - PUZ_00 §3

## `tileMaskNames: string[],`

> 원본 L101

 사용할 타일 마스크 이름들. 생성 시 하나를 고른다

## `colorCount: number,`

> 원본 L103

 색상 수 (= 메인 오브젝트 쌍의 수 = 경로 개수)

## `export type FlowFieldTableEntry = {`

> 원본 L116

 필드 테이블 한 행 - §8

## `tileBitmap: string[],`

> 원본 L120

 퍼즐 타일 생성 좌표 값 - 0/1 비트맵 7줄

## `nodes: FlowNode[],`

> 원본 L122

 오브젝트 배치 좌표 값

## `mainCount: number,`

> 원본 L124

 오브젝트 수량 값

## `function makeBulbVisuals(prefix: string): { [state: string]: FlowStateVisual } {`

> 원본 L149

#endregion

## `function makeBulbVisuals(prefix: string): { [state: string]: FlowStateVisual } {`

> 원본 L151

#region Default data

