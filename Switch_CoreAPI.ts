/**
 * Switch Core API - PUZ_08 스위치 퍼즐을 실제 월드에서 구동하는 Horizon Component
 *
 * **8개 퍼즐 Horizon 통합의 레퍼런스 구현이다.** 다른 퍼즐도 이 구조를 그대로 복제하면 된다.
 *
 * ## 보드는 Custom UI 로 그린다
 *
 * 예전에는 키 캡 25개를 3D 엔티티로 놓고 `position`/`visible`/`tintColor` 를 갱신했다.
 * 지금은 `PuzzleBoardPresenter` 에 칸 색만 써 넣고, 실제 그리기는 `PuzzleBoardUI_Panel` 이 한다
 * (`Documents/생성 문서/설계/2026-09-02_멀티플레이_플랫폼에서_싱글플레이_구현_방안.md` §3.2 B안).
 *
 * 바뀐 것과 그대로인 것은 이렇다.
 *
 *   바뀜   3D 오브젝트 배치/색칠  ->  프레젠터의 칸 패치
 *   바뀜   터치 ray -> 평면 교차  ->  Pressable 이 칸 번호를 직접 준다
 *   그대로 세션·보드·생성기·테이블 (로직은 한 줄도 건드리지 않았다)
 *   그대로 허브 UI 등록, 프레임 구동, 퀘스트 조작 API
 *
 * ## 붙이는 법
 *
 *   1. 월드에 빈 엔티티를 하나 만들고 이 스크립트를 붙인다. 실행 모드는 **Local**.
 *   2. 같은 월드에 `PuzzleBoardUI_Panel` 을 붙인 Custom UI gizmo 를 하나 둔다. 실행 모드는 **Local**.
 *   3. `Puzzle_LocalOwnership` 의 targets 에 위 둘을 넣는다.
 *   4. `autoStart` 를 켜면 시작과 동시에 `difficulty` 퀘스트가 돈다.
 *      메인 UI(`PuzzleUI_MainPanel`)로 시작할 거면 끈다.
 *
 * **`Basics_Input_Screen` 과 `boardCentre` 는 더 이상 필수가 아니다.** 터치가 UI 에서 나오므로
 * Focused Interaction 도 필요 없다. 보드를 3D 공간의 한 자리에 고정해 바라보게 하고 싶을 때만
 * `focusCamera` 를 켜고 `boardCentre` 를 지정한다 (§ 카메라).
 *
 * ## 텍스처
 *
 * 키 캡·스위치 영역에 그림을 입힐 수 있다. 에디터에서 텍스처 애셋을 아래 prop 에 끼우면
 * 그 요소가 그림으로 그려지고, **비워 두면 예전처럼 색으로 그려진다.**
 * 자세한 구조는 `PuzzleBoardUI_TextureLibrary.ts` 머리말에 있다.
 *
 * 이 파일이 하는 일은 셋뿐이다.
 *   - 순수 로직(SwitchSession)을 만들고 매 프레임 update 를 돌린다
 *   - UI 가 준 칸 번호를 세션에 넘긴다
 *   - 세션이 내는 이벤트를 구독해 보드 프레젠터를 갱신한다
 * 규칙 판정은 한 줄도 여기 있지 않다 (PUZ_00 §7.1).
 */

import { Component, PropTypes } from 'horizon/core';
import { EventPublisher } from 'Utility_Events';
import { connectPuzzleUpdate, enterPuzzleInteraction, exitPuzzleInteraction } from 'Puzzle_HorizonBridge';
import { EPuzzleId, getCatalogEntry } from 'PuzzleUI_Definitions';
import { PuzzleHubRegistry, buildPuzzleLevelTable, createPuzzleHandle } from 'PuzzleUI_Registry';
import { PuzzleBoardColor, PuzzleTextureKey, boardColor, textureKey } from 'PuzzleBoardUI_Definitions';
import { PuzzleTextureLibrary } from 'PuzzleBoardUI_TextureLibrary';
import { PuzzleBoardPresenter, PuzzleBoardStage } from 'PuzzleBoardUI_Presenter';
import { SwitchLevelGenerator } from 'Switch_LevelGenerator';
import { SwitchPuzzleEvents } from 'Switch_GameEvents';
import { SwitchPuzzleTables } from 'Switch_DataTables';
import { SwitchSession } from 'Switch_Session';
import {
	ESwitchCellState,
	SWITCH_BOARD_SIZE,
	SWITCH_CELL_COUNT,
	SWITCH_MASK_SIZE,
	SwitchLevel,
	SwitchPressResult,
	SwitchPuzzleResultData,
} from 'Switch_Definitions';

/** 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - BASICS_READY 와 같은 규약 */
export const SWITCH_READY = new EventPublisher<SwitchCoreAPI>();

/** §5 - 눌린 키 캡은 녹색, 안 눌린 키 캡은 빨간색 */
const COLOR_PRESSED: PuzzleBoardColor = boardColor(0.15, 0.85, 0.3);
const COLOR_UNPRESSED: PuzzleBoardColor = boardColor(0.9, 0.2, 0.2);

/** §9.5 우측 미니 UI - 영향받는 좌표는 녹색, 아닌 좌표는 어둡게 */
const COLOR_MASK_ON: PuzzleBoardColor = boardColor(0.2, 0.8, 0.35);
const COLOR_MASK_OFF: PuzzleBoardColor = boardColor(0.25, 0.27, 0.33);

const SIDE_LABEL = 'Switch Area';

/**
 * 이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
 * 에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.
 */
const TEXTURE_PRESSED: PuzzleTextureKey = textureKey('switch', 'pressed');
const TEXTURE_UNPRESSED: PuzzleTextureKey = textureKey('switch', 'unpressed');
const TEXTURE_MASK_ON: PuzzleTextureKey = textureKey('switch', 'maskOn');
const TEXTURE_MASK_OFF: PuzzleTextureKey = textureKey('switch', 'maskOff');
const TEXTURE_BOARD: PuzzleTextureKey = textureKey('switch', 'board');

export class SwitchCoreAPI extends Component<typeof SwitchCoreAPI> {
	public static propsDefinition = {
		/** 시작할 난이도 (1~5) */
		difficulty: { type: PropTypes.Number, default: 1 },
		/** 컴포넌트 시작과 동시에 퀘스트를 시작할지 */
		autoStart: { type: PropTypes.Boolean, default: false },
		/** 레벨 생성 시드. 0 이면 매번 다른 레벨 */
		seed: { type: PropTypes.Number, default: 0 },
		/**
		 * 퀘스트 중 카메라를 고정할지 (기본 끔).
		 *
		 * 보드가 Custom UI 라 **터치 입력에는 필요 없다.** 월드에 세워 둔 보드 패널을
		 * 정면에서 보게 하고 싶을 때만 켠다. 켤 때는 `boardCentre` 도 함께 지정한다.
		 */
		focusCamera: { type: PropTypes.Boolean, default: false },
		/** `focusCamera` 가 켜졌을 때 카메라가 바라볼 대상 (보통 보드 UI gizmo) */
		boardCentre: { type: PropTypes.Entity },
		/**
		 * 카메라를 놓을 엔티티. 보통은 비워 둔다.
		 * 비우면 `boardCentre` 정면에 `cameraDistance` 만큼 띄워 자동 배치한다.
		 */
		cameraObject: { type: PropTypes.Entity },
		/** 보드에서 카메라까지 거리 (m) */
		cameraDistance: { type: PropTypes.Number, default: 0.6 },
		/** 카메라 시야각 */
		cameraFov: { type: PropTypes.Number, default: 40 },

		// --- 텍스처 (전부 선택) - 비워 두면 그 요소는 색으로 그려진다 ---
		/** 눌린 키 캡 */
		pressedTexture: { type: PropTypes.Asset },
		/** 안 눌린 키 캡 */
		unpressedTexture: { type: PropTypes.Asset },
		/** 스위치 영역 미니 격자에서 영향받는 좌표 */
		maskOnTexture: { type: PropTypes.Asset },
		/** 스위치 영역 미니 격자에서 영향받지 않는 좌표 */
		maskOffTexture: { type: PropTypes.Asset },
		/** 격자 뒤에 까는 판 그림 */
		boardTexture: { type: PropTypes.Asset },
	};

	public static instance: SwitchCoreAPI | undefined = undefined;

	public events!: SwitchPuzzleEvents;
	public session!: SwitchSession;
	public tables!: SwitchPuzzleTables;

	/** 보드 표현 상태. 실제 그리기는 PuzzleBoardUI_Panel 이 한다 */
	private _presenter!: PuzzleBoardPresenter;

	/** Focused Interaction 에 들어가 있는지 - 중복 진입과 미해제 갇힘을 막는다 */
	private _isInteractionActive: boolean = false;

	//#region Lifecycle

	public start(): void {
		// 로컬 클라이언트에서만 돈다 - Basics_CoreAPI 와 같은 규약.
		//
		// 이 검사에 걸려 조용히 끝나는 것이 셋업 실패의 가장 흔한 형태다.
		// 무엇이 잘못됐는지 콘솔만 보고도 알 수 있도록 두 경로 모두 로그를 남긴다.
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			console.log('[SwitchCoreAPI] Server instance. Waiting for ownership transfer. '
				+ '(If only this log appears without the "local start" log, set the script execution mode to Local '
				+ 'and make sure this entity is in Puzzle_LocalOwnership targets.)');
			return;
		}

		console.log('[SwitchCoreAPI] Started on the local client. Ownership transfer OK.');

		this.constructSystems();

		if (this.props.autoStart) {
			// 단독 구동 모드 - 즉시 퍼즐로 들어간다.
			// 메인 UI(PuzzleUI_MainPanel)를 쓸 때는 autoStart 를 끄고 시작을 메뉴에 맡긴다.
			this.startQuestByDifficulty(this.props.difficulty);
		}
	}

	public dispose(): void {
		// 소유권 이탈 등으로 컴포넌트가 내려갈 때 보드와 포커스 모드를 반드시 정리한다.
		// 정리하지 않으면 죽은 세션의 보드가 화면에 남고, 플레이어는 고정 카메라에 갇힌다.
		PuzzleBoardStage.instance.unmount(this._presenter);
		this.releaseInteraction();
		if (SwitchCoreAPI.instance === this) {
			SwitchCoreAPI.instance = undefined;
		}
	}

	private constructSystems(): void {
		this.tables = new SwitchPuzzleTables();
		this.events = new SwitchPuzzleEvents();
		this.session = new SwitchSession(
			this.events,
			this.tables,
			new SwitchLevelGenerator(this.tables),
			{ seed: this.props.seed > 0 ? this.props.seed : undefined },
		);

		this.registerTextures();
		this.createPresenter();
		this.subscribeToSessionEvents();

		// 이것을 빠뜨리면 제한 시간이 흐르지 않고 0.4초 누름 연출도 끝나지 않는다
		connectPuzzleUpdate(this, (deltaSeconds) => this.session.update(deltaSeconds));

		// 메인 UI(PuzzleUI_MainPanel)가 이 퍼즐을 목록에 띄우고 시작/일시정지/포기를
		// 조종할 수 있도록 정규화 핸들을 등록한다.
		PuzzleHubRegistry.instance.register(createPuzzleHandle(
			EPuzzleId.SWITCH,
			{
				startLevel: (difficulty, fieldOrdinal) => this.startLevel(difficulty, fieldOrdinal),
				startQuestByDifficulty: (difficulty) => this.startQuestByDifficulty(difficulty),
				resetLevel: () => this.resetLevel(),
				pause: () => this.pause(),
				resume: () => this.resume(),
				abort: () => this.abort(),
				getRemainingTimeSeconds: () => this.session.getRemainingTimeSeconds(),
				getRoundProgress: () => this.session.getRoundProgress(),
			},
			this.events,
			buildPuzzleLevelTable(
				(difficulty) => this.tables.getQuestByDifficulty(difficulty),
				(difficulty) => this.tables.getFieldsForDifficulty(difficulty).length,
			),
		));

		SwitchCoreAPI.instance = this;
		SWITCH_READY.publish(this);
	}

	/**
	 * 보드 프레젠터를 만들고 입력을 세션에 배선한다.
	 *
	 * 예전 `PuzzleTouchRouter` 배선과 의미가 정확히 같다. 다른 점은 칸 번호를
	 * 평면 교차로 구하지 않고 Pressable 이 그대로 준다는 것뿐이다.
	 */
	/**
	 * 에디터 prop 의 텍스처 애셋을 키에 붙인다.
	 *
	 * **프레젠터를 만들기 전에** 부른다. 순서가 뒤집혀도 패널이 세대를 올려 다시 그리지만,
	 * 먼저 등록해 두면 첫 프레임부터 그림이 붙는다.
	 */
	private registerTextures(): void {
		const count = PuzzleTextureLibrary.instance.registerAll([
			{ key: TEXTURE_PRESSED, asset: this.props.pressedTexture },
			{ key: TEXTURE_UNPRESSED, asset: this.props.unpressedTexture },
			{ key: TEXTURE_MASK_ON, asset: this.props.maskOnTexture },
			{ key: TEXTURE_MASK_OFF, asset: this.props.maskOffTexture },
			{ key: TEXTURE_BOARD, asset: this.props.boardTexture },
		]);
		console.log(`[SwitchCoreAPI] Registered ${count} textures. Elements without one are drawn with a flat colour.`);
	}

	private createPresenter(): void {
		this._presenter = new PuzzleBoardPresenter(
			{
				title: getCatalogEntry(EPuzzleId.SWITCH)?.displayName ?? '',
				rowCount: SWITCH_BOARD_SIZE,
				colCount: SWITCH_BOARD_SIZE,
				side: { rowCount: SWITCH_MASK_SIZE, colCount: SWITCH_MASK_SIZE, label: SIDE_LABEL },
				boardTexture: TEXTURE_BOARD,
			},
			{
				// M2 - 다운만으로는 눌리지 않는다. 같은 키 캡 위에서 떼야 확정된다.
				onCellDown: (cell) => { this.session.touchDown(cell); },
				// 보드 밖으로 나가면 -1 이 온다 -> "다운한 칸 밖" 이 되어 뗄 때 취소된다
				onCellMove: (cell) => { this.session.touchMove(cell); },
				onCellUp: () => { this.session.touchUp(); },
				// 보조 레이아웃의 Reset 버튼 - 판만 되돌리고 남은 시간은 그대로 둔다
				onReset: () => { this.resetLevel(); },
			},
		);
	}

	//#endregion

	//#region Focused interaction lifecycle (선택 - focusCamera 를 켰을 때만)

	/**
	 * 보드를 정면에서 보도록 카메라를 고정한다.
	 *
	 * 3D 보드 시절에는 **터치 입력의 전제 조건**이었지만 (Focused Interaction 모드에서만
	 * `Basics_Input_Screen` 의 터치 이벤트가 나온다), Custom UI 보드는 UI 자체가 입력을
	 * 받으므로 연출 목적으로만 쓴다.
	 */
	private enterInteraction(): void {
		if (this.props.focusCamera === false || this._isInteractionActive) {
			return;
		}
		this._isInteractionActive = true;
		enterPuzzleInteraction(this, {
			cameraObject: this.props.cameraObject ?? undefined,
			// cameraObject 를 비워 두면 보드 정면에 자동 배치된다
			boardCentre: this.props.cameraDistance > 0 ? (this.props.boardCentre ?? undefined) : undefined,
			distance: this.props.cameraDistance,
			fov: this.props.cameraFov > 0 ? this.props.cameraFov : undefined,
		});
	}

	/** 포커스 모드와 고정 카메라를 되돌린다 - 부르지 않으면 플레이어가 갇힌다 */
	private releaseInteraction(): void {
		if (this._isInteractionActive === false) {
			return;
		}
		this._isInteractionActive = false;
		exitPuzzleInteraction(this);
	}

	//#endregion

	//#region Public API (메인 UI 또는 퀘스트 트리거에서 호출한다)

	/**
	 * 레벨 하나만 플레이한다 (1라운드 고정). 메인 UI 의 Start / Continue 경로다.
	 * `fieldOrdinal` 은 그 난이도의 판 목록에서의 순번이다 (0-based).
	 */
	public startLevel(difficulty: number, fieldOrdinal: number): boolean {
		this.enterInteraction();
		this.beginLevelIntro();
		return this.session.startLevel(difficulty, fieldOrdinal);
	}

	public startQuestByDifficulty(difficulty: number): boolean {
		this.enterInteraction();
		this.beginLevelIntro();
		return this.session.startQuestByDifficulty(difficulty);
	}

	public startQuest(questId: string): boolean {
		this.enterInteraction();
		this.beginLevelIntro();
		return this.session.startQuest(questId);
	}

	/**
	 * 보조 레이아웃의 Reset 버튼 - 판을 풀기 전 상태로 되돌린다 (남은 시간은 유지).
	 *
	 * 배너를 다시 띄우지 않는다. 리셋은 새 레벨의 시작이 아니고, 배너가 뜨는 동안에는
	 * 보조 레이아웃이 가려져 Reset 버튼 자체가 사라지기 때문이다.
	 */
	public resetLevel(): boolean {
		return this.session.resetRound();
	}

	/**
	 * `GameStart` 배너를 띄운다. 배너가 사라진 뒤에야 보조 레이아웃이 나타난다.
	 * 배너를 내리는 시점은 패널(`PuzzleBoardUIPanel.introSeconds`)이 정한다.
	 */
	private beginLevelIntro(): void {
		this._presenter.beginIntro();
	}

	public pause(): void {
		this.session.pause();
		this._presenter.setInputEnabled(false);
		// 허브의 일시정지 오버레이가 화면을 덮어야 하므로 보드를 내린다
		PuzzleBoardStage.instance.unmount(this._presenter);
	}

	public resume(): void {
		this.session.resume();
		if (this.session.isActive === false) {
			// 일시정지 상태가 아니었다 - 세션이 무시했으므로 보드도 그대로 둔다
			return;
		}
		PuzzleBoardStage.instance.mount(this._presenter);
		this._presenter.setInputEnabled(true);
	}

	/** 퀘스트를 버리고 대기 상태로 - 보드를 내리고 카메라를 플레이어에게 돌려준다 */
	public abort(): void {
		this.session.abort();
		this._presenter.setInputEnabled(false);
		PuzzleBoardStage.instance.unmount(this._presenter);
		this.releaseInteraction();
	}

	//#endregion

	//#region Presentation (세션 이벤트 -> 보드 프레젠터)

	private subscribeToSessionEvents(): void {
		this.events.LEVEL_LOADED.subscribe(this.onLevelLoaded.bind(this));

		// §7 0.0초 - 누른 키 캡의 눌림 연출
		this.events.KEY_PRESSED.subscribe(this.onKeyPressed.bind(this));
		// §7 0.2초 - 스위치 영역의 나머지 키 캡 연출
		this.events.AREA_TOGGLED.subscribe(this.onAreaToggled.bind(this));
		// §7 0.4초 - 연출 종료. 이 시점의 상태를 최종 반영한다
		this.events.PRESS_SEQUENCE_FINISHED.subscribe(() => this.applyGridVisuals());

		// §6 / §9.5 - 라운드마다 다른 스위치 영역을 우측 미니 UI 에 표시한다
		this.events.MASK_CHANGED.subscribe(this.onMaskChanged.bind(this));

		this.events.QUEST_CLEAR.subscribe(this.onQuestEnd.bind(this));
		this.events.QUEST_FAILED.subscribe(this.onQuestEnd.bind(this));
	}

	private onLevelLoaded(level: SwitchLevel): void {
		for (let cell = 0; cell < SWITCH_CELL_COUNT; cell++) {
			// §4 - FREE 좌표에는 아무런 오브젝트가 생성되지 않는다. 숨긴 칸은 눌리지도 않는다.
			this._presenter.setCell(cell, { isVisible: level.grid[cell] !== ESwitchCellState.FREE });
		}

		this.applyGridVisuals();
		this.applyMaskVisuals();

		// 보드를 화면에 올린다. 패널이 아직 초기화되지 않았어도 mount 상태가 남아
		// 패널이 뜨는 순간 그려진다 (PuzzleBoardUIPanel.connectStage 참고).
		PuzzleBoardStage.instance.mount(this._presenter);
		this._presenter.setInputEnabled(true);
	}

	private onKeyPressed(result: SwitchPressResult): void {
		// 누른 칸만 먼저 반영한다. 나머지 영역은 0.2초 뒤 AREA_TOGGLED 에서.
		this.applyCellVisual(result.position);
	}

	private onAreaToggled(result: SwitchPressResult): void {
		for (const position of result.toggledPositions) {
			this.applyCellVisual(position);
		}
	}

	private onMaskChanged(mask: number[]): void {
		this.applyMaskVisuals(mask);
		console.log(`[SwitchCoreAPI] Switch area updated: ${mask.join('')}`);
	}

	private onQuestEnd(result: SwitchPuzzleResultData): void {
		// 허브의 결과 화면이 화면을 덮어야 하므로 보드를 내린다.
		// BoardPanel 과 HubPanel 은 서로 다른 gizmo 라 z-order 를 코드가 정할 수 없다.
		// 한 번에 하나만 그리게 두면 어느 쪽이 위든 결과 화면이 확실히 보인다.
		this._presenter.setInputEnabled(false);
		PuzzleBoardStage.instance.unmount(this._presenter);
		console.log(`[SwitchCoreAPI] Quest ended: ${result.result} (${result.remainingTimeSeconds}s remaining)`);
	}

	/** 전체 격자를 현재 상태로 다시 칠한다 */
	private applyGridVisuals(): void {
		for (let cell = 0; cell < SWITCH_CELL_COUNT; cell++) {
			this.applyCellVisual(cell);
		}
	}

	/** 키 캡 하나의 색을 상태에 맞춘다 - §5 "눌림 상태에 따라 윗면의 모양과 색상이 변한다" */
	private applyCellVisual(cell: number): void {
		const state = this.session.board?.getCellAt(cell);
		if (state === undefined || state === ESwitchCellState.FREE) {
			return;
		}
		const isPressed = state === ESwitchCellState.PRESSED;
		this._presenter.setCell(cell, {
			fill: isPressed ? COLOR_PRESSED : COLOR_UNPRESSED,
			texture: isPressed ? TEXTURE_PRESSED : TEXTURE_UNPRESSED,
		});
	}

	/** 우측 3×3 미니 UI - 이번 라운드의 스위치 영역 (§6 / §9.5) */
	private applyMaskVisuals(mask?: readonly number[]): void {
		const values = mask ?? this.session.getMask();
		if (values === undefined) {
			return;
		}
		for (let index = 0; index < values.length; index++) {
			const isOn = values[index] === 1;
			this._presenter.setSideCell(index, {
				isVisible: true,
				fill: isOn ? COLOR_MASK_ON : COLOR_MASK_OFF,
				texture: isOn ? TEXTURE_MASK_ON : TEXTURE_MASK_OFF,
			});
		}
	}

	//#endregion
}
Component.register(SwitchCoreAPI);
