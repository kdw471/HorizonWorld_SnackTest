# Flow_GameEvents.ts — 주석 아카이브

> 원본 스크립트: `Flow_GameEvents.ts`
> 걷어낸 주석 15건 / 814 B 절감 (2,342 B → 1,528 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Flow Game Events - 연결 퍼즐의 이벤트 허브 (PUZ_05)

연출/UI/입력 어댑터는 이 이벤트만 구독하며 로직 클래스를 직접 참조하지 않는다 (PUZ_00 §7.1).

## `public readonly QUEST_START = new EventPublisher<string>();`

> 원본 L18

#region Quest / Round lifecycle

## `public readonly ROUND_PROGRESS_CHANGED = new EventPublisher<FlowRoundProgress>();`

> 원본 L27

 라운드 슬롯 표시 갱신 - PUZ_00 §2.1

## `public readonly LEVEL_LOADED = new EventPublisher<FlowLevel>();`

> 원본 L30

#endregion

## `public readonly LEVEL_LOADED = new EventPublisher<FlowLevel>();`

> 원본 L32

#region Board

## `public readonly DRAW_BEGAN = new EventPublisher<EFlowColor>();`

> 원본 L37

 그리기를 시작했다

## `public readonly NODE_LIT = new EventPublisher<{ color: EFlowColor, cell: FlowCell }>();`

> 원본 L39

 서브 오브젝트에 불이 들어왔다 - §5

## `public readonly NODE_UNLIT = new EventPublisher<FlowCell>();`

> 원본 L41

 되짚어서 서브 오브젝트의 불이 꺼졌다 - §6 지우기

## `public readonly PATH_COMPLETED = new EventPublisher<EFlowColor>();`

> 원본 L43

 한 색의 경로가 도착 지점까지 완결되었다

## `public readonly PATH_BROKEN = new EventPublisher<EFlowColor>();`

> 원본 L45

 완결되었던 경로가 다시 끊어졌다

## `public readonly EXTEND_REJECTED = new EventPublisher<string>();`

> 원본 L47

 이을 수 없는 칸으로 끌었다 (미리보기 비활성 사유 전달)

## `public readonly DRAW_ENDED = new EventPublisher<EFlowColor>();`

> 원본 L49

 손을 뗐다. 그린 경로는 유지된다 - §6

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L52

#endregion

## `public readonly TIME_CHANGED = new EventPublisher<number>();`

> 원본 L54

#region Timer / State

## `}`

> 원본 L62

#endregion

