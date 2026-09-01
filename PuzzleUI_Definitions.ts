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
	{ id: EPuzzleId.LASER, orderIndex: 0, displayName: '레이저 해킹', subtitle: '크리스탈로 광선을 이어라' },
	{ id: EPuzzleId.RUSH_HOUR, orderIndex: 1, displayName: '러시아워', subtitle: 'USB 를 단자까지 밀어 넣어라' },
	{ id: EPuzzleId.COLOR_SORT, orderIndex: 2, displayName: '정렬', subtitle: '건전지를 색깔별로 모아라' },
	{ id: EPuzzleId.COLOR_FILL, orderIndex: 3, displayName: '색 채우기', subtitle: '바늘이 지날 때 정확히 터치' },
	{ id: EPuzzleId.FLOW, orderIndex: 4, displayName: '연결', subtitle: '전구를 빠짐없이 이어라' },
	{ id: EPuzzleId.CARD_MATCH, orderIndex: 5, displayName: '카드 맞추기', subtitle: '포탈 타일의 짝을 기억하라' },
	{ id: EPuzzleId.SLIDE_PUZZLE, orderIndex: 6, displayName: '슬라이드', subtitle: '조각을 밀어 그림을 완성하라' },
	{ id: EPuzzleId.SWITCH, orderIndex: 7, displayName: '스위치', subtitle: '모든 키를 녹색으로 눌러라' },
];

export function getCatalogEntry(id: EPuzzleId): PuzzleCatalogEntry | undefined {
	return PUZZLE_CATALOG.find((entry) => entry.id === id);
}

//#endregion

//#region Screens

/** 메인 UI 의 화면 상태 머신 */
export enum EPuzzleHubScreen {
	/** 퍼즐 선택 격자 */
	MAIN_MENU = 'MAIN_MENU',
	/** 선택한 퍼즐의 난이도 고르기 */
	DIFFICULTY_SELECT = 'DIFFICULTY_SELECT',
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

//#endregion

//#region View models (표현 계층에 넘기는 스냅샷)

export type PuzzleCatalogView = {
	id: EPuzzleId,
	displayName: string,
	subtitle: string,
	/** 레지스트리에 핸들이 등록되어 지금 플레이할 수 있는지 */
	isAvailable: boolean,
}

export type PuzzleSelectionView = {
	puzzleId: EPuzzleId | undefined,
	displayName: string,
	subtitle: string,
	/** 선택 가능한 난이도 목록 (오름차순) */
	difficulties: number[],
	selectedDifficulty: number,
}

export type PuzzleHudView = {
	puzzleId: EPuzzleId | undefined,
	displayName: string,
	difficulty: number,
	remainingTimeSeconds: number,
	/** "1:05" 형태 - formatClockLabel() 결과 */
	clockLabel: string,
	round: PuzzleUIRoundProgress,
}

//#endregion

//#region Helpers

/**
 * 초를 "분:초" 라벨로 만든다 (예: 125 → "2:05").
 * `padStart` 는 Horizon 에디터 lib 에 없으므로 수동으로 패딩한다 (진행 문서 §6.1.1).
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
