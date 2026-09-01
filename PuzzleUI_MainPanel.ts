/**
 * Puzzle UI Main Panel - 메인 UI(퍼즐 허브)의 Horizon 표현 계층
 *
 * 순수 로직(PuzzleUI_Model)의 뷰 이벤트를 Binding 에 흘려 넣고,
 * 버튼(Pressable)을 모델의 액션으로 연결하는 것이 전부다. 화면 전이 규칙은
 * 한 줄도 여기 있지 않다 (PUZ_00 §7.1 로직과 표현의 분리).
 *
 * ## 화면 구성
 *
 *   메인 메뉴      - 8개 퍼즐 격자 (미등록 퍼즐은 어둡게 + "준비 중")
 *   난이도 선택    - 난이도 버튼(최대 6) + 시작/뒤로
 *   인게임 HUD     - 상단 바(시간·라운드·일시정지)만 표시하고 보드를 가리지 않는다
 *   일시정지       - 반투명 오버레이 (계속하기 / 그만두기)
 *   결과           - 승패 + 통계 + 다시 도전 / 메뉴로
 *
 * ## 붙이는 법
 *
 *   1. Custom UI gizmo 를 만들어 이 스크립트를 붙이고 Display Mode 를 **Screen Overlay** 로 둔다.
 *   2. 실행 모드를 **Local** 로 두고, `Puzzle_LocalOwnership` 의 targets 에 이 엔티티를 추가한다
 *      (소유권이 안 넘어오면 서버 인스턴스는 빈 화면만 그린다 - 진행 문서 §10.1-2).
 *   3. 같은 클라이언트에서 도는 각 퍼즐의 `*_CoreAPI` 가 `PuzzleHubRegistry` 에 핸들을
 *      등록하면 그 퍼즐이 자동으로 "준비 중" 에서 풀린다. CoreAPI 쪽은 **autoStart 를 꺼서**
 *      시작을 이 메뉴에 맡긴다.
 *
 * 모바일 지침 (PUZ_00 §8)
 *   - 버튼은 화면 폭의 40% 이상, 세로 8% 이상으로 잡아 엄지로 누르기 넉넉하게 한다
 *   - 인게임에서는 상단 바 외에 아무것도 그리지 않는다 - 보드와 손가락을 가리지 않는다 (§8.5)
 */

import { Color } from 'horizon/core';
import { Binding, Pressable, Text, UIComponent, UINode, View } from 'horizon/ui';
import { PuzzleHubModel } from 'PuzzleUI_Model';
import {
	EPuzzleHubScreen,
	EPuzzleId,
	PUZZLE_CATALOG,
	PuzzleUIQuestResult,
	formatClockLabel,
	getCatalogEntry,
} from 'PuzzleUI_Definitions';

//#region Style constants

const COLOR_BACKGROUND = new Color(0.08, 0.09, 0.13);
const COLOR_PANEL = new Color(0.14, 0.16, 0.22);
const COLOR_BUTTON = new Color(0.22, 0.45, 0.85);
const COLOR_BUTTON_DIM = new Color(0.2, 0.22, 0.28);
const COLOR_BUTTON_SELECTED = new Color(0.95, 0.65, 0.2);
const COLOR_DANGER = new Color(0.75, 0.25, 0.25);
const COLOR_WIN = new Color(0.25, 0.75, 0.4);
const COLOR_LOSE = new Color(0.85, 0.3, 0.3);
const COLOR_TEXT = Color.white;

/** 난이도 버튼 슬롯 수 - 색 채우기가 D6 까지 가지므로 6 */
const MAX_DIFFICULTY_SLOTS = 6;

const TOAST_SECONDS = 2;

//#endregion

type DifficultySlot = {
	value: number,
	label: Binding<string>,
	isVisible: Binding<boolean>,
	isSelected: Binding<boolean>,
}

type CatalogSlot = {
	id: EPuzzleId,
	subtitle: Binding<string>,
	isAvailable: Binding<boolean>,
}

export class PuzzleUIMainPanel extends UIComponent<typeof PuzzleUIMainPanel> {
	public static propsDefinition = {};

	private _model: PuzzleHubModel | undefined = undefined;

	private readonly _screen: Binding<string> = new Binding<string>(EPuzzleHubScreen.MAIN_MENU as string);

	private readonly _catalogSlots: CatalogSlot[] = [];
	private readonly _difficultySlots: DifficultySlot[] = [];
	private readonly _selectionTitle: Binding<string> = new Binding('');
	private readonly _selectionSubtitle: Binding<string> = new Binding('');

	private readonly _hudTitle: Binding<string> = new Binding('');
	private readonly _hudClock: Binding<string> = new Binding('0:00');
	private readonly _hudRound: Binding<string> = new Binding('');

	private readonly _resultTitle: Binding<string> = new Binding('');
	private readonly _resultDetail: Binding<string> = new Binding('');
	private readonly _resultColor: Binding<Color> = new Binding(COLOR_WIN);

	private readonly _toastText: Binding<string> = new Binding('');
	private readonly _toastVisible: Binding<boolean> = new Binding<boolean>(false);
	private _toastTimeoutId: number | undefined = undefined;

	//#region Lifecycle

	public initializeUI(): UINode {
		// 소유권이 넘어오지 않은 서버 인스턴스는 아무것도 그리지 않는다 (MainMenuPanel 과 같은 규약)
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			return View({});
		}

		this._model = new PuzzleHubModel();
		this.subscribeToModel(this._model);

		const root = View({
			children: [
				this.createMainMenuScreen(),
				this.createDifficultyScreen(),
				this.createHudBar(),
				this.createPausedOverlay(),
				this.createResultScreen(),
				this.createToast(),
			],
			style: {
				width: '100%',
				height: '100%',
				position: 'absolute',
			},
		});

		// 초기 뷰 반영 (등록이 이 패널보다 먼저 끝난 CoreAPI 도 있을 수 있다)
		this.applyCatalog();
		return root;
	}

	public dispose(): void {
		this._model?.dispose();
		this._model = undefined;
	}

	//#endregion

	//#region Model wiring (모델 이벤트 → Binding)

	private subscribeToModel(model: PuzzleHubModel): void {
		model.events.SCREEN_CHANGED.subscribe((screen) => {
			this._screen.set(screen as string);
		});

		model.events.CATALOG_CHANGED.subscribe(() => this.applyCatalog());

		model.events.SELECTION_CHANGED.subscribe(() => this.applySelection());

		model.events.HUD_CHANGED.subscribe((hud) => {
			this._hudTitle.set(`${hud.displayName}  D${hud.difficulty}`);
			this._hudClock.set(hud.clockLabel);
			this._hudRound.set(hud.round.total > 1 ? `라운드 ${hud.round.current}/${hud.round.total}` : '');
		});

		model.events.RESULT_READY.subscribe((result) => this.applyResult(result));

		model.events.LOCKED_PUZZLE_TAPPED.subscribe((puzzleId) => {
			const entry = getCatalogEntry(puzzleId);
			this.showToast(`${entry?.displayName ?? puzzleId} 퍼즐은 준비 중입니다.`);
		});

		model.events.START_FAILED.subscribe(() => {
			this.showToast('퍼즐을 시작하지 못했습니다. 다시 시도해 주세요.');
		});
	}

	private applyCatalog(): void {
		const model = this._model;
		if (model === undefined) {
			return;
		}
		const catalog = model.getCatalogView();
		for (const slot of this._catalogSlots) {
			const entry = catalog.find((item) => item.id === slot.id);
			if (entry === undefined) {
				continue;
			}
			slot.isAvailable.set(entry.isAvailable);
			slot.subtitle.set(entry.isAvailable ? entry.subtitle : '준비 중');
		}
	}

	private applySelection(): void {
		const model = this._model;
		if (model === undefined) {
			return;
		}
		const selection = model.getSelectionView();
		this._selectionTitle.set(selection.displayName);
		this._selectionSubtitle.set(selection.subtitle);

		for (let i = 0; i < this._difficultySlots.length; i++) {
			const slot = this._difficultySlots[i];
			const difficulty = i < selection.difficulties.length ? selection.difficulties[i] : undefined;
			slot.value = difficulty ?? -1;
			slot.isVisible.set(difficulty !== undefined);
			slot.label.set(difficulty === undefined ? '' : `${difficulty}`);
			slot.isSelected.set(difficulty === selection.selectedDifficulty);
		}
	}

	private applyResult(result: PuzzleUIQuestResult): void {
		const entry = getCatalogEntry(result.puzzleId);
		this._resultTitle.set(result.isWin ? '클리어!' : '실패');
		this._resultColor.set(result.isWin ? COLOR_WIN : COLOR_LOSE);

		const roundLabel = result.roundCount > 1 ? `라운드 ${result.roundsCleared}/${result.roundCount}  ·  ` : '';
		this._resultDetail.set(
			`${entry?.displayName ?? ''}  ·  ${roundLabel}남은 시간 ${formatClockLabel(result.remainingTimeSeconds)}`);
	}

	private showToast(message: string): void {
		this._toastText.set(message);
		this._toastVisible.set(true);
		if (this._toastTimeoutId !== undefined) {
			this.async.clearTimeout(this._toastTimeoutId);
		}
		this._toastTimeoutId = this.async.setTimeout(() => {
			this._toastVisible.set(false);
			this._toastTimeoutId = undefined;
		}, TOAST_SECONDS * 1000);
	}

	//#endregion

	//#region Screens

	/** 화면 표시 여부를 screen 바인딩에서 파생한다 */
	private visibleWhen(check: (screen: string) => boolean) {
		return this._screen.derive((screen) => (check(screen) ? 'flex' : 'none'));
	}

	private createMainMenuScreen(): UINode {
		const title = Text({
			text: '퍼즐 허브',
			style: {
				color: COLOR_TEXT,
				fontSize: 36,
				fontWeight: 'bold',
				textAlign: 'center',
				width: '100%',
				height: '10%',
				marginTop: '4%',
			},
		});

		const buttons: UINode[] = [];
		for (const entry of PUZZLE_CATALOG) {
			const subtitle = new Binding<string>('준비 중');
			const isAvailable = new Binding<boolean>(false);
			this._catalogSlots.push({ id: entry.id, subtitle: subtitle, isAvailable: isAvailable });

			buttons.push(Pressable({
				children: [
					Text({
						text: entry.displayName,
						style: { color: COLOR_TEXT, fontSize: 22, fontWeight: 'bold', textAlign: 'center', width: '100%' },
					}),
					Text({
						text: subtitle,
						style: { color: COLOR_TEXT, fontSize: 13, textAlign: 'center', width: '100%', opacity: 0.75 },
					}),
				],
				style: {
					width: '44%',
					height: '18%',
					margin: '2%',
					borderRadius: 12,
					justifyContent: 'center',
					backgroundColor: isAvailable.derive((available) => (available ? COLOR_BUTTON : COLOR_BUTTON_DIM)),
					opacity: isAvailable.derive((available) => (available ? 1 : 0.55)),
				},
				onClick: () => { this._model?.selectPuzzle(entry.id); },
			}));
		}

		const grid = View({
			children: buttons,
			style: {
				width: '92%',
				height: '82%',
				alignSelf: 'center',
				flexDirection: 'row',
				flexWrap: 'wrap',
				justifyContent: 'center',
				alignContent: 'center',
			},
		});

		return View({
			children: [title, grid],
			style: {
				width: '100%',
				height: '100%',
				position: 'absolute',
				backgroundColor: COLOR_BACKGROUND,
				display: this.visibleWhen((screen) => screen === EPuzzleHubScreen.MAIN_MENU),
			},
		});
	}

	private createDifficultyScreen(): UINode {
		const title = Text({
			text: this._selectionTitle,
			style: { color: COLOR_TEXT, fontSize: 32, fontWeight: 'bold', textAlign: 'center', width: '100%', marginTop: '8%' },
		});
		const subtitle = Text({
			text: this._selectionSubtitle,
			style: { color: COLOR_TEXT, fontSize: 16, textAlign: 'center', width: '100%', opacity: 0.8, marginTop: '1%' },
		});
		const difficultyLabel = Text({
			text: '난이도',
			style: { color: COLOR_TEXT, fontSize: 18, textAlign: 'center', width: '100%', marginTop: '6%' },
		});

		const difficultyButtons: UINode[] = [];
		for (let i = 0; i < MAX_DIFFICULTY_SLOTS; i++) {
			const slot: DifficultySlot = {
				value: -1,
				label: new Binding<string>(''),
				isVisible: new Binding<boolean>(false),
				isSelected: new Binding<boolean>(false),
			};
			this._difficultySlots.push(slot);

			difficultyButtons.push(Pressable({
				children: [
					Text({
						text: slot.label,
						style: { color: COLOR_TEXT, fontSize: 24, fontWeight: 'bold', textAlign: 'center', width: '100%' },
					}),
				],
				style: {
					width: '13%',
					aspectRatio: 1,
					margin: '1%',
					borderRadius: 10,
					justifyContent: 'center',
					display: slot.isVisible.derive((visible) => (visible ? 'flex' : 'none')),
					backgroundColor: slot.isSelected.derive((selected) => (selected ? COLOR_BUTTON_SELECTED : COLOR_BUTTON_DIM)),
				},
				onClick: () => {
					if (slot.value > 0) {
						this._model?.selectDifficulty(slot.value);
					}
				},
			}));
		}

		const difficultyRow = View({
			children: difficultyButtons,
			style: {
				width: '92%',
				alignSelf: 'center',
				flexDirection: 'row',
				justifyContent: 'center',
				marginTop: '2%',
			},
		});

		const startButton = Pressable({
			children: [
				Text({ text: '시작', style: { color: COLOR_TEXT, fontSize: 26, fontWeight: 'bold', textAlign: 'center', width: '100%' } }),
			],
			style: {
				width: '60%',
				height: '10%',
				alignSelf: 'center',
				marginTop: '10%',
				borderRadius: 14,
				justifyContent: 'center',
				backgroundColor: COLOR_BUTTON,
			},
			onClick: () => { this._model?.startSelected(); },
		});

		const backButton = Pressable({
			children: [
				Text({ text: '뒤로', style: { color: COLOR_TEXT, fontSize: 18, textAlign: 'center', width: '100%' } }),
			],
			style: {
				width: '40%',
				height: '8%',
				alignSelf: 'center',
				marginTop: '3%',
				borderRadius: 12,
				justifyContent: 'center',
				backgroundColor: COLOR_BUTTON_DIM,
			},
			onClick: () => { this._model?.back(); },
		});

		return View({
			children: [title, subtitle, difficultyLabel, difficultyRow, startButton, backButton],
			style: {
				width: '100%',
				height: '100%',
				position: 'absolute',
				backgroundColor: COLOR_BACKGROUND,
				display: this.visibleWhen((screen) => screen === EPuzzleHubScreen.DIFFICULTY_SELECT),
			},
		});
	}

	/** 인게임에서는 상단 바만 그린다 - 보드와 손가락을 가리지 않는다 (PUZ_00 §8.5) */
	private createHudBar(): UINode {
		const pauseButton = Pressable({
			children: [
				Text({ text: 'II', style: { color: COLOR_TEXT, fontSize: 20, fontWeight: 'bold', textAlign: 'center', width: '100%' } }),
			],
			style: {
				width: '12%',
				height: '100%',
				borderRadius: 10,
				justifyContent: 'center',
				backgroundColor: COLOR_PANEL,
			},
			onClick: () => { this._model?.pauseGame(); },
		});

		const titleText = Text({
			text: this._hudTitle,
			style: { color: COLOR_TEXT, fontSize: 16, textAlign: 'center', flex: 1 },
		});

		const clockText = Text({
			text: this._hudClock,
			style: { color: COLOR_TEXT, fontSize: 22, fontWeight: 'bold', textAlign: 'center', width: '18%' },
		});

		const roundText = Text({
			text: this._hudRound,
			style: { color: COLOR_TEXT, fontSize: 14, textAlign: 'center', width: '20%' },
		});

		return View({
			children: [pauseButton, titleText, clockText, roundText],
			style: {
				width: '94%',
				height: '7%',
				alignSelf: 'center',
				marginTop: '2%',
				position: 'absolute',
				flexDirection: 'row',
				alignItems: 'center',
				display: this.visibleWhen((screen) =>
					screen === EPuzzleHubScreen.IN_GAME || screen === EPuzzleHubScreen.PAUSED),
			},
		});
	}

	private createPausedOverlay(): UINode {
		const title = Text({
			text: '일시정지',
			style: { color: COLOR_TEXT, fontSize: 30, fontWeight: 'bold', textAlign: 'center', width: '100%', marginTop: '30%' },
		});

		const resumeButton = Pressable({
			children: [
				Text({ text: '계속하기', style: { color: COLOR_TEXT, fontSize: 22, fontWeight: 'bold', textAlign: 'center', width: '100%' } }),
			],
			style: {
				width: '60%', height: '10%', alignSelf: 'center', marginTop: '8%',
				borderRadius: 14, justifyContent: 'center', backgroundColor: COLOR_BUTTON,
			},
			onClick: () => { this._model?.resumeGame(); },
		});

		const quitButton = Pressable({
			children: [
				Text({ text: '그만두기', style: { color: COLOR_TEXT, fontSize: 18, textAlign: 'center', width: '100%' } }),
			],
			style: {
				width: '60%', height: '8%', alignSelf: 'center', marginTop: '4%',
				borderRadius: 12, justifyContent: 'center', backgroundColor: COLOR_DANGER,
			},
			onClick: () => { this._model?.quitToMenu(); },
		});

		return View({
			children: [title, resumeButton, quitButton],
			style: {
				width: '100%',
				height: '100%',
				position: 'absolute',
				backgroundColor: new Color(0.03, 0.03, 0.05),
				opacity: 0.92,
				display: this.visibleWhen((screen) => screen === EPuzzleHubScreen.PAUSED),
			},
		});
	}

	private createResultScreen(): UINode {
		const title = Text({
			text: this._resultTitle,
			style: {
				color: this._resultColor,
				fontSize: 40,
				fontWeight: 'bold',
				textAlign: 'center',
				width: '100%',
				marginTop: '28%',
			},
		});

		const detail = Text({
			text: this._resultDetail,
			style: { color: COLOR_TEXT, fontSize: 16, textAlign: 'center', width: '100%', marginTop: '3%', opacity: 0.85 },
		});

		const retryButton = Pressable({
			children: [
				Text({ text: '다시 도전', style: { color: COLOR_TEXT, fontSize: 22, fontWeight: 'bold', textAlign: 'center', width: '100%' } }),
			],
			style: {
				width: '60%', height: '10%', alignSelf: 'center', marginTop: '8%',
				borderRadius: 14, justifyContent: 'center', backgroundColor: COLOR_BUTTON,
			},
			onClick: () => { this._model?.retry(); },
		});

		const menuButton = Pressable({
			children: [
				Text({ text: '메뉴로', style: { color: COLOR_TEXT, fontSize: 18, textAlign: 'center', width: '100%' } }),
			],
			style: {
				width: '60%', height: '8%', alignSelf: 'center', marginTop: '4%',
				borderRadius: 12, justifyContent: 'center', backgroundColor: COLOR_BUTTON_DIM,
			},
			onClick: () => { this._model?.quitToMenu(); },
		});

		return View({
			children: [title, detail, retryButton, menuButton],
			style: {
				width: '100%',
				height: '100%',
				position: 'absolute',
				backgroundColor: new Color(0.03, 0.03, 0.05),
				opacity: 0.94,
				display: this.visibleWhen((screen) => screen === EPuzzleHubScreen.RESULT),
			},
		});
	}

	private createToast(): UINode {
		return View({
			children: [
				Text({
					text: this._toastText,
					style: { color: COLOR_TEXT, fontSize: 15, textAlign: 'center', width: '100%' },
				}),
			],
			style: {
				width: '80%',
				height: '6%',
				alignSelf: 'center',
				position: 'absolute',
				bottom: '6%',
				borderRadius: 12,
				justifyContent: 'center',
				backgroundColor: COLOR_PANEL,
				opacity: 0.95,
				display: this._toastVisible.derive((visible) => (visible ? 'flex' : 'none')),
			},
		});
	}

	//#endregion
}
UIComponent.register(PuzzleUIMainPanel);
