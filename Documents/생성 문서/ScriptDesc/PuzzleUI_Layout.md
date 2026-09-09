# PuzzleUI_Layout.ts — 주석 아카이브

> 원본 스크립트: `PuzzleUI_Layout.ts`
> 걷어낸 주석 108건 / 24,830 B 절감 (40,478 B → 15,648 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Puzzle UI Layout - 기기별 화면 규격을 계산하는 순수 계층

메인 UI(`PuzzleUI_MainPanel`)와 보드 UI(`PuzzleBoardUI_Panel`)가 **같은 자를 쓰게** 한다.
`horizon/core` / `horizon/ui` 에 런타임 의존이 없어 Node 테스트로 검증된다 (PUZ_00 §7.1).

#### 왜 필요한가 (두 가지 신고)

1. **"모바일에서 인터랙션 영역이 화면 밖으로 넘어간다"**
   본 격자는 `height: 100%` + `aspectRatio: 1` 로 정사각형을 잡고 있었다. 이 방식은
   **세로만 보고 가로를 정한다.** 화면이 세로로 길수록(폰은 19.5:9 가 흔하다) 격자 높이가
   커지고, 그만큼 가로도 함께 커져서 결국 패널 폭을 넘어선다. 넘어간 부분은 잘려 보이지
   않는데 `Pressable` 은 그대로 살아 있으므로 "화면 밖에 입력 영역이 있는" 상태가 된다.
   여기서는 **가로와 세로 중 작은 쪽**으로 한 변을 정해(`fitSquareSide`) 그 일이 생기지
   않게 한다.

2. **"모바일에서 버튼 글자가 너무 작다"**
   글자 크기가 `fontSize: 22` 처럼 버튼 크기와 무관하게 박혀 있었다. 버튼은 화면 비율로
   커지는데 글자는 그대로라, 화면이 클수록 글자가 상대적으로 작아 보였다.
   `fitFontSize()` 는 **버튼의 실제 픽셀 높이에서 글자 크기를 거꾸로 구한다.**

3. **"메인 메뉴부터 화면에 꽉 차지 않고 우측에 월드가 보인다"**
   캔버스를 720x1180 세로 판으로 못박아 두었는데, Horizon 모바일은 **가로 화면**이다.
   Screen Overlay 는 캔버스 비율을 지키며 화면에 맞추므로, 세로 캔버스를 가로 화면에
   올리면 좌우가 남고 그 틈으로 월드가 보인다. `resolveCanvas()` 가 **플레이어의 실제
   화면 비율로 캔버스를 다시 잡아** 그 틈을 없앤다.

4. **"캔버스를 넓혔더니 세로 간격이 터무니없이 벌어진다"**
   Custom UI 의 레이아웃은 Yoga(CSS Flexbox) 규칙을 따르는데, **`margin` 과 `padding` 의
   퍼센트는 네 방향 모두 부모의 *가로*를 기준으로 계산된다.** `marginTop: '26%'` 는
   "높이의 26%" 가 아니라 "폭의 26%" 다. 세로 캔버스(720)에서는 우연히 그럴듯했지만
   가로 캔버스(2500 이상)에서는 세로 여백이 세 배 넘게 부풀어 화면을 밀어낸다.

   그래서 **여백은 퍼센트로 주지 않는다.** `verticalPixels()` / `horizontalPixels()` 로
   캔버스에서 픽셀을 뽑아 넣는다. `width` / `height` 의 퍼센트는 각자 축을 따르므로
   그대로 써도 된다 - 함정은 `margin` 과 `padding` 뿐이다.

#### 좌표계

Custom UI 의 `%` 는 **패널 캔버스**를 기준으로 한다. 그래서 두 패널이 같은 캔버스 크기를
쓰지 않으면 같은 `%` 가 다른 픽셀이 되어 HUD 바와 보드 여백이 어긋난다. 캔버스 크기를
여기서 한 번만 정하고 두 패널이 그대로 가져다 쓴다.

## 파일 머리말

> 원본 L45

#region Canvas

## 파일 머리말

> 원본 L47

**기준 세로 길이** (px) - 화면 크기를 읽지 못했을 때의 기본값이자, 픽셀 상수의 기준 자다.

#### 왜 더 이상 "고정 캔버스 세로" 가 아닌가 (실기 신고)

예전에는 캔버스 세로를 이 값으로 못박고 가로만 화면 비율에 맞췄다. 그런데
`player.screenWidth/screenHeight` 는 **렌더러블 화면의 실제 픽셀**이고, Screen Overlay
패널도 실제 해상도로 그려진다. 세로 2556px 폰에서 우리가 1180 기준으로 계산한 픽셀 값
(격자 한 변, 버튼 크기)은 **전부 2.2배 작게** 그려졌다 - "보드를 키웠는데 폰에서는 여전히
작다" 의 정체다. 퍼센트 기반 크기만 멀쩡했던 것이 그 증거다 (`%` 는 해상도와 무관하다).
데스크톱(~1080px)은 우연히 1180 과 비슷해 어긋남이 보이지 않았다.

그래서 지금은 **캔버스 = 실제 화면 해상도**다 (`resolveCanvas()`). 이 값은
  1. 화면 크기를 읽지 못했을 때의 기본 세로
  2. 해상도와 무관해야 하는 픽셀 상수(띄우기 거리 한계 등)를 실제 캔버스로 환산하는 기준
으로만 남는다.

## `export const PUZZLE_UI_CANVAS_WIDTH = 720;`

> 원본 L66

 화면 크기를 읽지 못했을 때 쓰는 기본 가로 길이 (px) - 세로로 긴 폰 기준

## `export const PUZZLE_UI_MIN_CANVAS_HEIGHT = 320;`

> 원본 L69

 캔버스 세로의 허용 범위 (px) - 화면 크기를 터무니없이 읽었을 때의 안전망

## `export const PUZZLE_UI_MIN_ASPECT = 0.4;`

> 원본 L73

캔버스 가로/세로 비의 허용 범위.

화면 크기를 잘못 읽었을 때(0, 음수, 터무니없는 값) 캔버스가 극단으로 늘어나는 것을 막는다.
아래쪽은 아주 좁고 긴 세로 화면, 위쪽은 21:9 울트라와이드까지를 담는다.

## `export const PUZZLE_UI_LANDSCAPE_ASPECT = 1.2;`

> 원본 L82

 가로 화면으로 보는 기준 비율. 이보다 넓으면 레이아웃이 가로 배치로 갈린다

## `export type PuzzleUICanvas = {`

> 원본 L85

두 패널이 공유하는 캔버스.

#### `width`/`height` 는 **정사각형**이다 - Screen Overlay 가 그렇게 그리기 때문이다

실기 실측(2026-09-03)으로 확인했다. Horizon 의 Screen Overlay 는 패널을
**화면의 짧은 변을 한 변으로 하는 정사각형**에 그린다. `panelWidth` 로 준 가로는
무시되고, `panelHeight` 가 그 정사각형의 좌표 해상도를 정한다.

그래서 590x1280 세로 캔버스를 주면 실제 레이아웃 상자는 1280x1280 이 되고, 캔버스
가로(590)를 기준으로 계산한 픽셀은 전부 실제의 46% 로 그려졌다 - 보드가 화면 폭의
41% 밖에 안 되던 원인이다. 측정치 셋이 모두 이 모델과 맞았다 (보드 폭 39.5%, 칸 피치
5.5%, 콘텐츠 세로 끝 46%).

그래서 `width`/`height` 에는 **실제 레이아웃 상자인 정사각형**을 담는다. 정사각형 밖
(세로 화면에서 아래쪽에 남는 부분)까지 포함한 화면 전체는 `fullWidth`/`fullHeight` 다.
절대 배치는 그 바깥까지 닿는다 - 정사각형 밖에 놓은 노드도 화면에 그려진다.

## `width: number,`

> 원본 L104

 레이아웃 상자(정사각형)의 한 변 = 화면의 짧은 변. `height` 와 같은 값이다

## `aspect: number,`

> 원본 L107

 width / height. 정사각형이므로 언제나 1 이다

## `isLandscape: boolean,`

> 원본 L109

*화면**이 가로로 긴지. 캔버스가 아니라 실제 화면 비율에서 정한다

## `fullWidth: number,`

> 원본 L111

 화면 전체를 캔버스 단위로 옮긴 크기 - 정사각형 밖까지 포함한다

## `function makeSquareCanvas(side: number, screenAspect: number): PuzzleUICanvas {`

> 원본 L116

정사각 레이아웃 상자와 그 바깥(화면 전체)을 한 번에 만든다.

`side` 는 화면의 짧은 변이고, `screenAspect` 는 **화면**의 가로/세로다.
세로 화면이면 가로가 짧은 변이므로 `fullWidth` 가 곧 `side` 이고,
가로 화면이면 세로가 짧은 변이라 `fullHeight` 가 `side` 다.

## `export function resolveCanvas(screenWidth: number, screenHeight: number): PuzzleUICanvas {`

> 원본 L134

플레이어의 화면에서 **정사각 레이아웃 상자**를 만든다.

한 변은 **화면의 짧은 변**이다 - Screen Overlay 가 실제로 그 정사각형에 그리기 때문이다
(`PuzzleUICanvas` 주석). 캔버스 단위가 곧 화면의 짧은 변 픽셀이므로, 여기서 계산한
픽셀 값은 화면에 그대로 대응한다.

화면 크기를 읽지 못하면(0 이나 NaN) 기본 판으로 떨어진다. 한 변과 비율에 안전망을
물려 터무니없는 값이 들어와도 캔버스가 극단으로 늘어나지 않게 한다.

## `const side = Math.round(clampNumber(`

> 원본 L150

레이아웃 상자의 한 변은 **화면의 짧은 변**이다 (`PuzzleUICanvas` 주석)

## `export function canvasPixelScale(canvasHeight: number): number {`

> 원본 L158

해상도와 무관해야 하는 픽셀 값을 이 캔버스의 실제 크기로 환산하는 배율.

기준 캔버스(세로 1180px)에서 튜닝한 상수(띄우기 거리 한계, 화살표 폭 한계 등)는
그 자체로는 "1180 세로 기준 픽셀" 이다. 캔버스가 실제 해상도가 되면서, 그런 상수는
이 배율을 곱해야 화면에서 같은 크기로 보인다.

## `export function makeCanvas(width: number, height: number): PuzzleUICanvas | undefined {`

> 원본 L172

크기를 직접 지정해 캔버스를 만든다 (에디터 override).

`player.screenWidth/screenHeight` 가 실제 화면과 다르게 오는 기기가 있을 때의 탈출구다.
두 패널에 같은 값을 넣어야 `%` 가 어긋나지 않는다. 값이 쓸 수 없으면 `undefined`.

## `const side = Math.round(clampNumber(`

> 원본 L182

준 값은 **화면 크기**로 본다. 레이아웃 상자는 거기서 짧은 변을 뽑아 만든다

## `export function getDefaultCanvas(): PuzzleUICanvas {`

> 원본 L189

 화면 크기를 아직 모를 때 쓰는 캔버스 - 예전 세로 판 그대로다

## `export function getCatalogColumns(canvas: PuzzleUICanvas): number {`

> 원본 L196

메인 메뉴의 퍼즐 격자를 몇 열로 놓을지.

세로 화면은 2열 x 4행, 가로 화면은 4열 x 2행이다. 가로 화면에서 2열을 유지하면
버튼이 화면 폭만큼 길쭉해져 **한 화면에 다 들어가지 않는다.**

## `export enum EUIDeviceClass {`

> 원본 L206

#endregion

## `export enum EUIDeviceClass {`

> 원본 L208

#region Device

## `export enum EUIDeviceClass {`

> 원본 L210

화면 규격을 가르는 기기 분류.

**이 월드는 모바일/웹 전용이므로 VR 분류를 두지 않는다.** `PlayerDeviceType.VR` 이 들어오면
아래 `toUIDeviceClass()` 가 데스크톱으로 흘려보낸다 - 조작 자체가 Focused Interaction 기반이라
VR 에서는 성립하지 않으므로 별도 레이아웃을 유지할 이유가 없다.

`horizon/core` 의 `PlayerDeviceType` 을 그대로 쓰지 않는 이유는 이 파일이 순수 계층이라
`horizon/core` 를 import 할 수 없기 때문이다. 표현 계층이 문자열을 넘기면
`toUIDeviceClass()` 가 여기 어휘로 옮긴다.

## `export function toUIDeviceClass(deviceType: string | undefined): EUIDeviceClass {`

> 원본 L226

`PlayerDeviceType` 문자열을 기기 분류로 옮긴다.
모바일이 아닌 모든 값(웹/데스크톱, 그리고 들어올 일이 없는 VR)은 데스크톱으로 본다 -
여백이 가장 적어 레이아웃이 원래 의도대로 나온다.

## `export type PuzzleUISafeArea = {`

> 원본 L238

#endregion

## `export type PuzzleUISafeArea = {`

> 원본 L240

#region Profile

## `export type PuzzleUISafeArea = {`

> 원본 L242

 화면 네 변에서 비워 둘 안전 여백 (캔버스 대비 %)

## `export type PuzzleUILayoutProfile = {`

> 원본 L250

기기 하나의 화면 규격.

`safeArea` 는 **입력 영역이 화면 밖으로 나가지 않게 하는 마지막 방어선**이다. 모바일은
노치·둥근 모서리·홈 인디케이터에 더해 Horizon 자체의 이동/점프 버튼이 화면 아래를
차지하므로 상하 여백을 넉넉히 준다.

## `fontScale: number,`

> 원본 L260

 이 기기에서 글자를 얼마나 키울지 (1 = 그대로)

## `minButtonHeightPercent: number,`

> 원본 L262

 버튼 하나의 최소 높이 (캔버스 대비 %) - 엄지로 누를 수 있는 크기 (PUZ_00 §8)

## `boardWidthUsage: number,`

> 원본 L264

본 격자가 쓸 수 있는 가로 비율 (0~1).
모바일은 "격자가 작아 손가락으로 칸을 못 짚겠다" 는 피드백으로 1.0 까지 쓴다 -
좌우 숨 쉴 틈은 안전 여백이 이미 만든다. 데스크톱은 예전 값 그대로다.

## `boardAreaBonusPercent: number,`

> 원본 L270

보조 레이아웃에서 본 격자로 옮겨 주는 세로 비율 (%).
가로 화면 보정(`fitBoardAreaToCanvas`)과 별개로 **기기 때문에** 더 주는 몫이다.
모바일만 값이 있다 - 칸 하나가 엄지 폭에 가까워지도록 격자를 키운다.

## `minAuxAreaPercent: number,`

> 원본 L276

 위 보너스를 떼어 가도 보조 레이아웃이 유지해야 하는 최소 세로 비율 (%)

## `[EUIDeviceClass.MOBILE]: {`

> 원본 L281

모바일 - 화면이 작고 Horizon 의 이동 버튼이 아래쪽을 가린다.
글자·버튼을 데스크톱보다 눈에 띄게 키운다 - 실기 테스트에서 "버튼이 손가락에 다
가려질 만큼 작다" 는 피드백이 있었다. 엄지 폭(약 9~10mm)이 기준이다.

## `safeArea: { top: 3, bottom: 6, left: 3, right: 3 },`

> 원본 L286

좌우 여백은 3% 로 줄였다 - "보드가 작아 격자를 손가락으로 못 짚겠다" 는 피드백.
세로(노치·홈 인디케이터·Horizon 이동 버튼) 여백은 그대로 둔다.

## `boardAreaBonusPercent: 0,`

> 원본 L292

0 이다 - 상:하 분할(70:30)은 보드 패널의 에디터 prop 셋이 정하는 **설계값**이라
기기 보정이 몰래 흔들면 안 된다. 예전에 6% 를 옮기던 것은 판이 작던 시절의 보정이고,
지금은 그 몫이 prop 기본값에 들어가 있다. 기기별로 더 주고 싶으면 이 값을 올린다.

## `export type PuzzleUISafeAreaPixels = {`

> 원본 L313

 안전 여백을 픽셀로 환산한 값 - 퍼센트 여백의 함정을 피하려면 이쪽을 쓴다 (머리말 §4)

## `export function computeSafeAreaPixels(`

> 원본 L321

안전 여백을 픽셀로 바꾼다.

**위아래는 캔버스 세로에서, 좌우는 캔버스 가로에서** 뽑는다. 퍼센트 여백을 그대로 쓰면
위아래까지 가로 기준으로 계산되어 가로 화면에서 세로 여백이 폭발한다 (머리말 §4).

## `export function verticalPixels(canvas: PuzzleUICanvas, percent: number): number {`

> 원본 L339

 캔버스 세로의 몇 % 를 픽셀로. **세로 여백은 반드시 이것을 거친다** (머리말 §4)

## `export function horizontalPixels(canvas: PuzzleUICanvas, percent: number): number {`

> 원본 L344

 캔버스 가로의 몇 % 를 픽셀로

## `export function getUsableWidthPercent(profile: PuzzleUILayoutProfile): number {`

> 원본 L349

 안전 여백을 뺀 뒤 실제로 쓸 수 있는 가로 비율 (%)

## `export function getUsableHeightPercent(profile: PuzzleUILayoutProfile): number {`

> 원본 L354

 안전 여백을 뺀 뒤 실제로 쓸 수 있는 세로 비율 (%)

## `export function percentOf(total: number, percent: number): number {`

> 원본 L359

#endregion

## `export function percentOf(total: number, percent: number): number {`

> 원본 L361

#region Measurement helpers

## `export function fitSquareSide(availableWidth: number, availableHeight: number): number {`

> 원본 L374

정사각형 한 변 - **가로와 세로 중 작은 쪽**에 맞춘다.

`aspectRatio: 1` 은 한쪽만 보고 나머지를 정하므로 반대쪽을 넘어설 수 있다.
그 결과가 "화면 밖으로 나간 입력 영역" 이었다 (파일 첫머리 §1).

## `export type FontFitOptions = {`

> 원본 L385

 `fitFontSize` 의 조절 값

## `ratio?: number,`

> 원본 L387

 상자 높이의 몇 배를 글자 크기로 삼을지

## `scale?: number,`

> 원본 L391

 기기별 배율 (`PuzzleUILayoutProfile.fontScale`)

## `pixelScale?: number,`

> 원본 L393

캔버스 해상도 배율 (`canvasPixelScale`).

`minimum`/`maximum` 은 기준 캔버스(세로 1180) 픽셀로 튜닝한 값이다. 캔버스가 실제
해상도가 되면서, 이 배율을 곱하지 않으면 고해상도 폰에서 글자가 상한(30px 따위)에
걸려 화면에서는 깨알만 해진다. 상자 높이는 이미 실제 픽셀이라 건드리지 않는다.

## `export function fitFontSize(boxHeight: number, options: FontFitOptions = {}): number {`

> 원본 L407

상자 크기에 맞는 글자 크기 (px).

버튼이 커지면 글자도 함께 커진다 - 모바일에서 "버튼은 큰데 글자만 작다" 를 없애는 규칙이다.
위아래 한계를 두어 아주 작은 상자에서도 읽히고, 아주 큰 상자에서 글자만 우스꽝스럽게
커지지도 않는다.

## `const minimum = (options.minimum ?? DEFAULT_FONT_MINIMUM) * pixelScale;`

> 원본 L417

위아래 한계는 기준 캔버스(1180) 픽셀이므로 실제 캔버스 배율을 곱한다 (FontFitOptions 주석)

## `export type PuzzleBoardAreaSpec = {`

> 원본 L425

#endregion

## `export type PuzzleBoardAreaSpec = {`

> 원본 L427

#region Board geometry

## `export type PuzzleBoardAreaSpec = {`

> 원본 L429

 보드 패널이 캔버스를 세로로 나누는 비율 (%)

## `topInsetPercent: number,`

> 원본 L431

위쪽에 비워 둘 비율.
**보드 크기에는 더 이상 영향을 주지 않는다** - 보드는 `boardSquarePercent` /
`boardMarginPercent` 가 화면의 짧은 변에서 직접 정한다 (`computeBoardSquare`).

## `boardAreaPercent: number,`

> 원본 L437

 본 격자 영역. 위와 같은 이유로 보드 크기에는 쓰이지 않는다

## `auxAreaPercent: number,`

> 원본 L439

 보조 레이아웃이 쓸 세로 - **화면의 짧은 변 대비 %** 다

## `boardSquarePercent?: number,`

> 원본 L441

보드 정사각형 한 변 - **화면의 짧은 변 대비 %**. 생략하면 90.
"보드판이 화면 짧은 변의 90% 인 정사각형" 이라는 요구가 이 값이다.

## `boardMarginPercent?: number,`

> 원본 L446

보드와 **화면 최상단·좌·우** 사이의 여백 - 화면의 짧은 변 대비 %. 생략하면 5.
위·좌·우가 같은 값이라, `boardSquarePercent` 90 + 이 값 5 면 가로가 정확히 꽉 찬다.

## `export type PuzzleBoardSquare = {`

> 원본 L453

 보드 정사각형의 한 변과 화면 가장자리로부터의 거리 (전부 canvas px)

## `side: number,`

> 원본 L455

 정사각형 한 변

## `margin: number,`

> 원본 L457

 화면 최상단·좌·우와의 거리

## `top: number,`

> 원본 L459

 화면 최상단에서 보드 위쪽까지 (= margin)

## `bottom: number,`

> 원본 L461

 화면 최상단에서 보드 아래쪽까지

## `export const BOARD_SQUARE_PERCENT = 90;`

> 원본 L465

 보드 정사각형이 화면 짧은 변에서 차지하는 기본 비율 (%)

## `export const BOARD_MARGIN_PERCENT = 5;`

> 원본 L467

 보드와 화면 최상단·좌·우 사이의 기본 여백 (짧은 변 대비 %)

## `export const BOARD_MIN_AUX_PERCENT = 15;`

> 원본 L470

보드 아래에 **반드시 남겨 두는** 보조 레이아웃 자리 (짧은 변 대비 %).

세로 화면에서는 보드(90%) 아래로 화면이 한참 더 남으므로 이 값이 걸리지 않는다.
걸리는 것은 **가로 화면**이다 - 짧은 변이 세로라, 보드가 그 90% 를 쓰면 아래에 남는
자리가 5% 뿐이라 트레이와 Reset 이 사라진다. 그때만 보드를 이 자리만큼 줄인다.

## `export function computeBoardSquare(canvas: PuzzleUICanvas, area?: PuzzleBoardAreaSpec): PuzzleBoardSquare {`

> 원본 L479

보드 정사각형을 픽셀로 확정한다.

**화면의 짧은 변 하나만 본다.** 세로 비율(70:30 같은 분할)과 무관하게 언제나 같은
크기가 나오도록 한 것이 요구 사항이다. 여백은 위·좌·우가 같으므로, 기본값
(90% + 5%)에서는 `5 + 90 + 5 = 100` 이 되어 **가로가 정확히 꽉 차고 자동으로 중앙**에 온다.

여백을 키워도 정사각형이 상자 밖으로 나가지 않도록 한 변의 비율을 눌러 둔다.

## `const shortSide = canvas.width;`

> 원본 L489

레이아웃 상자가 정사각형이라 width 가 곧 화면의 짧은 변이다

## `export type PuzzleBoardGeometry = {`

> 원본 L499

 계산이 끝난 보드 배치 (전부 px)

## `usableWidth: number,`

> 원본 L501

 캔버스에서 실제로 쓰는 폭 (안전 여백 제외)

## `gridSide: number,`

> 원본 L504

 본 격자 한 변 - 언제나 사용 가능한 폭과 높이 안에 들어간다

## `boardPanelWidth: number,`

> 원본 L506

**보드 메인 패널(직사각형)의 크기.** 격자는 이 안에 정사각 칸으로 들어간다.

예전에는 판을 정사각형 한 변(`gridSide`)으로만 잡았다. 그러면 가로 화면에서
화면 폭의 3분의 1도 쓰지 못하고, 4행 8열(정렬 퍼즐)처럼 가로로 긴 판은 칸이
납작하게 눌렸다. 패널을 직사각형으로 잡고 칸을 정사각형으로 두면 두 문제가 함께 풀린다.

## `boardSquareSide: number,`

> 원본 L515

 보드 정사각형 한 변 (= boardPanelWidth = boardPanelHeight)

## `boardSquareMargin: number,`

> 원본 L517

 보드와 화면 최상단·좌·우 사이의 거리

## `boardTop: number,`

> 원본 L519

 화면 최상단에서 보드 위쪽·아래쪽까지 (canvas px)

## `auxTop: number,`

> 원본 L522

 화면 최상단에서 보조 레이아웃 위쪽까지

## `auxHeight: number,`

> 원본 L524

 보조 레이아웃의 높이

## `boardAreaHeight: number,`

> 원본 L526

 본 격자 영역의 높이 - 보드 패널은 여기서 `boardGap` 을 뺀 만큼이다

## `boardGap: number,`

> 원본 L528

 보드 패널과 보조 레이아웃 사이에 남기는 세로 틈

## `resetButtonWidth: number,`

> 원본 L530

 보조 레이아웃의 리셋 버튼 크기

## `itemSlotSide: number,`

> 원본 L533

오브젝트 트레이 슬롯 한 변.

트레이 상자가 허락하는 만큼 키우되 **화면 아래 절반의 20%**
(`TRAY_SLOT_LOWER_HALF_RATIO`) 밑으로는 내려가지 않는다. 슬롯이 많아 폭이 모자라면
크기를 줄이는 대신 **넘겨 보게** 한다 (`computeTrayPageSize`).

## `trayArrowWidth: number,`

> 원본 L541

 트레이를 넘기는 좌우 화살표 버튼의 폭

## `trayWidth: number,`

> 원본 L543

오브젝트 트레이가 실제로 쓸 수 있는 폭/높이.
한 페이지에 몇 개를 늘어놓을 수 있는지가 여기서 나온다 (`computeTrayPageSize`).

## `export type PuzzleGridPixels = {`

> 원본 L551

 격자를 픽셀로 확정한 결과 - 칸은 언제나 정사각형이다

## `cellSide: number,`

> 원본 L553

 칸 한 변

## `width: number,`

> 원본 L555

 격자 전체의 크기 (= cellSide × 열/행)

## `export const PUZZLE_UI_TRAY_SLOT_COUNT = 8;`

> 원본 L560

트레이에 늘어놓는 슬롯 수의 상한.
`PuzzleBoardUI_Definitions` 의 `PUZZLE_BOARD_MAX_ITEMS` 와 같은 값이다 - 이 파일은
표현 어휘에 의존하지 않아야 하므로 값을 복사하고 여기 적어 둔다.

## `const RESET_WIDTH_USAGE = 0.26;`

> 원본 L567

리셋 버튼이 보조 레이아웃에서 차지하는 비율.
실기에서 "버튼이 손가락에 가려질 만큼 작다" 는 피드백으로 키웠다 - 엄지 폭이 기준이다.

## `const TRAY_HEIGHT_USAGE = 0.86;`

> 원본 L573

 오브젝트 트레이가 보조 레이아웃에서 차지하는 세로 비율 - 슬롯도 같은 이유로 키웠다

## `const TRAY_MARGIN_USAGE = 0.08;`

> 원본 L575

 트레이 좌우와 리셋 버튼 사이에 남기는 여백 비율

## `export const BOARD_PANEL_WIDTH_PERCENT = 90;`

> 원본 L578

보드 메인 패널이 차지하는 **가로 비율** (캔버스 대비 %).

"판이 화면 절반의 상반부를 채우는 직사각형이어야 한다" 는 요구를 이 한 값이 지킨다.
안전 여백 안쪽으로도 들어가야 하므로 실제 폭은 둘 중 작은 쪽이다.

## `const BOARD_GAP_USAGE = 0.03;`

> 원본 L586

보드 패널과 보조 레이아웃 사이의 세로 틈 (본 격자 영역 대비 %).

**영역 밖에 여백으로 두지 않는다.** 예전에는 보조 레이아웃에 `marginTop` 을 붙였는데,
세로 비율 셋(`PuzzleBoardAreaSpec`)의 합에는 그 여백이 들어 있지 않아 합이 100% 일 때
보조 레이아웃이 딱 그만큼 화면 밖으로 밀려났다. 틈을 **본 격자 영역 안쪽**에서 떼면
비율 합이 곧 화면 전체가 되어 그 어긋남이 사라진다.

## `export const TRAY_SLOT_LOWER_HALF_RATIO = 0.2;`

> 원본 L596

트레이 슬롯 한 변의 **아래 한계** - 화면 아래 절반의 20%.

"보조 레이아웃의 반사 부품이 손가락으로 집기에 너무 작다" 는 요구를 옮긴 값이다.
캔버스 세로의 절반(= 화면 아래 절반)에 이 비율을 곱해 쓴다.

**상한이 아니라 하한이다.** 상한으로 쓰면 트레이가 넉넉한 가로 화면에서 부품이 오히려
지금보다 작아진다. 트레이 상자가 허락하는 만큼 키우되 이 크기 밑으로는 내려가지 않는다.

## `const TRAY_MIN_VISIBLE_SLOTS = 3;`

> 원본 L607

페이지를 나눌 때 한 화면에 적어도 보이게 할 슬롯 수.

슬롯을 트레이 높이까지 키우면 좁은 화면에서 한 번에 하나씩만 보이게 되어, 부품 일곱 개를
보려고 여섯 번을 넘겨야 한다. 그 경우에는 슬롯을 조금 줄여 세 개가 보이게 한다 -
다만 위의 아래 한계 밑으로는 줄이지 않는다.

## `const TRAY_ARROW_WIDTH_USAGE = 0.55;`

> 원본 L616

트레이를 넘기는 화살표 버튼의 폭 - 슬롯 대비 비율과 위아래 한계.
위 한계를 두는 이유는 화살표 둘이 부품 한 칸만큼의 폭을 가져가지 않게 하기 위해서다.

## `export function computeBoardGeometry(`

> 원본 L624

보드 패널의 배치를 픽셀로 확정한다.

**세로 비율만으로 격자 크기를 정하지 않는 것**이 핵심이다. 세로로 긴 화면에서는
가로가 먼저 바닥나므로, 둘 중 작은 쪽을 한 변으로 삼아야 격자가 화면을 넘지 않는다.

보드 **패널**은 정사각형이 아니라 **직사각형**이다 (`boardPanelWidth/Height`).
정사각형 한 변(`gridSide`)은 가로 화면에서 세로에 막혀 화면 폭의 3분의 1도 쓰지 못했고,
4행 8열 같은 가로로 긴 판에서는 칸이 납작하게 눌렸다. 패널을 직사각형으로 잡고
그 안에 정사각 칸을 채우면(`computeGridPixels`) 두 문제가 함께 사라진다.
`gridSide` 는 정사각 판의 상한으로 남는다.

## `const shortSide = canvas.width;`

> 원본 L641

레이아웃 상자는 정사각형이고, 그 한 변이 곧 화면의 짧은 변이다 (`PuzzleUICanvas` 주석)

## `const usableHeight = percentOf(canvas.fullHeight, getUsableHeightPercent(profile));`

> 원본 L645

세로는 정사각형 밖까지 쓸 수 있다 - 보조 레이아웃이 보드 아래에 놓이기 때문이다

## `const requestedSquare = computeBoardSquare(canvas, area);`

> 원본 L651

요구대로 짧은 변의 90% 를 잡되, **보조 레이아웃 자리가 없어지면 그만큼 줄인다.**
세로 화면에서는 보드 아래로 화면이 한참 남아 이 눌림이 걸리지 않고, 가로 화면에서만
걸린다 (`BOARD_MIN_AUX_PERCENT` 주석).

## `const auxTop = square.bottom + boardGap;`

> 원본 L665

보조 레이아웃은 **보드 아래에 남은 화면**을 쓴다. `auxAreaPercent` 는 그 중 얼마를
쓸지를 정하고, 남은 자리보다 커지지는 않는다. 보드가 세로 비율과 무관해졌으므로
이 값이 보드 크기를 건드리는 일도 없다.

## `const slotFloor = percentOf(shortSide, 50) * TRAY_SLOT_LOWER_HALF_RATIO;`

> 원본 L676

슬롯은 트레이 상자를 채울 만큼 키우되, 좁은 화면에서 한 번에 하나만 보이지 않도록
최소 세 개가 들어갈 크기로 눌러 준다. 그 눌림이 "짧은 변의 10%" 밑으로는 내려가지
않는다 - 그 아래로 가면 부품이 손가락보다 작아진다.
그래도 폭이 모자라면 크기를 줄이는 대신 넘겨 본다 (`computeTrayPageSize`).

## `gridSide: square.side,`

> 원본 L689

보드는 정사각형이라 격자 한 변이 곧 그 한 변이다

## `trayArrowWidth: Math.round(clampNumber(`

> 원본 L704

화살표 폭의 위아래 한계는 기준 캔버스(1180) 픽셀로 튜닝한 값이라,
실제 캔버스에서는 배율을 곱해야 화면에서 같은 크기로 보인다

## `export function computeGridPixels(`

> 원본 L715

보드 패널 안에 격자를 픽셀로 앉힌다 - **칸은 언제나 정사각형이다.**

예전에는 판을 정사각형 상자로 두고 행과 열을 `flex: 1` 로 나눴다. 그래서 정사각형이 아닌
판(4행 8열, 5행 6열)은 칸이 눌리거나 늘어났고, 연결 퍼즐의 경로와 러시아워의 차량 비율이
실제 판과 달라 보였다. 한 변을 `min(패널폭/열, 패널높이/행)` 로 잡으면 어떤 판이든 칸이
정사각형으로 유지되면서, **가로로 긴 판일수록 칸이 커진다** - 남는 가로를 쓰기 때문이다.

행이나 열이 0 이면 그릴 것이 없다는 뜻이라 0 을 돌려준다.

## `export function computeTrayPageSize(geometry: PuzzleBoardGeometry, itemCount: number): number {`

> 원본 L744

트레이 한 페이지에 늘어놓을 슬롯 수.

슬롯 크기는 "화면 아래 절반의 20%" 로 못박혀 있으므로(`itemSlotSide`), 슬롯이 많으면
**크기를 줄이는 대신 페이지를 나눈다.** 예전에는 슬롯 수로 폭을 나눠 크기를 줄였는데,
레이저의 인벤토리(7칸)에서는 부품이 손가락보다 작아져 집을 수가 없었다.

전부 한 줄에 들어가면 화살표를 그리지 않으므로 그만큼 폭을 더 쓴다.

## `export function computeTrayPageCount(pageSize: number, itemCount: number): number {`

> 원본 L769

 페이지 수 - `computeTrayPageSize` 가 정한 한 페이지 크기로 슬롯을 나눈다

## `export function validateBoardArea(area: PuzzleBoardAreaSpec): string[] {`

> 원본 L777

세로 비율 셋의 합이 100 을 넘지 않는지 검사한다.
넘으면 아래쪽(보조 레이아웃)이 화면 밖으로 밀려난다. 위반 사유는 콘솔로 나가므로 영어다.

