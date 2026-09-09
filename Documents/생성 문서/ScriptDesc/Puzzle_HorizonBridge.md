# Puzzle_HorizonBridge.ts — 주석 아카이브

> 원본 스크립트: `Puzzle_HorizonBridge.ts`
> 걷어낸 주석 51건 / 12,109 B 절감 (33,842 B → 21,733 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Puzzle Horizon Bridge - 8개 퍼즐 공통 Horizon 어댑터 (PUZ_00 §7.1 "로직과 표현의 분리")

순수 로직 계층(`*_Session` / `*_Board`)은 `horizon/core` 를 전혀 모른다.
그 둘을 잇는 유일한 지점이 이 파일이며, 하는 일은 좌표 변환 두 가지뿐이다.

  화면 터치 ray  →  연속 격자 좌표 (row, col)   … 드래그 퍼즐이 요구하는 소수 좌표
  격자 좌표      →  월드 좌표                   … 3D 에셋 배치용

#### 왜 콜라이더 레이캐스트가 아니라 평면 교차인가

PUZ_00 §8.4 는 "포인터가 퍼즐 영역 밖으로 나가도 드래그 입력은 유지된다" 를 요구한다.
타일 콜라이더에 레이캐스트하면 보드 밖을 가리키는 순간 히트가 사라져 이 규칙을 지킬 수 없다.
보드 평면과의 교차는 보드 밖이든 칸 사이든 **항상** 좌표를 돌려주므로 그대로 만족한다.
경계 고정·히트박스 판정은 각 퍼즐의 드래그 컨트롤러가 이미 담당하므로 여기서 하지 않는다.

#### 좌표 규약

  right = +col 방향,  up = -row 방향 (row 0 이 화면 위)
  보드 중심 엔티티의 forward 가 평면의 법선이다.

## `export type PuzzleBoardLayout = {`

> 원본 L30

#region Types

## `cellSpacing: number,`

> 원본 L35

 칸 중심 간 거리 (미터). 기획서의 cm 값을 100 으로 나눠 넣는다 (예: 7cm -> 0.07)

## `export type PuzzleGridPoint = {`

> 원본 L39

 연속 격자 좌표. 정수가 아니라 소수다 - 드래그 컨트롤러가 이 형태를 요구한다

## `export class PuzzleBoardMapper {`

> 원본 L45

#endregion

## `export class PuzzleBoardMapper {`

> 원본 L47

#region Board mapper

## `public refreshFrom(boardCentre: Entity): void {`

> 원본 L65

보드 중심 엔티티에서 평면 기저를 읽어 캐시한다.

HorizonProperty 읽기는 매번 브리지를 건너므로 터치마다 호출하면 안 된다.
보드는 플레이 중 움직이지 않으므로 레벨 로드 시 한 번만 부르면 된다.
(패널을 집어 옮길 수 있게 만들었다면 놓는 시점에 다시 부른다.)

## `public getWorldPosition(row: number, col: number): Vec3 {`

> 원본 L79

 격자 좌표 -> 월드 좌표. row/col 에 소수를 넣으면 칸 사이도 나온다 (드래그 연출용)

## `public getGridPosition(worldPoint: Vec3): PuzzleGridPoint {`

> 원본 L88

 월드 좌표 -> 연속 격자 좌표. getWorldPosition 의 정확한 역변환이다

## `public intersectPlane(rayOrigin: Vec3, rayDirection: Vec3): Vec3 | undefined {`

> 원본 L99

터치 ray 와 보드 평면의 교차점. 보드 밖을 가리켜도 좌표가 나온다 (§8.4).
ray 가 평면과 평행하거나 뒤쪽을 향하면 undefined.

## `public getGridFromRay(rayOrigin: Vec3, rayDirection: Vec3): PuzzleGridPoint | undefined {`

> 원본 L115

 터치 ray -> 연속 격자 좌표. 퍼즐 세션에 그대로 넘기면 되는 형태다

## `public toCellIndex(point: PuzzleGridPoint): number | undefined {`

> 원본 L124

 반올림한 칸 번호. 탭 퍼즐(스위치/슬라이드/카드)이 쓴다

## `if (isNaN(point.row) || isNaN(point.col)) {`

> 원본 L126

라우터는 평면 뒤에서 손을 떼면 onEnd 에 {NaN, NaN} 을 넘긴다 (§8.4 규약).
NaN 은 아래의 모든 부등호 비교를 통과해 NaN 셀 번호가 로직 계층으로 흘러들므로 먼저 거른다.

## `public isInsideBoard(point: PuzzleGridPoint): boolean {`

> 원본 L139

 격자 좌표가 보드 안인지 (반올림 기준)

## `export type PuzzleTouchHandlers = {`

> 원본 L145

#endregion

## `export type PuzzleTouchHandlers = {`

> 원본 L147

#region Touch router

## `onBegin: (point: PuzzleGridPoint) => void,`

> 원본 L150

 손가락이 닿았다

## `onMove: (point: PuzzleGridPoint) => void,`

> 원본 L152

 손가락이 움직였다 - 보드 밖 좌표도 그대로 전달된다 (§8.4)

## `onEnd: (point: PuzzleGridPoint) => void,`

> 원본 L154

 손가락을 뗐다

## `export class PuzzleTouchRouter {`

> 원본 L158

화면 터치를 격자 좌표로 바꿔 퍼즐 세션에 전달한다.

**단일 터치 전용** (PUZ_00 §8.1) - 진행 중인 터치의 interactionIndex 만 따라가고
다른 손가락의 입력은 완전히 무시한다. 로직 계층에도 같은 방어가 들어 있지만,
애초에 두 번째 손가락이 첫 손가락의 드래그 좌표를 덮어쓰지 않도록 여기서 먼저 막는다.

## `private _activeInteractionIndex: number | undefined = undefined;`

> 원본 L170

 지금 추적 중인 손가락. undefined 면 놀고 있다

## `public setEnabled(isEnabled: boolean): void {`

> 원본 L185

 일시정지·라운드 전환 중에는 꺼 둔다

## `private handleTouchStart(info: InteractionInfo): void {`

> 원본 L202

#region Internal

## `this._activeInteractionIndex = undefined;`

> 원본 L210

같은 인덱스의 새 다운 = 이전 터치의 end 를 받지 못했다는 뜻이다
(Basics_Input_Screen 이 interactionInfo[0] 만 중계하므로 두 손가락을
 같은 프레임에 떼면 추적 중 손가락의 end 가 유실될 수 있다).
여기서 회복하지 않으면 라우터가 영구히 잠기므로, 붙잡힌 조작을
취소(NaN = 좌표 없는 드랍)로 마감하고 새 터치를 받아들인다.

## `return;`

> 원본 L219

단일 터치 전용 - 조작 중 추가 터치는 완전히 무시한다 (§8.1)

## `this._handlers.onEnd({ row: Number.NaN, col: Number.NaN });`

> 원본 L250

평면 뒤쪽에서 손을 뗀 경우. 좌표를 만들 수 없으므로 보드 밖 드랍으로 넘긴다.

## `}`

> 원본 L261

#endregion

## `const SCREEN_POSITION_Y_IS_TOP_DOWN = false;`

> 원본 L264

#endregion

## `const SCREEN_POSITION_Y_IS_TOP_DOWN = false;`

> 원본 L266

#region Screen drag stream (제안 1 - 연속 좌표 드래그)

## `const SCREEN_POSITION_Y_IS_TOP_DOWN = false;`

> 원본 L268

`InteractionInfo.screenPosition` 의 세로축 방향.

문서에는 0~1 정규화라는 것만 있고 방향이 없어 기기 실험으로 확정했다
(2026-09-04, 드래그 스트림 프로브): **아래가 0 이다.** 변환
(`screenPointToGridPoint`)은 위가 0 을 가정하므로 여기서 `1 - y` 로 뒤집는다.
플랫폼이 방향을 바꾸면(터치가 상하 반전으로 나타나면) 이 값만 되돌린다.

## `onStreamStart?: (point: PuzzleGridPoint) => void,`

> 원본 L279

손가락이 **실제로 닿은** 연속 좌표 - 잡기의 기준점 (드래그당 최대 몇 번, 첫 move 전에만).

잡기는 칸 `Pressable` 이 알리므로 CoreAPI 가 아는 출발점은 **칸 중심(정수)** 뿐이다.
그 뒤의 move 는 연속 좌표라, 칸 가장자리를 잡았다면 손가락이 거의 안 움직였는데도
첫 move 의 delta 가 반 칸을 넘어 조각이 한 칸 튄다. 브라우저 샘플(`pointerdown` 의
`clientX` 를 기준점으로 삼는다)에는 없는 어긋남이다. 이 콜백으로 기준점을 실제
터치 지점으로 되돌려 잡으면 조각은 잡은 자리 그대로 손가락에 붙어 따라온다.

## `onStreamMove: (point: PuzzleGridPoint) => void,`

> 원본 L289

 스트림이 이 드래그를 넘겨받은 뒤의 이동 - 연속 전체 그리드 좌표 (정수 = 칸 중심)

## `onStreamEnd: (point: PuzzleGridPoint) => void,`

> 원본 L291

 스트림이 넘겨받은 드래그의 뗌 - 마지막 좌표와 함께 확정한다

## `onStreamRelease?: () => void,`

> 원본 L293

**이 터치가 끝났다** - 아직 열려 있는 누름이 있으면 닫으라는 신호다.

`onStreamEnd` 와 달리 **스트림이 이동을 배달했는지와 무관하게** 매번 온다.
Focused Interaction 의 `inputEnded` 는 유실되지 않는 반면, Custom UI `Pressable` 의
release 는 모바일에서 사라지는 경우가 있기 때문이다. 특히 **퍼즐이 막 시작해
Focused Interaction 모드에 들어간 직후의 첫 터치**가 그렇다 - 모드가 자리를 잡는
동안 스트림의 moved 는 오지 않아(`isDriving` 이 false) 스트림이 뗌을 확정하지 않는데,
같은 터치의 Pressable release 까지 삼켜지면 **아무도 드래그를 닫지 않는다.**
그것이 "게임 시작 후 첫 드래그만 손을 떼도 놓이지 않고, 다음 터치에서야 놓인다" 였다.

구현은 프레젠터의 `pointerUp()` 을 부르면 된다 - 이미 닫혔으면 아무 일도 하지 않는다.

## `export type PuzzleDragStreamOptions = {`

> 원본 L309

 `PuzzleScreenDragStream` 의 선택 설정

## `drivesMoves?: boolean,`

> 원본 L311

이동까지 스트림이 몰지 (기본 켬).

꺼도 스트림 자체는 살아 있어 **뗌(`onStreamRelease`)만은 계속 알린다.** 그것이
이 옵션을 둔 이유다 - `continuousDrag` 를 끈 퍼즐(또는 에디터에 예전 값이 저장된
엔티티)에서도 릴리즈 유실의 안전망은 남아야 한다. 꺼져 있으면 `isDriving` 은 끝까지
false 이므로 이동·뗌의 확정은 전부 칸 단위 경로가 맡는다.

## `export class PuzzleScreenDragStream {`

> 원본 L322

Focused Interaction 입력 스트림을 **연속 격자 좌표** 드래그로 바꾼다
(드래그 반응속도 개선 제안 §3 제안 1).

#### 하이브리드 입력 - 잡기는 Pressable, 이동·뗌은 스트림

잡기는 지금처럼 칸 `Pressable` 의 down 이 맡는다 (어느 오브젝트인지는 칸이 이미 안다).
CoreAPI 가 잡기에 성공하면 `notifyDragBegan()` 으로 이 라우터를 무장시키고, 그 뒤
`PlayerControls.onFocusedInteractionInputMoved/Ended` 가 오면 화면 좌표를
`screenPointToGridPoint()` 로 바꿔 콜백한다. 칸 경계를 기다리지 않으므로
입력 이벤트 해상도로 연속 추종이 된다.

잡기의 **기준점**도 스트림이 보정한다 (`onStreamStart`). 칸 누름은 어느 칸인지만 알지
칸 안 어디를 짚었는지는 모르므로, `onFocusedInteractionInputStarted` 의 실제 터치
좌표(없으면 첫 moved)를 CoreAPI 에 한 번 전해 "잡은 자리 그대로 따라오기" 를 만든다.

#### 폴백 규칙 - **스트림이 실제로 움직임을 배달한 드래그만 넘겨받는다**

Screen Overlay 가 터치를 소비해 스트림이 오지 않는 환경에서도 조작이 죽으면 안 된다.
그래서 첫 moved 가 변환에 성공한 순간부터만 `isDriving` 이 되고, CoreAPI 는 그때부터
칸 단위 move/up 콜백을 무시한다. 스트림이 한 번도 오지 않으면 `isDriving` 은 끝까지
false 라 기존 칸 단위 경로가 그대로 동작한다 - 두 경로가 같은 컨트롤러 API 를 쓰므로
공존할 수 있다는 제안서의 전제 그대로다.

#### 전제 조건 둘

1. **Focused Interaction 모드** - 스트림 자체가 이 모드에서만 흐른다. CoreAPI 가
   퍼즐 시작에서 `enterPuzzleInteraction()`(카메라 포함) 또는
   `enterPuzzleTouchStream()`(모드만)으로 들어간다.
2. **패널 지오메트리** - 화면 -> 격자 변환은 패널이 `PuzzleBoardStage` 에 실어 둔
   확정 배치를 쓴다. 없으면 변환을 포기하고 폴백만 동작한다.

## `private _isArmed: boolean = false;`

> 원본 L359

 CoreAPI 가 잡기에 성공해 스트림을 기다리는 중인지

## `private _isDriving: boolean = false;`

> 원본 L361

 이번 드래그를 스트림이 넘겨받았는지 - 첫 moved 변환 성공부터 뗌까지

## `private _lastPoint: PuzzleGridPoint | undefined = undefined;`

> 원본 L363

 마지막으로 변환에 성공한 좌표 - ended 의 좌표를 만들 수 없을 때의 대체값

## `private _lastStartInfo: InteractionInfo | undefined = undefined;`

> 원본 L365

가장 최근 started 의 화면 좌표 - 잡기 기준점(`onStreamStart`)의 재료.

started 와 칸 `Pressable` 의 down 은 같은 터치에서 나오지만 **어느 쪽이 먼저인지 보장이
없다.** started 가 먼저면 잡을 때 이 값을 쓰고, 잡기가 먼저면 뒤따라온 started 가
`handleStarted` 에서 직접 준다. **ended 에서 지운다** - 지우지 않으면 앞 터치의 시작점이
다음 잡기의 기준점이 되어(그 터치의 started 가 오지 않거나 늦으면) 조각이 엉뚱하게 튄다.

## `private _didDeliverStart: boolean = false;`

> 원본 L374

 이번 드래그에 `onStreamStart` 를 한 번이라도 전했는지 - 없으면 첫 moved 가 대신한다

## `private readonly _drivesMoves: boolean;`

> 원본 L376

 이동까지 몰지 (`PuzzleDragStreamOptions.drivesMoves`) - 꺼도 뗌은 계속 알린다

## `private _didLogFirstInput: boolean = false;`

> 원본 L378

Focused Interaction 입력을 한 번이라도 받아 봤는지 - **진단 전용**.

이 모드는 클라이언트 상태라 인월드에서만 확인할 수 있고, 진입 호출이 조용히 무시되면
(`enterPuzzleInteraction` 의 카메라 재적용 주석과 같은 사정) 스트림이 통째로 오지
않는다. 그때 증상은 "뗌 안전망이 없는 것처럼 보인다" 뿐이라 원인을 찾기 어려우므로,
처음 한 번만 살아 있다는 것을 로그로 남긴다.

## `public setGridSize(rowCount: number, colCount: number): void {`

> 원본 L408

화면 -> 격자 변환에 쓰는 격자 크기를 바꾼다.
정렬 퍼즐처럼 판마다 열 수가 달라지는 퍼즐이 `resetLayout` 과 함께 부른다 -
패널이 그린 격자와 다른 크기로 변환하면 손가락과 다른 칸이 잡힌다.

## `public notifyDragBegan(): void {`

> 원본 L418

 CoreAPI 의 잡기(onCellDown/onItemDown)가 성공했다 - 이 드래그의 스트림을 받기 시작한다

## `if (this._lastStartInfo !== undefined) {`

> 원본 L424

started 가 잡기보다 먼저 왔다면 지금 기준점을 준다 (필드 주석 - 순서가 보장되지 않는다)

## `public get isDriving(): boolean {`

> 원본 L430

이번 드래그를 스트림이 넘겨받았는지. true 인 동안 CoreAPI 는 칸 단위
move/up 콜백을 무시해야 한다 - 두 경로가 같은 좌표를 두 번 넣지 않게.

## `private handleStarted(info: InteractionInfo | undefined): void {`

> 원본 L438

#region Internal

## `if (this._isArmed && this._isDriving === false) {`

> 원본 L446

잡기가 먼저 와 있었다 - 이번 터치의 진짜 시작점으로 기준점을 다시 준다

## `private logFirstInput(phase: string): void {`

> 원본 L452

스트림이 실제로 흐른다는 것을 **처음 한 번만** 알린다 (`_didLogFirstInput` 주석).
이 줄이 콘솔에 없으면 Focused Interaction 모드에 들어가지 못한 것이므로,
뗌 안전망(`onStreamRelease`)도 동작하지 않는다고 봐야 한다.

