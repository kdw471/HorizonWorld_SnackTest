# PuzzleUI_Definitions.ts — 주석 아카이브

> 원본 스크립트: `PuzzleUI_Definitions.ts`
> 걷어낸 주석 45건 / 4,102 B 절감 (8,244 B → 4,142 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Puzzle UI Definitions - 메인 UI(퍼즐 허브)의 상수·타입·헬퍼

8개 퍼즐 공통 메인 UI 의 어휘를 정의한다. `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

메인 UI 는 다음 네 화면을 오간다.

  메인 메뉴(퍼즐 선택) → 난이도 선택 → 인게임 HUD(일시정지 포함) → 결과

퍼즐별 표시 이름과 부제는 여기의 카탈로그가 정본이다. 아직 Horizon 통합(*_CoreAPI)이
없는 퍼즐은 레지스트리에 등록되지 않으므로 메인 메뉴에 "준비 중" 으로 표시된다.

## 파일 머리말

> 원본 L14

#region Puzzle catalog

## 파일 머리말

> 원본 L16

 8개 퍼즐의 식별자. 기획서 번호(PUZ_01~08) 순서를 따른다

## `orderIndex: number,`

> 원본 L30

 메인 메뉴 격자에서의 표시 순서 (0-based, PUZ 번호 순)

## `displayName: string,`

> 원본 L32

 버튼에 표시할 이름

## `subtitle: string,`

> 원본 L34

 한 줄 설명

## `export const PUZZLE_CATALOG: readonly PuzzleCatalogEntry[] = [`

> 원본 L38

 메인 메뉴에 표시하는 8개 퍼즐의 정본 목록

## `export enum EPuzzleHubScreen {`

> 원본 L54

#endregion

## `export enum EPuzzleHubScreen {`

> 원본 L56

#region Screens

## `export enum EPuzzleHubScreen {`

> 원본 L58

 메인 UI 의 화면 상태 머신

## `MAIN_MENU = 'MAIN_MENU',`

> 원본 L60

 퍼즐 선택 격자 (2열 × 4행)

## `PUZZLE_DETAIL = 'PUZZLE_DETAIL',`

> 원본 L62

고른 퍼즐 하나가 화면을 꽉 채운 상세 화면.
Start / Continue / Return 세 버튼만 세로로 놓는다.

## `IN_GAME = 'IN_GAME',`

> 원본 L67

 플레이 중 - 상단 HUD 만 표시하고 보드를 가리지 않는다 (PUZ_00 §8.5 손가락 가림 대응)

## `PAUSED = 'PAUSED',`

> 원본 L69

 일시정지 오버레이

## `RESULT = 'RESULT',`

> 원본 L71

 승패 결과

## `export type PuzzleUIRoundProgress = {`

> 원본 L75

#endregion

## `export type PuzzleUIRoundProgress = {`

> 원본 L77

#region Shared data shapes

## `export type PuzzleUIRoundProgress = {`

> 원본 L79

라운드 진행도. 8개 퍼즐의 `*RoundProgress` 가 전부 이 모양이라
(current/total/cleared) 구조적 타이핑으로 그대로 받을 수 있다.

## `export type PuzzleQuestResultSource = {`

> 원본 L89

퀘스트 결과의 공통 부분. 8개 퍼즐의 `*ResultData` 가 전부 이 필드를 포함한다.
(퍼즐별 고유 필드 - unpressedKeyCount 등 - 는 메인 UI 에서 쓰지 않는다)

## `export type PuzzleUIQuestResult = {`

> 원본 L99

 메인 UI 가 결과 화면에 표시하는 정규화된 결과

## `export type PuzzleLevelRef = {`

> 원본 L108

레벨 하나를 가리키는 좌표.

**레벨 하나 = 퀘스트 라운드 하나 = 기획 판(field) 하나** 이므로,
난이도와 "그 난이도의 판 목록에서 몇 번째인지" 두 값이면 특정된다.
난이도 오름차순으로 판을 이어 붙인 순서가 곧 레벨 번호다.

## `level: number,`

> 원본 L116

 1-based 레벨 번호. 퍼즐 안에서 통용된다

## `fieldOrdinal: number,`

> 원본 L119

 그 난이도의 판 목록에서의 순번 (0-based)

## `export type PuzzleCatalogView = {`

> 원본 L123

#endregion

## `export type PuzzleCatalogView = {`

> 원본 L125

#region View models (표현 계층에 넘기는 스냅샷)

## `isAvailable: boolean,`

> 원본 L131

 레지스트리에 핸들이 등록되어 지금 플레이할 수 있는지

## `levelCount: number,`

> 원본 L133

 이 퍼즐의 총 레벨 수. 미등록이면 0

## `clearedLevel: number,`

> 원본 L135

 마지막으로 클리어한 레벨. 없으면 0

## `export type PuzzleDetailView = {`

> 원본 L139

 상세 화면(퍼즐 하나가 화면을 꽉 채운 상태)이 그리는 값

## `levelCount: number,`

> 원본 L144

 이 퍼즐의 총 레벨 수

## `clearedLevel: number,`

> 원본 L146

 마지막으로 클리어한 레벨. 없으면 0

## `continueLevel: number,`

> 원본 L148

 Continue 가 시작할 레벨

## `canContinue: boolean,`

> 원본 L150

 Continue 를 누를 수 있는지 (클리어 기록이 있어야 한다)

## `isCompleted: boolean,`

> 원본 L152

 마지막 레벨까지 전부 깼는지

## `level: number,`

> 원본 L159

 지금 플레이 중인 레벨 번호 (1-based)

## `levelCount: number,`

> 원본 L161

 이 퍼즐의 총 레벨 수

## `levelLabel: string,`

> 원본 L163

 좌측 상단에 그대로 찍는 레벨 표시 - "LV 3 / 24"

## `clockLabel: string,`

> 원본 L166

 "1:05" 형태 - formatClockLabel() 결과. 결과 화면의 통계에 쓴다

## `secondsLabel: string,`

> 원본 L168

 "45" 형태 - 상단 중앙 카운트다운은 초 단위로만 표시한다

## `isTimeCritical: boolean,`

> 원본 L170

 남은 시간이 10초 미만인지 - 빨간 점멸과 초읽기 소리의 조건

## `export const HUD_TIME_CRITICAL_SECONDS = 10;`

> 원본 L175

#endregion

## `export const HUD_TIME_CRITICAL_SECONDS = 10;`

> 원본 L177

#region Helpers

## `export const HUD_TIME_CRITICAL_SECONDS = 10;`

> 원본 L179

남은 시간이 이 값 **미만**이면 초읽기다 - 상단 중앙의 숫자가 빨갛게 점멸하고 소리가 난다
(worker/NextJob.md 1번).

## `export const HUD_CRITICAL_BLINK_SECONDS = 0.5;`

> 원본 L185

 초읽기 점멸 주기 (초). 켜짐/꺼짐이 이 간격으로 번갈아 나온다

## `export function formatSecondsLabel(totalSeconds: number): string {`

> 원본 L188

초를 그대로 초 라벨로 만든다 (예: 125 → "125", 9.3 → "10").

상단 중앙 카운트다운은 **분:초가 아니라 초 단위**다. 남은 시간이 한 자리로 떨어지는
마지막 10초를 크게 읽히게 하려는 것이므로 자릿수를 맞추지 않는다.

올림을 쓰는 이유는 `formatClockLabel` 과 같다 - 0.2초 남았는데 "0" 이 뜨면
아직 만질 수 있는 시간이 이미 끝난 것처럼 보인다.

