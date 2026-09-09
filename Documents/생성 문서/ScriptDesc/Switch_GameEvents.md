# Switch_GameEvents.ts — 주석 아카이브

> 원본 스크립트: `Switch_GameEvents.ts`
> 걷어낸 주석 15건 / 1,103 B 절감 (2,729 B → 1,626 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Switch Puzzle Game Events - 스위치 퍼즐의 이벤트 허브 (PUZ_08)

연출/UI/입력 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).

## `public readonly QUEST_START = new EventPublisher<string>();`

> 원본 L18

#region Quest / Round lifecycle

## `public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<SwitchRoundProgress>();`

> 원본 L27

 라운드 슬롯 표시 갱신 - PUZ_00 §2.1

## `public readonly LEVEL_LOADED = new EventPublisher<SwitchLevel>();`

> 원본 L30

#endregion

## `public readonly LEVEL_LOADED = new EventPublisher<SwitchLevel>();`

> 원본 L32

#region Board

## `public readonly MASK_CHANGED = new EventPublisher<number[]>();`

> 원본 L37

스위치 영역 마스크가 바뀌었다 (라운드마다 다르다 - §6).
연출은 해킹 패널 우측의 3×3 미니 UI 에 녹색(영향 있음)/빨간색(영향 없음)으로 표시한다 (§9.5).

## `public readonly KEY_PRESSED = new EventPublisher<SwitchPressResult>();`

> 원본 L43

 키 캡이 눌렸다 - §7 0.0초, 중앙 키 캡의 눌림 연출을 재생한다

## `public readonly AREA_TOGGLED = new EventPublisher<SwitchPressResult>();`

> 원본 L45

 §7 0.2초 - 스위치 영역의 (영향받는) 키 캡 연출을 재생한다

## `public readonly PRESS_SEQUENCE_FINISHED = new EventPublisher<void>();`

> 원본 L47

 §7 0.4초 - 모든 연출이 끝났다. 이 시점에 클리어 판정을 한다 (§9.3)

## `public readonly PRESS_REJECTED = new EventPublisher<ESwitchRejection>();`

> 원본 L49

 입력이 거절되었다 (사유 포함)

## `public readonly UNPRESSED_COUNT_CHANGED = new EventPublisher<number>();`

> 원본 L52

 아직 눌리지 않은 키 캡 수가 바뀌었다 - 진행도 표시용

## `public readonly PUZZLE_COMPLETED = new EventPublisher<void>();`

> 원본 L55

 완성되었다 - 모든 키 캡이 녹색이 되었다 (§1 / §2)

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L58

#endregion

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L60

#region Timer / State

## `}`

> 원본 L68

#endregion

