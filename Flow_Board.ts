/**
 * Flow Board - 타일 비트맵 + 노드 + 색깔별 경로의 순수 상태 머신 (PUZ_05)
 *
 * 사양 §4 오브젝트 제약 / §5 핵심 플레이 규칙 / §9.2~§9.4 구현.
 *
 * 클리어 판정은 반드시 두 조건을 모두 본다 (§9.4).
 *   (a) 모든 색 경로가 START ~ END 로 완결
 *   (b) 모든 SUB 노드가 색을 부여받아 활성화
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 *
 * ## Horizon 에디터 컴파일 제약 (실측)
 *
 * 에디터의 TypeScript 는 `target < ES2015` 이고 lib 에 TypedArray 가 없다.
 *   - `Set` / `Map` 이터레이터를 `for...of` 로 **직접 순회할 수 없다** -> `Array.from(...)` 으로 감싼다
 *   - `Int8Array` 등 TypedArray 를 쓸 수 없다 -> 일반 `number[]` 를 쓴다
 * 로컬 `tsc` 는 target ES2020 이라 이 오류를 잡지 못하므로, 검증 명령(§6.1)으로 함께 확인한다.
 */

import {
	EExtendRejection,
	EFlowColor,
	ENodeKind,
	ENodeRole,
	ExtendCheck,
	FLOW_GRID_SIZE,
	FlowCell,
	FlowLevel,
	FlowNode,
	cellKey,
	cloneNode,
	cloneTiles,
	isInsideGrid,
	isOrthogonallyAdjacent,
} from 'Flow_Definitions';

export class FlowBoard {
	private readonly _tiles: boolean[][];
	private readonly _nodes = new Map<string, FlowNode>();
	/** 색깔별 현재 경로 (출발 MAIN 부터 순서대로) */
	private readonly _paths = new Map<EFlowColor, FlowCell[]>();

	public get tiles(): readonly boolean[][] {
		return this._tiles;
	}

	public get nodes(): FlowNode[] {
		return Array.from(this._nodes.values());
	}

	public get colors(): EFlowColor[] {
		return Array.from(this._paths.keys());
	}

	constructor(tiles: boolean[][], nodes: FlowNode[]) {
		this._tiles = cloneTiles(tiles);
		for (const node of nodes) {
			this._nodes.set(cellKey(node.row, node.col), cloneNode(node));
		}

		// 색깔별 경로를 비워 둔 채로 준비한다
		for (const node of Array.from(this._nodes.values())) {
			if (node.kind === ENodeKind.MAIN && node.color !== undefined) {
				if (this._paths.has(node.color) === false) {
					this._paths.set(node.color, []);
				}
			}
		}
	}

	public static fromLevel(level: FlowLevel): FlowBoard {
		return new FlowBoard(level.tiles, level.nodes);
	}

	//#region Lookup

	public hasTile(row: number, col: number): boolean {
		if (isInsideGrid(row, col) === false) {
			return false;
		}
		return this._tiles[row][col];
	}

	public getNode(row: number, col: number): FlowNode | undefined {
		return this._nodes.get(cellKey(row, col));
	}

	/** 해당 색의 현재 경로 */
	public getPath(color: EFlowColor): readonly FlowCell[] {
		return this._paths.get(color) ?? [];
	}

	/** 경로의 머리(마지막으로 연결된 칸) */
	public getPathHead(color: EFlowColor): FlowCell | undefined {
		const path = this._paths.get(color);
		if (path === undefined || path.length === 0) {
			return undefined;
		}
		return path[path.length - 1];
	}

	/** 해당 색의 출발 / 도착 메인 오브젝트 */
	public getMain(color: EFlowColor, role: ENodeRole): FlowNode | undefined {
		for (const node of Array.from(this._nodes.values())) {
			if (node.kind === ENodeKind.MAIN && node.color === color && node.role === role) {
				return node;
			}
		}
		return undefined;
	}

	/** 경로가 START ~ END 로 완결되었는지 */
	public isPathComplete(color: EFlowColor): boolean {
		const head = this.getPathHead(color);
		if (head === undefined) {
			return false;
		}
		const node = this.getNode(head.row, head.col);
		return node !== undefined
			&& node.kind === ENodeKind.MAIN
			&& node.color === color
			&& node.role === ENodeRole.END;
	}

	/** 아직 색을 받지 못한 서브 오브젝트 수 - §5 "모든 서브 오브젝트가 활성화되어야 한다" */
	public getUncoloredSubCount(): number {
		let count = 0;
		for (const node of Array.from(this._nodes.values())) {
			if (node.kind === ENodeKind.SUB && node.color === undefined) {
				count++;
			}
		}
		return count;
	}

	/** 이 칸에서 그리기를 시작할 수 있는지 */
	public canBeginAt(row: number, col: number): boolean {
		return this.getBeginColor(row, col) !== undefined;
	}

	/**
	 * 이 칸에서 그리기를 시작한다면 어떤 색이 되는지.
	 *   - 아직 그리지 않은 색의 출발 메인 오브젝트
	 *   - 이미 그린 경로의 머리 (이어 그리거나 되돌아가기)
	 */
	public getBeginColor(row: number, col: number): EFlowColor | undefined {
		const node = this.getNode(row, col);
		if (node === undefined) {
			return undefined;
		}

		// 이미 그린 경로의 머리에서 이어 잡는다 - §6 지우기
		for (const entry of Array.from(this._paths.entries())) {
			const path = entry[1];
			if (path.length === 0) {
				continue;
			}
			const head = path[path.length - 1];
			if (head.row === row && head.col === col) {
				return entry[0];
			}
		}

		// §6 - 상호작용 가능한 오브젝트는 색상별로 하나뿐이며 게임 시작 시 출발점에 생성된다
		if (node.kind === ENodeKind.MAIN && node.role === ENodeRole.START && node.color !== undefined) {
			if (this.getPath(node.color).length === 0) {
				return node.color;
			}
		}
		return undefined;
	}

	//#endregion

	//#region Path drawing (§5 / §9.2)

	/** 출발 메인 오브젝트에서 경로를 시작한다 */
	public beginPath(color: EFlowColor): boolean {
		const start = this.getMain(color, ENodeRole.START);
		if (start === undefined) {
			return false;
		}

		const path = this._paths.get(color);
		if (path === undefined) {
			return false;
		}
		if (path.length > 0) {
			// 이미 그리는 중이면 그대로 이어 쓴다
			return true;
		}

		path.push({ row: start.row, col: start.col });
		return true;
	}

	/**
	 * 경로 확장 유효성 - §9.2.
	 *   상하좌우 인접 AND 타일 존재 AND 대상이 SUB 이고 아직 색이 없음
	 *   (도착 노드가 같은 색 MAIN(END) 이면 해당 색 경로 완성)
	 *
	 * 직전 칸으로 되돌아가는 이동은 되돌아가기(Undo)로 본다 - §6 / §9.3.
	 */
	public canExtend(color: EFlowColor, row: number, col: number): ExtendCheck {
		const path = this._paths.get(color);
		if (path === undefined || path.length === 0) {
			return { isValid: false, rejection: EExtendRejection.NOT_DRAWING, isUndo: false };
		}

		const head = path[path.length - 1];
		const target: FlowCell = { row: row, col: col };

		if (isOrthogonallyAdjacent(head, target) === false) {
			// 대각선이거나 떨어진 칸 - §5 "대각선 연결 불가"
			return { isValid: false, rejection: EExtendRejection.NOT_ADJACENT, isUndo: false };
		}

		// 직전 칸으로 되돌아가면 지우기다 - §9.3
		if (path.length >= 2) {
			const previous = path[path.length - 2];
			if (previous.row === row && previous.col === col) {
				return { isValid: true, rejection: EExtendRejection.NONE, isUndo: true };
			}
		}

		if (this.isPathComplete(color)) {
			// END 에 도달한 경로는 더 늘릴 수 없다
			return { isValid: false, rejection: EExtendRejection.PATH_COMPLETE, isUndo: false };
		}

		if (this.hasTile(row, col) === false) {
			return { isValid: false, rejection: EExtendRejection.NO_TILE, isUndo: false };
		}

		const node = this.getNode(row, col);
		if (node === undefined) {
			return { isValid: false, rejection: EExtendRejection.NO_TILE, isUndo: false };
		}

		// 자기 경로와 교차 금지 - §4 "서브는 단 하나의 입력과 하나의 출력만"
		for (const cell of path) {
			if (cell.row === row && cell.col === col) {
				return { isValid: false, rejection: EExtendRejection.SELF_INTERSECT, isUndo: false };
			}
		}

		if (node.kind === ENodeKind.MAIN) {
			// 같은 색의 도착 지점이면 완성
			if (node.color === color && node.role === ENodeRole.END) {
				return { isValid: true, rejection: EExtendRejection.NONE, isUndo: false };
			}
			return { isValid: false, rejection: EExtendRejection.OTHER_MAIN, isUndo: false };
		}

		// §5 - 이미 다른 색상이 활성화된 영역은 지나갈 수 없다
		if (node.color !== undefined) {
			return { isValid: false, rejection: EExtendRejection.ALREADY_COLORED, isUndo: false };
		}

		return { isValid: true, rejection: EExtendRejection.NONE, isUndo: false };
	}

	/**
	 * 경로를 한 칸 확장하거나 되돌아간다.
	 * 성공하면 true. 되돌아간 경우에도 true 다 (`canExtend().isUndo` 로 구분한다).
	 */
	public extend(color: EFlowColor, row: number, col: number): boolean {
		const check = this.canExtend(color, row, col);
		if (check.isValid === false) {
			return false;
		}

		const path = this._paths.get(color);
		if (path === undefined) {
			return false;
		}

		if (check.isUndo) {
			this.popHead(color);
			return true;
		}

		path.push({ row: row, col: col });

		// 지나간 서브 오브젝트에 색을 부여한다 - §4
		const node = this.getNode(row, col);
		if (node !== undefined && node.kind === ENodeKind.SUB) {
			node.color = color;
		}
		return true;
	}

	/** 경로의 머리를 하나 되돌린다 - §9.3 (스택 구조) */
	public popHead(color: EFlowColor): boolean {
		const path = this._paths.get(color);
		if (path === undefined || path.length === 0) {
			return false;
		}

		const removed = path.pop();
		if (removed === undefined) {
			return false;
		}

		// 서브 오브젝트였다면 색을 거둔다 (비활성화)
		const node = this.getNode(removed.row, removed.col);
		if (node !== undefined && node.kind === ENodeKind.SUB) {
			node.color = undefined;
		}
		return true;
	}

	/** 해당 색의 경로를 전부 지운다 */
	public clearPath(color: EFlowColor): void {
		const path = this._paths.get(color);
		if (path === undefined) {
			return;
		}
		while (path.length > 0) {
			this.popHead(color);
		}
	}

	/** 모든 경로를 지운다 (리셋) */
	public clearAllPaths(): void {
		for (const color of Array.from(this._paths.keys())) {
			this.clearPath(color);
		}
	}

	//#endregion

	//#region Clear condition (§9.4)

	/**
	 * 클리어 판정 - §9.4. 두 조건을 모두 확인한다.
	 *   (a) 모든 색 경로가 START ~ END 로 완결
	 *   (b) 모든 SUB 노드의 color != null
	 *
	 * 남은 서브 오브젝트가 하나라도 있으면 클리어 불가다 (§5).
	 */
	public isSolved(): boolean {
		if (this._paths.size === 0) {
			return false;
		}

		for (const color of Array.from(this._paths.keys())) {
			if (this.isPathComplete(color) === false) {
				return false;
			}
		}

		return this.getUncoloredSubCount() === 0;
	}

	/** 클리어 조건을 항목별로 돌려준다 - UI 표시용 */
	public getClearStatus(): { completedColors: EFlowColor[], incompleteColors: EFlowColor[], uncoloredSubCount: number } {
		const completed: EFlowColor[] = [];
		const incomplete: EFlowColor[] = [];
		for (const color of Array.from(this._paths.keys())) {
			if (this.isPathComplete(color)) {
				completed.push(color);
			}
			else {
				incomplete.push(color);
			}
		}
		return {
			completedColors: completed,
			incompleteColors: incomplete,
			uncoloredSubCount: this.getUncoloredSubCount(),
		};
	}

	//#endregion

	//#region Serialization

	public clone(): FlowBoard {
		const copy = new FlowBoard(this._tiles, this.nodes);
		for (const entry of Array.from(this._paths.entries())) {
			copy._paths.set(entry[0], entry[1].map((cell) => ({ row: cell.row, col: cell.col })));
		}
		return copy;
	}

	public toLevel(puzzleId: string, difficulty: number, colorCount: number): FlowLevel {
		return {
			puzzleId: puzzleId,
			difficulty: difficulty,
			tiles: cloneTiles(this._tiles),
			nodes: this.nodes.map(cloneNode),
			colorCount: colorCount,
		};
	}

	/**
	 * 디버그/2D 프로토타입용 덤프.
	 * 대문자 = 메인 오브젝트, 소문자 = 색을 받은 서브, `o` = 색 없는 서브, `.` = 타일 없음
	 */
	public toDebugString(): string {
		const symbols = new Map<EFlowColor, string>();
		let index = 0;
		const letters = 'ABCDEFGH';
		for (const color of Array.from(this._paths.keys())) {
			symbols.set(color, letters.charAt(index % letters.length));
			index++;
		}

		const rows: string[] = [];
		for (let row = 0; row < FLOW_GRID_SIZE; row++) {
			const cells: string[] = [];
			for (let col = 0; col < FLOW_GRID_SIZE; col++) {
				if (this.hasTile(row, col) === false) {
					cells.push('.');
					continue;
				}
				const node = this.getNode(row, col);
				if (node === undefined) {
					cells.push('?');
					continue;
				}
				if (node.kind === ENodeKind.MAIN) {
					cells.push(node.color === undefined ? '?' : (symbols.get(node.color) ?? '?'));
					continue;
				}
				if (node.color === undefined) {
					cells.push('o');
					continue;
				}
				cells.push((symbols.get(node.color) ?? '?').toLowerCase());
			}
			rows.push(cells.join(' '));
		}
		return rows.join('\n');
	}

	//#endregion
}
