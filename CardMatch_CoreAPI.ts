/**
 * Card Match Core API - PUZ_06 카드 맞추기 퍼즐을 실제 월드에서 구동하는 Horizon Component
 *
 * `Switch_CoreAPI` 와 같은 구조다. 세션 타입과 칸 색 번역만 다르고 브리지·보드 UI·
 * 소유권 컴포넌트는 그대로 재사용한다
 * (`Documents/생성 문서/구현 사항/작업기록_2026-09-02_보드_CustomUI_전환.md` §6.3).
 *
 * ## 이 퍼즐의 표현 결정
 *
 * - 격자 크기가 필드 데이터마다 다르다 (§8 iTileArrayX/Y, 3×3 ~ 5×5). 슬라이드 퍼즐과 같이
 *   레벨을 불러올 때마다 `resetLayout()` 으로 갈아 끼운다.
 * - 칸 색은 §6 의 상태 전이를 그대로 따른다.
 *     뒷면 검정  ->  활성화 파랑  ->  (짝 성공) 녹색 / (짝 실패) 다시 검정
 *   폭탄이 드러난 칸은 붉은색으로 굳는다 (§3.3 - 재선택 불가).
 * - 활성화된 칸에는 오브젝트 ID 앞 세 글자를 적는다. 메시가 붙기 전까지 짝을 구분하는 수단이며,
 *   실제 메시(`meshPath`)가 들어오면 이 라벨 대신 이미지로 바꾸면 된다.
 * - 폭탄 셔플(§4) 동안에는 입력을 잠근다. 세션도 거절하지만 눌러도 반응이 없어야 하므로
 *   프레젠터 쪽에서도 함께 막는다.
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
import { CardMatchLevelGenerator } from 'CardMatch_LevelGenerator';
import { CardMatchEvents } from 'CardMatch_GameEvents';
import { CardMatchTables } from 'CardMatch_DataTables';
import { CardMatchSession } from 'CardMatch_Session';
import {
	CardMatchLevel,
	CardMatchResultData,
	CardTile,
	ETileState,
} from 'CardMatch_Definitions';

/** 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - SWITCH_READY 와 같은 규약 */
export const CARD_MATCH_READY = new EventPublisher<CardMatchCoreAPI>();

/** §6 - 뒷면(기본) */
const COLOR_HIDDEN: PuzzleBoardColor = boardColor(0.14, 0.15, 0.2);
/** §6 - 활성화되어 오브젝트가 보이는 중 */
const COLOR_REVEALED: PuzzleBoardColor = boardColor(0.2, 0.45, 0.9);
/** §6 - 짝이 맞아 완료 */
const COLOR_MATCHED: PuzzleBoardColor = boardColor(0.15, 0.75, 0.35);
/** §3.3 - 드러난 폭탄. 재선택 불가 */
const COLOR_BOMB: PuzzleBoardColor = boardColor(0.85, 0.2, 0.2);

const COLOR_LABEL: PuzzleBoardColor = boardColor(1, 1, 1);

/** 오브젝트 ID 에서 떼어 내는 접두사 - 'OBJ_GEAR' -> 'GEA' */
const OBJECT_ID_PREFIX = 'OBJ_';
const OBJECT_LABEL_LENGTH = 3;

/** 폭탄 칸의 라벨 - §1 셔플 기믹임을 알린다 */
const BOMB_LABEL = '!';

/**
 * 이 퍼즐의 텍스처 키. 에디터 prop 과 1:1 로 대응한다.
 * 에셋을 끼우지 않은 키는 라이브러리에 등록되지 않으므로 색으로 그려진다.
 */
/** 뒤집히지 않은 카드 뒷면 */
const TEXTURE_HIDDEN: PuzzleTextureKey = textureKey('cardMatch', 'hidden');
/** 뒤집힌 카드 */
const TEXTURE_REVEALED: PuzzleTextureKey = textureKey('cardMatch', 'revealed');
/** 짝이 맞아 완료된 카드 */
const TEXTURE_MATCHED: PuzzleTextureKey = textureKey('cardMatch', 'matched');
/** 폭탄 카드 */
const TEXTURE_BOMB: PuzzleTextureKey = textureKey('cardMatch', 'bomb');
/** 격자 뒤에 까는 판 그림 */
const TEXTURE_BOARD: PuzzleTextureKey = textureKey('cardMatch', 'board');

export class CardMatchCoreAPI extends Component<typeof CardMatchCoreAPI> {
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
		/** 뒤집히지 않은 카드 뒷면 */
		hiddenTexture: { type: PropTypes.Asset },
		/** 뒤집힌 카드 */
		revealedTexture: { type: PropTypes.Asset },
		/** 짝이 맞아 완료된 카드 */
		matchedTexture: { type: PropTypes.Asset },
		/** 폭탄 카드 */
		bombTexture: { type: PropTypes.Asset },
		/** 격자 뒤에 까는 판 그림 */
		boardTexture: { type: PropTypes.Asset },
	};

	public static instance: CardMatchCoreAPI | undefined = undefined;

	public events!: CardMatchEvents;
	public session!: CardMatchSession;
	public tables!: CardMatchTables;

	private _presenter!: PuzzleBoardPresenter;

	/** 지금 프레젠터에 잡혀 있는 격자 크기 */
	private _rowCount: number = 0;
	private _colCount: number = 0;

	/**
	 * 오브젝트 ID -> 짝 번호 (1부터). 레벨 로드 때 배정한다.
	 * 오브젝트 ID 머리글자를 그대로 라벨로 쓰면 ID 들이 같은 접두사를 공유할 때
	 * 모든 카드가 같은 글자로 보인다 - 짝 번호는 같은 짝의 두 카드만 같은 숫자가 되게 한다.
	 */
	private readonly _pairNumberByObjectId: Map<string, number> = new Map<string, number>();

	private _isInteractionActive: boolean = false;

	//#region Lifecycle

	public start(): void {
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			console.log('[CardMatchCoreAPI] Server instance. Waiting for ownership transfer. '
				+ '(If only this log appears without the "local start" log, set the script execution mode to Local '
				+ 'and make sure this entity is in Puzzle_LocalOwnership targets.)');
			return;
		}

		console.log('[CardMatchCoreAPI] Started on the local client. Ownership transfer OK.');

		this.constructSystems();

		if (this.props.autoStart) {
			this.startQuestByDifficulty(this.props.difficulty);
		}
	}

	public dispose(): void {
		PuzzleBoardStage.instance.unmount(this._presenter);
		this.releaseInteraction();
		if (CardMatchCoreAPI.instance === this) {
			CardMatchCoreAPI.instance = undefined;
		}
	}

	private constructSystems(): void {
		this.tables = new CardMatchTables();
		this.events = new CardMatchEvents();
		this.session = new CardMatchSession(
			this.events,
			this.tables,
			new CardMatchLevelGenerator(this.tables),
			{ seed: this.props.seed > 0 ? this.props.seed : undefined },
		);

		this.registerTextures();
		this.createPresenter();
		this.subscribeToSessionEvents();

		// 이것을 빠뜨리면 제한 시간도, 짝 실패 후 되돌아가는 연출(§6)도, 폭탄 셔플(§4)도 끝나지 않는다
		connectPuzzleUpdate(this, (deltaSeconds) => this.session.update(deltaSeconds));

		PuzzleHubRegistry.instance.register(createPuzzleHandle(
			EPuzzleId.CARD_MATCH,
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

		CardMatchCoreAPI.instance = this;
		CARD_MATCH_READY.publish(this);
	}

	/** 격자 크기는 레벨마다 달라지므로 최소값으로 잡고 `onLevelLoaded()` 에서 갈아 끼운다 */
	/**
	 * 에디터 prop 의 텍스처 애셋을 키에 붙인다.
	 *
	 * **프레젠터를 만들기 전에** 부른다. 순서가 뒤집혀도 패널이 세대를 올려 다시 그리지만,
	 * 먼저 등록해 두면 첫 프레임부터 그림이 붙는다.
	 */
	private registerTextures(): void {
		const count = PuzzleTextureLibrary.instance.registerAll([
			{ key: TEXTURE_HIDDEN, asset: this.props.hiddenTexture },
			{ key: TEXTURE_REVEALED, asset: this.props.revealedTexture },
			{ key: TEXTURE_MATCHED, asset: this.props.matchedTexture },
			{ key: TEXTURE_BOMB, asset: this.props.bombTexture },
			{ key: TEXTURE_BOARD, asset: this.props.boardTexture },
		]);
		console.log(`[CardMatchCoreAPI] Registered ${count} textures. `
			+ 'Elements without one are drawn with a flat colour.');
	}

	private createPresenter(): void {
		this._rowCount = 3;
		this._colCount = 3;
		this._presenter = new PuzzleBoardPresenter(
			{
				title: getCatalogEntry(EPuzzleId.CARD_MATCH)?.displayName ?? '',
				rowCount: this._rowCount,
				colCount: this._colCount,
				boardTexture: TEXTURE_BOARD,
			},
			{
				// 탭 전용이다 - 드래그가 없다 (PUZ_06 인터랙션 절)
				onCellTap: (cell) => { this.session.revealTile(cell); },
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

		// §6 의 상태 전이는 전부 타일 index 목록으로 오므로 그 칸만 다시 칠하면 된다
		this.events.TILE_REVEALED.subscribe((result) => this.applyCellVisual(result.tileIndex));
		this.events.TILES_MATCHED.subscribe(this.applyCellVisuals.bind(this));
		this.events.TILES_MISMATCHED.subscribe(this.applyCellVisuals.bind(this));
		this.events.TILES_HIDDEN.subscribe(this.applyCellVisuals.bind(this));

		// §4 - 셔플 동안은 입력과 제한 시간이 멈춘다. 배정이 통째로 바뀌므로 전체를 다시 칠한다.
		this.events.BOMB_TRIGGERED.subscribe(this.onBombTriggered.bind(this));
		this.events.BOMB_SHUFFLE_FINISHED.subscribe(this.onBombShuffleFinished.bind(this));

		this.events.QUEST_CLEAR.subscribe(this.onQuestEnd.bind(this));
		this.events.QUEST_FAILED.subscribe(this.onQuestEnd.bind(this));
	}

	private onLevelLoaded(level: CardMatchLevel): void {
		// §8 iTileArrayX/Y 는 필드 데이터마다 다르다 (3×3 ~ 5×5)
		if (level.rows !== this._rowCount || level.cols !== this._colCount) {
			this._rowCount = level.rows;
			this._colCount = level.cols;
			this._presenter.resetLayout({
				title: getCatalogEntry(EPuzzleId.CARD_MATCH)?.displayName ?? '',
				rowCount: level.rows,
				colCount: level.cols,
				boardTexture: TEXTURE_BOARD,
			});
		}

		// 짝마다 고유 번호를 붙인다 - 오브젝트 ID 의 머리글자가 서로 같아 라벨이 전부
		// 똑같이 보이던 것을 고친다. 같은 짝의 두 카드만 같은 숫자를 보인다.
		this._pairNumberByObjectId.clear();
		let nextPairNumber = 1;
		for (const tile of level.tiles) {
			if (tile.objectId === undefined || this._pairNumberByObjectId.has(tile.objectId)) {
				continue;
			}
			this._pairNumberByObjectId.set(tile.objectId, nextPairNumber);
			nextPairNumber++;
		}

		this.applyGridVisuals();

		PuzzleBoardStage.instance.mount(this._presenter);
		this._presenter.setInputEnabled(true);
	}

	private onBombTriggered(payload: { tileIndex: number, shuffledTileIndexes: number[] }): void {
		// 먼저 폭탄 칸을 붉게 굳히고 입력을 잠근다. 셔플이 끝날 때까지 아무 칸도 눌리지 않는다.
		this._presenter.setInputEnabled(false);
		this.applyGridVisuals();
		console.log(`[CardMatchCoreAPI] Bomb at tile ${payload.tileIndex} shuffled `
			+ `${payload.shuffledTileIndexes.length} tiles. Input locked until the shuffle ends.`);
	}

	private onBombShuffleFinished(): void {
		this.applyGridVisuals();
		// 퀘스트가 이미 끝났다면 다시 열지 않는다 (셔플 도중 시간이 다 될 수 있다)
		if (this.session.isActive) {
			this._presenter.setInputEnabled(true);
		}
	}

	private onQuestEnd(result: CardMatchResultData): void {
		// 허브의 결과 화면이 화면을 덮어야 하므로 보드를 내린다.
		// BoardPanel 과 HubPanel 은 서로 다른 gizmo 라 z-order 를 코드가 정할 수 없다.
		// 한 번에 하나만 그리게 두면 어느 쪽이 위든 결과 화면이 확실히 보인다.
		this._presenter.setInputEnabled(false);
		PuzzleBoardStage.instance.unmount(this._presenter);
		console.log(`[CardMatchCoreAPI] Quest ended: ${result.result} `
			+ `(${result.remainingTimeSeconds}s remaining, ${result.remainingObjectTileCount} tiles left)`);
	}

	private applyCellVisuals(indexes: number[]): void {
		for (const index of indexes) {
			this.applyCellVisual(index);
		}
	}

	private applyGridVisuals(): void {
		const cellCount = this._rowCount * this._colCount;
		for (let index = 0; index < cellCount; index++) {
			this.applyCellVisual(index);
		}
	}

	/** 칸 하나를 상태에 맞춰 칠한다 - §6 검정 -> 파랑 -> 녹색 */
	private applyCellVisual(index: number): void {
		const tile = this.session.board?.getTile(index);
		if (tile === undefined) {
			this._presenter.setCell(index, { isVisible: false, label: '' });
			return;
		}

		this._presenter.setCell(index, {
			isVisible: true,
			// 인터랙션 규격: **아직 열지 않은 카드만** 만질 수 있다.
			// 열린 카드·완료된 짝·드러난 폭탄은 정적이라 눌러도 감지가 일어나지 않는다.
			isInteractive: tile.state !== ETileState.REVEALED
				&& tile.state !== ETileState.MATCHED
				&& tile.state !== ETileState.BOMB_REVEALED,
			fill: this.getTileColor(tile),
			texture: this.getTileTexture(tile),
			label: this.getTileLabel(tile),
			labelColor: COLOR_LABEL,
			// 완료·폭탄 칸은 다시 고를 수 없으므로 강조하지 않는다 (§4)
			isHighlighted: tile.state === ETileState.REVEALED,
		});
	}

	/** 색과 같은 갈래를 탄다 - 그림을 끼우지 않은 상태는 색으로만 그려진다 */
	private getTileTexture(tile: CardTile): PuzzleTextureKey {
		if (tile.state === ETileState.BOMB_REVEALED) {
			return TEXTURE_BOMB;
		}
		if (tile.state === ETileState.MATCHED) {
			return TEXTURE_MATCHED;
		}
		if (tile.state === ETileState.REVEALED) {
			return TEXTURE_REVEALED;
		}
		return TEXTURE_HIDDEN;
	}

	private getTileColor(tile: CardTile): PuzzleBoardColor {
		if (tile.state === ETileState.BOMB_REVEALED) {
			return COLOR_BOMB;
		}
		if (tile.state === ETileState.MATCHED) {
			return COLOR_MATCHED;
		}
		if (tile.state === ETileState.REVEALED) {
			return COLOR_REVEALED;
		}
		return COLOR_HIDDEN;
	}

	/**
	 * 활성화된 칸에만 오브젝트 이름을 적는다.
	 * 뒷면 칸에 적으면 기억력 퍼즐이 성립하지 않는다 (§3).
	 */
	private getTileLabel(tile: CardTile): string {
		if (tile.state === ETileState.BOMB_REVEALED) {
			return BOMB_LABEL;
		}
		if (tile.state !== ETileState.REVEALED && tile.state !== ETileState.MATCHED) {
			return '';
		}
		// 짝 번호를 보인다 - 같은 짝의 두 카드만 같은 숫자다 (onLevelLoaded 에서 배정).
		// 배정이 없는 오브젝트(방어)는 예전처럼 ID 머리글자로 떨어진다.
		const pairNumber = tile.objectId === undefined
			? undefined
			: this._pairNumberByObjectId.get(tile.objectId);
		return pairNumber !== undefined ? String(pairNumber) : toObjectLabel(tile.objectId);
	}

	//#endregion
}

/** 'OBJ_GEAR' -> 'GEA'. 오브젝트 메시가 붙기 전까지 짝을 눈으로 구분하는 수단이다 */
function toObjectLabel(objectId: string | undefined): string {
	if (objectId === undefined) {
		return BOMB_LABEL;
	}
	const body = objectId.indexOf(OBJECT_ID_PREFIX) === 0 ? objectId.substring(OBJECT_ID_PREFIX.length) : objectId;
	return body.substring(0, OBJECT_LABEL_LENGTH);
}

Component.register(CardMatchCoreAPI);
