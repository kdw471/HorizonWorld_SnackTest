/**
 * Rush Hour Board - 9x9(플레이 7x7) 슬라이딩 블록 보드의 순수 상태 머신
 *
 * 기획서 PUZ_02 §3, §5, §7 을 구현한다.
 *  - 모든 오브젝트는 필드(7x7) 위에서만 이동하며 필드 밖으로 나갈 수 없다.
 *  - 오브젝트는 배치된 방향(H/V) 한 축으로만 이동한다. 1x1(FREE)만 전 방향 이동.
 *  - 오브젝트끼리 겹칠 수 없다. 한 영역에는 하나의 오브젝트만 들어갈 수 있다.
 *  - 슬라이딩이므로 다른 오브젝트를 통과할 수 없고, 가로막히면 그 직전 칸에서 멈춘다.
 *
 * 이 클래스는 horizon/core 에 의존하지 않는다 (PUZ_00 §7.1).
 * 월드 좌표 <-> 격자 좌표 변환과 그랩/연출은 어댑터 계층의 책임이다.
 *
 * ## Horizon 에디터 컴파일 제약 (실측)
 *
 * 에디터의 TypeScript 는 `target < ES2015` 이고 lib 에 TypedArray 가 없다.
 *   - `Set` / `Map` 이터레이터를 `for...of` 로 **직접 순회할 수 없다** -> `Array.from(...)` 으로 감싼다
 *   - `Int8Array` 등 TypedArray 를 쓸 수 없다 -> 일반 `number[]` 를 쓴다
 * 로컬 `tsc` 는 target ES2020 이라 이 오류를 잡지 못하므로, 검증 명령(§6.1)으로 함께 확인한다.
 */

import {
	EEdge,
	EGoalStatus,
	EMoveDirection,
	EOrientation,
	RUSH_HOUR_PLAY_GRID_SIZE,
	RushHourCell,
	RushHourEndPoint,
	RushHourLevel,
	RushHourPiece,
	canMoveOnAxis,
	clonePiece,
	getAllowedDirections,
	getDirectionDelta,
	getPieceCells,
	hasReachedEndPoint,
	isEndPointInsidePlayField,
	isInsidePlayField,
	isOnEndPointLane,
	toFullGridIndex,
	toPlayLocalIndex,
} from 'RushHour_Definitions';

/** 슬라이드 시도 결과 */
export type RushHourSlideResult = {
	/** 실제로 이동한 칸 수. 0 이면 이동하지 못했다는 뜻 */
	steps: number,
	/** 축이 맞지 않거나 대상이 없어 시도 자체가 불가능했는지 */
	isRejected: boolean,
}

export class RushHourBoard {
	private readonly _size: number;
	private readonly _pieces: RushHourPiece[] = [];
	private readonly _pieceById = new Map<string, RushHourPiece>();
	private readonly _endPoints: RushHourEndPoint[] = [];
	/** 어떤 오브젝트도 들어갈 수 없는 칸 ("row,col" 로컬 좌표) - 필드 안쪽 도착 포인트 */
	private readonly _blockedCells: string[] = [];
	/** 결합(삽입)된 목표 오브젝트 id - 모바일 사양 §9 */
	private readonly _dockedGoalIds = new Set<string>();

	/** occupancy[row][col] = pieceId | null */
	private _occupancy: (string | null)[][] = [];

	public get size(): number {
		return this._size;
	}

	public get pieces(): readonly RushHourPiece[] {
		return this._pieces;
	}

	public get endPoints(): readonly RushHourEndPoint[] {
		return this._endPoints;
	}

	public get goalPieces(): RushHourPiece[] {
		return this._pieces.filter((piece) => piece.isGoal);
	}

	constructor(pieces: RushHourPiece[] = [], endPoints: RushHourEndPoint[] = [], size: number = RUSH_HOUR_PLAY_GRID_SIZE) {
		this._size = size;
		this._endPoints = endPoints.slice();

		// 기획 CSV 판은 도착 포인트가 7x7 안쪽 가장자리 칸에 있다.
		// 그 칸은 USB 가 꽂히는 자리이므로 어떤 오브젝트도 들어갈 수 없다.
		// (생성기 판처럼 도착 포인트가 테두리 링에 있으면 애초에 닿지 않으므로 영향이 없다)
		for (const endPoint of this._endPoints) {
			if (isEndPointInsidePlayField(endPoint)) {
				this._blockedCells.push(`${toPlayLocalIndex(endPoint.row)},${toPlayLocalIndex(endPoint.col)}`);
			}
		}

		this.clearOccupancy();
		for (const piece of pieces) {
			this.addPiece(piece);
		}
	}

	/** 레벨 데이터로부터 보드를 만든다 */
	public static fromLevel(level: RushHourLevel, size: number = RUSH_HOUR_PLAY_GRID_SIZE): RushHourBoard {
		return new RushHourBoard(level.pieces.map(clonePiece), level.endPoints.slice(), size);
	}

	//#region Placement

	/**
	 * 오브젝트를 보드에 추가한다.
	 * 필드를 벗어나거나 다른 오브젝트와 겹치면 실패한다 (기획서 §5.2 "겹치게 배치할 수 없다").
	 */
	public addPiece(piece: RushHourPiece): boolean {
		if (this._pieceById.has(piece.id)) {
			console.warn(`[RushHourBoard] Duplicate piece id: ${piece.id}`);
			return false;
		}
		if (this.canOccupy(getPieceCells(piece), piece.id) === false) {
			return false;
		}

		this._pieces.push(piece);
		this._pieceById.set(piece.id, piece);
		this.stampPiece(piece, piece.id);
		return true;
	}

	public removePiece(pieceId: string): RushHourPiece | undefined {
		const piece = this._pieceById.get(pieceId);
		if (piece === undefined) {
			return undefined;
		}

		this.stampPiece(piece, null);
		this._pieceById.delete(pieceId);
		this._pieces.splice(this._pieces.indexOf(piece), 1);
		return piece;
	}

	public getPiece(pieceId: string): RushHourPiece | undefined {
		return this._pieceById.get(pieceId);
	}

	public getPieceAt(row: number, col: number): RushHourPiece | undefined {
		if (isInsidePlayField(row, col) === false) {
			return undefined;
		}
		const id = this._occupancy[row][col];
		return id === null ? undefined : this._pieceById.get(id);
	}

	/**
	 * 주어진 칸들을 점유할 수 있는지.
	 * `ignorePieceId` 는 자기 자신이 이미 점유 중인 칸을 무시하기 위해 쓴다.
	 */
	public canOccupy(cells: RushHourCell[], ignorePieceId?: string): boolean {
		for (const cell of cells) {
			if (isInsidePlayField(cell.row, cell.col) === false) {
				return false;
			}
			if (this._blockedCells.indexOf(`${cell.row},${cell.col}`) >= 0) {
				return false;
			}
			const occupant = this._occupancy[cell.row][cell.col];
			if (occupant !== null && occupant !== ignorePieceId) {
				return false;
			}
		}
		return true;
	}

	//#endregion

	//#region Movement

	/**
	 * 해당 방향으로 막힘없이 이동할 수 있는 최대 칸 수.
	 * 슬라이딩이므로 중간에 다른 오브젝트가 있으면 그 앞에서 멈춘다.
	 */
	public getMaxSteps(pieceId: string, direction: EMoveDirection): number {
		const piece = this._pieceById.get(pieceId);
		if (piece === undefined) {
			return 0;
		}
		if (canMoveOnAxis(piece.orientation, direction) === false) {
			return 0;
		}

		const delta = getDirectionDelta(direction);
		const cells = getPieceCells(piece);
		let steps = 0;
		while (steps < this._size) {
			const next = steps + 1;
			const candidate = cells.map((cell) => ({
				row: cell.row + delta.row * next,
				col: cell.col + delta.col * next,
			}));
			if (this.canOccupy(candidate, piece.id) === false) {
				break;
			}
			steps = next;
		}
		return steps;
	}

	/** 오브젝트가 어느 방향으로든 최소 1칸 움직일 수 있는지 - 기획서 §6 [필수] */
	public canPieceMove(pieceId: string): boolean {
		const piece = this._pieceById.get(pieceId);
		if (piece === undefined) {
			return false;
		}
		for (const direction of getAllowedDirections(piece.orientation)) {
			if (this.getMaxSteps(pieceId, direction) > 0) {
				return true;
			}
		}
		return false;
	}

	/** 모든 오브젝트가 최소 1칸 이상 움직일 수 있는지 - 기획서 §6 [필수] */
	public canEveryPieceMove(): boolean {
		return this.getImmovablePieceIds().length === 0;
	}

	public getImmovablePieceIds(): string[] {
		const immovable: string[] = [];
		for (const piece of this._pieces) {
			if (this.canPieceMove(piece.id) === false) {
				immovable.push(piece.id);
			}
		}
		return immovable;
	}

	/**
	 * 오브젝트를 지정한 방향으로 최대 `requestedSteps` 칸 슬라이드한다.
	 * 가로막히면 갈 수 있는 데까지만 이동하고 실제 이동 칸 수를 돌려준다.
	 */
	public slide(pieceId: string, direction: EMoveDirection, requestedSteps: number = 1): RushHourSlideResult {
		const piece = this._pieceById.get(pieceId);
		if (piece === undefined) {
			return { steps: 0, isRejected: true };
		}
		if (canMoveOnAxis(piece.orientation, direction) === false) {
			// 축 고정 규칙 위반 - 기획서 §5.1 / §5.2
			return { steps: 0, isRejected: true };
		}
		if (requestedSteps <= 0 || isNaN(requestedSteps)) {
			// NaN 은 모든 부등호를 통과해 piece.row/col 을 NaN 으로 영구 오염시키므로 명시적으로 거른다
			return { steps: 0, isRejected: true };
		}
		if (this._dockedGoalIds.has(pieceId)) {
			// 결합된 USB 는 먼저 undock() 으로 뽑아야 움직일 수 있다 - 모바일 사양 §9
			return { steps: 0, isRejected: true };
		}

		const steps = Math.min(requestedSteps, this.getMaxSteps(pieceId, direction));
		if (steps <= 0) {
			return { steps: 0, isRejected: false };
		}

		const delta = getDirectionDelta(direction);
		this.stampPiece(piece, null);
		piece.row += delta.row * steps;
		piece.col += delta.col * steps;
		this.stampPiece(piece, piece.id);
		return { steps: steps, isRejected: false };
	}

	/**
	 * 목표 칸으로 스냅한다 - 기획서 §7.
	 * 오브젝트의 이동 축 성분만 사용하고, 슬라이딩 도중 막히면 막히기 직전 칸에 놓인다.
	 * FREE(1x1) 는 전 방향 이동이 가능하지만 그랩 중에는 한 축만 유지하므로,
	 * 이동량이 더 큰 축을 선택한다.
	 */
	public snapToCell(pieceId: string, targetRow: number, targetCol: number): RushHourSlideResult {
		const piece = this._pieceById.get(pieceId);
		if (piece === undefined) {
			return { steps: 0, isRejected: true };
		}
		if (isNaN(targetRow) || isNaN(targetCol)) {
			// 화면 어댑터가 평면 뒤 릴리즈(NaN 좌표) 를 잘못 흘려 넣어도 보드가 오염되지 않게 막는다
			return { steps: 0, isRejected: true };
		}

		let rowDelta = targetRow - piece.row;
		let colDelta = targetCol - piece.col;

		if (piece.orientation === EOrientation.HORIZONTAL) {
			rowDelta = 0;
		}
		else if (piece.orientation === EOrientation.VERTICAL) {
			colDelta = 0;
		}
		else if (Math.abs(rowDelta) >= Math.abs(colDelta)) {
			colDelta = 0;
		}
		else {
			rowDelta = 0;
		}

		if (rowDelta === 0 && colDelta === 0) {
			return { steps: 0, isRejected: false };
		}

		if (rowDelta !== 0) {
			const direction = rowDelta < 0 ? EMoveDirection.UP : EMoveDirection.DOWN;
			return this.slide(pieceId, direction, Math.abs(rowDelta));
		}
		const direction = colDelta < 0 ? EMoveDirection.LEFT : EMoveDirection.RIGHT;
		return this.slide(pieceId, direction, Math.abs(colDelta));
	}

	/**
	 * 그랩을 놓았을 때의 연속 좌표를 칸으로 반올림하여 스냅한다 - 기획서 §7.
	 * "오브젝트의 중심이 위치한 칸으로 자동 이동 (더 많은 칸에 소속된 방향으로)"
	 * 여기서 좌표는 좌측·상단 블록 중심의 격자 좌표(플레이 로컬, 실수)이다.
	 */
	public snapFromContinuous(pieceId: string, continuousRow: number, continuousCol: number): RushHourSlideResult {
		return this.snapToCell(pieceId, Math.round(continuousRow), Math.round(continuousCol));
	}

	//#endregion

	//#region Goal / clear conditions

	/** 목표 오브젝트와 같은 색이면서 동일 선상인 도착 포인트 */
	public getEndPointForPiece(pieceId: string): RushHourEndPoint | undefined {
		const piece = this._pieceById.get(pieceId);
		if (piece === undefined) {
			return undefined;
		}
		for (const endPoint of this._endPoints) {
			if (endPoint.color === piece.color && isOnEndPointLane(piece, endPoint)) {
				return endPoint;
			}
		}
		return undefined;
	}

	/**
	 * 목표 오브젝트의 결합 진행 상태 - 모바일 사양 §9.
	 *   BLOCKED : 동일 선상이지만 아직 도착 포인트에 닿지 못함
	 *   READY   : 도착 포인트 전면까지 도달, 유저가 슬롯 방향으로 추가 드래그하면 꽂힐 수 있음
	 *   DOCKED  : 실제로 꽂힌 상태 (3칸 점유)
	 */
	public getGoalStatus(pieceId: string): EGoalStatus {
		const piece = this._pieceById.get(pieceId);
		const endPoint = this.getEndPointForPiece(pieceId);
		if (piece === undefined || endPoint === undefined) {
			return EGoalStatus.BLOCKED;
		}
		if (this._dockedGoalIds.has(pieceId)) {
			return EGoalStatus.DOCKED;
		}
		return hasReachedEndPoint(piece, endPoint) ? EGoalStatus.READY : EGoalStatus.BLOCKED;
	}

	/**
	 * USB 를 도착 포인트에 꽂는다 - 모바일 사양 §9.
	 * READY 상태(도착 포인트 전면에 밀착)일 때만 성공한다.
	 * 꽂힌 부분은 플레이 공간 밖의 테두리 링으로 들어가므로 필드 점유는 변하지 않는다.
	 */
	public dock(pieceId: string): boolean {
		if (this.getGoalStatus(pieceId) !== EGoalStatus.READY) {
			return false;
		}
		this._dockedGoalIds.add(pieceId);
		return true;
	}

	/** 꽂힌 USB 를 다시 뽑는다 - 모바일 사양 §9 */
	public undock(pieceId: string): boolean {
		return this._dockedGoalIds.delete(pieceId);
	}

	public isDocked(pieceId: string): boolean {
		return this._dockedGoalIds.has(pieceId);
	}

	/**
	 * 꽂힌 USB 가 점유하는 3칸을 전체 9x9 그리드 좌표로 돌려준다 - 모바일 사양 §9.
	 * 본체 2칸(플레이 공간) + 슬롯 안쪽 1칸(테두리 링) = 3칸.
	 * 꽂히지 않은 상태면 본체 2칸만 돌려준다.
	 */
	public getGoalOccupiedCellsInFullGrid(pieceId: string): RushHourCell[] {
		const piece = this._pieceById.get(pieceId);
		if (piece === undefined) {
			return [];
		}

		const cells: RushHourCell[] = getPieceCells(piece).map((cell) => ({
			row: toFullGridIndex(cell.row),
			col: toFullGridIndex(cell.col),
		}));

		const endPoint = this.getEndPointForPiece(pieceId);
		if (endPoint === undefined || this._dockedGoalIds.has(pieceId) === false) {
			return cells;
		}

		cells.push({ row: endPoint.row, col: endPoint.col });
		return cells;
	}

	/**
	 * 클리어 판정 - 모바일 사양 §2 / §11.3.
	 * "모든 목표 오브젝트가 각자의 도착 포인트에 도달 및 결합(삽입) 시 클리어."
	 * 도달만으로는 부족하고 DOCKED 까지 가야 한다.
	 */
	public isSolved(): boolean {
		const goals = this.goalPieces;
		if (goals.length === 0) {
			return false;
		}
		for (const goal of goals) {
			if (this.getGoalStatus(goal.id) !== EGoalStatus.DOCKED) {
				return false;
			}
		}
		return true;
	}

	/**
	 * 모든 목표가 도착 포인트에 닿기만 했는지 (결합 여부는 보지 않음).
	 * 솔버/레벨 생성기는 결합을 자유 행동으로 보므로 이쪽을 목표 상태로 삼는다.
	 */
	public hasEveryGoalArrived(): boolean {
		const goals = this.goalPieces;
		if (goals.length === 0) {
			return false;
		}
		for (const goal of goals) {
			const status = this.getGoalStatus(goal.id);
			if (status !== EGoalStatus.READY && status !== EGoalStatus.DOCKED) {
				return false;
			}
		}
		return true;
	}

	//#endregion

	//#region Line occupancy checks (기획서 §6)

	/**
	 * "동일한 이동 방향을 가진 오브젝트들이 한 줄을 가득 채운" 줄들을 찾는다 - 기획서 §6 [금지].
	 * 가로 오브젝트가 한 행을 전부 채우거나, 세로 오브젝트가 한 열을 전부 채우면
	 * 그 줄의 오브젝트들이 전혀 움직일 수 없게 되므로 금지된다.
	 * FREE(1x1)는 전 방향 이동이 가능해 줄을 잠그지 않으므로 계산에서 제외한다.
	 */
	public getSaturatedLines(): { axis: EOrientation, index: number }[] {
		const saturated: { axis: EOrientation, index: number }[] = [];

		for (let row = 0; row < this._size; row++) {
			let filled = 0;
			for (let col = 0; col < this._size; col++) {
				const piece = this.getPieceAt(row, col);
				if (piece !== undefined && piece.orientation === EOrientation.HORIZONTAL) {
					filled++;
				}
			}
			if (filled >= this._size) {
				saturated.push({ axis: EOrientation.HORIZONTAL, index: row });
			}
		}

		for (let col = 0; col < this._size; col++) {
			let filled = 0;
			for (let row = 0; row < this._size; row++) {
				const piece = this.getPieceAt(row, col);
				if (piece !== undefined && piece.orientation === EOrientation.VERTICAL) {
					filled++;
				}
			}
			if (filled >= this._size) {
				saturated.push({ axis: EOrientation.VERTICAL, index: col });
			}
		}

		return saturated;
	}

	/**
	 * 목표 오브젝트와 도착 포인트 사이 구간의 칸들 (목표 오브젝트 자신은 제외).
	 * 기획서 §6 의 첫 번째 [금지] 조항 검증에 쓰인다.
	 */
	public getCellsBetweenGoalAndEndPoint(pieceId: string): RushHourCell[] {
		const piece = this._pieceById.get(pieceId);
		const endPoint = this.getEndPointForPiece(pieceId);
		if (piece === undefined || endPoint === undefined) {
			return [];
		}

		const cells: RushHourCell[] = [];
		switch (endPoint.edge) {
			case EEdge.TOP:
				for (let row = 0; row < piece.row; row++) {
					cells.push({ row: row, col: piece.col });
				}
				break;
			case EEdge.BOTTOM:
				for (let row = piece.row + piece.size; row < this._size; row++) {
					cells.push({ row: row, col: piece.col });
				}
				break;
			case EEdge.LEFT:
				for (let col = 0; col < piece.col; col++) {
					cells.push({ row: piece.row, col: col });
				}
				break;
			default:
				for (let col = piece.col + piece.size; col < this._size; col++) {
					cells.push({ row: piece.row, col: col });
				}
				break;
		}
		return cells;
	}

	//#endregion

	//#region Serialization

	/** 솔버가 방문 상태를 구분하는 데 쓰는 키. 위치만 담으면 충분하다 (크기/축은 불변) */
	public getStateKey(): string {
		const parts: string[] = [];
		for (const piece of this._pieces) {
			parts.push(`${piece.id}:${piece.row},${piece.col}`);
		}
		parts.sort();
		return parts.join('|');
	}

	public clone(): RushHourBoard {
		const copy = new RushHourBoard(this._pieces.map(clonePiece), this._endPoints.slice(), this._size);
		for (const dockedId of Array.from(this._dockedGoalIds)) {
			copy._dockedGoalIds.add(dockedId);
		}
		return copy;
	}

	public toLevel(puzzleId: string, difficulty: number, minimumMoves: number): RushHourLevel {
		return {
			puzzleId: puzzleId,
			difficulty: difficulty,
			pieces: this._pieces.map(clonePiece),
			endPoints: this._endPoints.slice(),
			minimumMoves: minimumMoves,
		};
	}

	/** 디버그/2D 프로토타입용 격자 덤프 */
	public toDebugString(): string {
		// 오브젝트마다 고유한 글자를 배정한다. 목표는 대문자, 방해 오브젝트는 소문자/숫자.
		const symbols = new Map<string, string>();
		const goalSymbols = 'ABCDEFGH';
		const blockerSymbols = 'abcdefghijklmnopqrstuvwxyz0123456789';
		let goalIndex = 0;
		let blockerIndex = 0;
		for (const piece of this._pieces) {
			if (piece.isGoal) {
				symbols.set(piece.id, goalSymbols.charAt(goalIndex % goalSymbols.length));
				goalIndex++;
			}
			else {
				symbols.set(piece.id, blockerSymbols.charAt(blockerIndex % blockerSymbols.length));
				blockerIndex++;
			}
		}

		const rows: string[] = [];
		for (let row = 0; row < this._size; row++) {
			const cells: string[] = [];
			for (let col = 0; col < this._size; col++) {
				const id = this._occupancy[row][col];
				cells.push(id === null ? '.' : (symbols.get(id) ?? '?'));
			}
			rows.push(cells.join(' '));
		}
		return rows.join('\n');
	}

	//#endregion

	//#region Internal

	private clearOccupancy(): void {
		this._occupancy = [];
		for (let row = 0; row < this._size; row++) {
			const cells: (string | null)[] = [];
			for (let col = 0; col < this._size; col++) {
				cells.push(null);
			}
			this._occupancy.push(cells);
		}
	}

	private stampPiece(piece: RushHourPiece, value: string | null): void {
		for (const cell of getPieceCells(piece)) {
			if (isInsidePlayField(cell.row, cell.col)) {
				this._occupancy[cell.row][cell.col] = value;
			}
		}
	}

	//#endregion
}
