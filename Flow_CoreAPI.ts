/**
 * Flow Core API - PUZ_05 연결 퍼즐을 실제 월드에서 구동하는 Horizon Component
 *
 * `Switch_CoreAPI` 와 같은 구조다. 브리지·보드 UI·소유권 컴포넌트는 그대로 재사용한다
 * (`Documents/생성 문서/구현 사항/작업기록_2026-09-02_보드_CustomUI_전환.md` §6.3).
 *
 * ## 이 퍼즐의 표현 결정
 *
 * - 필드가 그대로 7×7 격자라 (§3) 좌표 변환이 없다. 칸 번호 = `row * 7 + col`.
 * - **타일이 없는 칸과 오브젝트가 없는 칸은 그리지 않는다.** 보이지 않는 칸은 눌리지 않으므로,
 *   경로가 지나갈 수 없는 자리를 잘못 잡는 일이 원천적으로 사라진다
 *   (`Flow_Board.canExtend()` 도 두 경우를 모두 NO_TILE 로 거절한다).
 * - 메인 오브젝트(전구, §4)는 자기 색으로 칠하고 테두리를 준다. 서브 오브젝트는 색을 받기 전에는
 *   회색이고, 경로가 지나가면 그 색으로 바뀐다 - §5 "연결되면 색을 부여받는다" 그대로다.
 * - 지금 그리고 있는 경로의 머리에 테두리를 얹어 어디까지 왔는지 보이게 한다.
 *
 * ## 조작
 *
 * 드래그다 (§6). 칸 번호를 행/열로 풀어 `beginDraw / moveDraw / endDraw` 에 넘긴다.
 * 격자 밖으로 나간 동안에는 `moveDraw` 를 부르지 않는다. 그리던 경로는 그대로 유지되고,
 * 다시 격자로 들어오면 이어서 그려진다 (PUZ_00 §8.4 - 영역을 벗어나도 드래그는 유지).
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
import { FlowLevelGenerator } from 'Flow_LevelGenerator';
import { FlowEvents } from 'Flow_GameEvents';
import { FlowTables } from 'Flow_DataTables';
import { FlowSession } from 'Flow_Session';
import {
	EFlowColor,
	ENodeKind,
	FLOW_GRID_SIZE,
	FlowLevel,
	FlowResultData,
} from 'Flow_Definitions';

/** 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - SWITCH_READY 와 같은 규약 */
export const FLOW_READY = new EventPublisher<FlowCoreAPI>();

/** 전구 색상 8종. 실제 머티리얼이 들어오면 이 표만 바꾸면 된다 */
const FLOW_COLORS: { [color: string]: PuzzleBoardColor } = {
	RED: boardColor(0.9, 0.22, 0.22),
	ORANGE: boardColor(0.95, 0.56, 0.16),
	YELLOW: boardColor(0.93, 0.87, 0.22),
	GREEN: boardColor(0.24, 0.78, 0.32),
	CYAN: boardColor(0.2, 0.8, 0.82),
	BLUE: boardColor(0.26, 0.46, 0.92),
	PURPLE: boardColor(0.62, 0.36, 0.86),
	PINK: boardColor(0.95, 0.5, 0.74),
};

/** §4 - 아직 색을 받지 못한 서브 오브젝트(회색 전구) */
const COLOR_UNLIT_SUB: PuzzleBoardColor = boardColor(0.35, 0.36, 0.42);

/** 경로가 지나간 서브 오브젝트를 메인보다 어둡게 만드는 비율 - 출발/도착 지점이 눈에 띄게 한다 */
const SUB_TONE_SCALE = 0.7;

/**
 * 이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
 * 에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.
 */
/** 전구(경로의 양 끝) */
const TEXTURE_NODE: PuzzleTextureKey = textureKey('flow', 'node');
/** 이어 그린 선이 지나는 칸 */
const TEXTURE_PATH: PuzzleTextureKey = textureKey('flow', 'path');
/** 아무것도 없는 칸 */
const TEXTURE_EMPTY: PuzzleTextureKey = textureKey('flow', 'empty');
/** 격자 뒤에 까는 판 그림 */
const TEXTURE_BOARD: PuzzleTextureKey = textureKey('flow', 'board');

export class FlowCoreAPI extends Component<typeof FlowCoreAPI> {
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
		/** 전구(경로의 양 끝) */
		nodeTexture: { type: PropTypes.Asset },
		/** 이어 그린 선이 지나는 칸 */
		pathTexture: { type: PropTypes.Asset },
		/** 아무것도 없는 칸 */
		emptyTexture: { type: PropTypes.Asset },
		/** 격자 뒤에 까는 판 그림 */
		boardTexture: { type: PropTypes.Asset },
	};

	public static instance: FlowCoreAPI | undefined = undefined;

	public events!: FlowEvents;
	public session!: FlowSession;
	public tables!: FlowTables;

	private _presenter!: PuzzleBoardPresenter;

	/** 직전에 세션에 넘긴 칸. 건너뛴 입력을 보간하는 기준이다 (`onDrawMove` 참고) */
	private _lastDrawnRow: number = 0;
	private _lastDrawnCol: number = 0;

	private _isInteractionActive: boolean = false;

	//#region Lifecycle

	public start(): void {
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			console.log('[FlowCoreAPI] Server instance. Waiting for ownership transfer. '
				+ '(If only this log appears without the "local start" log, set the script execution mode to Local '
				+ 'and make sure this entity is in Puzzle_LocalOwnership targets.)');
			return;
		}

		console.log('[FlowCoreAPI] Started on the local client. Ownership transfer OK.');

		this.constructSystems();

		if (this.props.autoStart) {
			this.startQuestByDifficulty(this.props.difficulty);
		}
	}

	public dispose(): void {
		PuzzleBoardStage.instance.unmount(this._presenter);
		this.releaseInteraction();
		if (FlowCoreAPI.instance === this) {
			FlowCoreAPI.instance = undefined;
		}
	}

	private constructSystems(): void {
		this.tables = new FlowTables();
		this.events = new FlowEvents();
		this.session = new FlowSession(
			this.events,
			this.tables,
			new FlowLevelGenerator(this.tables),
			// 솔버는 힌트(getSolutionPaths)에만 쓰이므로 세션의 기본 인스턴스를 그대로 둔다
			undefined,
			{ seed: this.props.seed > 0 ? this.props.seed : undefined },
		);

		this.registerTextures();
		this.createPresenter();
		this.subscribeToSessionEvents();

		// 이것을 빠뜨리면 제한 시간이 흐르지 않는다
		connectPuzzleUpdate(this, (deltaSeconds) => this.session.update(deltaSeconds));

		PuzzleHubRegistry.instance.register(createPuzzleHandle(
			EPuzzleId.FLOW,
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

		FlowCoreAPI.instance = this;
		FLOW_READY.publish(this);
	}

	/**
	 * 에디터 prop 의 텍스처 애셋을 키에 붙인다.
	 *
	 * **프레젠터를 만들기 전에** 부른다. 순서가 뒤집혀도 패널이 세대를 올려 다시 그리지만,
	 * 먼저 등록해 두면 첫 프레임부터 그림이 붙는다.
	 */
	private registerTextures(): void {
		const count = PuzzleTextureLibrary.instance.registerAll([
			{ key: TEXTURE_NODE, asset: this.props.nodeTexture },
			{ key: TEXTURE_PATH, asset: this.props.pathTexture },
			{ key: TEXTURE_EMPTY, asset: this.props.emptyTexture },
			{ key: TEXTURE_BOARD, asset: this.props.boardTexture },
		]);
		console.log(`[FlowCoreAPI] Registered ${count} textures. `
			+ 'Elements without one are drawn with a flat colour.');
	}

	private createPresenter(): void {
		this._presenter = new PuzzleBoardPresenter(
			{
				title: getCatalogEntry(EPuzzleId.FLOW)?.displayName ?? '',
				rowCount: FLOW_GRID_SIZE,
				colCount: FLOW_GRID_SIZE,
				boardTexture: TEXTURE_BOARD,
			},
			{
				onCellDown: (cell) => { this.onDrawBegin(cell); },
				onCellMove: (cell) => { this.onDrawMove(cell); },
				// §6 - 손을 떼도 그린 경로는 유지된다
				onCellUp: (cell) => { this.onDrawEnd(cell); },
				// 보조 레이아웃의 Reset 버튼 - 판만 되돌리고 남은 시간은 그대로 둔다
				onReset: () => { this.resetLevel(); },
			},
		);
	}

	//#endregion

	//#region Input (프레젠터 -> 세션)

	private onDrawBegin(cell: number): void {
		this._lastDrawnRow = toRow(cell);
		this._lastDrawnCol = toCol(cell);
		this.session.beginDraw(this._lastDrawnRow, this._lastDrawnCol);
	}

	/**
	 * 손가락이 다른 칸으로 들어왔다.
	 *
	 * **칸을 건너뛴 입력은 보간해야 한다.** 보드는 상하좌우로 한 칸씩 늘리는 것만 허용하는데
	 * (§5 대각선 연결 불가), 빠른 스와이프는 중간 칸의 `onEnter` 를 건너뛴다. 그대로 넘기면
	 * 경로가 끊긴 채 아무 반응이 없다 (`../설계/Horizon통합_아키텍처.md` §1.3, PUZ_05 M3).
	 *
	 * 그래서 직전 칸에서 새 칸까지 **한 칸씩 걸어가며** `moveDraw` 를 부른다. 이동량이 큰 축을
	 * 먼저 소진하는데, 실제 손가락이 지나간 자취에 가장 가깝기 때문이다. 중간에 이을 수 없는
	 * 칸을 만나면 보드가 거절하므로 경로는 그 자리에서 멈춘다 - 잘못 이어지지 않는다.
	 */
	private onDrawMove(cell: number): void {
		// 격자 밖에서는 경로를 늘리지 않는다. 그리던 경로는 그대로 남는다 (PUZ_00 §8.4).
		if (cell === PUZZLE_BOARD_CELL_OUTSIDE) {
			return;
		}

		const targetRow = toRow(cell);
		const targetCol = toCol(cell);
		let row = this._lastDrawnRow;
		let col = this._lastDrawnCol;

		// 최대 이동 칸 수는 격자 둘레를 넘지 않는다 - 좌표가 어긋나도 무한 루프가 되지 않게 한다
		for (let step = 0; step < FLOW_GRID_SIZE * 2; step++) {
			if (row === targetRow && col === targetCol) {
				break;
			}
			if (Math.abs(targetRow - row) >= Math.abs(targetCol - col)) {
				row += targetRow > row ? 1 : -1;
			}
			else {
				col += targetCol > col ? 1 : -1;
			}
			this.session.moveDraw(row, col);
		}

		this._lastDrawnRow = targetRow;
		this._lastDrawnCol = targetCol;
	}

	/**
	 * 손을 뗐다 - 선은 **뗀 칸까지** 그려진 채로 멈춘다.
	 *
	 * 뗀 칸을 마지막으로 한 번 더 이어 준 뒤에 끝낸다. 빠르게 스와이프하면 마지막 칸의
	 * `onEnter` 가 뜨기 전에 손이 떨어져, 선이 손가락보다 한두 칸 뒤에서 끊긴 채로
	 * 남는 일이 있었다.
	 */
	private onDrawEnd(cell: number): void {
		this.onDrawMove(cell);
		this.session.endDraw();
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

		// 경로가 한 칸 늘거나 줄 때마다 보드를 다시 칠한다. 49칸뿐이고 프레젠터가
		// 실제로 바뀐 칸만 이벤트로 내보내므로, 칸별 부분 갱신을 손으로 짜는 것보다 안전하다.
		this.events.DRAW_BEGAN.subscribe(() => this.applyGridVisuals());
		this.events.NODE_LIT.subscribe(() => this.applyGridVisuals());
		this.events.NODE_UNLIT.subscribe(() => this.applyGridVisuals());
		this.events.DRAW_ENDED.subscribe(() => this.applyGridVisuals());

		this.events.PATH_COMPLETED.subscribe((color) => {
			console.log(`[FlowCoreAPI] Path completed: ${color}`);
		});
		this.events.PATH_BROKEN.subscribe((color) => {
			console.log(`[FlowCoreAPI] Path broken: ${color}`);
		});

		this.events.QUEST_CLEAR.subscribe(this.onQuestEnd.bind(this));
		this.events.QUEST_FAILED.subscribe(this.onQuestEnd.bind(this));
	}

	private onLevelLoaded(level: FlowLevel): void {
		this.applyGridVisuals();

		PuzzleBoardStage.instance.mount(this._presenter);
		this._presenter.setInputEnabled(true);

		console.log(`[FlowCoreAPI] Level loaded: ${level.nodes.length} objects, ${level.colorCount} colors.`);
	}

	private onQuestEnd(result: FlowResultData): void {
		// 허브의 결과 화면이 화면을 덮어야 하므로 보드를 내린다.
		// BoardPanel 과 HubPanel 은 서로 다른 gizmo 라 z-order 를 코드가 정할 수 없다.
		// 한 번에 하나만 그리게 두면 어느 쪽이 위든 결과 화면이 확실히 보인다.
		this._presenter.setInputEnabled(false);
		PuzzleBoardStage.instance.unmount(this._presenter);
		console.log(`[FlowCoreAPI] Quest ended: ${result.result} `
			+ `(${result.remainingTimeSeconds}s remaining, ${result.remainingSubCount} objects unlit)`);
	}

	/** 전체 격자를 현재 배치와 경로로 다시 칠한다 */
	private applyGridVisuals(): void {
		const board = this.session.board;
		if (board === undefined) {
			return;
		}

		// 지금 그리는 중인 경로의 머리 - 어디까지 왔는지 테두리로 알린다
		const drawingColor = this.session.dragController?.drawingColor;
		const head = drawingColor === undefined ? undefined : board.getPathHead(drawingColor);

		for (let row = 0; row < FLOW_GRID_SIZE; row++) {
			for (let col = 0; col < FLOW_GRID_SIZE; col++) {
				const cell = row * FLOW_GRID_SIZE + col;
				const node = board.hasTile(row, col) ? board.getNode(row, col) : undefined;

				// 타일이 없거나 오브젝트가 없는 칸은 경로가 지나갈 수 없다 (canExtend 의 NO_TILE).
				// 그리지 않으면 눌리지도 않으므로 잘못된 시작점을 잡을 수 없다.
				if (node === undefined) {
					this._presenter.setCell(cell, { isVisible: false, texture: NO_TEXTURE, label: '', accent: EBoardCellAccent.NONE });
					continue;
				}

				const isHead = head !== undefined && head.row === row && head.col === col;
				const isMain = node.kind === ENodeKind.MAIN;
				// 이 칸이 어느 색 경로의 **마지막 칸**(머리)인지 - 그리다 만 선은 여기서만 이어진다
				const pathHead = node.color === undefined || isMain
					? undefined
					: board.getPathHead(node.color);
				const isAnyPathHead = pathHead !== undefined && pathHead.row === row && pathHead.col === col;

				this._presenter.setCell(cell, {
					isVisible: true,
					// 인터랙션 규격: 선 긋기를 **시작**할 수 있는 곳만 만질 수 있다 -
					// 색이 들어온 전구(메인)와, 그리다 만 경로의 머리. 빈 칸과 경로의
					// 몸통은 정적이다 (드래그가 그 위를 지나가는 것은 hover 라 막히지 않는다).
					isInteractive: isMain || isAnyPathHead,
					fill: this.getNodeColor(node.color, isMain),
					// 전구(메인) / 선이 지나간 칸 / 아직 빈 칸 셋을 구분해 그림을 고른다
					texture: isMain
						? TEXTURE_NODE
						: (node.color === undefined ? TEXTURE_EMPTY : TEXTURE_PATH),
					label: '',
					// §4 - 메인 오브젝트(출발/도착)와 지금 그리는 머리를 테두리로 구분한다
					isHighlighted: isMain || isHead,
					// 지금 그리고 있는 머리는 떠올라 빛난다 - 선이 손가락 끝을 따라오는 것이 보인다.
					// 손가락이 머리를 가려도 커진 만큼 밖으로 삐져나와 어디까지 그렸는지 알 수 있다.
					accent: isHead ? EBoardCellAccent.GRABBED : EBoardCellAccent.NONE,
				});
			}
		}
	}

	/**
	 * 오브젝트 색.
	 * 메인은 자기 색 그대로, 경로가 지나간 서브는 같은 색을 어둡게 해서 출발/도착이 도드라지게 한다.
	 */
	private getNodeColor(color: EFlowColor | undefined, isMain: boolean): PuzzleBoardColor {
		if (color === undefined) {
			return COLOR_UNLIT_SUB;
		}
		const base = FLOW_COLORS[color] ?? COLOR_UNLIT_SUB;
		if (isMain) {
			return base;
		}
		return boardColor(base.r * SUB_TONE_SCALE, base.g * SUB_TONE_SCALE, base.b * SUB_TONE_SCALE);
	}

	//#endregion
}

function toRow(cell: number): number {
	return Math.floor(cell / FLOW_GRID_SIZE);
}

function toCol(cell: number): number {
	return cell % FLOW_GRID_SIZE;
}

Component.register(FlowCoreAPI);
