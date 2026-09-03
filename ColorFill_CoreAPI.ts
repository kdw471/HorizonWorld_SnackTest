/**
 * Color Fill Core API - PUZ_04 색 채우기 퍼즐을 실제 월드에서 구동하는 Horizon Component
 *
 * `Switch_CoreAPI` 와 같은 구조지만 **이 퍼즐만 격자가 아니다.** 18칸짜리 원형 다이얼이라
 * 별도 표현 결정이 필요했다 (`작업기록_2026-09-02_보드_CustomUI_전환.md` §6.3 표의 마지막 줄).
 *
 * ## 다이얼을 격자 위에 어떻게 얹었나
 *
 * 새 UI 를 만드는 대신 **5행 × 6열 격자의 테두리**를 다이얼로 쓴다.
 * 5×6 격자의 테두리 칸 수는 정확히 `2 × (5 + 6) - 4 = 18` 로 §3 의 칸 수와 일치한다.
 *
 *       0  1  2  3  4  5
 *      17  ·  ·  ·  ·  6
 *      16  ·  ·  ·  ·  7
 *      15  ·  ·  ·  ·  8
 *      14 13 12 11 10  9
 *
 * 0번 칸을 좌상단에 두고 시계방향으로 감는다. 안쪽 칸은 그리지 않으므로 눌리지도 않는다.
 * 덕분에 `PuzzleBoardUI_Panel` 을 한 줄도 고치지 않고 원형 회전을 표현한다.
 *
 * ## 조작
 *
 * 이 퍼즐은 배치가 아니라 타이밍이라 조작이 하나뿐이다 - **어느 칸을 눌러도 터치 한 번**
 * (§6 방향 반전 + 바늘이 오염 칸 위면 정화). 그래서 `onCellTap` 에서 칸 번호를 버리고
 * `session.touch()` 만 부른다.
 *
 * ## 붙이는 법
 *
 * `Documents/생성 문서/가이드/에디터_퍼즐_셋업.md` 와 동일하다.
 *
 * ## 텍스처
 *
 * 판 위 요소에 그림을 입힐 수 있다. 에디터에서 텍스처 애셋을 아래 prop 에 끼우면 그 요소가
 * 그림으로 그려지고, **비워 두면 예전처럼 색으로 그려진다.** 구조는
 * `PuzzleBoardUI_TextureLibrary.ts` 머리말에 있다.
 */

import { Component, PropTypes } from 'horizon/core';
import { EventPublisher } from 'Utility_Events';
import { connectPuzzleUpdate, enterPuzzleInteraction, exitPuzzleInteraction } from 'Puzzle_HorizonBridge';
import { EPuzzleId, getCatalogEntry } from 'PuzzleUI_Definitions';
import { PuzzleHubRegistry, buildPuzzleLevelTable, createPuzzleHandle } from 'PuzzleUI_Registry';
import { PuzzleBoardColor, PuzzleTextureKey, boardColor, textureKey } from 'PuzzleBoardUI_Definitions';
import { PuzzleTextureLibrary } from 'PuzzleBoardUI_TextureLibrary';
import { PuzzleBoardPresenter, PuzzleBoardStage } from 'PuzzleBoardUI_Presenter';
import { ColorFillLevelGenerator } from 'ColorFill_LevelGenerator';
import { ColorFillEvents } from 'ColorFill_GameEvents';
import { ColorFillTables } from 'ColorFill_DataTables';
import { ColorFillSession } from 'ColorFill_Session';
import {
	ColorFillLevel,
	ColorFillResultData,
	DIAL_SLOT_COUNT,
	DIRECTION_CLOCKWISE,
	ESlotState,
} from 'ColorFill_Definitions';

/** 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - SWITCH_READY 와 같은 규약 */
export const COLOR_FILL_READY = new EventPublisher<ColorFillCoreAPI>();

/** 다이얼을 얹는 격자. 테두리 칸 수가 18 이 되도록 5 × 6 으로 잡는다 */
const DIAL_ROW_COUNT = 5;
const DIAL_COL_COUNT = 6;

/** §3 - 오염 영역은 붉은색 */
const COLOR_CONTAMINATED: PuzzleBoardColor = boardColor(0.85, 0.2, 0.22);
/** §5 - 정화된 영역 */
const COLOR_CLEAN: PuzzleBoardColor = boardColor(0.2, 0.75, 0.7);
/** §4 - 비활성 칸. 정화 대상이 아니다 */
const COLOR_INACTIVE: PuzzleBoardColor = boardColor(0.16, 0.17, 0.22);

const COLOR_LABEL: PuzzleBoardColor = boardColor(1, 1, 1);

/** 바늘 라벨 - 지금 회전 방향을 함께 알린다 (§6) */
const NEEDLE_LABEL_CLOCKWISE = '>';
const NEEDLE_LABEL_COUNTER_CLOCKWISE = '<';

/**
 * 이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
 * 에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.
 */
/** 정화된 슬롯 */
const TEXTURE_CLEAN: PuzzleTextureKey = textureKey('colorFill', 'clean');
/** 오염된 슬롯 */
const TEXTURE_CONTAMINATED: PuzzleTextureKey = textureKey('colorFill', 'contaminated');
/** 다이얼에 속하지 않는 안쪽 칸 */
const TEXTURE_INACTIVE: PuzzleTextureKey = textureKey('colorFill', 'inactive');
/** 바늘이 올라가 있는 슬롯 */
const TEXTURE_NEEDLE: PuzzleTextureKey = textureKey('colorFill', 'needle');
/** 격자 뒤에 까는 판 그림 */
const TEXTURE_BOARD: PuzzleTextureKey = textureKey('colorFill', 'board');

export class ColorFillCoreAPI extends Component<typeof ColorFillCoreAPI> {
	public static propsDefinition = {
		/** 시작할 난이도 (1~5) */
		difficulty: { type: PropTypes.Number, default: 1 },
		/** 컴포넌트 시작과 동시에 퀘스트를 시작할지 */
		autoStart: { type: PropTypes.Boolean, default: false },
		/** 레벨 생성 시드. 0 이면 매번 다른 레벨 */
		seed: { type: PropTypes.Number, default: 0 },
		/** 퀘스트 중 카메라를 고정할지 (기본 끔). 보드가 Custom UI 라 입력에는 필요 없다 */
		focusCamera: { type: PropTypes.Boolean, default: false },
		/** `focusCamera` 가 켜졌을 때 카메라가 바라볼 대상 (보통 보드 UI gizmo) */
		boardCentre: { type: PropTypes.Entity },
		/** 카메라를 놓을 엔티티. 비우면 `boardCentre` 정면에 자동 배치한다 */
		cameraObject: { type: PropTypes.Entity },
		/** 보드에서 카메라까지 거리 (m) */
		cameraDistance: { type: PropTypes.Number, default: 0.6 },
		/** 카메라 시야각 */
		cameraFov: { type: PropTypes.Number, default: 40 },

		// --- 텍스처 (전부 선택) - 비워 두면 그 요소는 색으로 그려진다 ---
		/** 정화된 슬롯 */
		cleanTexture: { type: PropTypes.Asset },
		/** 오염된 슬롯 */
		contaminatedTexture: { type: PropTypes.Asset },
		/** 다이얼에 속하지 않는 안쪽 칸 */
		inactiveTexture: { type: PropTypes.Asset },
		/** 바늘이 올라가 있는 슬롯 */
		needleTexture: { type: PropTypes.Asset },
		/** 격자 뒤에 까는 판 그림 */
		boardTexture: { type: PropTypes.Asset },
	};

	public static instance: ColorFillCoreAPI | undefined = undefined;

	public events!: ColorFillEvents;
	public session!: ColorFillSession;
	public tables!: ColorFillTables;

	private _presenter!: PuzzleBoardPresenter;

	/** 다이얼 칸 index -> 격자 칸 번호. 생성 시 한 번만 만든다 */
	private readonly _slotToCell: number[] = buildRingCellMap();

	/** 지금 바늘이 올라가 있는 칸. 넘어갈 때 이전 칸의 강조를 걷는다 */
	private _needleSlot: number = -1;

	private _isInteractionActive: boolean = false;

	//#region Lifecycle

	public start(): void {
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			console.log('[ColorFillCoreAPI] Server instance. Waiting for ownership transfer. '
				+ '(If only this log appears without the "local start" log, set the script execution mode to Local '
				+ 'and make sure this entity is in Puzzle_LocalOwnership targets.)');
			return;
		}

		console.log('[ColorFillCoreAPI] Started on the local client. Ownership transfer OK.');

		this.constructSystems();

		if (this.props.autoStart) {
			this.startQuestByDifficulty(this.props.difficulty);
		}
	}

	public dispose(): void {
		PuzzleBoardStage.instance.unmount(this._presenter);
		this.releaseInteraction();
		if (ColorFillCoreAPI.instance === this) {
			ColorFillCoreAPI.instance = undefined;
		}
	}

	private constructSystems(): void {
		this.tables = new ColorFillTables();
		this.events = new ColorFillEvents();
		this.session = new ColorFillSession(
			this.events,
			this.tables,
			new ColorFillLevelGenerator(this.tables),
			{ seed: this.props.seed > 0 ? this.props.seed : undefined },
		);

		this.registerTextures();
		this.createPresenter();
		this.subscribeToSessionEvents();

		// 이 퍼즐에서 특히 중요하다 - 바늘이 도는 것 자체가 update() 다.
		// 빠뜨리면 바늘이 멈춘 채 제한 시간만 흐른다.
		connectPuzzleUpdate(this, (deltaSeconds) => this.session.update(deltaSeconds));

		PuzzleHubRegistry.instance.register(createPuzzleHandle(
			EPuzzleId.COLOR_FILL,
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

		ColorFillCoreAPI.instance = this;
		COLOR_FILL_READY.publish(this);
	}

	/**
	 * 에디터 prop 의 텍스처 애셋을 키에 붙인다.
	 *
	 * **프레젠터를 만들기 전에** 부른다. 순서가 뒤집혀도 패널이 세대를 올려 다시 그리지만,
	 * 먼저 등록해 두면 첫 프레임부터 그림이 붙는다.
	 */
	private registerTextures(): void {
		const count = PuzzleTextureLibrary.instance.registerAll([
			{ key: TEXTURE_CLEAN, asset: this.props.cleanTexture },
			{ key: TEXTURE_CONTAMINATED, asset: this.props.contaminatedTexture },
			{ key: TEXTURE_INACTIVE, asset: this.props.inactiveTexture },
			{ key: TEXTURE_NEEDLE, asset: this.props.needleTexture },
			{ key: TEXTURE_BOARD, asset: this.props.boardTexture },
		]);
		console.log(`[ColorFillCoreAPI] Registered ${count} textures. `
			+ 'Elements without one are drawn with a flat colour.');
	}

	private createPresenter(): void {
		this._presenter = new PuzzleBoardPresenter(
			{
				title: getCatalogEntry(EPuzzleId.COLOR_FILL)?.displayName ?? '',
				rowCount: DIAL_ROW_COUNT,
				colCount: DIAL_COL_COUNT,
				boardTexture: TEXTURE_BOARD,
				// 인터랙션 규격: 이 퍼즐의 입력은 보조 레이아웃을 채우는 큰 STOP 버튼 하나다.
				// 다이얼 칸들은 정적(표시 전용)이다 - applySlotVisual 이 isInteractive 를 끈다.
				actionLabel: 'STOP',
			},
			{
				// 타이밍이 곧 게임이므로 패널이 onPress(누르는 순간)로 연결한다 - 릴리즈를
				// 기다리던 예전 onCellTap 보다 판정이 빠르다 (§6 방향 반전 + 정화).
				onAction: () => { this.session.touch(); },
				// 보조 레이아웃의 Reset 버튼 - 판만 되돌리고 남은 시간은 그대로 둔다
				onReset: () => { this.resetLevel(); },
			},
		);
	}

	//#endregion

	//#region Focused interaction lifecycle (선택 - focusCamera 를 켰을 때만)

	private enterInteraction(): void {
		if (this.props.focusCamera === false || this._isInteractionActive) {
			return;
		}
		this._isInteractionActive = true;
		enterPuzzleInteraction(this, {
			cameraObject: this.props.cameraObject ?? undefined,
			boardCentre: this.props.cameraDistance > 0 ? (this.props.boardCentre ?? undefined) : undefined,
			distance: this.props.cameraDistance,
			fov: this.props.cameraFov > 0 ? this.props.cameraFov : undefined,
		});
	}

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

		// §5 - 오염 덩어리가 통째로 정화된다. 온 칸만 다시 칠하면 된다.
		this.events.SLOTS_PURIFIED.subscribe(this.onSlotsPurified.bind(this));

		// 바늘 이동. 매 프레임이 아니라 칸이 바뀔 때만 온다.
		this.events.NEEDLE_SLOT_CHANGED.subscribe(this.onNeedleSlotChanged.bind(this));

		// §6 - 딜레이가 끝나 방향이 실제로 뒤집힌 시점. 바늘 라벨의 화살표를 바꾼다.
		this.events.DIRECTION_CHANGED.subscribe(() => this.applyNeedleVisual());

		this.events.QUEST_CLEAR.subscribe(this.onQuestEnd.bind(this));
		this.events.QUEST_FAILED.subscribe(this.onQuestEnd.bind(this));
	}

	private onLevelLoaded(level: ColorFillLevel): void {
		// NEEDLE_SLOT_CHANGED 는 바늘이 칸을 **넘어갈 때만** 나온다. 시작 칸은 여기서 직접 읽어야
		// 첫 칸을 넘어갈 때까지 바늘이 보이지 않는 일이 없다.
		this._needleSlot = this.session.dial?.getCurrentSlotIndex() ?? -1;
		this.applyDialVisuals();
		this.applyNeedleVisual();

		PuzzleBoardStage.instance.mount(this._presenter);
		this._presenter.setInputEnabled(true);

		console.log(`[ColorFillCoreAPI] Level loaded: speed ${level.needleSpeedDegPerSec} deg/s, `
			+ `reverse delay ${level.reverseDelaySeconds}s.`);
	}

	private onSlotsPurified(slotIndexes: number[]): void {
		for (const slotIndex of slotIndexes) {
			this.applySlotVisual(slotIndex);
		}
		// 정화된 칸 위에 바늘이 서 있을 수 있다 - 강조를 다시 얹는다
		this.applyNeedleVisual();
	}

	private onNeedleSlotChanged(slotIndex: number): void {
		const previous = this._needleSlot;
		this._needleSlot = slotIndex;
		if (previous >= 0) {
			this.applySlotVisual(previous);
		}
		this.applyNeedleVisual();
	}

	private onQuestEnd(result: ColorFillResultData): void {
		// 허브의 결과 화면이 화면을 덮어야 하므로 보드를 내린다.
		// BoardPanel 과 HubPanel 은 서로 다른 gizmo 라 z-order 를 코드가 정할 수 없다.
		// 한 번에 하나만 그리게 두면 어느 쪽이 위든 결과 화면이 확실히 보인다.
		this._presenter.setInputEnabled(false);
		PuzzleBoardStage.instance.unmount(this._presenter);
		console.log(`[ColorFillCoreAPI] Quest ended: ${result.result} `
			+ `(${result.remainingTimeSeconds}s remaining, ${result.remainingContaminatedCount} slots contaminated)`);
	}

	/** 18칸 전체를 현재 상태로 다시 칠한다 */
	private applyDialVisuals(): void {
		for (let slotIndex = 0; slotIndex < DIAL_SLOT_COUNT; slotIndex++) {
			this.applySlotVisual(slotIndex);
		}
	}

	/** 칸 하나를 오염/정화 상태에 맞춘다 - §3 오염은 붉은색 */
	private applySlotVisual(slotIndex: number): void {
		const slot = this.session.dial?.getSlot(slotIndex);
		const cell = this._slotToCell[slotIndex];
		if (slot === undefined || cell === undefined) {
			return;
		}

		// §4 - 비활성 칸은 정화 대상이 아니다. 눌리기는 해야 하므로 그리기는 한다.
		const isContaminated = slot.state === ESlotState.CONTAMINATED;
		const fill = slot.isActive === false
			? COLOR_INACTIVE
			: (isContaminated ? COLOR_CONTAMINATED : COLOR_CLEAN);
		const texture = slot.isActive === false
			? TEXTURE_INACTIVE
			: (isContaminated ? TEXTURE_CONTAMINATED : TEXTURE_CLEAN);

		// 바늘이 떠난 칸도 여기로 돌아오므로, 바늘 그림을 **반드시 되돌려 놓는다**.
		// 되돌리지 않으면 바늘이 지나간 자리마다 바늘 그림이 남는다.
		this._presenter.setCell(cell, {
			isVisible: true,
			// 인터랙션 규격: 입력은 STOP 버튼이 받는다. 다이얼 칸은 표시 전용이라
			// 눌러도 누름 표시·감지가 일어나지 않게 한다.
			isInteractive: false,
			fill: fill,
			texture: texture,
			label: '',
			isHighlighted: false,
		});
	}

	/** 바늘이 서 있는 칸에 강조와 방향 화살표를 얹는다 (§6) */
	private applyNeedleVisual(): void {
		const dial = this.session.dial;
		if (dial === undefined || this._needleSlot < 0) {
			return;
		}
		const cell = this._slotToCell[this._needleSlot];
		if (cell === undefined) {
			return;
		}
		this._presenter.setCell(cell, {
			isHighlighted: true,
			texture: TEXTURE_NEEDLE,
			label: dial.needle.direction === DIRECTION_CLOCKWISE
				? NEEDLE_LABEL_CLOCKWISE
				: NEEDLE_LABEL_COUNTER_CLOCKWISE,
			labelColor: COLOR_LABEL,
		});
	}

	//#endregion
}

/**
 * 다이얼 칸(0..17)을 5×6 격자 테두리의 칸 번호로 옮긴다.
 *
 * 0번을 좌상단에 두고 시계방향으로 감는다. 위 -> 오른쪽 -> 아래 -> 왼쪽 순서이며,
 * 네 모서리는 한 번씩만 지나가므로 `6 + 4 + 5 + 3 = 18` 칸이 정확히 채워진다.
 */
function buildRingCellMap(): number[] {
	const toCell = (row: number, col: number) => row * DIAL_COL_COUNT + col;
	const cells: number[] = [];

	// 위쪽 변 - 좌 -> 우 (모서리 둘 포함)
	for (let col = 0; col < DIAL_COL_COUNT; col++) {
		cells.push(toCell(0, col));
	}
	// 오른쪽 변 - 위 -> 아래 (우상단 모서리는 위에서 이미 넣었다)
	for (let row = 1; row < DIAL_ROW_COUNT; row++) {
		cells.push(toCell(row, DIAL_COL_COUNT - 1));
	}
	// 아래쪽 변 - 우 -> 좌 (우하단 모서리는 오른쪽 변에서 이미 넣었다)
	for (let col = DIAL_COL_COUNT - 2; col >= 0; col--) {
		cells.push(toCell(DIAL_ROW_COUNT - 1, col));
	}
	// 왼쪽 변 - 아래 -> 위 (좌하단·좌상단 모서리는 이미 넣었다)
	for (let row = DIAL_ROW_COUNT - 2; row >= 1; row--) {
		cells.push(toCell(row, 0));
	}

	if (cells.length !== DIAL_SLOT_COUNT) {
		// 격자 크기를 바꿨는데 칸 수가 어긋난 경우다. 조용히 어긋나면 원인을 찾기 어렵다.
		console.warn(`[ColorFillCoreAPI] Ring layout produced ${cells.length} cells but the dial has ${DIAL_SLOT_COUNT} slots.`);
	}
	return cells;
}

Component.register(ColorFillCoreAPI);
