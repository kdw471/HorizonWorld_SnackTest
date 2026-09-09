# Switch_CoreAPI.ts — 주석 아카이브

> 원본 스크립트: `Switch_CoreAPI.ts`
> 걷어낸 주석 27건 / 5,762 B 절감 (19,491 B → 13,729 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Switch Core API - PUZ_08 스위치 퍼즐을 실제 월드에서 구동하는 Horizon Component

**8개 퍼즐 Horizon 통합의 레퍼런스 구현이다.** 다른 퍼즐도 이 구조를 그대로 복제하면 된다.

#### 보드는 Custom UI 로 그린다

예전에는 키 캡 25개를 3D 엔티티로 놓고 `position`/`visible`/`tintColor` 를 갱신했다.
지금은 `PuzzleBoardPresenter` 에 칸 색만 써 넣고, 실제 그리기는 `PuzzleBoardUI_Panel` 이 한다
(`Documents/생성 문서/설계/2026-09-02_멀티플레이_플랫폼에서_싱글플레이_구현_방안.md` §3.2 B안).

바뀐 것과 그대로인 것은 이렇다.

  바뀜   3D 오브젝트 배치/색칠  ->  프레젠터의 칸 패치
  바뀜   터치 ray -> 평면 교차  ->  Pressable 이 칸 번호를 직접 준다
  그대로 세션·보드·생성기·테이블 (로직은 한 줄도 건드리지 않았다)
  그대로 허브 UI 등록, 프레임 구동, 퀘스트 조작 API

#### 붙이는 법

  1. 월드에 빈 엔티티를 하나 만들고 이 스크립트를 붙인다. 실행 모드는 **Local**.
  2. 같은 월드에 `PuzzleBoardUI_Panel` 을 붙인 Custom UI gizmo 를 하나 둔다. 실행 모드는 **Local**.
  3. `Puzzle_LocalOwnership` 의 targets 에 위 둘을 넣는다.
  4. `autoStart` 를 켜면 시작과 동시에 `difficulty` 퀘스트가 돈다.
     메인 UI(`PuzzleUI_MainPanel`)로 시작할 거면 끈다.

**`Basics_Input_Screen` 과 `boardCentre` 는 더 이상 필수가 아니다.** 터치가 UI 에서 나오므로
Focused Interaction 도 필요 없다. 보드를 3D 공간의 한 자리에 고정해 바라보게 하고 싶을 때만
`focusCamera` 를 켜고 `boardCentre` 를 지정한다 (§ 카메라).

#### 텍스처

키 캡·스위치 영역에 그림을 입힐 수 있다. 에디터에서 텍스처 애셋을 아래 prop 에 끼우면
그 요소가 그림으로 그려지고, **비워 두면 예전처럼 색으로 그려진다.**
자세한 구조는 `PuzzleBoardUI_TextureLibrary.ts` 머리말에 있다.

이 파일이 하는 일은 셋뿐이다.
  - 순수 로직(SwitchSession)을 만들고 매 프레임 update 를 돌린다
  - UI 가 준 칸 번호를 세션에 넘긴다
  - 세션이 내는 이벤트를 구독해 보드 프레젠터를 갱신한다
규칙 판정은 한 줄도 여기 있지 않다 (PUZ_00 §7.1).

## `export const SWITCH_READY = new EventPublisher<SwitchCoreAPI>();`

> 원본 L66

 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - BASICS_READY 와 같은 규약

## `const COLOR_PRESSED: PuzzleBoardColor = boardColor(0.15, 0.85, 0.3);`

> 원본 L69

 §5 - 눌린 키 캡은 녹색, 안 눌린 키 캡은 빨간색

## `const COLOR_MASK_ON: PuzzleBoardColor = boardColor(0.2, 0.8, 0.35);`

> 원본 L73

 §9.5 우측 미니 UI - 영향받는 좌표는 녹색, 아닌 좌표는 어둡게

## `const TEXTURE_PRESSED: PuzzleTextureKey = textureKey('switch', 'pressed');`

> 원본 L79

이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.

## `difficulty: { type: PropTypes.Number, default: 1 },`

> 원본 L91

 시작할 난이도 (1~5)

## `autoStart: { type: PropTypes.Boolean, default: false },`

> 원본 L93

 컴포넌트 시작과 동시에 퀘스트를 시작할지

## `seed: { type: PropTypes.Number, default: 0 },`

> 원본 L95

 레벨 생성 시드. 0 이면 매번 다른 레벨

## `focusCamera: { type: PropTypes.Boolean, default: false },`

> 원본 L97

퀘스트 중 카메라를 고정할지 (기본 끔).

보드가 Custom UI 라 **터치 입력에는 필요 없다.** 월드에 세워 둔 보드 패널을
정면에서 보게 하고 싶을 때만 켠다. 켤 때는 `boardCentre` 도 함께 지정한다.

## `boardCentre: { type: PropTypes.Entity },`

> 원본 L104

 `focusCamera` 가 켜졌을 때 카메라가 바라볼 대상 (보통 보드 UI gizmo)

## `cameraObject: { type: PropTypes.Entity },`

> 원본 L106

카메라를 놓을 엔티티. 보통은 비워 둔다.
비우면 `boardCentre` 정면에 `cameraDistance` 만큼 띄워 자동 배치한다.

## `cameraDistance: { type: PropTypes.Number, default: 0.6 },`

> 원본 L111

 보드에서 카메라까지 거리 (m)

## `cameraFov: { type: PropTypes.Number, default: 40 },`

> 원본 L113

 카메라 시야각

## `pressedTexture: { type: PropTypes.Asset },`

> 원본 L116

--- 텍스처 (전부 선택) - 비워 두면 그 요소는 색으로 그려진다 ---
 눌린 키 캡

## `unpressedTexture: { type: PropTypes.Asset },`

> 원본 L119

 안 눌린 키 캡

## `maskOnTexture: { type: PropTypes.Asset },`

> 원본 L121

 스위치 영역 미니 격자에서 영향받는 좌표

## `maskOffTexture: { type: PropTypes.Asset },`

> 원본 L123

 스위치 영역 미니 격자에서 영향받지 않는 좌표

## `boardTexture: { type: PropTypes.Asset },`

> 원본 L125

 격자 뒤에 까는 판 그림

## `private _presenter!: PuzzleBoardPresenter;`

> 원본 L135

 보드 표현 상태. 실제 그리기는 PuzzleBoardUI_Panel 이 한다

## `private _isInteractionActive: boolean = false;`

> 원본 L138

 Focused Interaction 에 들어가 있는지 - 중복 진입과 미해제 갇힘을 막는다

## `public start(): void {`

> 원본 L141

#region Lifecycle

## `if (this.entity.owner.get() === this.world.getServerPlayer()) {`

> 원본 L144

로컬 클라이언트에서만 돈다 - Basics_CoreAPI 와 같은 규약.

이 검사에 걸려 조용히 끝나는 것이 셋업 실패의 가장 흔한 형태다.
무엇이 잘못됐는지 콘솔만 보고도 알 수 있도록 두 경로 모두 로그를 남긴다.

## `this.startQuestByDifficulty(this.props.difficulty);`

> 원본 L160

단독 구동 모드 - 즉시 퍼즐로 들어간다.
메인 UI(PuzzleUI_MainPanel)를 쓸 때는 autoStart 를 끄고 시작을 메뉴에 맡긴다.

## `PuzzleBoardStage.instance.unmount(this._presenter);`

> 원본 L167

소유권 이탈 등으로 컴포넌트가 내려갈 때 보드와 포커스 모드를 반드시 정리한다.
정리하지 않으면 죽은 세션의 보드가 화면에 남고, 플레이어는 고정 카메라에 갇힌다.

## `connectPuzzleUpdate(this, (deltaSeconds) => this.session.update(deltaSeconds));`

> 원본 L190

이것을 빠뜨리면 제한 시간이 흐르지 않고 0.4초 누름 연출도 끝나지 않는다

## `PuzzleHubRegistry.instance.register(createPuzzleHandle(`

> 원본 L193

메인 UI(PuzzleUI_MainPanel)가 이 퍼즐을 목록에 띄우고 시작/일시정지/포기를
조종할 수 있도록 정규화 핸들을 등록한다.

## `private registerTextures(): void {`

> 원본 L218

보드 프레젠터를 만들고 입력을 세션에 배선한다.

예전 `PuzzleTouchRouter` 배선과 의미가 정확히 같다. 다른 점은 칸 번호를
평면 교차로 구하지 않고 Pressable 이 그대로 준다는 것뿐이다.


에디터 prop 의 텍스처 애셋을 키에 붙인다.

**프레젠터를 만들기 전에** 부른다. 순서가 뒤집혀도 패널이 세대를 올려 다시 그리지만,
먼저 등록해 두면 첫 프레임부터 그림이 붙는다.

