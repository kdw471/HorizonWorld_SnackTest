# CardMatch_GameEvents.ts — 주석 아카이브

> 원본 스크립트: `CardMatch_GameEvents.ts`
> 걷어낸 주석 16건 / 994 B 절감 (2,699 B → 1,705 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Card Match Game Events - 카드 맞추기 퍼즐의 이벤트 허브 (PUZ_06)

연출/UI/입력 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).

## `public readonly QUEST_START = new EventPublisher<string>();`

> 원본 L18

#region Quest / Round lifecycle

## `public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<CardMatchRoundProgress>();`

> 원본 L27

 라운드 슬롯 표시 갱신 - PUZ_00 §2.1

## `public readonly LEVEL_LOADED = new EventPublisher<CardMatchLevel>();`

> 원본 L30

#endregion

## `public readonly LEVEL_LOADED = new EventPublisher<CardMatchLevel>();`

> 원본 L32

#region Board

## `public readonly TILE_REVEALED = new EventPublisher<RevealResult>();`

> 원본 L37

 포탈 타일이 활성화되었다 (결과 포함)

## `public readonly REVEAL_REJECTED = new EventPublisher<ERevealRejection>();`

> 원본 L39

 입력이 거절되었다 (사유 포함)

## `public readonly TILES_MATCHED = new EventPublisher<number[]>();`

> 원본 L42

 짝이 맞아 타일이 완료되었다 - §6 파란색 -> 녹색

## `public readonly TILES_MISMATCHED = new EventPublisher<number[]>();`

> 원본 L44

 짝이 틀려 되돌아갈 타일들 - §6 파란색 -> 검정색

## `public readonly TILES_HIDDEN = new EventPublisher<number[]>();`

> 원본 L46

 되돌아간 타일들이 다시 뒷면이 되었다

## `public readonly BOMB_TRIGGERED = new EventPublisher<{ tileIndex: number, shuffledTileIndexes: number[] }>();`

> 원본 L49

 폭탄이 나왔다 - 셔플 시작. 이 동안 입력과 제한 시간이 멈춘다 (§4)

## `public readonly BOMB_SHUFFLE_FINISHED = new EventPublisher<void>();`

> 원본 L51

 폭탄 셔플 연출이 끝나 입력과 제한 시간이 재개되었다

## `public readonly RESET_IGNORED = new EventPublisher<void>();`

> 원본 L54

 리셋 버튼이 눌렸지만 이 퍼즐에서는 동작하지 않는다 - §1 / §9.5

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L57

#endregion

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L59

#region Timer / State

## `}`

> 원본 L67

#endregion

