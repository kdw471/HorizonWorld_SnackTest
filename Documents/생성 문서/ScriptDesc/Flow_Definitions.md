# Flow_Definitions.ts — 주석 아카이브

> 원본 스크립트: `Flow_Definitions.ts`
> 걷어낸 주석 28건 / 2,628 B 절감 (9,672 B → 7,044 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Flow Puzzle - Core Definitions (PUZ_05 연결 퍼즐 / 전구 잇기)

사양: `Documents/Prompts/PUZ_05_연결퍼즐.md` (+ PUZ_00 공통 기반)
인터랙션: 모바일 터치 / 드래그 (단일 터치 전용)

일반 Flow 와 다른 점: 경로가 지나갈 칸(서브 오브젝트)이 명시적으로 배치되며
**모든 서브 오브젝트를 전부 사용**해야 클리어된다 (§5).

이 계층은 `horizon/core` 에 런타임 의존이 없는 순수 로직이다 (PUZ_00 §7.1).

## 파일 머리말

> 원본 L13

#region Constants

## 파일 머리말

> 원본 L15

 필드 한 변 - §3 "7x7 필드, 최대 배치 타일 개수는 49개"

## `export enum ENodeKind {`

> 원본 L19

#endregion

## `export enum ENodeKind {`

> 원본 L21

#region Enums

## `export enum ENodeKind {`

> 원본 L23

 오브젝트 종류 - §4

## `MAIN = 'MAIN',`

> 원본 L25

 메인 오브젝트 - 색상을 가진 전구. 출발/도착 지점

## `SUB = 'SUB',`

> 원본 L27

 서브 오브젝트 - 색상이 없는 회색 전구. 연결되면 색을 부여받는다

## `export enum ENodeRole {`

> 원본 L31

 메인 오브젝트의 역할 - §4

## `export enum EFlowColor {`

> 원본 L37

 전구 색상

## `export enum EExtendRejection {`

> 원본 L60

 경로 확장이 거절된 이유 - 미리보기 비활성 사유로도 쓴다

## `NOT_ADJACENT = 'NOT_ADJACENT',`

> 원본 L63

 인접하지 않음 (대각선 포함) - §5

## `NO_TILE = 'NO_TILE',`

> 원본 L65

 타일이 없는 칸 - §3

## `ALREADY_COLORED = 'ALREADY_COLORED',`

> 원본 L67

 이미 다른 색이 활성화된 칸 - §5

## `SELF_INTERSECT = 'SELF_INTERSECT',`

> 원본 L69

 자기 경로와 교차 (서브는 입력 1 / 출력 1 뿐) - §4

## `OTHER_MAIN = 'OTHER_MAIN',`

> 원본 L71

 다른 색의 메인 오브젝트

## `PATH_COMPLETE = 'PATH_COMPLETE',`

> 원본 L73

 이미 완결된 경로는 더 늘릴 수 없다

## `NOT_DRAWING = 'NOT_DRAWING',`

> 원본 L75

 그리는 중이 아님

## `export enum EFlowState {`

> 원본 L79

 퍼즐 진행 상태 머신

## `export type FlowCell = {`

> 원본 L95

#endregion

## `export type FlowCell = {`

> 원본 L97

#region Data types

## `export type FlowNode = {`

> 원본 L104

 타일 위의 오브젝트 한 개 - §4

## `color?: EFlowColor,`

> 원본 L109

 MAIN 이면 고정 색상. SUB 이면 부여받은 색(없으면 undefined)

## `role?: ENodeRole,`

> 원본 L111

 MAIN 일 때의 역할

## `export const FLOW_PAIR_LABELS: readonly string[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];`

> 원본 L115

색 쌍에 붙이는 글자 - 두 전구가 **같은 글자**를 달고 있으면 한눈에 짝이 보인다.

색만으로는 짝을 찾기 어렵다는 신고를 받았다 (worker/NextJob.md 1번). 색약이거나 화면이
작을수록 빨강과 주황, 파랑과 남색이 붙어 보이는데 글자는 그런 조건에서도 읽힌다.

## `export const FLOW_START_MARK = '*';`

> 원본 L123

 출발 지점 표시 - 글자 뒤에 붙는다 (`A*`)

## `export function assignFlowPairLabels(nodes: readonly FlowNode[]): Map<string, string> {`

> 원본 L126

판에 쓰인 색에 글자를 붙인다. **판에 나온 순서**로 A, B, C ... 를 준다.

색 상수 순서(`ALL_FLOW_COLORS`)를 쓰지 않는 이유는, 판이 빨강과 파랑만 쓰는 경우에도
글자가 A·B 로 이어지게 하기 위해서다. 색이 글자 수보다 많으면 남는 색은 글자가 없다
(둘 다 8종이라 실제로는 일어나지 않는다).

## `export function getFlowNodeLabel(node: FlowNode, labels: Map<string, string>): string {`

> 원본 L152

전구에 얹을 글자. 출발 지점에는 표시가 하나 더 붙는다.
메인이 아니거나 글자가 없는 색이면 빈 문자열 - 선이 지나간 칸은 글자를 달지 않는다.

