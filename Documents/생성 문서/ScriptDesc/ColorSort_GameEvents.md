# ColorSort_GameEvents.ts — 주석 아카이브

> 원본 스크립트: `ColorSort_GameEvents.ts`
> 걷어낸 주석 15건 / 839 B 절감 (2,430 B → 1,591 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Color Sort Game Events - 정렬 퍼즐의 이벤트 허브 (PUZ_03)

연출/UI/입력 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).

## `public readonly QUEST_START = new EventPublisher<string>();`

> 원본 L18

#region Quest / Round lifecycle

## `public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<ColorSortRoundProgress>();`

> 원본 L27

 라운드 슬롯 표시 갱신 - PUZ_00 §2.1

## `public readonly LEVEL_LOADED = new EventPublisher<ColorSortLevel>();`

> 원본 L30

#endregion

## `public readonly LEVEL_LOADED = new EventPublisher<ColorSortLevel>();`

> 원본 L32

#region Board

## `public readonly BATTERIES_MOVED = new EventPublisher<ColorSortMove>();`

> 원본 L37

 건전지 뭉치가 옮겨졌다

## `public readonly MOVE_REJECTED = new EventPublisher<EMoveRejection>();`

> 원본 L39

 놓을 수 없는 곳에 놓아 이동이 거절되었다

## `public readonly BATTERY_REVEALED = new EventPublisher<string[]>();`

> 원본 L42

 블랙 건전지가 공개되었다 - §7

## `public readonly CASE_CLOSED = new EventPublisher<number>();`

> 원본 L44

 케이스가 같은 색으로 가득 차 닫혔다 - §4

## `public readonly RESPAWN_STARTED = new EventPublisher<number>();`

> 원본 L47

 영역 밖 드랍으로 리스폰 대기에 들어갔다 (케이스 잠금) - §8

## `public readonly RESPAWN_FINISHED = new EventPublisher<number>();`

> 원본 L49

 리스폰이 끝나 케이스 잠금이 풀렸다 - §8

## `public readonly DEADLOCK_DETECTED = new EventPublisher<void>();`

> 원본 L52

 이동 가능한 건전지가 없어 데드락이 되었다 - §2

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L55

#endregion

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L57

#region Timer / State

## `}`

> 원본 L65

#endregion

