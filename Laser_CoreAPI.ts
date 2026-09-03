/**
 * Laser Core API - PUZ_01 레이저 해킹 퍼즐을 실제 월드에서 구동하는 Horizon Component
 *
 * `Switch_CoreAPI` 와 같은 구조다. 브리지·보드 UI·소유권 컴포넌트는 그대로 재사용한다
 * (`Documents/생성 문서/구현 사항/작업기록_2026-09-02_보드_CustomUI_전환.md` §6.3).
 *
 * ## 인벤토리를 어디에 그리는가
 *
 * 이 퍼즐만 **필드 밖에 인벤토리**가 있다 (§3 3.2 - 지급된 크리스탈을 필드로 끌어다 놓는다).
 * 인벤토리는 화면 아래 **보조 레이아웃의 오브젝트 트레이**에 놓는다 (worker/NextJob.md 1번).
 *
 *      ┌ 본 격자 7×7 (정사각형) ┐
 *      └───────────────────────┘
 *      ┌ 트레이: 크리스탈 · Reset ┐
 *      └───────────────────────┘
 *
 * 트레이 슬롯에서 시작한 드래그는 격자 칸의 `onEnter` 로 그대로 이어지므로, 세션이 보는
 * 그림은 예전과 같다 - 집기(`beginDragFromInventory`) → 이동(`updateDrag`) → 놓기(`endDrag`).
 * 예전에는 트레이가 입력을 받지 못해 인벤토리를 본 격자의 9번째 열에 끼워 넣었는데,
 * 그 여분 열이 사라지면서 **본 격자가 기획 그대로 7×7 정사각형**이 됐다.
 *
 * ## 좌표계가 둘이라는 점에 주의
 *
 *   전체 그리드 7×7 (0..6)  : 기믹(발사체/수신체/중계체/해골)과 광선 구간
 *    └ 중앙 5×5 (0..4)      : 크리스탈 배치 영역. 세션의 드래그 API 는 이 로컬 좌표를 받는다
 *
 * 배치 영역 밖(테두리·인벤토리·격자 밖)으로 끌면 로컬 좌표 (-1, -1) 을 넘긴다.
 * 그러면 컨트롤러가 "영역 밖 드랍"으로 판정해 크리스탈을 인벤토리로 돌려보낸다 (§3 3.3).
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
import {
	EBoardCellAccent,
	EBoardCellGlyph,
	PUZZLE_BOARD_CELL_OUTSIDE,
	PuzzleBoardColor,
	boardColor,
	NO_TEXTURE,
	PuzzleTextureKey,
	textureKey,
} from 'PuzzleBoardUI_Definitions';
import { PuzzleTextureLibrary } from 'PuzzleBoardUI_TextureLibrary';
import { PuzzleBoardPresenter, PuzzleBoardStage } from 'PuzzleBoardUI_Presenter';
import { LaserLevelGenerator } from 'Laser_LevelGenerator';
import { LaserEvents } from 'Laser_GameEvents';
import { LaserTables } from 'Laser_DataTables';
import { LaserSession } from 'Laser_Session';
import {
	ECrystalType,
	EGimmickType,
	ELaserColor,
	EObjectState,
	ETeeBlockedSide,
	ETriangleCorner,
	LASER_FULL_GRID_SIZE,
	LaserCrystal,
	LaserLevel,
	LaserResultData,
	LaserTraceResult,
	getDirectionDelta,
	isInsidePlacementArea,
	toPlacementLocalIndex,
} from 'Laser_Definitions';

/** 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - SWITCH_READY 와 같은 규약 */
export const LASER_READY = new EventPublisher<LaserCoreAPI>();

/** 격자 열 수 - 기획의 전체 그리드 그대로다 (인벤토리는 격자 밖 트레이에 있다) */
const BOARD_COL_COUNT = LASER_FULL_GRID_SIZE;
/** 트레이의 인벤토리 슬롯 수. 기획 난이도 표의 최대 소요 슬롯이 5개라 7이면 넉넉하다 */
const INVENTORY_SLOT_COUNT = 7;
/** 트레이 위에 붙는 이름 */
const INVENTORY_LABEL = 'Crystals';

/** 배치 영역 밖을 가리키는 로컬 좌표. 여기서 손을 떼면 인벤토리로 돌아간다 (§3 3.3) */
const OUTSIDE_LOCAL_INDEX = -1;

/** 광선 색 - §3 2.1 (색이 곧 레이어라 서로 간섭하지 않는다) */
const LASER_COLORS: { [color: string]: PuzzleBoardColor } = {
	RED: boardColor(0.95, 0.25, 0.25),
	GREEN: boardColor(0.3, 0.9, 0.35),
	BLUE: boardColor(0.35, 0.55, 0.98),
};

/** 테두리(발사체·수신체 전용 구역, §5.1) */
const COLOR_BORDER: PuzzleBoardColor = boardColor(0.1, 0.11, 0.15);
/** 크리스탈을 놓을 수 있는 중앙 5×5 (§5.0) */
const COLOR_PLACEMENT: PuzzleBoardColor = boardColor(0.19, 0.2, 0.26);
/** 플레이어가 옮길 수 있는 크리스탈 */
const COLOR_CRYSTAL: PuzzleBoardColor = boardColor(0.75, 0.8, 0.9);
/** 고정 크리스탈 - 유저가 회수할 수 없다 (§4.3) */
const COLOR_FIXED_CRYSTAL: PuzzleBoardColor = boardColor(0.42, 0.45, 0.5);
/** 중계체 - 반드시 경유해야 한다 (§4.2) */
const COLOR_RELAY: PuzzleBoardColor = boardColor(0.85, 0.75, 0.35);
/** 해골 - 닿으면 모든 수신체가 Fault (§3 4.2.1) */
const COLOR_SKULL: PuzzleBoardColor = boardColor(0.45, 0.1, 0.12);
/** 인벤토리의 빈 슬롯 */
const COLOR_INVENTORY_EMPTY: PuzzleBoardColor = boardColor(0.14, 0.15, 0.19);

const COLOR_LABEL: PuzzleBoardColor = boardColor(1, 1, 1);
const COLOR_LABEL_DARK: PuzzleBoardColor = boardColor(0.1, 0.1, 0.12);

/** 광선이 지나간 빈 칸을 칠할 때의 밝기 - 오브젝트보다 어둡게 해서 경로로 읽히게 한다 */
const BEAM_TONE_SCALE = 0.55;
/** Off 상태 오브젝트를 어둡게 하는 비율 - PUZ_00 §5 */
const OFF_TONE_SCALE = 0.4;

/** 광선 한 구간을 따라가는 최대 칸 수 - 무한 루프 방지용 안전핀 */
const MAX_SEGMENT_STEPS = LASER_FULL_GRID_SIZE * 2;

/**
 * 이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
 * 에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.
 */
/** 플레이어가 옮길 수 있는 크리스탈 */
const TEXTURE_CRYSTAL: PuzzleTextureKey = textureKey('laser', 'crystal');
/** 고정 크리스탈 */
const TEXTURE_FIXED_CRYSTAL: PuzzleTextureKey = textureKey('laser', 'fixedCrystal');
/** 중계체 */
const TEXTURE_RELAY: PuzzleTextureKey = textureKey('laser', 'relay');
/** 해골 */
const TEXTURE_SKULL: PuzzleTextureKey = textureKey('laser', 'skull');
/** 발사체·수신체 */
const TEXTURE_GIMMICK: PuzzleTextureKey = textureKey('laser', 'gimmick');
/** 크리스탈을 놓을 수 있는 중앙 5x5 */
const TEXTURE_PLACEMENT: PuzzleTextureKey = textureKey('laser', 'placement');
/** 테두리(발사체·수신체 전용 구역) */
const TEXTURE_BORDER: PuzzleTextureKey = textureKey('laser', 'border');
/** 격자 뒤에 까는 판 그림 */
const TEXTURE_BOARD: PuzzleTextureKey = textureKey('laser', 'board');

export class LaserCoreAPI extends Component<typeof LaserCoreAPI> {
	public static propsDefinition = {
		/** 시작할 난이도 (1~6) */
		difficulty: { type: PropTypes.Number, default: 1 },
		/** 컴포넌트 시작과 동시에 퀘스트를 시작할지 */
		autoStart: { type: PropTypes.Boolean, default: false },
		/** 레벨 생성 시드. 0 이면 매번 다른 레벨 */
		seed: { type: PropTypes.Number, default: 0 },
		/**
		 * 드래그 중인 크리스탈을 손가락 **위쪽으로 띄우는 오프셋** - 격자 칸 한 변의 배수다.
		 * 손가락이 조각을 가려 무엇을 옮기는지 안 보이는 것을 막는다. 0 이면 띄우지 않는다.
		 * 8개 퍼즐 중 레이저만 띄우기를 켜므로 이 값도 여기서만 조정한다.
		 */
		dragLiftCells: { type: PropTypes.Number, default: 0.9 },
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
		/** 플레이어가 옮길 수 있는 크리스탈 */
		crystalTexture: { type: PropTypes.Asset },
		/** 고정 크리스탈 */
		fixedCrystalTexture: { type: PropTypes.Asset },
		/** 중계체 */
		relayTexture: { type: PropTypes.Asset },
		/** 해골 */
		skullTexture: { type: PropTypes.Asset },
		/** 발사체·수신체 */
		gimmickTexture: { type: PropTypes.Asset },
		/** 크리스탈을 놓을 수 있는 중앙 5x5 */
		placementTexture: { type: PropTypes.Asset },
		/** 테두리(발사체·수신체 전용 구역) */
		borderTexture: { type: PropTypes.Asset },
		/** 격자 뒤에 까는 판 그림 */
		boardTexture: { type: PropTypes.Asset },
	};

	public static instance: LaserCoreAPI | undefined = undefined;

	public events!: LaserEvents;
	public session!: LaserSession;
	public tables!: LaserTables;

	private _presenter!: PuzzleBoardPresenter;

	/**
	 * 지금 끌고 있는 크리스탈. 없으면 undefined.
	 *
	 * 보드는 **손을 뗄 때까지 바뀌지 않는다** (§3 3.3 - 놓아야 배치가 확정된다). 그래서
	 * 이것을 들고 있지 않으면 드래그하는 동안 화면에 아무 변화가 없어, 크리스탈을 집었는지도
	 * 알 수 없었다. 여기 담아 두고 손가락이 올라간 칸에 크리스탈을 미리 그린다.
	 */
	private _dragCrystalId: string | undefined = undefined;
	/** 트레이에서 집었으면 그 슬롯 번호. 필드에서 집었으면 undefined */
	private _dragSlot: number | undefined = undefined;
	/** 필드에서 집었으면 원래 있던 칸(배치 로컬). 트레이에서 집었으면 undefined */
	private _dragSourceRow: number | undefined = undefined;
	private _dragSourceCol: number | undefined = undefined;
	/** 손가락이 올라가 있는 칸(배치 로컬). 배치 영역 밖이면 undefined */
	private _dragRow: number | undefined = undefined;
	private _dragCol: number | undefined = undefined;
	/** 지금 놓아도 되는 자리인지 - 초록/빨강 테두리를 가른다 */
	private _isDropValid: boolean = false;

	/**
	 * 이번 리페인트에서 실제로 기록할 칸 (전체 그리드 번호). undefined 면 전부 기록한다.
	 *
	 * 방법론 §4.2(더티 플래그) - 드래그 미리보기가 한 칸 옮겨질 때 값이 바뀔 수 있는 칸은
	 * 이전 미리보기 자리와 새 미리보기 자리뿐이다 (보드·광선은 손을 뗄 때까지 그대로다).
	 * 페인터(`applyBoardVisuals`)는 그대로 두고 기록만 걸러내므로 레이어 순서가 갈라지지 않는다.
	 */
	private _repaintFilter: Set<number> | undefined = undefined;
	/** 재사용 버퍼 - 전환마다 Set 을 새로 만들지 않는다 (방법론 §4.4 할당 제로) */
	private readonly _dirtyCells: Set<number> = new Set<number>();

	private _isInteractionActive: boolean = false;

	//#region Lifecycle

	public start(): void {
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			console.log('[LaserCoreAPI] Server instance. Waiting for ownership transfer. '
				+ '(If only this log appears without the "local start" log, set the script execution mode to Local '
				+ 'and make sure this entity is in Puzzle_LocalOwnership targets.)');
			return;
		}

		console.log('[LaserCoreAPI] Started on the local client. Ownership transfer OK.');

		this.constructSystems();

		if (this.props.autoStart) {
			this.startQuestByDifficulty(this.props.difficulty);
		}
	}

	public dispose(): void {
		PuzzleBoardStage.instance.unmount(this._presenter);
		this.releaseInteraction();
		if (LaserCoreAPI.instance === this) {
			LaserCoreAPI.instance = undefined;
		}
	}

	private constructSystems(): void {
		this.tables = new LaserTables();
		this.events = new LaserEvents();
		this.session = new LaserSession(
			this.events,
			this.tables,
			new LaserLevelGenerator(this.tables),
			// 추적기와 솔버는 세션의 기본 인스턴스를 그대로 쓴다 (솔버는 힌트 전용)
			undefined,
			undefined,
			{ seed: this.props.seed > 0 ? this.props.seed : undefined },
		);

		this.registerTextures();
		this.createPresenter();
		this.subscribeToSessionEvents();

		// 이것을 빠뜨리면 제한 시간이 흐르지 않는다
		connectPuzzleUpdate(this, (deltaSeconds) => this.session.update(deltaSeconds));

		PuzzleHubRegistry.instance.register(createPuzzleHandle(
			EPuzzleId.LASER,
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

		LaserCoreAPI.instance = this;
		LASER_READY.publish(this);
	}

	/**
	 * 에디터 prop 의 텍스처 애셋을 키에 붙인다.
	 *
	 * **프레젠터를 만들기 전에** 부른다. 순서가 뒤집혀도 패널이 세대를 올려 다시 그리지만,
	 * 먼저 등록해 두면 첫 프레임부터 그림이 붙는다.
	 */
	private registerTextures(): void {
		const count = PuzzleTextureLibrary.instance.registerAll([
			{ key: TEXTURE_CRYSTAL, asset: this.props.crystalTexture },
			{ key: TEXTURE_FIXED_CRYSTAL, asset: this.props.fixedCrystalTexture },
			{ key: TEXTURE_RELAY, asset: this.props.relayTexture },
			{ key: TEXTURE_SKULL, asset: this.props.skullTexture },
			{ key: TEXTURE_GIMMICK, asset: this.props.gimmickTexture },
			{ key: TEXTURE_PLACEMENT, asset: this.props.placementTexture },
			{ key: TEXTURE_BORDER, asset: this.props.borderTexture },
			{ key: TEXTURE_BOARD, asset: this.props.boardTexture },
		]);
		console.log(`[LaserCoreAPI] Registered ${count} textures. `
			+ 'Elements without one are drawn with a flat colour.');
	}

	private createPresenter(): void {
		this._presenter = new PuzzleBoardPresenter(
			{
				title: getCatalogEntry(EPuzzleId.LASER)?.displayName ?? '',
				rowCount: LASER_FULL_GRID_SIZE,
				colCount: BOARD_COL_COUNT,
				boardTexture: TEXTURE_BOARD,
				itemCount: INVENTORY_SLOT_COUNT,
				itemLabel: INVENTORY_LABEL,
				// 크리스탈을 끌고 다니는 동안 손가락 위로 띄운다 - 8개 퍼즐 중 레이저만 켠다.
				// 나머지는 조각이 손가락과 다른 칸 위에 떠 보여 조준을 흐린다는 피드백으로 껐다.
				liftGrabbedPiece: true,
				// 띄우는 거리(칸 배수)는 에디터 prop 으로 조정한다
				grabLiftCellRatio: this.props.dragLiftCells,
			},
			{
				// 트레이에서 집었다 - 슬롯 번호가 곧 인벤토리 순번이다
				onItemDown: (slot) => { this.onInventoryPick(slot); },
				onCellDown: (cell) => { this.onDragBegin(cell); },
				onCellMove: (cell) => { this.onDragMove(cell); },
				onCellUp: (cell) => { this.onDragEnd(cell); },
				// 보조 레이아웃의 Reset 버튼 - 판만 되돌리고 남은 시간은 그대로 둔다
				onReset: () => { this.resetLevel(); },
			},
		);
	}

	//#endregion

	//#region Input (프레젠터 -> 세션)

	private onDragBegin(cell: number): void {
		// 필드에 놓인 크리스탈을 집는다. 고정 크리스탈이면 세션이 거절한다 (§4.3).
		const localRow = toLocalRow(cell);
		const localCol = toLocalCol(cell);
		const result = this.session.beginDragFromBoard(localRow, localCol);
		if (result.isAccepted === false || result.crystalId === undefined) {
			return;
		}

		const placed = this.session.board?.placedCrystals
			.find((candidate) => candidate.id === result.crystalId);

		this._dragCrystalId = result.crystalId;
		this._dragSlot = undefined;
		// 집어 든 칸이 아니라 크리스탈이 실제로 놓여 있던 칸이다 - 히트박스 보정 때문에
		// 손가락이 닿은 칸과 한 칸 어긋날 수 있고, 실루엣은 크리스탈 자리에 남아야 한다 (§8 히트박스 보정)
		this._dragSourceRow = placed?.row ?? localRow;
		this._dragSourceCol = placed?.col ?? localCol;
		this._dragRow = this._dragSourceRow;
		this._dragCol = this._dragSourceCol;
		// 집자마자는 제자리이므로 언제나 놓을 수 있다
		this._isDropValid = true;
		this.applyBoardVisuals();
	}

	/** 트레이의 인벤토리 슬롯을 집었다 - 이후 이동·놓기는 필드에서 집은 것과 똑같다 */
	private onInventoryPick(slot: number): void {
		const crystal = this.getInventoryCrystal(slot);
		if (crystal === undefined) {
			return;
		}
		const result = this.session.beginDragFromInventory(crystal.id);
		if (result.isAccepted === false) {
			return;
		}

		this._dragCrystalId = crystal.id;
		this._dragSlot = slot;
		this._dragSourceRow = undefined;
		this._dragSourceCol = undefined;
		// 아직 판 위가 아니다. 트레이 슬롯만 실루엣으로 바뀐다
		this._dragRow = undefined;
		this._dragCol = undefined;
		this._isDropValid = false;
		this.applyBoardVisuals();
	}

	/**
	 * 손가락이 다른 칸으로 들어왔다 - 크리스탈이 그 칸으로 따라온다.
	 *
	 * 세션이 돌려주는 미리보기 상태에는 "지금 놓아도 되는지" 가 들어 있다 (§3 3.4).
	 * 그것을 그대로 테두리 색으로 옮겨, 손을 떼기 전에 결과를 알 수 있게 한다.
	 */
	private onDragMove(cell: number): void {
		// 칸 사이를 스쳐 지나가는 순간의 "판 밖" 은 무시한다.
		// 그대로 반영하면 끌고 있던 크리스탈이 한 프레임 사라졌다 나타나 깜빡인다.
		// 진짜로 판 밖에 놓았는지는 손을 뗄 때(`onDragEnd`) 뗀 칸으로 판정한다.
		if (cell === PUZZLE_BOARD_CELL_OUTSIDE) {
			return;
		}
		this.trackDragTo(cell);
	}

	/**
	 * 손가락이 올라간 칸을 미리보기에 반영한다. 실제로 바뀐 경우에만 다시 그린다.
	 *
	 * **바뀌지 않았는데 다시 그리면 안 된다.** `applyBoardVisuals()` 는 바탕 49칸을 다시
	 * 칠하고 광선 구간을 전부 되짚는다. 드래그 중에는 보드가 그대로라 광선도 그대로인데,
	 * 손가락이 한 칸 안에서 움직일 때마다 그것을 돌리면 조작이 무겁게 느껴진다.
	 */
	private trackDragTo(cell: number): void {
		const visual = this.session.updateDrag(toLocalRow(cell), toLocalCol(cell));
		if (this._dragCrystalId === undefined) {
			return;
		}

		const row = visual?.targetRow;
		const col = visual?.targetCol;
		const isValid = visual?.isValidTarget ?? false;
		if (row === this._dragRow && col === this._dragCol && isValid === this._isDropValid) {
			return;
		}

		const previousRow = this._dragRow;
		const previousCol = this._dragCol;
		this._dragRow = row;
		this._dragCol = col;
		this._isDropValid = isValid;
		this.applyDragTransitionVisuals(previousRow, previousCol);
	}

	/**
	 * 드래그 미리보기가 한 칸 옮겨졌다 - **바뀔 수 있는 칸만** 다시 기록한다 (방법론 §4.2).
	 *
	 * 이전 미리보기 칸(바탕·광선·오브젝트로 복원된다)과 새 미리보기 칸(크리스탈이 온다)
	 * 둘만 바뀐다. 예전에는 전환마다 49칸 바탕 + 광선 + 기믹 + 크리스탈 + 인벤토리를
	 * 전부 훑어 칸당 패치 객체를 만들었다.
	 */
	private applyDragTransitionVisuals(previousRow: number | undefined, previousCol: number | undefined): void {
		this._dirtyCells.clear();
		if (previousRow !== undefined && previousCol !== undefined) {
			// 배치 로컬(0..4) -> 전체 그리드(1..5). applyDragVisuals 와 같은 변환이다
			this._dirtyCells.add((previousRow + 1) * BOARD_COL_COUNT + (previousCol + 1));
		}
		if (this._dragRow !== undefined && this._dragCol !== undefined) {
			this._dirtyCells.add((this._dragRow + 1) * BOARD_COL_COUNT + (this._dragCol + 1));
		}
		if (this._dirtyCells.size === 0) {
			return;
		}
		this._repaintFilter = this._dirtyCells;
		this.applyBoardVisuals();
		this._repaintFilter = undefined;
	}

	/**
	 * 손을 뗐다 - 크리스탈은 **뗀 자리에** 놓인다.
	 *
	 * 뗀 칸을 마지막으로 한 번 더 반영한 뒤 확정한다. `onCellMove` 없이 곧바로 떼는
	 * 짧은 탭에서도 목적지가 정확해진다.
	 */
	private onDragEnd(cell: number): void {
		this.trackDragTo(cell);
		this.session.endDrag();
		this.clearDragState();
		// 배치가 거절되어 광선 재계산 이벤트가 오지 않는 경우에도 강조는 지워져야 한다
		this.applyBoardVisuals();
	}

	/** 드래그 강조를 모두 걷어낸다. 손을 뗄 때·일시정지·레벨 전환에서 부른다 */
	private clearDragState(): void {
		this._dragCrystalId = undefined;
		this._dragSlot = undefined;
		this._dragSourceRow = undefined;
		this._dragSourceCol = undefined;
		this._dragRow = undefined;
		this._dragCol = undefined;
		this._isDropValid = false;
	}

	private getInventoryCrystal(slot: number): LaserCrystal | undefined {
		const inventory = this.session.board?.inventory;
		if (inventory === undefined) {
			return undefined;
		}
		return inventory[slot];
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
		this.clearDragState();
		this._presenter.setInputEnabled(false);
		// 허브의 일시정지 오버레이가 화면을 덮어야 하므로 보드를 내린다 (§ 화면 겹침)
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
		this.clearDragState();
		this._presenter.setInputEnabled(false);
		PuzzleBoardStage.instance.unmount(this._presenter);
		this.releaseInteraction();
	}

	/** 놓은 크리스탈을 전부 회수한다 - 리셋 버튼 */
	public resetPlacements(): void {
		this.session.resetPlacements();
		this.applyBoardVisuals();
	}

	//#endregion

	//#region Presentation (세션 이벤트 -> 보드 프레젠터)

	private subscribeToSessionEvents(): void {
		this.events.LEVEL_LOADED.subscribe(this.onLevelLoaded.bind(this));

		// §8.2 - 배치가 바뀔 때마다 광선이 다시 계산되어 이 이벤트로 온다.
		// 배치·인벤토리·광선이 한꺼번에 바뀌므로 이 한 곳에서 전체를 다시 그린다.
		this.events.BEAM_UPDATED.subscribe(this.onBeamUpdated.bind(this));

		this.events.PLACEMENT_REJECTED.subscribe((payload) => {
			console.log(`[LaserCoreAPI] Placement rejected for ${payload.crystalId}: ${payload.reason}`);
		});
		this.events.SKULL_HIT.subscribe(() => {
			console.log('[LaserCoreAPI] Beam hit a skull. All receivers are in Fault.');
		});

		this.events.QUEST_CLEAR.subscribe(this.onQuestEnd.bind(this));
		this.events.QUEST_FAILED.subscribe(this.onQuestEnd.bind(this));
	}

	private onLevelLoaded(level: LaserLevel): void {
		this.clearDragState();
		if (level.inventory.length > INVENTORY_SLOT_COUNT) {
			// 화면에 그리지 못하는 슬롯이 생기면 그 크리스탈은 영영 집을 수 없다.
			// 조용히 사라지면 원인을 찾기 어려우므로 반드시 남긴다.
			console.warn(`[LaserCoreAPI] Inventory has ${level.inventory.length} crystals `
				+ `but only ${INVENTORY_SLOT_COUNT} slots are drawn. Extra crystals cannot be picked up.`);
		}

		this.applyBoardVisuals();

		PuzzleBoardStage.instance.mount(this._presenter);
		this._presenter.setInputEnabled(true);

		console.log(`[LaserCoreAPI] Level loaded: ${level.gimmicks.length} gimmicks, `
			+ `${level.presetCrystals.length} preset crystals, ${level.inventory.length} in inventory.`);
	}

	private onBeamUpdated(trace: LaserTraceResult): void {
		this.applyBoardVisuals(trace);
	}

	private onQuestEnd(result: LaserResultData): void {
		this.clearDragState();
		// 허브의 결과 화면이 화면을 덮어야 하므로 보드를 내린다.
		// BoardPanel 과 HubPanel 은 서로 다른 gizmo 라 z-order 를 코드가 정할 수 없다.
		// 한 번에 하나만 그리게 두면 어느 쪽이 위든 결과 화면이 확실히 보인다.
		this._presenter.setInputEnabled(false);
		PuzzleBoardStage.instance.unmount(this._presenter);
		console.log(`[LaserCoreAPI] Quest ended: ${result.result} (${result.remainingTimeSeconds}s remaining)`);
	}

	/**
	 * 격자 전체를 다시 칠한다.
	 *
	 * 바탕 -> 광선 -> 오브젝트 -> 인벤토리 순서로 덮어쓴다.
	 * 광선을 오브젝트보다 먼저 칠해야 발사체·수신체가 광선에 가려지지 않는다.
	 */
	private applyBoardVisuals(trace?: LaserTraceResult): void {
		const board = this.session.board;
		if (board === undefined) {
			return;
		}
		const beams = trace ?? this.session.lastTrace;

		this.applyBackground();
		if (beams !== undefined) {
			this.applyBeamVisuals(beams);
		}
		this.applyGimmickVisuals(beams);
		this.applyCrystalVisuals();
		// 끌고 있는 크리스탈은 모든 것 위에 그린다 - 광선이나 기믹에 가려지면 안 된다
		this.applyDragVisuals();
		// 더티 필터는 판의 칸만 다루므로, 필터가 걸린 전환에서는 트레이를 건너뛴다
		// (드래그 중 인벤토리는 바뀌지 않는다)
		if (this._repaintFilter === undefined) {
			this.applyInventoryVisuals();
		}
	}

	/**
	 * 끌고 있는 크리스탈을 손가락이 올라간 칸에 그린다.
	 *
	 * `Pressable` 은 좌표를 주지 않으므로 크리스탈은 **칸 단위로** 따라온다. 그래도 집는 순간
	 * 크리스탈이 손가락에 달라붙고 옮겨 다니는 것이 보이므로, 무엇을 어디에 놓으려는지
	 * 손을 떼기 전에 알 수 있다. 놓을 수 없는 칸이면 테두리가 빨강으로 바뀐다 (§3 3.4).
	 */
	private applyDragVisuals(): void {
		const crystalId = this._dragCrystalId;
		if (crystalId === undefined) {
			return;
		}

		const crystal = this.findDraggedCrystal(crystalId);
		if (crystal === undefined) {
			return;
		}

		const row = this._dragRow;
		const col = this._dragCol;
		if (row === undefined || col === undefined) {
			// 아직 판 밖이다 - 트레이 슬롯의 실루엣만으로 집었다는 것을 알린다
			return;
		}

		// 배치 로컬(0..4) -> 전체 그리드(1..5)
		this.setCell(row + 1, col + 1, {
			fill: COLOR_CRYSTAL,
			texture: TEXTURE_CRYSTAL,
			label: getCrystalLabel(crystal),
			labelColor: COLOR_LABEL_DARK,
			isHighlighted: false,
			accent: this._isDropValid ? EBoardCellAccent.GRABBED : EBoardCellAccent.DROP_INVALID,
			glyph: getCrystalGlyph(crystal),
		});
	}

	/** 끌고 있는 크리스탈은 인벤토리에 있을 수도, 아직 필드에 놓인 채일 수도 있다 */
	private findDraggedCrystal(crystalId: string): LaserCrystal | undefined {
		const board = this.session.board;
		if (board === undefined) {
			return undefined;
		}
		const placed = board.placedCrystals.find((candidate) => candidate.id === crystalId);
		if (placed !== undefined) {
			return placed;
		}
		return board.inventory.find((candidate) => candidate.id === crystalId);
	}

	private applyBackground(): void {
		for (let row = 0; row < LASER_FULL_GRID_SIZE; row++) {
			for (let col = 0; col < LASER_FULL_GRID_SIZE; col++) {
				// 더티 필터가 걸려 있으면 그 칸만 기록한다 - 패치 객체를 만들기 전에 거른다 (§4.4)
				if (this._repaintFilter !== undefined
					&& this._repaintFilter.has(row * BOARD_COL_COUNT + col) === false) {
					continue;
				}
				const isPlacement = isInsidePlacementArea(toPlacementLocalIndex(row), toPlacementLocalIndex(col));
				this.setCell(row, col, {
					fill: isPlacement ? COLOR_PLACEMENT : COLOR_BORDER,
					texture: isPlacement ? TEXTURE_PLACEMENT : TEXTURE_BORDER,
					label: '',
					// 인터랙션 규격: 빈 바탕·테두리는 정적이다. 만질 수 있는 것은
					// 트레이에서 스폰된 크리스탈뿐이다 (applyCrystalVisuals 가 다시 켠다).
					isInteractive: false,
					isHighlighted: false,
					// 앞 프레임의 강조를 지운다. 지우지 않으면 손을 뗀 뒤에도 실루엣이 남는다
					accent: EBoardCellAccent.NONE,
				});
			}
		}
	}

	/** 광선이 지나간 칸을 그 색으로 옅게 칠한다 - §8.2 재계산 결과를 그대로 반영한다 */
	private applyBeamVisuals(trace: LaserTraceResult): void {
		for (const segment of trace.segments) {
			const tint = toneColor(getLaserColor(segment.color), BEAM_TONE_SCALE);
			const delta = getDirectionDelta(segment.direction);
			let row = segment.from.row;
			let col = segment.from.col;

			for (let step = 0; step <= MAX_SEGMENT_STEPS; step++) {
				// 더티 필터가 걸려 있으면 그 칸만 기록한다 - 패치 객체를 만들기 전에 거른다 (§4.4)
				if (this._repaintFilter === undefined
					|| this._repaintFilter.has(row * BOARD_COL_COUNT + col)) {
					this.setCell(row, col, { fill: tint, label: '', isHighlighted: false });
				}
				if (row === segment.to.row && col === segment.to.col) {
					break;
				}
				row += delta.row;
				col += delta.col;
			}
		}
	}

	private applyGimmickVisuals(trace: LaserTraceResult | undefined): void {
		for (const gimmick of this.session.board?.gimmicks ?? []) {
			const state = trace?.objectStates.get(gimmick.id);
			this.setCell(gimmick.row, gimmick.col, {
				fill: getGimmickColor(gimmick.type, gimmick.colors, state),
				texture: getGimmickTexture(gimmick.type),
				label: getGimmickLabel(gimmick.type, gimmick.crystal),
				labelColor: gimmick.type === EGimmickType.RELAY ? COLOR_LABEL_DARK : COLOR_LABEL,
				// 인터랙션 규격: 발사체·수신체·중계체 등 판에서 생성된 오브젝트는 정적이다
				isInteractive: false,
				// On 이 된 수신체·경유된 중계체를 테두리로 알린다 - PUZ_00 §5
				isHighlighted: state === EObjectState.ON,
				// 고정 크리스탈도 방향이 있다 - 유저가 옥길 수 없을 뿐 동작은 같다 (§4.3)
				glyph: gimmick.crystal === undefined ? EBoardCellGlyph.NONE : getCrystalGlyph(gimmick.crystal),
			});
		}
	}

	private applyCrystalVisuals(): void {
		for (const placed of this.session.board?.placedCrystals ?? []) {
			// 집어 든 크리스탈이 원래 있던 칸에는 실루엣만 남긴다.
			// 보드는 손을 뗄 때까지 크리스탈을 그 자리에 두므로, 이렇게 하지 않으면
			// 크리스탈이 원래 자리와 손가락 아래에 둘로 보인다 (§3 3.3).
			const isSource = placed.id === this._dragCrystalId;
			this.setCell(placed.row + 1, placed.col + 1, {
				fill: placed.isFixed ? COLOR_FIXED_CRYSTAL : COLOR_CRYSTAL,
				texture: placed.isFixed ? TEXTURE_FIXED_CRYSTAL : TEXTURE_CRYSTAL,
				label: isSource ? '' : getCrystalLabel(placed),
				labelColor: COLOR_LABEL_DARK,
				// 인터랙션 규격: 트레이에서 스폰된(옮길 수 있는) 크리스탈만 만질 수 있다.
				// 판에서 생성된 고정 크리스탈은 정적이다.
				isInteractive: placed.isFixed === false,
				isHighlighted: false,
				accent: isSource ? EBoardCellAccent.GHOST : EBoardCellAccent.NONE,
				glyph: isSource ? EBoardCellGlyph.NONE : getCrystalGlyph(placed),
			});
		}
	}

	private applyInventoryVisuals(): void {
		const inventory = this.session.board?.inventory ?? [];
		for (let slot = 0; slot < INVENTORY_SLOT_COUNT; slot++) {
			const crystal = inventory[slot];

			if (crystal === undefined) {
				// 빈 슬롯은 그리지 않는다 - 집을 것이 없으므로 눌릴 필요도 없다
				this._presenter.setItem(slot, {
					isVisible: false,
					fill: COLOR_INVENTORY_EMPTY,
					texture: NO_TEXTURE,
					label: '',
					caption: '',
					accent: EBoardCellAccent.NONE,
					glyph: EBoardCellGlyph.NONE,
				});
				continue;
			}

			// 트레이에서 집어 판으로 끌고 가는 동안 슬롯은 실루엣이 되어 "꺼냈다" 가 보인다
			const isSource = slot === this._dragSlot;
			this._presenter.setItem(slot, {
				isVisible: true,
				fill: COLOR_CRYSTAL,
				texture: TEXTURE_CRYSTAL,
				label: getCrystalLabel(crystal),
				labelColor: COLOR_LABEL_DARK,
				caption: '',
				isHighlighted: false,
				accent: isSource ? EBoardCellAccent.GHOST : EBoardCellAccent.NONE,
				// 판 위와 같은 무늬를 트레이에도 그린다 - 집기 전에 방향을 고를 수 있게
				glyph: getCrystalGlyph(crystal),
			});
		}
	}

	/** 전체 그리드 좌표로 칸 하나를 칠한다 */
	private setCell(row: number, col: number, patch: {
		fill: PuzzleBoardColor,
		/** 생략하면 바탕에서 칠해 둔 그림이 그대로 남는다 (광선 구간이 그 경우다) */
		texture?: PuzzleTextureKey,
		label: string,
		labelColor?: PuzzleBoardColor,
		/** 생략하면 바탕에서 정한 값이 그대로 남는다 (광선 구간이 그 경우다) */
		isInteractive?: boolean,
		isHighlighted: boolean,
		accent?: EBoardCellAccent,
		glyph?: EBoardCellGlyph,
	}): void {
		if (row < 0 || row >= LASER_FULL_GRID_SIZE || col < 0 || col >= LASER_FULL_GRID_SIZE) {
			return;
		}
		// 더티 필터가 걸려 있으면 그 칸만 기록한다 (applyDragTransitionVisuals 주석)
		if (this._repaintFilter !== undefined
			&& this._repaintFilter.has(row * BOARD_COL_COUNT + col) === false) {
			return;
		}
		this._presenter.setCell(row * BOARD_COL_COUNT + col, {
			isVisible: true,
			fill: patch.fill,
			texture: patch.texture,
			label: patch.label,
			labelColor: patch.labelColor ?? COLOR_LABEL,
			isInteractive: patch.isInteractive,
			isHighlighted: patch.isHighlighted,
			accent: patch.accent ?? EBoardCellAccent.NONE,
			// 지정하지 않은 칸은 무늬를 지운다 - 앞 프레임의 크리스탈 무늬가 남지 않게
			glyph: patch.glyph ?? EBoardCellGlyph.NONE,
		});
	}

	//#endregion
}

//#region Cell <-> coordinate helpers

function toRow(cell: number): number {
	return Math.floor(cell / BOARD_COL_COUNT);
}

function toCol(cell: number): number {
	return cell % BOARD_COL_COUNT;
}

/**
 * 칸 번호 -> 배치 로컬 행.
 * 격자 밖이면 배치 영역 밖(-1)을 돌려준다 - 거기에 놓으면 인벤토리로 회수된다 (§3 3.3).
 */
function toLocalRow(cell: number): number {
	if (isBoardCell(cell) === false) {
		return OUTSIDE_LOCAL_INDEX;
	}
	return toPlacementLocalIndex(toRow(cell));
}

function toLocalCol(cell: number): number {
	if (isBoardCell(cell) === false) {
		return OUTSIDE_LOCAL_INDEX;
	}
	return toPlacementLocalIndex(toCol(cell));
}

/** 전체 그리드 7×7 안의 칸인지 (격자 밖은 아니다) */
function isBoardCell(cell: number): boolean {
	return cell !== PUZZLE_BOARD_CELL_OUTSIDE && toCol(cell) < LASER_FULL_GRID_SIZE;
}

//#endregion

//#region Colour / label helpers

function getLaserColor(color: ELaserColor): PuzzleBoardColor {
	return LASER_COLORS[color] ?? LASER_COLORS.RED;
}

function toneColor(color: PuzzleBoardColor, scale: number): PuzzleBoardColor {
	return boardColor(color.r * scale, color.g * scale, color.b * scale);
}

/**
 * 기믹 색 - PUZ_00 §5 의 On/Off/Fault 를 밝기와 색으로 나타낸다.
 * 발사체·수신체는 자기 색을 쓰고, 색이 없는 기믹은 고유색을 쓴다.
 */
/**
 * 기믹의 그림.
 *
 * 발사체·수신체는 같은 그림을 쓰고 색으로 갈린다 (§5.1 - 둘 다 테두리에만 서고,
 * 켜짐/꺼짐은 색이 알린다). 중계체와 해골만 따로 둔다.
 */
function getGimmickTexture(type: EGimmickType): PuzzleTextureKey {
	if (type === EGimmickType.RELAY) {
		return TEXTURE_RELAY;
	}
	if (type === EGimmickType.SKULL) {
		return TEXTURE_SKULL;
	}
	return TEXTURE_GIMMICK;
}

function getGimmickColor(type: EGimmickType, colors: ELaserColor[], state: EObjectState | undefined): PuzzleBoardColor {
	if (type === EGimmickType.SKULL) {
		return COLOR_SKULL;
	}
	if (type === EGimmickType.FIXED_CRYSTAL) {
		return COLOR_FIXED_CRYSTAL;
	}
	if (type === EGimmickType.RELAY) {
		return state === EObjectState.ON ? COLOR_RELAY : toneColor(COLOR_RELAY, OFF_TONE_SCALE);
	}

	const base = colors.length > 0 ? getLaserColor(colors[0]) : COLOR_CRYSTAL;
	if (type === EGimmickType.EMITTER) {
		// 발사체는 언제나 쏘고 있으므로 항상 밝다
		return base;
	}
	// 수신체 - Fault 는 해골에 닿았다는 뜻이라 해골색으로 덮는다 (§3 4.2.1)
	if (state === EObjectState.FAULT) {
		return COLOR_SKULL;
	}
	return state === EObjectState.ON ? base : toneColor(base, OFF_TONE_SCALE);
}

function getGimmickLabel(type: EGimmickType, crystal: LaserCrystal | undefined): string {
	if (type === EGimmickType.EMITTER) {
		return 'E';
	}
	if (type === EGimmickType.RECEIVER) {
		return 'R';
	}
	if (type === EGimmickType.RELAY) {
		return 'C';
	}
	if (type === EGimmickType.SKULL) {
		// 팔각 크리스탈이 `X` 를 가져갔으므로 해골은 경고 부호를 쓴다
		return '!';
	}
	return crystal === undefined ? '' : getCrystalLabel(crystal);
}

/**
 * 크리스탈 라벨 - 종류를 한 글자로 나타낸다 (§4.1).
 *
 * **방향은 라벨이 아니라 무늬(`getCrystalGlyph`)가 알린다.**
 * 그래서 글자는 그 무늬가 돌려 그리는 **기준 모양**으로 고른다.
 *   `L` 직각 삼각형 - 두 획이 곧 광선을 되돌리는 두 평면이다
 *   `T` T자       - 크로스바 쪽이 막힌 변이다
 *   `X` 팔각       - 대각 4방향 분배
 *   `+` 십자       - 직각 4방향 분배
 *   `O` 꽃         - 모든 방향 흡수 (닫힌 고리)
 *
 * 예전에는 삼각형을 빗금 두 종류로만 그렸는데, 거울 기울기가 같고 직각 코너만 다른
 * 두 크리스탈(예: 좌하단/우상단)이 화면에서 똑같았다. 지금은 무늬가 그것을 가른다.
 */
function getCrystalLabel(crystal: LaserCrystal): string {
	if (crystal.type === ECrystalType.TRIANGLE) {
		return 'L';
	}
	if (crystal.type === ECrystalType.OCTAGON) {
		return 'X';
	}
	if (crystal.type === ECrystalType.CROSS) {
		return '+';
	}
	if (crystal.type === ECrystalType.TEE) {
		return 'T';
	}
	return 'O';
}

/**
 * 크리스탈 무늬 - **방향을 화면에 드러내는 부분**이다 (§4.1).
 *
 * 보드 패널은 이 값을 받아 **광선을 되돌리는 변에 두꺼운 테두리를 그리고**
 * 칸의 글자를 그만큼 돌려 그린다 (`PuzzleBoardUI_Definitions` 의 `EBoardCellGlyph` 주석).
 * 이것이 "어떤 게 아래만 반사되고 어떤 게 위만 반사되는지" 를 가르는 유일한 표시다.
 */
function getCrystalGlyph(crystal: LaserCrystal): EBoardCellGlyph {
	if (crystal.type === ECrystalType.TRIANGLE) {
		switch (crystal.corner ?? ETriangleCorner.BOTTOM_LEFT) {
			case ETriangleCorner.TOP_LEFT: return EBoardCellGlyph.CORNER_TOP_LEFT;
			case ETriangleCorner.TOP_RIGHT: return EBoardCellGlyph.CORNER_TOP_RIGHT;
			case ETriangleCorner.BOTTOM_RIGHT: return EBoardCellGlyph.CORNER_BOTTOM_RIGHT;
			default: return EBoardCellGlyph.CORNER_BOTTOM_LEFT;
		}
	}
	if (crystal.type === ECrystalType.TEE) {
		switch (crystal.blockedSide ?? ETeeBlockedSide.BLOCKED_DOWN) {
			case ETeeBlockedSide.BLOCKED_UP: return EBoardCellGlyph.BLOCKED_UP;
			case ETeeBlockedSide.BLOCKED_LEFT: return EBoardCellGlyph.BLOCKED_LEFT;
			case ETeeBlockedSide.BLOCKED_RIGHT: return EBoardCellGlyph.BLOCKED_RIGHT;
			default: return EBoardCellGlyph.BLOCKED_DOWN;
		}
	}
	// 팔각·십자·꽃은 입사 방향과 무관하게 동작하므로 방향 무늬가 없다
	return EBoardCellGlyph.NONE;
}

//#endregion

Component.register(LaserCoreAPI);
