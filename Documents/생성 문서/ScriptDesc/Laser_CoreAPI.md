# Laser_CoreAPI.ts — 주석 아카이브

> 원본 스크립트: `Laser_CoreAPI.ts`
> 걷어낸 주석 86건 / 15,284 B 절감 (61,076 B → 45,792 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Laser Core API - PUZ_01 레이저 해킹 퍼즐을 실제 월드에서 구동하는 Horizon Component

`Switch_CoreAPI` 와 같은 구조다. 브리지·보드 UI·소유권 컴포넌트는 그대로 재사용한다
(`Documents/생성 문서/구현 사항/작업기록_2026-09-02_보드_CustomUI_전환.md` §6.3).

#### 인벤토리를 어디에 그리는가

이 퍼즐만 **필드 밖에 인벤토리**가 있다 (§3 3.2 - 지급된 크리스탈을 필드로 끌어다 놓는다).
인벤토리는 화면 아래 **보조 레이아웃의 오브젝트 트레이**에 놓는다 (worker/NextJob.md 1번).

     ┌ 본 격자 7×7 (정사각형) ┐
     └───────────────────────┘
     ┌ 트레이: 크리스탈 · Reset ┐
     └───────────────────────┘

트레이 슬롯에서 시작한 드래그는 격자 칸의 `onEnter` 로 그대로 이어지므로, 세션이 보는
그림은 예전과 같다 - 집기(`beginDragFromInventory`) → 이동(`updateDrag`) → 놓기(`endDrag`).
예전에는 트레이가 입력을 받지 못해 인벤토리를 본 격자의 9번째 열에 끼워 넣었는데,
그 여분 열이 사라지면서 **본 격자가 기획 그대로 7×7 정사각형**이 됐다.

#### 좌표계가 둘이라는 점에 주의

  전체 그리드 7×7 (0..6)  : 기믹(발사체/수신체/중계체/해골)과 광선 구간
   └ 중앙 5×5 (0..4)      : 크리스탈 배치 영역. 세션의 드래그 API 는 이 로컬 좌표를 받는다

배치 영역 밖(테두리·인벤토리·격자 밖)으로 끌면 로컬 좌표 (-1, -1) 을 넘긴다.
그러면 컨트롤러가 "영역 밖 드랍"으로 판정해 크리스탈을 인벤토리로 돌려보낸다 (§3 3.3).

#### 붙이는 법

`Documents/생성 문서/가이드/에디터_퍼즐_셋업.md` 와 동일하다.

#### 텍스처

판 위 요소에 그림을 입힐 수 있다. 에디터에서 텍스처 애셋을 아래 prop 에 끼우면 그 요소가
그림으로 그려지고, **비워 두면 예전처럼 색으로 그려진다.** 구조는
`PuzzleBoardUI_TextureLibrary.ts` 머리말에 있다.

## `export const LASER_READY = new EventPublisher<LaserCoreAPI>();`

> 원본 L88

 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - SWITCH_READY 와 같은 규약

## `const BOARD_COL_COUNT = LASER_FULL_GRID_SIZE;`

> 원본 L91

 격자 열 수 - 기획의 전체 그리드 그대로다 (인벤토리는 격자 밖 트레이에 있다)

## `const INVENTORY_SLOT_COUNT = 7;`

> 원본 L93

 트레이의 인벤토리 슬롯 수. 기획 난이도 표의 최대 소요 슬롯이 5개라 7이면 넉넉하다

## `const INVENTORY_LABEL = 'Crystals';`

> 원본 L95

 트레이 위에 붙는 이름

## `const OUTSIDE_LOCAL_INDEX = -1;`

> 원본 L98

 배치 영역 밖을 가리키는 로컬 좌표. 여기서 손을 떼면 인벤토리로 돌아간다 (§3 3.3)

## `const LASER_COLORS: { [color: string]: PuzzleBoardColor } = {`

> 원본 L101

 광선 색 - §3 2.1 (색이 곧 레이어라 서로 간섭하지 않는다)

## `const COLOR_BORDER: PuzzleBoardColor = boardColor(0.1, 0.11, 0.15);`

> 원본 L108

 테두리(발사체·수신체 전용 구역, §5.1)

## `const COLOR_PLACEMENT: PuzzleBoardColor = boardColor(0.19, 0.2, 0.26);`

> 원본 L110

 크리스탈을 놓을 수 있는 중앙 5×5 (§5.0)

## `const COLOR_CRYSTAL: PuzzleBoardColor = boardColor(0.75, 0.8, 0.9);`

> 원본 L112

 플레이어가 옮길 수 있는 크리스탈

## `const COLOR_FIXED_CRYSTAL: PuzzleBoardColor = boardColor(0.42, 0.45, 0.5);`

> 원본 L114

 고정 크리스탈 - 유저가 회수할 수 없다 (§4.3)

## `const COLOR_RELAY: PuzzleBoardColor = boardColor(0.85, 0.75, 0.35);`

> 원본 L116

 중계체 - 반드시 경유해야 한다 (§4.2)

## `const COLOR_SKULL: PuzzleBoardColor = boardColor(0.45, 0.1, 0.12);`

> 원본 L118

 해골 - 닿으면 모든 수신체가 Fault (§3 4.2.1)

## `const COLOR_INVENTORY_EMPTY: PuzzleBoardColor = boardColor(0.14, 0.15, 0.19);`

> 원본 L120

 인벤토리의 빈 슬롯

## `const BEAM_TONE_SCALE = 0.55;`

> 원본 L126

 광선이 지나간 빈 칸을 칠할 때의 밝기 - 오브젝트보다 어둡게 해서 경로로 읽히게 한다

## `const OFF_TONE_SCALE = 0.4;`

> 원본 L128

 Off 상태 오브젝트를 어둡게 하는 비율 - PUZ_00 §5

## `const MAX_SEGMENT_STEPS = LASER_FULL_GRID_SIZE * 2;`

> 원본 L131

 광선 한 구간을 따라가는 최대 칸 수 - 무한 루프 방지용 안전핀

## `const TEXTURE_CRYSTAL: PuzzleTextureKey = textureKey('laser', 'crystal');`

> 원본 L134

이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.

 플레이어가 옮길 수 있는 크리스탈

## `const TEXTURE_CRYSTAL_TRIANGLE: PuzzleTextureKey = textureKey('laser', 'crystalTriangle');`

> 원본 L140

 크리스탈 종류별 그림 - 없으면 위의 공통 크리스탈 그림으로 떨어진다 (§4.1)

## `const TEXTURE_EMITTER: PuzzleTextureKey = textureKey('laser', 'emitter');`

> 원본 L146

 발사체 / 수신체 - 예전에는 하나(gimmick)로 묶여 있었다

## `const TEXTURE_FIXED_CRYSTAL: PuzzleTextureKey = textureKey('laser', 'fixedCrystal');`

> 원본 L149

 고정 크리스탈

## `const TEXTURE_RELAY: PuzzleTextureKey = textureKey('laser', 'relay');`

> 원본 L151

 중계체

## `const TEXTURE_SKULL: PuzzleTextureKey = textureKey('laser', 'skull');`

> 원본 L153

 해골

## `const TEXTURE_GIMMICK: PuzzleTextureKey = textureKey('laser', 'gimmick');`

> 원본 L155

 발사체·수신체

## `const TEXTURE_PLACEMENT: PuzzleTextureKey = textureKey('laser', 'placement');`

> 원본 L157

 크리스탈을 놓을 수 있는 중앙 5x5

## `const TEXTURE_BORDER: PuzzleTextureKey = textureKey('laser', 'border');`

> 원본 L159

 테두리(발사체·수신체 전용 구역)

## `const TEXTURE_BOARD: PuzzleTextureKey = textureKey('laser', 'board');`

> 원본 L161

 격자 뒤에 까는 판 그림

## `difficulty: { type: PropTypes.Number, default: 1 },`

> 원본 L166

 시작할 난이도 (1~6)

## `autoStart: { type: PropTypes.Boolean, default: false },`

> 원본 L168

 컴포넌트 시작과 동시에 퀘스트를 시작할지

## `seed: { type: PropTypes.Number, default: 0 },`

> 원본 L170

 레벨 생성 시드. 0 이면 매번 다른 레벨

## `dragLiftCells: { type: PropTypes.Number, default: 0.9 },`

> 원본 L172

드래그 중인 크리스탈을 손가락 **위쪽으로 띄우는 오프셋** - 격자 칸 한 변의 배수다.
손가락이 조각을 가려 무엇을 옮기는지 안 보이는 것을 막는다. 0 이면 띄우지 않는다.
8개 퍼즐 중 레이저만 띄우기를 켜므로 이 값도 여기서만 조정한다.

## `continuousDrag: { type: PropTypes.Boolean, default: true },`

> 원본 L178

드래그를 **연속 좌표 스트림**으로 받을지 (기본 켬) - 개선 제안 §3 제안 1.
규칙과 전제는 `RushHour_CoreAPI.continuousDrag` 주석과 같다 - 스트림 수신은
기기 실험(2026-09-04)으로 확인되었고, 2026-09-05 부터 러시아워와 같은 이유로 기본 켬이다.

## `focusCamera: { type: PropTypes.Boolean, default: false },`

> 원본 L184

 퀘스트 중 카메라를 고정할지 (기본 끔). 보드가 Custom UI 라 입력에는 필요 없다

## `boardCentre: { type: PropTypes.Entity },`

> 원본 L186

 `focusCamera` 가 켜졌을 때 카메라가 바라볼 대상 (보통 보드 UI gizmo)

## `cameraObject: { type: PropTypes.Entity },`

> 원본 L188

 카메라를 놓을 엔티티. 비우면 `boardCentre` 정면에 자동 배치한다

## `cameraDistance: { type: PropTypes.Number, default: 0.6 },`

> 원본 L190

 보드에서 카메라까지 거리 (m)

## `cameraFov: { type: PropTypes.Number, default: 40 },`

> 원본 L192

 카메라 시야각

## `crystalTexture: { type: PropTypes.Asset },`

> 원본 L195

--- 텍스처 (전부 선택) - 비워 두면 그 요소는 색으로 그려진다 ---

그림을 끼운 요소는 **글자를 그리지 않는다.** 그림 위에 `L`·`E` 같은 글자가 겹치면
그림이 가려 오히려 알아보기 어렵기 때문이다 (`PuzzleBoardUI_Panel.createLabelVisibility`).
그림은 오브젝트 색으로 물들므로(틴트) **회색조 한 장이면 색깔별·상태별 오브젝트가
전부 나온다** - 빨강/파랑 수신체, 꺼져서 어두운 수신체가 같은 그림 한 장이다.

**방향이 있는 두 그림(삼각형·T자)은 기준 방향으로 그려 넣어야 한다.** 판에서는
크리스탈의 방향만큼 그림이 시계 방향으로 돌아가는데, 그 회전의 0도가 아래 모양이다.
  삼각형 - 직각 코너가 **좌하단** (글자 `L` 과 같은 모양)
  T자    - 막힌 변이 **위쪽**   (글자 `T` 와 같은 모양)
 플레이어가 옮길 수 있는 크리스탈 - 아래 종류별 그림이 없을 때의 기본

## `crystalTriangleTexture: { type: PropTypes.Asset },`

> 원본 L208

직각 삼각형 거울 (`resources/textures/laser/LaserProp_CrystalTriangle.png`).
**직각 코너가 좌하단**인 모양으로 그린다 - 나머지 세 방향은 이 그림을 돌려서 쓴다.

## `crystalOctagonTexture: { type: PropTypes.Asset },`

> 원본 L213

 팔각 (`LaserProp_CrystalOctagon.png`)

## `crystalCrossTexture: { type: PropTypes.Asset },`

> 원본 L215

 십자 (`LaserProp_CrystalCross.png`)

## `crystalTeeTexture: { type: PropTypes.Asset },`

> 원본 L217

T자 (`LaserProp_CrystalTee.png`).
**막힌 변이 위쪽**인 모양으로 그린다 - 나머지 세 방향은 이 그림을 돌려서 쓴다.

## `crystalFlowerTexture: { type: PropTypes.Asset },`

> 원본 L222

 꽃 - 시트에 그림이 없으므로 비워 두면 색으로 그려진다

## `emitterTexture: { type: PropTypes.Asset },`

> 원본 L224

 발사체 (`LaserProp_Emitter.png`)

## `receiverTexture: { type: PropTypes.Asset },`

> 원본 L226

 수신체 (`LaserProp_Receiver.png`)

## `fixedCrystalTexture: { type: PropTypes.Asset },`

> 원본 L228

 고정 크리스탈

## `relayTexture: { type: PropTypes.Asset },`

> 원본 L230

 중계체

## `skullTexture: { type: PropTypes.Asset },`

> 원본 L232

 해골

## `gimmickTexture: { type: PropTypes.Asset },`

> 원본 L234

 발사체·수신체

## `placementTexture: { type: PropTypes.Asset },`

> 원본 L236

 크리스탈을 놓을 수 있는 중앙 5x5

## `borderTexture: { type: PropTypes.Asset },`

> 원본 L238

 테두리(발사체·수신체 전용 구역)

## `boardTexture: { type: PropTypes.Asset },`

> 원본 L240

 격자 뒤에 까는 판 그림

## `logInventory: { type: PropTypes.Boolean, default: false },`

> 원본 L243

인벤토리 -> 트레이 기록을 콘솔에 남긴다 (디버그) - "크리스탈이 트레이에 없다" 전용.

이쪽은 **보내는 쪽**의 진단이다. 세션이 크리스탈을 몇 개 들고 있고, 그중 몇 개를
슬롯에 적었으며, 프레젠터가 그 기록을 받았는지가 한 줄로 나온다.
받는 쪽(트레이가 실제로 그렸는지)은 BoardPanel 의 `showTrayDebug` 가 본다 -
**둘을 같이 켜면 어디서 끊겼는지가 곧바로 갈린다.**

  보내는 쪽 0개  -> 세션에 크리스탈이 없다 (레벨 데이터/생성기 문제)
  보내는 쪽 N개인데 받는 쪽 `vis=0` -> 기록이 프레젠터에서 막혔다 (슬롯 수 초과 등)
  양쪽 다 N개인데 화면에 없다 -> 그리기 문제다 (접힘·크기·색)

## `private _dragCrystalId: string | undefined = undefined;`

> 원본 L266

지금 끌고 있는 크리스탈. 없으면 undefined.

보드는 **손을 뗄 때까지 바뀌지 않는다** (§3 3.3 - 놓아야 배치가 확정된다). 그래서
이것을 들고 있지 않으면 드래그하는 동안 화면에 아무 변화가 없어, 크리스탈을 집었는지도
알 수 없었다. 여기 담아 두고 손가락이 올라간 칸에 크리스탈을 미리 그린다.

## `private _dragSlot: number | undefined = undefined;`

> 원본 L274

 트레이에서 집었으면 그 슬롯 번호. 필드에서 집었으면 undefined

## `private _dragSourceRow: number | undefined = undefined;`

> 원본 L276

 필드에서 집었으면 원래 있던 칸(배치 로컬). 트레이에서 집었으면 undefined

## `private _dragRow: number | undefined = undefined;`

> 원본 L279

 손가락이 올라가 있는 칸(배치 로컬). 배치 영역 밖이면 undefined

## `private _isDropValid: boolean = false;`

> 원본 L282

 지금 놓아도 되는 자리인지 - 초록/빨강 테두리를 가른다

## `private _repaintFilter: Set<number> | undefined = undefined;`

> 원본 L285

이번 리페인트에서 실제로 기록할 칸 (전체 그리드 번호). undefined 면 전부 기록한다.

방법론 §4.2(더티 플래그) - 드래그 미리보기가 한 칸 옮겨질 때 값이 바뀔 수 있는 칸은
이전 미리보기 자리와 새 미리보기 자리뿐이다 (보드·광선은 손을 뗄 때까지 그대로다).
페인터(`applyBoardVisuals`)는 그대로 두고 기록만 걸러내므로 레이어 순서가 갈라지지 않는다.

## `private readonly _dirtyCells: Set<number> = new Set<number>();`

> 원본 L293

 재사용 버퍼 - 전환마다 Set 을 새로 만들지 않는다 (방법론 §4.4 할당 제로)

## `private _isReleaseCoalescing: boolean = false;`

> 원본 L296

릴리즈 코얼레싱 (개선 제안 §3 제안 2) - `endDrag()` 가 같은 이벤트 턴 안에서 띄우는
BEAM_UPDATED 의 리페인트를 건너뛰고 `onDragEnd` 마지막의 **1회**로 합친다.
세션이 `lastTrace` 를 이미 갱신해 두므로 그 1회가 같은 광선을 그린다.
(릴리즈의 더티 필터(제안 3)는 레이저에 적용하지 않는다 - 광선 재계산은 어느 칸이든
바꿀 수 있어 영향 범위를 미리 알 수 없다.)

## `private _dragStream: PuzzleScreenDragStream | undefined = undefined;`

> 원본 L305

연속 좌표 드래그 스트림 (제안 1) - `continuousDrag` prop 을 켰을 때만 만든다.
잡기(칸 누름·트레이 슬롯)는 그대로 두고, 스트림이 이동을 배달하기 시작하면
(`isDriving`) 칸 단위 move/up 은 무시된다 - `PuzzleScreenDragStream` 머리말 참고.

## `public start(): void {`

> 원본 L314

#region Lifecycle

## `undefined,`

> 원본 L348

추적기와 솔버는 세션의 기본 인스턴스를 그대로 쓴다 (솔버는 힌트 전용)

## `this._dragStream = new PuzzleScreenDragStream(`

> 원본 L358

제안 1 - 이동·뗌을 Focused Interaction 스트림으로 받는다 (잡기는 누름 그대로).

**스트림은 prop 과 무관하게 언제나 만든다.** `continuousDrag` 가 정하는 것은 이동까지
스트림이 몰지(`drivesMoves`)뿐이고, 뗌 안전망(`onStreamRelease`)은 언제나 필요하기
때문이다 - Custom UI 의 release 가 유실되면 그것이 유일하게 남는 "손을 뗐다" 신호다.
(에디터 엔티티에 예전 기본값 false 가 저장돼 있어도 안전망은 살아 있어야 한다.)

## `private setCell(row: number, col: number, patch: {`

> 원본 L1136

 전체 그리드 좌표로 칸 하나를 칠한다

## `texture?: PuzzleTextureKey,`

> 원본 L1139

 생략하면 바탕에서 칠해 둔 그림이 그대로 남는다 (광선 구간이 그 경우다)

## `tint?: PuzzleBoardColor,`

> 원본 L1141

그림에 입힐 색. **생략하면 물들이지 않는다** - 앞 프레임에서 물든 칸이
그대로 남지 않도록 무늬(`glyph`)와 같은 규칙으로 매번 지운다.

## `isInteractive?: boolean,`

> 원본 L1148

 생략하면 바탕에서 정한 값이 그대로 남는다 (광선 구간이 그 경우다)

## `if (this._repaintFilter !== undefined`

> 원본 L1157

더티 필터가 걸려 있으면 그 칸만 기록한다 (applyDragTransitionVisuals 주석)

## `glyph: patch.glyph ?? EBoardCellGlyph.NONE,`

> 원본 L1172

지정하지 않은 칸은 무늬를 지운다 - 앞 프레임의 크리스탈 무늬가 남지 않게

## `}`

> 원본 L1177

#endregion

## `function toRow(cell: number): number {`

> 원본 L1180

#region Cell <-> coordinate helpers

## `function toLocalRow(cell: number): number {`

> 원본 L1190

칸 번호 -> 배치 로컬 행.
격자 밖이면 배치 영역 밖(-1)을 돌려준다 - 거기에 놓으면 인벤토리로 회수된다 (§3 3.3).

## `function isBoardCell(cell: number): boolean {`

> 원본 L1208

 전체 그리드 7×7 안의 칸인지 (격자 밖은 아니다)

## `function getLaserColor(color: ELaserColor): PuzzleBoardColor {`

> 원본 L1213

#endregion

## `function getLaserColor(color: ELaserColor): PuzzleBoardColor {`

> 원본 L1215

#region Colour / label helpers

## `function pickTexture(preferred: PuzzleTextureKey, fallback: PuzzleTextureKey): PuzzleTextureKey {`

> 원본 L1225

기믹 색 - PUZ_00 §5 의 On/Off/Fault 를 밝기와 색으로 나타낸다.
발사체·수신체는 자기 색을 쓰고, 색이 없는 기믹은 고유색을 쓴다.


기믹의 그림.

발사체·수신체·중계체·해골이 각자 그림을 갖는다. 끼우지 않은 것은 공통 그림
(`gimmickTexture`)으로, 그것도 없으면 색으로 떨어진다. 켜짐/꺼짐은 여전히 색이 알린다.


크리스탈 종류에 맞는 그림.

종류별 그림을 끼우지 않았으면 공통 크리스탈 그림으로 떨어지고, 그것마저 없으면 색으로
그려진다. 방향(무늬 테두리·글자 회전)은 그림과 별개로 계속 얹히므로, 같은 T자라도
어느 변이 막혔는지는 그대로 읽힌다 (`EBoardCellGlyph`).


원하는 그림이 등록돼 있으면 그것을, 없으면 대체 그림을 쓴다.

그림 키는 **등록 여부와 무관하게 만들어지므로**, 여기서 라이브러리를 확인하지 않으면
"에셋을 끼우지 않은 키" 가 그대로 칸에 실려 색으로만 그려진다. 문서가 약속한
"종류별 그림이 없으면 공통 그림으로 떨어진다" 는 이 확인이 있어야 성립한다.
(레이저는 텍스처 등록이 `constructSystems()` 에서 한 번 끝난 뒤에만 칠하므로
등록 시점 문제는 없다.)

## `function getFixedCrystalTexture(crystal: LaserCrystal): PuzzleTextureKey {`

> 원본 L1266

 고정 크리스탈 - 전용 그림이 없으면 종류별 그림으로 떨어진다 (§4.3)

## `return base;`

> 원본 L1300

발사체는 언제나 쏘고 있으므로 항상 밝다

## `if (state === EObjectState.FAULT) {`

> 원본 L1303

수신체 - Fault 는 해골에 닿았다는 뜻이라 해골색으로 덮는다 (§3 4.2.1)

## `return '!';`

> 원본 L1321

팔각 크리스탈이 `X` 를 가져갔으므로 해골은 경고 부호를 쓴다

## `function getCrystalLabel(crystal: LaserCrystal): string {`

> 원본 L1327

크리스탈 라벨 - 종류를 한 글자로 나타낸다 (§4.1).

**방향은 라벨이 아니라 무늬(`getCrystalGlyph`)가 알린다.**
그래서 글자는 그 무늬가 돌려 그리는 **기준 모양**으로 고른다.
  `L` 직각 삼각형 - 두 획이 곧 광선을 되돌리는 두 평면이다
  `T` T자       - 크로스바 쪽이 막힌 변이다
  `X` 팔각       - 대각 4방향 분배
  `+` 십자       - 직각 4방향 분배
  `O` 꽃         - 모든 방향 흡수 (닫힌 고리)

예전에는 삼각형을 빗금 두 종류로만 그렸는데, 거울 기울기가 같고 직각 코너만 다른
두 크리스탈(예: 좌하단/우상단)이 화면에서 똑같았다. 지금은 무늬가 그것을 가른다.

## `function getCrystalGlyph(crystal: LaserCrystal): EBoardCellGlyph {`

> 원본 L1357

크리스탈 무늬 - **방향을 화면에 드러내는 부분**이다 (§4.1).

보드 패널은 이 값을 받아 **광선을 되돌리는 변에 두꺼운 테두리를 그리고**
칸의 글자를 그만큼 돌려 그린다 (`PuzzleBoardUI_Definitions` 의 `EBoardCellGlyph` 주석).
이것이 "어떤 게 아래만 반사되고 어떤 게 위만 반사되는지" 를 가르는 유일한 표시다.

## `return EBoardCellGlyph.NONE;`

> 원본 L1381

팔각·십자·꽃은 입사 방향과 무관하게 동작하므로 방향 무늬가 없다

## `Component.register(LaserCoreAPI);`

> 원본 L1385

#endregion

