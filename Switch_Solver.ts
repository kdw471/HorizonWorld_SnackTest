/**
 * Switch Solver - GF(2) 선형대수 솔버 (PUZ_08 §9.4 선택 항목)
 *
 * Lights Out 계열은 다음 성질을 가진다.
 *   - 토글은 자기역원: 같은 칸을 두 번 누르면 상쇄된다
 *   - 누름 순서는 결과에 영향이 없다
 * 따라서 "어떤 칸들을 (홀수 번) 누를 것인가"만 정하면 되고,
 * 이는 GF(2) 위의 연립방정식 A·x = b 로 정확히 풀린다.
 *
 *   변수 x_j  : FREE 가 아닌 칸 j 를 누를지 (0/1)
 *   방정식 i  : 칸 i 를 반전시키는 누름들의 합 ≡ b_i (mod 2)
 *   b_i       : 칸 i 가 지금 안 눌림(0)이면 1 (반전 필요), 눌림(1)이면 0
 *
 * 가우스 소거로 해의 존재를 판정하고, 자유 변수가 적으면(≤16) 전수 열거로
 * **최소 누름 해**를 찾는다. 역셔플 생성기의 결과 검증과 난이도 실측에 쓴다.
 *
 * 구현 노트: 변수·방정식이 최대 25개이므로 행 하나를 32비트 정수 비트마스크로
 * 표현한다 (계수 25비트 + RHS 1비트).
 *
 * `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 */

import {
	ESwitchCellState,
	getToggledPositions,
	getUsablePositions,
} from 'Switch_Definitions';

export type SwitchSolution = {
	/** 해가 존재하는지 */
	isSolvable: boolean,
	/** 눌러야 하는 칸들 (순서 무관). 해가 없으면 빈 배열 */
	pressPositions: number[],
	/** pressPositions.length 와 같다 */
	pressCount: number,
	/** 자유 변수 전수 열거로 최소성이 보장되었는지. false 면 "어떤 해"일 뿐이다 */
	isMinimal: boolean,
}

/** 자유 변수가 이 수를 넘으면 최소 해 열거를 포기하고 특수해만 돌려준다 */
const MAX_FREE_VARIABLES_FOR_ENUMERATION = 16;

export class SwitchSolver {

	/**
	 * 현재 격자를 "모든 키 눌림" 상태로 만드는 누름 집합을 찾는다.
	 * 이미 완성 상태면 빈 해(0회)를 돌려준다.
	 */
	public solve(grid: readonly ESwitchCellState[], mask: readonly number[]): SwitchSolution {
		const usable = getUsablePositions(grid);
		const cellCount = usable.length;
		if (cellCount === 0) {
			return { isSolvable: true, pressPositions: [], pressCount: 0, isMinimal: true };
		}

		// 칸 위치 -> 변수 번호
		const varIndexByPosition = new Map<number, number>();
		for (let index = 0; index < usable.length; index++) {
			varIndexByPosition.set(usable[index], index);
		}

		// 방정식 구성: rows[i] = (계수 비트마스크) | (b_i << cellCount)
		// "칸 j 를 누르면 칸 i 가 반전된다" ⇔ i ∈ getToggledPositions(j)
		const rows: number[] = [];
		const rhsBit = 1 << cellCount;
		const coefficientByCell = new Array<number>(cellCount).fill(0);
		for (let j = 0; j < usable.length; j++) {
			for (const target of getToggledPositions(grid, mask, usable[j])) {
				const i = varIndexByPosition.get(target);
				if (i !== undefined) {
					coefficientByCell[i] |= (1 << j);
				}
			}
		}
		for (let i = 0; i < cellCount; i++) {
			const needsFlip = grid[usable[i]] === ESwitchCellState.UNPRESSED ? 1 : 0;
			rows.push(coefficientByCell[i] | (needsFlip === 1 ? rhsBit : 0));
		}

		// 가우스 소거 (전진 소거 + 피벗 기록)
		const pivotRowByColumn = new Array<number>(cellCount).fill(-1);
		let rank = 0;
		for (let column = 0; column < cellCount && rank < rows.length; column++) {
			let pivot = -1;
			for (let row = rank; row < rows.length; row++) {
				if ((rows[row] & (1 << column)) !== 0) {
					pivot = row;
					break;
				}
			}
			if (pivot < 0) {
				continue;
			}
			const swap = rows[rank];
			rows[rank] = rows[pivot];
			rows[pivot] = swap;
			for (let row = 0; row < rows.length; row++) {
				if (row !== rank && (rows[row] & (1 << column)) !== 0) {
					rows[row] ^= rows[rank];
				}
			}
			pivotRowByColumn[column] = rank;
			rank++;
		}

		// 모순 검사: 계수가 전부 0인데 RHS 가 1인 행이 있으면 해가 없다
		const coefficientMask = rhsBit - 1;
		for (let row = rank; row < rows.length; row++) {
			if ((rows[row] & coefficientMask) === 0 && (rows[row] & rhsBit) !== 0) {
				return { isSolvable: false, pressPositions: [], pressCount: 0, isMinimal: false };
			}
		}

		// 특수해: 자유 변수 = 0. 완전 소거된 상태이므로 피벗 열 값 = 해당 행의 RHS
		let particular = 0;
		for (let column = 0; column < cellCount; column++) {
			const pivotRow = pivotRowByColumn[column];
			if (pivotRow >= 0 && (rows[pivotRow] & rhsBit) !== 0) {
				particular |= (1 << column);
			}
		}

		// 커널 기저: 자유 변수 하나를 1로 두었을 때의 해 (RHS 없이 피벗 열만 채움)
		const freeColumns: number[] = [];
		for (let column = 0; column < cellCount; column++) {
			if (pivotRowByColumn[column] < 0) {
				freeColumns.push(column);
			}
		}
		const kernelBasis: number[] = [];
		for (const freeColumn of freeColumns) {
			let vector = 1 << freeColumn;
			for (let column = 0; column < cellCount; column++) {
				const pivotRow = pivotRowByColumn[column];
				if (pivotRow >= 0 && (rows[pivotRow] & (1 << freeColumn)) !== 0) {
					vector |= (1 << column);
				}
			}
			kernelBasis.push(vector);
		}

		// 최소 해: particular ⊕ (커널 기저의 부분합) 을 전수 열거
		let best = particular;
		let isMinimal = true;
		if (kernelBasis.length > 0) {
			if (kernelBasis.length <= MAX_FREE_VARIABLES_FOR_ENUMERATION) {
				let bestWeight = popCount(particular);
				const comboCount = 1 << kernelBasis.length;
				// Gray 코드 순회로 조합마다 XOR 1회만 쓴다
				let current = particular;
				for (let combo = 1; combo < comboCount; combo++) {
					const flippedBit = lowestSetBitIndex(combo);
					current ^= kernelBasis[flippedBit];
					const weight = popCount(current);
					if (weight < bestWeight) {
						bestWeight = weight;
						best = current;
					}
				}
			}
			else {
				isMinimal = false;
			}
		}

		const pressPositions: number[] = [];
		for (let index = 0; index < cellCount; index++) {
			if ((best & (1 << index)) !== 0) {
				pressPositions.push(usable[index]);
			}
		}
		return { isSolvable: true, pressPositions: pressPositions, pressCount: pressPositions.length, isMinimal: isMinimal };
	}

	/** 해의 존재 여부만 빠르게 확인한다 */
	public isSolvable(grid: readonly ESwitchCellState[], mask: readonly number[]): boolean {
		return this.solve(grid, mask).isSolvable;
	}
}

//#region Bit helpers

function popCount(value: number): number {
	let v = value;
	let count = 0;
	while (v !== 0) {
		v &= v - 1;
		count++;
	}
	return count;
}

/** 가장 낮은 1 비트의 인덱스 (value > 0 전제) */
function lowestSetBitIndex(value: number): number {
	let index = 0;
	let v = value;
	while ((v & 1) === 0) {
		v >>= 1;
		index++;
	}
	return index;
}

//#endregion
