# SlidePuzzle_GameEvents.ts — 주석 아카이브

> 원본 스크립트: `SlidePuzzle_GameEvents.ts`
> 걷어낸 주석 13건 / 991 B 절감 (2,499 B → 1,508 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Slide Puzzle Game Events - 슬라이드 퍼즐의 이벤트 허브 (PUZ_07)

연출/UI/입력 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).

## `public readonly QUEST_START = new EventPublisher<string>();`

> 원본 L18

#region Quest / Round lifecycle

## `public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<SlidePuzzleRoundProgress>();`

> 원본 L27

 라운드 슬롯 표시 갱신 - PUZ_00 §2.1

## `public readonly LEVEL_LOADED = new EventPublisher<SlidePuzzleLevel>();`

> 원본 L30

#endregion

## `public readonly LEVEL_LOADED = new EventPublisher<SlidePuzzleLevel>();`

> 원본 L32

#region Board

## `public readonly PIECE_MOVE_STARTED = new EventPublisher<SlideMoveResult>();`

> 원본 L37

 조각이 미끄러지기 시작했다 - §6, S_PieceMove_SFX 를 재생한다

## `public readonly PIECE_MOVE_FINISHED = new EventPublisher<void>();`

> 원본 L39

 0.25초 이동 연출이 끝났다 - 이 시점에 완성 판정을 한다 (§12.6)

## `public readonly MOVE_REJECTED = new EventPublisher<ESlideRejection>();`

> 원본 L41

 입력이 거절되었다 (사유 포함)

## `public readonly MOVABLE_POSITIONS_CHANGED = new EventPublisher<number[]>();`

> 원본 L44

지금 누를 수 있는 조각 목록이 바뀌었다 - §5.
연출은 이 위치들의 모서리에 Emissive(#FF5C41)를 켜고 S_PieceHover_SFX 를 재생한다.

## `public readonly PUZZLE_COMPLETED = new EventPublisher<string>();`

> 원본 L50

완성되었다 - §9.
빈 조각을 표시하고 간격을 0으로 좁힌 뒤, 원본 이미지를 1초간 보여 주고
S_PUZ07_Success_SFX 를 재생한다.

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L57

#endregion

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L59

#region Timer / State

## `}`

> 원본 L67

#endregion

