/**
 * Rush Hour Core API - PUZ_02 러시아워 퍼즐을 실제 월드에서 구동하는 Horizon Component
 *
 * `Switch_CoreAPI` 와 같은 구조다. 브리지·보드 UI·소유권 컴포넌트는 그대로 재사용한다
 * (`Documents/생성 문서/구현 사항/작업기록_2026-09-02_보드_CustomUI_전환.md` §6.3).
 *
 * ## 왜 9×9 를 통째로 그리는가
 *
 * 실제 플레이 공간은 가운데 7×7 이고 바깥 테두리 한 칸은 도착 포인트(USB 단자) 구역이다.
 * 3D 시절에는 테두리를 보이지 않게 두었지만, **여기서는 테두리도 그린다.**
 * 결합(§9)이 "슬롯 쪽으로 반 칸 이상 더 끌기" 인데, 보이지 않는 칸은 눌리지 않으므로
 * 테두리를 감추면 USB 를 꽂을 방법이 사라지기 때문이다.
 *
 *   전체 9×9 = 프레젠터 격자 (칸 번호 = fullRow * 9 + fullCol)
 *    └ 테두리 링 : 어둡게. 도착 포인트만 자기 색으로 표시
 *    └ 중앙 7×7 : 플레이 공간. 세션에는 로컬 좌표(full - 1)로 넘긴다
 *
 * ## 드래그 중 미리보기
 *
 * 보드의 실제 좌표는 손을 뗄 때 스냅되면서 바뀐다 (§7). 그 사이에 아무 변화가 없으면
 * 무엇을 끌고 있는지 알 수 없으므로, 드래그 중에는 컨트롤러가 주는 연속 좌표를 반올림해
 * **그 자리에 미리 그린다.** 컨트롤러가 이미 이동 가능 범위로 잘라 주므로 (§8 경계 고정)
 * 미리보기가 다른 오브젝트와 겹치는 일은 없다.
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
import { EBoardCellAccent, PUZZLE_BOARD_CELL_OUTSIDE, PuzzleBoardColor, PuzzleTextureKey, boardColor, textureKey } from 'PuzzleBoardUI_Definitions';
import { PuzzleTextureLibrary } from 'PuzzleBoardUI_TextureLibrary';
import { PuzzleBoardPresenter, PuzzleBoardStage } from 'PuzzleBoardUI_Presenter';
import { RushHourLevelGenerator } from 'RushHour_LevelGenerator';
import { RushHourEvents } from 'RushHour_GameEvents';
import { RushHourTables } from 'RushHour_DataTables';
import { RushHourSession } from 'RushHour_Session';
import { EDragAxis } from 'RushHour_DragController';
import {
	EMoveDirection,
	EOrientation,
	EPieceColor,
	RUSH_HOUR_FULL_GRID_SIZE,
	RUSH_HOUR_PLAY_ORIGIN,
	RushHourLevel,
	RushHourPiece,
	RushHourResultData,
	getPieceCells,
	isInsidePlayField,
	toFullGridIndex,
} from 'RushHour_Definitions';

/** 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - SWITCH_READY 와 같은 규약 */
export const RUSH_HOUR_READY = new EventPublisher<RushHourCoreAPI>();

/** 테두리 링 - 도착 포인트가 놓이는 구역 */
const COLOR_BORDER: PuzzleBoardColor = boardColor(0.1, 0.11, 0.15);
/** 플레이 공간의 빈 칸 */
const COLOR_EMPTY: PuzzleBoardColor = boardColor(0.19, 0.2, 0.26);

/** 목표 오브젝트(USB)와 도착 포인트의 색 - 기획서 §4 "동일 선상의 목표와 같은 색상" */
const COLOR_GOAL_RED: PuzzleBoardColor = boardColor(0.9, 0.25, 0.25);
const COLOR_GOAL_BLUE: PuzzleBoardColor = boardColor(0.3, 0.5, 0.95);
/** 도착 포인트는 같은 색을 어둡게 해서 오브젝트와 구분한다 */
const END_POINT_TONE_SCALE = 0.45;

/**
 * 방해 오브젝트의 색 후보.
 * 칸 단위로 그리므로 나란히 붙은 두 오브젝트가 같은 색이면 하나로 보인다.
 * id 해시로 서로 다른 색을 주어 경계가 눈에 남게 한다.
 */
const OBSTACLE_COLORS: PuzzleBoardColor[] = [
	boardColor(0.45, 0.47, 0.55),
	boardColor(0.55, 0.5, 0.4),
	boardColor(0.4, 0.52, 0.5),
	boardColor(0.52, 0.44, 0.55),
	boardColor(0.48, 0.55, 0.45),
];

const COLOR_LABEL: PuzzleBoardColor = boardColor(1, 1, 1);

/** 목표 오브젝트 칸의 라벨 - 방해물과 한눈에 구분된다 */
const GOAL_LABEL = 'U';

/**
 * 이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
 * 에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.
 */
/** 목표 말(USB) */
const TEXTURE_GOAL_PIECE: PuzzleTextureKey = textureKey('rushHour', 'goalPiece');
/** 길을 막는 말 */
const TEXTURE_BLOCKER_PIECE: PuzzleTextureKey = textureKey('rushHour', 'blockerPiece');
/** 빈 칸 */
const TEXTURE_EMPTY: PuzzleTextureKey = textureKey('rushHour', 'empty');
/** 테두리 링 */
const TEXTURE_BORDER: PuzzleTextureKey = textureKey('rushHour', 'border');
/** 격자 뒤에 까는 판 그림 */
const TEXTURE_BOARD: PuzzleTextureKey = textureKey('rushHour', 'board');

export class RushHourCoreAPI extends Component<typeof RushHourCoreAPI> {
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
		/** 목표 말(USB) */
		goalPieceTexture: { type: PropTypes.Asset },
		/** 길을 막는 말 */
		blockerPieceTexture: { type: PropTypes.Asset },
		/** 빈 칸 */
		emptyTexture: { type: PropTypes.Asset },
		/** 테두리 링 */
		borderTexture: { type: PropTypes.Asset },
		/** 격자 뒤에 까는 판 그림 */
		boardTexture: { type: PropTypes.Asset },
	};

	public static instance: RushHourCoreAPI | undefined = undefined;

	public events!: RushHourEvents;
	public session!: RushHourSession;
	public tables!: RushHourTables;

	private _presenter!: PuzzleBoardPresenter;

	/** 드래그 중인 오브젝트를 미리 그릴 자리. 드래그가 없으면 undefined */
	private _previewPieceId: string | undefined = undefined;
	private _previewRow: number = 0;
	private _previewCol: number = 0;
	/**
	 * 집어 든 순간 오브젝트가 있던 자리. 여기에 실루엣을 남겨 **어디에서 집어 왔는지**를 보인다.
	 * 미리보기가 아직 원래 자리에 있으면 실루엣은 그리지 않는다 - 같은 칸에 겹쳐 봐야 의미가 없다.
	 */
	private _originRow: number = 0;
	private _originCol: number = 0;
	/** 지금 끌고 있는 축. 이 축을 따라 갈 수 있는 빈 칸을 길로 표시한다 */
	private _dragAxis: EDragAxis = EDragAxis.UNDECIDED;

	/**
	 * 이번 리페인트에서 실제로 기록할 칸 (전체 그리드 번호). undefined 면 전부 기록한다.
	 *
	 * 방법론 §4.2(더티 플래그) - 드래그 미리보기가 한 칸 옮겨질 때 값이 바뀔 수 있는 칸은
	 * 이전·새 미리보기 자리와 원래 자리(실루엣)뿐이다. 페인터(`applyGridVisuals`)는 그대로
	 * 두고 **기록만 걸러내므로**, 레이어 순서가 전체용/증분용 두 벌로 갈라질 위험이 없다.
	 */
	private _repaintFilter: Set<number> | undefined = undefined;
	/** 재사용 버퍼 - 전환마다 Set 을 새로 만들지 않는다 (방법론 §4.4 할당 제로) */
	private readonly _dirtyCells: Set<number> = new Set<number>();

	private _isInteractionActive: boolean = false;

	//#region Lifecycle

	public start(): void {
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			console.log('[RushHourCoreAPI] Server instance. Waiting for ownership transfer. '
				+ '(If only this log appears without the "local start" log, set the script execution mode to Local '
				+ 'and make sure this entity is in Puzzle_LocalOwnership targets.)');
			return;
		}

		console.log('[RushHourCoreAPI] Started on the local client. Ownership transfer OK.');

		this.constructSystems();

		if (this.props.autoStart) {
			this.startQuestByDifficulty(this.props.difficulty);
		}
	}

	public dispose(): void {
		PuzzleBoardStage.instance.unmount(this._presenter);
		this.releaseInteraction();
		if (RushHourCoreAPI.instance === this) {
			RushHourCoreAPI.instance = undefined;
		}
	}

	private constructSystems(): void {
		this.tables = new RushHourTables();
		this.events = new RushHourEvents();
		this.session = new RushHourSession(
			this.events,
			this.tables,
			new RushHourLevelGenerator(this.tables),
			// 솔버는 힌트(getHintMove)에만 쓰이므로 세션의 기본 인스턴스를 그대로 둔다
			undefined,
			{ seed: this.props.seed > 0 ? this.props.seed : undefined },
		);

		this.registerTextures();
		this.createPresenter();
		this.subscribeToSessionEvents();

		// 이것을 빠뜨리면 제한 시간이 흐르지 않는다
		connectPuzzleUpdate(this, (deltaSeconds) => this.session.update(deltaSeconds));

		PuzzleHubRegistry.instance.register(createPuzzleHandle(
			EPuzzleId.RUSH_HOUR,
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

		RushHourCoreAPI.instance = this;
		RUSH_HOUR_READY.publish(this);
	}

	/**
	 * 에디터 prop 의 텍스처 애셋을 키에 붙인다.
	 *
	 * **프레젠터를 만들기 전에** 부른다. 순서가 뒤집혀도 패널이 세대를 올려 다시 그리지만,
	 * 먼저 등록해 두면 첫 프레임부터 그림이 붙는다.
	 */
	private registerTextures(): void {
		const count = PuzzleTextureLibrary.instance.registerAll([
			{ key: TEXTURE_GOAL_PIECE, asset: this.props.goalPieceTexture },
			{ key: TEXTURE_BLOCKER_PIECE, asset: this.props.blockerPieceTexture },
			{ key: TEXTURE_EMPTY, asset: this.props.emptyTexture },
			{ key: TEXTURE_BORDER, asset: this.props.borderTexture },
			{ key: TEXTURE_BOARD, asset: this.props.boardTexture },
		]);
		console.log(`[RushHourCoreAPI] Registered ${count} textures. `
			+ 'Elements without one are drawn with a flat colour.');
	}

	private createPresenter(): void {
		this._presenter = new PuzzleBoardPresenter(
			{
				title: getCatalogEntry(EPuzzleId.RUSH_HOUR)?.displayName ?? '',
				rowCount: RUSH_HOUR_FULL_GRID_SIZE,
				colCount: RUSH_HOUR_FULL_GRID_SIZE,
				boardTexture: TEXTURE_BOARD,
			},
			{
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
		// 세션은 플레이 로컬 좌표를 받는다. 테두리를 눌렀다면 잡히는 오브젝트가 없어 거절된다.
		const result = this.session.beginDrag(toLocalRow(cell), toLocalCol(cell));
		if (result.isAccepted === false || result.pieceId === undefined) {
			return;
		}

		// 잡은 직후의 미리보기 자리는 오브젝트가 지금 있는 자리 그대로다
		const piece = this.session.board?.getPiece(result.pieceId);
		if (piece === undefined) {
			return;
		}
		this._previewPieceId = piece.id;
		this._previewRow = piece.row;
		this._previewCol = piece.col;
		this._originRow = piece.row;
		this._originCol = piece.col;
		// 세로/가로 오브젝트는 잡는 순간 축이 정해진다. 1x1(FREE) 은 처음 움직일 때 정해진다
		this._dragAxis = toDragAxis(piece.orientation);
		this.applyGridVisuals();
	}

	private onDragMove(cell: number): void {
		this.trackDragTo(cell);
	}

	/**
	 * 손가락이 올라간 칸을 미리보기에 반영한다. 실제로 자리가 바뀐 경우에만 다시 그린다.
	 *
	 * **바뀌지 않았는데 다시 그리면 안 된다.** `applyGridVisuals()` 는 81칸을 전부 훑으면서
	 * 오브젝트마다 점유 칸을 다시 구하고 이동 가능 범위까지 계산한다. 한 칸 안에서 손가락이
	 * 움직일 때마다 그것을 돌리면 화면은 그대로인데 일만 늘어 조작이 무겁게 느껴진다.
	 */
	private trackDragTo(cell: number): boolean {
		if (this._previewPieceId === undefined) {
			return false;
		}
		// 격자 밖에서는 갱신하지 않는다. 컨트롤러가 마지막 값을 유지하므로
		// 오브젝트는 이동 가능한 최외곽에 고정된 채로 남는다 (§8).
		if (cell === PUZZLE_BOARD_CELL_OUTSIDE) {
			return false;
		}

		const visual = this.session.updateDrag(toLocalRow(cell), toLocalCol(cell));
		if (visual === undefined) {
			return false;
		}
		// §7 스냅과 같은 규칙으로 반올림한다. 컨트롤러가 이미 이동 가능 범위로 잘라 주므로
		// 이 자리는 언제나 놓을 수 있는 자리다.
		const row = Math.round(visual.row);
		const col = Math.round(visual.col);
		if (row === this._previewRow && col === this._previewCol && visual.axis === this._dragAxis) {
			return false;
		}

		const previousRow = this._previewRow;
		const previousCol = this._previewCol;
		const didAxisChange = visual.axis !== this._dragAxis;
		this._previewRow = row;
		this._previewCol = col;
		this._dragAxis = visual.axis;

		if (didAxisChange) {
			// 축이 이 순간 확정됐다 - 이동 가능 범위(길)가 처음 나타나므로 전체를 기록한다
			this.applyGridVisuals();
		}
		else {
			this.applyDragTransitionVisuals(previousRow, previousCol);
		}
		return true;
	}

	/**
	 * 드래그 미리보기가 한 칸 옮겨졌다 - **바뀔 수 있는 칸만** 다시 기록한다 (방법론 §4.2).
	 *
	 * 전환에서 값이 바뀔 수 있는 칸은 셋뿐이다.
	 *   이전 미리보기 자리(비워진다) · 새 미리보기 자리(오브젝트가 온다) ·
	 *   원래 자리(미리보기가 떠나거나 돌아올 때 실루엣이 켜지고 꺼진다)
	 * 길·도착 포인트·다른 오브젝트는 드래그 중 보드가 바뀌지 않으므로 그대로다.
	 * 예전에는 전환마다 81칸 전체를 훑어 칸당 패치 객체를 만들었다 - 화면은 세 자리만
	 * 바뀌는데 일은 81칸 몫이 들었다.
	 */
	private applyDragTransitionVisuals(previousRow: number, previousCol: number): void {
		const board = this.session.board;
		const pieceId = this._previewPieceId;
		const piece = pieceId === undefined ? undefined : board?.getPiece(pieceId);
		if (board === undefined || piece === undefined) {
			this.applyGridVisuals();
			return;
		}

		this._dirtyCells.clear();
		this.collectFootprint(piece, previousRow, previousCol);
		this.collectFootprint(piece, this._previewRow, this._previewCol);
		this.collectFootprint(piece, this._originRow, this._originCol);

		this._repaintFilter = this._dirtyCells;
		this.applyGridVisuals();
		this._repaintFilter = undefined;
	}

	/** 오브젝트가 이 자리에 있을 때 차지하는 칸들을 더티 목록에 넣는다 */
	private collectFootprint(piece: RushHourPiece, row: number, col: number): void {
		for (const cell of getPieceCells(withPosition(piece, row, col))) {
			const fullRow = toFullGridIndex(cell.row);
			const fullCol = toFullGridIndex(cell.col);
			if (fullRow < 0 || fullRow >= RUSH_HOUR_FULL_GRID_SIZE
				|| fullCol < 0 || fullCol >= RUSH_HOUR_FULL_GRID_SIZE) {
				continue;
			}
			this._dirtyCells.add(fullRow * RUSH_HOUR_FULL_GRID_SIZE + fullCol);
		}
	}

	/**
	 * 손을 뗐다 - 오브젝트는 **뗀 자리에** 멈춘다.
	 *
	 * 뗀 칸을 마지막으로 한 번 더 반영한 뒤에 확정하는 것이 핵심이다. 예전에는 뗀 칸을
	 * 버리고 곧바로 `endDrag()` 를 불렀는데, 그러면 마지막 `onCellMove` 가 기록한 자리로
	 * 스냅된다. 빠르게 끌다 놓으면 손가락이 지나온 칸에 조각이 남아, 놓은 자리에 서지 않는
	 * 것처럼 보였다.
	 */
	private onDragEnd(cell: number): void {
		this.trackDragTo(cell);
		this.session.endDrag();
		this._previewPieceId = undefined;
		this._dragAxis = EDragAxis.UNDECIDED;
		this.applyGridVisuals();
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
		this._previewPieceId = undefined;
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
		this._previewPieceId = undefined;
		this._presenter.setInputEnabled(false);
		PuzzleBoardStage.instance.unmount(this._presenter);
		this.releaseInteraction();
	}

	//#endregion

	//#region Presentation (세션 이벤트 -> 보드 프레젠터)

	private subscribeToSessionEvents(): void {
		this.events.LEVEL_LOADED.subscribe(this.onLevelLoaded.bind(this));

		this.events.PIECE_MOVED.subscribe(() => this.applyGridVisuals());

		// §9 - 결합/분리는 점유 칸이 2 <-> 3 으로 바뀌므로 반드시 다시 그린다
		this.events.USB_DOCKED.subscribe(this.onUsbDocked.bind(this));
		this.events.USB_UNDOCKED.subscribe(this.onUsbUndocked.bind(this));

		this.events.QUEST_CLEAR.subscribe(this.onQuestEnd.bind(this));
		this.events.QUEST_FAILED.subscribe(this.onQuestEnd.bind(this));
	}

	private onLevelLoaded(level: RushHourLevel): void {
		this._previewPieceId = undefined;
		this.applyGridVisuals();

		PuzzleBoardStage.instance.mount(this._presenter);
		this._presenter.setInputEnabled(true);

		console.log(`[RushHourCoreAPI] Level loaded: ${level.pieces.length} pieces, `
			+ `${level.endPoints.length} end points, minimum ${level.minimumMoves} moves.`);
	}

	private onUsbDocked(piece: RushHourPiece): void {
		this.applyGridVisuals();
		console.log(`[RushHourCoreAPI] USB docked: ${piece.id}`);
	}

	private onUsbUndocked(piece: RushHourPiece): void {
		this.applyGridVisuals();
		console.log(`[RushHourCoreAPI] USB undocked: ${piece.id}`);
	}

	private onQuestEnd(result: RushHourResultData): void {
		// 허브의 결과 화면이 화면을 덮어야 하므로 보드를 내린다.
		// BoardPanel 과 HubPanel 은 서로 다른 gizmo 라 z-order 를 코드가 정할 수 없다.
		// 한 번에 하나만 그리게 두면 어느 쪽이 위든 결과 화면이 확실히 보인다.
		this._previewPieceId = undefined;
		this._presenter.setInputEnabled(false);
		PuzzleBoardStage.instance.unmount(this._presenter);
		console.log(`[RushHourCoreAPI] Quest ended: ${result.result} (${result.remainingTimeSeconds}s remaining)`);
	}

	/**
	 * 9×9 전체를 다시 칠한다.
	 *
	 * 바탕 -> 도착 포인트 -> 오브젝트 순서로 덮어쓴다. 결합된 USB 는 테두리 링의 슬롯 칸까지
	 * 3칸을 차지하므로 (§9) 보드가 알려 주는 전체 그리드 점유 칸을 그대로 쓴다.
	 */
	private applyGridVisuals(): void {
		const board = this.session.board;
		if (board === undefined) {
			return;
		}

		for (let row = 0; row < RUSH_HOUR_FULL_GRID_SIZE; row++) {
			for (let col = 0; col < RUSH_HOUR_FULL_GRID_SIZE; col++) {
				// 더티 필터가 걸려 있으면 그 칸만 기록한다 - 패치 객체를 만들기 전에 거른다 (§4.4)
				if (this._repaintFilter !== undefined
					&& this._repaintFilter.has(row * RUSH_HOUR_FULL_GRID_SIZE + col) === false) {
					continue;
				}
				const isPlayField = isInsidePlayField(row - RUSH_HOUR_PLAY_ORIGIN, col - RUSH_HOUR_PLAY_ORIGIN);
				this._presenter.setCell(row * RUSH_HOUR_FULL_GRID_SIZE + col, {
					isVisible: true,
					// 인터랙션 규격: 빈 칸·테두리·도착 포인트는 정적이다. 만질 수 있는 것은
					// 판 위의 말뿐이다 (아래 오브젝트 페인트가 그 칸만 다시 켠다).
					isInteractive: false,
					fill: isPlayField ? COLOR_EMPTY : COLOR_BORDER,
					texture: isPlayField ? TEXTURE_EMPTY : TEXTURE_BORDER,
					label: '',
					isHighlighted: false,
					// 앞 프레임의 강조를 지운다. 지우지 않으면 손을 뗀 뒤에도 실루엣이 남는다
					accent: EBoardCellAccent.NONE,
				});
			}
		}

		// 지금 끌고 있는 오브젝트가 이 축에서 갈 수 있는 빈 칸을 길로 깔아 둔다.
		// 조각이 어디까지 갈 수 있는지가 손을 대기 전에는 보이지 않기 때문이다.
		this.applyDragPathVisuals();

		// 기획서 §4 - 도착 포인트는 동일 선상의 목표 오브젝트와 같은 색이다
		for (const endPoint of board.endPoints) {
			const base = getPieceColorByColor(endPoint.color);
			this.setFullGridCell(endPoint.row, endPoint.col, {
				fill: boardColor(base.r * END_POINT_TONE_SCALE, base.g * END_POINT_TONE_SCALE, base.b * END_POINT_TONE_SCALE),
				isHighlighted: true,
			});
		}

		// 집어 든 오브젝트가 원래 있던 자리 - 실루엣만 남긴다.
		// 오브젝트보다 먼저 칠해 두어, 아직 원래 자리에 겹쳐 있는 칸은 아래에서 덮이게 한다.
		this.applyGhostVisuals();

		for (const piece of board.pieces) {
			const isPreview = piece.id === this._previewPieceId;
			const cells = isPreview
				? getPieceCells(withPosition(piece, this._previewRow, this._previewCol))
					.map((cell) => ({ row: toFullGridIndex(cell.row), col: toFullGridIndex(cell.col) }))
				: board.getGoalOccupiedCellsInFullGrid(piece.id);

			for (const cell of cells) {
				this.setFullGridCell(cell.row, cell.col, {
					fill: this.getPieceColor(piece),
					texture: piece.isGoal ? TEXTURE_GOAL_PIECE : TEXTURE_BLOCKER_PIECE,
					label: piece.isGoal ? GOAL_LABEL : '',
					// 인터랙션 규격: 판 위의 말만 만질 수 있다
					isInteractive: true,
					// 지금 끌고 있는 오브젝트를 테두리로 알린다 (PUZ_00 §8.5 - 손가락에 가려도 보이게)
					isHighlighted: isPreview,
					// 끌고 있는 오브젝트는 떠올라 빛난다 - 손가락 밑에서도 삐져나와 보인다
					accent: isPreview ? EBoardCellAccent.GRABBED : EBoardCellAccent.NONE,
				});
			}
		}
	}

	/**
	 * 집어 든 오브젝트가 원래 있던 칸에 실루엣을 남긴다.
	 *
	 * 미리보기가 아직 원래 자리에 그대로 있으면 그리지 않는다 - 같은 칸을 실루엣과 본체가
	 * 겹쳐 쓰면 집었다는 느낌 대신 색만 흐려진 것처럼 보인다.
	 */
	private applyGhostVisuals(): void {
		const pieceId = this._previewPieceId;
		if (pieceId === undefined) {
			return;
		}
		if (this._previewRow === this._originRow && this._previewCol === this._originCol) {
			return;
		}

		const piece = this.session.board?.getPiece(pieceId);
		if (piece === undefined) {
			return;
		}

		for (const cell of getPieceCells(withPosition(piece, this._originRow, this._originCol))) {
			this.setFullGridCell(toFullGridIndex(cell.row), toFullGridIndex(cell.col), {
				fill: this.getPieceColor(piece),
				texture: piece.isGoal ? TEXTURE_GOAL_PIECE : TEXTURE_BLOCKER_PIECE,
				label: '',
				isHighlighted: false,
				accent: EBoardCellAccent.GHOST,
			});
		}
	}

	/**
	 * 끌고 있는 오브젝트가 이 축에서 갈 수 있는 빈 칸을 길로 표시한다.
	 *
	 * 보드가 알려 주는 이동 가능 칸 수(`getMaxSteps`)를 그대로 쓰므로, 길은 언제나 실제로
	 * 갈 수 있는 만큼만 그려진다. 축이 아직 정해지지 않은 1x1 오브젝트는 그리지 않는다.
	 */
	private applyDragPathVisuals(): void {
		const pieceId = this._previewPieceId;
		const board = this.session.board;
		if (pieceId === undefined || board === undefined || this._dragAxis === EDragAxis.UNDECIDED) {
			return;
		}

		const piece = board.getPiece(pieceId);
		if (piece === undefined) {
			return;
		}

		const isRowAxis = this._dragAxis === EDragAxis.ROW;
		const negative = isRowAxis ? EMoveDirection.UP : EMoveDirection.LEFT;
		const positive = isRowAxis ? EMoveDirection.DOWN : EMoveDirection.RIGHT;
		const origin = isRowAxis ? piece.row : piece.col;
		const from = origin - board.getMaxSteps(pieceId, negative);
		const to = origin + board.getMaxSteps(pieceId, positive) + piece.size - 1;

		const fixed = isRowAxis ? piece.col : piece.row;
		for (let value = from; value <= to; value++) {
			const row = isRowAxis ? value : fixed;
			const col = isRowAxis ? fixed : value;
			if (isInsidePlayField(row, col) === false) {
				continue;
			}
			this.setFullGridCell(toFullGridIndex(row), toFullGridIndex(col), {
				fill: COLOR_EMPTY,
				texture: TEXTURE_EMPTY,
				label: '',
				isHighlighted: false,
				accent: EBoardCellAccent.PATH,
			});
		}
	}

	private setFullGridCell(row: number, col: number, patch: {
		fill: PuzzleBoardColor,
		/** 생략하면 바탕에서 칠해 둔 그림이 그대로 남는다 (도착 포인트가 그 경우다) */
		texture?: PuzzleTextureKey,
		label?: string,
		/** 생략하면 바탕에서 정한 값(정적)이 그대로 남는다 - 말 칸만 true 를 준다 */
		isInteractive?: boolean,
		isHighlighted: boolean,
		accent?: EBoardCellAccent,
	}): void {
		if (row < 0 || row >= RUSH_HOUR_FULL_GRID_SIZE || col < 0 || col >= RUSH_HOUR_FULL_GRID_SIZE) {
			return;
		}
		// 더티 필터가 걸려 있으면 그 칸만 기록한다 (applyDragTransitionVisuals 주석)
		if (this._repaintFilter !== undefined
			&& this._repaintFilter.has(row * RUSH_HOUR_FULL_GRID_SIZE + col) === false) {
			return;
		}
		this._presenter.setCell(row * RUSH_HOUR_FULL_GRID_SIZE + col, {
			isVisible: true,
			fill: patch.fill,
			texture: patch.texture,
			label: patch.label ?? '',
			labelColor: COLOR_LABEL,
			isInteractive: patch.isInteractive,
			isHighlighted: patch.isHighlighted,
			accent: patch.accent ?? EBoardCellAccent.NONE,
		});
	}

	/** 목표는 자기 색, 방해물은 id 로 고른 회색 계열 (나란히 붙어도 경계가 보이도록) */
	private getPieceColor(piece: RushHourPiece): PuzzleBoardColor {
		if (piece.isGoal) {
			return getPieceColorByColor(piece.color);
		}
		return OBSTACLE_COLORS[hashToIndex(piece.id, OBSTACLE_COLORS.length)];
	}

	//#endregion
}

/** 오브젝트의 방향이 곧 드래그 축이다. 1x1(FREE) 만 처음 움직일 때까지 정해지지 않는다 */
function toDragAxis(orientation: EOrientation): EDragAxis {
	if (orientation === EOrientation.HORIZONTAL) {
		return EDragAxis.COL;
	}
	if (orientation === EOrientation.VERTICAL) {
		return EDragAxis.ROW;
	}
	return EDragAxis.UNDECIDED;
}

/** 칸 번호 -> 플레이 로컬 행. 테두리 링을 누르면 -1 이나 7 이 되어 판정에서 걸린다 */
function toLocalRow(cell: number): number {
	return Math.floor(cell / RUSH_HOUR_FULL_GRID_SIZE) - RUSH_HOUR_PLAY_ORIGIN;
}

function toLocalCol(cell: number): number {
	return (cell % RUSH_HOUR_FULL_GRID_SIZE) - RUSH_HOUR_PLAY_ORIGIN;
}

function getPieceColorByColor(color: EPieceColor): PuzzleBoardColor {
	if (color === EPieceColor.RED) {
		return COLOR_GOAL_RED;
	}
	if (color === EPieceColor.BLUE) {
		return COLOR_GOAL_BLUE;
	}
	return OBSTACLE_COLORS[0];
}

/** 문자열을 0..count-1 로 접는다. 같은 id 는 언제나 같은 색이 된다 */
function hashToIndex(value: string, count: number): number {
	let hash = 0;
	for (let index = 0; index < value.length; index++) {
		hash = (hash * 31 + value.charCodeAt(index)) % 100003;
	}
	return hash % count;
}

/**
 * 같은 오브젝트를 다른 자리에 놓은 사본.
 * 미리보기 칸을 구할 때만 쓴다 - 보드의 실제 오브젝트는 손을 뗄 때까지 움직이지 않는다.
 */
function withPosition(piece: RushHourPiece, row: number, col: number): RushHourPiece {
	return {
		id: piece.id,
		size: piece.size,
		orientation: piece.orientation,
		row: row,
		col: col,
		color: piece.color,
		isGoal: piece.isGoal,
	};
}

Component.register(RushHourCoreAPI);
