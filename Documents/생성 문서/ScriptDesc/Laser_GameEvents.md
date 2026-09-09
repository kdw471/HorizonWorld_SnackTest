# Laser_GameEvents.ts — 주석 아카이브

> 원본 스크립트: `Laser_GameEvents.ts`
> 걷어낸 주석 13건 / 920 B 절감 (2,379 B → 1,459 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Laser Game Events - 레이저 해킹 퍼즐의 이벤트 허브 (PUZ_01)

연출/UI/입력 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).

## `public readonly QUEST_START = new EventPublisher<string>();`

> 원본 L17

#region Quest / Round lifecycle

## `public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<LaserRoundProgress>();`

> 원본 L26

 라운드 슬롯 표시 갱신 - PUZ_00 §2.1

## `public readonly LEVEL_LOADED = new EventPublisher<LaserLevel>();`

> 원본 L29

#endregion

## `public readonly LEVEL_LOADED = new EventPublisher<LaserLevel>();`

> 원본 L31

#region Board

## `public readonly CRYSTAL_PLACED = new EventPublisher<{ crystalId: string, row: number, col: number }>();`

> 원본 L36

 크리스탈이 필드에 놓임 (crystalId, row, col 는 배치 로컬 좌표)

## `public readonly CRYSTAL_RETURNED = new EventPublisher<string>();`

> 원본 L38

 크리스탈이 인벤토리로 회수됨

## `public readonly PLACEMENT_REJECTED = new EventPublisher<{ crystalId: string, reason: string }>();`

> 원본 L40

 배치가 거절됨 (칸이 막혔거나 영역 밖)

## `public readonly BEAM_UPDATED = new EventPublisher<LaserTraceResult>();`

> 원본 L43

배치가 바뀔 때마다 광선을 다시 계산해 알린다 - §8.2 "배치 변경 시마다 전체 광선을 즉시 재계산".
연출 계층은 이 이벤트만 보고 광선과 오브젝트 상태를 갱신하면 된다.

## `public readonly SKULL_HIT = new EventPublisher<void>();`

> 원본 L49

 해골에 광선이 닿아 모든 수신체가 Fault 가 됨 - §3 4.2.1

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L52

#endregion

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L54

#region Timer / State

## `}`

> 원본 L62

#endregion

