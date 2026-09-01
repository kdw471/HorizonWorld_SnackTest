/**
 * Switch Core API - PUZ_08 스위치 퍼즐을 실제 월드에서 구동하는 Horizon Component
 *
 * **8개 퍼즐 Horizon 통합의 레퍼런스 구현이다.** 다른 퍼즐도 이 구조를 그대로 복제하면 된다.
 *
 * 붙이는 법
 * ---------
 *   1. 월드에 빈 엔티티를 하나 만들고 이 스크립트를 붙인다.
 *   2. `boardCentre` 에 키 판 중심이 될 엔티티를 넣는다.
 *      그 엔티티의 right = +col, up = -row, forward = 화면 바깥 방향이 된다.
 *   3. `keyCapRoot` 에 키 캡 25개를 자식으로 가진 부모 엔티티 하나를 넣는다.
 *      자식 이름을 `KeyCap_00` ~ `KeyCap_24` 처럼 **자리수를 맞춰** 붙이면
 *      이름 오름차순 = A1..E5 (row-major) 순서가 된다.
 *      비워 두면 로직만 돌고 연출은 생략된다 (헤드리스 확인용).
 *   4. 같은 월드에 `InputScreenListener`(Basics_Input_Screen.ts)가 붙은 엔티티가 있어야 한다.
 *      터치 입력이 거기서 나온다.
 *   5. `autoStart` 를 켜면 시작과 동시에 `difficulty` 퀘스트가 돈다.
 *      퍼즐 트리거(PUZ_00 §1)에서 시작하고 싶으면 끄고 startQuest() 를 직접 부른다.
 *
 * 이 파일이 하는 일은 셋뿐이다.
 *   - 순수 로직(SwitchSession)을 만들고 매 프레임 update 를 돌린다
 *   - 터치를 격자 좌표로 바꿔 세션에 넘긴다
 *   - 세션이 내는 이벤트를 구독해 3D 오브젝트를 갱신한다
 * 규칙 판정은 한 줄도 여기 있지 않다 (PUZ_00 §7.1).
 */

import { Color, Component, Entity, MeshEntity, PropTypes } from 'horizon/core';
import { EventPublisher } from 'Utility_Events';
import { PuzzleBoardMapper, PuzzleTouchRouter, collectChildEntities, connectPuzzleUpdate, enterPuzzleInteraction, exitPuzzleInteraction } from 'Puzzle_HorizonBridge';
import { EPuzzleId } from 'PuzzleUI_Definitions';
import { PuzzleHubRegistry, createPuzzleHandle, probePuzzleDifficulties } from 'PuzzleUI_Registry';
import { SwitchLevelGenerator } from 'Switch_LevelGenerator';
import { SwitchPuzzleEvents } from 'Switch_GameEvents';
import { SwitchPuzzleTables } from 'Switch_DataTables';
import { SwitchSession } from 'Switch_Session';
import {
	ESwitchCellState,
	KEY_PLATE_SIZE_CM,
	SWITCH_BOARD_SIZE,
	SWITCH_CELL_COUNT,
	SwitchLevel,
	SwitchPressResult,
	SwitchPuzzleResultData,
} from 'Switch_Definitions';

/** 다른 시스템(UI, 퀘스트 매니저)이 이 퍼즐에 접근할 수 있게 알린다 - BASICS_READY 와 같은 규약 */
export const SWITCH_READY = new EventPublisher<SwitchCoreAPI>();

/** §5 - 눌린 키 캡은 녹색, 안 눌린 키 캡은 빨간색 */
const COLOR_PRESSED = new Color(0.15, 0.85, 0.3);
const COLOR_UNPRESSED = new Color(0.9, 0.2, 0.2);

export class SwitchCoreAPI extends Component<typeof SwitchCoreAPI> {
	public static propsDefinition = {
		/** 키 판의 중심. 이 엔티티의 right/up/forward 가 보드 평면을 정의한다 */
		boardCentre: { type: PropTypes.Entity },
		/**
		 * 키 캡 25개를 자식으로 가진 부모 엔티티.
		 *
		 * 25개를 일일이 연결하는 대신 루트 하나만 지정한다.
		 * 자식 이름을 `KeyCap_00` ~ `KeyCap_24` 로 **자리수를 맞춰** 붙이면
		 * 이름 오름차순이 곧 A1..E5 (row-major) 순서가 된다.
		 * 비워 두면 연출 없이 로직만 돈다.
		 */
		keyCapRoot: { type: PropTypes.Entity },
		/** 칸 간격 (미터). §3 의 7cm 가 기본값이다 */
		cellSpacing: { type: PropTypes.Number, default: KEY_PLATE_SIZE_CM / 100 },
		/** 시작할 난이도 (1~5) */
		difficulty: { type: PropTypes.Number, default: 1 },
		/** 컴포넌트 시작과 동시에 퀘스트를 시작할지 */
		autoStart: { type: PropTypes.Boolean, default: true },
		/** 레벨 생성 시드. 0 이면 매번 다른 레벨 */
		seed: { type: PropTypes.Number, default: 0 },
		/**
		 * 카메라를 놓을 엔티티. **보통은 비워 둔다.**
		 * 비우면 `boardCentre` 정면에 `cameraDistance` 만큼 띄워 자동 배치하므로
		 * 빈 엔티티를 손으로 회전시킬 필요가 없다.
		 */
		cameraObject: { type: PropTypes.Entity },
		/** 보드에서 카메라까지 거리 (m). 0 이면 카메라를 건드리지 않는다 */
		cameraDistance: { type: PropTypes.Number, default: 0.6 },
		/** 카메라 시야각 */
		cameraFov: { type: PropTypes.Number, default: 40 },
	};

	public static instance: SwitchCoreAPI | undefined = undefined;

	public events!: SwitchPuzzleEvents;
	public session!: SwitchSession;
	public tables!: SwitchPuzzleTables;

	private _mapper!: PuzzleBoardMapper;
	private _touchRouter: PuzzleTouchRouter | undefined = undefined;

	/** Focused Interaction 에 들어가 있는지 - 중복 진입과 미해제 갇힘을 막는다 */
	private _isInteractionActive: boolean = false;

	/**
	 * 격자 순서로 정렬한 키 캡들. `keyCapRoot` 의 자식에서 한 번만 모아 캐시한다.
	 * `children.get()` 과 `name.get()` 은 매번 브리지를 건너므로 프레임마다 부르면 안 된다.
	 */
	private _keyCaps: Entity[] = [];

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
		// 소유권 이탈 등으로 컴포넌트가 내려갈 때 전역 터치 이벤트 구독과 포커스 모드를 반드시 정리한다.
		// 정리하지 않으면 죽은 세션이 터치를 계속 받고, 플레이어는 고정 카메라에 갇힌다.
		this._touchRouter?.dispose();
		this._touchRouter = undefined;
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

		this._mapper = new PuzzleBoardMapper({
			rowCount: SWITCH_BOARD_SIZE,
			colCount: SWITCH_BOARD_SIZE,
			cellSpacing: this.props.cellSpacing,
		});

		this.subscribeToSessionEvents();
		this.connectInput();

		// 이것을 빠뜨리면 제한 시간이 흐르지 않고 0.4초 누름 연출도 끝나지 않는다
		connectPuzzleUpdate(this, (deltaSeconds) => this.session.update(deltaSeconds));

		// 메인 UI(PuzzleUI_MainPanel)가 이 퍼즐을 목록에 띄우고 시작/일시정지/포기를
		// 조종할 수 있도록 정규화 핸들을 등록한다.
		PuzzleHubRegistry.instance.register(createPuzzleHandle(
			EPuzzleId.SWITCH,
			{
				startQuestByDifficulty: (difficulty) => this.startQuestByDifficulty(difficulty),
				pause: () => this.pause(),
				resume: () => this.resume(),
				abort: () => this.abort(),
				getRemainingTimeSeconds: () => this.session.getRemainingTimeSeconds(),
				getRoundProgress: () => this.session.getRoundProgress(),
			},
			this.events,
			probePuzzleDifficulties((difficulty) => this.tables.getQuestByDifficulty(difficulty)),
		));

		SwitchCoreAPI.instance = this;
		SWITCH_READY.publish(this);
	}

	//#endregion

	//#region Focused interaction lifecycle

	/**
	 * **터치 입력의 전제 조건.** Focused Interaction 모드에 들어가야
	 * Basics_Input_Screen 의 터치 이벤트가 발생한다 (진행 문서 §10.1-1).
	 * 퀘스트를 시작할 때 들어가고, 메뉴로 돌아갈 때(abort) 나온다.
	 */
	private enterInteraction(): void {
		if (this._isInteractionActive) {
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

	public startQuestByDifficulty(difficulty: number): boolean {
		this.enterInteraction();
		return this.session.startQuestByDifficulty(difficulty);
	}

	public startQuest(questId: string): boolean {
		this.enterInteraction();
		return this.session.startQuest(questId);
	}

	public pause(): void {
		this.session.pause();
		this._touchRouter?.setEnabled(false);
	}

	public resume(): void {
		this.session.resume();
		this._touchRouter?.setEnabled(true);
	}

	/** 퀘스트를 버리고 대기 상태로 - 조작과 카메라를 플레이어에게 돌려준다 */
	public abort(): void {
		this.session.abort();
		this._touchRouter?.setEnabled(false);
		this.releaseInteraction();
	}

	//#endregion

	//#region Input (§7 을 모바일로 대체 - PUZ_08 문서 M1/M2)

	private connectInput(): void {
		this._touchRouter = new PuzzleTouchRouter(this._mapper, {
			onBegin: (point) => {
				const cell = this._mapper.toCellIndex(point);
				if (cell === undefined) {
					return;
				}
				// M2 - 다운만으로는 눌리지 않는다. 같은 키 캡 위에서 떼야 확정된다.
				this.session.touchDown(cell);
			},
			onMove: (point) => {
				// 보드 밖으로 나가면 -1 을 넘겨 "다운한 칸 밖" 으로 만든다 -> 뗄 때 취소된다
				const cell = this._mapper.toCellIndex(point);
				this.session.touchMove(cell ?? -1);
			},
			onEnd: () => {
				this.session.touchUp();
			},
		});
	}

	//#endregion

	//#region Presentation (세션 이벤트 -> 3D 오브젝트)

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
		const boardCentre = this.props.boardCentre;
		if (boardCentre === undefined) {
			console.warn('[SwitchCoreAPI] boardCentre is empty; cannot place the board.');
			return;
		}

		// 보드 평면 기저를 여기서 한 번만 읽는다 (터치마다 읽으면 비싸다)
		this._mapper.refreshFrom(boardCentre);

		// 자식 목록은 라운드마다 바뀌지 않으므로 한 번만 모은다
		if (this._keyCaps.length === 0) {
			this._keyCaps = collectChildEntities(this.props.keyCapRoot ?? undefined, {
				expectedCount: SWITCH_CELL_COUNT,
				label: 'keyCapRoot',
			});
		}

		const keyCaps = this._keyCaps;
		if (keyCaps.length === 0) {
			return;
		}

		for (let cell = 0; cell < SWITCH_CELL_COUNT; cell++) {
			const entity = keyCaps[cell];
			if (entity === undefined) {
				continue;
			}
			const row = Math.floor(cell / SWITCH_BOARD_SIZE);
			const col = cell % SWITCH_BOARD_SIZE;
			entity.position.set(this._mapper.getWorldPosition(row, col));

			// §4 - FREE 좌표에는 아무런 오브젝트가 생성되지 않는다
			entity.visible.set(level.grid[cell] !== ESwitchCellState.FREE);
		}

		this.applyGridVisuals();
		this._touchRouter?.setEnabled(true);
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
		// 해킹 패널 우측 3×3 미니 UI 로 넘긴다 (§9.5).
		// 미니 UI 엔티티를 붙였다면 여기서 갱신한다.
		console.log(`[SwitchCoreAPI] Switch area updated: ${mask.join('')}`);
	}

	private onQuestEnd(result: SwitchPuzzleResultData): void {
		this._touchRouter?.setEnabled(false);
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
		const entity = this._keyCaps[cell];
		const state = this.session.board?.getCellAt(cell);
		if (entity === undefined || state === undefined || state === ESwitchCellState.FREE) {
			return;
		}
		this.setTint(entity, state === ESwitchCellState.PRESSED ? COLOR_PRESSED : COLOR_UNPRESSED);
	}

	private setTint(entity: Entity, color: Color): void {
		const mesh = entity.as(MeshEntity);
		mesh.style.tintColor.set(color);
		mesh.style.tintStrength.set(1);
	}

	//#endregion
}
Component.register(SwitchCoreAPI);
