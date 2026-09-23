/**
 * Puzzle UI Persistent Progress - 진행도를 플레이어 영구 변수에 얹는 저장소와 그 중계 배선
 *
 * `PuzzleUI_Progress.ts` 의 `IPuzzleProgressStorage` 구현이다.
 * 순수 계층과 분리해 둔 이유는 여기만 `horizon/core` 를 알기 때문이다 (PUZ_00 §7.1).
 *
 * ## 왜 서버를 거치나
 *
 * **Persistent Variables API 는 Local 스크립트에서 쓸 수 없다** (공식 제약,
 * `Documents/생성 문서/설계/Horizon_실행모드_제약과_규칙.md` §4). 허브 패널
 * `PuzzleUI_MainPanel` 은 Local 이라 직접 부르면 실패하고, 그 결과 월드를 나가는 순간
 * 진행도가 사라졌다. 그래서 실제 읽기·쓰기는 Default(서버) 로 도는
 * `Puzzle_ProgressServer.ts` 가 하고 로컬 패널은 네트워크 이벤트로 부탁만 한다.
 *
 *   [Local] MainPanel  --REQUEST(broadcast)-->  [Default] Puzzle_ProgressServer
 *   [Local] MainPanel  <--LOADED(to player)---  [Default] Puzzle_ProgressServer
 *   [Local] MainPanel  --SAVE(broadcast)----->  [Default] Puzzle_ProgressServer
 *
 * 읽기가 비동기가 되므로 **허브는 진행도가 도착하기 전에도 그려진다.** 응답은
 * `PuzzleProgressTracker.hydrate()` 로 뒤늦게 합쳐지고 그때 메뉴만 다시 그린다.
 *
 * ## 에디터에서 해야 하는 설정 (1회)
 *
 *   1. Systems > **Variable Groups** 에서 새 그룹을 만든다 (예: `PuzzleHub`).
 *   2. 그 그룹에 변수를 하나 추가한다. 이름 `progress`, 타입 **String**.
 *   3. 빈 엔티티에 `Puzzle_ProgressServer` 를 붙이고 실행 모드를 **Default(서버)** 로 둔다.
 *      `Puzzle_LocalOwnership` 의 `targets` 에는 **넣지 않는다** - 넣으면 소유권이 넘어가
 *      영구 변수를 못 읽는 그 자리로 돌아간다.
 *   4. `PuzzleUI_MainPanel` 과 `Puzzle_ProgressServer` 의 `progressVariableKey` 를
 *      `PuzzleHub:progress` 로 **같게** 둔다 (기본값이 이미 그것이다).
 *
 * **설정하지 않아도 게임은 돈다.** 서버 스크립트가 없거나 변수 그룹이 없으면 그 세션 안에서만
 * Continue 가 동작하고 월드를 나가면 초기화된다. 어느 쪽인지는 콘솔 로그로 알린다.
 *
 * ## 왜 String 변수에 JSON 을 넣나
 *
 * 퍼즐 8종의 진행도를 변수 8개로 나누면 에디터 설정이 8배가 되고 퍼즐이 늘 때마다
 * 설정을 고쳐야 한다. 한 문자열에 `{"LASER":3,"SWITCH":1}` 형태로 담으면
 * 에디터 설정은 영원히 하나면 된다. 8종 전부를 담아도 100바이트가 안 된다.
 */

import { NetworkEvent, Player, World } from 'horizon/core';
import {
	IPuzzleProgressStorage,
	PuzzleProgressSnapshot,
	parseProgressSnapshot,
	stringifyProgressSnapshot,
} from 'PuzzleUI_Progress';

/** 기본 변수 키. `그룹이름:변수이름` 형식이다 */
export const DEFAULT_PROGRESS_VARIABLE_KEY = 'PuzzleHub:progress';

//#region Network events (Local 패널 ↔ Default 서버 스크립트)

/** 로컬 패널이 자기 진행도를 달라고 한다. 서버가 브로드캐스트를 받는다 */
export type PuzzleProgressRequestPayload = { player: Player };
/** 서버가 그 플레이어에게만 돌려주는 응답. `raw` 는 저장된 JSON 문자열 */
export type PuzzleProgressLoadedPayload = { raw: string };
/** 로컬 패널이 저장을 부탁한다. 서버가 검증한 뒤 쓴다 */
export type PuzzleProgressSavePayload = { player: Player, raw: string };

/**
 * 이름은 **양쪽 스크립트가 같은 문자열**을 써야 붙는다. 그래서 여기 한곳에만 둔다.
 *
 * `LocalEvent` 가 아니라 `NetworkEvent` 다 - 로컬 이벤트는 소유자가 같은 것끼리만 오가므로
 * Local 패널과 서버 스크립트 사이를 건너지 못한다.
 */
export const PuzzleProgressNetworkEvents = {
	REQUEST: new NetworkEvent<PuzzleProgressRequestPayload>('PuzzleProgress.Request'),
	LOADED: new NetworkEvent<PuzzleProgressLoadedPayload>('PuzzleProgress.Loaded'),
	SAVE: new NetworkEvent<PuzzleProgressSavePayload>('PuzzleProgress.Save'),
};

//#endregion

//#region Local 쪽 - 서버에 중계하는 저장소

/**
 * 로컬 패널이 쓰는 저장소. 스스로는 아무것도 읽지 않고 쓰지 않는다.
 *
 * `load()` 가 빈 스냅샷인 것은 실패가 아니라 **아직 응답이 오지 않았다**는 뜻이다.
 * 도착한 값은 `PuzzleProgressTracker.hydrate()` 로 들어간다.
 */
export class RelayProgressStorage implements IPuzzleProgressStorage {
	private readonly _send: (raw: string) => void;

	constructor(send: (raw: string) => void) {
		this._send = send;
	}

	public load(): PuzzleProgressSnapshot {
		return {};
	}

	public save(snapshot: PuzzleProgressSnapshot): void {
		this._send(stringifyProgressSnapshot(snapshot));
	}
}

//#endregion

//#region 서버 쪽 - 영구 변수 직접 접근

/**
 * 영구 변수를 직접 읽고 쓴다. **Default(서버) 실행 모드에서만 쓴다** -
 * Local 스크립트에서 부르면 조용히 실패한다 (그것이 이 파일이 생긴 이유다).
 */
export class HorizonProgressStorage implements IPuzzleProgressStorage {
	private readonly _world: World;
	private readonly _player: Player;
	private readonly _key: string;

	constructor(world: World, player: Player, key: string) {
		this._world = world;
		this._player = player;
		this._key = key;
	}

	public load(): PuzzleProgressSnapshot {
		try {
			const raw = this._world.persistentStorage.getPlayerVariable<string>(this._player, this._key);
			return parseProgressSnapshot(raw);
		}
		catch (error) {
			// 변수 그룹이 없으면 여기서 던진다. 진행도가 없는 것으로 보고 넘어간다.
			console.warn(`[PuzzleProgress] Could not read "${this._key}": ${error}`);
			return {};
		}
	}

	public save(snapshot: PuzzleProgressSnapshot): void {
		try {
			this._world.persistentStorage.setPlayerVariable(this._player, this._key, stringifyProgressSnapshot(snapshot));
		}
		catch (error) {
			console.warn(`[PuzzleProgress] Could not write "${this._key}": ${error}`);
		}
	}
}

/**
 * 영구 저장소를 쓸 수 있는지 확인한다. **서버에서만 의미가 있다.**
 *
 * 변수 그룹이 설정되지 않은 월드에서 `getPlayerVariable` 은 던지거나 null 을 돌려준다.
 * **null 은 "아직 아무것도 저장하지 않았다" 와 구분되지 않으므로 실패로 보지 않는다** -
 * 처음 플레이하는 사람도 null 을 받기 때문이다. 던지는 경우만 사용 불가로 판정한다.
 */
export function canUsePersistentStorage(world: World, player: Player, key: string): boolean {
	if (key === '') {
		return false;
	}
	try {
		world.persistentStorage.getPlayerVariable<string>(player, key);
		return true;
	}
	catch (error) {
		console.warn(`[PuzzleProgress] Persistent variable "${key}" is not available: ${error}`);
		return false;
	}
}

//#endregion
