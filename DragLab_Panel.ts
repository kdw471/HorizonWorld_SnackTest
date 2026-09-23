import {
	CodeBlockEvents,
	EventSubscription,
	InteractionInfo,
	Player,
	PlayerControls,
	PropTypes,
	Vec3,
	World,
} from 'horizon/core';
import { Gestures, PanEventData, TouchState } from 'horizon/mobile_gestures';
import {
	AnimatedBinding,
	Animation,
	Binding,
	Easing,
	Pressable,
	Text,
	UIComponent,
	UINode,
	View,
	ViewStyle,
} from 'horizon/ui';

const INPUT_FI_ABSOLUTE = 0;
const INPUT_FI_DELTA = 1;
const INPUT_GESTURE_PAN = 2;
const INPUT_PRESSABLE_GRID = 3;
const INPUT_LABELS = ['I0 FI absolute loc', 'I1 FI delta added', 'I2 Gestures.onPan', 'I3 Pressable'];

const FAMILY_STRING = 0;
const FAMILY_LAYOUT = 1;
const FAMILY_TRANSFORM = 2;
const FAMILY_OBJECT = 3;
const FAMILY_PX = 4;
const FAMILY_TAGS = ['S', 'L', 'T', 'O', 'P'];
const FAMILY_COLORS = ['#3b82f6', '#8b5cf6', '#f97316', '#14b8a6', '#e11d48'];

const PACE_IMMEDIATE = 0;
const PACE_THROTTLE_TWEEN = 1;
const PACE_FRAME = 2;
const PACE_FRAME_LERP = 3;
const PACE_TIMER = 4;
const PACE_SNAP_GRID = 5;
const PACE_DROP_ONLY = 6;
const PACE_PREDICT_TWEEN = 7;

const TUNE_UPDATE_HZ = 0;
const TUNE_PREDICT_LEAD = 1;
const TUNE_SMOOTH_RATE = 2;
const TUNE_SNAP_STEP = 3;
const TUNE_ROUND_STEP = 4;
const TUNE_OWNER_ONLY = 5;
const TUNE_DROP_MODE = 6;

const DROP_FREE = 0;
const DROP_GRID = 1;
const DROP_ZONE = 2;
const DROP_LABELS = ['free', 'grid snap', 'zone drop'];
const DROP_TWEEN_MS = 200;
const DROP_GRID_COLS = 5;
const DROP_GRID_MAX_ROWS = 5;
const DROP_GRID_LEFT = 0.05;
const DROP_GRID_TOP = 0.22;
const ZONE_WIDTH = 0.26;
const ZONE_MAX_HEIGHT = 0.40;
const ZONE_TOP = 0.24;
const ZONE_MARGIN = 0.05;

type DropZone = {
	id: string;
	left: number;
	top: number;
	width: number;
	height: number;
};

type DropResult = {
	x: number;
	y: number;
	tweenMs: number;
	label: string;
};

type Tunable = {
	label: string;
	steps: number[];
	format: (value: number) => string;
};

const TUNABLES: Tunable[] = [
	{
		label: 'throttle',
		steps: [0, 5, 8, 10, 12, 15, 20, 24, 30, 40, 60, 72, 90, 120],
		format: (v: number) => (v <= 0 ? 'every input' : `${v}Hz = ${Math.round(1000 / v)}ms`),
	},
	{ label: 'R11 predict lead', steps: [0, 2, 4, 6, 8, 12, 16, 20, 30], format: (v: number) => `${v}%` },
	{ label: 'R6 smooth rate', steps: [4, 6, 8, 10, 12, 15, 18, 22, 26, 30, 40, 60], format: (v: number) => `k ${v}/s` },
	{ label: 'R8 snap step', steps: [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20], format: (v: number) => `${v}%` },
	{ label: 'round step', steps: [0, 0.05, 0.1, 0.2, 0.5, 1], format: (v: number) => (v <= 0 ? 'off' : `${v}%`) },
	{ label: 'owner-only set', steps: [0, 1], format: (v: number) => (v >= 1 ? 'on' : 'off') },
	{ label: 'drop mode', steps: [0, 1, 2], format: (v: number) => DROP_LABELS[clampIndex(v, DROP_LABELS.length)] },
];

function nearestStep(value: number, steps: number[]): number {
	let best = steps[0];
	let bestGap = Math.abs(value - best);
	for (const step of steps) {
		const gap = Math.abs(value - step);
		if (gap < bestGap) {
			best = step;
			bestGap = gap;
		}
	}
	return best;
}

function stepIndexOf(steps: number[], value: number): number {
	for (let i = 0; i < steps.length; i++) {
		if (steps[i] === value) {
			return i;
		}
	}
	return 0;
}

type RenderMode = {
	label: string;
	family: number;
	pacing: number;
};

const RENDER_MODES: RenderMode[] = [
	{ label: 'R0 Binding<string> immediate', family: FAMILY_STRING, pacing: PACE_IMMEDIATE },
	{ label: 'R1 AnimatedBinding immediate', family: FAMILY_LAYOUT, pacing: PACE_IMMEDIATE },
	{ label: 'R2 Throttle + native interp', family: FAMILY_LAYOUT, pacing: PACE_THROTTLE_TWEEN },
	{ label: 'R3 transform immediate', family: FAMILY_TRANSFORM, pacing: PACE_IMMEDIATE },
	{ label: 'R4 transform Throttle + native interp', family: FAMILY_TRANSFORM, pacing: PACE_THROTTLE_TWEEN },
	{ label: 'R5 onUpdate 1 time/frame', family: FAMILY_LAYOUT, pacing: PACE_FRAME },
	{ label: 'R6 onUpdate log smoothing', family: FAMILY_LAYOUT, pacing: PACE_FRAME_LERP },
	{ label: 'R7 fixed timer flush', family: FAMILY_LAYOUT, pacing: PACE_TIMER },
	{ label: 'R8 when ouf of board', family: FAMILY_LAYOUT, pacing: PACE_SNAP_GRID },
	{ label: 'R9 object Binding + derive', family: FAMILY_OBJECT, pacing: PACE_IMMEDIATE },
	{ label: 'R10 base: no update when drag', family: FAMILY_LAYOUT, pacing: PACE_DROP_ONLY },
	{ label: 'R11 Throttle + prediction interp', family: FAMILY_LAYOUT, pacing: PACE_PREDICT_TWEEN },
	{ label: 'R12 web port: px Binding<number>', family: FAMILY_PX, pacing: PACE_IMMEDIATE },
];

const COLOR_BACKDROP = '#0f1420';
const COLOR_BORDER_IDLE = '#9aa7bd';
const COLOR_BORDER_HELD = '#facc15';
const COLOR_TEXT = '#e8ecf5';
const COLOR_TEXT_DIM = '#9aa7bd';
const COLOR_BUTTON = '#3d4761';
const COLOR_BUTTON_ACCENT = '#52607f';
const COLOR_BUTTON_TUNE = '#2f6f5f';
const COLOR_PULSE = '#34d399';
const COLOR_PULSE_TRACK = '#1f2a3a';
const COLOR_GRID_CELL = 'rgba(255,255,255,0.02)';
const COLOR_GRID_LINE = 'rgba(255,255,255,0.08)';
const COLOR_DROP_CELL = 'rgba(255,255,255,0.07)';
const COLOR_ZONE_FILL = 'rgba(52,211,153,0.12)';
const COLOR_ZONE_BORDER = '#34d399';

const FALLBACK_SCREEN_ASPECT = 0.46;
const FALLBACK_READ_WIDTH = 590;
const FALLBACK_READ_HEIGHT = 1280;
const PLAY_AREA_BOTTOM = 0.70;
const PULSE_SWEEP_MS = 1000;
const STALL_TICK_MS = 50;
const SNAP_TWEEN_MS = 60;
const LERP_EPSILON = 0.0005;
const VELOCITY_SMOOTHING = 0.5;
const VELOCITY_RESET_GAP_MS = 150;
const GESTURE_END_GRACE_MS = 120;
const AUTO_CENTRE_X = 0.5;
const AUTO_CENTRE_Y = 0.42;

type ScreenPoint = { x: number, y: number };

type StatWindow = {
	startMs: number;
	inputs: number;
	rawInputs: number;
	sets: number;
	lastInputMs: number;
	maxInputGapMs: number;
	maxVmGapMs: number;
	maxFrameGapMs: number;
	maxLatencyMs: number;
	inputStalls: number;
	vmStalls: number;
	frameStalls: number;
};

type Aggregate = {
	runs: number;
	durationMs: number;
	inputs: number;
	sets: number;
	worstInputGapMs: number;
	worstVmGapMs: number;
	worstFrameGapMs: number;
	worstLatencyMs: number;
	inputStalls: number;
	vmStalls: number;
	frameStalls: number;
};

function createWindow(now: number): StatWindow {
	return {
		startMs: now,
		inputs: 0,
		rawInputs: 0,
		sets: 0,
		lastInputMs: 0,
		maxInputGapMs: 0,
		maxVmGapMs: 0,
		maxFrameGapMs: 0,
		maxLatencyMs: 0,
		inputStalls: 0,
		vmStalls: 0,
		frameStalls: 0,
	};
}

function createAggregate(): Aggregate {
	return {
		runs: 0,
		durationMs: 0,
		inputs: 0,
		sets: 0,
		worstInputGapMs: 0,
		worstVmGapMs: 0,
		worstFrameGapMs: 0,
		worstLatencyMs: 0,
		inputStalls: 0,
		vmStalls: 0,
		frameStalls: 0,
	};
}

function clamp(value: number, min: number, max: number): number {
	if (isFinite(value) === false) {
		return min;
	}
	return Math.min(max, Math.max(min, value));
}

function clampIndex(value: number, count: number): number {
	if (isFinite(value) === false) {
		return 0;
	}
	return Math.min(count - 1, Math.max(0, Math.round(value)));
}

function percentText(fraction: number): string {
	return `${(fraction * 100).toFixed(2)}%`;
}

function perSecond(count: number, durationMs: number): string {
	return (count * 1000 / Math.max(1, durationMs)).toFixed(1);
}

export class DragLabPanel extends UIComponent<typeof DragLabPanel> {
	public static propsDefinition = {
		startInputMode: { type: PropTypes.Number, default: 0 },
		startRenderMode: { type: PropTypes.Number, default: 2 },
		itemSizePercent: { type: PropTypes.Number, default: 18 },
		enterFocusOnStart: { type: PropTypes.Boolean, default: true },
		screenPositionYIsTopDown: { type: PropTypes.Boolean, default: false },
		uiUpdateHz: { type: PropTypes.Number, default: 20 },
		predictLeadPercent: { type: PropTypes.Number, default: 8 },
		snapStepPercent: { type: PropTypes.Number, default: 4 },
		lerpPerSecond: { type: PropTypes.Number, default: 18 },
		quantizePercent: { type: PropTypes.Number, default: 0.1 },
		setOwnerOnly: { type: PropTypes.Boolean, default: false },
		startDropMode: { type: PropTypes.Number, default: 0 },
		gridColumns: { type: PropTypes.Number, default: 8 },
		gridRows: { type: PropTypes.Number, default: 12 },
		autoPeriodSeconds: { type: PropTypes.Number, default: 3 },
		autoRadiusPercent: { type: PropTypes.Number, default: 25 },
		autoWindowSeconds: { type: PropTypes.Number, default: 5 },
		showNativePulse: { type: PropTypes.Boolean, default: false },
		logStallGaps: { type: PropTypes.Boolean, default: true },
		stallGapMs: { type: PropTypes.Number, default: 100 },
		probeFrameGaps: { type: PropTypes.Boolean, default: false },
		screenPixelRatio: { type: PropTypes.Number, default: 2 },
		hudFontSize: { type: PropTypes.Number, default: 14 },
		drawBackdrop: { type: PropTypes.Boolean, default: true },
		canvasWidth: { type: PropTypes.Number, default: 0 },
		canvasHeight: { type: PropTypes.Number, default: 0 },
	};

	protected panelWidth: number = 1080;
	protected panelHeight: number = 1080;

	private _screenAspect: number = FALLBACK_SCREEN_ASPECT;
	private _pixelsPerScreenX: number = FALLBACK_READ_WIDTH * 2;
	private _pixelsPerScreenY: number = FALLBACK_READ_HEIGHT * 2;

	private _inputMode: number = INPUT_FI_ABSOLUTE;
	private _renderIndex: number = 2;
	private _family: number = FAMILY_LAYOUT;

	private _centreX: number = 0.5;
	private _centreY: number = 0.4;
	private _shownX: number = 0.5;
	private _shownY: number = 0.4;
	private _grabOffsetX: number = 0;
	private _grabOffsetY: number = 0;
	private _lastRawX: number = 0;
	private _lastRawY: number = 0;

	private _activeIndex: number | undefined = undefined;
	private _isDragging: boolean = false;
	private _dragSerial: number = 0;
	private _isAuto: boolean = false;
	private _autoPhase: number = 0;
	private _isFocusMode: boolean = false;

	private _isDirty: boolean = false;
	private _isLerpActive: boolean = false;
	private _lastFlushMs: number = 0;
	private _lastPushedX: number = -1;
	private _lastPushedY: number = -1;
	private _lastSnapColumn: number = -9999;
	private _lastSnapRow: number = -9999;
	private _velocityX: number = 0;
	private _velocityY: number = 0;
	private _lastSampleMs: number = 0;
	private _lastSampleX: number = 0;
	private _lastSampleY: number = 0;

	private readonly _tuneValues: number[] = [20, 8, 18, 4, 0.1, 0, 0];
	private _grabOriginX: number = 0;
	private _grabOriginY: number = 0;
	private _lastDropLabel: string = '';
	private _tuneIndex: number = TUNE_PREDICT_LEAD;

	private _setPlayers: Player[] | undefined = undefined;
	private _stats: StatWindow = createWindow(0);
	private _aggregates: { [key: string]: Aggregate } = {};
	private _gestureFallbackEnds: number = 0;
	private _lastTickMs: number = 0;
	private _lastFrameMs: number = 0;

	private _frameSubscription: EventSubscription | undefined = undefined;
	private _timerId: number | undefined = undefined;
	private _stallTimerId: number | undefined = undefined;
	private _gestures: Gestures | undefined = undefined;
	private _panSubscription: EventSubscription | undefined = undefined;

	private readonly _ax = new AnimatedBinding(0);
	private readonly _ay = new AnimatedBinding(0);
	private readonly _leftText = new Binding<string>('0%');
	private readonly _topText = new Binding<string>('0%');
	private readonly _objectPosition = new Binding<ScreenPoint>({ x: 0, y: 0 });
	private readonly _leftPx = new Binding<number>(0);
	private readonly _topPx = new Binding<number>(0);
	private readonly _dropModeBinding = new Binding<number>(DROP_FREE);
	private readonly _familyBinding = new Binding<number>(FAMILY_LAYOUT);
	private readonly _gridMounted = new Binding<boolean>(false);
	private readonly _isHeld = new Binding<boolean>(false);
	private readonly _heldBorderWidth = this._isHeld.derive((held: boolean) => (held === true ? 5 : 2));
	private readonly _heldBorderColor = this._isHeld.derive((held: boolean) => (held === true ? COLOR_BORDER_HELD : COLOR_BORDER_IDLE));
	private readonly _pulse = new AnimatedBinding(0);
	private readonly _hudTitle = new Binding<string>('');
	private readonly _hudResult = new Binding<string>('drag or auto circling results will show here');
	private readonly _renderLabel = new Binding<string>('');
	private readonly _inputLabel = new Binding<string>('');
	private readonly _autoLabel = new Binding<string>('');
	private readonly _hzLabel = new Binding<string>('');
	private readonly _tuneLabel = new Binding<string>('');

	//#region Lifecycle

	public preStart(): void {
		this.applyCanvasSize();
	}

	public initializeUI(): UINode {
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			return View({});
		}

		this.applyCanvasSize();
		this.readTunablesFromProps();
		this._inputMode = clampIndex(this.props.startInputMode, INPUT_LABELS.length);
		this._renderIndex = clampIndex(this.props.startRenderMode, RENDER_MODES.length);
		this._family = RENDER_MODES[this._renderIndex].family;
		this._familyBinding.set(this._family);
		this._gridMounted.set(this._inputMode === INPUT_PRESSABLE_GRID);

		const half = this.itemHalfSize();
		this._centreX = clamp(0.5, half.x, 1 - half.x);
		this._centreY = clamp(0.4, half.y, PLAY_AREA_BOTTOM - half.y);
		this._shownX = this._centreX;
		this._shownY = this._centreY;
		this.pushCentre(this._centreX, this._centreY, 0, true);
		this.refreshLabels();

		return View({
			children: [
				this.createNativePulse(),
				this.createDropOverlay(),
				this.createBox(FAMILY_STRING),
				this.createBox(FAMILY_LAYOUT),
				this.createBox(FAMILY_TRANSFORM),
				this.createBox(FAMILY_OBJECT),
				this.createBox(FAMILY_PX),
				this.createGrid(),
				this.createHud(),
				this.createControls(),
			],
			style: {
				width: '100%',
				height: '100%',
				backgroundColor: this.props.drawBackdrop === true ? COLOR_BACKDROP : 'transparent',
			},
		});
	}

	public start(): void {
		super.start();

		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			return;
		}

		this._setPlayers = this._tuneValues[TUNE_OWNER_ONLY] >= 1 ? [this.entity.owner.get()] : undefined;
		this.connectInputStream();
		this.connectFocusModeEvents();
		this.startNativePulse();
		this.startStallDetector();
		this.applyInputMode();
		this.refreshFrameSubscription();
		this.refreshTimer();

		if (this.props.enterFocusOnStart === true) {
			this.enterFocusMode();
		}

		console.log(`[DragLab] ready / ${INPUT_LABELS[this._inputMode]} / ${RENDER_MODES[this._renderIndex].label}`
			+ ` / aspect ${this._screenAspect.toFixed(3)} / transform px ${this._pixelsPerScreenX}x${this._pixelsPerScreenY}`
			+ ` / ownerOnly ${this._setPlayers !== undefined}`);
	}

	public dispose(): void {
		if (this._frameSubscription !== undefined) {
			this._frameSubscription.disconnect();
			this._frameSubscription = undefined;
		}
		if (this._timerId !== undefined) {
			this.async.clearInterval(this._timerId);
			this._timerId = undefined;
		}
		if (this._stallTimerId !== undefined) {
			this.async.clearInterval(this._stallTimerId);
			this._stallTimerId = undefined;
		}
		if (this._panSubscription !== undefined) {
			this._panSubscription.disconnect();
			this._panSubscription = undefined;
		}
		if (this._gestures !== undefined) {
			this._gestures.dispose();
			this._gestures = undefined;
		}
		this._pulse.stopAnimation();
		if (this._isFocusMode === true) {
			this._isFocusMode = false;
			this.exitFocusMode();
		}
	}

	//#endregion

	//#region Tunable settings

	private readTunablesFromProps(): void {
		this._tuneValues[TUNE_UPDATE_HZ] = nearestStep(this.props.uiUpdateHz, TUNABLES[TUNE_UPDATE_HZ].steps);
		this._tuneValues[TUNE_PREDICT_LEAD] = nearestStep(this.props.predictLeadPercent, TUNABLES[TUNE_PREDICT_LEAD].steps);
		this._tuneValues[TUNE_SMOOTH_RATE] = nearestStep(this.props.lerpPerSecond, TUNABLES[TUNE_SMOOTH_RATE].steps);
		this._tuneValues[TUNE_SNAP_STEP] = nearestStep(this.props.snapStepPercent, TUNABLES[TUNE_SNAP_STEP].steps);
		this._tuneValues[TUNE_ROUND_STEP] = nearestStep(this.props.quantizePercent, TUNABLES[TUNE_ROUND_STEP].steps);
		this._tuneValues[TUNE_OWNER_ONLY] = this.props.setOwnerOnly === true ? 1 : 0;
		this._tuneValues[TUNE_DROP_MODE] = clampIndex(this.props.startDropMode, DROP_LABELS.length);
		this._dropModeBinding.set(this._tuneValues[TUNE_DROP_MODE]);
	}

	private updateHz(): number {
		return this._tuneValues[TUNE_UPDATE_HZ];
	}

	private stepTune(index: number, delta: number): void {
		const tunable = TUNABLES[index];
		const next = clampIndex(stepIndexOf(tunable.steps, this._tuneValues[index]) + delta, tunable.steps.length);
		const value = tunable.steps[next];
		if (value === this._tuneValues[index]) {
			return;
		}

		this.stopActivity('setting changed');
		this._tuneValues[index] = value;
		if (index === TUNE_OWNER_ONLY) {
			this._setPlayers = value >= 1 ? [this.entity.owner.get()] : undefined;
			this.pushCentre(this._centreX, this._centreY, 0, true);
		}
		if (index === TUNE_DROP_MODE) {
			this._dropModeBinding.set(value);
		}
		if (index === TUNE_UPDATE_HZ && this._timerId !== undefined) {
			this.async.clearInterval(this._timerId);
			this._timerId = undefined;
			this.refreshTimer();
		}
		this.refreshLabels();
		console.log(`[DragLab][setting] ${tunable.label} = ${tunable.format(value)}`);
	}

	private selectTune(delta: number): void {
		this._tuneIndex = (this._tuneIndex + delta + TUNABLES.length) % TUNABLES.length;
		this.refreshLabels();
	}

	private settingTag(): string {
		const hz = TUNABLES[TUNE_UPDATE_HZ].format(this.updateHz());
		let tag = '';
		switch (RENDER_MODES[this._renderIndex].pacing) {
			case PACE_THROTTLE_TWEEN:
			case PACE_TIMER:
				tag = hz;
				break;
			case PACE_PREDICT_TWEEN:
				tag = `${hz} lead ${this._tuneValues[TUNE_PREDICT_LEAD]}%`;
				break;
			case PACE_FRAME_LERP:
				tag = `k ${this._tuneValues[TUNE_SMOOTH_RATE]}/s`;
				break;
			case PACE_SNAP_GRID:
				tag = `step ${this._tuneValues[TUNE_SNAP_STEP]}%`;
				break;
			default:
				tag = 'no throttle';
				break;
		}
		const round = this._tuneValues[TUNE_ROUND_STEP];
		const drop = this._tuneValues[TUNE_DROP_MODE];
		return `${tag} / round ${round <= 0 ? 'off' : `${round}%`}`
			+ `${this._tuneValues[TUNE_OWNER_ONLY] >= 1 ? ' / owner-only' : ''}`
			+ `${drop !== DROP_FREE ? ` / drop ${DROP_LABELS[drop]}` : ''}`;
	}

	//#endregion

	//#region Mode switching

	private selectRender(index: number): void {
		this.stopActivity('render changed');

		this._renderIndex = (index + RENDER_MODES.length) % RENDER_MODES.length;
		const family = RENDER_MODES[this._renderIndex].family;
		if (family !== this._family) {
			this._family = family;
			this._familyBinding.set(family);
		}
		this._isDirty = false;
		this._isLerpActive = false;
		this._shownX = this._centreX;
		this._shownY = this._centreY;
		this._lastSnapColumn = -9999;
		this._lastSnapRow = -9999;
		this.resetVelocity();
		this.pushCentre(this._centreX, this._centreY, 0, true);

		this.refreshFrameSubscription();
		this.refreshTimer();
		this.refreshLabels();
	}

	private selectInput(index: number): void {
		this.stopActivity('입력 변경');
		this._inputMode = (index + INPUT_LABELS.length) % INPUT_LABELS.length;
		this._gridMounted.set(this._inputMode === INPUT_PRESSABLE_GRID);
		this.applyInputMode();
		this.refreshLabels();
	}

	private applyInputMode(): void {
		if (this._inputMode === INPUT_GESTURE_PAN) {
			if (this._gestures === undefined) {
				this._gestures = new Gestures(this);
				this._panSubscription = this._gestures.onPan.connectLocalEvent((payload: PanEventData) => this.onPan(payload));
			}
			return;
		}
		if (this._panSubscription !== undefined) {
			this._panSubscription.disconnect();
			this._panSubscription = undefined;
		}
		if (this._gestures !== undefined) {
			this._gestures.dispose();
			this._gestures = undefined;
		}
	}

	private toggleAuto(): void {
		if (this._isAuto === true) {
			this.closeWindow('auto off');
			this._isAuto = false;
			this._isHeld.set(false, this._setPlayers);
		}
		else {
			this.stopActivity('auto on');
			this._isAuto = true;
			this._autoPhase = 0;
			this.resetVelocity();
			this.beginWindow();
			this._isHeld.set(true, this._setPlayers);
		}
		this.refreshFrameSubscription();
		this.refreshLabels();
	}

	private stopActivity(reason: string): void {
		if (this._isDragging === true) {
			this.finishDrag(reason);
		}
		if (this._isAuto === true) {
			this.closeWindow(reason);
			this.beginWindow();
		}
	}

	private refreshLabels(): void {
		const mode = RENDER_MODES[this._renderIndex];
		this._renderLabel.set(`${mode.label}  ▶`);
		this._inputLabel.set(INPUT_LABELS[this._inputMode]);
		this._autoLabel.set(this._isAuto === true ? 'auto: on' : 'auto: off');
		this._hzLabel.set(`throttle  ${TUNABLES[TUNE_UPDATE_HZ].format(this.updateHz())}`);
		const tunable = TUNABLES[this._tuneIndex];
		this._tuneLabel.set(`${tunable.label}: ${tunable.format(this._tuneValues[this._tuneIndex])}  ▶`);
		this._hudTitle.set(`${INPUT_LABELS[this._inputMode]} · ${mode.label} [${FAMILY_TAGS[mode.family]}]`
			+ `${this._isAuto === true ? ' · auto circling' : ''}\n${this.settingTag()}`);
	}

	private refreshFrameSubscription(): void {
		const pacing = RENDER_MODES[this._renderIndex].pacing;
		const isNeeded = pacing === PACE_FRAME || pacing === PACE_FRAME_LERP
			|| this._isAuto === true || this.props.probeFrameGaps === true;

		if (isNeeded === true && this._frameSubscription === undefined) {
			this._lastFrameMs = 0;
			this._frameSubscription = this.connectLocalBroadcastEvent(World.onUpdate,
				(data: { deltaTime: number }) => this.onFrame(data.deltaTime));
		}
		else if (isNeeded === false && this._frameSubscription !== undefined) {
			this._frameSubscription.disconnect();
			this._frameSubscription = undefined;
		}
	}

	private refreshTimer(): void {
		const isNeeded = RENDER_MODES[this._renderIndex].pacing === PACE_TIMER;
		if (isNeeded === true && this._timerId === undefined) {
			const interval = Math.max(8, this.flushIntervalMs());
			this._timerId = this.async.setInterval(() => this.onTimerTick(), interval);
		}
		else if (isNeeded === false && this._timerId !== undefined) {
			this.async.clearInterval(this._timerId);
			this._timerId = undefined;
		}
	}

	//#endregion

	//#region Focused Interaction

	private enterFocusMode(): void {
		this.entity.owner.get().enterFocusedInteractionMode({ disableFocusExitButton: false });
	}

	private exitFocusMode(): void {
		this.entity.owner.get().exitFocusedInteractionMode();
	}

	private connectFocusModeEvents(): void {
		this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnteredFocusedInteraction,
			(player: Player) => {
				this._isFocusMode = true;
			});
		this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerExitedFocusedInteraction,
			(player: Player) => {
				this._isFocusMode = false;
				if (this._isDragging === true && this._inputMode !== INPUT_PRESSABLE_GRID) {
					this.finishDrag('Focus mode off');
				}
			});
	}

	private connectInputStream(): void {
		this.connectLocalBroadcastEvent(PlayerControls.onFocusedInteractionInputStarted,
			(data: { interactionInfo: InteractionInfo[] }) => this.onRawStarted(data.interactionInfo));
		this.connectLocalBroadcastEvent(PlayerControls.onFocusedInteractionInputMoved,
			(data: { interactionInfo: InteractionInfo[] }) => this.onRawMoved(data.interactionInfo));
		this.connectLocalBroadcastEvent(PlayerControls.onFocusedInteractionInputEnded,
			(data: { interactionInfo: InteractionInfo[] }) => this.onRawEnded(data.interactionInfo));
	}

	//#endregion

	//#region Input - Focused Interaction stream

	private isStreamInput(): boolean {
		return this._inputMode === INPUT_FI_ABSOLUTE || this._inputMode === INPUT_FI_DELTA;
	}

	private pickInteraction(list: InteractionInfo[]): InteractionInfo | undefined {
		if (list === undefined || list.length === 0) {
			return undefined;
		}
		if (this._activeIndex === undefined) {
			return list[0];
		}
		for (const info of list) {
			if (info.interactionIndex === this._activeIndex) {
				return info;
			}
		}
		if (list.length === 1) {
			this._activeIndex = list[0].interactionIndex;
			return list[0];
		}
		return undefined;
	}

	private onRawStarted(list: InteractionInfo[]): void {
		if (this._isAuto === true || this._isDragging === true || this.isStreamInput() === false) {
			return;
		}
		const info = this.pickInteraction(list);
		if (info === undefined) {
			return;
		}
		const point = this.toScreenPoint(info.screenPosition);
		if (point === undefined || this.hitTest(point, 0, 0) === false) {
			return;
		}
		this.beginDrag(info.interactionIndex, point);
	}

	private onRawMoved(list: InteractionInfo[]): void {
		if (this._isAuto === true || this._isDragging === false || this.isStreamInput() === false) {
			return;
		}
		this._stats.rawInputs++;

		const info = this.pickInteraction(list);
		if (info === undefined) {
			return;
		}
		const point = this.toScreenPoint(info.screenPosition);
		if (point === undefined) {
			return;
		}
		this.noteInput(Date.now());
		this.applyStreamPoint(point);
		this.onTargetChanged();
	}

	private onRawEnded(list: InteractionInfo[]): void {
		if (this._isDragging === false || this._isAuto === true) {
			return;
		}
		if (this._inputMode === INPUT_PRESSABLE_GRID) {
			return;
		}
		const info = this.pickInteraction(list);
		if (info === undefined) {
			return;
		}

		if (this._inputMode === INPUT_GESTURE_PAN) {
			const serial = this._dragSerial;
			this.async.setTimeout(() => {
				if (this._isDragging === true && this._dragSerial === serial) {
					this._gestureFallbackEnds++;
					this.finishDrag('pan end not arrived -> finished with FI ended ');
				}
			}, GESTURE_END_GRACE_MS);
			return;
		}

		const point = this.toScreenPoint(info.screenPosition);
		if (point !== undefined) {
			this.applyStreamPoint(point);
		}
		this.finishDrag('FI ended');
	}

	private applyStreamPoint(point: ScreenPoint): void {
		if (this._inputMode === INPUT_FI_DELTA) {
			const dx = point.x - this._lastRawX;
			const dy = point.y - this._lastRawY;
			this._lastRawX = point.x;
			this._lastRawY = point.y;
			this.moveCentreTo(this._centreX + dx, this._centreY + dy);
			return;
		}
		this.moveCentreTo(point.x + this._grabOffsetX, point.y + this._grabOffsetY);
	}

	private toScreenPoint(position: Vec3 | undefined): ScreenPoint | undefined {
		if (position === undefined) {
			return undefined;
		}
		const x = position.x;
		const rawY = position.y;
		if (isFinite(x) === false || isFinite(rawY) === false) {
			return undefined;
		}
		return { x: x, y: this.props.screenPositionYIsTopDown === true ? rawY : 1 - rawY };
	}

	//#endregion

	//#region Input - Gestures.onPan

	private pickTouch(touches: TouchState[]): TouchState | undefined {
		if (touches === undefined || touches.length === 0) {
			return undefined;
		}
		if (this._activeIndex === undefined) {
			return touches[0];
		}
		for (const touch of touches) {
			if (touch.current.interactionIndex === this._activeIndex) {
				return touch;
			}
		}
		return touches.length === 1 ? touches[0] : undefined;
	}

	private onPan(payload: PanEventData): void {
		if (this._inputMode !== INPUT_GESTURE_PAN || this._isAuto === true) {
			return;
		}
		const touch = this.pickTouch(payload.touches);
		if (touch === undefined) {
			return;
		}

		if (this._isDragging === false) {
			if (touch.phase === 'end') {
				return;
			}
			const start = this.toScreenPoint(touch.start.screenPosition);
			if (start === undefined || this.hitTest(start, 0, 0) === false) {
				return;
			}
			this.beginDrag(touch.start.interactionIndex, start);
		}

		const point = this.toScreenPoint(touch.current.screenPosition);
		if (point === undefined) {
			return;
		}
		const now = Date.now();
		this.noteInput(now);
		if (isFinite(touch.current.time) === true && touch.current.time > 0) {
			this._stats.maxLatencyMs = Math.max(this._stats.maxLatencyMs, now - touch.current.time);
		}
		this.moveCentreTo(point.x + this._grabOffsetX, point.y + this._grabOffsetY);

		if (touch.phase === 'end') {
			this.finishDrag('pan end');
			return;
		}
		this.onTargetChanged();
	}

	//#endregion

	//#region Input - Pressable grid

	private gridCellCentre(column: number, row: number): ScreenPoint {
		return {
			x: (column + 0.5) / this.gridColumns(),
			y: (row + 0.5) / this.gridRows() * PLAY_AREA_BOTTOM,
		};
	}

	private onGridPress(column: number, row: number): void {
		if (this._inputMode !== INPUT_PRESSABLE_GRID || this._isAuto === true) {
			return;
		}
		if (this._isDragging === true) {
			this.finishDrag('before release lost');
		}
		const point = this.gridCellCentre(column, row);
		const marginX = 0.5 / this.gridColumns();
		const marginY = 0.5 * PLAY_AREA_BOTTOM / this.gridRows();
		if (this.hitTest(point, marginX, marginY) === false) {
			return;
		}
		this.beginDrag(0, point);
	}

	private onGridEnter(column: number, row: number): void {
		if (this._inputMode !== INPUT_PRESSABLE_GRID || this._isDragging === false) {
			return;
		}
		const point = this.gridCellCentre(column, row);
		this.noteInput(Date.now());
		this.moveCentreTo(point.x + this._grabOffsetX, point.y + this._grabOffsetY);
		this.onTargetChanged();
	}

	private onGridRelease(): void {
		if (this._inputMode !== INPUT_PRESSABLE_GRID || this._isDragging === false) {
			return;
		}
		this.finishDrag('Pressable release');
	}

	//#endregion

	//#region Drag lifecycle

	private beginDrag(interactionIndex: number, point: ScreenPoint): void {
		this._activeIndex = interactionIndex;
		this._isDragging = true;
		this._dragSerial++;
		this._grabOffsetX = this._centreX - point.x;
		this._grabOffsetY = this._centreY - point.y;
		this._grabOriginX = this._centreX;
		this._grabOriginY = this._centreY;
		this._lastRawX = point.x;
		this._lastRawY = point.y;
		this.resetVelocity();
		this.beginWindow();
		this._isHeld.set(true, this._setPlayers);
		this._stats.sets++;
	}

	private finishDrag(reason: string): void {
		if (this._isDragging === false) {
			return;
		}
		this._isDragging = false;
		this._activeIndex = undefined;

		const drop = this.resolveDrop();
		this._centreX = drop.x;
		this._centreY = drop.y;
		this._lastDropLabel = drop.label;
		if (RENDER_MODES[this._renderIndex].pacing === PACE_FRAME_LERP) {
			this._isLerpActive = true;
		}
		else {
			this.pushCentre(drop.x, drop.y, drop.tweenMs, false, Easing.out(Easing.quad));
		}
		this._isHeld.set(false, this._setPlayers);
		this._stats.sets++;
		this.closeWindow(reason);
	}

	private dropCellSize(): ScreenPoint {
		const half = this.itemHalfSize();
		return { x: half.x * 2, y: half.y * 2 };
	}

	private dropGridRows(): number {
		const cell = this.dropCellSize();
		const fit = Math.floor((PLAY_AREA_BOTTOM - DROP_GRID_TOP) / cell.y);
		return Math.max(1, Math.min(DROP_GRID_MAX_ROWS, fit));
	}

	private dropZones(): DropZone[] {
		const height = Math.min(ZONE_WIDTH * this._screenAspect, ZONE_MAX_HEIGHT);
		return [
			{ id: 'Zone A', left: ZONE_MARGIN, top: ZONE_TOP, width: ZONE_WIDTH, height: height },
			{ id: 'Zone B', left: 1 - ZONE_MARGIN - ZONE_WIDTH, top: ZONE_TOP, width: ZONE_WIDTH, height: height },
		];
	}

	private resolveDrop(): DropResult {
		const mode = this._tuneValues[TUNE_DROP_MODE];
		if (mode === DROP_GRID) {
			const cell = this.dropCellSize();
			const col = clampIndex((this._centreX - DROP_GRID_LEFT) / cell.x - 0.5, DROP_GRID_COLS);
			const row = clampIndex((this._centreY - DROP_GRID_TOP) / cell.y - 0.5, this.dropGridRows());
			return {
				x: DROP_GRID_LEFT + (col + 0.5) * cell.x,
				y: DROP_GRID_TOP + (row + 0.5) * cell.y,
				tweenMs: DROP_TWEEN_MS,
				label: `snapped to [col ${col}, row ${row}]`,
			};
		}
		if (mode === DROP_ZONE) {
			for (const zone of this.dropZones()) {
				const isInside = this._centreX >= zone.left && this._centreX <= zone.left + zone.width
					&& this._centreY >= zone.top && this._centreY <= zone.top + zone.height;
				if (isInside === true) {
					return {
						x: zone.left + zone.width / 2,
						y: zone.top + zone.height / 2,
						tweenMs: DROP_TWEEN_MS,
						label: `landed in ${zone.id}`,
					};
				}
			}
			return { x: this._grabOriginX, y: this._grabOriginY, tweenMs: DROP_TWEEN_MS, label: 'outside: returned to origin' };
		}
		return { x: this._centreX, y: this._centreY, tweenMs: 0, label: '' };
	}

	private moveCentreTo(centreX: number, centreY: number): void {
		const half = this.itemHalfSize();
		this._centreX = clamp(centreX, half.x, 1 - half.x);
		this._centreY = clamp(centreY, half.y, PLAY_AREA_BOTTOM - half.y);
	}

	private itemHalfSize(): ScreenPoint {
		const halfWidth = clamp(this.props.itemSizePercent, 2, 60) / 200;
		return { x: halfWidth, y: halfWidth * this._screenAspect };
	}

	private hitTest(point: ScreenPoint, marginX: number, marginY: number): boolean {
		const half = this.itemHalfSize();
		return Math.abs(point.x - this._centreX) <= half.x + marginX
			&& Math.abs(point.y - this._centreY) <= half.y + marginY;
	}

	//#endregion

	//#region Render pacing

	private onTargetChanged(): void {
		switch (RENDER_MODES[this._renderIndex].pacing) {
			case PACE_IMMEDIATE:
				this.pushCentre(this._centreX, this._centreY, 0, false);
				break;
			case PACE_THROTTLE_TWEEN: {
				const interval = this.flushIntervalMs();
				if (Date.now() - this._lastFlushMs >= interval) {
					this.pushCentre(this._centreX, this._centreY, interval, false);
				}
				else {
					this._isDirty = true;
				}
				break;
			}
			case PACE_FRAME:
			case PACE_TIMER:
				this._isDirty = true;
				break;
			case PACE_FRAME_LERP:
				this._isLerpActive = true;
				break;
			case PACE_SNAP_GRID:
				this.pushSnapped();
				break;
			case PACE_PREDICT_TWEEN:
				this.pushPredicted();
				break;
			default:
				break;
		}
	}

	private resetVelocity(): void {
		this._velocityX = 0;
		this._velocityY = 0;
		this._lastSampleMs = 0;
	}

	private sampleVelocity(now: number): void {
		if (this._lastSampleMs > 0) {
			const elapsed = now - this._lastSampleMs;
			if (elapsed <= 0) {
				return;
			}
			if (elapsed > VELOCITY_RESET_GAP_MS) {
				this._velocityX = 0;
				this._velocityY = 0;
			}
			else {
				const measuredX = (this._centreX - this._lastSampleX) * 1000 / elapsed;
				const measuredY = (this._centreY - this._lastSampleY) * 1000 / elapsed;
				this._velocityX += (measuredX - this._velocityX) * VELOCITY_SMOOTHING;
				this._velocityY += (measuredY - this._velocityY) * VELOCITY_SMOOTHING;
			}
		}
		this._lastSampleMs = now;
		this._lastSampleX = this._centreX;
		this._lastSampleY = this._centreY;
	}

	private pushPredicted(): void {
		const now = Date.now();
		this.sampleVelocity(now);
		const interval = this.flushIntervalMs();
		if (now - this._lastFlushMs < interval) {
			this._isDirty = true;
			return;
		}
		const leadSeconds = interval / 1000;
		const maxLead = clamp(this._tuneValues[TUNE_PREDICT_LEAD], 0, 50) / 100;
		const leadX = clamp(this._velocityX * leadSeconds, -maxLead, maxLead);
		const leadY = clamp(this._velocityY * leadSeconds, -maxLead, maxLead);
		this.pushCentre(this._centreX + leadX, this._centreY + leadY, interval, false);
	}

	private onFrame(deltaTime: number): void {
		const now = Date.now();
		if (this._lastFrameMs > 0 && (this._isDragging === true || this._isAuto === true)) {
			const gap = now - this._lastFrameMs;
			this._stats.maxFrameGapMs = Math.max(this._stats.maxFrameGapMs, gap);
			if (gap > this.props.stallGapMs) {
				this._stats.frameStalls++;
				this.logStall('frame', gap);
			}
		}
		this._lastFrameMs = now;

		if (this._isAuto === true) {
			this.driveAuto(deltaTime, now);
		}

		const pacing = RENDER_MODES[this._renderIndex].pacing;
		if (pacing === PACE_FRAME && this._isDirty === true) {
			this.pushCentre(this._centreX, this._centreY, 0, false);
		}
		else if (pacing === PACE_FRAME_LERP && this._isLerpActive === true) {
			this.stepLerp(deltaTime);
		}
	}

	private onTimerTick(): void {
		if (this._isDirty === true) {
			this.pushCentre(this._centreX, this._centreY, 0, false);
		}
	}

	private stepLerp(deltaTime: number): void {
		const rate = clamp(this._tuneValues[TUNE_SMOOTH_RATE], 1, 120);
		const alpha = 1 - Math.exp(-rate * clamp(deltaTime, 0, 0.25));
		this._shownX += (this._centreX - this._shownX) * alpha;
		this._shownY += (this._centreY - this._shownY) * alpha;

		const isSettled = Math.abs(this._centreX - this._shownX) < LERP_EPSILON
			&& Math.abs(this._centreY - this._shownY) < LERP_EPSILON;
		if (isSettled === true) {
			this._shownX = this._centreX;
			this._shownY = this._centreY;
			if (this._isDragging === false && this._isAuto === false) {
				this._isLerpActive = false;
			}
		}
		this.pushCentre(this._shownX, this._shownY, 0, false);
	}

	private pushSnapped(): void {
		const step = clamp(this._tuneValues[TUNE_SNAP_STEP], 0.5, 50) / 100;
		const column = Math.round(this._centreX / step);
		const row = Math.round(this._centreY / step);
		if (column === this._lastSnapColumn && row === this._lastSnapRow) {
			return;
		}
		this._lastSnapColumn = column;
		this._lastSnapRow = row;
		this.pushCentre(column * step, row * step, SNAP_TWEEN_MS, false);
	}

	private driveAuto(deltaTime: number, now: number): void {
		const period = clamp(this.props.autoPeriodSeconds, 0.3, 60);
		this._autoPhase = (this._autoPhase + clamp(deltaTime, 0, 0.25) * Math.PI * 2 / period) % (Math.PI * 2);
		const radiusX = clamp(this.props.autoRadiusPercent, 1, 45) / 100;
		const radiusY = radiusX * this._screenAspect;

		this.noteInput(now);
		this.moveCentreTo(AUTO_CENTRE_X + Math.cos(this._autoPhase) * radiusX,
			AUTO_CENTRE_Y + Math.sin(this._autoPhase) * radiusY);
		this.onTargetChanged();

		if (now - this._stats.startMs >= clamp(this.props.autoWindowSeconds, 1, 120) * 1000) {
			this.closeWindow('auto division');
			this.beginWindow();
		}
	}

	private flushIntervalMs(): number {
		const hz = this.updateHz();
		if (isFinite(hz) === false || hz <= 0) {
			return 0;
		}
		return 1000 / clamp(hz, 1, 120);
	}

	private quantize(fraction: number): number {
		const step = this._tuneValues[TUNE_ROUND_STEP] / 100;
		if (isFinite(step) === false || step <= 0) {
			return fraction;
		}
		return Math.round(fraction / step) * step;
	}

	private pushCentre(centreX: number, centreY: number, tweenMs: number, force: boolean, easing?: Easing): void {
		const half = this.itemHalfSize();
		const x = this.quantize(clamp(centreX, half.x, 1 - half.x) - half.x);
		const y = this.quantize(clamp(centreY, half.y, PLAY_AREA_BOTTOM - half.y) - half.y);
		this._isDirty = false;

		const isXChanged = force === true || x !== this._lastPushedX;
		const isYChanged = force === true || y !== this._lastPushedY;
		if (isXChanged === false && isYChanged === false) {
			return;
		}

		switch (this._family) {
			case FAMILY_STRING:
				if (isXChanged === true) {
					this._leftText.set(percentText(x), this._setPlayers);
					this._stats.sets++;
				}
				if (isYChanged === true) {
					this._topText.set(percentText(y), this._setPlayers);
					this._stats.sets++;
				}
				break;
			case FAMILY_OBJECT:
				this._objectPosition.set({ x: x, y: y }, this._setPlayers);
				this._stats.sets++;
				break;
			case FAMILY_PX:
				if (isXChanged === true) {
					this._leftPx.set(Math.round(x * this._pixelsPerScreenX), this._setPlayers);
					this._stats.sets++;
				}
				if (isYChanged === true) {
					this._topPx.set(Math.round(y * this._pixelsPerScreenY), this._setPlayers);
					this._stats.sets++;
				}
				break;
			default:
				if (isXChanged === true) {
					this.setAnimated(this._ax, x, tweenMs, easing);
				}
				if (isYChanged === true) {
					this.setAnimated(this._ay, y, tweenMs, easing);
				}
				break;
		}

		this._lastPushedX = x;
		this._lastPushedY = y;
		this._lastFlushMs = Date.now();
	}

	private setAnimated(binding: AnimatedBinding, value: number, tweenMs: number, easing?: Easing): void {
		if (tweenMs > 0) {
			const curve = easing === undefined ? Easing.linear : easing;
			binding.set(Animation.timing(value, { duration: tweenMs, easing: curve }), undefined, this._setPlayers);
		}
		else {
			binding.set(value, undefined, this._setPlayers);
		}
		this._stats.sets++;
	}

	//#endregion

	//#region Measurement

	private beginWindow(): void {
		this._stats = createWindow(Date.now());
		this._gestureFallbackEnds = 0;
		this._lastDropLabel = '';
	}

	private noteInput(now: number): void {
		const stats = this._stats;
		if (stats.lastInputMs > 0) {
			const gap = now - stats.lastInputMs;
			stats.maxInputGapMs = Math.max(stats.maxInputGapMs, gap);
			if (gap > this.props.stallGapMs) {
				stats.inputStalls++;
				this.logStall('input', gap);
			}
		}
		stats.lastInputMs = now;
		stats.inputs++;
	}

	private startStallDetector(): void {
		if (this._stallTimerId !== undefined) {
			return;
		}
		this._stallTimerId = this.async.setInterval(() => {
			const now = Date.now();
			if (this._lastTickMs > 0) {
				const gap = now - this._lastTickMs;
				if (this._isDragging === true || this._isAuto === true) {
					this._stats.maxVmGapMs = Math.max(this._stats.maxVmGapMs, gap);
				}
				if (gap > this.props.stallGapMs) {
					if (this._isDragging === true || this._isAuto === true) {
						this._stats.vmStalls++;
					}
					this.logStall('VM', gap);
				}
			}
			this._lastTickMs = now;
		}, STALL_TICK_MS);
	}

	private logStall(kind: string, gapMs: number): void {
		if (this.props.logStallGaps !== true) {
			return;
		}
		const state = this._isDragging === true ? 'dragging' : (this._isAuto === true ? 'auto' : 'wait');
		console.log(`[DragLab][${kind}] gap ${gapMs}ms (${state}, ${RENDER_MODES[this._renderIndex].label})`);
	}

	private closeWindow(reason: string): void {
		const stats = this._stats;
		const duration = Math.max(1, Date.now() - stats.startMs);
		const source = this._isAuto === true ? 'auto circling' : INPUT_LABELS[this._inputMode];
		const render = RENDER_MODES[this._renderIndex].label;

		const key = `${source} / ${render} @ ${this.settingTag()}`;
		let aggregate = this._aggregates[key];
		if (aggregate === undefined) {
			aggregate = createAggregate();
			this._aggregates[key] = aggregate;
		}
		aggregate.runs++;
		aggregate.durationMs += duration;
		aggregate.inputs += stats.inputs;
		aggregate.sets += stats.sets;
		aggregate.worstInputGapMs = Math.max(aggregate.worstInputGapMs, stats.maxInputGapMs);
		aggregate.worstVmGapMs = Math.max(aggregate.worstVmGapMs, stats.maxVmGapMs);
		aggregate.worstFrameGapMs = Math.max(aggregate.worstFrameGapMs, stats.maxFrameGapMs);
		aggregate.worstLatencyMs = Math.max(aggregate.worstLatencyMs, stats.maxLatencyMs);
		aggregate.inputStalls += stats.inputStalls;
		aggregate.vmStalls += stats.vmStalls;
		aggregate.frameStalls += stats.frameStalls;

		const setsPerInput = stats.inputs > 0 ? (stats.sets / stats.inputs).toFixed(2) : '-';
		const raw = this.isStreamInput() === true && this._isAuto === false ? ` (raw ${stats.rawInputs})` : '';
		const latency = stats.maxLatencyMs > 0 ? ` / max delay ${stats.maxLatencyMs}ms` : '';
		const fallback = this._gestureFallbackEnds > 0 ? ` / pan end changed ${this._gestureFallbackEnds} times` : '';
		const dropNote = this._lastDropLabel !== '' ? ` | drop: ${this._lastDropLabel}` : '';
		console.log(`[DragLab] ${key} | ${reason} | ${duration}ms`
			+ ` | input ${stats.inputs}${raw} = ${perSecond(stats.inputs, duration)}/s`
			+ ` | set ${stats.sets} = ${perSecond(stats.sets, duration)}/s (${setsPerInput}/input)`
			+ ` | max space input ${stats.maxInputGapMs} vm ${stats.maxVmGapMs} frame ${stats.maxFrameGapMs}ms`
			+ ` | stop input ${stats.inputStalls} vm ${stats.vmStalls} frame ${stats.frameStalls}${latency}${fallback}${dropNote}`);

		this._hudResult.set(`${(duration / 1000).toFixed(1)}s · input ${perSecond(stats.inputs, duration)}/s · set ${perSecond(stats.sets, duration)}/s`
			+ `\n max space input ${stats.maxInputGapMs} / vm ${stats.maxVmGapMs} / frame ${stats.maxFrameGapMs} ms`
			+ ` · stop ${stats.inputStalls}/${stats.vmStalls}/${stats.frameStalls}${latency}`
			+ `${this._lastDropLabel !== '' ? `\ndrop: ${this._lastDropLabel}` : ''}`);
	}

	private printSummary(): void {
		const keys = Object.keys(this._aggregates);
		console.log(`[DragLab] ===== summation ${keys.length} times (stop base: ${this.props.stallGapMs}ms) =====`);
		for (const key of keys) {
			const a = this._aggregates[key];
			console.log(`[DragLab][summation] ${key} | ${a.runs}회 ${(a.durationMs / 1000).toFixed(1)}s`
				+ ` | input ${perSecond(a.inputs, a.durationMs)}/s | set ${perSecond(a.sets, a.durationMs)}/s`
				+ ` | worst space input ${a.worstInputGapMs} vm ${a.worstVmGapMs} frame ${a.worstFrameGapMs}ms`
				+ ` | stop input ${a.inputStalls} vm ${a.vmStalls} frame ${a.frameStalls}`
				+ `${a.worstLatencyMs > 0 ? ` | worst delay ${a.worstLatencyMs}ms` : ''}`);
		}
		this._hudResult.set(`summation ${keys.length} times printed`);
	}

	private startNativePulse(): void {
		if (this.props.showNativePulse !== true) {
			return;
		}
		this._pulse.set(Animation.repeat(Animation.sequence(
			Animation.timing(1, { duration: PULSE_SWEEP_MS, easing: Easing.linear }),
			Animation.timing(0, { duration: PULSE_SWEEP_MS, easing: Easing.linear }),
		)));
	}

	//#endregion

	//#region View

	private fontSize(scale: number): number {
		return Math.round(clamp(this.props.hudFontSize, 6, 60) * clamp(this.props.screenPixelRatio, 0.5, 4) * scale);
	}

	private createBox(family: number): UINode {
		const size = clamp(this.props.itemSizePercent, 2, 60);
		const style: ViewStyle = {
			position: 'absolute',
			width: `${size}%`,
			aspectRatio: 1,
			borderRadius: 12,
			borderWidth: this._heldBorderWidth,
			borderColor: this._heldBorderColor,
			backgroundColor: FAMILY_COLORS[family],
			alignItems: 'center',
			justifyContent: 'center',
		};

		switch (family) {
			case FAMILY_STRING:
				style.left = this._leftText;
				style.top = this._topText;
				break;
			case FAMILY_TRANSFORM:
				style.left = 0;
				style.top = 0;
				style.transform = [
					{ translateX: this._ax.interpolate([0, 1], [0, this._pixelsPerScreenX]) },
					{ translateY: this._ay.interpolate([0, 1], [0, this._pixelsPerScreenY]) },
				];
				break;
			case FAMILY_OBJECT:
				style.left = this._objectPosition.derive((p: ScreenPoint) => percentText(p.x));
				style.top = this._objectPosition.derive((p: ScreenPoint) => percentText(p.y));
				break;
			case FAMILY_PX:
				style.left = this._leftPx;
				style.top = this._topPx;
				break;
			default:
				style.left = this._ax.interpolate([0, 1], ['0%', '100%']);
				style.top = this._ay.interpolate([0, 1], ['0%', '100%']);
				break;
		}

		const box = View({
			children: [
				Text({
					text: FAMILY_TAGS[family],
					style: { color: '#ffffff', fontSize: this.fontSize(1.6), fontWeight: 'bold' },
				}),
			],
			style: style,
		});
		return UINode.if(this._familyBinding.derive((current: number) => current === family), box);
	}

	private createDropOverlay(): UINode {
		const cell = this.dropCellSize();
		const rows = this.dropGridRows();
		const cells: UINode[] = [];
		for (let row = 0; row < rows; row++) {
			for (let column = 0; column < DROP_GRID_COLS; column++) {
				cells.push(View({
					style: {
						position: 'absolute',
						left: percentText(DROP_GRID_LEFT + column * cell.x),
						top: percentText(DROP_GRID_TOP + row * cell.y),
						width: percentText(cell.x),
						height: percentText(cell.y),
						borderWidth: 2,
						borderColor: COLOR_BACKDROP,
						borderRadius: 6,
						backgroundColor: COLOR_DROP_CELL,
					},
				}));
			}
		}
		const zones: UINode[] = [];
		for (const zone of this.dropZones()) {
			zones.push(View({
				children: [
					Text({ text: zone.id, style: { color: COLOR_ZONE_BORDER, fontSize: this.fontSize(1), fontWeight: 'bold' } }),
				],
				style: {
					position: 'absolute',
					left: percentText(zone.left),
					top: percentText(zone.top),
					width: percentText(zone.width),
					height: percentText(zone.height),
					borderWidth: 2,
					borderColor: COLOR_ZONE_BORDER,
					borderRadius: 12,
					backgroundColor: COLOR_ZONE_FILL,
					alignItems: 'center',
					justifyContent: 'center',
				},
			}));
		}
		return View({
			children: [
				UINode.if(this._dropModeBinding.derive((mode: number) => mode === DROP_GRID), View({ children: cells })),
				UINode.if(this._dropModeBinding.derive((mode: number) => mode === DROP_ZONE), View({ children: zones })),
			],
		});
	}

	private createGrid(): UINode {
		const columns = this.gridColumns();
		const rows = this.gridRows();
		const rowNodes: UINode[] = [];
		for (let row = 0; row < rows; row++) {
			const cells: UINode[] = [];
			for (let column = 0; column < columns; column++) {
				cells.push(Pressable({
					onPress: () => this.onGridPress(column, row),
					onEnter: () => this.onGridEnter(column, row),
					onRelease: () => this.onGridRelease(),
					style: {
						flex: 1,
						borderWidth: 1,
						borderColor: COLOR_GRID_LINE,
						backgroundColor: COLOR_GRID_CELL,
					},
				}));
			}
			rowNodes.push(View({ children: cells, style: { flex: 1, flexDirection: 'row' } }));
		}
		return UINode.if(this._gridMounted, View({
			children: rowNodes,
			style: {
				position: 'absolute',
				left: 0,
				top: 0,
				width: '100%',
				height: percentText(PLAY_AREA_BOTTOM),
			},
		}));
	}

	private createHud(): UINode {
		return View({
			children: [
				Text({ text: this._hudTitle, style: { color: COLOR_TEXT, fontSize: this.fontSize(1) } }),
				Text({ text: this._hudResult, style: { color: COLOR_TEXT_DIM, fontSize: this.fontSize(0.9) } }),
			],
			style: { position: 'absolute', left: '4%', top: '6%', width: '92%' },
		});
	}

	private createNativePulse(): UINode {
		if (this.props.showNativePulse !== true) {
			return View({});
		}
		return View({
			children: [
				View({
					style: {
						position: 'absolute',
						left: this._pulse.interpolate([0, 1], ['0%', '85%']),
						top: 0,
						width: '15%',
						height: '100%',
						borderRadius: 6,
						backgroundColor: COLOR_PULSE,
					},
				}),
			],
			style: {
				position: 'absolute',
				left: '4%',
				top: '3%',
				width: '40%',
				height: '2%',
				borderRadius: 6,
				backgroundColor: COLOR_PULSE_TRACK,
			},
		});
	}

	private createButton(label: string | Binding<string>, flex: number, color: string, onClick: () => void): UINode {
		return Pressable({
			onClick: (player: Player) => onClick(),
			children: [
				Text({ text: label, style: { color: COLOR_TEXT, fontSize: this.fontSize(1), textAlign: 'center' } }),
			],
			style: {
				flex: flex,
				height: '100%',
				marginHorizontal: '0.6%',
				alignItems: 'center',
				justifyContent: 'center',
				borderRadius: 10,
				backgroundColor: color,
			},
		});
	}

	private createControls(): UINode {
		const rowStyle: ViewStyle = {
			position: 'absolute',
			left: '3%',
			width: '94%',
			height: '6.2%',
			flexDirection: 'row',
		};
		return View({
			children: [
				View({
					children: [
						this.createButton('◀', 1, COLOR_BUTTON, () => this.selectRender(this._renderIndex - 1)),
						this.createButton(this._renderLabel, 5, COLOR_BUTTON_ACCENT, () => this.selectRender(this._renderIndex + 1)),
					],
					style: { ...rowStyle, bottom: '23%' },
				}),
				View({
					children: [
						this.createButton(this._inputLabel, 3, COLOR_BUTTON_ACCENT, () => this.selectInput(this._inputMode + 1)),
						this.createButton(this._autoLabel, 1.6, COLOR_BUTTON, () => this.toggleAuto()),
						this.createButton('summation', 1.2, COLOR_BUTTON, () => this.printSummary()),
						this.createButton('Focus', 1.2, COLOR_BUTTON, () => {
							if (this._isFocusMode === true) {
								this.exitFocusMode();
							}
							else {
								this.enterFocusMode();
							}
						}),
					],
					style: { ...rowStyle, bottom: '16%' },
				}),
				View({
					children: [
						this.createButton('slower  ◀', 1.3, COLOR_BUTTON, () => this.stepTune(TUNE_UPDATE_HZ, -1)),
						this.createButton(this._hzLabel, 4, COLOR_BUTTON_TUNE, () => this.stepTune(TUNE_UPDATE_HZ, 1)),
						this.createButton('▶  faster', 1.3, COLOR_BUTTON, () => this.stepTune(TUNE_UPDATE_HZ, 1)),
					],
					style: { ...rowStyle, bottom: '9%' },
				}),
				View({
					children: [
						this.createButton(this._tuneLabel, 4, COLOR_BUTTON_ACCENT, () => this.selectTune(1)),
						this.createButton('−', 1.3, COLOR_BUTTON, () => this.stepTune(this._tuneIndex, -1)),
						this.createButton('+', 1.3, COLOR_BUTTON, () => this.stepTune(this._tuneIndex, 1)),
					],
					style: { ...rowStyle, bottom: '2%' },
				}),
			],
			style: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
		});
	}

	//#endregion

	//#region Settings

	private gridColumns(): number {
		return Math.round(clamp(this.props.gridColumns, 2, 10));
	}

	private gridRows(): number {
		return Math.round(clamp(this.props.gridRows, 2, 14));
	}

	private applyCanvasSize(): void {
		if (this.entity.owner.get() === this.world.getServerPlayer()) {
			return;
		}

		let width = this.props.canvasWidth;
		let height = this.props.canvasHeight;
		if (isFinite(width) === false || isFinite(height) === false || width <= 0 || height <= 0) {
			const player = this.entity.owner.get();
			width = player.screenWidth.get();
			height = player.screenHeight.get();
		}
		if (isFinite(width) === false || isFinite(height) === false || width <= 0 || height <= 0) {
			return;
		}

		this._screenAspect = clamp(width / height, 0.2, 5);
		const ratio = clamp(this.props.screenPixelRatio, 0.5, 4);
		this._pixelsPerScreenX = Math.round(width * ratio);
		this._pixelsPerScreenY = Math.round(height * ratio);
		const side = Math.round(clamp(Math.min(width, height), 240, 2048));
		this.panelWidth = side;
		this.panelHeight = side;
	}

	//#endregion
}
UIComponent.register(DragLabPanel);
