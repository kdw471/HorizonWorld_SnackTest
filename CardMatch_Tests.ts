/**
 * Card Match Tests - PUZ_06 §9.7 "테스트" 항목
 *
 *   홀수 iObjectTile 데이터 거부 / 폭탄 셔플 중 입력·타이머 잠금 /
 *   완료 타일 재선택 차단 / 판정 연출 중 세 번째 타일 선택 /
 *   마지막 남은 타일이 폭탄일 때 클리어
 *
 * 여기에 더해 필드 생성 알고리즘(§9.1), 타일 상태 머신(§9.2), 리셋 무효화(§9.5) 를 검증한다.
 *
 * Horizon Component 가 아니라 순수 검증 하네스다. `runCardMatchTests()` 를 호출하면 결과를 돌려준다.
 */

import { CardMatchBoard } from 'CardMatch_Board';
import { CardMatchEvents } from 'CardMatch_GameEvents';
import { CardMatchLevelGenerator, describeCardMatchLevel } from 'CardMatch_LevelGenerator';
import { CardMatchSession } from 'CardMatch_Session';
import { CardFieldTableEntry, CardMatchTables, validateFieldData } from 'CardMatch_DataTables';
import {
	CardTile,
	ECardMatchState,
	ERevealOutcome,
	ERevealRejection,
	ETileState,
	createSeededRandom,
} from 'CardMatch_Definitions';

export type CardMatchTestResult = {
	name: string,
	isPassed: boolean,
	detail?: string,
}

export type CardMatchTestReport = {
	passed: number,
	failed: number,
	results: CardMatchTestResult[],
}

class TestRecorder {
	public readonly results: CardMatchTestResult[] = [];

	public check(name: string, condition: boolean, detail?: string): void {
		this.results.push({ name: name, isPassed: condition, detail: condition ? undefined : detail });
	}
}

export function runCardMatchTests(): CardMatchTestReport {
	const recorder = new TestRecorder();
	const tables = new CardMatchTables();

	testDataValidation(recorder, tables);
	testGeneration(recorder, tables);
	testTileStateMachine(recorder);
	testThirdTileDuringJudgement(recorder);
	testBombShuffle(recorder);
	testClearCondition(recorder);
	testSession(recorder, tables);

	let passed = 0;
	let failed = 0;
	for (const result of recorder.results) {
		if (result.isPassed) {
			passed++;
		}
		else {
			failed++;
		}
	}
	return { passed: passed, failed: failed, results: recorder.results };
}

//#region Helpers

/**
 * 오브젝트 배정을 직접 지정해 작은 보드를 만든다.
 * `'B'` 는 폭탄, 나머지 문자는 오브젝트 ID 다.
 */
function makeBoard(rows: number, cols: number, layout: string[], mismatchSeconds: number = 0.8, bombSeconds: number = 1.2): CardMatchBoard {
	const tiles: CardTile[] = [];
	for (let index = 0; index < rows * cols; index++) {
		const symbol = layout[index];
		tiles.push({
			index: index,
			row: Math.floor(index / cols),
			col: index % cols,
			state: ETileState.HIDDEN,
			objectId: symbol === 'B' ? undefined : symbol,
			isBomb: symbol === 'B',
		});
	}
	return new CardMatchBoard(rows, cols, tiles, createSeededRandom(12345), mismatchSeconds, bombSeconds);
}

//#endregion

//#region §9.1 데이터 검증

function testDataValidation(recorder: TestRecorder, tables: CardMatchTables): void {
	// 기본 테이블은 모두 유효해야 한다
	for (const field of tables.fieldTable) {
		const violations = validateFieldData(field, tables);
		recorder.check(`필드 데이터 index ${field.index} 유효`, violations.length === 0, violations.join(' / '));
	}

	// iObjectTile 이 홀수면 에러다 - §8 / §9.1
	{
		const badField: CardFieldTableEntry = {
			index: 999, puzzleId: 'BAD', difficulty: 1, objectGroupId: 'GROUP_CH1',
			tileArrayX: 3, tileArrayY: 3, bombTile: 2, objectTile: 7,
		};
		const violations = validateFieldData(badField, tables);
		recorder.check('홀수 iObjectTile 은 데이터 오류로 거부', violations.length > 0, violations.join(' / '));
		recorder.check('홀수 사유를 명시한다', violations.some((text) => text.indexOf('홀수') >= 0), violations.join(' / '));
	}

	// iObjectTile 값이 (X*Y - bomb) 와 다르면 에러다
	{
		const badField: CardFieldTableEntry = {
			index: 998, puzzleId: 'BAD2', difficulty: 1, objectGroupId: 'GROUP_CH1',
			tileArrayX: 3, tileArrayY: 3, bombTile: 1, objectTile: 6,
		};
		const violations = validateFieldData(badField, tables);
		recorder.check('iObjectTile 계산이 맞지 않으면 거부', violations.length > 0, violations.join(' / '));
	}

	// 오브젝트 풀이 부족하면 에러다
	{
		const badField: CardFieldTableEntry = {
			index: 997, puzzleId: 'BAD3', difficulty: 1, objectGroupId: 'GROUP_CH1',
			tileArrayX: 5, tileArrayY: 5, bombTile: 1, objectTile: 24,
		};
		const violations = validateFieldData(badField, tables);
		// GROUP_CH1 은 4종뿐인데 12종이 필요하다
		recorder.check('오브젝트 풀이 모자라면 거부', violations.length > 0, violations.join(' / '));
	}

	// 폭탄이 전체 타일 이상이면 에러다
	{
		const badField: CardFieldTableEntry = {
			index: 996, puzzleId: 'BAD4', difficulty: 1, objectGroupId: 'GROUP_CH1',
			tileArrayX: 2, tileArrayY: 2, bombTile: 4, objectTile: 0,
		};
		recorder.check('폭탄이 전체 타일 이상이면 거부', validateFieldData(badField, tables).length > 0);
	}
}

//#endregion

//#region §9.1 필드 생성

function testGeneration(recorder: TestRecorder, tables: CardMatchTables): void {
	const generator = new CardMatchLevelGenerator(tables);

	for (const config of tables.difficultyTable) {
		const generated = generator.generate({
			puzzleId: `TEST_CM_D${config.difficulty}`,
			difficulty: config.difficulty,
			seed: 30000 + config.difficulty,
		});

		if (generated === undefined) {
			recorder.check(`난이도 ${config.difficulty} 생성`, false, '생성 실패');
			continue;
		}

		const verification = generator.verify(generated);
		recorder.check(`난이도 ${config.difficulty} 생성 및 검증`, verification.isValid, verification.violations.join(' / '));

		// 모든 오브젝트가 정확히 2개씩 있어야 한다
		const counts = new Map<string, number>();
		let bombs = 0;
		for (const tile of generated.tiles) {
			if (tile.isBomb) {
				bombs++;
				continue;
			}
			counts.set(tile.objectId ?? '?', (counts.get(tile.objectId ?? '?') ?? 0) + 1);
		}
		let allPairs = true;
		for (const entry of Array.from(counts.entries())) {
			if (entry[1] !== 2) {
				allPairs = false;
			}
		}
		recorder.check(`난이도 ${config.difficulty} 모든 오브젝트가 2개씩`, allPairs, describeCardMatchLevel(generated));
		recorder.check(`난이도 ${config.difficulty} 폭탄 수 일치`, bombs === generated.bombCount, `${bombs} != ${generated.bombCount}`);
		recorder.check(`난이도 ${config.difficulty} 오브젝트 타일 수가 짝수`, (generated.tiles.length - bombs) % 2 === 0);
	}

	// 홀수 데이터를 넣으면 생성 자체를 거부한다
	{
		const badTables = new CardMatchTables();
		badTables.loadFieldTable([{
			index: 1, puzzleId: 'BAD', difficulty: 1, objectGroupId: 'GROUP_CH1',
			tileArrayX: 3, tileArrayY: 3, bombTile: 2, objectTile: 7,
		}]);
		const badGenerator = new CardMatchLevelGenerator(badTables);
		recorder.check('홀수 데이터로는 레벨을 만들지 않는다',
			badGenerator.generate({ difficulty: 1, seed: 1, fieldIndex: 1 }) === undefined);
	}

	const first = generator.generate({ puzzleId: 'SEEDED', difficulty: 4, seed: 424 });
	const second = generator.generate({ puzzleId: 'SEEDED', difficulty: 4, seed: 424 });
	recorder.check('같은 시드는 같은 레벨을 만든다', JSON.stringify(first) === JSON.stringify(second));
}

//#endregion

//#region §9.2 타일 상태 머신

function testTileStateMachine(recorder: TestRecorder): void {
	// HIDDEN -> REVEALED -> MATCHED
	{
		const board = makeBoard(2, 2, ['a', 'a', 'b', 'b']);
		recorder.check('시작 시 모두 뒷면', board.tiles.every((tile) => tile.state === ETileState.HIDDEN));

		const first = board.reveal(0);
		recorder.check('첫 타일이 열린다', first.outcome === ERevealOutcome.FIRST_REVEALED);
		recorder.check('열린 타일은 REVEALED', board.getTile(0)?.state === ETileState.REVEALED);

		const second = board.reveal(1);
		recorder.check('같은 오브젝트면 짝이 맞는다', second.outcome === ERevealOutcome.MATCHED);
		recorder.check('맞은 타일은 MATCHED', board.getTile(0)?.state === ETileState.MATCHED && board.getTile(1)?.state === ETileState.MATCHED);
		recorder.check('맞은 타일 목록을 알려준다', second.matchedTileIndexes.join(',') === '0,1');
	}

	// HIDDEN -> REVEALED -> HIDDEN (짝이 틀림)
	{
		const board = makeBoard(2, 2, ['a', 'b', 'a', 'b']);
		board.reveal(0);
		const second = board.reveal(1);
		recorder.check('다른 오브젝트면 짝이 틀린다', second.outcome === ERevealOutcome.MISMATCHED);
		recorder.check('판정 연출이 진행 중', board.hasPendingResolve);
		recorder.check('아직은 열린 채로 남는다', board.getTile(0)?.state === ETileState.REVEALED);

		const progressed = board.update(1.0);
		recorder.check('연출이 끝나면 되돌아간다', progressed.hiddenTileIndexes.length === 2, JSON.stringify(progressed));
		recorder.check('되돌아간 타일은 HIDDEN', board.getTile(0)?.state === ETileState.HIDDEN && board.getTile(1)?.state === ETileState.HIDDEN);
	}

	// 완료 타일 재선택 차단 - §4
	{
		const board = makeBoard(2, 2, ['a', 'a', 'b', 'b']);
		board.reveal(0);
		board.reveal(1);
		const again = board.reveal(0);
		recorder.check('완료된 타일은 다시 고를 수 없다', again.outcome === ERevealOutcome.REJECTED && again.rejection === ERevealRejection.ALREADY_MATCHED);
	}

	// 지금 열려 있는 타일 재선택 차단
	{
		const board = makeBoard(2, 2, ['a', 'b', 'a', 'b']);
		board.reveal(0);
		const again = board.reveal(0);
		recorder.check('열려 있는 타일을 또 누를 수 없다', again.rejection === ERevealRejection.ALREADY_REVEALED);
	}

	// 잘못된 index
	{
		const board = makeBoard(2, 2, ['a', 'a', 'b', 'b']);
		recorder.check('범위 밖 index 는 거절', board.reveal(99).rejection === ERevealRejection.INVALID_INDEX);
	}
}

//#endregion

//#region §9.4 판정 연출 중 세 번째 타일

function testThirdTileDuringJudgement(recorder: TestRecorder): void {
	const board = makeBoard(2, 3, ['a', 'b', 'c', 'a', 'b', 'c']);

	board.reveal(0);
	const second = board.reveal(1);
	recorder.check('짝이 틀려 판정 연출 시작', second.outcome === ERevealOutcome.MISMATCHED && board.hasPendingResolve);

	// §4 / §9.4 - 판정 연출 중에도 새로운 오브젝트를 활성화할 수 있다
	const third = board.reveal(2);
	recorder.check('연출 중 세 번째 타일을 고를 수 있다', third.outcome === ERevealOutcome.FIRST_REVEALED, JSON.stringify(third));
	recorder.check('직전 판정이 즉시 마무리되었다', third.didResolvePending);
	recorder.check('앞선 두 타일은 뒷면으로 돌아갔다',
		board.getTile(0)?.state === ETileState.HIDDEN && board.getTile(1)?.state === ETileState.HIDDEN);
	recorder.check('세 번째 타일만 열려 있다', board.revealedIndexes.length === 1 && board.revealedIndexes[0] === 2);

	// 이어서 짝을 맞출 수 있다
	const fourth = board.reveal(5);
	recorder.check('이어서 짝을 맞출 수 있다', fourth.outcome === ERevealOutcome.MATCHED, JSON.stringify(fourth));
}

//#endregion

//#region §3.3 / §4 폭탄 셔플

function testBombShuffle(recorder: TestRecorder): void {
	// 폭탄을 열면 셔플되고 입력/타이머가 잠긴다
	{
		const board = makeBoard(2, 3, ['a', 'a', 'B', 'b', 'b', 'c'], 0.8, 1.2);
		const result = board.reveal(2);
		recorder.check('폭탄을 열면 BOMB 결과', result.outcome === ERevealOutcome.BOMB);
		recorder.check('폭탄 타일은 BOMB_REVEALED 로 비활성화', board.getTile(2)?.state === ETileState.BOMB_REVEALED);
		recorder.check('셔플된 타일 목록을 알려준다', result.shuffledTileIndexes.length > 0);

		// §4 - 셔플이 끝날 때까지 입력 불가 + 제한 시간 일시 정지
		recorder.check('셔플 중 입력 잠금', board.isInputLocked);
		recorder.check('셔플 중 타이머 정지', board.isTimerPaused);
		recorder.check('셔플 중 타일 선택은 거절', board.reveal(0).rejection === ERevealRejection.LOCKED_BY_BOMB);

		board.update(0.5);
		recorder.check('셔플 중간에도 여전히 잠금', board.isInputLocked);

		const progressed = board.update(0.8);
		recorder.check('셔플이 끝나면 알린다', progressed.didFinishBombShuffle);
		recorder.check('셔플이 끝나면 잠금 해제', board.isInputLocked === false && board.isTimerPaused === false);
		recorder.check('셔플 후에는 다시 고를 수 있다', board.reveal(0).outcome === ERevealOutcome.FIRST_REVEALED);
	}

	// 완료된 타일은 셔플에서 제외된다 - §9.3
	{
		const board = makeBoard(2, 3, ['a', 'a', 'B', 'b', 'b', 'c'], 0.8, 1.2);
		board.reveal(0);
		board.reveal(1);
		recorder.check('먼저 짝을 맞춰 둔다', board.getTile(0)?.state === ETileState.MATCHED);

		const beforeObject = board.getTile(0)?.objectId;
		board.reveal(2);
		recorder.check('완료된 타일의 오브젝트는 그대로', board.getTile(0)?.objectId === beforeObject);
		recorder.check('완료된 타일은 여전히 MATCHED', board.getTile(0)?.state === ETileState.MATCHED);
	}

	// 이미 드러난 폭탄 타일은 다시 고를 수 없다
	{
		const board = makeBoard(2, 2, ['a', 'a', 'B', 'B'], 0.8, 0);
		board.reveal(2);
		board.update(0.1);
		recorder.check('드러난 폭탄은 재선택 불가', board.reveal(2).rejection === ERevealRejection.ALREADY_BOMB);
	}
}

//#endregion

//#region §2 / §9.6 클리어 판정

function testClearCondition(recorder: TestRecorder): void {
	// 폭탄이 아닌 모든 타일을 맞추면 클리어. 마지막 남은 타일이 폭탄이어도 클리어다.
	{
		const board = makeBoard(1, 3, ['a', 'a', 'B']);
		recorder.check('시작 시 미클리어', board.isSolved() === false);

		board.reveal(0);
		board.reveal(1);
		recorder.check('폭탄만 남으면 클리어', board.isSolved());
		recorder.check('남은 오브젝트 타일 0개', board.getRemainingObjectTileCount() === 0);
	}

	// 오브젝트가 남아 있으면 클리어가 아니다
	{
		const board = makeBoard(2, 2, ['a', 'a', 'b', 'b']);
		board.reveal(0);
		board.reveal(1);
		recorder.check('한 쌍만 맞추면 아직 미클리어', board.isSolved() === false);
		recorder.check('남은 오브젝트 타일 2개', board.getRemainingObjectTileCount() === 2);

		board.reveal(2);
		board.reveal(3);
		recorder.check('모두 맞추면 클리어', board.isSolved());
	}
}

//#endregion

//#region 세션

function testSession(recorder: TestRecorder, tables: CardMatchTables): void {
	const generator = new CardMatchLevelGenerator(tables);

	// 클리어 흐름 - 모든 짝을 알고 있다고 가정하고 맞춰 나간다
	{
		const events = new CardMatchEvents();
		let didClear = false;
		let bombCount = 0;
		events.QUEST_CLEAR.subscribe(() => { didClear = true; });
		events.BOMB_TRIGGERED.subscribe(() => { bombCount++; });

		const session = new CardMatchSession(events, tables, generator, { seed: 30001 });
		recorder.check('퀘스트 시작', session.startQuest('QUEST_CARDMATCH_D1'));
		recorder.check('입력 대기 상태로 진입', session.state === ECardMatchState.PLAYER_INPUT, session.state);
		recorder.check('제한시간이 테이블에서 적용됨', session.getRemainingTimeSeconds() === 90);

		const progress = session.getRoundProgress();
		recorder.check('라운드 진행도 조회', progress.current === 1 && progress.total === 1);

		// 매 프레임 보드를 보고 짝을 찾아 맞춘다 (폭탄은 피한다)
		let guard = 0;
		while (session.state === ECardMatchState.PLAYER_INPUT && guard < 500) {
			guard++;
			const board = session.board;
			if (board === undefined) {
				break;
			}
			if (board.isInputLocked) {
				session.update(0.1);
				continue;
			}

			// 아직 안 맞춘 오브젝트 타일들 중 같은 objectId 쌍을 찾는다
			const byObject = new Map<string, number[]>();
			for (const tile of board.tiles) {
				if (tile.isBomb || tile.state === ETileState.MATCHED || tile.objectId === undefined) {
					continue;
				}
				const list = byObject.get(tile.objectId) ?? [];
				list.push(tile.index);
				byObject.set(tile.objectId, list);
			}

			let didPlay = false;
			for (const entry of Array.from(byObject.entries())) {
				if (entry[1].length >= 2) {
					session.revealTile(entry[1][0]);
					session.revealTile(entry[1][1]);
					didPlay = true;
					break;
				}
			}
			if (didPlay === false) {
				break;
			}
			session.update(0.05);
		}

		recorder.check('짝을 모두 맞추면 클리어된다', session.state === ECardMatchState.QUEST_CLEAR, `${session.state} guard=${guard}`);
		recorder.check('QUEST_CLEAR 이벤트 발행', didClear);
	}

	// 제한 시간 초과
	{
		const events = new CardMatchEvents();
		let didFail = false;
		events.QUEST_FAILED.subscribe(() => { didFail = true; });

		const session = new CardMatchSession(events, tables, generator, { seed: 30002 });
		session.startQuest('QUEST_CARDMATCH_D1');
		session.update(89);
		recorder.check('제한시간 전에는 계속 진행', session.state === ECardMatchState.PLAYER_INPUT);
		session.update(2);
		recorder.check('제한시간 초과 시 실패', didFail && session.state === ECardMatchState.GAME_OVER, session.state);
		recorder.check('종료 후에는 입력을 받지 않는다', session.revealTile(0) === undefined);
	}

	// §9.5 - 리셋 버튼은 동작하지 않는다
	{
		const events = new CardMatchEvents();
		let didIgnore = false;
		events.RESET_IGNORED.subscribe(() => { didIgnore = true; });

		const session = new CardMatchSession(events, tables, generator, { seed: 30003 });
		session.startQuest('QUEST_CARDMATCH_D1');

		const before = session.getRemainingObjectTileCount();
		session.requestReset();
		recorder.check('리셋 요청은 무시되고 이벤트만 발행', didIgnore);
		recorder.check('리셋해도 보드가 바뀌지 않는다', session.getRemainingObjectTileCount() === before);
	}

	// 폭탄 셔플 중에는 제한 시간이 멈춘다 - §4
	{
		const events = new CardMatchEvents();
		const session = new CardMatchSession(events, tables, generator, { seed: 30004 });
		session.startQuest('QUEST_CARDMATCH_D1');

		const board = session.board;
		if (board !== undefined) {
			const bombTile = board.tiles.find((tile) => tile.isBomb);
			recorder.check('폭탄 타일이 존재한다', bombTile !== undefined);

			if (bombTile !== undefined) {
				session.revealTile(bombTile.index);
				recorder.check('폭탄으로 입력이 잠긴다', session.isInputLocked);

				const timeBefore = session.getRemainingTimeSeconds();
				session.update(0.5);
				recorder.check('셔플 중에는 제한 시간이 흐르지 않는다', session.getRemainingTimeSeconds() === timeBefore,
					`${timeBefore} -> ${session.getRemainingTimeSeconds()}`);

				session.update(1.0);
				recorder.check('셔플이 끝나면 입력이 풀린다', session.isInputLocked === false);

				session.update(1.0);
				recorder.check('셔플이 끝나면 제한 시간이 다시 흐른다', session.getRemainingTimeSeconds() < timeBefore);
			}
		}
	}
}

//#endregion
