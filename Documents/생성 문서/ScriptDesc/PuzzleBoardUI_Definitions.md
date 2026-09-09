# PuzzleBoardUI_Definitions.ts — 주석 아카이브

> 원본 스크립트: `PuzzleBoardUI_Definitions.ts`
> 걷어낸 주석 22건 / 5,044 B 절감 (29,813 B → 24,769 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Puzzle Board UI Definitions - CustomUI 로 그리는 퍼즐 보드의 어휘

8개 퍼즐의 보드는 전부 2D 격자다. 그래서 키 캡·타일 같은 **3D 오브젝트를 두지 않고
Custom UI 패널에 격자를 직접 그린다** (`Documents/생성 문서/설계/2026-09-02_멀티플레이_플랫폼에서_싱글플레이_구현_방안.md` §3.2 B안).

이 파일은 그 격자의 **표현 스냅샷 타입**만 정의한다. `horizon/core` 와 `horizon/ui` 에
런타임 의존이 없어 Node 테스트로 검증된다 (PUZ_00 §7.1).

#### 왜 Color 가 아니라 {r,g,b} 인가

`horizon/core` 의 `Color` 를 여기서 쓰면 순수 계층이 깨진다. 색은 0~1 실수 셋으로만
들고 다니고, 실제 `Color` 변환은 표현 계층(`PuzzleBoardUI_Panel`)에서 한 번만 한다.

#### 화면 구성 (worker/NextJob.md 1번)

  화면 위쪽  본 격자 - **정사각형 비율** 고정
  화면 아래쪽 보조 레이아웃 - 셋을 담는다
             (1) 오브젝트 트레이(`items`)  퍼즐을 푸는 데 쓰는 오브젝트 (레이저의 크리스탈 등)
             (2) 정보 미니 격자(`side`)    푸는 데 필요한 정보 (스위치의 동시 눌림 영역 등)
             (3) 리셋 버튼                 판을 풀기 전 상태로 되돌린다 (남은 시간은 유지)

레벨 시작 직후에는 보조 레이아웃 자리에 `GameStart`(`PuzzleBoardIntroView`)가 잠깐 떴다가
사라지고, **사라진 뒤에** 보조 레이아웃이 나타난다.

#### 텍스처는 "키" 로만 들고 다닌다

칸·슬롯·판 배경에 그림을 입힐 수 있다(`texture`). 다만 여기 들어가는 값은
**논리적인 이름**(`'switch.pressed'` 같은 문자열)이지 `TextureAsset` 이 아니다.
실제 에셋은 각 퍼즐의 `*_CoreAPI` 가 에디터 prop 으로 받아
`PuzzleBoardUI_TextureLibrary` 에 등록하고, 그림으로 바꾸는 일은 표현 계층
(`PuzzleBoardUI_Panel`)이 한 번만 한다.

색을 `{r,g,b}` 로 들고 다니는 것과 같은 이유다 - 순수 계층이 `horizon/*` 를 건드리는
순간 Node 테스트가 돌지 않는다. 텍스처를 지정하지 않았거나(`''`) 에셋이 아직 등록되지
않은 키는 예전처럼 `fill` 색만 칠한다. **그래서 텍스처는 언제나 선택 사항이다.**

#### 격자 최대 크기

Custom UI 트리는 `initializeUI()` 에서 **한 번만** 만들어지므로, 패널은 여기 정의된
최대 크기만큼 셀을 미리 만들어 두고 실제 격자 밖의 셀은 `display: none` 으로 숨긴다.
8개 퍼즐 중 가장 큰 판이 러시아워의 9×9(`RUSH_HOUR_FULL_GRID_SIZE`)라 9 로 잡는다.

## 파일 머리말

> 원본 L45

#region Sizes

## 파일 머리말

> 원본 L47

 패널이 미리 만들어 두는 격자 행 수 상한 - 러시아워 9×9 가 가장 크다

## `export const PUZZLE_BOARD_MAX_COLS = 9;`

> 원본 L49

 패널이 미리 만들어 두는 격자 열 수 상한

## `export const PUZZLE_BOARD_SIDE_MAX_ROWS = 3;`

> 원본 L53

 보조 격자(스위치의 3×3 영역 미니 UI 등) 상한 - PUZ_08 §9.5

## `export const PUZZLE_BOARD_MAX_ITEMS = 8;`

> 원본 L58

보조 레이아웃의 오브젝트 슬롯 상한.
8개 중 트레이를 가장 많이 쓰는 레이저의 인벤토리가 최대 5칸이라 8이면 넉넉하다 (PUZ_01 §3.2).

## `export const PUZZLE_BOARD_CELL_OUTSIDE = -1;`

> 원본 L64

 보드 밖을 가리키는 셀 번호. 드래그가 판을 벗어났을 때 이 값이 온다 (PUZ_00 §8.4)

## `export const PUZZLE_BOARD_INTRO_TEXT = 'GameStart';`

> 원본 L67

 레벨 시작 배너 문구. 화면에 그대로 나가므로 영어다

## `export const PUZZLE_BOARD_RESET_LABEL = 'Reset';`

> 원본 L70

 리셋 버튼 라벨

## `export const PUZZLE_BOARD_MENU_LABEL = 'Menu';`

> 원본 L73

일시정지 버튼 라벨.

허브의 상단 바에도 같은 기능의 `Pause` 가 있지만, 인게임에서는 보드 패널이 그 위를
덮어 손이 닿지 않는다 (`PuzzleBoardUI_Panel.createMenuButton()`). 그래서 보드 쪽에도
하나 두고, 그것을 눌러도 뜨는 화면이 시스템 메뉴라는 뜻으로 `Menu` 라 부른다.

## `export type PuzzleBoardColor = {`

> 원본 L82

#endregion

## `export type PuzzleBoardColor = {`

> 원본 L84

#region Color

## `export type PuzzleBoardColor = {`

> 원본 L86

 0~1 범위의 RGB. `horizon/core` 의 Color 로는 표현 계층에서만 바꾼다

## `export const BOARD_COLOR_EMPTY = boardColor(0.12, 0.13, 0.18);`

> 원본 L97

 칸이 비어 있을 때(오브젝트가 없는 좌표)의 바탕색

## `export const BOARD_COLOR_BACKGROUND = boardColor(0.08, 0.09, 0.13);`

> 원본 L99

 격자 배경

## `export const BOARD_COLOR_HIGHLIGHT = boardColor(0.95, 0.8, 0.25);`

> 원본 L102

 선택·드래그 중인 칸의 테두리

## `export const BOARD_COLOR_NO_TINT = boardColor(1, 1, 1);`

> 원본 L105

텍스처를 물들이지 않는 값 - 흰색이다.

그림은 `multiply` 로 물드므로 흰색을 곱하면 원본 그대로다. 그래서 이 값이 곧
"틴트 없음" 이고, 틴트를 쓰지 않는 퍼즐은 예전과 똑같이 그려진다 (`PuzzleBoardCellView.tint`).

## `export type PuzzleTextureKey = string;`

> 원본 L113

#endregion

## `export type PuzzleTextureKey = string;`

> 원본 L115

#region Texture

## `export type PuzzleTextureKey = string;`

> 원본 L117

칸·슬롯에 입힐 그림의 **논리적인 이름**.

퍼즐마다 자기 요소의 키를 정한다 (`'laser.crystal'`, `'switch.pressed'` ...).
충돌을 피하려고 `퍼즐.요소` 꼴로 적되, 규칙을 강제하지는 않는다 -
등록되지 않은 키는 조용히 무시되므로 잘못 적어도 색으로 그려질 뿐 깨지지 않는다.

## `export const NO_TEXTURE: PuzzleTextureKey = '';`

> 원본 L126

 텍스처 없음. `fill` 색만 칠한다

## `export function textureKey(puzzleId: string, element: string): PuzzleTextureKey {`

> 원본 L129

텍스처 키를 만든다. 빈 조각이 섞이면 `NO_TEXTURE` 를 돌려준다 -
에디터에서 에셋을 비워 둔 요소를 실수로 등록하지 않기 위해서다.

