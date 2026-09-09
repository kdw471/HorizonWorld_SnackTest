/**
 * Puzzle Horizon Bridge - 8개 퍼즐 공통 Horizon 어댑터 (PUZ_00 §7.1 "로직과 표현의 분리")
 *
 * 순수 로직 계층(`*_Session` / `*_Board`)은 `horizon/core` 를 전혀 모른다.
 * 그 둘을 잇는 지점이 이 파일이며, 하는 일은 셋이다.
 *
 *   프레임 구동    … `connectPuzzleUpdate()` 가 세션의 `update()` 를 매 프레임 돌린다
 *   카메라/포커스  … `enterPuzzleInteraction()` 이 고정 카메라와 Focused Interaction 을 켠다
 *   드래그 스트림  … `PuzzleScreenDragStream` 이 Focused Interaction 의 화면 좌표를 격자 좌표로 바꾼다
 *
 * 보드 자체는 Custom UI(`PuzzleBoardUI_Panel`)가 그리고 칸 입력도 UI 가 직접 준다.
 *
 * ## 좌표 규약
 *
 *   right = +col 방향,  up = -row 방향 (row 0 이 화면 위)
 *   보드 중심 엔티티의 forward 가 보드 평면의 법선이다 (카메라 자동 배치가 쓴다).
 */

import { Component, Entity, FocusedInteractionOptions, InteractionInfo, PlayerControls, Quaternion, Vec3, World } from 'horizon/core';
import LocalCamera, { CameraTransitionOptions, Easing, FixedCameraOptions } from 'horizon/camera';
import { screenPointToGridPoint } from 'PuzzleUI_RelativeLayout';
import { PuzzleBoardStage } from 'PuzzleBoardUI_Presenter';

//#region Types

/** 연속 격자 좌표. 정수가 아니라 소수다 - 드래그 컨트롤러가 이 형태를 요구한다 */
export type PuzzleGridPoint = {
	row: number,
	col: number,
}

//#endregion

//#region Screen drag stream (제안 1 - 연속 좌표 드래그)

/**
 * `InteractionInfo.screenPosition` 의 세로축 방향.
 *
 * 문서에는 0~1 정규화라는 것만 있고 방향이 없어 기기 실험으로 확정했다
 * (2026-09-04, 드래그 스트림 프로브): **아래가 0 이다.** 변환
 * (`screenPointToGridPoint`)은 위가 0 을 가정하므로 여기서 `1 - y` 로 뒤집는다.
 * 플랫폼이 방향을 바꾸면(터치가 상하 반전으로 나타나면) 이 값만 되돌린다.
 */
const SCREEN_POSITION_Y_IS_TOP_DOWN = false;

export type PuzzleDragStreamHandlers = {
	/**
	 * 손가락이 **실제로 닿은** 연속 좌표 - 잡기의 기준점 (드래그당 최대 몇 번, 첫 move 전에만).
	 *
	 * 잡기는 칸 `Pressable` 이 알리므로 CoreAPI 가 아는 출발점은 **칸 중심(정수)** 뿐이다.
	 * 그 뒤의 move 는 연속 좌표라, 칸 가장자리를 잡았다면 손가락이 거의 안 움직였는데도
	 * 첫 move 의 delta 가 반 칸을 넘어 조각이 한 칸 튄다. 브라우저 샘플(`pointerdown` 의
	 * `clientX` 를 기준점으로 삼는다)에는 없는 어긋남이다. 이 콜백으로 기준점을 실제
	 * 터치 지점으로 되돌려 잡으면 조각은 잡은 자리 그대로 손가락에 붙어 따라온다.
	 */
	onStreamStart?: (point: PuzzleGridPoint) => void,
	/** 스트림이 이 드래그를 넘겨받은 뒤의 이동 - 연속 전체 그리드 좌표 (정수 = 칸 중심) */
	onStreamMove: (point: PuzzleGridPoint) => void,
	/** 스트림이 넘겨받은 드래그의 뗌 - 마지막 좌표와 함께 확정한다 */
	onStreamEnd: (point: PuzzleGridPoint) => void,
	/**
	 * **이 터치가 끝났다** - 아직 열려 있는 누름이 있으면 닫으라는 신호다.
	 *
	 * `onStreamEnd` 와 달리 **스트림이 이동을 배달했는지와 무관하게** 매번 온다.
	 * Focused Interaction 의 `inputEnded` 는 유실되지 않는 반면, Custom UI `Pressable` 의
	 * release 는 모바일에서 사라지는 경우가 있기 때문이다. 특히 **퍼즐이 막 시작해
	 * Focused Interaction 모드에 들어간 직후의 첫 터치**가 그렇다 - 모드가 자리를 잡는
	 * 동안 스트림의 moved 는 오지 않아(`isDriving` 이 false) 스트림이 뗌을 확정하지 않는데,
	 * 같은 터치의 Pressable release 까지 삼켜지면 **아무도 드래그를 닫지 않는다.**
	 * 그것이 "게임 시작 후 첫 드래그만 손을 떼도 놓이지 않고, 다음 터치에서야 놓인다" 였다.
	 *
	 * 구현은 프레젠터의 `pointerUp()` 을 부르면 된다 - 이미 닫혔으면 아무 일도 하지 않는다.
	 */
	onStreamRelease?: () => void,
}

/** `PuzzleScreenDragStream` 의 선택 설정 */
export type PuzzleDragStreamOptions = {
	/**
	 * 이동까지 스트림이 몰지 (기본 켬).
	 *
	 * 꺼도 스트림 자체는 살아 있어 **뗌(`onStreamRelease`)만은 계속 알린다.** 그것이
	 * 이 옵션을 둔 이유다 - `continuousDrag` 를 끈 퍼즐(또는 에디터에 예전 값이 저장된
	 * 엔티티)에서도 릴리즈 유실의 안전망은 남아야 한다. 꺼져 있으면 `isDriving` 은 끝까지
	 * false 이므로 이동·뗌의 확정은 전부 칸 단위 경로가 맡는다.
	 */
	drivesMoves?: boolean,
}

/**
 * Focused Interaction 입력 스트림을 **연속 격자 좌표** 드래그로 바꾼다
 * (드래그 반응속도 개선 제안 §3 제안 1).
 *
 * ## 하이브리드 입력 - 잡기는 Pressable, 이동·뗌은 스트림
 *
 * 잡기는 지금처럼 칸 `Pressable` 의 down 이 맡는다 (어느 오브젝트인지는 칸이 이미 안다).
 * CoreAPI 가 잡기에 성공하면 `notifyDragBegan()` 으로 이 라우터를 무장시키고, 그 뒤
 * `PlayerControls.onFocusedInteractionInputMoved/Ended` 가 오면 화면 좌표를
 * `screenPointToGridPoint()` 로 바꿔 콜백한다. 칸 경계를 기다리지 않으므로
 * 입력 이벤트 해상도로 연속 추종이 된다.
 *
 * 잡기의 **기준점**도 스트림이 보정한다 (`onStreamStart`). 칸 누름은 어느 칸인지만 알지
 * 칸 안 어디를 짚었는지는 모르므로, `onFocusedInteractionInputStarted` 의 실제 터치
 * 좌표(없으면 첫 moved)를 CoreAPI 에 한 번 전해 "잡은 자리 그대로 따라오기" 를 만든다.
 *
 * ## 폴백 규칙 - **스트림이 실제로 움직임을 배달한 드래그만 넘겨받는다**
 *
 * Screen Overlay 가 터치를 소비해 스트림이 오지 않는 환경에서도 조작이 죽으면 안 된다.
 * 그래서 첫 moved 가 변환에 성공한 순간부터만 `isDriving` 이 되고, CoreAPI 는 그때부터
 * 칸 단위 move/up 콜백을 무시한다. 스트림이 한 번도 오지 않으면 `isDriving` 은 끝까지
 * false 라 기존 칸 단위 경로가 그대로 동작한다 - 두 경로가 같은 컨트롤러 API 를 쓰므로
 * 공존할 수 있다는 제안서의 전제 그대로다.
 *
 * ## 전제 조건 둘
 *
 * 1. **Focused Interaction 모드** - 스트림 자체가 이 모드에서만 흐른다. CoreAPI 가
 *    퍼즐 시작에서 `enterPuzzleInteraction()`(카메라 포함) 또는
 *    `enterPuzzleTouchStream()`(모드만)으로 들어간다.
 * 2. **패널 지오메트리** - 화면 -> 격자 변환은 패널이 `PuzzleBoardStage` 에 실어 둔
 *    확정 배치를 쓴다. 없으면 변환을 포기하고 폴백만 동작한다.
 */
export class PuzzleScreenDragStream {
	private _rowCount: number;
	private _colCount: number;
	private readonly _handlers: PuzzleDragStreamHandlers;

	/** CoreAPI 가 잡기에 성공해 스트림을 기다리는 중인지 */
	private _isArmed: boolean = false;
	/** 이번 드래그를 스트림이 넘겨받았는지 - 첫 moved 변환 성공부터 뗌까지 */
	private _isDriving: boolean = false;
	/** 마지막으로 변환에 성공한 좌표 - ended 의 좌표를 만들 수 없을 때의 대체값 */
	private _lastPoint: PuzzleGridPoint | undefined = undefined;
	/**
	 * 가장 최근 started 의 화면 좌표 - 잡기 기준점(`onStreamStart`)의 재료.
	 *
	 * started 와 칸 `Pressable` 의 down 은 같은 터치에서 나오지만 **어느 쪽이 먼저인지 보장이
	 * 없다.** started 가 먼저면 잡을 때 이 값을 쓰고, 잡기가 먼저면 뒤따라온 started 가
	 * `handleStarted` 에서 직접 준다. **ended 에서 지운다** - 지우지 않으면 앞 터치의 시작점이
	 * 다음 잡기의 기준점이 되어(그 터치의 started 가 오지 않거나 늦으면) 조각이 엉뚱하게 튄다.
	 */
	private _lastStartInfo: InteractionInfo | undefined = undefined;
	/** 이번 드래그에 `onStreamStart` 를 한 번이라도 전했는지 - 없으면 첫 moved 가 대신한다 */
	private _didDeliverStart: boolean = false;
	/** 이동까지 몰지 (`PuzzleDragStreamOptions.drivesMoves`) - 꺼도 뗌은 계속 알린다 */
	private readonly _drivesMoves: boolean;
	/**
	 * Focused Interaction 입력을 한 번이라도 받아 봤는지 - **진단 전용**.
	 *
	 * 이 모드는 클라이언트 상태라 인월드에서만 확인할 수 있고, 진입 호출이 조용히 무시되면
	 * (`enterPuzzleInteraction` 의 카메라 재적용 주석과 같은 사정) 스트림이 통째로 오지
	 * 않는다. 그때 증상은 "뗌 안전망이 없는 것처럼 보인다" 뿐이라 원인을 찾기 어려우므로,
	 * 처음 한 번만 살아 있다는 것을 로그로 남긴다.
	 */
	private _didLogFirstInput: boolean = false;

	constructor(
		component: Component,
		rowCount: number,
		colCount: number,
		handlers: PuzzleDragStreamHandlers,
		options: PuzzleDragStreamOptions = {},
	) {
		this._rowCount = rowCount;
		this._colCount = colCount;
		this._handlers = handlers;
		this._drivesMoves = options.drivesMoves ?? true;

		component.connectLocalBroadcastEvent(PlayerControls.onFocusedInteractionInputStarted,
			(data: { interactionInfo: InteractionInfo[] }) => this.handleStarted(data.interactionInfo[0]));
		component.connectLocalBroadcastEvent(PlayerControls.onFocusedInteractionInputMoved,
			(data: { interactionInfo: InteractionInfo[] }) => this.handleMoved(data.interactionInfo[0]));
		component.connectLocalBroadcastEvent(PlayerControls.onFocusedInteractionInputEnded,
			(data: { interactionInfo: InteractionInfo[] }) => this.handleEnded(data.interactionInfo[0]));
	}

	/**
	 * 화면 -> 격자 변환에 쓰는 격자 크기를 바꾼다.
	 * 정렬 퍼즐처럼 판마다 열 수가 달라지는 퍼즐이 `resetLayout` 과 함께 부른다 -
	 * 패널이 그린 격자와 다른 크기로 변환하면 손가락과 다른 칸이 잡힌다.
	 */
	public setGridSize(rowCount: number, colCount: number): void {
		this._rowCount = rowCount;
		this._colCount = colCount;
	}

	/** CoreAPI 의 잡기(onCellDown/onItemDown)가 성공했다 - 이 드래그의 스트림을 받기 시작한다 */
	public notifyDragBegan(): void {
		this._isArmed = true;
		this._isDriving = false;
		this._lastPoint = undefined;
		this._didDeliverStart = false;
		// started 가 잡기보다 먼저 왔다면 지금 기준점을 준다 (필드 주석 - 순서가 보장되지 않는다)
		if (this._lastStartInfo !== undefined) {
			this.deliverStart(this._lastStartInfo);
		}
	}

	/**
	 * 이번 드래그를 스트림이 넘겨받았는지. true 인 동안 CoreAPI 는 칸 단위
	 * move/up 콜백을 무시해야 한다 - 두 경로가 같은 좌표를 두 번 넣지 않게.
	 */
	public get isDriving(): boolean {
		return this._isDriving;
	}

	//#region Internal

	private handleStarted(info: InteractionInfo | undefined): void {
		this.logFirstInput('started');
		if (info === undefined || this._drivesMoves === false) {
			return;
		}
		this._lastStartInfo = info;
		// 잡기가 먼저 와 있었다 - 이번 터치의 진짜 시작점으로 기준점을 다시 준다
		if (this._isArmed && this._isDriving === false) {
			this.deliverStart(info);
		}
	}

	/**
	 * 스트림이 실제로 흐른다는 것을 **처음 한 번만** 알린다 (`_didLogFirstInput` 주석).
	 * 이 줄이 콘솔에 없으면 Focused Interaction 모드에 들어가지 못한 것이므로,
	 * 뗌 안전망(`onStreamRelease`)도 동작하지 않는다고 봐야 한다.
	 */
	private logFirstInput(phase: string): void {
		if (this._didLogFirstInput) {
			return;
		}
		this._didLogFirstInput = true;
		console.log(`[PuzzleScreenDragStream] Focused Interaction input is live (first event: ${phase}). `
			+ `Move driving is ${this._drivesMoves ? 'on' : 'off'}; release recovery is always on.`);
	}

	/** 기준점을 CoreAPI 에 전한다. 변환이 안 되면(패널 지오메트리 없음) 조용히 건너뛴다 */
	private deliverStart(info: InteractionInfo): void {
		const point = this.toGrid(info);
		if (point === undefined) {
			return;
		}
		this._didDeliverStart = true;
		if (this._handlers.onStreamStart !== undefined) {
			this._handlers.onStreamStart(point);
		}
	}

	private handleMoved(info: InteractionInfo | undefined): void {
		this.logFirstInput('moved');
		if (this._isArmed === false || this._drivesMoves === false || info === undefined) {
			return;
		}
		const point = this.toGrid(info);
		if (point === undefined) {
			return;
		}
		if (this._isDriving === false && this._didDeliverStart === false) {
			// started 가 오지 않은(또는 변환에 실패한) 드래그 - 첫 moved 가 기준점을 대신한다.
			// 첫 moved 는 터치 직후 몇 픽셀 안에서 오므로 실제 시작점과의 차이는 무시할 수 있다.
			this.deliverStart(info);
		}
		this._isDriving = true;
		this._lastPoint = point;
		this._handlers.onStreamMove(point);
	}

	private handleEnded(info: InteractionInfo | undefined): void {
		this.logFirstInput('ended');
		// 이 터치의 시작점은 여기서 수명이 끝난다 - 다음 잡기가 앞 터치의 시작점을 쓰면 안 된다
		this._lastStartInfo = undefined;
		const wasArmed = this._isArmed;
		const wasDriving = this._isDriving;
		// 어느 경로로 끝나든 이 터치의 무장은 여기서 푼다 - 다음 잡기가 다시 무장한다
		this._isArmed = false;
		this._isDriving = false;

		if (wasArmed && wasDriving) {
			// 좌표를 전혀 만들 수 없으면 NaN 을 넘긴다 - moved 가 이미 마지막 자리를 반영했으므로
			// CoreAPI 가 그 자리에 그대로 확정한다
			const point = (info === undefined ? undefined : this.toGrid(info)) ?? this._lastPoint;
			this._handlers.onStreamEnd(point ?? { row: Number.NaN, col: Number.NaN });
		}
		this._lastPoint = undefined;

		// **무장·배달 여부와 무관하게** 이 터치는 끝났다고 알린다.
		//
		// 처음에는 `wasDriving === false` 면 그냥 돌아가며 칸 단위 폴백(Pressable 의 release)이
		// 마감해 주기를 기다렸다. 그 release 가 유실되면 아무도 드래그를 닫지 않아 손을 떼도
		// 조각이 놓이지 않았다 (`onStreamRelease` 주석). 그래서 배달 여부의 조건은 걷어냈는데,
		// **`_isArmed` 조건이 그대로 남아 같은 구멍을 유지하고 있었다** - `notifyDragBegan()` 은
		// 칸 `Pressable` 의 down 이 부르고 이 이벤트는 플랫폼 브로드캐스트라 **둘의 순서가
		// 보장되지 않는다** (`_lastStartInfo` 주석과 같은 사정). 잡기보다 이 뗌이 먼저 처리되면
		// 무장이 아직 서 있지 않아 안전망이 통째로 건너뛰어졌다.
		//
		// 이제는 조건 없이 한 번 닫는다. 열려 있는 누름이 없으면 프레젠터가 무시하므로
		// (`PuzzleBoardPresenter.pointerUp`) 관계없는 터치에서 불려도 아무 일이 없다.
		if (this._handlers.onStreamRelease !== undefined) {
			this._handlers.onStreamRelease();
		}
	}

	/** 정규화 화면 좌표 -> 연속 전체 그리드 좌표. 패널 지오메트리가 없으면 undefined */
	private toGrid(info: InteractionInfo): PuzzleGridPoint | undefined {
		const geometry = PuzzleBoardStage.instance.screenGeometry;
		if (geometry === undefined) {
			return undefined;
		}
		const y = SCREEN_POSITION_Y_IS_TOP_DOWN ? info.screenPosition.y : 1 - info.screenPosition.y;
		return screenPointToGridPoint(geometry, this._rowCount, this._colCount, info.screenPosition.x, y);
	}

	//#endregion
}

/**
 * Focused Interaction 모드에만 들어간다 - **카메라는 건드리지 않는다.**
 *
 * 드래그 스트림(제안 1)은 이 모드에서만 흐르는데, `enterPuzzleInteraction()` 은 고정
 * 카메라까지 세트로 적용한다. 카메라 고정을 원하지 않는 월드(`focusCamera` 꺼짐)에서
 * 스트림만 켜기 위한 가벼운 진입이다. 이동/점프 버튼이 숨는 것은 모드 자체의 효과다.
 */
export function enterPuzzleTouchStream(component: Component): void {
	component.entity.owner.get().enterFocusedInteractionMode({ disableFocusExitButton: true });
}

/** `enterPuzzleTouchStream()` 의 해제 - 모드만 나가고 카메라는 손대지 않는다 */
export function exitPuzzleTouchStream(component: Component): void {
	component.entity.owner.get().exitFocusedInteractionMode();
}

//#endregion

//#region Focused interaction (터치 입력의 전제 조건)

export type PuzzleCameraSetup = {
	/**
	 * 카메라를 놓을 엔티티. 지정하면 이 엔티티의 위치/방향을 그대로 쓴다.
	 * 손으로 정렬해야 하므로, 보통은 아래 `boardCentre` 자동 배치를 쓰는 편이 낫다.
	 */
	cameraObject?: Entity,
	/**
	 * `cameraObject` 가 없을 때, 이 보드의 **정면에 카메라를 자동 배치**한다.
	 * 보드 평면의 법선(forward) 방향으로 `distance` 만큼 띄우고 보드를 바라보게 한다.
	 * 빈 엔티티를 손으로 회전시킬 필요가 없어 실수가 없다.
	 */
	boardCentre?: Entity,
	/** 보드에서 카메라까지의 거리 (m). 기본 0.6 */
	distance?: number,
	/** 시야각. 생략하면 기본값을 쓴다 */
	fov?: number,
	/** 포커스 종료 버튼을 숨길지 (기본 true - 퍼즐 도중 빠져나가지 못하게) */
	disableFocusExitButton?: boolean,
}

const DEFAULT_CAMERA_DISTANCE = 0.6;

/**
 * 고정 카메라 **재적용** 시점 (ms).
 *
 * 월드를 **다시** 실행하면(프리뷰 정지 후 재시작) 플레이어가 이미 월드 안에 있어
 * 소유권 이전과 로컬 `start()` 가 클라이언트 카메라 초기화보다 먼저 끝난다.
 * 그 시점의 `setCameraModeFixed()` 는 조용히 무시되므로, 첫 실행은 되고
 * 두 번째 실행부터 카메라가 고정되지 않은 채 시작되는 증상이 나온다.
 *
 * 즉시 1회 + 아래 시점들에 재적용해 첫 실행과 재실행 모두를 커버한다.
 * (같은 위치를 duration 0 으로 다시 놓는 것이라 이미 성공했어도 눈에 띄지 않는다.)
 */
const CAMERA_APPLY_RETRY_DELAYS_MS = [300, 1000];

/** 예약된 카메라 재적용 타이머들. 포커스를 나갈 때 반드시 취소한다 */
const _cameraRetryTimeoutIds: number[] = [];

/**
 * **고정 카메라와 Focused Interaction 모드를 켠다.**
 *
 * 드래그 스트림이 구독하는 `PlayerControls.onFocusedInteractionInput*` 는 플레이어가
 * **Focused Interaction 모드** 에 들어가 있을 때만 발생하므로 퍼즐이 직접 진입한다.
 *
 * 반드시 **로컬 클라이언트**(엔티티 소유자가 서버 플레이어가 아닐 때)에서 호출한다.
 */
export function enterPuzzleInteraction(component: Component, setup: PuzzleCameraSetup = {}): void {
	const owner = component.entity.owner.get();

	LocalCamera.setCameraModeFixed();

	const options: FocusedInteractionOptions = {
		disableFocusExitButton: setup.disableFocusExitButton ?? true,
	};
	owner.enterFocusedInteractionMode(options);

	applyFixedCamera(setup);

	// 재실행 시 위 호출이 무시될 수 있으므로 잠시 뒤 재적용한다 (CAMERA_APPLY_RETRY_DELAYS_MS 참고)
	cancelCameraRetries(component);
	for (const delayMs of CAMERA_APPLY_RETRY_DELAYS_MS) {
		_cameraRetryTimeoutIds.push(component.async.setTimeout(() => applyFixedCamera(setup), delayMs));
	}
}

/** 고정 카메라 모드 + 배치 + FOV 를 한 번에 적용한다. 몇 번을 불러도 결과가 같다 */
function applyFixedCamera(setup: PuzzleCameraSetup): void {
	const placement = resolveCameraPlacement(setup);
	if (placement === undefined) {
		LocalCamera.setCameraModeFixed();
	}
	else {
		const cameraOptions: FixedCameraOptions & CameraTransitionOptions = {
			position: placement.position,
			rotation: Quaternion.lookRotation(placement.forward),
			delay: 0,
			easing: Easing.EaseInOut,
			duration: 0,
		};
		LocalCamera.setCameraModeFixed(cameraOptions);
	}

	if (setup.fov !== undefined) {
		LocalCamera.overrideCameraFOV(setup.fov);
	}
}

/**
 * 아직 실행되지 않은 카메라 재적용 예약을 모두 취소한다.
 * 취소하지 않으면 퍼즐을 나간 직후(abort) 뒤늦게 발화한 타이머가 카메라를 다시 고정해 버린다.
 */
function cancelCameraRetries(component: Component): void {
	for (const timeoutId of _cameraRetryTimeoutIds) {
		component.async.clearTimeout(timeoutId);
	}
	_cameraRetryTimeoutIds.length = 0;
}

/**
 * 카메라 위치와 바라볼 방향을 정한다.
 *   - `cameraObject` 가 있으면 그 엔티티를 그대로 따른다
 *   - 없고 `boardCentre` 가 있으면 **보드 정면에 자동 배치**한다
 *
 * 보드의 forward 는 평면의 법선, 즉 플레이어 쪽을 향한다.
 * 따라서 카메라는 `center + forward * distance` 에 놓고 `-forward` 를 바라봐야 보드가 정면에 온다.
 */
function resolveCameraPlacement(setup: PuzzleCameraSetup): { position: Vec3, forward: Vec3 } | undefined {
	if (setup.cameraObject !== undefined) {
		return {
			position: setup.cameraObject.position.get(),
			forward: setup.cameraObject.forward.get(),
		};
	}

	if (setup.boardCentre !== undefined) {
		const centre = setup.boardCentre.position.get();
		const normal = setup.boardCentre.forward.get().normalize();
		const distance = setup.distance ?? DEFAULT_CAMERA_DISTANCE;
		return {
			position: centre.add(normal.mul(distance)),
			forward: normal.mul(-1),
		};
	}

	return undefined;
}

/**
 * 퍼즐이 끝나 조작을 놓아 줄 때 부른다.
 *
 * `enterPuzzleInteraction()` 은 탈출 버튼을 숨기므로(disableFocusExitButton 기본 true),
 * **이 함수를 부르지 않으면 플레이어가 고정 카메라 + Focused Interaction 에 영구히 갇힌다.**
 * 메뉴 복귀·퀘스트 포기 등 조작을 되돌려 줄 모든 경로에서 호출해야 한다.
 */
export function exitPuzzleInteraction(component: Component): void {
	// 대기 중인 카메라 재적용 예약부터 취소한다 - 나간 뒤 발화하면 카메라가 다시 고정된다
	cancelCameraRetries(component);
	component.entity.owner.get().exitFocusedInteractionMode();
	// 고정 카메라를 풀어 아바타 카메라로 되돌린다
	LocalCamera.setCameraModeThirdPerson();
	LocalCamera.resetCameraFOV();
}

//#endregion

//#region Frame driver

/**
 * 퍼즐 세션의 `update(deltaSeconds)` 를 매 프레임 돌린다.
 *
 * 8개 세션 전부 제한 시간과 연출 타이머를 이 한 함수로 진행시키므로,
 * 이것을 연결하지 않으면 **시간이 흐르지 않고 연출도 끝나지 않는다.**
 * (슬라이드의 0.25초 이동, 스위치의 0.4초 누름, 카드의 폭탄 셔플이 모두 여기에 걸려 있다.)
 */
export function connectPuzzleUpdate(component: Component, update: (deltaSeconds: number) => void): void {
	component.connectLocalBroadcastEvent(World.onUpdate, (payload: { deltaTime: number }) => {
		update(payload.deltaTime);
	});
}

//#endregion
