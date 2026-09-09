/**
 * Puzzle Board UI Texture Library - 텍스처 키 → 실제 그림을 잇는 유일한 지점
 *
 * 순수 계층(`PuzzleBoardUI_Definitions`)의 칸·슬롯은 텍스처를 **이름**으로만 들고 있다
 * (`'switch.pressed'`). 그 이름이 어떤 그림인지는 여기가 안다.
 *
 *   *_CoreAPI  --register(키, Asset)-->  TextureLibrary  --resolve(키)-->  Panel(Image)
 *      ▲                                                                     │
 *      └─ 에디터 prop 으로 받은 TextureAsset                        ImageSource 로 그린다
 *
 * ## 왜 파일을 따로 두는가
 *
 * `ImageSource` 는 `horizon/ui` 에 있다. 이것을 순수 계층에 들이면 Node 테스트가 통째로
 * 돌지 않으므로(PUZ_00 §7.1), 키만 순수 계층에 남기고 그림은 여기서 붙인다.
 * 테스트는 이 파일을 부르지 않는다 - 등록되지 않은 키는 색으로 그려질 뿐이라
 * 텍스처가 하나도 없어도 퍼즐은 그대로 돌아간다.
 *
 * ## 에디터에서 하는 일
 *
 *   1. PNG 를 애셋 라이브러리에 올린다 (Texture 애셋이 된다)
 *   2. 그 퍼즐 `*_CoreAPI` 의 텍스처 prop 에 애셋을 끼운다
 *   3. 끝. 비워 둔 prop 은 예전처럼 색으로 그려진다
 *
 * ## 싱글턴인 이유
 *
 * `PuzzleBoardStage` 와 같다 - Local 스크립트는 클라이언트마다 별도 JS 컨텍스트에서
 * 돌기 때문에 플레이어끼리 섞이지 않는다
 * (`Documents/생성 문서/설계/2026-09-02_멀티플레이_플랫폼에서_싱글플레이_구현_방안.md` §1.2).
 */

import { Asset, TextureAsset } from 'horizon/core';
import { ImageSource } from 'horizon/ui';
import { EventPublisher } from 'Utility_Events';
import { NO_TEXTURE, PuzzleTextureKey } from 'PuzzleBoardUI_Definitions';

/** `*_CoreAPI` 가 자기 요소의 텍스처를 한 번에 등록할 때 쓰는 묶음 */
export type PuzzleTextureBinding = {
	key: PuzzleTextureKey,
	/** 에디터 prop 에서 온 애셋. 비어 있으면 등록하지 않는다 */
	asset: Asset | undefined | null,
}

export class PuzzleTextureLibrary {
	private static _instance: PuzzleTextureLibrary | undefined = undefined;

	public static get instance(): PuzzleTextureLibrary {
		if (PuzzleTextureLibrary._instance === undefined) {
			PuzzleTextureLibrary._instance = new PuzzleTextureLibrary();
		}
		return PuzzleTextureLibrary._instance;
	}

	/**
	 * 등록 내용이 바뀌었다.
	 *
	 * 패널은 이미 그려 둔 `Image` 노드를 다시 만들 수 없으므로, 이 신호를 받으면
	 * 지금 화면에 있는 칸들을 **다시 반영**해 새 그림이 붙게 한다.
	 */
	public readonly CHANGED = new EventPublisher<void>();

	private readonly _sources: Map<PuzzleTextureKey, ImageSource> = new Map();

	/**
	 * 키 하나에 그림을 붙인다.
	 *
	 * 애셋이 비어 있으면 **등록하지 않고 조용히 넘어간다.** 에디터에서 아직 채우지 않은
	 * prop 이 정상 상태이기 때문이다 - 그 요소는 색으로 그려진다.
	 */
	public register(key: PuzzleTextureKey, asset: Asset | undefined | null): boolean {
		if (key === NO_TEXTURE || asset === undefined || asset === null) {
			return false;
		}
		this._sources.set(key, ImageSource.fromTextureAsset(asset.as(TextureAsset)));
		this.CHANGED.publish();
		return true;
	}

	/** 여러 개를 한 번에. 실제로 등록된 개수를 돌려준다 */
	public registerAll(bindings: PuzzleTextureBinding[]): number {
		let count = 0;
		for (const binding of bindings) {
			// register() 가 매번 CHANGED 를 내지 않도록 직접 채우고 마지막에 한 번만 알린다
			if (binding.key === NO_TEXTURE || binding.asset === undefined || binding.asset === null) {
				continue;
			}
			this._sources.set(binding.key, ImageSource.fromTextureAsset(binding.asset.as(TextureAsset)));
			count++;
		}
		if (count > 0) {
			this.CHANGED.publish();
		}
		return count;
	}

	/** 그림을 찾는다. 등록되지 않은 키는 `null` - `Image` 가 아무것도 그리지 않는다 */
	public resolve(key: PuzzleTextureKey): ImageSource | null {
		if (key === NO_TEXTURE) {
			return null;
		}
		return this._sources.get(key) ?? null;
	}

	public has(key: PuzzleTextureKey): boolean {
		return key !== NO_TEXTURE && this._sources.has(key);
	}

	public get size(): number {
		return this._sources.size;
	}

	/** 테스트·재시작용. 등록을 전부 지운다 */
	public clear(): void {
		if (this._sources.size === 0) {
			return;
		}
		this._sources.clear();
		this.CHANGED.publish();
	}
}
