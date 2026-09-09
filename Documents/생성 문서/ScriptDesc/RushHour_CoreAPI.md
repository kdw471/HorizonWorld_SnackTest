# RushHour_CoreAPI.ts — 주석 아카이브

> 원본 스크립트: `RushHour_CoreAPI.ts`
> 걷어낸 주석 38건 / 7,432 B 절감 (45,155 B → 37,723 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Rush Hour Core API - PUZ_02 러시아워 퍼즐을 실제 월드에서 구동하는 Horizon Component

`Switch_CoreAPI` 와 같은 구조다. 브리지·보드 UI·소유권 컴포넌트는 그대로 재사용한다
(`Documents/생성 문서/구현 사항/작업기록_2026-09-02_보드_CustomUI_전환.md` §6.3).

#### 왜 9×9 를 통째로 그리는가

실제 플레이 공간은 가운데 7×7 이고 바깥 테두리 한 칸은 도착 포인트(USB 단자) 구역이다.
3D 시절에는 테두리를 보이지 않게 두었지만, **여기서는 테두리도 그린다.**
결합(§9)이 "슬롯 쪽으로 반 칸 이상 더 끌기" 인데, 보이지 않는 칸은 눌리지 않으므로
테두리를 감추면 USB 를 꽂을 방법이 사라지기 때문이다.

  전체 9×9 = 프레젠터 격자 (칸 번호 = fullRow * 9 + fullCol)
   └ 테두리 링 : 어둡게. 도착 포인트만 자기 색으로 표시
   └ 중앙 7×7 : 플레이 공간. 세션에는 로컬 좌표(full - 1)로 넘긴다

#### 드래그 중 미리보기

보드의 실제 좌표는 손을 뗄 때 스냅되면서 바뀐다 (§7). 그 사이에 아무 변화가 없으면
무엇을 끌고 있는지 알 수 없으므로, 드래그 중에는 컨트롤러가 주는 연속 좌표를 반올림해
**그 자리에 미리 그린다.** 컨트롤러가 이미 이동 가능 범위로 잘라 주므로 (§8 경계 고정)
미리보기가 다른 오브젝트와 겹치는 일은 없다.

#### 붙이는 법

`Documents/생성 문서/가이드/에디터_퍼즐_셋업.md` 와 동일하다.

#### 텍스처

판 위 요소에 그림을 입힐 수 있다. 에디터에서 텍스처 애셋을 아래 prop 에 끼우면 그 요소가
그림으로 그려지고, **비워 두면 예전처럼 색으로 그려진다.** 구조는
`PuzzleBoardUI_TextureLibrary.ts` 머리말에 있다.

## `export const RUSH_HOUR_READY = new EventPublisher<RushHourCoreAPI>();`

> 원본 L71

 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - SWITCH_READY 와 같은 규약

## `const COLOR_BORDER: PuzzleBoardColor = boardColor(0.1, 0.11, 0.15);`

> 원본 L74

 테두리 링 - 도착 포인트가 놓이는 구역

## `const COLOR_EMPTY: PuzzleBoardColor = boardColor(0.19, 0.2, 0.26);`

> 원본 L76

 플레이 공간의 빈 칸

## `const COLOR_GOAL_RED: PuzzleBoardColor = boardColor(0.9, 0.25, 0.25);`

> 원본 L79

 목표 오브젝트(USB)와 도착 포인트의 색 - 기획서 §4 "동일 선상의 목표와 같은 색상"

## `const END_POINT_TONE_SCALE = 0.45;`

> 원본 L82

 도착 포인트는 같은 색을 어둡게 해서 오브젝트와 구분한다

## `const OBSTACLE_COLORS: PuzzleBoardColor[] = [`

> 원본 L85

방해 오브젝트의 색 후보.
칸 단위로 그리므로 나란히 붙은 두 오브젝트가 같은 색이면 하나로 보인다.
id 해시로 서로 다른 색을 주어 경계가 눈에 남게 한다.

## `const GOAL_LABEL = 'U';`

> 원본 L100

 목표 오브젝트 칸의 라벨 - 방해물과 한눈에 구분된다

## `const TEXTURE_GOAL_PIECE: PuzzleTextureKey = textureKey('rushHour', 'goalPiece');`

> 원본 L103

이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.

 목표 말(USB)

## `const TEXTURE_BLOCKER_PIECE: PuzzleTextureKey = textureKey('rushHour', 'blockerPiece');`

> 원본 L109

 길을 막는 말

## `const TEXTURE_EMPTY: PuzzleTextureKey = textureKey('rushHour', 'empty');`

> 원본 L111

 빈 칸

## `const TEXTURE_BORDER: PuzzleTextureKey = textureKey('rushHour', 'border');`

> 원본 L113

 테두리 링

## `const TEXTURE_BOARD: PuzzleTextureKey = textureKey('rushHour', 'board');`

> 원본 L115

 격자 뒤에 까는 판 그림

## `difficulty: { type: PropTypes.Number, default: 1 },`

> 원본 L120

 시작할 난이도 (1~5)

## `autoStart: { type: PropTypes.Boolean, default: false },`

> 원본 L122

 컴포넌트 시작과 동시에 퀘스트를 시작할지

## `seed: { type: PropTypes.Number, default: 0 },`

> 원본 L124

 레벨 생성 시드. 0 이면 매번 다른 레벨

## `continuousDrag: { type: PropTypes.Boolean, default: true },`

> 원본 L126

드래그를 **연속 좌표 스트림**으로 받을지 (기본 끔) - 개선 제안 §3 제안 1.

켜면 잡기는 지금처럼 칸 누름으로 하되, 이동·뗌은 Focused Interaction 입력
(`PlayerControls.onFocusedInteractionInput*`)의 화면 좌표를 격자 좌표로 바꿔 받는다.
칸 경계를 기다리지 않아 오브젝트가 손가락을 연속으로 따라오고, 뗌 유실도 사라진다.

Screen Overlay 위 터치가 스트림으로 들어오는 것은 기기 실험(2026-09-04)으로
확인되었다. 스트림이 오지 않는 환경에서도 칸 단위 경로가 폴백으로 그대로
동작하므로 켜 둔다고 조작이 죽지는 않는다.
퍼즐 시작 시 Focused Interaction 모드에 진입한다 (이동/점프 버튼이 숨는다).

기본 **켬** (2026-09-05). 기기 실험이 끝났고 "터치 즉시 붙어서 지연 없이 따라오다
놓은 자리에 스냅" 이 조작 규격이라, 이제는 끄는 쪽이 예외다.

## `focusCamera: { type: PropTypes.Boolean, default: false },`

> 원본 L142

 퀘스트 중 카메라를 고정할지 (기본 끔). 보드가 Custom UI 라 입력에는 필요 없다

## `boardCentre: { type: PropTypes.Entity },`

> 원본 L144

 `focusCamera` 가 켜졌을 때 카메라가 바라볼 대상 (보통 보드 UI gizmo)

## `cameraObject: { type: PropTypes.Entity },`

> 원본 L146

 카메라를 놓을 엔티티. 비우면 `boardCentre` 정면에 자동 배치한다

## `cameraDistance: { type: PropTypes.Number, default: 0.6 },`

> 원본 L148

 보드에서 카메라까지 거리 (m)

## `cameraFov: { type: PropTypes.Number, default: 40 },`

> 원본 L150

 카메라 시야각

## `goalPieceTexture: { type: PropTypes.Asset },`

> 원본 L153

--- 텍스처 (전부 선택) - 비워 두면 그 요소는 색으로 그려진다 ---
 목표 말(USB)

## `blockerPieceTexture: { type: PropTypes.Asset },`

> 원본 L156

 길을 막는 말

## `emptyTexture: { type: PropTypes.Asset },`

> 원본 L158

 빈 칸

## `borderTexture: { type: PropTypes.Asset },`

> 원본 L160

 테두리 링

## `boardTexture: { type: PropTypes.Asset },`

> 원본 L162

 격자 뒤에 까는 판 그림

## `private _previewPieceId: string | undefined = undefined;`

> 원본 L174

 드래그 중인 오브젝트를 미리 그릴 자리. 드래그가 없으면 undefined

## `private _originRow: number = 0;`

> 원본 L178

집어 든 순간 오브젝트가 있던 자리. 여기에 실루엣을 남겨 **어디에서 집어 왔는지**를 보인다.
미리보기가 아직 원래 자리에 있으면 실루엣은 그리지 않는다 - 같은 칸에 겹쳐 봐야 의미가 없다.

## `private _dragAxis: EDragAxis = EDragAxis.UNDECIDED;`

> 원본 L184

 지금 끌고 있는 축. 이 축을 따라 갈 수 있는 빈 칸을 길로 표시한다

## `private _repaintFilter: Set<number> | undefined = undefined;`

> 원본 L187

이번 리페인트에서 실제로 기록할 칸 (전체 그리드 번호). undefined 면 전부 기록한다.

방법론 §4.2(더티 플래그) - 드래그 미리보기가 한 칸 옮겨질 때 값이 바뀔 수 있는 칸은
이전·새 미리보기 자리와 원래 자리(실루엣)뿐이다. 페인터(`applyGridVisuals`)는 그대로
두고 **기록만 걸러내므로**, 레이어 순서가 전체용/증분용 두 벌로 갈라질 위험이 없다.

## `private readonly _dirtyCells: Set<number> = new Set<number>();`

> 원본 L195

 재사용 버퍼 - 전환마다 Set 을 새로 만들지 않는다 (방법론 §4.4 할당 제로)

## `private _isReleaseCoalescing: boolean = false;`

> 원본 L198

릴리즈 코얼레싱 (개선 제안 §3 제안 2) - `endDrag()` 가 같은 이벤트 턴 안에서 띄우는
세션 이벤트(PIECE_MOVED, USB_DOCKED/UNDOCKED)의 리페인트를 건너뛰고,
`onDragEnd` 마지막의 **1회**로 합친다. 예전에는 릴리즈 한 번에 전체 리페인트가
최대 3회 돌아 "놓는 순간이 유독 느린" 체감의 원인이었다.

## `private _didReleaseChangeWholeBoard: boolean = false;`

> 원본 L205

릴리즈 중 결합/분리가 일어났다 - 점유 칸이 2↔3 으로 바뀌어 영향 범위를 미리 알 수 없으므로,
이 릴리즈만은 더티 필터 없이 전체를 그린다 (개선 제안 §3 제안 3의 예외).

## `private _dragStream: PuzzleScreenDragStream | undefined = undefined;`

> 원본 L211

연속 좌표 드래그 스트림 (제안 1) - `continuousDrag` prop 을 켰을 때만 만든다.
잡기는 칸 누름이 맡고, 스트림이 실제로 이동을 배달하기 시작하면(`isDriving`)
칸 단위 move/up 은 무시된다 - 폴백 규칙은 `PuzzleScreenDragStream` 머리말 참고.

## `public start(): void {`

> 원본 L220

#region Lifecycle

## `undefined,`

> 원본 L254

솔버는 힌트(getHintMove)에만 쓰이므로 세션의 기본 인스턴스를 그대로 둔다

## `this._dragStream = new PuzzleScreenDragStream(`

> 원본 L263

제안 1 - 이동·뗌을 Focused Interaction 스트림으로 받는다 (잡기는 칸 누름 그대로).

**스트림은 prop 과 무관하게 언제나 만든다.** `continuousDrag` 가 정하는 것은 이동까지
스트림이 몰지(`drivesMoves`)뿐이고, 뗌 안전망(`onStreamRelease`)은 언제나 필요하다 -
Custom UI 의 release 가 유실되면 그것이 유일하게 남는 "손을 뗐다" 신호이기 때문이다.

