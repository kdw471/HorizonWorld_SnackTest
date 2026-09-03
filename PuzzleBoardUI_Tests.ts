/**
 * Puzzle Board UI Tests - CustomUI 보드 계층 검증 하네스
 *
 *   - 칸 스냅샷의 패치·동등 비교 (불필요한 재렌더를 내지 않는지)
 *   - 격자 규격 검증 (패널이 그릴 수 있는 범위)
 *   - 프레젠터의 입력 정규화 - 단일 터치, 밖에서 떼기 취소, enter/exit 순서 무관성
 *   - **보조 레이아웃** - 오브젝트 트레이의 집기/끌어 놓기, 리셋 버튼, GameStart 배너
 *   - **부품 무늬**(`EBoardCellGlyph`) - 막힌 변과 회전각이 방향마다 다른지
 *   - 스테이지의 마운트/언마운트 규칙 + 허브 재시작 시의 정리(`reset`)
 *   - **실제 SwitchSession 과의 통합** - UI 탭만으로 D1 클리어, 밖에서 떼면 안 눌리는지
 *
 * Horizon Component 가 아니라 순수 검증 하네스다. `runPuzzleBoardUITests()` 를 호출하면 결과를 돌려준다.
 * (`Documents/생성 문서/가이드/타입체크와_테스트_실행.md` §3 의 스위트 목록에 추가한다)
 */

import { SwitchLevelGenerator } from 'Switch_LevelGenerator';
import { SwitchPuzzleEvents } from 'Switch_GameEvents';
import { SwitchPuzzleTables } from 'Switch_DataTables';
import { SwitchSession } from 'Switch_Session';
import { SwitchSolver } from 'Switch_Solver';
import {
	ESwitchCellState,
	PRESS_SEQUENCE_SECONDS,
	SWITCH_BOARD_SIZE,
	SWITCH_CELL_COUNT,
	SWITCH_MASK_SIZE,
} from 'Switch_Definitions';
import {
	BOARD_COLOR_EMPTY,
	EBoardCellAccent,
	EBoardCellGlyph,
	NO_TEXTURE,
	PUZZLE_BOARD_CELL_OUTSIDE,
	PUZZLE_BOARD_DEFAULT_GRAB_LIFT_RATIO,
	PUZZLE_BOARD_INTRO_TEXT,
	PUZZLE_BOARD_MAX_ITEMS,
	PuzzleBoardLayoutSpec,
	applyCellPatch,
	applyItemPatch,
	boardColor,
	createBoardView,
	createCellView,
	createItemView,
	getGlyphBlockedEdges,
	getGlyphRotation,
	getGlyphRotationDegrees,
	isSameCellView,
	isSameItemView,
	textureKey,
	toBoardCellIndex,
	validateBoardLayout,
} from 'PuzzleBoardUI_Definitions';
import { PuzzleBoardPressHighlight, PuzzleBoardPresenter, PuzzleBoardStage } from 'PuzzleBoardUI_Presenter';

export type PuzzleBoardUITestResult = {
	name: string,
	isPassed: boolean,
	detail?: string,
}

export type PuzzleBoardUITestReport = {
	passed: number,
	failed: number,
	results: PuzzleBoardUITestResult[],
}

class TestRecorder {
	public readonly results: PuzzleBoardUITestResult[] = [];

	public check(name: string, condition: boolean, detail?: string): void {
		this.results.push({ name: name, isPassed: condition, detail: condition ? undefined : detail });
	}
}

//#region Helpers

const SWITCH_LAYOUT: PuzzleBoardLayoutSpec = {
	title: 'Switch',
	rowCount: SWITCH_BOARD_SIZE,
	colCount: SWITCH_BOARD_SIZE,
	side: { rowCount: SWITCH_MASK_SIZE, colCount: SWITCH_MASK_SIZE, label: '스위치 영역' },
};

/** 입력 콜백이 어떤 순서로 불렸는지 문자열로 남기는 기록기 */
type InputLog = string[];

function createLoggingPresenter(log: InputLog, spec: PuzzleBoardLayoutSpec = SWITCH_LAYOUT): PuzzleBoardPresenter {
	const presenter = new PuzzleBoardPresenter(spec, {
		onCellDown: (cell) => log.push(`down:${cell}`),
		onCellMove: (cell) => log.push(`move:${cell}`),
		onCellUp: (cell) => log.push(`up:${cell}`),
		onCellTap: (cell) => log.push(`tap:${cell}`),
	});
	// 기본은 모든 칸이 숨김이므로 입력을 받으려면 먼저 보이게 만든다
	presenter.setAllCells({ isVisible: true });
	presenter.setInputEnabled(true);
	return presenter;
}

//#endregion

//#region Suites

function testDefinitions(recorder: TestRecorder): void {
	const view = createBoardView(SWITCH_LAYOUT);
	recorder.check('규격 - 격자 칸 수가 rowCount * colCount',
		view.grid.cells.length === SWITCH_CELL_COUNT, `${view.grid.cells.length}`);
	recorder.check('규격 - 보조 격자 칸 수가 3×3',
		view.side !== undefined && view.side.cells.length === SWITCH_MASK_SIZE * SWITCH_MASK_SIZE);
	recorder.check('규격 - 보조 격자를 지정하지 않으면 undefined',
		createBoardView({ title: '', rowCount: 3, colCount: 3 }).side === undefined);

	// 집은 조각 띄우기 배수 - 퍼즐(레이저 dragLiftCells prop)이 조정하는 파라미터다
	recorder.check('규격 - 띄우기 배수를 주지 않으면 기본값',
		createBoardView({ title: '', rowCount: 3, colCount: 3 }).grabLiftCellRatio === PUZZLE_BOARD_DEFAULT_GRAB_LIFT_RATIO);
	recorder.check('규격 - 띄우기 배수를 주면 그대로 쓴다',
		createBoardView({ title: '', rowCount: 3, colCount: 3, grabLiftCellRatio: 1.4 }).grabLiftCellRatio === 1.4);
	recorder.check('규격 - 0 이면 띄우지 않는다는 뜻으로 그대로 둔다',
		createBoardView({ title: '', rowCount: 3, colCount: 3, grabLiftCellRatio: 0 }).grabLiftCellRatio === 0);
	recorder.check('규격 - 음수 띄우기 배수는 0 으로 다듬는다',
		createBoardView({ title: '', rowCount: 3, colCount: 3, grabLiftCellRatio: -1 }).grabLiftCellRatio === 0);
	recorder.check('규격 - 못 쓰는 띄우기 배수(NaN)는 기본값으로 대체',
		createBoardView({ title: '', rowCount: 3, colCount: 3, grabLiftCellRatio: Number.NaN }).grabLiftCellRatio
			=== PUZZLE_BOARD_DEFAULT_GRAB_LIFT_RATIO);

	const cell = createCellView();
	recorder.check('칸 - 초기 상태는 숨김', cell.isVisible === false);
	recorder.check('칸 - 바뀐 것이 없으면 패치 결과가 undefined',
		applyCellPatch(cell, { isVisible: false }) === undefined);
	recorder.check('칸 - 바뀌면 새 스냅샷을 돌려준다',
		applyCellPatch(cell, { isVisible: true })?.isVisible === true);
	recorder.check('칸 - 색만 달라도 다른 스냅샷으로 본다',
		isSameCellView(cell, { ...cell, fill: boardColor(1, 0, 0) }) === false);
	recorder.check('칸 - 같은 값이면 같은 스냅샷으로 본다',
		isSameCellView(cell, { ...cell, fill: BOARD_COLOR_EMPTY }));

	recorder.check('칸 - 조작 강조의 초기값은 NONE', cell.accent === EBoardCellAccent.NONE);
	recorder.check('칸 - 조작 강조만 달라도 다른 스냅샷으로 본다',
		isSameCellView(cell, { ...cell, accent: EBoardCellAccent.GRABBED }) === false);
	recorder.check('칸 - 조작 강조도 패치로 바꿀 수 있다',
		applyCellPatch(cell, { accent: EBoardCellAccent.GHOST })?.accent === EBoardCellAccent.GHOST);
	recorder.check('칸 - 조작 강조가 그대로면 패치 결과가 undefined',
		applyCellPatch(cell, { accent: EBoardCellAccent.NONE }) === undefined);

	const slot = createItemView();
	recorder.check('슬롯 - 조작 강조만 달라도 다른 스냅샷으로 본다',
		isSameItemView(slot, { ...slot, accent: EBoardCellAccent.GHOST }) === false);
	recorder.check('슬롯 - 조작 강조도 패치로 바꿀 수 있다',
		applyItemPatch(slot, { accent: EBoardCellAccent.GRABBED })?.accent === EBoardCellAccent.GRABBED);

	recorder.check('좌표 - row-major 변환', toBoardCellIndex(2, 3, 5, 5) === 13);
	recorder.check('좌표 - 보드 밖은 OUTSIDE',
		toBoardCellIndex(5, 0, 5, 5) === PUZZLE_BOARD_CELL_OUTSIDE
		&& toBoardCellIndex(0, -1, 5, 5) === PUZZLE_BOARD_CELL_OUTSIDE);

	recorder.check('규격 검증 - 정상 규격은 위반 없음', validateBoardLayout(SWITCH_LAYOUT).length === 0);
	recorder.check('규격 검증 - 최대 격자를 넘으면 위반',
		validateBoardLayout({ title: '', rowCount: 10, colCount: 10 }).length === 2);
	// --- 텍스처 (worker/NextJob.md 1번) ---
	recorder.check('텍스처 - 처음에는 없음', createCellView().texture === NO_TEXTURE);
	recorder.check('텍스처 - 키 조합', textureKey('switch', 'pressed') === 'switch.pressed');
	recorder.check('텍스처 - 조각이 비면 NO_TEXTURE',
		textureKey('', 'pressed') === NO_TEXTURE && textureKey('switch', '') === NO_TEXTURE);
	recorder.check('텍스처 - 칸의 텍스처가 바뀌면 다른 스냅샷으로 본다',
		applyCellPatch(createCellView(), { texture: 'switch.pressed' })?.texture === 'switch.pressed');
	recorder.check('텍스처 - 같은 텍스처를 다시 쓰면 패치 결과가 undefined',
		applyCellPatch({ ...createCellView(), texture: 'a' }, { texture: 'a' }) === undefined);
	recorder.check('텍스처 - 슬롯도 같은 규칙',
		applyItemPatch(createItemView(), { texture: 'laser.crystal' })?.texture === 'laser.crystal'
		&& isSameItemView(createItemView(), { ...createItemView(), texture: 'x' }) === false);
	recorder.check('텍스처 - 판 배경은 규격에서 온다',
		createBoardView({ title: '', rowCount: 3, colCount: 3, boardTexture: 'flow.board' }).boardTexture === 'flow.board');
	recorder.check('텍스처 - 판 배경을 주지 않으면 NO_TEXTURE',
		createBoardView({ title: '', rowCount: 3, colCount: 3 }).boardTexture === NO_TEXTURE);

	// 집은 조각 띄우기는 퍼즐이 켠 경우에만 - 기본은 예전 방식(확대·테두리만)이다
	recorder.check('규격 - liftGrabbedPiece 기본은 꺼짐',
		createBoardView({ title: '', rowCount: 3, colCount: 3 }).liftGrabbedPiece === false);
	recorder.check('규격 - liftGrabbedPiece 를 켜면 뷰에 남는다',
		createBoardView({ title: '', rowCount: 3, colCount: 3, liftGrabbedPiece: true }).liftGrabbedPiece === true);

	recorder.check('규격 검증 - 보조 격자 상한도 본다',
		validateBoardLayout({ title: '', rowCount: 5, colCount: 5, side: { rowCount: 4, colCount: 4, label: '' } }).length === 2);
}

/**
 * 부품 무늬 - **방향을 화면에 드러내는 어휘**.
 *
 * 레이저 퍼즐에서 "어떤 게 아래만 반사되고 어떤 게 위만 반사되는지" 를 가르는 것이 이 값이다.
 * 네 방향이 실제로 서로 다른 그림이 되는지(막힌 변 / 회전각)를 여기서 못박는다.
 */
function testGlyphs(recorder: TestRecorder): void {
	const cell = createCellView();
	recorder.check('무늬 - 초기값은 NONE', cell.glyph === EBoardCellGlyph.NONE);
	recorder.check('무늬 - 무늬만 달라도 다른 스냅샷으로 본다',
		isSameCellView(cell, { ...cell, glyph: EBoardCellGlyph.BLOCKED_UP }) === false);
	recorder.check('무늬 - 패치로 바꿀 수 있다',
		applyCellPatch(cell, { glyph: EBoardCellGlyph.CORNER_TOP_LEFT })?.glyph === EBoardCellGlyph.CORNER_TOP_LEFT);
	recorder.check('무늬 - 그대로면 패치 결과가 undefined',
		applyCellPatch(cell, { glyph: EBoardCellGlyph.NONE }) === undefined);

	const slot = createItemView();
	recorder.check('슬롯 무늬 - 무늬만 달라도 다른 스냅샷으로 본다',
		isSameItemView(slot, { ...slot, glyph: EBoardCellGlyph.BLOCKED_LEFT }) === false);
	recorder.check('슬롯 무늬 - 패치로 바꿀 수 있다',
		applyItemPatch(slot, { glyph: EBoardCellGlyph.BLOCKED_RIGHT })?.glyph === EBoardCellGlyph.BLOCKED_RIGHT);

	// 직각 삼각형 - 직각 코너에 붙은 두 변이 광선을 되돌린다
	const bottomLeft = getGlyphBlockedEdges(EBoardCellGlyph.CORNER_BOTTOM_LEFT);
	recorder.check('무늬 - 좌하단 직각은 왼쪽·아래가 평면',
		bottomLeft.left && bottomLeft.bottom && bottomLeft.top === false && bottomLeft.right === false);
	const topRight = getGlyphBlockedEdges(EBoardCellGlyph.CORNER_TOP_RIGHT);
	recorder.check('무늬 - 우상단 직각은 오른쪽·위가 평면',
		topRight.right && topRight.top && topRight.bottom === false && topRight.left === false);

	// 회귀: 이 둘은 예전에 화면에서 똑같은 글자였다
	recorder.check('무늬 - 좌하단과 우상단은 서로 다른 그림이다',
		getGlyphRotationDegrees(EBoardCellGlyph.CORNER_BOTTOM_LEFT)
		!== getGlyphRotationDegrees(EBoardCellGlyph.CORNER_TOP_RIGHT));

	// T자 - 막힌 변이 정확히 하나
	const teeGlyphs = [
		EBoardCellGlyph.BLOCKED_UP,
		EBoardCellGlyph.BLOCKED_DOWN,
		EBoardCellGlyph.BLOCKED_LEFT,
		EBoardCellGlyph.BLOCKED_RIGHT,
	];
	const rotations: number[] = [];
	for (const glyph of teeGlyphs) {
		const edges = getGlyphBlockedEdges(glyph);
		const blocked = [edges.top, edges.bottom, edges.left, edges.right].filter((value) => value).length;
		recorder.check(`무늬 - ${glyph} 는 막힌 변이 하나`, blocked === 1, `${blocked}`);
		rotations.push(getGlyphRotationDegrees(glyph));
	}
	// `new Set(array)` 는 에디터 TS(target < ES2015)에서 다운레벨 반복에 걸린다 - 직접 센다
	const uniqueRotations = rotations.filter((value, index) => rotations.indexOf(value) === index);
	recorder.check('무늬 - T자 네 방향의 회전각이 모두 다르다',
		uniqueRotations.length === 4, rotations.join(','));

	recorder.check('무늬 - NONE 은 막힌 변이 없다',
		[EBoardCellGlyph.NONE].every((glyph) => {
			const edges = getGlyphBlockedEdges(glyph);
			return edges.top === false && edges.bottom === false && edges.left === false && edges.right === false;
		}));
	recorder.check('무늬 - 회전각은 스타일 문자열로 나간다',
		getGlyphRotation(EBoardCellGlyph.BLOCKED_RIGHT) === '90deg',
		getGlyphRotation(EBoardCellGlyph.BLOCKED_RIGHT));
	recorder.check('무늬 - NONE 은 돌리지 않는다', getGlyphRotation(EBoardCellGlyph.NONE) === '0deg');
}

function testPresenterCells(recorder: TestRecorder): void {
	const presenter = new PuzzleBoardPresenter(SWITCH_LAYOUT);
	let changeCount = 0;
	let lastIndex = -1;
	presenter.CELL_CHANGED.subscribe((change) => {
		changeCount++;
		lastIndex = change.index;
	});

	recorder.check('프레젠터 - 칸 갱신이 이벤트를 낸다',
		presenter.setCell(7, { isVisible: true }) && changeCount === 1 && lastIndex === 7);
	recorder.check('프레젠터 - 같은 값을 다시 쓰면 이벤트가 없다',
		presenter.setCell(7, { isVisible: true }) === false && changeCount === 1);
	recorder.check('프레젠터 - 격자 밖 번호는 무시',
		presenter.setCell(SWITCH_CELL_COUNT, { isVisible: true }) === false);
	recorder.check('프레젠터 - 스냅샷에 반영된다', presenter.getCell(7)?.isVisible === true);

	let sideChangeCount = 0;
	presenter.SIDE_CELL_CHANGED.subscribe(() => { sideChangeCount++; });
	recorder.check('프레젠터 - 보조 격자 갱신',
		presenter.setSideCell(4, { isVisible: true }) && sideChangeCount === 1);
	recorder.check('프레젠터 - 보조 격자가 없으면 거절',
		new PuzzleBoardPresenter({ title: '', rowCount: 2, colCount: 2 }).setSideCell(0, { isVisible: true }) === false);

	presenter.setAllCells({ isVisible: true });
	let visibleCount = 0;
	for (let index = 0; index < SWITCH_CELL_COUNT; index++) {
		if (presenter.getCell(index)?.isVisible === true) {
			visibleCount++;
		}
	}
	recorder.check('프레젠터 - setAllCells 가 전 칸에 적용된다', visibleCount === SWITCH_CELL_COUNT);

	let layoutChangeCount = 0;
	presenter.LAYOUT_CHANGED.subscribe(() => { layoutChangeCount++; });
	presenter.resetLayout({ title: '연결', rowCount: 7, colCount: 7 });
	recorder.check('프레젠터 - 규격 교체 시 LAYOUT_CHANGED',
		layoutChangeCount === 1 && presenter.getView().grid.cells.length === 49);
	recorder.check('프레젠터 - 규격 교체로 칸이 초기화된다', presenter.getCell(0)?.isVisible === false);
	presenter.setTitle('연결');
	recorder.check('프레젠터 - 같은 제목은 이벤트를 내지 않는다', layoutChangeCount === 1);
}

function testPresenterInput(recorder: TestRecorder): void {
	// 입력이 꺼져 있으면 아무 일도 없다
	const idleLog: InputLog = [];
	const idle = new PuzzleBoardPresenter(SWITCH_LAYOUT, { onCellDown: (cell) => idleLog.push(`down:${cell}`) });
	idle.setAllCells({ isVisible: true });
	idle.pointerDown(0);
	recorder.check('입력 - 기본값은 꺼짐', idleLog.length === 0);

	// 탭 - 누른 칸에서 떼면 확정
	const tapLog: InputLog = [];
	const tap = createLoggingPresenter(tapLog);
	tap.pointerDown(12);
	tap.pointerUp();
	recorder.check('입력 - 같은 칸에서 떼면 tap',
		tapLog.join(',') === 'down:12,up:12,tap:12', tapLog.join(','));

	// 다른 칸에서 떼면 tap 이 없다 (PUZ_08 M2)
	const dragLog: InputLog = [];
	const drag = createLoggingPresenter(dragLog);
	drag.pointerDown(3);
	drag.pointerEnter(4);
	drag.pointerUp();
	recorder.check('입력 - 다른 칸에서 떼면 tap 없음',
		dragLog.join(',') === 'down:3,move:4,up:4', dragLog.join(','));

	// 판을 진짜로 벗어난 뒤 떼면 OUTSIDE.
	// 판을 벗어났다는 것은 격자 밖 배경이 `pointerLeaveBoard()` 로 알린다 - 칸끼리 오갈 때
	// 스쳐 가는 `onExit` 만으로는 벗어난 것이 아니다.
	const outLog: InputLog = [];
	const out = createLoggingPresenter(outLog);
	out.pointerDown(5);
	out.pointerLeaveBoard();
	out.pointerUp();
	recorder.check('입력 - 판을 벗어난 뒤 떼면 OUTSIDE',
		outLog.join(',') === `down:5,move:${PUZZLE_BOARD_CELL_OUTSIDE},up:${PUZZLE_BOARD_CELL_OUTSIDE}`, outLog.join(','));

	// --- 떼는 순간 도착한 exit 이 드랍 지점을 지우면 안 된다 (worker/NextJob.md 2번) ---
	//
	// `Pressable` 은 손가락이 떨어질 때 exit 을 release 보다 먼저 보내는 경우가 있다.
	// 그때 hover 만 보고 판정하면 칸 위에서 뗐는데도 "밖에 놓았다" 가 되어 조각이 되돌아갔다.
	const dropLog: InputLog = [];
	const drop = createLoggingPresenter(dropLog);
	drop.pointerDown(3);
	drop.pointerEnter(4);
	drop.pointerExit(4);   // 떼기 직전에 도착한 exit
	drop.pointerUp();
	recorder.check('놓기 - 떼기 직전 exit 이 와도 그 칸에 놓는다',
		dropLog.join(',') === `down:3,move:4,move:${PUZZLE_BOARD_CELL_OUTSIDE},up:4`, dropLog.join(','));

	const tapExitLog: InputLog = [];
	const tapExit = createLoggingPresenter(tapExitLog);
	tapExit.pointerDown(7);
	tapExit.pointerExit(7);
	tapExit.pointerUp();
	recorder.check('놓기 - 누른 칸에서 exit 뒤에 떼도 탭으로 본다',
		tapExitLog.join(',') === `down:7,move:${PUZZLE_BOARD_CELL_OUTSIDE},up:7,tap:7`, tapExitLog.join(','));

	// 판을 벗어난 뒤에는 마지막 칸도 잊는다 - 진짜로 밖에 놓은 것이다
	const leaveLog: InputLog = [];
	const leave = createLoggingPresenter(leaveLog);
	leave.pointerDown(3);
	leave.pointerEnter(4);
	leave.pointerLeaveBoard();
	leave.pointerUp();
	recorder.check('놓기 - 판을 벗어난 뒤 떼면 밖에 놓은 것',
		leaveLog.join(',') === `down:3,move:4,move:${PUZZLE_BOARD_CELL_OUTSIDE},up:${PUZZLE_BOARD_CELL_OUTSIDE}`,
		leaveLog.join(','));

	// enter 가 exit 보다 먼저 와도 결과가 같다 (UI 이벤트 순서 무보장)
	const orderLog: InputLog = [];
	const order = createLoggingPresenter(orderLog);
	order.pointerDown(5);
	order.pointerEnter(6);
	order.pointerExit(5);   // 늦게 도착한 이전 칸의 exit - 무시되어야 한다
	order.pointerUp();
	recorder.check('입력 - enter 이후 도착한 이전 칸 exit 는 무시',
		orderLog.join(',') === 'down:5,move:6,up:6', orderLog.join(','));

	// down 이 겹치면 앞 터치의 release 가 유실된 것으로 보고 앞 누름을 마감한 뒤 새 누름을 연다.
	// (모바일 Pressable 은 누른 요소 밖에서 뗀 release 를 전달하지 않는 경우가 있다 -
	//  무시하면 드래그가 영구히 붙잡혀 다음 탭의 release 까지 조각이 놓이지 않았다.)
	const multiLog: InputLog = [];
	const multi = createLoggingPresenter(multiLog);
	multi.pointerDown(1);
	multi.pointerDown(2);
	multi.pointerUp();
	recorder.check('입력 - down 겹침은 앞 누름을 마감하고 새 누름을 연다',
		multiLog.join(',') === 'down:1,up:1,tap:1,down:2,up:2,tap:2', multiLog.join(','));

	// release 유실 회복 - 끌고 간 칸에서 뗐는데 release 가 오지 않았다면,
	// 다음 down 이 오는 순간 그 칸에 놓아 마감한다 (탭의 release 를 기다리지 않는다)
	const lostLog: InputLog = [];
	const lost = createLoggingPresenter(lostLog);
	lost.pointerDown(3);
	lost.pointerEnter(4);   // 여기서 손을 뗐지만 release 가 유실됐다
	lost.pointerDown(8);    // 다음 터치
	recorder.check('놓기 - release 유실 시 다음 down 이 마지막 칸에 놓는다',
		lostLog.join(',') === 'down:3,move:4,up:4,down:8', lostLog.join(','));

	// 숨긴 칸은 보드의 일부가 아니다
	const hiddenLog: InputLog = [];
	const hidden = createLoggingPresenter(hiddenLog);
	hidden.setCell(9, { isVisible: false });
	hidden.pointerDown(9);
	recorder.check('입력 - 숨긴 칸은 누를 수 없다', hiddenLog.length === 0, hiddenLog.join(','));

	hidden.pointerDown(8);
	hidden.pointerEnter(9);
	recorder.check('입력 - 숨긴 칸으로 들어가면 보드 밖 취급',
		hiddenLog.join(',') === `down:8,move:${PUZZLE_BOARD_CELL_OUTSIDE}`, hiddenLog.join(','));

	// 입력을 끄면 붙잡힌 누름이 취소된다
	const cancelLog: InputLog = [];
	const cancel = createLoggingPresenter(cancelLog);
	cancel.pointerDown(0);
	cancel.setInputEnabled(false);
	recorder.check('입력 - 끄면 진행 중 누름이 취소된다',
		cancelLog.join(',') === `down:0,up:${PUZZLE_BOARD_CELL_OUTSIDE}` && cancel.hasActivePress === false,
		cancelLog.join(','));
	cancel.pointerUp();
	recorder.check('입력 - 취소 뒤의 up 은 아무 일도 하지 않는다',
		cancelLog.join(',') === `down:0,up:${PUZZLE_BOARD_CELL_OUTSIDE}`, cancelLog.join(','));
}

/**
 * 보조 레이아웃 - 오브젝트 트레이 / 리셋 / GameStart 배너.
 *
 * 레이저가 인벤토리를 트레이로 옮기면서 생긴 경로다. 트레이에서 집어 판에 놓는 동작이
 * **칸에서 집은 것과 완전히 같은 콜백 순서**로 나오는지가 핵심이다.
 */
function testAuxLayout(recorder: TestRecorder): void {
	const item = createItemView();
	recorder.check('트레이 - 슬롯 초기 상태는 숨김', item.isVisible === false);
	recorder.check('트레이 - 바뀐 것이 없으면 패치 결과가 undefined',
		applyItemPatch(item, { caption: '' }) === undefined);
	recorder.check('트레이 - 자막만 달라도 다른 스냅샷으로 본다',
		isSameItemView(item, { ...item, caption: 'x2' }) === false);

	const traySpec: PuzzleBoardLayoutSpec = { title: 'Laser', rowCount: 7, colCount: 7, itemCount: 3 };
	recorder.check('트레이 - itemCount 만큼 슬롯이 생긴다', createBoardView(traySpec).items.length === 3);
	recorder.check('트레이 - itemCount 를 주지 않으면 빈 배열',
		createBoardView({ title: '', rowCount: 3, colCount: 3 }).items.length === 0);
	recorder.check('트레이 - 슬롯 상한을 넘으면 규격 위반',
		validateBoardLayout({ title: '', rowCount: 3, colCount: 3, itemCount: PUZZLE_BOARD_MAX_ITEMS + 1 }).length === 1);

	// --- 집기 -> 판으로 끌기 -> 놓기 ---
	const log: InputLog = [];
	const presenter = new PuzzleBoardPresenter(traySpec, {
		onCellDown: (cell) => log.push(`down:${cell}`),
		onCellMove: (cell) => log.push(`move:${cell}`),
		onCellUp: (cell) => log.push(`up:${cell}`),
		onItemDown: (slot) => log.push(`item:${slot}`),
		onItemTap: (slot) => log.push(`itemTap:${slot}`),
		onReset: () => log.push('reset'),
	});
	presenter.setAllCells({ isVisible: true });
	presenter.setInputEnabled(true);

	recorder.check('트레이 - 빈 슬롯은 집히지 않는다',
		(presenter.itemDown(0), presenter.hasActivePress === false && log.length === 0));

	presenter.setItem(0, { isVisible: true, label: 'R' });
	presenter.setItem(1, { isVisible: true, label: 'G' });

	presenter.itemDown(0);
	recorder.check('트레이 - 집으면 onItemDown 이 나가고 누름이 열린다',
		presenter.hasActivePress && presenter.pressOrigin?.kind === 'item');
	// down 겹침 - 앞 터치의 release 유실로 보고, 앞 누름(판 밖이라 itemTap)을 마감한 뒤 새로 집는다
	presenter.itemDown(1);
	recorder.check('트레이 - down 겹침은 앞 누름을 마감하고 새 슬롯을 집는다',
		log.join(',') === `item:0,up:${PUZZLE_BOARD_CELL_OUTSIDE},itemTap:0,item:1`
		&& presenter.pressOrigin?.kind === 'item' && presenter.pressOrigin?.index === 1, log.join(','));

	log.length = 0;
	presenter.pointerEnter(12);
	presenter.pointerUp();
	recorder.check('트레이 - 판으로 끌어 놓으면 move/up 이 칸에서 집은 것과 같게 나간다',
		log.join(',') === 'move:12,up:12', log.join(','));

	// 떼기 직전 exit 이 와도 판 위에 놓인다 (worker/NextJob.md 2번)
	log.length = 0;
	presenter.itemDown(0);
	presenter.pointerEnter(12);
	presenter.pointerExit(12);
	presenter.pointerUp();
	recorder.check('트레이 - 떼기 직전 exit 이 와도 그 칸에 놓는다',
		log.join(',') === `item:0,move:12,move:${PUZZLE_BOARD_CELL_OUTSIDE},up:12`, log.join(','));

	// --- 끌지 않고 그대로 뗀 경우 ---
	log.length = 0;
	presenter.itemDown(0);
	presenter.pointerUp();
	recorder.check('트레이 - 끌지 않고 떼면 판 밖 up 과 onItemTap 이 함께 나간다',
		log.join(',') === `item:0,up:${PUZZLE_BOARD_CELL_OUTSIDE},itemTap:0`, log.join(','));

	// --- 리셋 ---
	log.length = 0;
	presenter.itemDown(0);
	recorder.check('리셋 - 누름을 마감하고 콜백을 부른다',
		presenter.requestReset()
		&& log.join(',') === `item:0,up:${PUZZLE_BOARD_CELL_OUTSIDE},reset`
		&& presenter.hasActivePress === false, log.join(','));

	log.length = 0;
	presenter.setInputEnabled(false);
	recorder.check('리셋 - 입력이 꺼져 있으면(일시정지·결과) 받지 않는다',
		presenter.requestReset() === false && log.length === 0);

	const noHandler = new PuzzleBoardPresenter(traySpec, {});
	noHandler.setInputEnabled(true);
	recorder.check('리셋 - 콜백을 배선하지 않은 퍼즐은 false', noHandler.requestReset() === false);
}

/** GameStart 배너 - 떠 있는 동안 보조 레이아웃을 가리고, 내려가면 나타난다 */
function testIntroBanner(recorder: TestRecorder): void {
	const presenter = new PuzzleBoardPresenter(SWITCH_LAYOUT);
	const seen: string[] = [];
	presenter.INTRO_CHANGED.subscribe((intro) => seen.push(`${intro.isVisible ? 'on' : 'off'}:${intro.text}`));

	recorder.check('배너 - 처음에는 떠 있지 않다', presenter.isIntroVisible === false);

	presenter.beginIntro();
	recorder.check('배너 - 띄우면 기본 문구로 뜬다',
		presenter.isIntroVisible && presenter.getIntro().text === PUZZLE_BOARD_INTRO_TEXT);
	presenter.beginIntro();
	recorder.check('배너 - 같은 문구로 다시 띄워도 이벤트가 늘지 않는다', seen.length === 1);

	presenter.endIntro();
	recorder.check('배너 - 내리면 사라진다', presenter.isIntroVisible === false);
	presenter.endIntro();
	recorder.check('배너 - 이미 내려간 상태에서 또 내려도 이벤트가 없다',
		seen.join(',') === `on:${PUZZLE_BOARD_INTRO_TEXT},off:${PUZZLE_BOARD_INTRO_TEXT}`, seen.join(','));

	// 보드를 내릴 때 배너도 함께 꺼진다 - 다음에 올라올 때 낡은 배너가 보이면 안 된다
	const stage = new PuzzleBoardStage();
	presenter.beginIntro();
	stage.mount(presenter);
	stage.unmount(presenter);
	recorder.check('배너 - 보드를 내리면 배너도 내려간다', presenter.isIntroVisible === false);
}

function testStage(recorder: TestRecorder): void {
	const stage = new PuzzleBoardStage();
	const first = new PuzzleBoardPresenter(SWITCH_LAYOUT);
	const second = new PuzzleBoardPresenter(SWITCH_LAYOUT);

	let mountCount = 0;
	let unmountCount = 0;
	stage.MOUNTED.subscribe(() => { mountCount++; });
	stage.UNMOUNTED.subscribe(() => { unmountCount++; });

	stage.mount(first);
	recorder.check('스테이지 - 마운트', stage.current === first && mountCount === 1);
	stage.mount(first);
	recorder.check('스테이지 - 같은 보드를 다시 올려도 이벤트가 없다', mountCount === 1);
	stage.mount(second);
	recorder.check('스테이지 - 다른 보드로 교체', stage.current === second && mountCount === 2);

	stage.unmount(first);
	recorder.check('스테이지 - 남의 보드로는 내릴 수 없다', stage.current === second && unmountCount === 0);
	stage.unmount(second);
	recorder.check('스테이지 - 내리기', stage.current === undefined && unmountCount === 1);
	stage.unmount();
	recorder.check('스테이지 - 빈 상태에서 내려도 이벤트가 없다', unmountCount === 1);

	// 내릴 때 붙잡힌 누름을 마감한다
	const log: InputLog = [];
	const pressed = createLoggingPresenter(log);
	stage.mount(pressed);
	pressed.pointerDown(2);
	stage.unmount();
	recorder.check('스테이지 - 내릴 때 진행 중 누름을 마감한다',
		log.join(',') === `down:2,up:${PUZZLE_BOARD_CELL_OUTSIDE}`, log.join(','));

	// 재입장 - 허브가 새로 시작하면 앞선 생에서 올라가 있던 보드를 무조건 내린다.
	// 내리지 않으면 새 패널이 붙자마자 그 보드를 집어 그려, 메인 메뉴 대신 직전 레벨이 뜬다.
	const staleStage = new PuzzleBoardStage();
	let staleUnmounts = 0;
	staleStage.UNMOUNTED.subscribe(() => { staleUnmounts++; });
	staleStage.mount(new PuzzleBoardPresenter(SWITCH_LAYOUT));
	staleStage.reset();
	recorder.check('스테이지 - reset 은 올라가 있던 보드를 내린다',
		staleStage.current === undefined && staleUnmounts === 1);
	staleStage.reset();
	recorder.check('스테이지 - 빈 상태에서 reset 은 아무 일도 하지 않는다', staleUnmounts === 1);

	// 보드 위의 Menu 버튼 - 스테이지를 통해 허브에 일시정지를 요청한다.
	// 보드 패널은 허브의 모델을 모르므로 이 통로가 유일한 연결이다.
	const pauseStage = new PuzzleBoardStage();
	let pauseRequests = 0;
	pauseStage.requestPause();
	recorder.check('스테이지 - 듣는 허브가 없으면 일시정지 요청은 조용히 버려진다', pauseRequests === 0);
	const pauseSub = pauseStage.PAUSE_REQUESTED.subscribe(() => { pauseRequests++; });
	pauseStage.requestPause();
	recorder.check('스테이지 - Menu 버튼은 허브에 일시정지를 요청한다', pauseRequests === 1);
	pauseStage.requestPause();
	recorder.check('스테이지 - 요청은 누를 때마다 간다', pauseRequests === 2);
	pauseSub.disconnect();
	pauseStage.requestPause();
	recorder.check('스테이지 - 구독을 끊으면 더 이상 오지 않는다', pauseRequests === 2);
}

/**
 * 실제 세션과의 통합.
 *
 * `Switch_CoreAPI` 가 하는 배선을 그대로 재현한다 - 프레젠터의 입력 콜백을 세션의
 * touchDown/Move/Up 에 잇고, 세션 이벤트로 칸 색을 갱신한다.
 * Horizon Component 없이 **UI 탭만으로 퍼즐이 실제로 클리어되는지**를 본다.
 */
function testSwitchIntegration(recorder: TestRecorder): void {
	const tables = new SwitchPuzzleTables();
	const events = new SwitchPuzzleEvents();
	const session = new SwitchSession(events, tables, new SwitchLevelGenerator(tables), { seed: 20260902 });
	const solver = new SwitchSolver();

	const presenter = new PuzzleBoardPresenter(SWITCH_LAYOUT, {
		onCellDown: (cell) => { session.touchDown(cell); },
		onCellMove: (cell) => { session.touchMove(cell); },
		onCellUp: () => { session.touchUp(); },
	});

	const applyCellVisual = (cell: number): void => {
		const state = session.board?.getCellAt(cell);
		if (state === undefined || state === ESwitchCellState.FREE) {
			return;
		}
		presenter.setCell(cell, {
			fill: state === ESwitchCellState.PRESSED ? boardColor(0.15, 0.85, 0.3) : boardColor(0.9, 0.2, 0.2),
		});
	};

	events.LEVEL_LOADED.subscribe((level) => {
		for (let cell = 0; cell < SWITCH_CELL_COUNT; cell++) {
			presenter.setCell(cell, { isVisible: level.grid[cell] !== ESwitchCellState.FREE });
			applyCellVisual(cell);
		}
		presenter.setInputEnabled(true);
	});
	events.PRESS_SEQUENCE_FINISHED.subscribe(() => {
		for (let cell = 0; cell < SWITCH_CELL_COUNT; cell++) {
			applyCellVisual(cell);
		}
	});

	let isWin = false;
	let isLose = false;
	events.QUEST_CLEAR.subscribe(() => { isWin = true; });
	events.QUEST_FAILED.subscribe(() => { isLose = true; });

	recorder.check('통합 - D1 퀘스트 시작', session.startQuestByDifficulty(1));
	recorder.check('통합 - 레벨 로드로 보이는 칸이 생긴다',
		presenter.getView().grid.cells.filter((cell) => cell.isVisible).length > 0);
	recorder.check('통합 - 레벨 로드로 입력이 켜진다', presenter.isInputEnabled);

	// 밖에서 떼면 눌리지 않는다 (PUZ_08 M2) - 색이 그대로여야 한다
	const probeCell = session.board?.getPressablePositions()[0] ?? 0;
	const beforeState = session.board?.getCellAt(probeCell);
	presenter.pointerDown(probeCell);
	presenter.pointerExit(probeCell);
	presenter.pointerUp();
	session.update(PRESS_SEQUENCE_SECONDS + 0.01);
	recorder.check('통합 - 칸 밖에서 떼면 눌리지 않는다',
		session.board?.getCellAt(probeCell) === beforeState);

	// 솔버가 시키는 대로 UI 탭만으로 끝까지 푼다
	let guard = 0;
	while (isWin === false && isLose === false && guard < 500) {
		guard++;
		const board = session.board;
		if (board === undefined) {
			break;
		}
		const solution = solver.solve(board.grid, board.mask);
		if (solution.isSolvable === false || solution.pressPositions.length === 0) {
			break;
		}
		const target = solution.pressPositions[0];
		presenter.pointerDown(target);
		presenter.pointerUp();
		session.update(PRESS_SEQUENCE_SECONDS + 0.01);
	}

	recorder.check('통합 - UI 탭만으로 D1 클리어', isWin, `guard=${guard} lose=${isLose}`);

	// 클리어 시점의 화면은 전부 녹색이어야 한다 (§5)
	let greenCount = 0;
	let visibleCount = 0;
	const cells = presenter.getView().grid.cells;
	for (let index = 0; index < cells.length; index++) {
		if (cells[index].isVisible === false) {
			continue;
		}
		visibleCount++;
		if (cells[index].fill.g > cells[index].fill.r) {
			greenCount++;
		}
	}
	recorder.check('통합 - 클리어 화면의 보이는 칸이 전부 녹색',
		visibleCount > 0 && greenCount === visibleCount, `${greenCount}/${visibleCount}`);
}

//#endregion

/**
 * 누름 표시 - 어느 퍼즐이든 짚고 있는 칸이 눌린 티가 나야 한다 (PUZ_00 §8.5).
 *
 * 칸의 스냅샷과 **따로** 다니는 신호다. 그래서 세션이 칸을 다시 칠해도 지워지지 않고,
 * 8개 퍼즐이 저마다 구현하지 않아도 된다. 표시는 **누름이 시작된 칸 위에 손가락이
 * 있을 때만** 켜진다 - 손가락을 따라 이웃 칸으로 옮겨 다니지 않는다 (인터랙션 규격:
 * 드래그 이동 시각화는 세션이 주는 accent 가 담당한다). 손을 떼거나 취소되면 사라진다.
 */
function testPressHighlight(recorder: TestRecorder): void {
	const presenter = new PuzzleBoardPresenter(SWITCH_LAYOUT, {});
	const seen: PuzzleBoardPressHighlight[] = [];
	presenter.PRESS_CHANGED.subscribe((press) => seen.push(press));
	presenter.setInputEnabled(true);
	presenter.setAllCells({ isVisible: true });

	recorder.check('누름 표시 - 짚기 전에는 아무 곳도 짚고 있지 않다',
		presenter.getPressHighlight().cell === PUZZLE_BOARD_CELL_OUTSIDE);

	presenter.pointerDown(4);
	recorder.check('누름 표시 - 누른 칸을 짚는다', presenter.getPressHighlight().cell === 4);
	recorder.check('누름 표시 - 누르면 한 번 알린다', seen.length === 1 && seen[0].cell === 4);

	presenter.pointerEnter(5);
	recorder.check('누름 표시 - 이웃 칸으로 나가면 표시가 꺼진다 (따라다니지 않는다)',
		presenter.getPressHighlight().cell === PUZZLE_BOARD_CELL_OUTSIDE);

	presenter.pointerEnter(4);
	recorder.check('누름 표시 - 누른 칸으로 돌아오면 다시 켜진다', presenter.getPressHighlight().cell === 4);

	presenter.pointerEnter(4);
	recorder.check('누름 표시 - 같은 칸에 머무르면 다시 알리지 않는다', seen.length === 3);

	presenter.pointerLeaveBoard();
	recorder.check('누름 표시 - 판 밖으로 나가면 표시가 사라진다',
		presenter.getPressHighlight().cell === PUZZLE_BOARD_CELL_OUTSIDE);

	presenter.pointerUp();
	recorder.check('누름 표시 - 손을 떼면 짚은 곳이 없다',
		presenter.getPressHighlight().cell === PUZZLE_BOARD_CELL_OUTSIDE);

	// 트레이에서 집었을 때 - 슬롯을 짚고, 판으로 끌고 가도 슬롯은 계속 짚은 채다
	const tray = new PuzzleBoardPresenter({ title: '', rowCount: 3, colCount: 3, itemCount: 2 }, {});
	tray.setInputEnabled(true);
	tray.setAllCells({ isVisible: true });
	tray.setItem(0, { isVisible: true });

	tray.itemDown(0);
	recorder.check('누름 표시 - 트레이 슬롯을 집으면 그 슬롯을 짚는다', tray.getPressHighlight().item === 0);
	recorder.check('누름 표시 - 슬롯을 집은 직후에는 아직 판 위가 아니다',
		tray.getPressHighlight().cell === PUZZLE_BOARD_CELL_OUTSIDE);

	tray.pointerEnter(4);
	recorder.check('누름 표시 - 판으로 끌고 가도 슬롯만 짚은 채다 (칸 표시는 따라다니지 않는다)',
		tray.getPressHighlight().cell === PUZZLE_BOARD_CELL_OUTSIDE && tray.getPressHighlight().item === 0);

	tray.cancelPress();
	recorder.check('누름 표시 - 누름을 취소하면 슬롯도 놓는다',
		tray.getPressHighlight().item === PUZZLE_BOARD_CELL_OUTSIDE);

	// 입력이 꺼지면 진행 중이던 누름이 취소되므로 표시도 사라져야 한다
	const paused = new PuzzleBoardPresenter(SWITCH_LAYOUT, {});
	paused.setInputEnabled(true);
	paused.setAllCells({ isVisible: true });
	paused.pointerDown(0);
	paused.setInputEnabled(false);
	recorder.check('누름 표시 - 입력이 꺼지면 표시도 사라진다',
		paused.getPressHighlight().cell === PUZZLE_BOARD_CELL_OUTSIDE);
}

export function runPuzzleBoardUITests(): PuzzleBoardUITestReport {
	const recorder = new TestRecorder();

	testDefinitions(recorder);
	testGlyphs(recorder);
	testPresenterCells(recorder);
	testPresenterInput(recorder);
	testAuxLayout(recorder);
	testIntroBanner(recorder);
	testStage(recorder);
	testPressHighlight(recorder);
	testSwitchIntegration(recorder);

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
