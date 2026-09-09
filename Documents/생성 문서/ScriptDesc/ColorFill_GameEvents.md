# ColorFill_GameEvents.ts — 주석 아카이브

> 원본 스크립트: `ColorFill_GameEvents.ts`
> 걷어낸 주석 13건 / 852 B 절감 (2,285 B → 1,433 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Color Fill Game Events - 색 채우기 퍼즐의 이벤트 허브 (PUZ_04)

연출/UI/입력 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).

## `public readonly QUEST_START = new EventPublisher<string>();`

> 원본 L17

#region Quest / Round lifecycle

## `public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<ColorFillRoundProgress>();`

> 원본 L26

 라운드 슬롯 표시 갱신 - PUZ_00 §2.1

## `public readonly LEVEL_LOADED = new EventPublisher<ColorFillLevel>();`

> 원본 L29

#endregion

## `public readonly LEVEL_LOADED = new EventPublisher<ColorFillLevel>();`

> 원본 L31

#region Dial

## `public readonly TOUCHED = new EventPublisher<TouchResult>();`

> 원본 L36

 터치가 처리되었다 (무시된 경우 포함)

## `public readonly SLOTS_PURIFIED = new EventPublisher<number[]>();`

> 원본 L39

오염 덩어리가 정화되었다 - §5.
페이로드는 정화된 칸 index 목록이다. 연출은 MainColor 를 0 -> 1 로 올리면 된다.

## `public readonly REVERSE_SCHEDULED = new EventPublisher<void>();`

> 원본 L45

 방향 반전이 예약되었다 (딜레이 시작) - §6

## `public readonly DIRECTION_CHANGED = new EventPublisher<number>();`

> 원본 L47

 방향 반전이 실제로 적용되었다. 페이로드는 새 방향(+1 / -1)

## `public readonly NEEDLE_SLOT_CHANGED = new EventPublisher<number>();`

> 원본 L50

 바늘이 다른 칸으로 넘어갔다. 페이로드는 새 칸 index

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L53

#endregion

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L55

#region Timer / State

## `}`

> 원본 L63

#endregion

