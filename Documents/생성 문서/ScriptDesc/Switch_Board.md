# Switch_Board.ts — 주석 아카이브

> 원본 스크립트: `Switch_Board.ts`
> 걷어낸 주석 9건 / 1,101 B 절감 (10,637 B → 9,536 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Switch Board - 5×5 키 판의 순수 상태 머신 (PUZ_08)

사양 §5 키 캡 / §6 스위치 영역 / §7 조작 연출 / §9 구현 요구사항.

누름 연출 상태 (§7)
  IDLE -> SEQUENCE(0.4초, 전체 입력 잠금) -> IDLE,  완성 시 LOCKED_CLEARED
  0.0초 중앙 누름 → 0.2초 영역 연출 → 0.4초 종료.
  토글 자체(논리 상태)는 누르는 즉시 반영하고, 타이머는 연출 잠금에만 쓴다.
  클리어 판정은 연출이 끝나는 시점(0.4초)에 한다.

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `export type SwitchBoardProgress = {`

> 원본 L35

 update() 진행 결과. 연출 단계 도달 여부를 세션이 이벤트로 옮긴다

## `didReachAreaPhase: boolean,`

> 원본 L37

 0.2초 - 영역 연출을 시작할 시점에 도달했다 (§7)

## `didFinishSequence: boolean,`

> 원본 L39

 0.4초 - 모든 연출이 끝났다 (§7)

## `didClear: boolean,`

> 원본 L41

 연출 종료 시점의 클리어 판정 - §9.3

## `private _sequenceElapsed: number = 0;`

> 원본 L52

 연출 시작 후 경과 시간

## `private _isAreaPhasePending: boolean = false;`

> 원본 L54

 0.2초 영역 연출 신호를 아직 안 보냈는지

## `private _lastPressPosition: number = -1;`

> 원본 L57

 마지막 누름 정보 - 연출 계층이 참조한다

## `public get isInputAccepted(): boolean {`

> 원본 L73

 지금 입력을 받을 수 있는지 - §7

