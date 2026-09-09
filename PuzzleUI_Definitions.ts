/**
 * Puzzle UI Definitions - 메인 UI(퍼즐 허브)의 상수·타입·헬퍼
 *
 * 8개 퍼즐 공통 메인 UI 의 어휘를 정의한다. `horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).
 *
 * 메인 UI 는 다음 네 화면을 오간다.
 *
 *   메인 메뉴(퍼즐 선택) → 난이도 선택 → 인게임 HUD(일시정지 포함) → 결과
 *
 * 퍼즐별 표시 이름과 부제는 여기의 카탈로그가 정본이다. 아직 Horizon 통합(*_CoreAPI)이
 * 없는 퍼즐은 레지스트리에 등록되지 않으므로 메인 메뉴에 "준비 중" 으로 표시된다.
 */

//#region Puzzle catalog

/** 8개 퍼즐의 식별자. 기획서 번호(PUZ_01~08) 순서를 따른다 */
export enum EPuzzleId {
	LASER = 'LASER',
	RUSH_HOUR = 'RUSH_HOUR',
	COLOR_SORT = 'COLOR_SORT',
	COLOR_FILL = 'COLOR_FILL',
	FLOW = 'FLOW',
	CARD_MATCH = 'CARD_MATCH',
	SLIDE_PUZZLE = 'SLIDE_PUZZLE',
	SWITCH = 'SWITCH',
}

export type PuzzleCatalogEntry = {
	id: EPuzzleId,
	/** 메인 메뉴 격자에서의 표시 순서 (0-based, PUZ 번호 순) */
	orderIndex: number,
	/** 버튼에 표시할 이름 */
	displayName: string,
	/** 한 줄 설명 */
	subtitle: string,
}

/** 메인 메뉴에 표시하는 8개 퍼즐의 정본 목록 */
export const PUZZLE_CATALOG: readonly PuzzleCatalogEntry[] = [
	{ id: EPuzzleId.LASER, orderIndex: 0, displayName: 'Laser Hack', subtitle: 'Route the beam with crystals' },
	{ id: EPuzzleId.RUSH_HOUR, orderIndex: 1, displayName: 'Rush Hour', subtitle: 'Slide the USB into its port' },
	{ id: EPuzzleId.COLOR_SORT, orderIndex: 2, displayName: 'Color Sort', subtitle: 'Group the batteries by color' },
	{ id: EPuzzleId.COLOR_FILL, orderIndex: 3, displayName: 'Color Fill', subtitle: 'Tap exactly as the needle passes' },
	{ id: EPuzzleId.FLOW, orderIndex: 4, displayName: 'Flow', subtitle: 'Connect every bulb' },
	{ id: EPuzzleId.CARD_MATCH, orderIndex: 5, displayName: 'Card Match', subtitle: 'Remember the portal pairs' },
	{ id: EPuzzleId.SLIDE_PUZZLE, orderIndex: 6, displayName: 'Slide Puzzle', subtitle: 'Slide the pieces into place' },
	{ id: EPuzzleId.SWITCH, orderIndex: 7, displayName: 'Switch', subtitle: 'Turn every key green' },
];

export function getCatalogEntry(id: EPuzzleId): PuzzleCatalogEntry | undefined {
	return PUZZLE_CATALOG.find((entry) => entry.id === id);
}

//#endregion

//#region Screens

/** 메인 UI 의 화면 상태 머신 */
export enum EPuzzleHubScreen {
	/** 퍼즐 선택 격자 (2열 × 4행) */
	MAIN_MENU = 'MAIN_MENU',
	/**
	 * 고른 퍼즐 하나가 화면을 꽉 채운 상세 화면.
	 * Start / Continue / Return 세 버튼만 세로로 놓는다.
	 */
	PUZZLE_DETAIL = 'PUZZLE_DETAIL',
	/** 플레이 중 - 상단 HUD 만 표시하고 보드를 가리지 않는다 (PUZ_00 §8.5 손가락 가림 대응) */
	IN_GAME = 'IN_GAME',
	/** 일시정지 오버레이 */
	PAUSED = 'PAUSED',
	/** 승패 결과 */
	RESULT = 'RESULT',
}

//#endregion

//#region Shared data shapes

/**
 * 라운드 진행도. 8개 퍼즐의 `*RoundProgress` 가 전부 이 모양이라
 * (current/total/cleared) 구조적 타이핑으로 그대로 받을 수 있다.
 */
export type PuzzleUIRoundProgress = {
	current: number,
	total: number,
	cleared: number,
}

/**
 * 퀘스트 결과의 공통 부분. 8개 퍼즐의 `*ResultData` 가 전부 이 필드를 포함한다.
 * (퍼즐별 고유 필드 - unpressedKeyCount 등 - 는 메인 UI 에서 쓰지 않는다)
 */
export type PuzzleQuestResultSource = {
	roundsCleared: number,
	roundCount: number,
	remainingTimeSeconds: number,
}

/** 메인 UI 가 결과 화면에 표시하는 정규화된 결과 */
export type PuzzleUIQuestResult = {
	puzzleId: EPuzzleId,
	isWin: boolean,
	roundsCleared: number,
	roundCount: number,
	remainingTimeSeconds: number,
}

/**
 * 레벨 하나를 가리키는 좌표.
 *
 * **레벨 하나 = 퀘스트 라운드 하나 = 기획 판(field) 하나** 이므로,
 * 난이도와 "그 난이도의 판 목록에서 몇 번째인지" 두 값이면 특정된다.
 * 난이도 오름차순으로 판을 이어 붙인 순서가 곧 레벨 번호다.
 */
export type PuzzleLevelRef = {
	/** 1-based 레벨 번호. 퍼즐 안에서 통용된다 */
	level: number,
	difficulty: number,
	/** 그 난이도의 판 목록에서의 순번 (0-based) */
	fieldOrdinal: number,
}

//#endregion

//#region View models (표현 계층에 넘기는 스냅샷)

export type PuzzleCatalogView = {
	id: EPuzzleId,
	displayName: string,
	subtitle: string,
	/** 레지스트리에 핸들이 등록되어 지금 플레이할 수 있는지 */
	isAvailable: boolean,
	/** 이 퍼즐의 총 레벨 수. 미등록이면 0 */
	levelCount: number,
	/** 마지막으로 클리어한 레벨. 없으면 0 */
	clearedLevel: number,
}

/** 상세 화면(퍼즐 하나가 화면을 꽉 채운 상태)이 그리는 값 */
export type PuzzleDetailView = {
	puzzleId: EPuzzleId | undefined,
	displayName: string,
	subtitle: string,
	/** 이 퍼즐의 총 레벨 수 */
	levelCount: number,
	/** 마지막으로 클리어한 레벨. 없으면 0 */
	clearedLevel: number,
	/** Continue 가 시작할 레벨 */
	continueLevel: number,
	/** Continue 를 누를 수 있는지 (클리어 기록이 있어야 한다) */
	canContinue: boolean,
	/** 마지막 레벨까지 전부 깼는지 */
	isCompleted: boolean,
}

export type PuzzleHudView = {
	puzzleId: EPuzzleId | undefined,
	displayName: string,
	/** 지금 플레이 중인 레벨 번호 (1-based) */
	level: number,
	/** 이 퍼즐의 총 레벨 수 */
	levelCount: number,
	/** 좌측 상단에 그대로 찍는 레벨 표시 - "LV 3 / 24" */
	levelLabel: string,
	remainingTimeSeconds: number,
	/** "1:05" 형태 - formatClockLabel() 결과. 결과 화면의 통계에 쓴다 */
	clockLabel: string,
	/** "45" 형태 - 상단 중앙 카운트다운은 초 단위로만 표시한다 */
	secondsLabel: string,
	/** 남은 시간이 10초 미만인지 - 빨간 점멸과 초읽기 소리의 조건 */
	isTimeCritical: boolean,
	round: PuzzleUIRoundProgress,
}

//#endregion

//#region Helpers

/**
 * 남은 시간이 이 값 **미만**이면 초읽기다 - 상단 중앙의 숫자가 빨갛게 점멸하고 소리가 난다
 * (worker/NextJob.md 1번).
 */
export const HUD_TIME_CRITICAL_SECONDS = 10;

/** 초읽기 점멸 주기 (초). 켜짐/꺼짐이 이 간격으로 번갈아 나온다 */
export const HUD_CRITICAL_BLINK_SECONDS = 0.5;

/**
 * 초를 그대로 초 라벨로 만든다 (예: 125 → "125", 9.3 → "10").
 *
 * 상단 중앙 카운트다운은 **분:초가 아니라 초 단위**다. 남은 시간이 한 자리로 떨어지는
 * 마지막 10초를 크게 읽히게 하려는 것이므로 자릿수를 맞추지 않는다.
 *
 * 올림을 쓰는 이유는 `formatClockLabel` 과 같다 - 0.2초 남았는데 "0" 이 뜨면
 * 아직 만질 수 있는 시간이 이미 끝난 것처럼 보인다.
 */
export function formatSecondsLabel(totalSeconds: number): string {
	return `${Math.max(0, Math.ceil(totalSeconds))}`;
}

/** 지금이 초읽기인지. 시간이 다 된 뒤(0초)는 점멸시키지 않는다 */
export function isTimeCritical(remainingSeconds: number): boolean {
	return remainingSeconds > 0 && remainingSeconds < HUD_TIME_CRITICAL_SECONDS;
}

/** 좌측 상단 레벨 표시. 총 레벨 수를 모르면 번호만 낸다 */
export function formatLevelLabel(level: number, levelCount: number): string {
	if (level <= 0) {
		return '';
	}
	return levelCount > 0 ? `LV ${level} / ${levelCount}` : `LV ${level}`;
}

/**
 * 초를 "분:초" 라벨로 만든다 (예: 125 → "2:05").
 * `padStart` 는 Horizon 에디터 lib 에 없으므로 수동으로 패딩한다 (`Documents/생성 문서/가이드/타입체크와_테스트_실행.md` §2).
 */
export function formatClockLabel(totalSeconds: number): string {
	const clamped = Math.max(0, Math.ceil(totalSeconds));
	const minutes = Math.floor(clamped / 60);
	const seconds = clamped % 60;
	const secondsLabel = seconds < 10 ? `0${seconds}` : `${seconds}`;
	return `${minutes}:${secondsLabel}`;
}

/** 빈 라운드 진행도 - HUD 초기값 */
export function createEmptyRoundProgress(): PuzzleUIRoundProgress {
	return { current: 0, total: 0, cleared: 0 };
}

//#endregion
