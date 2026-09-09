# PuzzleUI_MainPanel.ts — 주석 아카이브

> 원본 스크립트: `PuzzleUI_MainPanel.ts`
> 걷어낸 주석 44건 / 13,039 B 절감 (48,889 B → 35,850 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Puzzle UI Main Panel - 메인 UI(퍼즐 허브)의 Horizon 표현 계층

순수 로직(PuzzleUI_Model)의 뷰 이벤트를 Binding 에 흘려 넣고,
버튼(Pressable)을 모델의 액션으로 연결하는 것이 전부다. 화면 전이 규칙은
한 줄도 여기 있지 않다 (PUZ_00 §7.1 로직과 표현의 분리).

#### 화면 구성

  메인 메뉴      - 8개 퍼즐 격자 **2열 × 4행** (미등록 퍼즐은 어둡게 + "준비 중")
  퍼즐 상세      - 고른 퍼즐이 화면을 꽉 채우고, 아래 세 버튼을 **세로로** 놓는다
                     Start    1레벨부터
                     Continue 마지막으로 클리어한 레벨의 다음부터 (기록 없으면 잠김)
                     Return   메인 메뉴로
  인게임 HUD     - 상단 바만 표시하고 보드를 가리지 않는다
  시스템 메뉴    - 반투명 오버레이. 뜨는 동안 타이머가 멈춘다
                     Resume         닫고 다시 푼다 (시간이 이어서 흐른다)
                     Restart Level  이 레벨을 처음부터 - 타이머도 초기화
                     Return to Main 메인 메뉴로
  결과           - 승패 + 통계 + 아래 버튼
                     클리어 Restart / Next Level / Return to Main  (세 개)
                     실패   Restart / Return to Main               (두 개)

#### 인게임 상단 바 (worker/NextJob.md 1번)

     ┌──────────────────────────────────────┐
     │  LV 3 / 24          07        [MENU] │
     └──────────────────────────────────────┘
       좌측 = 레벨       중앙 = 남은 초   우측 = 시스템 메뉴

남은 시간은 **초 단위 숫자 하나**다. 10초 미만이 되면 그 숫자가 빨갛게 점멸하고
`countdownSound` 로 지정한 오디오가 1초마다 울린다. 오디오를 지정하지 않으면
점멸만 하고 조용히 지나간다 - 소리는 있으면 좋은 것이지 없으면 안 되는 것이 아니다.

보드 패널(`PuzzleBoardUIPanel`)은 위쪽 `topInsetPercent` 만큼을 비워 두므로 자리로만
보면 이 바와 겹치지 않는다. 둘 다 Screen Overlay 라 세로 비율로 자리를 나눠 갖는다.

**다만 인게임에서는 이 바가 실제로 보이지 않는다.** 보드 패널이 화면 전체를 덮는
불투명 배경과 뗌 마감 레이어를 깔기 때문이다 (`PuzzleBoardUI_Panel.createMenuButton()`
주석 - 그래서 일시정지 버튼이 보드 쪽에도 하나 있다). 그 자리를 판에 돌려주려고
`topInsetPercent` 는 8% 까지 내려가 있다. 이 바를 보드 위로 올리게 되는 날에는
보드 쪽 `topInsetPercent` 를 `HUD_BAR_HEIGHT_PERCENT` + 상단 안전 여백만큼 다시 키워야 한다.

#### 붙이는 법

  1. Custom UI gizmo 를 만들어 이 스크립트를 붙이고 Display Mode 를 **Screen Overlay** 로 둔다.
  2. 실행 모드를 **Local** 로 두고, `Puzzle_LocalOwnership` 의 targets 에 이 엔티티를 추가한다
     (소유권이 안 넘어오면 서버 인스턴스는 빈 화면만 그린다).
  3. 같은 클라이언트에서 도는 각 퍼즐의 `*_CoreAPI` 가 `PuzzleHubRegistry` 에 핸들을
     등록하면 그 퍼즐이 자동으로 "준비 중" 에서 풀린다. CoreAPI 의 `autoStart` 는
     **기본값이 꺼짐**이라, 게임은 언제나 이 메뉴에서 시작한다.
  4. 진행도를 영구 저장하려면 에디터에서 변수 그룹을 하나 만든다
     (`PuzzleUI_PersistentProgress.ts` 머리말 참조). 안 만들어도 게임은 돌고,
     그 경우 진행도는 세션 동안만 유지된다.

모바일 지침 (PUZ_00 §8)
  - 버튼은 화면 폭의 40% 이상, 세로 8% 이상으로 잡아 엄지로 누르기 넉넉하게 한다
  - 인게임에서는 상단 바 외에 아무것도 그리지 않는다 - 보드와 손가락을 가리지 않는다 (§8.5)
  - **화면 규격은 `PuzzleUI_Layout` 이 정한다.** 기기별 안전 여백을 물리고, 글자 크기는
    버튼의 실제 픽셀 높이에서 도출한다 - 버튼이 커지면 글자도 함께 커진다

#### 재입장

이 패널이 만들어질 때 `bootToMainMenu()` 가 돌아 **언제나 메인 메뉴에서 시작한다.**
진행도는 영구 변수에서 다시 읽으므로 그대로 남는다.

## `const COLOR_BACKGROUND = new Color(0.08, 0.09, 0.13);`

> 원본 L110

#region Style constants

## `const COLOR_TIME_CRITICAL = new Color(0.95, 0.25, 0.25);`

> 원본 L121

 초읽기(10초 미만) 카운트다운 숫자

## `const CATALOG_COLUMNS_PORTRAIT = 2;`

> 원본 L124

 메인 메뉴 격자는 2열 × 4행 고정 (카탈로그 8종)

## `const CATALOG_WIDTH_BUDGET_PERCENT = 88;`

> 원본 L126

 격자가 좌우로 쓰는 폭 (%) - 남는 8% 는 버튼 사이 여백이다

## `const CATALOG_GRID_HEIGHT_PERCENT = 82;`

> 원본 L128

 퍼즐 격자가 쓰는 세로 (%) - 제목 줄을 뺀 나머지

## `const DEFAULT_SCREEN_PIXEL_RATIO = 2;`

> 원본 L131

`screenPixelRatio` 의 기본값 - 실기 측정값(1179 / 590 = 2) 이다.
**prop 기본값 및 보드 패널의 같은 상수와 반드시 같은 값이어야 한다.**

## `const HUD_BAR_HEIGHT_PERCENT = 10;`

> 원본 L137

인게임 상단 바의 높이 (%).
MENU 버튼이 이 안에 있으므로 엄지로 누를 수 있는 높이가 나와야 한다 - 7% 였을 때
버튼이 4mm 남짓이라 "손가락에 다 가려진다" 는 피드백이 있었다.

이 바를 보드 위로 올리게 되면 보드 패널의 `topInsetPercent` 가 이 값 + 상단 안전 여백
이상이어야 겹치지 않는다. 지금은 보드가 이 바를 덮으므로 그 자리를 판이 쓰고 있다
(파일 머리말).

## `const PAUSE_BUTTON_LABEL = 'Pause';`

> 원본 L148

일시정지 버튼의 라벨.
예전에는 'MENU' 였는데 "일시정지 버튼이 없다" 로 읽혔다 - 누르면 타이머가 멈추고
Resume / Restart / Return to Main 이 뜨는, 사실상의 일시정지 버튼이므로 그대로 부른다.

## `type CatalogSlot = {`

> 원본 L157

#endregion

## `progressVariableKey: { type: PropTypes.String, default: DEFAULT_PROGRESS_VARIABLE_KEY },`

> 원본 L168

진행도를 담을 플레이어 영구 변수 키 (`그룹이름:변수이름`).

에디터에 그 변수 그룹이 없으면 자동으로 메모리 저장으로 떨어진다 - 게임은 그대로 돌고
진행도가 세션 동안만 유지될 뿐이다. 어느 쪽으로 붙었는지는 시작 시 콘솔에 찍힌다.
비워 두면 영구 저장을 아예 시도하지 않는다.

## `countdownSound: { type: PropTypes.Entity },`

> 원본 L176

남은 시간이 10초 미만일 때 1초마다 울릴 Audio gizmo (선택).

비워 두면 소리 없이 숫자만 점멸한다. 이 플레이어에게만 들리게 하려면 gizmo 를
이 패널과 같은 Local 소유로 두면 된다.

## `screenPixelRatio: { type: PropTypes.Number, default: 2 },`

> 원본 L184

`screenWidth/Height` 읽기값을 **패널 좌표 단위**로 옮기는 배율.

보드 패널과 **같은 값**을 넣어야 한다 (`PuzzleBoardUI_Panel.screenPixelRatio` -
재는 법과 근거가 거기 있다). 실기 측정에서 1179x2556 폰이 590x1280 으로 읽혔으므로 2 다.

이 패널은 배치가 아직 퍼센트·픽셀 혼합이라, 보드와 달리 이 값이 **여백과 글자 크기
모두**에 영향을 준다. 값이 절반이면 글자도 절반으로 그려진다 - 모바일에서 메뉴
글씨가 깨알 같던 원인이 이것이었다.

## `canvasWidth: { type: PropTypes.Number, default: 0 },`

> 원본 L196

캔버스 크기를 직접 못박는다 (px). 둘 다 0 이면 화면 비율에서 자동으로 잡는다.

`player.screenWidth/screenHeight` 가 실제 화면과 다르게 오는 기기를 만났을 때의
탈출구다. **보드 패널과 허브 패널에 같은 값을 넣어야 한다** - 다르면 같은 `%` 가
서로 다른 픽셀이 되어 HUD 바가 보드 위로 파고든다.

## `protected panelWidth: number = PUZZLE_UI_CANVAS_WIDTH;`

> 원본 L207

보드 패널과 **같은 캔버스**를 쓴다 (`PuzzleUI_Layout`).
다른 캔버스를 쓰면 같은 `%` 가 서로 다른 픽셀이 되어 HUD 바가 보드 위로 파고든다.

**`readonly` 가 아니다.** `initializeUI()` 에서 플레이어의 실제 화면 비율에 맞춰
다시 잡는다 - 그래야 Screen Overlay 가 화면을 꽉 채우고 옆으로 월드가 새지 않는다.
보드 패널도 같은 플레이어를 보고 같은 계산을 하므로 둘의 캔버스는 언제나 같다.

## `private _canvas: PuzzleUICanvas = getDefaultCanvas();`

> 원본 L218

 이 플레이어의 캔버스. `resolveLayout()` 에서 한 번 정하고 바뀌지 않는다

## `private _catalogColumns: number = CATALOG_COLUMNS_PORTRAIT;`

> 원본 L220

 메인 메뉴 격자의 열 수 - 세로 화면 2, 가로 화면 4

## `private _safeArea: PuzzleUISafeAreaPixels = { top: 0, bottom: 0, left: 0, right: 0 };`

> 원본 L222

안전 여백 (px).

**퍼센트가 아니라 픽셀이다.** Yoga 는 `padding`/`margin` 의 퍼센트를 네 방향 모두
부모의 *가로* 로 계산하므로, 가로 화면에서 위아래 여백이 세 배 넘게 부푼다
(`PuzzleUI_Layout` 머리말 §4).

## `private readonly _stageSubscriptions: SubscriptionBag = new SubscriptionBag();`

> 원본 L233

보드 스테이지 구독 - 보드 위 Menu 버튼의 일시정지 요청을 받는다.

스테이지는 **모듈 싱글턴**이라 이 패널보다 오래 산다. 재입장으로 패널이 다시 만들어질
때 정리하지 않으면 버려진 모델을 가리키는 구독이 겹쳐 쌓이므로 `dispose()` 에서 끊는다.

## `private _profile: PuzzleUILayoutProfile = getLayoutProfile(EUIDeviceClass.DESKTOP);`

> 원본 L241

 이 플레이어의 기기 규격. `initializeUI()` 에서 한 번 정하고 바뀌지 않는다

## `private _usableHeight: number = PUZZLE_UI_CANVAS_HEIGHT;`

> 원본 L243

 안전 여백을 물리고 남는 세로 길이 (px). 버튼 글자 크기가 여기서 나온다

## `private _pixelRatio: number = DEFAULT_SCREEN_PIXEL_RATIO;`

> 원본 L246

`screenPixelRatio` prop 을 담아 두는 자리. `resolveLayout()` 에서 채운다.

**필드 초기화에서 `this.props` 를 읽으면 컴포넌트가 아예 만들어지지 않는다**
(보드 패널에서 실제로 겪었다 - `작업기록_2026-09-03_보드UI_상대배치_전면개편.md` §5).
그래서 여기서도 prop 은 `resolveLayout()` 에서 한 번만 읽어 이 필드에 넣는다.

## `private _rawScreenHeight: number = 0;`

> 원본 L255

 `screenWidth/Height` 원본 읽기값 - 좌표 단위 환산의 출발점이다

## `private get screenUnitsHeight(): number {`

> 원본 L258

화면 세로를 **패널 좌표 단위**로 나타낸 값.

읽기값(`screenHeight`)은 긴 변을 1280 으로 정규화한 값이고, 패널이 실제로 그려지는
좌표계는 디바이스 실픽셀이다 (`PuzzleUI_RelativeLayout` 머리말). 그 차이가 `_pixelRatio` 다.

## `private get pxScale(): number {`

> 원본 L269

 기준 캔버스(세로 1180) 픽셀로 튜닝한 상수를 좌표 단위로 환산하는 배율

## `private px(referencePixels: number): number {`

> 원본 L274

 기준 캔버스 픽셀 값을 좌표 단위로 (최소 1) - 모서리 둥글기·잔여백에 쓴다

## `private readonly _hudLevel: Binding<string> = new Binding('');`

> 원본 L290

 좌측 상단 - "LV 3 / 24"

## `private readonly _hudSeconds: Binding<string> = new Binding('0');`

> 원본 L292

 상단 중앙 - 남은 초 하나

## `private readonly _isTimeCritical: Binding<boolean> = new Binding<boolean>(false);`

> 원본 L295

 초읽기(10초 미만)인지 - 숫자 색이 여기서 갈린다

## `private readonly _isBlinkOn: Binding<boolean> = new Binding<boolean>(true);`

> 원본 L297

 점멸의 켜짐/꺼짐. 초읽기가 아닐 때는 언제나 켜짐이다

## `private _blinkIntervalId: number | undefined = undefined;`

> 원본 L309

 점멸 인터벌. 초읽기에 들어갈 때만 돌고 나오면 멈춘다

## `private _isCriticalActive: boolean = false;`

> 원본 L311

 지금 초읽기 상태인지 (Binding 은 읽을 수 없어 따로 들고 있는다)

## `private _lastBeepSecond: number = -1;`

> 원본 L313

 마지막으로 소리를 낸 초. 같은 초에 두 번 울리지 않게 한다

## `public initializeUI(): UINode {`

> 원본 L316

#region Lifecycle

## `if (this.entity.owner.get() === this.world.getServerPlayer()) {`

> 원본 L319

소유권이 넘어오지 않은 서버 인스턴스는 아무것도 그리지 않는다

## `},`

> 원본 L343

**여기에는 여백을 주지 않는다.**

예전에는 안전 여백을 이 뿌리에 padding 으로 걸었는데, 그러면 각 화면의
배경이 여백 **안쪽**에만 칠해져 패널 가장자리가 투명하게 남았다.
그 틈으로 월드가 그대로 비쳤다 - "UI 가 화면을 꽉 채우지 않고 옆으로
월드가 보인다" 의 정체다.

이제 여백은 각 화면이 자기 안에서 물린다 (`screenPadding()`).
배경은 패널 끝까지 칠해지고, 글자와 버튼만 안전 영역 안으로 들어온다.

## `this.applyCatalog();`

> 원본 L355

초기 뷰 반영 (등록이 이 패널보다 먼저 끝난 CoreAPI 도 있을 수 있다)

## `private applyCanvasSize(): void {`

> 원본 L361

캔버스 크기를 패널에 반영한다.

**`preStart()` 에서 한 번, `initializeUI()` 에서 한 번** 부른다. 런타임이
`panelWidth`/`panelHeight` 를 언제 읽는지 문서에 없어서, 둘 중 어느 쪽이 먼저 와도
크기가 잡히도록 양쪽에 건다. 같은 값을 두 번 넣는 것이라 부작용이 없다.

에디터에서 `canvasWidth`/`canvasHeight` 를 넣었으면 그 값을 그대로 쓰고,
아니면 플레이어의 화면 비율에서 뽑는다.

## `if (this.entity.owner.get() === this.world.getServerPlayer()) {`

> 원본 L372

서버 인스턴스는 화면이 없다. 읽어 봐야 의미 없는 값이 나온다.

## `public preStart(): void {`

> 원본 L389

패널이 만들어지기 전에 캔버스 크기를 잡는다.
`initializeUI()` 에서만 대입하면 런타임이 그보다 먼저 크기를 읽는 경우 반영되지 않는다.

## `private resolveLayout(): void {`

> 원본 L397

 이 플레이어의 기기와 **화면 비율**에 맞는 규격을 정한다

## `this.applyCanvasSize();`

> 원본 L402

캔버스를 화면 비율에 맞춰야 Screen Overlay 가 화면을 꽉 채운다.
맞추지 않으면 남는 자리로 월드가 보인다 (`PuzzleUI_Layout` 머리말 §3).

## `this._pixelRatio = clampNumber(this.props.screenPixelRatio, 0.25, 8);`

> 원본 L407

글자·여백 환산 배율을 먼저 받아 둔다 (`_pixelRatio` 주석 - 여기서만 prop 을 읽는다)

## `const safeArea = computeSafeAreaPixels(this._profile, this._canvas);`

> 원본 L410

**좌표 단위로 잡는다.** 예전에는 캔버스(=읽기값) 픽셀로 잡아서 여백과 글자가 실제의
절반으로 그려졌다 - 모바일에서 메뉴 글씨가 깨알 같고 제목이 노치에 잘리던 원인이다.

