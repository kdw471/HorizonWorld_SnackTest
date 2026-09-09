# SlidePuzzle_CoreAPI.ts — 주석 아카이브

> 원본 스크립트: `SlidePuzzle_CoreAPI.ts`
> 걷어낸 주석 22건 / 3,764 B 절감 (17,752 B → 13,988 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Slide Puzzle Core API - PUZ_07 슬라이드 퍼즐을 실제 월드에서 구동하는 Horizon Component

`Switch_CoreAPI` 와 같은 구조다. 다른 것은 세션 타입과 칸 색 번역뿐이며,
브리지·보드 UI·소유권 컴포넌트는 그대로 재사용한다
(`Documents/생성 문서/구현 사항/작업기록_2026-09-02_보드_CustomUI_전환.md` §6.3).

#### 이 퍼즐의 표현 결정

- 격자 크기가 난이도마다 다르다 (§11 iDivideNum = 3 또는 4). 그래서 레벨을 불러올 때마다
  `resetLayout()` 으로 격자를 갈아 끼운다. 스위치(항상 5×5)와 다른 유일한 지점이다.
- 조각 색은 **완성 위치**에서 뽑는다. 다 맞추면 좌상→우하로 매끄러운 그라데이션이 되므로
  실제 이미지가 없어도 완성 여부가 한눈에 보인다 (§9 원본 이미지 노출의 대용).
- 빈 칸(§4 마지막 조각)은 그리지 않는다. 보이지 않는 칸은 눌리지도 않는다.
- 지금 누를 수 있는 조각(§5)에 테두리 강조를 준다 - Emissive 연출의 대용이다.

#### 붙이는 법

`Documents/생성 문서/가이드/에디터_퍼즐_셋업.md` 와 동일하다. 빈 엔티티에 이 스크립트를
Local 모드로 붙이고, 같은 월드의 `PuzzleBoardUI_Panel` 과 함께
`Puzzle_LocalOwnership` 의 targets 에 넣는다.

#### 텍스처

판 위 요소에 그림을 입힐 수 있다. 에디터에서 텍스처 애셋을 아래 prop 에 끼우면 그 요소가
그림으로 그려지고, **비워 두면 예전처럼 색으로 그려진다.** 구조는
`PuzzleBoardUI_TextureLibrary.ts` 머리말에 있다.

## `export const SLIDE_PUZZLE_READY = new EventPublisher<SlidePuzzleCoreAPI>();`

> 원본 L48

 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - SWITCH_READY 와 같은 규약

## `const TILE_TONE_BASE = 0.25;`

> 원본 L51

 조각 색의 밝기 하한과 폭 - 너무 어두우면 칸 위 숫자가 묻힌다

## `const TEXTURE_PIECE: PuzzleTextureKey = textureKey('slidePuzzle', 'piece');`

> 원본 L57

이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.

 조각

## `const TEXTURE_EMPTY: PuzzleTextureKey = textureKey('slidePuzzle', 'empty');`

> 원본 L63

 빈 칸

## `const TEXTURE_BOARD: PuzzleTextureKey = textureKey('slidePuzzle', 'board');`

> 원본 L65

 격자 뒤에 까는 판 그림

## `difficulty: { type: PropTypes.Number, default: 1 },`

> 원본 L70

 시작할 난이도 (1~5)

## `autoStart: { type: PropTypes.Boolean, default: false },`

> 원본 L72

 컴포넌트 시작과 동시에 퀘스트를 시작할지

## `seed: { type: PropTypes.Number, default: 0 },`

> 원본 L74

 레벨 생성 시드. 0 이면 매번 다른 레벨

## `focusCamera: { type: PropTypes.Boolean, default: false },`

> 원본 L76

 퀘스트 중 카메라를 고정할지 (기본 끔). 보드가 Custom UI 라 입력에는 필요 없다

## `boardCentre: { type: PropTypes.Entity },`

> 원본 L78

 `focusCamera` 가 켜졌을 때 카메라가 바라볼 대상 (보통 보드 UI gizmo)

## `cameraObject: { type: PropTypes.Entity },`

> 원본 L80

 카메라를 놓을 엔티티. 비우면 `boardCentre` 정면에 자동 배치한다

## `cameraDistance: { type: PropTypes.Number, default: 0.6 },`

> 원본 L82

 보드에서 카메라까지 거리 (m)

## `cameraFov: { type: PropTypes.Number, default: 40 },`

> 원본 L84

 카메라 시야각

## `pieceTexture: { type: PropTypes.Asset },`

> 원본 L87

--- 텍스처 (전부 선택) - 비워 두면 그 요소는 색으로 그려진다 ---
 조각

## `emptyTexture: { type: PropTypes.Asset },`

> 원본 L90

 빈 칸

## `boardTexture: { type: PropTypes.Asset },`

> 원본 L92

 격자 뒤에 까는 판 그림

## `private _divideNum: number = 0;`

> 원본 L104

 지금 프레젠터에 잡혀 있는 격자 한 변. 레벨이 바뀌면 갱신한다

## `private _highlightedPositions: number[] = [];`

> 원본 L107

 지금 테두리 강조가 켜져 있는 칸들 - 다음 갱신 때 꺼야 한다

## `public start(): void {`

> 원본 L112

#region Lifecycle

## `connectPuzzleUpdate(this, (deltaSeconds) => this.session.update(deltaSeconds));`

> 원본 L153

이것을 빠뜨리면 제한 시간이 흐르지 않고 0.25초 미끄러짐 연출도 끝나지 않는다 (§6)

## `private registerTextures(): void {`

> 원본 L179

보드 프레젠터를 만든다.

격자 크기는 레벨마다 달라지므로 여기서는 최소값(3×3)으로 잡고
`onLevelLoaded()` 에서 실제 크기로 갈아 끼운다.


에디터 prop 의 텍스처 애셋을 키에 붙인다.

**프레젠터를 만들기 전에** 부른다. 순서가 뒤집혀도 패널이 세대를 올려 다시 그리지만,
먼저 등록해 두면 첫 프레임부터 그림이 붙는다.

