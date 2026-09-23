/**
 * NoesisProbe_Panel — Noesis 전면 전환 0단계: 남은 미확인 항목을 한 장에서 확인한다 (테스트 전용)
 *
 * 짝이 되는 XAML 은 `Documents/NoesisSample/NoesisProbe/Probe.xaml` 이다.
 *
 *   T1 색      문자열 '#RRGGBB' 를 Background / SolidColorBrush.Color 에 바인딩, 문자열 Visibility
 *   T2 텍스처   `ImageSource` 를 Image.Source 에 바인딩 - 첫 대입에 넣은 것과, null 로 시작해 나중에 넣은 것
 *   T3 81칸    9x9 칸을 한꺼번에 / 주기적으로 바꿀 때의 스크립트 시간과 화면 끊김
 *   T4 배열 TwoWay  배열 항목 안의 X/Y 가 TwoWay 로 돌아오는가 (되면 조각 자리를 고정 개수로 찍지 않아도 된다)
 *   T5 Viewbox 안의 드래그  Viewbox 로 확대된 영역에서 끌기와, 루트 px <-> 설계 좌표 환산이 맞는가
 *   T6 공존     루트가 투명하다. Custom UI `PuzzleUI_MainPanel` 과 같이 켜서 겹침 순서·입력을 본다
 *
 * 지금까지 확인된 것을 전제로 짰다 - Local 모드, 속성만 바꿔도 화면이 따라온다(mutate),
 * `CommandParameter` 로 루트 크기가 온다, 첫 대입 때 없던 키는 바인딩되지 않는다.
 */
import { Component, PropTypes, TextureAsset } from 'horizon/core';
import { IUiViewModelObject, NoesisGizmo } from 'horizon/noesis';
import { ImageSource } from 'horizon/ui';

// 아래 넷은 Probe.xaml 의 배치와 같아야 한다
const DESIGN_WIDTH = 360;
const DESIGN_HEIGHT = 640;
/** 바깥 Grid 의 가운데 칸 (열 3/94/3, 행 12/76/12) */
const FRAME_LEFT = 0.03;
const FRAME_WIDTH = 0.94;
const FRAME_TOP = 0.12;
const FRAME_HEIGHT = 0.76;
/** 조각 놀이터 (설계 좌표) */
const YARD_LEFT = 8;
const YARD_TOP = 418;
const YARD_COLS = 8;
const YARD_ROWS = 2;
const SLOT = 40;
const PIECE_INSET = 2;
const PIECE_SIZE = SLOT - PIECE_INSET * 2;

const GRID = 9;
const CELL_COUNT = GRID * GRID;
const ARRAY_PIECES = 2;
const AUTO_INTERVAL_MS = 100;
const AUTO_CELLS_PER_TICK = 6;
const LOG_LINES = 8;
const DUPLICATE_WINDOW_MS = 80;
const NUDGE_PX = 0.01;
const REASSERT_DELAYS_MS = [150, 600];

const PALETTE = ['#E11D48', '#3B82F6', '#14B8A6', '#F2CC40', '#8B5CF6', '#F97316'];
const COLOR_EMPTY = '#1F212E';

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export class NoesisProbePanel extends Component<typeof NoesisProbePanel> {
	public static propsDefinition = {
		// T2 용. 아무 Texture 애셋이나 끼운다. 비워 두면 T2 는 건너뛴다
		texture: { type: PropTypes.Asset },
		logToConsole: { type: PropTypes.Boolean, default: true },
	};

	private _gizmo: NoesisGizmo | undefined = undefined;
	private _vm: IUiViewModelObject = {};
	private _isSameObject: string = '?';
	private _texture: ImageSource | null = null;

	private _rootWidth: number = 0;
	private _rootHeight: number = 0;
	private _pendingWidth: number = 0;
	private _pendingHeight: number = 0;
	private _scale: number = 1;
	private _originX: number = 0;
	private _originY: number = 0;

	private _colorIndex: number = 0;
	private _isShown: boolean = true;
	private _isAuto: boolean = false;
	private _autoTimer: number | undefined = undefined;
	private _autoTicks: number = 0;
	private _paintSerial: number = 0;
	private _setCount: number = 0;
	private _lastOp: string = '-';

	/** 조각의 자리 (놀이터 칸 번호). 0 = 낱개 키(P1X), 1.. = 배열 항목 */
	private readonly _pieceSlots: number[] = [0, 3, 5];
	private readonly _pushed: { [key: string]: number } = {};
	private _nudgeFlip: number = 0;
	private _lastDropPiece: number = -1;
	private _lastDropMs: number = 0;

	private readonly _logs: string[] = [];
	private _logSerial: number = 0;

	//#region Lifecycle

	public start(): void {
		// 서버에서 도는 인스턴스는 건너뛴다 (실행모드 규칙 §1). 소유자가 아니라 "지금 어느 기기에서
		// 도는가" 로 가른다 - Shared 모드에서는 소유자가 언제나 서버라서 소유자로 가르면 아무도 그리지 않는다
		if (this.world.getLocalPlayer().id === this.world.getServerPlayer().id) {
			return;
		}
		this._gizmo = this.entity.as(NoesisGizmo);
		// 런타임은 숨긴 gizmo 를 기기별로 기억한다. 앞서 붙어 있던 스크립트(NoesisBoard_Panel 등)가
		// 숨긴 채 끝나면 이 패널도 그대로 안 보인다. 그래서 패널마다 자기가 켜고 시작한다
		this._gizmo.setLocalEntityVisibility(true);

		const asset = this.props.texture;
		if (asset !== undefined && asset !== null) {
			try {
				this._texture = ImageSource.fromTextureAsset(asset.as(TextureAsset));
			} catch (error) {
				this.log(`T2 fromTextureAsset threw: ${error}`);
			}
		}

		this._vm = this.buildContext();
		this.log(this._texture === null ? 'T2 skipped - no texture prop' : 'T2 texture created');
		this._vm.Log = this._logs.join('\n');
		this._vm.Status = this.statusText();
		this._gizmo.dataContext = this._vm;

		let live: unknown = undefined;
		try {
			live = this._gizmo.dataContext;
		} catch (error) {
			live = undefined;
		}
		this._isSameObject = live === this._vm ? 'same' : 'copy';
		this.log(`dataContext getter returns ${this._isSameObject === 'same' ? 'the object we assigned' : 'a different object'}`);
		this.flushTexts();
	}

	public dispose(): void {
		this.stopAuto();
	}

	//#endregion

	//#region Context

	/** 첫 대입 때 없던 키는 바인딩되지 않으므로, 쓸 키를 전부 여기서 만든다 */
	private buildContext(): IUiViewModelObject {
		const cells: IUiViewModelObject[] = [];
		for (let i = 0; i < CELL_COUNT; i++) {
			cells.push({
				Fill: COLOR_EMPTY,
				Label: '',
				// 열 칸마다 하나씩은 첫 대입부터 그림을 들고 있다
				Tex: i % 10 === 0 ? this._texture : null,
			});
		}

		const pieces: IUiViewModelObject[] = [];
		for (let k = 0; k < ARRAY_PIECES; k++) {
			pieces.push({
				X: 0,
				Y: 0,
				Size: PIECE_SIZE,
				Fill: PALETTE[k + 1],
				Label: `A${k + 1}`,
				OnUp: () => this.onPieceUp(k + 1),
			});
		}

		return {
			Status: '',
			Log: '',
			FillText: PALETTE[0],
			FillColor: PALETTE[0],
			Vis: 'Visible',
			TexEarly: this._texture,
			TexLate: null,
			AutoLabel: 'auto: off',
			Cells: cells,
			Pieces: pieces,
			P1X: 0,
			P1Y: 0,
			OnCycleColor: () => this.onCycleColor(),
			OnToggleVis: () => this.onToggleVis(),
			OnLoadLate: () => this.onLoadLate(),
			OnRepaintAll: () => this.onRepaintAll(),
			OnToggleAuto: () => this.onToggleAuto(),
			OnP1Up: () => this.onPieceUp(0),
			OnRootWidth: (parameter?: unknown) => this.onRootSize(parameter, true),
			OnRootHeight: (parameter?: unknown) => this.onRootSize(parameter, false),
		};
	}

	/** 우리가 대입한 객체, 그리고 getter 가 다른 객체를 돌려주면 그것도 */
	private targets(): IUiViewModelObject[] {
		const list: IUiViewModelObject[] = [this._vm];
		if (this._isSameObject === 'copy' && this._gizmo !== undefined) {
			try {
				const live = this._gizmo.dataContext;
				if (live !== undefined && live !== null && live !== this._vm) {
					list.push(live);
				}
			} catch (error) {
				// getter 가 실패해도 우리 객체에는 이미 썼다
			}
		}
		return list;
	}

	private setRoot(key: string, value: string | number | ImageSource | null): void {
		for (const target of this.targets()) {
			target[key] = value;
		}
		this._setCount++;
	}

	private setItem(listKey: string, index: number, key: string, value: string | number | ImageSource | null): void {
		for (const target of this.targets()) {
			const list = target[listKey] as IUiViewModelObject[] | undefined;
			if (list !== undefined && list[index] !== undefined) {
				list[index][key] = value;
			}
		}
		this._setCount++;
	}

	private statusText(): string {
		const size = this._rootWidth > 0
			? `root ${this._rootWidth.toFixed(0)}x${this._rootHeight.toFixed(0)}  scale ${this._scale.toFixed(3)}`
			: 'root size unknown - tap the panel';
		return `getter ${this._isSameObject}  ${size}\nlast: ${this._lastOp}  auto ticks ${this._autoTicks}`;
	}

	private flushTexts(): void {
		// 계측에 섞이지 않도록 글자 갱신은 set 수에 넣지 않는다
		const before = this._setCount;
		this.setRoot('Status', this.statusText());
		this.setRoot('Log', this._logs.join('\n'));
		this._setCount = before;
	}

	private log(message: string): void {
		this._logSerial++;
		this._logs.push(`${this._logSerial}. ${message}`);
		while (this._logs.length > LOG_LINES) {
			this._logs.shift();
		}
		if (this.props.logToConsole === true) {
			console.log(`[NoesisProbe] ${message}`);
		}
	}

	//#endregion

	//#region T1 colour / T2 texture

	private onCycleColor(): void {
		this._colorIndex = (this._colorIndex + 1) % PALETTE.length;
		this.setRoot('FillText', PALETTE[this._colorIndex]);
		this.setRoot('FillColor', PALETTE[this._colorIndex]);
		this.log(`T1 colour -> ${PALETTE[this._colorIndex]} (both swatches should change)`);
		this.flushTexts();
	}

	private onToggleVis(): void {
		this._isShown = this._isShown === false;
		this.setRoot('Vis', this._isShown === true ? 'Visible' : 'Collapsed');
		this.log(`T1 Vis -> ${this._isShown === true ? 'Visible' : 'Collapsed'}`);
		this.flushTexts();
	}

	private onLoadLate(): void {
		if (this._texture === null) {
			this.log('T2 no texture prop - assign one on the script');
			this.flushTexts();
			return;
		}
		this.setRoot('TexLate', this._texture);
		for (let i = 5; i < CELL_COUNT; i += 10) {
			this.setItem('Cells', i, 'Tex', this._texture);
		}
		this.log('T2 late texture set (2nd image + cells x5 should appear)');
		this.flushTexts();
	}

	//#endregion

	//#region T3 81 cells

	private paintCells(indices: number[]): void {
		this._paintSerial++;
		for (const i of indices) {
			const color = PALETTE[(i + this._paintSerial) % PALETTE.length];
			this.setItem('Cells', i, 'Fill', color);
			this.setItem('Cells', i, 'Label', String((i + this._paintSerial) % 100));
		}
	}

	private onRepaintAll(): void {
		const all: number[] = [];
		for (let i = 0; i < CELL_COUNT; i++) {
			all.push(i);
		}
		this._setCount = 0;
		const startMs = Date.now();
		this.paintCells(all);
		const elapsed = Date.now() - startMs;
		this._lastOp = `repaint ${CELL_COUNT} cells  ${this._setCount} sets  ${elapsed}ms script`;
		this.log(`T3 ${this._lastOp}`);
		this.flushTexts();
	}

	private onToggleAuto(): void {
		if (this._isAuto === true) {
			this.stopAuto();
			this.log(`T3 auto off after ${this._autoTicks} ticks`);
		} else {
			this._isAuto = true;
			this._autoTicks = 0;
			this._autoTimer = this.async.setInterval(() => this.autoTick(), AUTO_INTERVAL_MS);
			this.log(`T3 auto on - ${AUTO_CELLS_PER_TICK} cells every ${AUTO_INTERVAL_MS}ms. drag a piece now`);
		}
		this.setRoot('AutoLabel', this._isAuto === true ? 'auto: on' : 'auto: off');
		this.flushTexts();
	}

	private stopAuto(): void {
		this._isAuto = false;
		if (this._autoTimer !== undefined) {
			this.async.clearInterval(this._autoTimer);
			this._autoTimer = undefined;
		}
	}

	private autoTick(): void {
		this._autoTicks++;
		const picked: number[] = [];
		for (let n = 0; n < AUTO_CELLS_PER_TICK; n++) {
			picked.push((this._autoTicks * 7 + n * 13) % CELL_COUNT);
		}
		this.paintCells(picked);
		// 글자는 1초에 한 번만 - 끄는 동안의 부하를 칸 갱신으로만 두려는 것
		if (this._autoTicks % 10 === 0) {
			this.flushTexts();
		}
	}

	//#endregion

	//#region T4 / T5 pieces

	private onRootSize(parameter: unknown, isWidth: boolean): void {
		const value = typeof parameter === 'number' ? parameter : parseFloat(String(parameter));
		if (isNaN(value) || value <= 0) {
			return;
		}
		if (isWidth === true) {
			this._pendingWidth = value;
		} else {
			this._pendingHeight = value;
		}
		const isChanged = Math.abs(this._pendingWidth - this._rootWidth) > 0.5
			|| Math.abs(this._pendingHeight - this._rootHeight) > 0.5;
		if (this._pendingWidth <= 0 || this._pendingHeight <= 0 || isChanged === false) {
			return;
		}

		this._rootWidth = this._pendingWidth;
		this._rootHeight = this._pendingHeight;
		// Viewbox(Uniform, 가운데 정렬)가 하는 계산을 그대로 따라 한다
		const frameWidth = this._rootWidth * FRAME_WIDTH;
		const frameHeight = this._rootHeight * FRAME_HEIGHT;
		this._scale = Math.min(frameWidth / DESIGN_WIDTH, frameHeight / DESIGN_HEIGHT);
		this._originX = this._rootWidth * FRAME_LEFT + (frameWidth - DESIGN_WIDTH * this._scale) / 2;
		this._originY = this._rootHeight * FRAME_TOP + (frameHeight - DESIGN_HEIGHT * this._scale) / 2;

		this.log(`T5 root ${this._rootWidth.toFixed(0)}x${this._rootHeight.toFixed(0)} scale ${this._scale.toFixed(3)} - pieces should sit in the slots`);
		this.placeAllPieces();
		for (const delay of REASSERT_DELAYS_MS) {
			this.async.setTimeout(() => this.placeAllPieces(), delay);
		}
	}

	private placeAllPieces(): void {
		this._nudgeFlip = this._nudgeFlip === 0 ? 1 : 0;
		for (let piece = 0; piece < this._pieceSlots.length; piece++) {
			this.placePiece(piece);
		}
		this.flushTexts();
	}

	/** 놀이터 칸 -> 설계 좌표 -> 루트 px */
	private placePiece(piece: number): void {
		const slot = this._pieceSlots[piece];
		const designX = YARD_LEFT + (slot % YARD_COLS) * SLOT + PIECE_INSET;
		const designY = YARD_TOP + Math.floor(slot / YARD_COLS) * SLOT + PIECE_INSET;
		const nudge = this._nudgeFlip * NUDGE_PX;
		const x = this._originX + designX * this._scale + nudge;
		const y = this._originY + designY * this._scale + nudge;
		this._pushed[`${piece}X`] = x;
		this._pushed[`${piece}Y`] = y;
		if (piece === 0) {
			this.setRoot('P1X', x);
			this.setRoot('P1Y', y);
		} else {
			this.setItem('Pieces', piece - 1, 'X', x);
			this.setItem('Pieces', piece - 1, 'Y', y);
		}
	}

	private readBack(piece: number, axis: string): { value: number; source: string } {
		const pushed = this._pushed[`${piece}${axis}`];
		const candidates = this.targets();
		// getter 가 돌려준 객체(있다면)를 먼저 본다
		for (let n = candidates.length - 1; n >= 0; n--) {
			let value: unknown = undefined;
			if (piece === 0) {
				value = candidates[n][`P1${axis}`];
			} else {
				const list = candidates[n].Pieces as IUiViewModelObject[] | undefined;
				value = list !== undefined && list[piece - 1] !== undefined ? list[piece - 1][axis] : undefined;
			}
			if (typeof value === 'number' && isFinite(value) && value !== pushed) {
				return { value: value, source: n === 0 ? 'object' : 'getter' };
			}
		}
		return { value: pushed, source: 'none' };
	}

	private onPieceUp(piece: number): void {
		const now = Date.now();
		if (this._lastDropPiece === piece && now - this._lastDropMs < DUPLICATE_WINDOW_MS) {
			return;
		}
		this._lastDropPiece = piece;
		this._lastDropMs = now;

		const name = piece === 0 ? 'P1(flat)' : `A${piece}(array)`;
		const x = this.readBack(piece, 'X');
		const y = this.readBack(piece, 'Y');
		const source = x.source !== 'none' ? x.source : y.source;
		if (source === 'none') {
			this.log(`${piece === 0 ? 'T5' : 'T4'} ${name} up - no X/Y came back`);
			this.flushTexts();
			return;
		}
		if (this._scale <= 0 || this._rootWidth <= 0) {
			this.log(`${name} up via ${source} but root size unknown`);
			this.flushTexts();
			return;
		}

		const designX = (x.value - this._originX) / this._scale;
		const designY = (y.value - this._originY) / this._scale;
		const column = clamp(Math.round((designX - YARD_LEFT - PIECE_INSET) / SLOT), 0, YARD_COLS - 1);
		const row = clamp(Math.round((designY - YARD_TOP - PIECE_INSET) / SLOT), 0, YARD_ROWS - 1);
		this._pieceSlots[piece] = row * YARD_COLS + column;
		this.log(`${piece === 0 ? 'T5' : 'T4'} ${name} via ${source}  design ${designX.toFixed(0)},${designY.toFixed(0)} -> slot c${column} r${row}`);
		this.placeAllPieces();
	}

	//#endregion
}
Component.register(NoesisProbePanel);
