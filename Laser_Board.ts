/**
 * Laser Board - 5x5 배치 영역 + 테두리 기믹의 순수 상태 머신 (PUZ_01)
 *
 * 사양 §2 / §5:
 *   - 크리스탈 배치 영역은 5×5 고정
 *   - 주변 1칸 테두리는 발사체/수신체 전용이며 플레이어가 이용할 수 없다
 *   - 중계체와 해골은 5×5 영역 안에 배치된다 (§2 필드 도식)
 *   - 크리스탈은 배치 후 방향을 전환할 수 없다 (§3 3.4)
 *   - 크리스탈을 모두 사용하지 않아도 클리어 가능하다 (§3 3.3)
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import {
	ECrystalType,
	EGimmickType,
	LASER_PLACEMENT_GRID_SIZE,
	LaserCrystal,
	LaserGimmick,
	LaserLevel,
	LaserPlacedCrystal,
	cloneCrystal,
	cloneGimmick,
	clonePlacedCrystal,
	isBorderCell,
	isInsidePlacementArea,
	toFullGridIndex,
	toPlacementLocalIndex,
} from 'Laser_Definitions';

/** 크리스탈 배치 시도 결과 */
export type LaserPlacementResult = {
	isPlaced: boolean,
	reason?: string,
}

export class LaserBoard {
	private readonly _gimmicks: LaserGimmick[] = [];
	private readonly _gimmickByCell = new Map<string, LaserGimmick>();

	private readonly _placedCrystals: LaserPlacedCrystal[] = [];
	private readonly _crystalByCell = new Map<string, LaserPlacedCrystal>();

	private _inventory: LaserCrystal[] = [];

	public get gimmicks(): readonly LaserGimmick[] {
		return this._gimmicks;
	}

	public get placedCrystals(): readonly LaserPlacedCrystal[] {
		return this._placedCrystals;
	}

	/** 아직 필드에 놓지 않은 크리스탈 - 인벤토리 슬롯에 표시된다 (§2) */
	public get inventory(): readonly LaserCrystal[] {
		return this._inventory;
	}

	public get emitters(): LaserGimmick[] {
		return this._gimmicks.filter((gimmick) => gimmick.type === EGimmickType.EMITTER);
	}

	public get receivers(): LaserGimmick[] {
		return this._gimmicks.filter((gimmick) => gimmick.type === EGimmickType.RECEIVER);
	}

	public get relays(): LaserGimmick[] {
		return this._gimmicks.filter((gimmick) => gimmick.type === EGimmickType.RELAY);
	}

	constructor(gimmicks: LaserGimmick[] = [], presetCrystals: LaserPlacedCrystal[] = [], inventory: LaserCrystal[] = []) {
		for (const gimmick of gimmicks) {
			this.addGimmick(gimmick);
		}
		for (const crystal of presetCrystals) {
			this.addPresetCrystal(crystal);
		}
		this._inventory = inventory.map(cloneCrystal);
	}

	public static fromLevel(level: LaserLevel): LaserBoard {
		return new LaserBoard(
			level.gimmicks.map(cloneGimmick),
			level.presetCrystals.map(clonePlacedCrystal),
			level.inventory.map(cloneCrystal));
	}

	//#region Lookup

	/** 전체 그리드 좌표의 기믹 */
	public getGimmickAt(fullRow: number, fullCol: number): LaserGimmick | undefined {
		return this._gimmickByCell.get(`${fullRow},${fullCol}`);
	}

	/** 배치 로컬 좌표의 크리스탈 */
	public getCrystalAt(localRow: number, localCol: number): LaserPlacedCrystal | undefined {
		return this._crystalByCell.get(`${localRow},${localCol}`);
	}

	/** 전체 그리드 좌표로 크리스탈을 찾는다 (광선 추적용) */
	public getCrystalAtFullGrid(fullRow: number, fullCol: number): LaserCrystal | undefined {
		const localRow = toPlacementLocalIndex(fullRow);
		const localCol = toPlacementLocalIndex(fullCol);
		if (isInsidePlacementArea(localRow, localCol) === false) {
			return undefined;
		}

		const placed = this.getCrystalAt(localRow, localCol);
		if (placed !== undefined) {
			return placed;
		}

		// 테두리가 아닌 곳에 놓인 고정 크리스탈 기믹도 크리스탈로 취급한다 (§4.3)
		const gimmick = this.getGimmickAt(fullRow, fullCol);
		if (gimmick !== undefined && gimmick.type === EGimmickType.FIXED_CRYSTAL) {
			return gimmick.crystal;
		}
		return undefined;
	}

	//#endregion

	//#region Placement (§3 3.2 / 3.3 / 3.4, §5.1)

	/**
	 * 인벤토리의 크리스탈을 배치 영역에 놓는다.
	 * 방향은 이 시점에 확정되며 이후 바꿀 수 없다 (§3 3.4).
	 */
	public placeFromInventory(crystalId: string, localRow: number, localCol: number): LaserPlacementResult {
		const index = this._inventory.findIndex((crystal) => crystal.id === crystalId);
		if (index < 0) {
			return { isPlaced: false, reason: 'not-in-inventory' };
		}

		const check = this.canPlaceAt(localRow, localCol);
		if (check.isPlaced === false) {
			return check;
		}

		const crystal = this._inventory[index];
		this._inventory.splice(index, 1);

		const placed: LaserPlacedCrystal = {
			id: crystal.id,
			type: crystal.type,
			corner: crystal.corner,
			blockedSide: crystal.blockedSide,
			row: localRow,
			col: localCol,
			isFixed: false,
		};
		this._placedCrystals.push(placed);
		this._crystalByCell.set(`${localRow},${localCol}`, placed);
		return { isPlaced: true };
	}

	/** 해당 칸에 크리스탈을 놓을 수 있는지 - §5.1 */
	public canPlaceAt(localRow: number, localCol: number): LaserPlacementResult {
		if (isInsidePlacementArea(localRow, localCol) === false) {
			// 테두리는 발사체/수신체 전용이라 플레이어가 이용할 수 없다
			return { isPlaced: false, reason: 'outside-placement-area' };
		}
		if (this.getCrystalAt(localRow, localCol) !== undefined) {
			return { isPlaced: false, reason: 'cell-occupied-by-crystal' };
		}

		const gimmick = this.getGimmickAt(toFullGridIndex(localRow), toFullGridIndex(localCol));
		if (gimmick !== undefined) {
			// 중계체 / 해골 / 고정 크리스탈이 놓인 칸
			return { isPlaced: false, reason: 'cell-occupied-by-gimmick' };
		}
		return { isPlaced: true };
	}

	/**
	 * 놓았던 크리스탈을 회수해 인벤토리로 되돌린다.
	 * 고정 크리스탈은 회수할 수 없다 (§4.3).
	 */
	public pickUp(localRow: number, localCol: number): LaserCrystal | undefined {
		const placed = this.getCrystalAt(localRow, localCol);
		if (placed === undefined || placed.isFixed) {
			return undefined;
		}

		this._crystalByCell.delete(`${localRow},${localCol}`);
		this._placedCrystals.splice(this._placedCrystals.indexOf(placed), 1);

		const crystal = cloneCrystal(placed);
		this._inventory.push(crystal);
		return crystal;
	}

	/** 놓여 있던 크리스탈을 다른 칸으로 옮긴다 (드래그 이동) */
	public moveCrystal(fromRow: number, fromCol: number, toRow: number, toCol: number): LaserPlacementResult {
		const placed = this.getCrystalAt(fromRow, fromCol);
		if (placed === undefined) {
			return { isPlaced: false, reason: 'no-crystal-at-source' };
		}
		if (placed.isFixed) {
			return { isPlaced: false, reason: 'crystal-is-fixed' };
		}
		if (fromRow === toRow && fromCol === toCol) {
			return { isPlaced: true };
		}

		const check = this.canPlaceAt(toRow, toCol);
		if (check.isPlaced === false) {
			return check;
		}

		this._crystalByCell.delete(`${fromRow},${fromCol}`);
		placed.row = toRow;
		placed.col = toCol;
		this._crystalByCell.set(`${toRow},${toCol}`, placed);
		return { isPlaced: true };
	}

	/** 놓여 있는 크리스탈을 모두 회수한다 (리셋) */
	public pickUpAll(): void {
		for (const placed of this._placedCrystals.slice()) {
			this.pickUp(placed.row, placed.col);
		}
	}

	//#endregion

	//#region Construction helpers

	public addGimmick(gimmick: LaserGimmick): boolean {
		const key = `${gimmick.row},${gimmick.col}`;
		if (this._gimmickByCell.has(key)) {
			console.warn(`[LaserBoard] Cell ${key} already has a gimmick`);
			return false;
		}

		// 발사체와 수신체는 테두리에만, 중계체/해골/고정 크리스탈은 배치 영역 안에만 놓인다 (§2 도식)
		const mustBeOnBorder = gimmick.type === EGimmickType.EMITTER || gimmick.type === EGimmickType.RECEIVER;
		if (mustBeOnBorder && isBorderCell(gimmick.row, gimmick.col) === false) {
			console.warn(`[LaserBoard] ${gimmick.type} '${gimmick.id}' must be on the border ring`);
			return false;
		}
		if (mustBeOnBorder === false && isBorderCell(gimmick.row, gimmick.col)) {
			console.warn(`[LaserBoard] ${gimmick.type} '${gimmick.id}' must be inside the placement area`);
			return false;
		}

		this._gimmicks.push(gimmick);
		this._gimmickByCell.set(key, gimmick);
		return true;
	}

	private addPresetCrystal(crystal: LaserPlacedCrystal): boolean {
		if (isInsidePlacementArea(crystal.row, crystal.col) === false) {
			return false;
		}
		const key = `${crystal.row},${crystal.col}`;
		if (this._crystalByCell.has(key)) {
			return false;
		}
		this._placedCrystals.push(crystal);
		this._crystalByCell.set(key, crystal);
		return true;
	}

	//#endregion

	//#region Serialization

	public clone(): LaserBoard {
		return new LaserBoard(
			this._gimmicks.map(cloneGimmick),
			this._placedCrystals.map(clonePlacedCrystal),
			this._inventory.map(cloneCrystal));
	}

	public toLevel(puzzleId: string, difficulty: number): LaserLevel {
		return {
			puzzleId: puzzleId,
			difficulty: difficulty,
			gimmicks: this._gimmicks.map(cloneGimmick),
			presetCrystals: this._placedCrystals.map(clonePlacedCrystal),
			inventory: this._inventory.map(cloneCrystal),
		};
	}

	/** 디버그/2D 프로토타입용 격자 덤프 (전체 7x7) */
	public toDebugString(): string {
		const symbols: { [key: string]: string } = {
			[EGimmickType.EMITTER]: 'E',
			[EGimmickType.RECEIVER]: 'R',
			[EGimmickType.RELAY]: 'M',
			[EGimmickType.SKULL]: 'X',
			[EGimmickType.FIXED_CRYSTAL]: '#',
		};
		const crystalSymbols: { [key: string]: string } = {
			[ECrystalType.TRIANGLE]: 't',
			[ECrystalType.OCTAGON]: 'o',
			[ECrystalType.CROSS]: '+',
			[ECrystalType.TEE]: 'T',
			[ECrystalType.FLOWER]: 'f',
		};

		const rows: string[] = [];
		for (let row = 0; row < LASER_PLACEMENT_GRID_SIZE + 2; row++) {
			const cells: string[] = [];
			for (let col = 0; col < LASER_PLACEMENT_GRID_SIZE + 2; col++) {
				const gimmick = this.getGimmickAt(row, col);
				if (gimmick !== undefined) {
					cells.push(symbols[gimmick.type] ?? '?');
					continue;
				}
				const crystal = this.getCrystalAtFullGrid(row, col);
				cells.push(crystal === undefined ? '.' : (crystalSymbols[crystal.type] ?? '?'));
			}
			rows.push(cells.join(' '));
		}
		return rows.join('\n');
	}

	//#endregion
}
