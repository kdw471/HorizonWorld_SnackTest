# ColorSort_CoreAPI.ts — 주석 아카이브

> 원본 스크립트: `ColorSort_CoreAPI.ts`
> 걷어낸 주석 34건 / 5,215 B 절감 (34,420 B → 29,205 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Color Sort Core API - PUZ_03 정렬 퍼즐을 실제 월드에서 구동하는 Horizon Component

`Switch_CoreAPI` 와 같은 구조다. 브리지·보드 UI·소유권 컴포넌트는 그대로 재사용한다
(`Documents/생성 문서/구현 사항/작업기록_2026-09-02_보드_CustomUI_전환.md` §6.3).

#### 케이스 배열을 격자에 얹는 법

이 퍼즐의 모델은 격자가 아니라 **케이스 8개의 스택**이다 (§3). 그래서
**한 열 = 한 케이스**로 얹는다. 열 수는 케이스 수(8), 행 수는 케이스 용량(4)이다.

     col  0  1  2  3  4  5  6  7      <- 케이스 index
     row0 [ 최상단(top) 자리 ]
     row1
     row2
     row3 [ 바닥 자리 ]

스택은 배열 마지막이 최상단이므로 `row = 용량 - 1 - 스택index` 로 뒤집어 그린다.
위로 쌓이는 그림이 되어 그랩/드랍 위치와 눈에 보이는 위치가 일치한다.

#### 조작

드래그 앤 드롭이다 (§6). 칸 번호에서 열만 꺼내면 곧 케이스 index 이므로,
세션의 `beginDrag / hoverDrag / endDrag` 에 그대로 넘긴다.
격자 밖에서 손을 떼면 `endDrag(undefined)` 가 되어 §8 의 영역 밖 드랍(리스폰 대기)이 된다.

#### 붙이는 법

`Documents/생성 문서/가이드/에디터_퍼즐_셋업.md` 와 동일하다.

#### 텍스처

판 위 요소에 그림을 입힐 수 있다. 에디터에서 텍스처 애셋을 아래 prop 에 끼우면 그 요소가
그림으로 그려지고, **비워 두면 예전처럼 색으로 그려진다.** 구조는
`PuzzleBoardUI_TextureLibrary.ts` 머리말에 있다.

## `export const COLOR_SORT_READY = new EventPublisher<ColorSortCoreAPI>();`

> 원본 L68

 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - SWITCH_READY 와 같은 규약

## `const BATTERY_COLORS: { [color: string]: PuzzleBoardColor } = {`

> 원본 L71

 §5 - 건전지 색상 10종. 실제 머티리얼이 들어오면 이 표만 바꾸면 된다

## `const COLOR_UNKNOWN: PuzzleBoardColor = boardColor(0.1, 0.1, 0.12);`

> 원본 L85

 §7 - 아직 공개되지 않은 블랙 건전지. 색을 숨기고 `?` 만 보인다

## `const COLOR_EMPTY_SLOT: PuzzleBoardColor = boardColor(0.17, 0.18, 0.23);`

> 원본 L87

 케이스의 빈 자리. 드랍 대상이므로 반드시 그린다 (보이지 않는 칸은 눌리지 않는다)

## `const COLOR_LOCKED_SLOT: PuzzleBoardColor = boardColor(0.28, 0.2, 0.2);`

> 원본 L89

 §8 - 리스폰 대기로 잠긴 케이스의 빈 자리

## `const UNKNOWN_LABEL = '?';`

> 원본 L94

 §7 - 미공개 건전지의 라벨

## `const TEXTURE_BATTERY: PuzzleTextureKey = textureKey('colorSort', 'battery');`

> 원본 L97

이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.

 배터리

## `const TEXTURE_UNKNOWN: PuzzleTextureKey = textureKey('colorSort', 'unknown');`

> 원본 L103

 아직 색을 모르는 배터리

## `const TEXTURE_EMPTY_SLOT: PuzzleTextureKey = textureKey('colorSort', 'emptySlot');`

> 원본 L105

 빈 칸

## `const TEXTURE_LOCKED_SLOT: PuzzleTextureKey = textureKey('colorSort', 'lockedSlot');`

> 원본 L107

 닫힌 케이스

## `const TEXTURE_BOARD: PuzzleTextureKey = textureKey('colorSort', 'board');`

> 원본 L109

 격자 뒤에 까는 판 그림

## `difficulty: { type: PropTypes.Number, default: 1 },`

> 원본 L114

 시작할 난이도 (1~5)

## `autoStart: { type: PropTypes.Boolean, default: false },`

> 원본 L116

 컴포넌트 시작과 동시에 퀘스트를 시작할지

## `seed: { type: PropTypes.Number, default: 0 },`

> 원본 L118

 레벨 생성 시드. 0 이면 매번 다른 레벨

## `continuousDrag: { type: PropTypes.Boolean, default: true },`

> 원본 L120

드래그를 **연속 좌표 스트림**으로 받을지 (기본 켬) - 개선 제안 §3 제안 1.
규칙과 전제는 `RushHour_CoreAPI.continuousDrag` 주석과 같다. 집어 든 건전지가
케이스 경계를 기다리지 않고 손가락을 따라 케이스를 옮겨 다니고, 뗌 유실이 사라진다.

## `focusCamera: { type: PropTypes.Boolean, default: false },`

> 원본 L126

 퀘스트 중 카메라를 고정할지 (기본 끔). 보드가 Custom UI 라 입력에는 필요 없다

## `boardCentre: { type: PropTypes.Entity },`

> 원본 L128

 `focusCamera` 가 켜졌을 때 카메라가 바라볼 대상 (보통 보드 UI gizmo)

## `cameraObject: { type: PropTypes.Entity },`

> 원본 L130

 카메라를 놓을 엔티티. 비우면 `boardCentre` 정면에 자동 배치한다

## `cameraDistance: { type: PropTypes.Number, default: 0.6 },`

> 원본 L132

 보드에서 카메라까지 거리 (m)

## `cameraFov: { type: PropTypes.Number, default: 40 },`

> 원본 L134

 카메라 시야각

## `batteryTexture: { type: PropTypes.Asset },`

> 원본 L137

--- 텍스처 (전부 선택) - 비워 두면 그 요소는 색으로 그려진다 ---
 배터리

## `unknownTexture: { type: PropTypes.Asset },`

> 원본 L140

 아직 색을 모르는 배터리

## `emptySlotTexture: { type: PropTypes.Asset },`

> 원본 L142

 빈 칸

## `lockedSlotTexture: { type: PropTypes.Asset },`

> 원본 L144

 닫힌 케이스

## `boardTexture: { type: PropTypes.Asset },`

> 원본 L146

 격자 뒤에 까는 판 그림

## `private _dragBatteries: Battery[] = [];`

> 원본 L158

지금 집어 든 건전지들. 보드는 손을 뗄 때까지 이들을 출발 케이스에 그대로 두므로 (§8),
이것을 들고 있지 않으면 드래그하는 동안 화면이 전혀 바뀌지 않는다.

배열 순서는 스택 순서 그대로다 - 0 번이 아래, 마지막이 맨 위.

## `private _dragFromCase: number | undefined = undefined;`

> 원본 L165

 집어 든 케이스. 드래그 중이 아니면 undefined

## `private _hoverCase: number | undefined = undefined;`

> 원본 L167

 손가락이 올라가 있는 케이스. 영역 밖이면 undefined

## `private _isDropValid: boolean = false;`

> 원본 L169

 지금 놓아도 되는 자리인지 - 초록/빨강 테두리를 가른다

## `private _dragStream: PuzzleScreenDragStream | undefined = undefined;`

> 원본 L174

연속 좌표 드래그 스트림 (제안 1) - `continuousDrag` prop 을 켰을 때만 만든다.
스트림이 이 드래그를 넘겨받은 동안(`isDriving`) 칸 단위 move/up 은 무시된다 -
폴백 규칙은 `PuzzleScreenDragStream` 머리말 참고.

## `public start(): void {`

> 원본 L181

#region Lifecycle

## `undefined,`

> 원본 L215

솔버는 힌트(getHintStep)에만 쓰이므로 세션의 기본 인스턴스를 그대로 둔다

## `this._dragStream = new PuzzleScreenDragStream(`

> 원본 L224

제안 1 - 이동·뗌을 Focused Interaction 스트림으로 받는다 (잡기는 칸 누름 그대로).
열 수는 판마다 달라지므로 `resizeGridToActiveCases` 가 스트림에도 알린다.

**스트림은 prop 과 무관하게 언제나 만든다.** `continuousDrag` 가 정하는 것은 이동까지
스트림이 몰지(`drivesMoves`)뿐이고, 뗌 안전망(`onStreamRelease`)은 언제나 필요하다 -
Custom UI 의 release 가 유실되면 그것이 유일하게 남는 "손을 뗐다" 신호이기 때문이다.

