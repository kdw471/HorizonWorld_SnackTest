/**
 * Card Match Board - 포탈 타일 상태 머신 (PUZ_06)
 *
 * 사양 §3 게임 플로우 / §4 예외 처리 / §9.2~§9.4, §9.6 구현.
 *
 * 타일 상태 머신 (§9.2)
 *   HIDDEN -> REVEALED -> (MATCHED | HIDDEN),  별도로 BOMB_REVEALED
 *
 * 핵심 규칙
 *   - 한 번에 최대 2개까지 활성화 (§3.4)
 *   - 판정 연출 중에 세 번째 타일을 눌러도 된다. 그러면 직전 판정을 즉시 마무리하고
 *     새 선택으로 넘어간다 (§4 / §9.4)
 *   - 폭탄이 나오면 완료되지 않은 타일들의 오브젝트 배정을 섞고, 그 동안 입력과
 *     제한 시간을 모두 멈춘다 (§4 / §9.3)
 *   - 완료된 타일과 드러난 폭탄 타일은 재선택 불가 (§4)
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import {
	CardMatchLevel,
	CardTile,
	DEFAULT_BOMB_SHUFFLE_SECONDS,
	DEFAULT_MISMATCH_REVEAL_SECONDS,
	ERevealOutcome,
	ERevealRejection,
	ETileState,
	MAX_REVEALED_TILES,
	RandomSource,
	RevealResult,
	cloneTile,
	isTileLockedForever,
	shuffleInPlace,
} from 'CardMatch_Definitions';

export class CardMatchBoard {
	private readonly _tiles: CardTile[] = [];
	private readonly _rows: number;
	private readonly _cols: number;
	private readonly _random: RandomSource;

	private readonly _mismatchRevealSeconds: number;
	private readonly _bombShuffleSeconds: number;

	/** 지금 열려 있는 타일 index (최대 2개) */
	private _revealedIndexes: number[] = [];
	/** 짝이 틀려 되돌아가기를 기다리는 중이면 남은 시간 */
	private _pendingResolveSeconds: number = 0;
	private _hasPendingResolve: boolean = false;
	/** 폭탄 셔플 연출이 끝나기까지 남은 시간 */
	private _bombShuffleRemaining: number = 0;

	public get tiles(): readonly CardTile[] {
		return this._tiles;
	}

	public get rows(): number {
		return this._rows;
	}

	public get cols(): number {
		return this._cols;
	}

	public get revealedIndexes(): readonly number[] {
		return this._revealedIndexes;
	}

	/** 폭탄 셔플 중에는 유저가 상호작용할 수 없다 - §4 */
	public get isInputLocked(): boolean {
		return this._bombShuffleRemaining > 0;
	}

	/** 폭탄 셔플 중에는 제한 시간이 멈춘다 - §4 */
	public get isTimerPaused(): boolean {
		return this._bombShuffleRemaining > 0;
	}

	/** 짝 판정 연출이 진행 중인지 */
	public get hasPendingResolve(): boolean {
		return this._hasPendingResolve;
	}

	constructor(rows: number, cols: number, tiles: CardTile[], random: RandomSource, mismatchRevealSeconds: number = DEFAULT_MISMATCH_REVEAL_SECONDS, bombShuffleSeconds: number = DEFAULT_BOMB_SHUFFLE_SECONDS) {
		this._rows = rows;
		this._cols = cols;
		this._random = random;
		this._mismatchRevealSeconds = Math.max(0, mismatchRevealSeconds);
		this._bombShuffleSeconds = Math.max(0, bombShuffleSeconds);
		this._tiles = tiles.map(cloneTile);
	}

	public static fromLevel(level: CardMatchLevel, random: RandomSource): CardMatchBoard {
		return new CardMatchBoard(
			level.rows,
			level.cols,
			level.tiles.map(cloneTile),
			random,
			level.mismatchRevealSeconds,
			level.bombShuffleSeconds);
	}

	//#region Lookup

	public getTile(index: number): CardTile | undefined {
		if (index < 0 || index >= this._tiles.length) {
			return undefined;
		}
		return this._tiles[index];
	}

	public getTileAt(row: number, col: number): CardTile | undefined {
		if (row < 0 || row >= this._rows || col < 0 || col >= this._cols) {
			return undefined;
		}
		return this.getTile(row * this._cols + col);
	}

	/** 아직 맞추지 못한 오브젝트 타일 수 (폭탄 제외) */
	public getRemainingObjectTileCount(): number {
		let count = 0;
		for (const tile of this._tiles) {
			if (tile.isBomb === false && tile.state !== ETileState.MATCHED) {
				count++;
			}
		}
		return count;
	}

	/**
	 * 클리어 판정 - §2 / §9.6.
	 * "폭탄이 아닌 모든 타일이 MATCHED" 이면 클리어.
	 * 마지막에 남은 타일이 폭탄뿐인 상황도 클리어다.
	 */
	public isSolved(): boolean {
		let objectTileCount = 0;
		for (const tile of this._tiles) {
			if (tile.isBomb) {
				continue;
			}
			objectTileCount++;
			if (tile.state !== ETileState.MATCHED) {
				return false;
			}
		}
		return objectTileCount > 0;
	}

	//#endregion

	//#region Reveal (§3 / §4 / §9.4)

	/**
	 * 포탈 타일을 활성화한다.
	 *
	 * 판정 연출 중에 눌러도 받아 준다. 그때는 직전 판정을 **즉시 마무리하고** 새 선택으로 넘어간다.
	 * 사양 §4 의 "하나의 포탈 타일을 활성화하는 중에 두 번째 포탈을 활성화하는 것도 가능함" 과
	 * §9.4 의 요구를 함께 만족시킨다.
	 */
	public reveal(index: number): RevealResult {
		const rejected = (rejection: ERevealRejection): RevealResult => ({
			outcome: ERevealOutcome.REJECTED,
			rejection: rejection,
			tileIndex: index,
			matchedTileIndexes: [],
			mismatchedTileIndexes: [],
			shuffledTileIndexes: [],
			didResolvePending: false,
		});

		// §4 - 폭탄이 활성화된 동안에는 조작이 불가하다
		if (this.isInputLocked) {
			return rejected(ERevealRejection.LOCKED_BY_BOMB);
		}

		const tile = this.getTile(index);
		if (tile === undefined) {
			return rejected(ERevealRejection.INVALID_INDEX);
		}
		if (tile.state === ETileState.MATCHED) {
			return rejected(ERevealRejection.ALREADY_MATCHED);
		}
		if (tile.state === ETileState.BOMB_REVEALED) {
			return rejected(ERevealRejection.ALREADY_BOMB);
		}
		if (this._revealedIndexes.indexOf(index) >= 0) {
			return rejected(ERevealRejection.ALREADY_REVEALED);
		}

		// 직전 판정이 아직 연출 중이면 즉시 마무리한다 - §9.4
		let didResolvePending = false;
		if (this._hasPendingResolve) {
			this.resolvePending();
			didResolvePending = true;
		}

		// 이미 2개가 열려 있으면 (판정 대기가 아닌 경우) 먼저 정리한다
		if (this._revealedIndexes.length >= MAX_REVEALED_TILES) {
			this.hideRevealed();
		}

		// 폭탄이면 셔플 - §3.3
		if (tile.isBomb) {
			tile.state = ETileState.BOMB_REVEALED;
			this.hideRevealed();
			const shuffled = this.shuffleUnmatchedObjects();
			this._bombShuffleRemaining = this._bombShuffleSeconds;

			return {
				outcome: ERevealOutcome.BOMB,
				rejection: ERevealRejection.NONE,
				tileIndex: index,
				matchedTileIndexes: [],
				mismatchedTileIndexes: [],
				shuffledTileIndexes: shuffled,
				didResolvePending: didResolvePending,
			};
		}

		tile.state = ETileState.REVEALED;
		this._revealedIndexes.push(index);

		if (this._revealedIndexes.length < MAX_REVEALED_TILES) {
			return {
				outcome: ERevealOutcome.FIRST_REVEALED,
				rejection: ERevealRejection.NONE,
				tileIndex: index,
				matchedTileIndexes: [],
				mismatchedTileIndexes: [],
				shuffledTileIndexes: [],
				didResolvePending: didResolvePending,
			};
		}

		// 두 번째 타일이 열렸다 - 결과를 결정한다 (§3.5)
		const first = this.getTile(this._revealedIndexes[0]);
		const second = this.getTile(this._revealedIndexes[1]);
		if (first === undefined || second === undefined) {
			return rejected(ERevealRejection.INVALID_INDEX);
		}

		if (first.objectId !== undefined && first.objectId === second.objectId) {
			const matched = this._revealedIndexes.slice();
			first.state = ETileState.MATCHED;
			second.state = ETileState.MATCHED;
			this._revealedIndexes = [];

			return {
				outcome: ERevealOutcome.MATCHED,
				rejection: ERevealRejection.NONE,
				tileIndex: index,
				matchedTileIndexes: matched,
				mismatchedTileIndexes: [],
				shuffledTileIndexes: [],
				didResolvePending: didResolvePending,
			};
		}

		// 짝이 틀렸다 - 잠시 보여 준 뒤 되돌아간다
		this._hasPendingResolve = true;
		this._pendingResolveSeconds = this._mismatchRevealSeconds;

		return {
			outcome: ERevealOutcome.MISMATCHED,
			rejection: ERevealRejection.NONE,
			tileIndex: index,
			matchedTileIndexes: [],
			mismatchedTileIndexes: this._revealedIndexes.slice(),
			shuffledTileIndexes: [],
			didResolvePending: didResolvePending,
		};
	}

	//#endregion

	//#region Update

	/**
	 * 판정 연출과 폭탄 셔플 타이머를 진행시킨다.
	 * 되돌아간 타일 index 를 돌려준다 (없으면 빈 배열).
	 */
	public update(deltaSeconds: number): { hiddenTileIndexes: number[], didFinishBombShuffle: boolean } {
		let didFinishBombShuffle = false;

		if (this._bombShuffleRemaining > 0) {
			this._bombShuffleRemaining -= deltaSeconds;
			if (this._bombShuffleRemaining <= 0) {
				this._bombShuffleRemaining = 0;
				didFinishBombShuffle = true;
			}
			// 셔플 중에는 판정 연출도 진행하지 않는다
			return { hiddenTileIndexes: [], didFinishBombShuffle: didFinishBombShuffle };
		}

		if (this._hasPendingResolve === false) {
			return { hiddenTileIndexes: [], didFinishBombShuffle: false };
		}

		this._pendingResolveSeconds -= deltaSeconds;
		if (this._pendingResolveSeconds > 0) {
			return { hiddenTileIndexes: [], didFinishBombShuffle: false };
		}

		const hidden = this._revealedIndexes.slice();
		this.resolvePending();
		return { hiddenTileIndexes: hidden, didFinishBombShuffle: false };
	}

	/** 대기 중인 판정을 즉시 마무리한다 (틀린 짝을 되돌린다) */
	public resolvePending(): void {
		this._hasPendingResolve = false;
		this._pendingResolveSeconds = 0;
		this.hideRevealed();
	}

	/** 폭탄 셔플 연출을 즉시 끝낸다 (라운드 전환 등) */
	public flushBombShuffle(): void {
		this._bombShuffleRemaining = 0;
	}

	//#endregion

	//#region Internal

	/** 열려 있던 타일들을 뒷면으로 되돌린다 */
	private hideRevealed(): void {
		for (const revealedIndex of this._revealedIndexes) {
			const tile = this.getTile(revealedIndex);
			if (tile !== undefined && tile.state === ETileState.REVEALED) {
				tile.state = ETileState.HIDDEN;
			}
		}
		this._revealedIndexes = [];
	}

	/**
	 * 완료되지 않은 타일들의 오브젝트 배정을 섞는다 - §3.3 / §9.3.
	 * 완료(MATCHED)된 타일과 이미 드러난 폭탄 타일은 건드리지 않는다.
	 */
	private shuffleUnmatchedObjects(): number[] {
		const targets: CardTile[] = [];
		for (const tile of this._tiles) {
			if (isTileLockedForever(tile)) {
				continue;
			}
			targets.push(tile);
		}
		if (targets.length <= 1) {
			return [];
		}

		// 오브젝트 배정과 폭탄 여부를 함께 섞는다 - §8 "Bomb와 Object의 위치는 랜덤으로 변환된다"
		const payloads = targets.map((tile) => ({ objectId: tile.objectId, isBomb: tile.isBomb }));
		shuffleInPlace(this._random, payloads);

		const shuffled: number[] = [];
		for (let index = 0; index < targets.length; index++) {
			targets[index].objectId = payloads[index].objectId;
			targets[index].isBomb = payloads[index].isBomb;
			targets[index].state = ETileState.HIDDEN;
			shuffled.push(targets[index].index);
		}
		return shuffled;
	}

	//#endregion

	//#region Serialization

	public toLevel(puzzleId: string, difficulty: number): CardMatchLevel {
		let bombCount = 0;
		for (const tile of this._tiles) {
			if (tile.isBomb) {
				bombCount++;
			}
		}

		return {
			puzzleId: puzzleId,
			difficulty: difficulty,
			rows: this._rows,
			cols: this._cols,
			tiles: this._tiles.map(cloneTile),
			bombCount: bombCount,
			objectTileCount: this._tiles.length - bombCount,
			mismatchRevealSeconds: this._mismatchRevealSeconds,
			bombShuffleSeconds: this._bombShuffleSeconds,
		};
	}

	/** 디버그용 격자 덤프. `#` 뒷면 / `*` 폭탄(드러남) / `o` 완료 / 그 외는 오브젝트 id 첫 글자 */
	public toDebugString(): string {
		const rows: string[] = [];
		for (let row = 0; row < this._rows; row++) {
			const cells: string[] = [];
			for (let col = 0; col < this._cols; col++) {
				const tile = this.getTileAt(row, col);
				if (tile === undefined) {
					cells.push(' ');
					continue;
				}
				switch (tile.state) {
					case ETileState.MATCHED:
						cells.push('o');
						break;
					case ETileState.BOMB_REVEALED:
						cells.push('*');
						break;
					case ETileState.REVEALED:
						cells.push(tile.isBomb ? '!' : (tile.objectId ?? '?').charAt((tile.objectId ?? '?').length - 1));
						break;
					default:
						cells.push('#');
						break;
				}
			}
			rows.push(cells.join(' '));
		}
		return rows.join('\n');
	}

	//#endregion
}
