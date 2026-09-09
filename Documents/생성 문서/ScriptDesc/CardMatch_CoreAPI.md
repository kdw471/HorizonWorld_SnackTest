# CardMatch_CoreAPI.ts — 주석 아카이브

> 원본 스크립트: `CardMatch_CoreAPI.ts`
> 걷어낸 주석 31건 / 4,281 B 절감 (20,801 B → 16,520 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Card Match Core API - PUZ_06 카드 맞추기 퍼즐을 실제 월드에서 구동하는 Horizon Component

`Switch_CoreAPI` 와 같은 구조다. 세션 타입과 칸 색 번역만 다르고 브리지·보드 UI·
소유권 컴포넌트는 그대로 재사용한다
(`Documents/생성 문서/구현 사항/작업기록_2026-09-02_보드_CustomUI_전환.md` §6.3).

#### 이 퍼즐의 표현 결정

- 격자 크기가 필드 데이터마다 다르다 (§8 iTileArrayX/Y, 3×3 ~ 5×5). 슬라이드 퍼즐과 같이
  레벨을 불러올 때마다 `resetLayout()` 으로 갈아 끼운다.
- 칸 색은 §6 의 상태 전이를 그대로 따른다.
    뒷면 검정  ->  활성화 파랑  ->  (짝 성공) 녹색 / (짝 실패) 다시 검정
  폭탄이 드러난 칸은 붉은색으로 굳는다 (§3.3 - 재선택 불가).
- 활성화된 칸에는 오브젝트 ID 앞 세 글자를 적는다. 메시가 붙기 전까지 짝을 구분하는 수단이며,
  실제 메시(`meshPath`)가 들어오면 이 라벨 대신 이미지로 바꾸면 된다.
- 폭탄 셔플(§4) 동안에는 입력을 잠근다. 세션도 거절하지만 눌러도 반응이 없어야 하므로
  프레젠터 쪽에서도 함께 막는다.

#### 붙이는 법

`Documents/생성 문서/가이드/에디터_퍼즐_셋업.md` 와 동일하다.

#### 텍스처

판 위 요소에 그림을 입힐 수 있다. 에디터에서 텍스처 애셋을 아래 prop 에 끼우면 그 요소가
그림으로 그려지고, **비워 두면 예전처럼 색으로 그려진다.** 구조는
`PuzzleBoardUI_TextureLibrary.ts` 머리말에 있다.

## `export const CARD_MATCH_READY = new EventPublisher<CardMatchCoreAPI>();`

> 원본 L50

 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - SWITCH_READY 와 같은 규약

## `const COLOR_HIDDEN: PuzzleBoardColor = boardColor(0.14, 0.15, 0.2);`

> 원본 L53

 §6 - 뒷면(기본)

## `const COLOR_REVEALED: PuzzleBoardColor = boardColor(0.2, 0.45, 0.9);`

> 원본 L55

 §6 - 활성화되어 오브젝트가 보이는 중

## `const COLOR_MATCHED: PuzzleBoardColor = boardColor(0.15, 0.75, 0.35);`

> 원본 L57

 §6 - 짝이 맞아 완료

## `const COLOR_BOMB: PuzzleBoardColor = boardColor(0.85, 0.2, 0.2);`

> 원본 L59

 §3.3 - 드러난 폭탄. 재선택 불가

## `const OBJECT_ID_PREFIX = 'OBJ_';`

> 원본 L64

 오브젝트 ID 에서 떼어 내는 접두사 - 'OBJ_GEAR' -> 'GEA'

## `const BOMB_LABEL = '!';`

> 원본 L68

 폭탄 칸의 라벨 - §1 셔플 기믹임을 알린다

## `const TEXTURE_HIDDEN: PuzzleTextureKey = textureKey('cardMatch', 'hidden');`

> 원본 L71

이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.

 뒤집히지 않은 카드 뒷면

## `const TEXTURE_REVEALED: PuzzleTextureKey = textureKey('cardMatch', 'revealed');`

> 원본 L77

 뒤집힌 카드

## `const TEXTURE_MATCHED: PuzzleTextureKey = textureKey('cardMatch', 'matched');`

> 원본 L79

 짝이 맞아 완료된 카드

## `const TEXTURE_BOMB: PuzzleTextureKey = textureKey('cardMatch', 'bomb');`

> 원본 L81

 폭탄 카드

## `const TEXTURE_BOARD: PuzzleTextureKey = textureKey('cardMatch', 'board');`

> 원본 L83

 격자 뒤에 까는 판 그림

## `difficulty: { type: PropTypes.Number, default: 1 },`

> 원본 L88

 시작할 난이도 (1~5)

## `autoStart: { type: PropTypes.Boolean, default: false },`

> 원본 L90

 컴포넌트 시작과 동시에 퀘스트를 시작할지

## `seed: { type: PropTypes.Number, default: 0 },`

> 원본 L92

 레벨 생성 시드. 0 이면 매번 다른 레벨

## `focusCamera: { type: PropTypes.Boolean, default: false },`

> 원본 L94

 퀘스트 중 카메라를 고정할지 (기본 끔). 보드가 Custom UI 라 입력에는 필요 없다

## `boardCentre: { type: PropTypes.Entity },`

> 원본 L96

 `focusCamera` 가 켜졌을 때 카메라가 바라볼 대상 (보통 보드 UI gizmo)

## `cameraObject: { type: PropTypes.Entity },`

> 원본 L98

 카메라를 놓을 엔티티. 비우면 `boardCentre` 정면에 자동 배치한다

## `cameraDistance: { type: PropTypes.Number, default: 0.6 },`

> 원본 L100

 보드에서 카메라까지 거리 (m)

## `cameraFov: { type: PropTypes.Number, default: 40 },`

> 원본 L102

 카메라 시야각

## `hiddenTexture: { type: PropTypes.Asset },`

> 원본 L105

--- 텍스처 (전부 선택) - 비워 두면 그 요소는 색으로 그려진다 ---
 뒤집히지 않은 카드 뒷면

## `revealedTexture: { type: PropTypes.Asset },`

> 원본 L108

 뒤집힌 카드

## `matchedTexture: { type: PropTypes.Asset },`

> 원본 L110

 짝이 맞아 완료된 카드

## `bombTexture: { type: PropTypes.Asset },`

> 원본 L112

 폭탄 카드

## `boardTexture: { type: PropTypes.Asset },`

> 원본 L114

 격자 뒤에 까는 판 그림

## `private _rowCount: number = 0;`

> 원본 L126

 지금 프레젠터에 잡혀 있는 격자 크기

## `private readonly _pairNumberByObjectId: Map<string, number> = new Map<string, number>();`

> 원본 L130

오브젝트 ID -> 짝 번호 (1부터). 레벨 로드 때 배정한다.
오브젝트 ID 머리글자를 그대로 라벨로 쓰면 ID 들이 같은 접두사를 공유할 때
모든 카드가 같은 글자로 보인다 - 짝 번호는 같은 짝의 두 카드만 같은 숫자가 되게 한다.

## `public start(): void {`

> 원본 L139

#region Lifecycle

## `connectPuzzleUpdate(this, (deltaSeconds) => this.session.update(deltaSeconds));`

> 원본 L180

이것을 빠뜨리면 제한 시간도, 짝 실패 후 되돌아가는 연출(§6)도, 폭탄 셔플(§4)도 끝나지 않는다

## `private registerTextures(): void {`

> 원본 L206

 격자 크기는 레벨마다 달라지므로 최소값으로 잡고 `onLevelLoaded()` 에서 갈아 끼운다

에디터 prop 의 텍스처 애셋을 키에 붙인다.

**프레젠터를 만들기 전에** 부른다. 순서가 뒤집혀도 패널이 세대를 올려 다시 그리지만,
먼저 등록해 두면 첫 프레임부터 그림이 붙는다.

