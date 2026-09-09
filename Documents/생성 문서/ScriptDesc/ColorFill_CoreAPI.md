# ColorFill_CoreAPI.ts — 주석 아카이브

> 원본 스크립트: `ColorFill_CoreAPI.ts`
> 걷어낸 주석 30건 / 3,927 B 절감 (19,439 B → 15,512 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Color Fill Core API - PUZ_04 색 채우기 퍼즐을 실제 월드에서 구동하는 Horizon Component

`Switch_CoreAPI` 와 같은 구조지만 **이 퍼즐만 격자가 아니다.** 18칸짜리 원형 다이얼이라
별도 표현 결정이 필요했다 (`작업기록_2026-09-02_보드_CustomUI_전환.md` §6.3 표의 마지막 줄).

#### 다이얼을 격자 위에 어떻게 얹었나

새 UI 를 만드는 대신 **5행 × 6열 격자의 테두리**를 다이얼로 쓴다.
5×6 격자의 테두리 칸 수는 정확히 `2 × (5 + 6) - 4 = 18` 로 §3 의 칸 수와 일치한다.

      0  1  2  3  4  5
     17  ·  ·  ·  ·  6
     16  ·  ·  ·  ·  7
     15  ·  ·  ·  ·  8
     14 13 12 11 10  9

0번 칸을 좌상단에 두고 시계방향으로 감는다. 안쪽 칸은 그리지 않으므로 눌리지도 않는다.
덕분에 `PuzzleBoardUI_Panel` 을 한 줄도 고치지 않고 원형 회전을 표현한다.

#### 조작

이 퍼즐은 배치가 아니라 타이밍이라 조작이 하나뿐이다 - **어느 칸을 눌러도 터치 한 번**
(§6 방향 반전 + 바늘이 오염 칸 위면 정화). 그래서 `onCellTap` 에서 칸 번호를 버리고
`session.touch()` 만 부른다.

#### 붙이는 법

`Documents/생성 문서/가이드/에디터_퍼즐_셋업.md` 와 동일하다.

#### 텍스처

판 위 요소에 그림을 입힐 수 있다. 에디터에서 텍스처 애셋을 아래 prop 에 끼우면 그 요소가
그림으로 그려지고, **비워 두면 예전처럼 색으로 그려진다.** 구조는
`PuzzleBoardUI_TextureLibrary.ts` 머리말에 있다.

## `export const COLOR_FILL_READY = new EventPublisher<ColorFillCoreAPI>();`

> 원본 L58

 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - SWITCH_READY 와 같은 규약

## `const DIAL_ROW_COUNT = 5;`

> 원본 L61

 다이얼을 얹는 격자. 테두리 칸 수가 18 이 되도록 5 × 6 으로 잡는다

## `const COLOR_CONTAMINATED: PuzzleBoardColor = boardColor(0.85, 0.2, 0.22);`

> 원본 L65

 §3 - 오염 영역은 붉은색

## `const COLOR_CLEAN: PuzzleBoardColor = boardColor(0.2, 0.75, 0.7);`

> 원본 L67

 §5 - 정화된 영역

## `const COLOR_INACTIVE: PuzzleBoardColor = boardColor(0.16, 0.17, 0.22);`

> 원본 L69

 §4 - 비활성 칸. 정화 대상이 아니다

## `const NEEDLE_LABEL_CLOCKWISE = '>';`

> 원본 L74

 바늘 라벨 - 지금 회전 방향을 함께 알린다 (§6)

## `const TEXTURE_CLEAN: PuzzleTextureKey = textureKey('colorFill', 'clean');`

> 원본 L78

이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.

 정화된 슬롯

## `const TEXTURE_CONTAMINATED: PuzzleTextureKey = textureKey('colorFill', 'contaminated');`

> 원본 L84

 오염된 슬롯

## `const TEXTURE_INACTIVE: PuzzleTextureKey = textureKey('colorFill', 'inactive');`

> 원본 L86

 다이얼에 속하지 않는 안쪽 칸

## `const TEXTURE_NEEDLE: PuzzleTextureKey = textureKey('colorFill', 'needle');`

> 원본 L88

 바늘이 올라가 있는 슬롯

## `const TEXTURE_BOARD: PuzzleTextureKey = textureKey('colorFill', 'board');`

> 원본 L90

 격자 뒤에 까는 판 그림

## `difficulty: { type: PropTypes.Number, default: 1 },`

> 원본 L95

 시작할 난이도 (1~5)

## `autoStart: { type: PropTypes.Boolean, default: false },`

> 원본 L97

 컴포넌트 시작과 동시에 퀘스트를 시작할지

## `seed: { type: PropTypes.Number, default: 0 },`

> 원본 L99

 레벨 생성 시드. 0 이면 매번 다른 레벨

## `focusCamera: { type: PropTypes.Boolean, default: false },`

> 원본 L101

 퀘스트 중 카메라를 고정할지 (기본 끔). 보드가 Custom UI 라 입력에는 필요 없다

## `boardCentre: { type: PropTypes.Entity },`

> 원본 L103

 `focusCamera` 가 켜졌을 때 카메라가 바라볼 대상 (보통 보드 UI gizmo)

## `cameraObject: { type: PropTypes.Entity },`

> 원본 L105

 카메라를 놓을 엔티티. 비우면 `boardCentre` 정면에 자동 배치한다

## `cameraDistance: { type: PropTypes.Number, default: 0.6 },`

> 원본 L107

 보드에서 카메라까지 거리 (m)

## `cameraFov: { type: PropTypes.Number, default: 40 },`

> 원본 L109

 카메라 시야각

## `cleanTexture: { type: PropTypes.Asset },`

> 원본 L112

--- 텍스처 (전부 선택) - 비워 두면 그 요소는 색으로 그려진다 ---
 정화된 슬롯

## `contaminatedTexture: { type: PropTypes.Asset },`

> 원본 L115

 오염된 슬롯

## `inactiveTexture: { type: PropTypes.Asset },`

> 원본 L117

 다이얼에 속하지 않는 안쪽 칸

## `needleTexture: { type: PropTypes.Asset },`

> 원본 L119

 바늘이 올라가 있는 슬롯

## `boardTexture: { type: PropTypes.Asset },`

> 원본 L121

 격자 뒤에 까는 판 그림

## `private readonly _slotToCell: number[] = buildRingCellMap();`

> 원본 L133

 다이얼 칸 index -> 격자 칸 번호. 생성 시 한 번만 만든다

## `private _needleSlot: number = -1;`

> 원본 L136

 지금 바늘이 올라가 있는 칸. 넘어갈 때 이전 칸의 강조를 걷는다

## `public start(): void {`

> 원본 L141

#region Lifecycle

## `connectPuzzleUpdate(this, (deltaSeconds) => this.session.update(deltaSeconds));`

> 원본 L182

이 퍼즐에서 특히 중요하다 - 바늘이 도는 것 자체가 update() 다.
빠뜨리면 바늘이 멈춘 채 제한 시간만 흐른다.

## `private registerTextures(): void {`

> 원본 L209

에디터 prop 의 텍스처 애셋을 키에 붙인다.

**프레젠터를 만들기 전에** 부른다. 순서가 뒤집혀도 패널이 세대를 올려 다시 그리지만,
먼저 등록해 두면 첫 프레임부터 그림이 붙는다.

