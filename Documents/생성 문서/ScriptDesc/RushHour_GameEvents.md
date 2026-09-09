# RushHour_GameEvents.ts — 주석 아카이브

> 원본 스크립트: `RushHour_GameEvents.ts`
> 걷어낸 주석 24건 / 1,385 B 절감 (2,900 B → 1,515 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Rush Hour Game Events - 러시아워 퍼즐의 이벤트 허브

Basics_GameEvents 와 동일한 규약(EventPublisher 모음)을 따르되,
러시아워 규칙에 필요한 이벤트만 노출한다.
연출/UI/VR 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).

## `public readonly QUEST_START = new EventPublisher<string>();`

> 원본 L20

#region Quest / Round lifecycle

## `public readonly QUEST_START = new EventPublisher<string>();`

> 원본 L22

 퍼즐 퀘스트 시작 (퀘스트 ID)

## `public readonly QUEST_CLEAR = new EventPublisher<RushHourResultData>();`

> 원본 L24

 모든 라운드를 클리어

## `public readonly QUEST_FAILED = new EventPublisher<RushHourResultData>();`

> 원본 L26

 제한 시간 초과 등으로 실패 - 기획서 §2

## `public readonly GAME_END = new EventPublisher<RushHourResultData>();`

> 원본 L28

 승패와 무관한 종료 (결과 데이터 포함)

## `public readonly ROUND_START = new EventPublisher<number>();`

> 원본 L31

 라운드 시작 (0-based 인덱스)

## `public readonly ROUND_CLEAR = new EventPublisher<number>();`

> 원본 L33

 라운드 클리어

## `public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<RushHourRoundProgress>();`

> 원본 L35

 라운드 슬롯 표시 갱신 - PUZ_00 §2.1

## `public readonly LEVEL_LOADED = new EventPublisher<RushHourLevel>();`

> 원본 L38

#endregion

## `public readonly LEVEL_LOADED = new EventPublisher<RushHourLevel>();`

> 원본 L40

#region Board

## `public readonly LEVEL_LOADED = new EventPublisher<RushHourLevel>();`

> 원본 L42

 새 배치를 불러왔을 때 (어댑터가 3D 에셋을 스폰하는 시점)

## `public readonly LEVEL_UNLOADED = new EventPublisher<void>();`

> 원본 L44

 보드를 비웠을 때

## `public readonly PIECE_MOVED = new EventPublisher<RushHourMove>();`

> 원본 L47

 오브젝트가 실제로 이동했을 때

## `public readonly MOVE_REJECTED = new EventPublisher<RushHourMove>();`

> 원본 L49

 축 위반 / 막힘 등으로 이동이 거절되었을 때

## `public readonly GOAL_REACHED = new EventPublisher<RushHourPiece>();`

> 원본 L52

 목표 USB 가 도착 포인트에 도달

## `public readonly GOAL_LEFT = new EventPublisher<RushHourPiece>();`

> 원본 L54

 도달했던 목표 USB 가 다시 빠져나옴

## `public readonly USB_DOCKED = new EventPublisher<RushHourPiece>();`

> 원본 L57

 목표 USB 가 단자에 결합됨 - 모바일 사양 §9 "결합 성공 이펙트(LED, 진동)" 트리거

## `public readonly USB_UNDOCKED = new EventPublisher<RushHourPiece>();`

> 원본 L59

 결합됐던 목표 USB 가 분리됨 - §9

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L62

#endregion

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L64

#region Timer / State

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L66

 남은 시간(초)이 바뀔 때

## `public readonly STATE_CHANGED = new EventPublisher<ERushHourState>();`

> 원본 L68

 상태 머신 전이

## `}`

> 원본 L74

#endregion

