/**
 * Color Sort Core API - PUZ_03 정렬 퍼즐을 실제 월드에서 구동하는 Horizon Component
 *
 * `Switch_CoreAPI` 와 같은 구조다. 브리지·보드 UI·소유권 컴포넌트는 그대로 재사용한다
 * (`Documents/생성 문서/구현 사항/작업기록_2026-09-02_보드_CustomUI_전환.md` §6.3).
 *
 * ## 케이스 배열을 격자에 얹는 법
 *
 * 이 퍼즐의 모델은 격자가 아니라 **케이스 8개의 스택**이다 (§3). 그래서
 * **한 열 = 한 케이스**로 얹는다. 열 수는 케이스 수(8), 행 수는 케이스 용량(4)이다.
 *
 *      col  0  1  2  3  4  5  6  7      <- 케이스 index
 *      row0 [ 최상단(top) 자리 ]
 *      row1
 *      row2
 *      row3 [ 바닥 자리 ]
 *
 * 스택은 배열 마지막이 최상단이므로 `row = 용량 - 1 - 스택index` 로 뒤집어 그린다.
 * 위로 쌓이는 그림이 되어 그랩/드랍 위치와 눈에 보이는 위치가 일치한다.
 *
 * ## 조작
 *
 * 드래그 앤 드롭이다 (§6). 칸 번호에서 열만 꺼내면 곧 케이스 index 이므로,
 * 세션의 `beginDrag / hoverDrag / endDrag` 에 그대로 넘긴다.
 * 격자 밖에서 손을 떼면 `endDrag(undefined)` 가 되어 §8 의 영역 밖 드랍(리스폰 대기)이 된다.
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
import { EBoardCellAccent, NO_TEXTURE, PUZZLE_BOARD_CELL_OUTSIDE, PuzzleBoardColor, PuzzleTextureKey, boardColor, textureKey } from 'PuzzleBoardUI_Definitions';
import { PuzzleTextureLibrary } from 'PuzzleBoardUI_TextureLibrary';
import { PuzzleBoardPresenter, PuzzleBoardStage } from 'PuzzleBoardUI_Presenter';
import { ColorSortLevelGenerator } from 'ColorSort_LevelGenerator';
import { ColorSortEvents } from 'ColorSort_GameEvents';
import { ColorSortTables } from 'ColorSort_DataTables';
import { ColorSortSession } from 'ColorSort_Session';
import {
	Battery,
	CASE_CAPACITY,
	ColorSortLevel,
	ColorSortResultData,
	EBatteryColor,
	ECaseState,
	TOTAL_CASE_COUNT,
} from 'ColorSort_Definitions';

/** 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - SWITCH_READY 와 같은 규약 */
export const COLOR_SORT_READY = new EventPublisher<ColorSortCoreAPI>();

/** §5 - 건전지 색상 10종. 실제 머티리얼이 들어오면 이 표만 바꾸면 된다 */
const BATTERY_COLORS: { [color: string]: PuzzleBoardColor } = {
	RED: boardColor(0.88, 0.2, 0.2),
	ORANGE: boardColor(0.95, 0.55, 0.15),
	YELLOW: boardColor(0.93, 0.86, 0.2),
	GREEN: boardColor(0.25, 0.75, 0.3),
	CYAN: boardColor(0.2, 0.8, 0.8),
	BLUE: boardColor(0.25, 0.45, 0.9),
	PURPLE: boardColor(0.6, 0.35, 0.85),
	PINK: boardColor(0.95, 0.5, 0.72),
	BROWN: boardColor(0.55, 0.38, 0.24),
	GRAY: boardColor(0.6, 0.62, 0.66),
};

/** §7 - 아직 공개되지 않은 블랙 건전지. 색을 숨기고 `?` 만 보인다 */
const COLOR_UNKNOWN: PuzzleBoardColor = boardColor(0.1, 0.1, 0.12);
/** 케이스의 빈 자리. 드랍 대상이므로 반드시 그린다 (보이지 않는 칸은 눌리지 않는다) */
const COLOR_EMPTY_SLOT: PuzzleBoardColor = boardColor(0.17, 0.18, 0.23);
/** §8 - 리스폰 대기로 잠긴 케이스의 빈 자리 */
const COLOR_LOCKED_SLOT: PuzzleBoardColor = boardColor(0.28, 0.2, 0.2);

const COLOR_LABEL: PuzzleBoardColor = boardColor(1, 1, 1);

/** §7 - 미공개 건전지의 라벨 */
const UNKNOWN_LABEL = '?';

/**
 * 이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
 * 에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.
 */
/** 배터리 */
const TEXTURE_BATTERY: PuzzleTextureKey = textureKey('colorSort', 'battery');
/** 아직 색을 모르는 배터리 */
const TEXTURE_UNKNOWN: PuzzleTextureKey = textureKey('colorSort', 'unknown');
/** 빈 칸 */
const TEXTURE_EMPTY_SLOT: PuzzleTextureKey = textureKey('colorSort', 'emptySlot');
/** 닫힌 케이스 */
const TEXTURE_LOCKED_SLOT: PuzzleTextureKey = textureKey('colorSort', 'lockedSlot');
/** 격자 뒤에 까는 판 그림 */
const TEXTURE_BOARD: PuzzleTextureKey = textureKey('colorSort', 'board');

export class ColorSortCoreAPI extends Component<typeof ColorSortCoreAPI> {
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
		/** 배터리 */
		batteryTexture: { type: PropTypes.Asset },
		/** 아직 색을 모르는 배터리 */
		unknownTexture: { type: PropTypes.Asset },
		/** 빈 칸 */
		emptySlotTexture: { type: PropTypes.Asset },
		/** 닫힌 케이스 */
		lockedSlotTexture: { type: PropTypes.Asset },
		/** 격자 뒤에 까는 판 그림 */
		boardTexture: { type: PropTypes.Asset },
	};

	public static instance: ColorSortCoreAPI | undefined = undefined;

	public events!: ColorSortEvents;
	public session!: ColorSortSession;
	public tables!: ColorSortTables;

	private _presenter!: PuzzleBoardPresenter;

	/**
	 * 지금 집어 든 건전지들. 보드는 손을 뗄 때까지 이들을 출발 케이스에 그대로 두므로 (§8),
	 * 이것을 들고 있지 않으면 드래그하는 동안 화면이 전혀 바뀌지 않는다.
	 *
	 * 배열 순서는 스택 순서 그대로다 - 0 번이 아래, 마지막이 맨 위.
	 */
	private _dragBatteries: Battery[] = [];
	/** 집어 든 케이스. 드래그 중이 아니면 undefined */
	private _dragFromCase: number | undefined = undefined;
	/** 손가락이 올라가 있는 케이스. 영역 밖이면 undefined */
	private _hoverCase: number | undefined = undefined;
	/** 지금 놓아도 되는 자리인지 - 초록/빨강 테두리를 가른다 */
	private _isDropValid: boolean = false;

	private _isInteractionActive: boolean = false;

	//#region Lifecycle

	public start(): void {
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			console.log('[ColorSortCoreAPI] Server instance. Waiting for ownership transfer. '
				+ '(If only this log appears without the "local start" log, set the script execution mode to Local '
				+ 'and make sure this entity is in Puzzle_LocalOwnership targets.)');
			return;
		}

		console.log('[ColorSortCoreAPI] Started on the local client. Ownership transfer OK.');

		this.constructSystems();

		if (this.props.autoStart) {
			this.startQuestByDifficulty(this.props.difficulty);
		}
	}

	public dispose(): void {
		PuzzleBoardStage.instance.unmount(this._presenter);
		this.releaseInteraction();
		if (ColorSortCoreAPI.instance === this) {
			ColorSortCoreAPI.instance = undefined;
		}
	}

	private constructSystems(): void {
		this.tables = new ColorSortTables();
		this.events = new ColorSortEvents();
		this.session = new ColorSortSession(
			this.events,
			this.tables,
			new ColorSortLevelGenerator(this.tables),
			// 솔버는 힌트(getHintStep)에만 쓰이므로 세션의 기본 인스턴스를 그대로 둔다
			undefined,
			{ seed: this.props.seed > 0 ? this.props.seed : undefined },
		);

		this.registerTextures();
		this.createPresenter();
		this.subscribeToSessionEvents();

		// 이것을 빠뜨리면 제한 시간이 흐르지 않고 §8 의 리스폰 대기(2초)도 풀리지 않는다
		connectPuzzleUpdate(this, (deltaSeconds) => this.session.update(deltaSeconds));

		PuzzleHubRegistry.instance.register(createPuzzleHandle(
			EPuzzleId.COLOR_SORT,
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

		ColorSortCoreAPI.instance = this;
		COLOR_SORT_READY.publish(this);
	}

	/**
	 * 에디터 prop 의 텍스처 애셋을 키에 붙인다.
	 *
	 * **프레젠터를 만들기 전에** 부른다. 순서가 뒤집혀도 패널이 세대를 올려 다시 그리지만,
	 * 먼저 등록해 두면 첫 프레임부터 그림이 붙는다.
	 */
	private registerTextures(): void {
		const count = PuzzleTextureLibrary.instance.registerAll([
			{ key: TEXTURE_BATTERY, asset: this.props.batteryTexture },
			{ key: TEXTURE_UNKNOWN, asset: this.props.unknownTexture },
			{ key: TEXTURE_EMPTY_SLOT, asset: this.props.emptySlotTexture },
			{ key: TEXTURE_LOCKED_SLOT, asset: this.props.lockedSlotTexture },
			{ key: TEXTURE_BOARD, asset: this.props.boardTexture },
		]);
		console.log(`[ColorSortCoreAPI] Registered ${count} textures. `
			+ 'Elements without one are drawn with a flat colour.');
	}

	/**
	 * 지금 판이 실제로 쓰는 케이스 수 (= 격자의 열 수).
	 *
	 * 테이블은 케이스를 언제나 `TOTAL_CASE_COUNT` 개 만들고 **앞에서부터** 활성으로
	 * 표시한다(`createCases`). 예전에는 격자를 8열로 고정해 두고 남는 열을 숨겼는데,
	 * 숨긴 열이 오른쪽에 몰려 **판이 왼쪽으로 치우쳐 보였다** (worker/NextJob.md 1번).
	 * 이제 격자를 활성 케이스 수만큼만 만든다 - 격자 자체가 가운데 정렬이므로 판도 가운데 온다.
	 */
	private _caseCount: number = TOTAL_CASE_COUNT;

	private createPresenter(): void {
		this._presenter = new PuzzleBoardPresenter(
			{
				title: getCatalogEntry(EPuzzleId.COLOR_SORT)?.displayName ?? '',
				rowCount: CASE_CAPACITY,
				colCount: TOTAL_CASE_COUNT,
				boardTexture: TEXTURE_BOARD,
			},
			{
				// 열 번호가 곧 케이스 index 다. 세로 어디를 잡아도 최상단부터 집는다 (§6).
				onCellDown: (cell) => { this.onDragBegin(this.toCaseIndex(cell)); },
				onCellMove: (cell) => { this.onDragMove(this.toCaseIndexOrUndefined(cell)); },
				// 격자 밖에서 떼면 undefined -> §8 영역 밖 드랍(리스폰 대기)
				onCellUp: (cell) => { this.onDragEnd(this.toCaseIndexOrUndefined(cell)); },
				// 보조 레이아웃의 Reset 버튼 - 판만 되돌리고 남은 시간은 그대로 둔다
				onReset: () => { this.resetLevel(); },
			},
		);
	}

	/**
	 * 격자의 열 수를 **활성 케이스 수**에 맞춘다.
	 *
	 * 이것이 판을 가로 가운데로 오게 하는 전부다. 격자는 보드 영역 안에서 가운데 정렬되므로,
	 * 쓰지 않는 열을 아예 만들지 않으면 남는 자리가 좌우로 똑같이 나뉜다.
	 */
	private resizeGridToActiveCases(): void {
		const board = this.session.board;
		if (board === undefined) {
			return;
		}
		let activeCount = 0;
		for (let index = 0; index < TOTAL_CASE_COUNT; index++) {
			if (board.getCase(index)?.isActive === true) {
				activeCount++;
			}
		}
		// 활성 케이스가 하나도 잡히지 않으면(있을 수 없지만) 예전처럼 전부 그린다
		const nextCount = activeCount > 0 ? activeCount : TOTAL_CASE_COUNT;
		if (nextCount === this._caseCount) {
			return;
		}
		this._caseCount = nextCount;
		this._presenter.resetLayout({
			title: getCatalogEntry(EPuzzleId.COLOR_SORT)?.displayName ?? '',
			rowCount: CASE_CAPACITY,
			colCount: nextCount,
			boardTexture: TEXTURE_BOARD,
		});
	}

	/** 칸 번호 -> 케이스 index. 열 번호가 곧 케이스다 */
	private toCaseIndex(cell: number): number {
		return cell % this._caseCount;
	}

	private toCaseIndexOrUndefined(cell: number): number | undefined {
		return cell === PUZZLE_BOARD_CELL_OUTSIDE ? undefined : this.toCaseIndex(cell);
	}

	//#endregion

	//#region Input (프레젠터 -> 세션)

	private onDragBegin(caseIndex: number): void {
		const result = this.session.beginDrag(caseIndex);
		if (result.isAccepted === false || result.fromCaseIndex === undefined) {
			return;
		}

		this._dragFromCase = result.fromCaseIndex;
		this._dragBatteries = result.batteries ?? [];
		// 집자마자는 출발 케이스 위에 떠 있는 셈이고, 제자리는 언제나 놓을 수 있다
		this._hoverCase = result.fromCaseIndex;
		this._isDropValid = true;
		this.applyGridVisuals();
	}

	/**
	 * 손가락이 다른 케이스로 들어왔다 - 집어 든 건전지들이 그 케이스 위로 따라 올라간다.
	 *
	 * 세션의 미리보기가 "지금 놓을 수 있는지" 를 알려 주므로 (§8 드랍 미리보기),
	 * 손을 떼기 전에 초록/빨강으로 결과를 알 수 있다.
	 */
	private onDragMove(caseIndex: number | undefined): void {
		// 케이스 사이를 스쳐 지나가는 순간의 "영역 밖" 은 무시한다.
		// 그대로 반영하면 집어 든 건전지가 한 프레임 사라졌다 나타나 깜빡인다.
		// 진짜로 영역 밖에 놓았는지는 손을 뗄 때(`onDragEnd`) 뗀 케이스로 판정한다 (§8 드랍).
		if (caseIndex === undefined) {
			return;
		}
		this.trackDragTo(caseIndex);
	}

	/**
	 * 손가락이 올라간 케이스를 미리보기에 반영한다. 실제로 바뀐 경우에만 다시 그린다.
	 *
	 * `applyGridVisuals()` 는 케이스 전부를 위아래로 훑는다. 같은 케이스 안에서 손가락이
	 * 움직일 때마다 그것을 돌리면 화면은 그대로인데 일만 늘어 조작이 무겁게 느껴진다.
	 */
	private trackDragTo(caseIndex: number | undefined): void {
		const preview = this.session.hoverDrag(caseIndex);
		if (this._dragFromCase === undefined) {
			return;
		}

		const hover = preview?.hoverCaseIndex;
		// 출발 케이스로 되돌아온 것은 언제나 허용된다 - 원래 자리에 도로 놓는 것뿐이다
		const isValid = hover === this._dragFromCase || (preview?.isPreviewActive ?? false);
		if (hover === this._hoverCase && isValid === this._isDropValid) {
			return;
		}

		this._hoverCase = hover;
		this._isDropValid = isValid;
		this.applyGridVisuals();
	}

	/**
	 * 손을 뗐다 - 건전지는 **뗀 케이스에** 놓인다.
	 *
	 * 뗀 케이스를 마지막으로 한 번 더 반영한 뒤 확정한다. `onCellMove` 없이 곧바로 떼는
	 * 짧은 탭에서도 목적지가 정확해진다.
	 */
	private onDragEnd(caseIndex: number | undefined): void {
		this.trackDragTo(caseIndex);
		this.session.endDrag(caseIndex);
		this.clearDragState();
		// 이동이 거절되면 보드 이벤트가 오지 않으므로 여기서 직접 강조를 걷어낸다
		this.applyGridVisuals();
	}

	/** 드래그 강조를 모두 걷어낸다. 손을 뗄 때·일시정지·레벨 전환에서 부른다 */
	private clearDragState(): void {
		this._dragBatteries = [];
		this._dragFromCase = undefined;
		this._hoverCase = undefined;
		this._isDropValid = false;
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
		this.clearDragState();
		this._presenter.setInputEnabled(false);
		PuzzleBoardStage.instance.unmount(this._presenter);
		this.releaseInteraction();
	}

	//#endregion

	//#region Presentation (세션 이벤트 -> 보드 프레젠터)

	private subscribeToSessionEvents(): void {
		this.events.LEVEL_LOADED.subscribe(this.onLevelLoaded.bind(this));

		// 옮긴 뒤에는 출발/도착 케이스뿐 아니라 공개(§7)와 닫힘(§4)도 함께 바뀐다.
		// 케이스가 8개뿐이라 전체를 다시 칠하는 편이 짧고 틀릴 여지가 없다.
		this.events.BATTERIES_MOVED.subscribe(() => this.applyGridVisuals());
		this.events.BATTERY_REVEALED.subscribe(() => this.applyGridVisuals());
		this.events.CASE_CLOSED.subscribe((caseIndex) => this.onCaseClosed(caseIndex));

		// §8 - 영역 밖 드랍. 되돌아갈 때까지 그 케이스는 잠긴다.
		this.events.RESPAWN_STARTED.subscribe((caseIndex) => this.applyCaseVisual(caseIndex));
		this.events.RESPAWN_FINISHED.subscribe((caseIndex) => this.applyCaseVisual(caseIndex));

		// §2 - 데드락. 판정과 종료는 세션이 하고, 여기서는 원인을 로그로 남긴다.
		this.events.DEADLOCK_DETECTED.subscribe(() => {
			console.log('[ColorSortCoreAPI] Deadlock detected: no legal move remains.');
		});

		this.events.QUEST_CLEAR.subscribe(this.onQuestEnd.bind(this));
		this.events.QUEST_FAILED.subscribe(this.onQuestEnd.bind(this));
	}

	private onLevelLoaded(level: ColorSortLevel): void {
		this.clearDragState();
		this.resizeGridToActiveCases();
		this.applyGridVisuals();

		PuzzleBoardStage.instance.mount(this._presenter);
		this._presenter.setInputEnabled(true);

		console.log(`[ColorSortCoreAPI] Level loaded: ${level.cases.length} cases, ${level.colorCount} colors.`);
	}

	private onCaseClosed(caseIndex: number): void {
		this.applyCaseVisual(caseIndex);
		console.log(`[ColorSortCoreAPI] Case ${caseIndex} closed (filled with one color).`);
	}

	private onQuestEnd(result: ColorSortResultData): void {
		this.clearDragState();
		// 허브의 결과 화면이 화면을 덮어야 하므로 보드를 내린다.
		// BoardPanel 과 HubPanel 은 서로 다른 gizmo 라 z-order 를 코드가 정할 수 없다.
		// 한 번에 하나만 그리게 두면 어느 쪽이 위든 결과 화면이 확실히 보인다.
		this._presenter.setInputEnabled(false);
		PuzzleBoardStage.instance.unmount(this._presenter);
		console.log(`[ColorSortCoreAPI] Quest ended: ${result.result} `
			+ `(reason: ${result.failReason ?? 'none'}, ${result.remainingTimeSeconds}s remaining)`);
	}

	private applyGridVisuals(): void {
		for (let caseIndex = 0; caseIndex < this._caseCount; caseIndex++) {
			this.applyCaseVisual(caseIndex);
		}
	}

	/**
	 * 케이스 한 개(= 한 열)를 현재 스택으로 다시 칠한다.
	 *
	 * ## 집어 든 건전지는 어디에 그리는가
	 *
	 * 보드는 손을 뗄 때까지 건전지를 출발 케이스에 그대로 둔다 (§8 - 놓아야 이동이 확정된다).
	 * 그래서 화면에서는 **집어 든 만큼을 출발 케이스에서 덜어내고**, 손가락이 올라가 있는
	 * 케이스의 스택 위에 그 건전지들을 얹어 그린다. 집어 든 것이 손가락을 따라 케이스에서
	 * 케이스로 옮겨 다니는 것이 보이고, 남긴 자리에는 실루엣이 남는다.
	 */
	private applyCaseVisual(caseIndex: number): void {
		const board = this.session.board;
		if (board === undefined) {
			return;
		}

		const batteryCase = board.getCase(caseIndex);
		const state = board.getCaseState(caseIndex);

		// 이 케이스에서 덜어낸 개수 - 출발 케이스일 때만 0 이 아니다
		const liftedCount = caseIndex === this._dragFromCase ? this._dragBatteries.length : 0;
		// 인터랙션 규격: **최상단의 같은 색 뭉치만** 만질 수 있다 (§8 그랩 - 함께 잡히는 개수).
		// 그 아래 건전지·빈 칸·잠긴/닫힌 케이스는 정적이다.
		const grabCount = board.getGrabCount(caseIndex);
		const caseSize = batteryCase === undefined ? 0 : batteryCase.batteries.length;
		// 집어 든 건전지가 원래 있던 칸의 범위 [floatFrom, floatFrom + liftedCount)
		const isHovered = this._dragFromCase !== undefined && caseIndex === this._hoverCase;
		const floatFrom = batteryCase === undefined ? 0 : batteryCase.batteries.length - liftedCount;
		// 얹을 자리가 모자라면(케이스가 거의 찼다) 케이스 위쪽에 겹쳐 그린다.
		// 그 편이 화면 밖으로 잘려 아무것도 안 보이는 것보다 낫다 - 빨간 테두리와 함께
		// "여기에는 안 들어간다" 가 그대로 읽힌다.
		const floatBase = Math.max(0, Math.min(floatFrom, CASE_CAPACITY - this._dragBatteries.length));

		for (let row = 0; row < CASE_CAPACITY; row++) {
			const cell = row * this._caseCount + caseIndex;

			// §3 - 시작부터 사용할 수 없는 케이스는 아예 그리지 않는다. 그러면 눌리지도 않는다.
			if (batteryCase === undefined || batteryCase.isActive === false) {
				this._presenter.setCell(cell, { isVisible: false, texture: NO_TEXTURE, label: '', accent: EBoardCellAccent.NONE });
				continue;
			}

			// 배열 마지막이 최상단이므로 위아래를 뒤집어 그린다
			const stackIndex = CASE_CAPACITY - 1 - row;

			// (1) 손가락을 따라온 건전지 - 스택 위에 떠 있다
			const floatIndex = stackIndex - floatBase;
			if (isHovered && floatIndex >= 0 && floatIndex < this._dragBatteries.length) {
				const lifted = this._dragBatteries[floatIndex];
				this._presenter.setCell(cell, {
					isVisible: true,
					// 손가락을 따라다니는 미리보기다 - 여기서 새 누름을 시작할 일은 없다
					isInteractive: false,
					fill: lifted.isRevealed ? getBatteryColor(lifted.color) : COLOR_UNKNOWN,
					texture: lifted.isRevealed ? TEXTURE_BATTERY : TEXTURE_UNKNOWN,
					label: lifted.isRevealed ? '' : UNKNOWN_LABEL,
					labelColor: COLOR_LABEL,
					isHighlighted: false,
					accent: this._isDropValid ? EBoardCellAccent.GRABBED : EBoardCellAccent.DROP_INVALID,
				});
				continue;
			}

			// (2) 집어 든 건전지가 원래 있던 칸 - 실루엣만 남긴다
			const isLiftedSlot = stackIndex >= floatFrom && stackIndex < floatFrom + liftedCount;
			const battery = batteryCase.batteries[stackIndex];

			if (isLiftedSlot && battery !== undefined) {
				this._presenter.setCell(cell, {
					isVisible: true,
					// 실루엣(빠져나간 자리)은 정적이다
					isInteractive: false,
					fill: battery.isRevealed ? getBatteryColor(battery.color) : COLOR_UNKNOWN,
					texture: battery.isRevealed ? TEXTURE_BATTERY : TEXTURE_UNKNOWN,
					label: '',
					labelColor: COLOR_LABEL,
					isHighlighted: false,
					accent: EBoardCellAccent.GHOST,
				});
				continue;
			}

			if (battery === undefined) {
				this._presenter.setCell(cell, {
					isVisible: true,
					// 빈 칸은 집을 것이 없다 - 정적
					isInteractive: false,
					fill: state === ECaseState.LOCKED ? COLOR_LOCKED_SLOT : COLOR_EMPTY_SLOT,
					texture: state === ECaseState.LOCKED ? TEXTURE_LOCKED_SLOT : TEXTURE_EMPTY_SLOT,
					label: '',
					// §4 - 같은 색으로 가득 차 닫힌 케이스를 테두리로 알린다
					isHighlighted: state === ECaseState.CLOSED_COMPLETE,
					accent: EBoardCellAccent.NONE,
				});
				continue;
			}

			this._presenter.setCell(cell, {
				isVisible: true,
				// 최상단의 같은 색 뭉치(함께 잡히는 범위)에 든 건전지만 만질 수 있다.
				// 뭉치는 통째로만 잡히므로 "따로따로 분리" 인터랙션은 성립하지 않는다 (§8).
				isInteractive: grabCount > 0 && stackIndex >= caseSize - grabCount,
				// §7 - 미공개 건전지는 색을 숨기고 `?` 만 보인다
				fill: battery.isRevealed ? getBatteryColor(battery.color) : COLOR_UNKNOWN,
				texture: battery.isRevealed ? TEXTURE_BATTERY : TEXTURE_UNKNOWN,
				label: battery.isRevealed ? '' : UNKNOWN_LABEL,
				labelColor: COLOR_LABEL,
				isHighlighted: state === ECaseState.CLOSED_COMPLETE,
				accent: EBoardCellAccent.NONE,
			});
		}
	}

	//#endregion
}


/** 색 이름 -> 표시 색. 표에 없는 색이 오면 회색으로 떨어뜨린다 */
function getBatteryColor(color: EBatteryColor): PuzzleBoardColor {
	return BATTERY_COLORS[color] ?? BATTERY_COLORS.GRAY;
}

Component.register(ColorSortCoreAPI);
