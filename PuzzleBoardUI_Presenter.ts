/**
 * Puzzle Board UI Presenter - CustomUI 보드의 상태 보관 + 입력 정규화 (순수 계층)
 *
 * `*_CoreAPI` 와 `PuzzleBoardUI_Panel` 사이에 끼는 유일한 지점이다.
 *
 *   CoreAPI  --setCell()-->  Presenter  --CELL_CHANGED-->  Panel(Binding)
 *   CoreAPI  <--onCellUp--   Presenter  <--pointerUp()---  Panel(Pressable)
 *
 * 3D 시절의 `PuzzleTouchRouter`(`Puzzle_HorizonBridge.ts`)가 하던 일을 그대로 이어받되,
 * **ray-plane 교차가 사라진다.** Pressable 이 이미 어느 칸인지 알려 주기 때문이다.
 * 단일 터치 강제(PUZ_00 §8.1)와 "누른 칸 밖에서 떼면 취소"(PUZ_08 M2) 규칙은 여기 남는다.
 *
 * ## 누름의 출발지는 둘이다
 *
 * 보조 레이아웃의 오브젝트 트레이가 입력을 받게 되면서, 누름이 **본 격자의 칸**에서 시작할
 * 수도 있고 **트레이의 슬롯**에서 시작할 수도 있다 (레이저: 크리스탈을 트레이에서 집어
 * 판으로 끌어다 놓는다). 출발지가 어디든 이후의 이동·뗌은 같은 경로를 탄다.
 *
 *   itemDown(slot) ─┐
 *                   ├─▶ pointerEnter(cell) ... ─▶ pointerUp()
 *   pointerDown(cell) ┘
 *
 * 그래서 누름도 둘을 합쳐 하나로 센다. 누름이 열려 있는데 새 down 이 오면 **앞 터치의
 * release 가 유실된 것**으로 보고 앞 누름을 마감한 뒤 새 누름을 연다 - 모바일 `Pressable`
 * 은 누른 요소 밖에서 뗀 release 를 전달하지 않는 경우가 있어, 무시하면 드래그가 영구히
 * 붙잡힌다 (`pointerDown()` 주석).
 *
 * ## 손을 뗄 때 어느 칸에 놓았다고 볼 것인가
 *
 * `Pressable` 은 손가락이 떨어질 때 **`onExit` 를 `onRelease` 보다 먼저 보내는 경우가
 * 있다.** 그러면 뗀 순간의 `_hoverCell` 은 이미 "판 밖" 이라, 분명히 칸 위에서 손을
 * 뗐는데도 세션은 "밖에 놓았다" 로 받아 조각을 제자리로 되돌렸다.
 *
 * 그래서 hover 와 별개로 **이번 누름에서 마지막으로 올라가 있던 진짜 칸**
 * (`_lastInsideCell`)을 따로 들고 있다가, 뗄 때 hover 가 밖이면 그 칸을 쓴다.
 *
 *   exit(B) → release      hover=밖, 마지막 진짜 칸=B  ->  **B 에 놓는다**
 *   판 밖으로 나감 → release  pointerLeaveBoard() 가 마지막 칸까지 지웠다  ->  밖에 놓는다
 *
 * 둘을 가르는 것은 `pointerLeaveBoard()` 다. 이것은 격자 밖 배경이 부르는 **명시적인**
 * 신호라, 진짜로 판을 벗어난 경우에만 온다. 칸과 칸 사이를 오갈 때 스쳐 가는 `onExit` 와
 * 뒤섞이지 않는다.
 *
 * `horizon/core` / `horizon/ui` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import { EventPublisher } from 'Utility_Events';
import {
	PUZZLE_BOARD_CELL_OUTSIDE,
	PUZZLE_BOARD_INTRO_TEXT,
	PuzzleBoardCellPatch,
	PuzzleBoardCellView,
	PuzzleBoardIntroView,
	PuzzleBoardItemPatch,
	PuzzleBoardItemView,
	PuzzleBoardLayoutSpec,
	PuzzleBoardView,
	applyCellPatch,
	applyItemPatch,
	createBoardView,
	validateBoardLayout,
} from 'PuzzleBoardUI_Definitions';

//#region Types

/** 칸 하나가 바뀌었다 - 패널은 이 셀의 Binding 만 갱신한다 */
export type PuzzleBoardCellChange = {
	index: number,
	cell: PuzzleBoardCellView,
}

/** 트레이 슬롯 하나가 바뀌었다 */
export type PuzzleBoardItemChange = {
	index: number,
	item: PuzzleBoardItemView,
}

/**
 * 지금 손가락이 짚고 있는 자리.
 *
 * 퍼즐 로직과는 무관한 **순수한 조작 피드백**이다. 어느 퍼즐이든 누르고 있는 칸은
 * 눌린 티가 나야 하는데(PUZ_00 §8.5), 그것을 8개 퍼즐이 저마다 구현하면 같은 코드가
 * 여덟 번 생긴다. 그래서 프레젠터가 한 번만 알리고 패널이 그린다.
 *
 * 각 `*_CoreAPI` 가 칸에 직접 준 강조(`EBoardCellAccent`)가 있으면 그쪽이 이긴다 -
 * 러시아워의 "집어 든 오브젝트" 같은 것이 단순한 누름 표시에 덮이면 안 되기 때문이다.
 */
export type PuzzleBoardPressHighlight = {
	/** 손가락이 올라가 있는 칸. 짚고 있지 않거나 판 밖이면 `PUZZLE_BOARD_CELL_OUTSIDE` */
	cell: number,
	/** 트레이에서 집었다면 그 슬롯. 아니면 `PUZZLE_BOARD_CELL_OUTSIDE` */
	item: number,
}

/** 지금 누름이 어디서 시작했는지 */
export type PuzzleBoardPressOrigin =
	| { kind: 'cell', index: number }
	| { kind: 'item', index: number };

/**
 * CoreAPI 가 받는 입력 콜백.
 *
 * 탭 퍼즐은 `onCellTap` 하나면 되고, 스위치처럼 "누른 칸에서 떼야 확정" 규칙이 있는 퍼즐은
 * down/move/up 셋을 그대로 세션에 넘긴다. 드래그 퍼즐도 down/move/up 을 쓴다.
 *
 * 트레이에서 시작한 누름은 `onItemDown` 으로 알리고, 그 뒤의 이동·뗌은 칸에서 시작한 누름과
 * **똑같이** `onCellMove` / `onCellUp` 으로 나간다. 세션은 출발지를 구분할 필요가 없다.
 */
export type PuzzleBoardInputHandlers = {
	/** 손가락이 칸에 닿았다 */
	onCellDown?: (cell: number) => void,
	/** 누른 채로 다른 칸으로 옮겨 갔다. 보드 밖으로 나가면 PUZZLE_BOARD_CELL_OUTSIDE */
	onCellMove?: (cell: number) => void,
	/** 손가락을 뗐다. 뗀 위치가 보드 밖이면 PUZZLE_BOARD_CELL_OUTSIDE */
	onCellUp?: (cell: number) => void,
	/** 누른 칸과 뗀 칸이 같다 - 탭 퍼즐의 편의 콜백 */
	onCellTap?: (cell: number) => void,
	/** 보조 레이아웃의 오브젝트 슬롯을 집었다 (레이저: 인벤토리에서 크리스탈을 꺼낸다) */
	onItemDown?: (item: number) => void,
	/** 슬롯을 집었다가 판 밖에서 그대로 뗐다 - 끌지 않고 툭 누른 경우 */
	onItemTap?: (item: number) => void,
	/** 리셋 버튼을 눌렀다 - 판을 풀기 전 상태로 되돌린다 (남은 시간은 유지) */
	onReset?: () => void,
	/**
	 * 보조 레이아웃의 큰 액션 버튼을 눌렀다 (`PuzzleBoardLayoutSpec.actionLabel`).
	 * 패널이 `onPress`(누르는 순간)로 연결하므로 릴리즈를 기다리지 않는다 - 색 채우기의
	 * STOP 처럼 타이밍이 곧 게임인 입력이 여기로 온다.
	 */
	onAction?: () => void,
}

//#endregion

//#region Presenter

export class PuzzleBoardPresenter {
	/** 격자 크기·제목이 통째로 바뀌었다 (레벨 로드). 패널은 전체를 다시 반영한다 */
	public readonly LAYOUT_CHANGED = new EventPublisher<PuzzleBoardView>();
	/** 칸 하나가 바뀌었다 */
	public readonly CELL_CHANGED = new EventPublisher<PuzzleBoardCellChange>();
	/** 보조 격자의 칸 하나가 바뀌었다 */
	public readonly SIDE_CELL_CHANGED = new EventPublisher<PuzzleBoardCellChange>();
	/** 트레이 슬롯 하나가 바뀌었다 */
	public readonly ITEM_CHANGED = new EventPublisher<PuzzleBoardItemChange>();
	/** 시작 배너가 떴다/사라졌다. 떠 있는 동안 패널은 보조 레이아웃을 그리지 않는다 */
	public readonly INTRO_CHANGED = new EventPublisher<PuzzleBoardIntroView>();
	/** 짚고 있는 자리가 바뀌었다 - 패널이 누름 표시를 옮긴다 */
	public readonly PRESS_CHANGED = new EventPublisher<PuzzleBoardPressHighlight>();

	private _view: PuzzleBoardView;
	private readonly _handlers: PuzzleBoardInputHandlers;

	private _isInputEnabled: boolean = false;

	/**
	 * 지금 누름이 시작된 자리. undefined 면 놀고 있다.
	 * 하나가 살아 있는데 새 down 이 오면 앞 터치의 release 가 유실된 것으로 보고,
	 * 앞 누름을 마지막 칸에 놓아 마감한 뒤 새 누름을 연다 (`pointerDown()` 주석).
	 */
	private _press: PuzzleBoardPressOrigin | undefined = undefined;
	/** 손가락이 지금 올라가 있는 칸. 보드 밖이면 PUZZLE_BOARD_CELL_OUTSIDE */
	private _hoverCell: number = PUZZLE_BOARD_CELL_OUTSIDE;
	/**
	 * 이번 누름에서 손가락이 **마지막으로 올라가 있던 진짜 칸**.
	 *
	 * 스쳐 가는 `onExit` 로는 지워지지 않고, 판을 진짜로 벗어났을 때
	 * (`pointerLeaveBoard()`)만 지워진다. 뗄 때 hover 가 밖이면 이 값으로 놓는다
	 * (머리말 "손을 뗄 때 어느 칸에 놓았다고 볼 것인가").
	 */
	private _lastInsideCell: number = PUZZLE_BOARD_CELL_OUTSIDE;

	private _intro: PuzzleBoardIntroView = { isVisible: false, text: PUZZLE_BOARD_INTRO_TEXT };

	/** 마지막으로 알린 누름 표시. 같은 값을 두 번 알리지 않기 위해 들고 있는다 */
	private _pressCell: number = PUZZLE_BOARD_CELL_OUTSIDE;
	private _pressItem: number = PUZZLE_BOARD_CELL_OUTSIDE;

	constructor(spec: PuzzleBoardLayoutSpec, handlers: PuzzleBoardInputHandlers = {}) {
		this._handlers = handlers;
		this._view = createBoardView(spec);
		this.warnOnInvalidLayout(spec);
	}

	//#region Query

	public getView(): PuzzleBoardView {
		return this._view;
	}

	public getCell(index: number): PuzzleBoardCellView | undefined {
		return this._view.grid.cells[index];
	}

	public getSideCell(index: number): PuzzleBoardCellView | undefined {
		const side = this._view.side;
		return side === undefined ? undefined : side.cells[index];
	}

	public getItem(index: number): PuzzleBoardItemView | undefined {
		return this._view.items[index];
	}

	public get isInputEnabled(): boolean {
		return this._isInputEnabled;
	}

	/** 지금 누르고 있는 칸이나 슬롯이 있는지 */
	public get hasActivePress(): boolean {
		return this._press !== undefined;
	}

	/** 지금 누름이 어디서 시작했는지. 놀고 있으면 undefined */
	public get pressOrigin(): PuzzleBoardPressOrigin | undefined {
		return this._press;
	}

	/**
	 * 지금 짚고 있는 자리. 짚고 있지 않으면 둘 다 `PUZZLE_BOARD_CELL_OUTSIDE`.
	 *
	 * 누름 표시는 **누름이 시작된 칸 위에 손가락이 있을 때만** 켠다 - 손가락을 따라
	 * 이웃 칸으로 옮겨 다니지 않는다. 예전에는 hover 칸을 그대로 표시해서, 탭 퍼즐에서
	 * 카드를 누른 채 움직이면 지나가는 카드마다 테두리가 켜졌다 ("지속적으로 드래그
	 * 계산이 일어나고 있다" 는 피드백). 드래그 퍼즐의 이동 시각화는 세션이 주는
	 * accent(GRABBED/PATH)가 담당하므로 여기서 따라다닐 필요가 없다.
	 */
	public getPressHighlight(): PuzzleBoardPressHighlight {
		const press = this._press;
		const isOnPressedCell = press !== undefined && press.kind === 'cell' && this._hoverCell === press.index;
		return {
			cell: isOnPressedCell && press !== undefined ? press.index : PUZZLE_BOARD_CELL_OUTSIDE,
			item: press !== undefined && press.kind === 'item' ? press.index : PUZZLE_BOARD_CELL_OUTSIDE,
		};
	}

	public getIntro(): PuzzleBoardIntroView {
		return { isVisible: this._intro.isVisible, text: this._intro.text };
	}

	public get isIntroVisible(): boolean {
		return this._intro.isVisible;
	}

	//#endregion

	//#region Layout

	/**
	 * 격자 규격을 갈아 끼운다 (레벨 로드 / 퍼즐 전환).
	 * 칸 내용은 전부 초기화되므로 곧바로 setCell() 로 채운다.
	 */
	public resetLayout(spec: PuzzleBoardLayoutSpec): void {
		this.cancelPress();
		this._view = createBoardView(spec);
		this.warnOnInvalidLayout(spec);
		this.LAYOUT_CHANGED.publish(this._view);
	}

	public setTitle(title: string): void {
		if (this._view.title === title) {
			return;
		}
		this._view.title = title;
		this.LAYOUT_CHANGED.publish(this._view);
	}

	//#endregion

	//#region Cell update

	/** 칸 하나를 갱신한다. 실제로 바뀐 것이 없으면 이벤트를 내지 않는다 */
	public setCell(index: number, patch: PuzzleBoardCellPatch): boolean {
		const current = this._view.grid.cells[index];
		if (current === undefined) {
			return false;
		}
		const next = applyCellPatch(current, patch);
		if (next === undefined) {
			return false;
		}
		this._view.grid.cells[index] = next;
		this.CELL_CHANGED.publish({ index: index, cell: next });
		return true;
	}

	public setSideCell(index: number, patch: PuzzleBoardCellPatch): boolean {
		const side = this._view.side;
		if (side === undefined) {
			return false;
		}
		const current = side.cells[index];
		if (current === undefined) {
			return false;
		}
		const next = applyCellPatch(current, patch);
		if (next === undefined) {
			return false;
		}
		side.cells[index] = next;
		this.SIDE_CELL_CHANGED.publish({ index: index, cell: next });
		return true;
	}

	/** 모든 칸에 같은 패치를 적용한다 (라운드 정리 등) */
	public setAllCells(patch: PuzzleBoardCellPatch): void {
		for (let index = 0; index < this._view.grid.cells.length; index++) {
			this.setCell(index, patch);
		}
	}

	/** 트레이 슬롯 하나를 갱신한다. 실제로 바뀐 것이 없으면 이벤트를 내지 않는다 */
	public setItem(index: number, patch: PuzzleBoardItemPatch): boolean {
		const current = this._view.items[index];
		if (current === undefined) {
			return false;
		}
		const next = applyItemPatch(current, patch);
		if (next === undefined) {
			return false;
		}
		this._view.items[index] = next;
		this.ITEM_CHANGED.publish({ index: index, item: next });
		return true;
	}

	public setAllItems(patch: PuzzleBoardItemPatch): void {
		for (let index = 0; index < this._view.items.length; index++) {
			this.setItem(index, patch);
		}
	}

	//#endregion

	//#region Intro (레벨 시작 배너)

	/**
	 * 시작 배너를 띄운다. 떠 있는 동안 보조 레이아웃은 그리지 않는다.
	 *
	 * **얼마나 떠 있을지는 여기서 정하지 않는다.** 순수 계층에는 타이머가 없으므로
	 * 패널이 `introSeconds` 뒤에 `endIntro()` 를 부른다.
	 */
	public beginIntro(text: string = PUZZLE_BOARD_INTRO_TEXT): void {
		if (this._intro.isVisible && this._intro.text === text) {
			return;
		}
		this._intro = { isVisible: true, text: text };
		this.INTRO_CHANGED.publish(this.getIntro());
	}

	/** 배너를 내린다 - 이 시점에 보조 레이아웃이 나타난다 */
	public endIntro(): void {
		if (this._intro.isVisible === false) {
			return;
		}
		this._intro = { isVisible: false, text: this._intro.text };
		this.INTRO_CHANGED.publish(this.getIntro());
	}

	//#endregion

	//#region Input (패널의 Pressable 이 부른다)

	/** 일시정지·연출 중에는 꺼 둔다. 끄면 진행 중이던 누름도 취소된다 */
	public setInputEnabled(isEnabled: boolean): void {
		if (this._isInputEnabled === isEnabled) {
			return;
		}
		this._isInputEnabled = isEnabled;
		if (isEnabled === false) {
			this.cancelPress();
		}
	}

	public pointerDown(cell: number): void {
		if (this._isInputEnabled === false) {
			return;
		}
		if (this._press !== undefined) {
			// 앞 누름이 열려 있는데 새 down 이 왔다 - **앞 터치의 release 가 유실된 것이다.**
			//
			// 모바일 `Pressable` 은 누른 요소 밖으로 끌고 나가 손을 떼면 release 를 어느
			// 요소에도 전달하지 않는 경우가 있다. 예전처럼 새 down 을 무시하면(단일 터치
			// 강제) 드래그가 영구히 붙잡혀, **다음 탭의 release 가 올 때까지 조각이 놓이지
			// 않았다** - "떼도 안 놓이고 한 번 더 터치해야 놓인다" 신고의 정체다.
			// 3D 시절 터치 라우터(`PuzzleTouchRouter.handleTouchStart`)와 같은 회복 규칙로,
			// 붙잡힌 누름을 마지막으로 올라가 있던 진짜 칸에 놓아 마감하고 새 터치를 받는다.
			this.pointerUp();
		}
		if (this.isPressableCell(cell) === false) {
			// 보이지 않는 칸은 보드의 일부가 아니다 (스위치의 FREE 좌표 - PUZ_08 §4)
			return;
		}
		this._press = { kind: 'cell', index: cell };
		this._hoverCell = cell;
		this._lastInsideCell = cell;
		// 표시를 먼저 옮긴 뒤 세션에 알린다. 세션이 칸을 다시 칠하더라도 누름 표시는
		// 칸 상태와 별개로 관리되므로 서로 덮어쓰지 않는다.
		this.publishPress();
		if (this._handlers.onCellDown !== undefined) {
			this._handlers.onCellDown(cell);
		}
	}

	/**
	 * 보조 레이아웃의 오브젝트 슬롯을 집었다.
	 *
	 * 아직 판 위가 아니므로 hover 는 보드 밖에서 시작한다. 곧바로 떼면 `onItemTap`,
	 * 판으로 끌고 가면 그때부터는 칸에서 시작한 누름과 완전히 같은 경로다.
	 */
	public itemDown(item: number): void {
		if (this._isInputEnabled === false) {
			return;
		}
		if (this._press !== undefined) {
			// pointerDown() 과 같은 회복 규칙 - 유실된 release 를 새 down 에서 마감한다
			this.pointerUp();
		}
		if (this.isPressableItem(item) === false) {
			return;
		}
		this._press = { kind: 'item', index: item };
		this._hoverCell = PUZZLE_BOARD_CELL_OUTSIDE;
		// 아직 판에 들어오지 않았다 - 여기서 그대로 떼면 "판 밖" 이 맞다
		this._lastInsideCell = PUZZLE_BOARD_CELL_OUTSIDE;
		this.publishPress();
		if (this._handlers.onItemDown !== undefined) {
			this._handlers.onItemDown(item);
		}
	}

	/**
	 * 리셋 버튼을 눌렀다 - 판을 풀기 전 상태로 되돌린다.
	 *
	 * 입력이 꺼져 있을 때(일시정지·결과 화면)는 받지 않는다. 진행 중이던 누름은
	 * 되돌아갈 판이 사라지므로 먼저 마감한다.
	 */
	public requestReset(): boolean {
		if (this._isInputEnabled === false || this._handlers.onReset === undefined) {
			return false;
		}
		this.cancelPress();
		this._handlers.onReset();
		return true;
	}

	/**
	 * 보조 레이아웃의 큰 액션 버튼을 눌렀다 - 타이밍 입력이므로 지체 없이 세션에 넘긴다.
	 * 리셋과 같은 게이트(입력 꺼짐 무시)를 쓰되, 진행 중 누름은 취소하지 않는다 -
	 * 액션 버튼은 격자 누름과 영역이 겹치지 않아 서로 방해할 일이 없다.
	 */
	public requestAction(): boolean {
		if (this._isInputEnabled === false || this._handlers.onAction === undefined) {
			return false;
		}
		this._handlers.onAction();
		return true;
	}

	/**
	 * 누른 채로 다른 칸에 들어갔다.
	 * 보이지 않는 칸(보드의 구멍)에 들어간 것은 보드 밖으로 나간 것과 같게 다룬다.
	 */
	public pointerEnter(cell: number): void {
		const nextCell = this.isHoverableCell(cell) ? cell : PUZZLE_BOARD_CELL_OUTSIDE;
		if (this._press === undefined || this._hoverCell === nextCell) {
			return;
		}
		this._hoverCell = nextCell;
		if (nextCell !== PUZZLE_BOARD_CELL_OUTSIDE) {
			this._lastInsideCell = nextCell;
		}
		this.publishPress();
		if (this._handlers.onCellMove !== undefined) {
			this._handlers.onCellMove(nextCell);
		}
	}

	/**
	 * 누른 채로 이 칸에서 빠져나갔다 - 스위치의 "다운한 칸 밖" 판정에 쓴다 (PUZ_08 M2).
	 *
	 * **칸 번호를 받는 것이 중요하다.** A→B 로 옮겨 갈 때 UI 는 `onExit(A)` 와 `onEnter(B)` 를
	 * 내는데 둘의 순서가 보장되지 않는다. 지금 올라가 있는 칸이 A 일 때만 밖으로 처리하면
	 * 어느 순서로 와도 결과가 같다.
	 */
	public pointerExit(cell: number): void {
		if (this._press === undefined || this._hoverCell !== cell) {
			return;
		}
		this.moveHoverOutside();
	}

	/**
	 * 격자 바깥 영역으로 나갔다 (패널 배경). 지금 칸이 무엇이든 밖으로 만든다.
	 *
	 * **여기서만 "마지막 진짜 칸" 까지 지운다.** 칸끼리 오갈 때 스쳐 가는 `onExit` 와 달리
	 * 이것은 격자 밖 배경이 보내는 명시적인 신호라, 판을 진짜로 벗어났다고 볼 수 있다.
	 */
	public pointerLeaveBoard(): void {
		if (this._press === undefined) {
			return;
		}
		this._lastInsideCell = PUZZLE_BOARD_CELL_OUTSIDE;
		this.moveHoverOutside();
	}

	/**
	 * 손가락을 뗐다.
	 *
	 * 뗀 칸은 출발지가 칸이든 슬롯이든 언제나 `onCellUp` 으로 나간다 - 세션이 드랍 지점만
	 * 알면 되기 때문이다. 그 위에 편의 콜백이 하나 더 붙는다.
	 *   칸에서 시작해 같은 칸에서 뗐다  -> onCellTap
	 *   슬롯에서 시작해 판 밖에서 뗐다  -> onItemTap (끌지 않고 툭 누른 경우)
	 */
	public pointerUp(): void {
		const press = this._press;
		if (press === undefined) {
			return;
		}
		// 뗄 때 `onExit` 가 먼저 와서 hover 가 지워졌더라도, 마지막으로 올라가 있던 칸에
		// 놓은 것으로 본다. 판을 진짜로 벗어났다면 그 값도 이미 밖이다 (머리말 참고).
		const releasedCell = this._hoverCell !== PUZZLE_BOARD_CELL_OUTSIDE
			? this._hoverCell
			: this._lastInsideCell;
		this._press = undefined;
		this._hoverCell = PUZZLE_BOARD_CELL_OUTSIDE;
		this._lastInsideCell = PUZZLE_BOARD_CELL_OUTSIDE;
		this.publishPress();

		if (this._handlers.onCellUp !== undefined) {
			this._handlers.onCellUp(releasedCell);
		}
		if (press.kind === 'cell' && releasedCell === press.index && this._handlers.onCellTap !== undefined) {
			this._handlers.onCellTap(releasedCell);
		}
		if (press.kind === 'item' && releasedCell === PUZZLE_BOARD_CELL_OUTSIDE && this._handlers.onItemTap !== undefined) {
			this._handlers.onItemTap(press.index);
		}
	}

	/**
	 * 진행 중이던 누름을 좌표 없이 마감한다.
	 *
	 * 패널이 내려가거나 입력이 꺼질 때 부른다. 부르지 않으면 세션의 입력 컨트롤러가
	 * "누르고 있는 중" 으로 남아 다음 터치를 거절한다.
	 */
	public cancelPress(): void {
		if (this._press === undefined) {
			return;
		}
		this._press = undefined;
		this._hoverCell = PUZZLE_BOARD_CELL_OUTSIDE;
		this._lastInsideCell = PUZZLE_BOARD_CELL_OUTSIDE;
		this.publishPress();
		if (this._handlers.onCellUp !== undefined) {
			this._handlers.onCellUp(PUZZLE_BOARD_CELL_OUTSIDE);
		}
	}

	//#endregion

	private moveHoverOutside(): void {
		if (this._hoverCell === PUZZLE_BOARD_CELL_OUTSIDE) {
			return;
		}
		this._hoverCell = PUZZLE_BOARD_CELL_OUTSIDE;
		this.publishPress();
		if (this._handlers.onCellMove !== undefined) {
			this._handlers.onCellMove(PUZZLE_BOARD_CELL_OUTSIDE);
		}
	}

	/** 짚고 있는 자리가 실제로 바뀌었을 때만 알린다 - 불필요한 재렌더를 내지 않는다 */
	private publishPress(): void {
		const next = this.getPressHighlight();
		if (next.cell === this._pressCell && next.item === this._pressItem) {
			return;
		}
		this._pressCell = next.cell;
		this._pressItem = next.item;
		this.PRESS_CHANGED.publish(next);
	}

	/**
	 * 이 칸에서 누름을 **시작**할 수 있는지 - 보이고, 인터랙션 규격상 만질 수 있는 칸만.
	 *
	 * 정적인 칸(빈 바탕·고정 오브젝트·연출 전용)은 눌러도 아무 감지가 일어나지 않는다.
	 * 인터랙션 규격: 각 CoreAPI 가 만질 수 있는 오브젝트에만 `isInteractive` 를 준다.
	 */
	private isPressableCell(cell: number): boolean {
		const view = this._view.grid.cells[cell];
		return view !== undefined && view.isVisible && view.isInteractive;
	}

	/**
	 * 진행 중인 드래그가 이 칸 **위를 지나갈** 수 있는지 - 보이기만 하면 된다.
	 *
	 * `isPressableCell` 과 다른 기준을 쓰는 이유: 빈 칸은 정적(누름 시작 불가)이지만,
	 * 집어 든 조각을 빈 칸 위로 끌고 가는 것은 드래그 퍼즐의 기본 동작이기 때문이다.
	 */
	private isHoverableCell(cell: number): boolean {
		const view = this._view.grid.cells[cell];
		return view !== undefined && view.isVisible;
	}

	/** 보이는 슬롯만 집을 수 있다 - 빈 슬롯은 집을 것이 없다 */
	private isPressableItem(item: number): boolean {
		const view = this._view.items[item];
		return view !== undefined && view.isVisible;
	}

	private warnOnInvalidLayout(spec: PuzzleBoardLayoutSpec): void {
		const violations = validateBoardLayout(spec);
		if (violations.length > 0) {
			console.warn(`[PuzzleBoardPresenter] Layout is out of the drawable range: ${violations.join(' ')}`);
		}
	}
}

//#endregion

//#region Stage

/**
 * 지금 화면에 올라가 있는 보드 하나를 가리키는 자리.
 *
 * 메인 UI 는 한 번에 퍼즐 하나만 돌리므로(`PuzzleUI_Model` 의 화면 상태 머신),
 * 패널은 "현재 마운트된 프레젠터" 하나만 그리면 된다. 각 `*_CoreAPI` 는 퀘스트를
 * 시작할 때 `mount()`, 끝나거나 메뉴로 돌아갈 때 `unmount()` 를 부른다.
 *
 * `PuzzleHubRegistry` 와 같은 이유로 싱글턴이다 - Local 스크립트는 클라이언트마다
 * 별도 JS 컨텍스트에서 돌기 때문에 플레이어끼리 섞이지 않는다
 * (`Documents/생성 문서/설계/2026-09-02_멀티플레이_플랫폼에서_싱글플레이_구현_방안.md` §1.2).
 * 테스트에서는 `new PuzzleBoardStage()` 로 독립 인스턴스를 만든다.
 */
export class PuzzleBoardStage {
	private static _instance: PuzzleBoardStage | undefined = undefined;

	public static get instance(): PuzzleBoardStage {
		if (PuzzleBoardStage._instance === undefined) {
			PuzzleBoardStage._instance = new PuzzleBoardStage();
		}
		return PuzzleBoardStage._instance;
	}

	/** 보드가 올라왔다 - 패널이 그리기 시작하는 시점 */
	public readonly MOUNTED = new EventPublisher<PuzzleBoardPresenter>();
	/** 보드가 내려갔다 - 패널이 빈 화면으로 돌아가는 시점 */
	public readonly UNMOUNTED = new EventPublisher<void>();
	/**
	 * 보드 위의 Menu 버튼을 눌렀다 - 허브가 받아서 일시정지로 넘어간다.
	 *
	 * 두 패널은 서로를 모른다. 보드 패널은 `horizon/ui` 만 알고 허브의 모델을 참조하지
	 * 않으므로, 이 스테이지가 둘 사이의 유일한 통로다 (`mount`/`unmount` 와 같은 방향).
	 * 일시정지 여부를 판단하는 것은 여전히 허브의 `PuzzleHubModel.pauseGame()` 이다 -
	 * 여기서는 "눌렸다" 는 사실만 나른다 (PUZ_00 §7.1 로직과 표현의 분리).
	 */
	public readonly PAUSE_REQUESTED = new EventPublisher<void>();

	private _current: PuzzleBoardPresenter | undefined = undefined;

	public get current(): PuzzleBoardPresenter | undefined {
		return this._current;
	}

	public mount(presenter: PuzzleBoardPresenter): void {
		if (this._current === presenter) {
			return;
		}
		this._current = presenter;

		// 그릴 패널이 하나도 없으면 퍼즐은 정상적으로 도는데 화면에는 아무것도 안 나온다.
		// 허브 UI 는 인게임에서 상단 바만 그리므로(PUZ_00 §8.5) 뒤가 그대로 비쳐 보이고,
		// 아무 오류도 나지 않아 원인을 찾기 어렵다. 그래서 여기서 한 번 알려 준다.
		if (this.MOUNTED.hasSubscriptions === false) {
			console.warn('[PuzzleBoardStage] A board was mounted but no panel is listening, so nothing will be drawn. '
				+ 'Add a Custom UI gizmo with PuzzleBoardUI_Panel (execution mode Local, Display Mode Screen Overlay) '
				+ 'and put that entity in Puzzle_LocalOwnership targets.');
		}

		this.MOUNTED.publish(presenter);
	}

	/**
	 * 보드의 Menu 버튼이 눌렸음을 허브에 알린다.
	 *
	 * 듣는 쪽이 없으면 눌러도 아무 일이 없고 오류도 나지 않는다 - `mount()` 와 같은 이유로
	 * 한 번 알려 준다. 인월드에서 이 경고가 뜨면 허브 패널(`PuzzleUI_MainPanel`)이 없거나
	 * 소유권이 넘어오지 않은 것이다.
	 */
	public requestPause(): void {
		if (this.PAUSE_REQUESTED.hasSubscriptions === false) {
			console.warn('[PuzzleBoardStage] The board Menu button was pressed but no hub panel is listening, '
				+ 'so the game cannot be paused. Add a Custom UI gizmo with PuzzleUI_MainPanel '
				+ '(execution mode Local, Display Mode Screen Overlay) and put that entity in Puzzle_LocalOwnership targets.');
			return;
		}
		this.PAUSE_REQUESTED.publish(undefined);
	}

	/**
	 * 올라가 있던 보드를 무조건 내린다 - 허브가 새로 시작할 때 부른다.
	 *
	 * 스테이지는 모듈 싱글턴이라, 플레이어가 월드를 나갔다 다시 들어와 패널이 다시
	 * 만들어져도 **앞서 올려둔 프레젠터가 그대로 남아 있다.** 패널은 붙자마자 그것을
	 * 집어 그리므로, 메인 메뉴가 떠야 할 자리에 직전에 풀던 판이 다시 나타난다.
	 */
	public reset(): void {
		this.unmount();
	}

	/** 인자를 주면 그 프레젠터가 아직 올라가 있을 때만 내린다 (늦게 도착한 정리를 무시) */
	public unmount(presenter?: PuzzleBoardPresenter): void {
		const current = this._current;
		if (current === undefined) {
			return;
		}
		if (presenter !== undefined && current !== presenter) {
			return;
		}
		current.cancelPress();
		// 배너를 켠 채로 내려가면 다음에 올라올 때 낡은 배너가 먼저 보인다
		current.endIntro();
		this._current = undefined;
		this.UNMOUNTED.publish();
	}
}

//#endregion
