/**
 * Puzzle Horizon Bridge - 8개 퍼즐 공통 Horizon 어댑터 (PUZ_00 §7.1 "로직과 표현의 분리")
 *
 * 순수 로직 계층(`*_Session` / `*_Board`)은 `horizon/core` 를 전혀 모른다.
 * 그 둘을 잇는 유일한 지점이 이 파일이며, 하는 일은 좌표 변환 두 가지뿐이다.
 *
 *   화면 터치 ray  →  연속 격자 좌표 (row, col)   … 드래그 퍼즐이 요구하는 소수 좌표
 *   격자 좌표      →  월드 좌표                   … 3D 에셋 배치용
 *
 * ## 왜 콜라이더 레이캐스트가 아니라 평면 교차인가
 *
 * PUZ_00 §8.4 는 "포인터가 퍼즐 영역 밖으로 나가도 드래그 입력은 유지된다" 를 요구한다.
 * 타일 콜라이더에 레이캐스트하면 보드 밖을 가리키는 순간 히트가 사라져 이 규칙을 지킬 수 없다.
 * 보드 평면과의 교차는 보드 밖이든 칸 사이든 **항상** 좌표를 돌려주므로 그대로 만족한다.
 * 경계 고정·히트박스 판정은 각 퍼즐의 드래그 컨트롤러가 이미 담당하므로 여기서 하지 않는다.
 *
 * ## 좌표 규약
 *
 *   right = +col 방향,  up = -row 방향 (row 0 이 화면 위)
 *   보드 중심 엔티티의 forward 가 평면의 법선이다.
 */

import { Component, Entity, FocusedInteractionOptions, InteractionInfo, PlayerControls, Quaternion, Vec3, World } from 'horizon/core';
import LocalCamera, { CameraTransitionOptions, Easing, FixedCameraOptions } from 'horizon/camera';
import { onTouchEnd, onTouchMove, onTouchStart } from 'Basics_Input_Screen';
import { screenPointToGridPoint } from 'PuzzleUI_RelativeLayout';
import { PuzzleBoardStage } from 'PuzzleBoardUI_Presenter';
import { SubscriptionBag } from 'Utility_Events';

//#region Types

export type PuzzleBoardLayout = {
	rowCount: number,
	colCount: number,
	/** 칸 중심 간 거리 (미터). 기획서의 cm 값을 100 으로 나눠 넣는다 (예: 7cm -> 0.07) */
	cellSpacing: number,
}

/** 연속 격자 좌표. 정수가 아니라 소수다 - 드래그 컨트롤러가 이 형태를 요구한다 */
export type PuzzleGridPoint = {
	row: number,
	col: number,
}

//#endregion

//#region Board mapper

export class PuzzleBoardMapper {
	private readonly _layout: PuzzleBoardLayout;

	private _center: Vec3 = Vec3.zero;
	private _right: Vec3 = Vec3.right;
	private _up: Vec3 = Vec3.up;
	private _normal: Vec3 = Vec3.forward;

	constructor(layout: PuzzleBoardLayout) {
		this._layout = layout;
	}

	public get layout(): PuzzleBoardLayout {
		return this._layout;
	}

	/**
	 * 보드 중심 엔티티에서 평면 기저를 읽어 캐시한다.
	 *
	 * HorizonProperty 읽기는 매번 브리지를 건너므로 터치마다 호출하면 안 된다.
	 * 보드는 플레이 중 움직이지 않으므로 레벨 로드 시 한 번만 부르면 된다.
	 * (패널을 집어 옮길 수 있게 만들었다면 놓는 시점에 다시 부른다.)
	 */
	public refreshFrom(boardCentre: Entity): void {
		this._center = boardCentre.position.get();
		this._right = boardCentre.right.get().normalize();
		this._up = boardCentre.up.get().normalize();
		this._normal = boardCentre.forward.get().normalize();
	}

	/** 격자 좌표 -> 월드 좌표. row/col 에 소수를 넣으면 칸 사이도 나온다 (드래그 연출용) */
	public getWorldPosition(row: number, col: number): Vec3 {
		const colOffset = col - (this._layout.colCount - 1) * 0.5;
		const rowOffset = row - (this._layout.rowCount - 1) * 0.5;
		return this._center
			.add(this._right.mul(colOffset * this._layout.cellSpacing))
			.add(this._up.mul(-rowOffset * this._layout.cellSpacing));
	}

	/** 월드 좌표 -> 연속 격자 좌표. getWorldPosition 의 정확한 역변환이다 */
	public getGridPosition(worldPoint: Vec3): PuzzleGridPoint {
		const delta = worldPoint.sub(this._center);
		const u = delta.dot(this._right) / this._layout.cellSpacing;
		const v = delta.dot(this._up) / this._layout.cellSpacing;
		return {
			row: -v + (this._layout.rowCount - 1) * 0.5,
			col: u + (this._layout.colCount - 1) * 0.5,
		};
	}

	/**
	 * 터치 ray 와 보드 평면의 교차점. 보드 밖을 가리켜도 좌표가 나온다 (§8.4).
	 * ray 가 평면과 평행하거나 뒤쪽을 향하면 undefined.
	 */
	public intersectPlane(rayOrigin: Vec3, rayDirection: Vec3): Vec3 | undefined {
		const denominator = rayDirection.dot(this._normal);
		if (Math.abs(denominator) < 1e-6) {
			return undefined;
		}
		const distance = this._center.sub(rayOrigin).dot(this._normal) / denominator;
		if (distance < 0) {
			return undefined;
		}
		return rayOrigin.add(rayDirection.mul(distance));
	}

	/** 터치 ray -> 연속 격자 좌표. 퍼즐 세션에 그대로 넘기면 되는 형태다 */
	public getGridFromRay(rayOrigin: Vec3, rayDirection: Vec3): PuzzleGridPoint | undefined {
		const hit = this.intersectPlane(rayOrigin, rayDirection);
		if (hit === undefined) {
			return undefined;
		}
		return this.getGridPosition(hit);
	}

	/** 반올림한 칸 번호. 탭 퍼즐(스위치/슬라이드/카드)이 쓴다 */
	public toCellIndex(point: PuzzleGridPoint): number | undefined {
		// 라우터는 평면 뒤에서 손을 떼면 onEnd 에 {NaN, NaN} 을 넘긴다 (§8.4 규약).
		// NaN 은 아래의 모든 부등호 비교를 통과해 NaN 셀 번호가 로직 계층으로 흘러들므로 먼저 거른다.
		if (isNaN(point.row) || isNaN(point.col)) {
			return undefined;
		}
		const row = Math.round(point.row);
		const col = Math.round(point.col);
		if (row < 0 || row >= this._layout.rowCount || col < 0 || col >= this._layout.colCount) {
			return undefined;
		}
		return row * this._layout.colCount + col;
	}

	/** 격자 좌표가 보드 안인지 (반올림 기준) */
	public isInsideBoard(point: PuzzleGridPoint): boolean {
		return this.toCellIndex(point) !== undefined;
	}
}

//#endregion

//#region Touch router

export type PuzzleTouchHandlers = {
	/** 손가락이 닿았다 */
	onBegin: (point: PuzzleGridPoint) => void,
	/** 손가락이 움직였다 - 보드 밖 좌표도 그대로 전달된다 (§8.4) */
	onMove: (point: PuzzleGridPoint) => void,
	/** 손가락을 뗐다 */
	onEnd: (point: PuzzleGridPoint) => void,
}

/**
 * 화면 터치를 격자 좌표로 바꿔 퍼즐 세션에 전달한다.
 *
 * **단일 터치 전용** (PUZ_00 §8.1) - 진행 중인 터치의 interactionIndex 만 따라가고
 * 다른 손가락의 입력은 완전히 무시한다. 로직 계층에도 같은 방어가 들어 있지만,
 * 애초에 두 번째 손가락이 첫 손가락의 드래그 좌표를 덮어쓰지 않도록 여기서 먼저 막는다.
 */
export class PuzzleTouchRouter {
	private readonly _mapper: PuzzleBoardMapper;
	private readonly _handlers: PuzzleTouchHandlers;
	private readonly _subscriptions: SubscriptionBag = new SubscriptionBag();

	/** 지금 추적 중인 손가락. undefined 면 놀고 있다 */
	private _activeInteractionIndex: number | undefined = undefined;
	private _isEnabled: boolean = true;

	constructor(mapper: PuzzleBoardMapper, handlers: PuzzleTouchHandlers) {
		this._mapper = mapper;
		this._handlers = handlers;

		this._subscriptions.addRange(
			onTouchStart.subscribe(this.handleTouchStart.bind(this)),
			onTouchMove.subscribe(this.handleTouchMove.bind(this)),
			onTouchEnd.subscribe(this.handleTouchEnd.bind(this)),
		);
	}

	/** 일시정지·라운드 전환 중에는 꺼 둔다 */
	public setEnabled(isEnabled: boolean): void {
		this._isEnabled = isEnabled;
		if (isEnabled === false) {
			this._activeInteractionIndex = undefined;
		}
	}

	public get hasActiveTouch(): boolean {
		return this._activeInteractionIndex !== undefined;
	}

	public dispose(): void {
		this._subscriptions.disconnect();
		this._activeInteractionIndex = undefined;
	}

	//#region Internal

	private handleTouchStart(info: InteractionInfo): void {
		if (this._isEnabled === false) {
			return;
		}
		if (this._activeInteractionIndex !== undefined) {
			if (info.interactionIndex === this._activeInteractionIndex) {
				// 같은 인덱스의 새 다운 = 이전 터치의 end 를 받지 못했다는 뜻이다
				// (Basics_Input_Screen 이 interactionInfo[0] 만 중계하므로 두 손가락을
				//  같은 프레임에 떼면 추적 중 손가락의 end 가 유실될 수 있다).
				// 여기서 회복하지 않으면 라우터가 영구히 잠기므로, 붙잡힌 조작을
				// 취소(NaN = 좌표 없는 드랍)로 마감하고 새 터치를 받아들인다.
				this._activeInteractionIndex = undefined;
				this._handlers.onEnd({ row: Number.NaN, col: Number.NaN });
			}
			else {
				// 단일 터치 전용 - 조작 중 추가 터치는 완전히 무시한다 (§8.1)
				return;
			}
		}
		const point = this.toGrid(info);
		if (point === undefined) {
			return;
		}
		this._activeInteractionIndex = info.interactionIndex;
		this._handlers.onBegin(point);
	}

	private handleTouchMove(info: InteractionInfo): void {
		if (this._isEnabled === false || info.interactionIndex !== this._activeInteractionIndex) {
			return;
		}
		const point = this.toGrid(info);
		if (point === undefined) {
			return;
		}
		this._handlers.onMove(point);
	}

	private handleTouchEnd(info: InteractionInfo): void {
		if (info.interactionIndex !== this._activeInteractionIndex) {
			return;
		}
		this._activeInteractionIndex = undefined;

		const point = this.toGrid(info);
		if (point === undefined) {
			// 평면 뒤쪽에서 손을 뗀 경우. 좌표를 만들 수 없으므로 보드 밖 드랍으로 넘긴다.
			this._handlers.onEnd({ row: Number.NaN, col: Number.NaN });
			return;
		}
		this._handlers.onEnd(point);
	}

	private toGrid(info: InteractionInfo): PuzzleGridPoint | undefined {
		return this._mapper.getGridFromRay(info.worldRayOrigin, info.worldRayDirection);
	}

	//#endregion
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
	/** 스트림이 이 드래그를 넘겨받은 뒤의 이동 - 연속 전체 그리드 좌표 (정수 = 칸 중심) */
	onStreamMove: (point: PuzzleGridPoint) => void,
	/** 스트림이 넘겨받은 드래그의 뗌 - 마지막 좌표와 함께 확정한다 */
	onStreamEnd: (point: PuzzleGridPoint) => void,
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
	private readonly _rowCount: number;
	private readonly _colCount: number;
	private readonly _handlers: PuzzleDragStreamHandlers;

	/** CoreAPI 가 잡기에 성공해 스트림을 기다리는 중인지 */
	private _isArmed: boolean = false;
	/** 이번 드래그를 스트림이 넘겨받았는지 - 첫 moved 변환 성공부터 뗌까지 */
	private _isDriving: boolean = false;
	/** 마지막으로 변환에 성공한 좌표 - ended 의 좌표를 만들 수 없을 때의 대체값 */
	private _lastPoint: PuzzleGridPoint | undefined = undefined;

	constructor(component: Component, rowCount: number, colCount: number, handlers: PuzzleDragStreamHandlers) {
		this._rowCount = rowCount;
		this._colCount = colCount;
		this._handlers = handlers;

		component.connectLocalBroadcastEvent(PlayerControls.onFocusedInteractionInputMoved,
			(data: { interactionInfo: InteractionInfo[] }) => this.handleMoved(data.interactionInfo[0]));
		component.connectLocalBroadcastEvent(PlayerControls.onFocusedInteractionInputEnded,
			(data: { interactionInfo: InteractionInfo[] }) => this.handleEnded(data.interactionInfo[0]));
	}

	/** CoreAPI 의 잡기(onCellDown/onItemDown)가 성공했다 - 이 드래그의 스트림을 받기 시작한다 */
	public notifyDragBegan(): void {
		this._isArmed = true;
		this._isDriving = false;
		this._lastPoint = undefined;
	}

	/**
	 * 이번 드래그를 스트림이 넘겨받았는지. true 인 동안 CoreAPI 는 칸 단위
	 * move/up 콜백을 무시해야 한다 - 두 경로가 같은 좌표를 두 번 넣지 않게.
	 */
	public get isDriving(): boolean {
		return this._isDriving;
	}

	//#region Internal

	private handleMoved(info: InteractionInfo | undefined): void {
		if (this._isArmed === false || info === undefined) {
			return;
		}
		const point = this.toGrid(info);
		if (point === undefined) {
			return;
		}
		this._isDriving = true;
		this._lastPoint = point;
		this._handlers.onStreamMove(point);
	}

	private handleEnded(info: InteractionInfo | undefined): void {
		if (this._isArmed === false) {
			return;
		}
		const wasDriving = this._isDriving;
		// 어느 경로로 끝나든 이 터치의 무장은 여기서 푼다 - 다음 잡기가 다시 무장한다
		this._isArmed = false;
		this._isDriving = false;
		if (wasDriving === false) {
			// 스트림이 한 번도 배달하지 않은 드래그다 - 칸 단위 폴백이 마감한다
			return;
		}
		const point = (info === undefined ? undefined : this.toGrid(info)) ?? this._lastPoint;
		this._lastPoint = undefined;
		if (point === undefined) {
			// 좌표를 전혀 만들 수 없다 - moved 가 이미 마지막 자리를 반영했으므로 그대로 확정한다
			this._handlers.onStreamEnd({ row: Number.NaN, col: Number.NaN });
			return;
		}
		this._handlers.onStreamEnd(point);
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

//#region Child collection

export type ChildCollectionOptions = {
	/**
	 * 자식을 이름 오름차순으로 정렬할지 (기본 true).
	 *
	 * 에디터 계층 순서는 드래그 한 번으로 뒤집히지만 이름은 잘 바뀌지 않는다.
	 * `KeyCap_00 ... KeyCap_24` 처럼 **자리수를 맞춘 숫자**를 쓰면 정확히 정렬된다.
	 * (`KeyCap_9` 와 `KeyCap_10` 을 섞으면 문자열 정렬이라 9가 뒤로 간다 - 자리수를 맞출 것)
	 */
	sortByName?: boolean,
	/** 이 개수와 다르면 경고를 남긴다 */
	expectedCount?: number,
	/** 로그에 찍을 이름 */
	label?: string,
}

/**
 * 루트 엔티티의 자식들을 **정해진 순서로** 모은다.
 *
 * 격자 오브젝트를 props 에 수십 개씩 일일이 연결하는 것은 실수가 나기 쉬우므로,
 * 루트 하나만 받고 그 아래 자식을 순서대로 쓴다.
 *
 * 반환 순서가 곧 격자 인덱스(row-major)가 되므로, 이름을 자리수 맞춰 붙이는 것이 중요하다.
 */
export function collectChildEntities(root: Entity | undefined, options: ChildCollectionOptions = {}): Entity[] {
	const label = options.label ?? 'children';
	if (root === undefined) {
		return [];
	}

	const children = root.children.get().slice();

	if (options.sortByName !== false) {
		// name 은 HorizonProperty 이므로 매 비교마다 읽지 않도록 한 번만 읽어 둔다
		const named = children.map((entity) => ({ entity: entity, name: entity.name.get() }));
		named.sort((left, right) => (left.name < right.name ? -1 : (left.name > right.name ? 1 : 0)));
		children.length = 0;
		for (const item of named) {
			children.push(item.entity);
		}
	}

	if (options.expectedCount !== undefined && children.length !== options.expectedCount) {
		console.warn(`[PuzzleBridge] ${label}: found ${children.length} children; ${options.expectedCount} are required.`);
	}

	return children;
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
 * 원본 매치3 템플릿(`Basics_CoreAPI`)도 같은 이유로 카메라 배치를 300ms 지연시켰다.
 * 여기서는 즉시 1회 + 아래 시점들에 재적용해 첫 실행과 재실행 모두를 커버한다.
 * (같은 위치를 duration 0 으로 다시 놓는 것이라 이미 성공했어도 눈에 띄지 않는다.)
 */
const CAMERA_APPLY_RETRY_DELAYS_MS = [300, 1000];

/** 예약된 카메라 재적용 타이머들. 포커스를 나갈 때 반드시 취소한다 */
const _cameraRetryTimeoutIds: number[] = [];

/**
 * **터치 입력을 켠다. 이것을 부르지 않으면 화면을 눌러도 아무 이벤트가 오지 않는다.**
 *
 * `Basics_Input_Screen` 이 구독하는 `PlayerControls.onFocusedInteractionInput*` 는
 * 플레이어가 **Focused Interaction 모드** 에 들어가 있을 때만 발생한다.
 * 기존 매치3 는 `Basics_CameraController` 생성자에서 이 모드에 진입했는데,
 * 매치3(`BasicsPool`)를 끄면 그 코드가 돌지 않으므로 퍼즐이 직접 진입해야 한다.
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
	// Basics_GameStateController 와 같은 방식으로 건다
	component.connectLocalBroadcastEvent(World.onUpdate, (payload: { deltaTime: number }) => {
		update(payload.deltaTime);
	});
}

//#endregion
