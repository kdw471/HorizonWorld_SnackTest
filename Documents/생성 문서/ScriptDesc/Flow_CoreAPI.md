# Flow_CoreAPI.ts — 주석 아카이브

> 원본 스크립트: `Flow_CoreAPI.ts`
> 걷어낸 주석 31건 / 5,126 B 절감 (28,405 B → 23,279 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Flow Core API - PUZ_05 연결 퍼즐을 실제 월드에서 구동하는 Horizon Component

`Switch_CoreAPI` 와 같은 구조다. 브리지·보드 UI·소유권 컴포넌트는 그대로 재사용한다
(`Documents/생성 문서/구현 사항/작업기록_2026-09-02_보드_CustomUI_전환.md` §6.3).

#### 이 퍼즐의 표현 결정

- 필드가 그대로 7×7 격자라 (§3) 좌표 변환이 없다. 칸 번호 = `row * 7 + col`.
- **타일이 없는 칸과 오브젝트가 없는 칸은 그리지 않는다.** 보이지 않는 칸은 눌리지 않으므로,
  경로가 지나갈 수 없는 자리를 잘못 잡는 일이 원천적으로 사라진다
  (`Flow_Board.canExtend()` 도 두 경우를 모두 NO_TILE 로 거절한다).
- 메인 오브젝트(전구, §4)는 자기 색으로 칠하고 테두리를 준다. 서브 오브젝트는 색을 받기 전에는
  회색이고, 경로가 지나가면 그 색으로 바뀐다 - §5 "연결되면 색을 부여받는다" 그대로다.
- 지금 그리고 있는 경로의 머리에 테두리를 얹어 어디까지 왔는지 보이게 한다.

#### 조작

드래그다 (§6). 칸 번호를 행/열로 풀어 `beginDraw / moveDraw / endDraw` 에 넘긴다.
격자 밖으로 나간 동안에는 `moveDraw` 를 부르지 않는다. 그리던 경로는 그대로 유지되고,
다시 격자로 들어오면 이어서 그려진다 (PUZ_00 §8.4 - 영역을 벗어나도 드래그는 유지).

#### 붙이는 법

`Documents/생성 문서/가이드/에디터_퍼즐_셋업.md` 와 동일하다.

#### 텍스처

판 위 요소에 그림을 입힐 수 있다. 에디터에서 텍스처 애셋을 아래 prop 에 끼우면 그 요소가
그림으로 그려지고, **비워 두면 예전처럼 색으로 그려진다.** 구조는
`PuzzleBoardUI_TextureLibrary.ts` 머리말에 있다.

## `export const FLOW_READY = new EventPublisher<FlowCoreAPI>();`

> 원본 L65

 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - SWITCH_READY 와 같은 규약

## `const FLOW_COLORS: { [color: string]: PuzzleBoardColor } = {`

> 원본 L68

 전구 색상 8종. 실제 머티리얼이 들어오면 이 표만 바꾸면 된다

## `const COLOR_UNLIT_SUB: PuzzleBoardColor = boardColor(0.35, 0.36, 0.42);`

> 원본 L80

 §4 - 아직 색을 받지 못한 서브 오브젝트(회색 전구)

## `const SUB_TONE_SCALE = 0.7;`

> 원본 L83

 경로가 지나간 서브 오브젝트를 메인보다 어둡게 만드는 비율 - 출발/도착 지점이 눈에 띄게 한다

## `const COLOR_NODE_LABEL: PuzzleBoardColor = boardColor(0.08, 0.08, 0.1);`

> 원본 L86

 밝은 전구 위에 얹는 글자색 - 노랑·연두 위에서도 읽히도록 어둡게 둔다

## `const TEXTURE_NODE: PuzzleTextureKey = textureKey('flow', 'node');`

> 원본 L89

이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.

 전구(경로의 양 끝)

## `const TEXTURE_NODE_START: PuzzleTextureKey = textureKey('flow', 'nodeStart');`

> 원본 L95

 출발 / 도착 전구를 그림으로도 가른다 - 없으면 위의 공통 전구 그림으로 떨어진다

## `const TEXTURE_PATH: PuzzleTextureKey = textureKey('flow', 'path');`

> 원본 L98

 이어 그린 선이 지나는 칸

## `const TEXTURE_EMPTY: PuzzleTextureKey = textureKey('flow', 'empty');`

> 원본 L100

 아무것도 없는 칸

## `const TEXTURE_BOARD: PuzzleTextureKey = textureKey('flow', 'board');`

> 원본 L102

 격자 뒤에 까는 판 그림

## `difficulty: { type: PropTypes.Number, default: 1 },`

> 원본 L107

 시작할 난이도 (1~5)

## `autoStart: { type: PropTypes.Boolean, default: false },`

> 원본 L109

 컴포넌트 시작과 동시에 퀘스트를 시작할지

## `seed: { type: PropTypes.Number, default: 0 },`

> 원본 L111

 레벨 생성 시드. 0 이면 매번 다른 레벨

## `continuousDrag: { type: PropTypes.Boolean, default: true },`

> 원본 L113

그리기를 **연속 좌표 스트림**으로 받을지 (기본 켬) - 개선 제안 §3 제안 1.
규칙과 전제는 `RushHour_CoreAPI.continuousDrag` 주석과 같다. 빠른 스와이프에서
칸의 `onEnter` 가 건너뛰어져도 스트림이 지나간 칸을 그대로 주므로 선이 손가락을 따라온다.

## `focusCamera: { type: PropTypes.Boolean, default: false },`

> 원본 L119

 퀘스트 중 카메라를 고정할지 (기본 끔). 보드가 Custom UI 라 입력에는 필요 없다

## `boardCentre: { type: PropTypes.Entity },`

> 원본 L121

 `focusCamera` 가 켜졌을 때 카메라가 바라볼 대상 (보통 보드 UI gizmo)

## `cameraObject: { type: PropTypes.Entity },`

> 원본 L123

 카메라를 놓을 엔티티. 비우면 `boardCentre` 정면에 자동 배치한다

## `cameraDistance: { type: PropTypes.Number, default: 0.6 },`

> 원본 L125

 보드에서 카메라까지 거리 (m)

## `cameraFov: { type: PropTypes.Number, default: 40 },`

> 원본 L127

 카메라 시야각

## `nodeTexture: { type: PropTypes.Asset },`

> 원본 L130

--- 텍스처 (전부 선택) - 비워 두면 그 요소는 색으로 그려진다 ---
 전구(경로의 양 끝) - 아래 출발/도착 그림이 없을 때의 기본

## `nodeStartTexture: { type: PropTypes.Asset },`

> 원본 L133

 출발 전구

## `nodeEndTexture: { type: PropTypes.Asset },`

> 원본 L135

 도착 전구

## `pathTexture: { type: PropTypes.Asset },`

> 원본 L137

 이어 그린 선이 지나는 칸

## `emptyTexture: { type: PropTypes.Asset },`

> 원본 L139

 아무것도 없는 칸

## `boardTexture: { type: PropTypes.Asset },`

> 원본 L141

 격자 뒤에 까는 판 그림

## `private _lastDrawnRow: number = 0;`

> 원본 L153

 직전에 세션에 넘긴 칸. 건너뛴 입력을 보간하는 기준이다 (`onDrawMove` 참고)

## `private _dragStream: PuzzleScreenDragStream | undefined = undefined;`

> 원본 L159

연속 좌표 드래그 스트림 (제안 1) - `continuousDrag` prop 을 켰을 때만 만든다.
스트림이 이 드래그를 넘겨받은 동안(`isDriving`) 칸 단위 move/up 은 무시된다 -
폴백 규칙은 `PuzzleScreenDragStream` 머리말 참고.

## `public start(): void {`

> 원본 L166

#region Lifecycle

## `undefined,`

> 원본 L200

솔버는 힌트(getSolutionPaths)에만 쓰이므로 세션의 기본 인스턴스를 그대로 둔다

## `this._dragStream = new PuzzleScreenDragStream(`

> 원본 L209

제안 1 - 이동·뗌을 Focused Interaction 스트림으로 받는다 (잡기는 칸 누름 그대로).

**스트림은 prop 과 무관하게 언제나 만든다.** `continuousDrag` 가 정하는 것은 이동까지
스트림이 몰지(`drivesMoves`)뿐이고, 뗌 안전망(`onStreamRelease`)은 언제나 필요하다 -
Custom UI 의 release 가 유실되면 그것이 유일하게 남는 "손을 뗐다" 신호이기 때문이다.

