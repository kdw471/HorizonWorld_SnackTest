/**
 * Puzzle Progress Server - 진행도 영구 변수를 대신 읽고 써 주는 서버 컴포넌트
 *
 * ## 왜 필요한가
 *
 * **Persistent Variables API 는 Local 스크립트에서 쓸 수 없다**
 * (`Documents/생성 문서/설계/Horizon_실행모드_제약과_규칙.md` §4).
 * 허브 패널 `PuzzleUI_MainPanel` 은 Local 이라 직접 부르면 실패했고, 그래서 월드를
 * 나가는 순간 Continue 진행도가 사라졌다. 이 컴포넌트가 그 호출을 서버로 옮겨 받는다.
 *
 *   REQUEST(브로드캐스트)  -> 그 플레이어의 변수를 읽어 LOADED 로 돌려준다
 *   SAVE(브로드캐스트)     -> 받은 문자열을 검증해서 그 플레이어의 변수에 쓴다
 *
 * 이벤트 정의와 페이로드는 `PuzzleUI_PersistentProgress.ts` 에 있다. 양쪽이 같은 이름을
 * 써야 붙기 때문에 한곳에만 둔다.
 *
 * ## 붙이는 법
 *
 *   1. 빈 엔티티를 만들고 이 스크립트를 붙인다. 월드에 **하나만** 둔다.
 *   2. 실행 모드는 **Default(서버)** 로 둔다.
 *   3. `Puzzle_LocalOwnership` 의 `targets` 에는 **넣지 않는다** - 소유권이 플레이어에게
 *      넘어가면 이 스크립트도 로컬이 되어 영구 변수를 못 읽는 그 자리로 돌아간다.
 *   4. `progressVariableKey` 를 `PuzzleUI_MainPanel` 과 같게 둔다 (기본값이 이미 같다).
 *
 * 이 엔티티가 없어도 게임은 돈다. 허브가 응답을 기다리다 포기하고 메모리 저장으로 남을 뿐이다
 * (그러면 월드를 나갈 때 진행도가 사라진다). 콘솔에 그 경고가 찍힌다.
 */

import { Component, Player, PropTypes } from 'horizon/core';
import { parseProgressSnapshot, stringifyProgressSnapshot } from 'PuzzleUI_Progress';
import {
	DEFAULT_PROGRESS_VARIABLE_KEY,
	HorizonProgressStorage,
	PuzzleProgressNetworkEvents,
	canUsePersistentStorage,
} from 'PuzzleUI_PersistentProgress';

export class PuzzleProgressServer extends Component<typeof PuzzleProgressServer> {
	public static propsDefinition = {
		/**
		 * 진행도를 담을 플레이어 영구 변수 키 (`그룹이름:변수이름`).
		 * `PuzzleUI_MainPanel.progressVariableKey` 와 같아야 한다.
		 */
		progressVariableKey: { type: PropTypes.String, default: DEFAULT_PROGRESS_VARIABLE_KEY },
	};

	/** 변수 그룹이 실제로 있는지. 첫 요청 때 한 번만 판정하고 그 결과를 로그로 남긴다 */
	private _isAvailable: boolean | undefined = undefined;

	public start(): void {
		if (this.entity.owner.get() !== this.world.getServerPlayer()) {
			// 소유권이 넘어간 상태에서는 영구 변수를 읽을 수 없다. 조용히 죽는 것보다 알리는 편이 낫다.
			console.warn('[PuzzleProgressServer] This entity is owned by a player. '
				+ 'Set the execution mode to Default and remove it from Puzzle_LocalOwnership.targets.');
			return;
		}

		this.connectNetworkBroadcastEvent(
			PuzzleProgressNetworkEvents.REQUEST,
			(payload) => this.onRequest(payload.player),
		);
		this.connectNetworkBroadcastEvent(
			PuzzleProgressNetworkEvents.SAVE,
			(payload) => this.onSave(payload.player, payload.raw),
		);

		console.log(`[PuzzleProgressServer] Ready. Variable key: "${this.props.progressVariableKey ?? ''}"`);
	}

	private onRequest(player: Player): void {
		const key = this.props.progressVariableKey ?? '';
		if (!this.ensureAvailable(player, key)) {
			// 응답은 보낸다. 빈 진행도라도 도착해야 허브가 기다리기를 멈춘다.
			this.sendNetworkEvent(player, PuzzleProgressNetworkEvents.LOADED, { raw: '' });
			return;
		}

		const snapshot = new HorizonProgressStorage(this.world, player, key).load();
		this.sendNetworkEvent(player, PuzzleProgressNetworkEvents.LOADED, {
			raw: stringifyProgressSnapshot(snapshot),
		});
	}

	private onSave(player: Player, raw: string): void {
		const key = this.props.progressVariableKey ?? '';
		if (!this.ensureAvailable(player, key)) {
			return;
		}

		// 받은 문자열을 그대로 쓰지 않는다. 한 번 파싱해서 형식이 어긋난 값을 걸러 낸다.
		new HorizonProgressStorage(this.world, player, key).save(parseProgressSnapshot(raw));
	}

	private ensureAvailable(player: Player, key: string): boolean {
		if (this._isAvailable === undefined) {
			this._isAvailable = canUsePersistentStorage(this.world, player, key);
			if (this._isAvailable) {
				console.log(`[PuzzleProgressServer] Progress is stored in the persistent variable "${key}".`);
			}
			else {
				console.warn(`[PuzzleProgressServer] Persistent variable "${key}" is not usable. `
					+ 'Progress will not survive leaving the world. Create the variable group in Systems > Variable Groups.');
			}
		}
		return this._isAvailable;
	}
}
Component.register(PuzzleProgressServer);
