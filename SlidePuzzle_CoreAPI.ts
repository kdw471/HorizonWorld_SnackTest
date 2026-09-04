/**
 * Slide Puzzle Core API - PUZ_07 슬라이드 퍼즐을 실제 월드에서 구동하는 Horizon Component
 *
 * `Switch_CoreAPI` 와 같은 구조다. 다른 것은 세션 타입과 칸 색 번역뿐이며,
 * 브리지·보드 UI·소유권 컴포넌트는 그대로 재사용한다
 * (`Documents/생성 문서/구현 사항/작업기록_2026-09-02_보드_CustomUI_전환.md` §6.3).
 *
 * ## 이 퍼즐의 표현 결정
 *
 * - 격자 크기가 난이도마다 다르다 (§11 iDivideNum = 3 또는 4). 그래서 레벨을 불러올 때마다
 *   `resetLayout()` 으로 격자를 갈아 끼운다. 스위치(항상 5×5)와 다른 유일한 지점이다.
 * - 조각 색은 **완성 위치**에서 뽑는다. 다 맞추면 좌상→우하로 매끄러운 그라데이션이 되므로
 *   실제 이미지가 없어도 완성 여부가 한눈에 보인다 (§9 원본 이미지 노출의 대용).
 * - 빈 칸(§4 마지막 조각)은 그리지 않는다. 보이지 않는 칸은 눌리지도 않는다.
 * - 지금 누를 수 있는 조각(§5)에 테두리 강조를 준다 - Emissive 연출의 대용이다.
 *
 * ## 붙이는 법
 *
 * `Documents/생성 문서/가이드/에디터_퍼즐_셋업.md` 와 동일하다. 빈 엔티티에 이 스크립트를
 * Local 모드로 붙이고, 같은 월드의 `PuzzleBoardUI_Panel` 과 함께
 * `Puzzle_LocalOwnership` 의 targets 에 넣는다.
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
import { SlidePuzzleLevelGenerator } from 'SlidePuzzle_LevelGenerator';
import { SlidePuzzleEvents } from 'SlidePuzzle_GameEvents';
import { SlidePuzzleTables } from 'SlidePuzzle_DataTables';
import { SlidePuzzleSession } from 'SlidePuzzle_Session';
import {
	SlidePuzzleLevel,
	SlidePuzzleResultData,
	getBlankTileIndex,
} from 'SlidePuzzle_Definitions';

/** 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - SWITCH_READY 와 같은 규약 */
export const SLIDE_PUZZLE_READY = new EventPublisher<SlidePuzzleCoreAPI>();

/** 조각 색의 밝기 하한과 폭 - 너무 어두우면 칸 위 숫자가 묻힌다 */
const TILE_TONE_BASE = 0.25;
const TILE_TONE_RANGE = 0.6;

const COLOR_LABEL: PuzzleBoardColor = boardColor(1, 1, 1);

/**
 * 이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
 * 에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.
 */
/** 조각 */
const TEXTURE_PIECE: PuzzleTextureKey = textureKey('slidePuzzle', 'piece');
/** 빈 칸 */
const TEXTURE_EMPTY: PuzzleTextureKey = textureKey('slidePuzzle', 'empty');
/** 격자 뒤에 까는 판 그림 */
const TEXTURE_BOARD: PuzzleTextureKey = textureKey('slidePuzzle', 'board');

export class SlidePuzzleCoreAPI extends Component<typeof SlidePuzzleCoreAPI> {
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
		/** 조각 */
		pieceTexture: { type: PropTypes.Asset },
		/** 빈 칸 */
		emptyTexture: { type: PropTypes.Asset },
		/** 격자 뒤에 까는 판 그림 */
		boardTexture: { type: PropTypes.Asset },
	};

	public static instance: SlidePuzzleCoreAPI | undefined = undefined;

	public events!: SlidePuzzleEvents;
	public session!: SlidePuzzleSession;
	public tables!: SlidePuzzleTables;

	private _presenter!: PuzzleBoardPresenter;

	/** 지금 프레젠터에 잡혀 있는 격자 한 변. 레벨이 바뀌면 갱신한다 */
	private _divideNum: number = 0;

	/** 지금 테두리 강조가 켜져 있는 칸들 - 다음 갱신 때 꺼야 한다 */
	private _highlightedPositions: number[] = [];

	private _isInteractionActive: boolean = false;

	//#region Lifecycle

	public start(): void {
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			console.log('[SlidePuzzleCoreAPI] Server instance. Waiting for ownership transfer. '
				+ '(If only this log appears without the "local start" log, set the script execution mode to Local '
				+ 'and make sure this entity is in Puzzle_LocalOwnership targets.)');
			return;
		}

		console.log('[SlidePuzzleCoreAPI] Started on the local client. Ownership transfer OK.');

		this.constructSystems();

		if (this.props.autoStart) {
			this.startQuestByDifficulty(this.props.difficulty);
		}
	}

	public dispose(): void {
		PuzzleBoardStage.instance.unmount(this._presenter);
		this.releaseInteraction();
		if (SlidePuzzleCoreAPI.instance === this) {
			SlidePuzzleCoreAPI.instance = undefined;
		}
	}

	private constructSystems(): void {
		this.tables = new SlidePuzzleTables();
		this.events = new SlidePuzzleEvents();
		this.session = new SlidePuzzleSession(
			this.events,
			this.tables,
			new SlidePuzzleLevelGenerator(this.tables),
			{ seed: this.props.seed > 0 ? this.props.seed : undefined },
		);

		this.registerTextures();
		this.createPresenter();
		this.subscribeToSessionEvents();

		// 이것을 빠뜨리면 제한 시간이 흐르지 않고 0.25초 미끄러짐 연출도 끝나지 않는다 (§6)
		connectPuzzleUpdate(this, (deltaSeconds) => this.session.update(deltaSeconds));

		PuzzleHubRegistry.instance.register(createPuzzleHandle(
			EPuzzleId.SLIDE_PUZZLE,
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

		SlidePuzzleCoreAPI.instance = this;
		SLIDE_PUZZLE_READY.publish(this);
	}

	/**
	 * 보드 프레젠터를 만든다.
	 *
	 * 격자 크기는 레벨마다 달라지므로 여기서는 최소값(3×3)으로 잡고
	 * `onLevelLoaded()` 에서 실제 크기로 갈아 끼운다.
	 */
	/**
	 * 에디터 prop 의 텍스처 애셋을 키에 붙인다.
	 *
	 * **프레젠터를 만들기 전에** 부른다. 순서가 뒤집혀도 패널이 세대를 올려 다시 그리지만,
	 * 먼저 등록해 두면 첫 프레임부터 그림이 붙는다.
	 */
	private registerTextures(): void {
		const count = PuzzleTextureLibrary.instance.registerAll([
			{ key: TEXTURE_PIECE, asset: this.props.pieceTexture },
			{ key: TEXTURE_EMPTY, asset: this.props.emptyTexture },
			{ key: TEXTURE_BOARD, asset: this.props.boardTexture },
		]);
		console.log(`[SlidePuzzleCoreAPI] Registered ${count} textures. `
			+ 'Elements without one are drawn with a flat colour.');
	}

	private createPresenter(): void {
		this._divideNum = 3;
		this._presenter = new PuzzleBoardPresenter(
			{
				title: getCatalogEntry(EPuzzleId.SLIDE_PUZZLE)?.displayName ?? '',
				rowCount: this._divideNum,
				colCount: this._divideNum,
				boardTexture: TEXTURE_BOARD,
			},
			{
				// 탭 전용이다 - 누른 칸에서 떼야 확정된다 (PUZ_00 §8.1 단일 터치)
				// 누르는 **순간** 민다 - 릴리즈(탭 완료)를 기다리면 손가락이 떨어질 때까지의
				// 시간(대략 0.1초)이 통째로 지연으로 느껴진다. 색 채우기의 onAction 과 같은 원칙이다.
				onCellDown: (cell) => { this.session.pressPiece(cell); },
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

		// §6 - 0.25초 미끄러짐이 끝난 시점의 배치를 반영한다.
		// 시작 시점에 그리면 조각이 두 칸에 동시에 보인다 (보드 배열은 press() 에서 이미 바뀐다).
		this.events.PIECE_MOVE_FINISHED.subscribe(() => this.applyGridVisuals());

		// §5 - 지금 누를 수 있는 조각에 테두리 강조
		this.events.MOVABLE_POSITIONS_CHANGED.subscribe(this.onMovablePositionsChanged.bind(this));

		this.events.PUZZLE_COMPLETED.subscribe(this.onPuzzleCompleted.bind(this));

		this.events.QUEST_CLEAR.subscribe(this.onQuestEnd.bind(this));
		this.events.QUEST_FAILED.subscribe(this.onQuestEnd.bind(this));
	}

	private onLevelLoaded(level: SlidePuzzleLevel): void {
		// §11 iDivideNum 이 3 <-> 4 로 바뀌므로 격자를 갈아 끼운다.
		// resetLayout() 은 칸 내용을 전부 초기화하므로 곧바로 다시 칠한다.
		if (level.divideNum !== this._divideNum) {
			this._divideNum = level.divideNum;
			this._presenter.resetLayout({
				title: getCatalogEntry(EPuzzleId.SLIDE_PUZZLE)?.displayName ?? '',
				rowCount: level.divideNum,
				colCount: level.divideNum,
				boardTexture: TEXTURE_BOARD,
			});
		}

		this._highlightedPositions = [];
		this.applyGridVisuals();

		PuzzleBoardStage.instance.mount(this._presenter);
		this._presenter.setInputEnabled(true);
	}

	private onMovablePositionsChanged(positions: number[]): void {
		// 강조와 함께 인터랙션 가능 여부도 옮긴다 - 빈칸에서 멀어진 조각은 정적이 된다
		for (const position of this._highlightedPositions) {
			this._presenter.setCell(position, { isHighlighted: false, isInteractive: false });
		}
		for (const position of positions) {
			this._presenter.setCell(position, { isHighlighted: true, isInteractive: true });
		}
		this._highlightedPositions = positions.slice();
	}

	/** §9 - 완성. 강조를 걷고 입력을 막아 완성된 그림만 남긴다 */
	private onPuzzleCompleted(imagePath: string): void {
		this.onMovablePositionsChanged([]);
		this._presenter.setInputEnabled(false);
		this.applyGridVisuals();
		console.log(`[SlidePuzzleCoreAPI] Puzzle completed (image: ${imagePath}).`);
	}

	private onQuestEnd(result: SlidePuzzleResultData): void {
		// 허브의 결과 화면이 화면을 덮어야 하므로 보드를 내린다.
		// BoardPanel 과 HubPanel 은 서로 다른 gizmo 라 z-order 를 코드가 정할 수 없다.
		// 한 번에 하나만 그리게 두면 어느 쪽이 위든 결과 화면이 확실히 보인다.
		this._presenter.setInputEnabled(false);
		PuzzleBoardStage.instance.unmount(this._presenter);
		console.log(`[SlidePuzzleCoreAPI] Quest ended: ${result.result} `
			+ `(${result.remainingTimeSeconds}s remaining, ${result.misplacedPieceCount} pieces misplaced)`);
	}

	/** 전체 격자를 현재 배치로 다시 칠한다 */
	private applyGridVisuals(): void {
		const board = this.session.board;
		if (board === undefined) {
			return;
		}

		const blankTile = getBlankTileIndex(this._divideNum);
		const cellCount = this._divideNum * this._divideNum;
		// 인터랙션 규격: **빈칸에 인접해 실제로 움직일 수 있는 조각만** 만질 수 있다
		const movablePositions = board.getMovablePositions();
		for (let position = 0; position < cellCount; position++) {
			const tile = board.getTileAt(position);
			if (tile === undefined || tile === blankTile) {
				// §4 - 마지막 조각 자리는 언제나 비어 있다. 그리지 않으므로 눌리지도 않는다.
				this._presenter.setCell(position, { isVisible: false, texture: TEXTURE_EMPTY, label: '' });
				continue;
			}
			this._presenter.setCell(position, {
				isVisible: true,
				isInteractive: movablePositions.indexOf(position) >= 0,
				fill: this.getTileColor(tile),
				texture: TEXTURE_PIECE,
				label: `${tile + 1}`,
				labelColor: COLOR_LABEL,
			});
		}
	}

	/**
	 * 조각 색 - **완성 위치**에서 뽑는다.
	 *
	 * 원본 이미지 대신 좌상 -> 우하 그라데이션을 쓰므로, 다 맞추면 색이 매끄럽게 이어지고
	 * 어긋난 조각은 색이 튄다. 실제 이미지 텍스처가 들어오면 이 함수만 교체하면 된다.
	 */
	private getTileColor(tileIndex: number): PuzzleBoardColor {
		const divide = this._divideNum;
		const homeRow = Math.floor(tileIndex / divide);
		const homeCol = tileIndex % divide;
		const rowRatio = divide <= 1 ? 0 : homeRow / (divide - 1);
		const colRatio = divide <= 1 ? 0 : homeCol / (divide - 1);
		return boardColor(
			TILE_TONE_BASE + TILE_TONE_RANGE * colRatio,
			TILE_TONE_BASE + TILE_TONE_RANGE * (1 - rowRatio * 0.5 - colRatio * 0.5),
			TILE_TONE_BASE + TILE_TONE_RANGE * rowRatio,
		);
	}

	//#endregion
}
Component.register(SlidePuzzleCoreAPI);
