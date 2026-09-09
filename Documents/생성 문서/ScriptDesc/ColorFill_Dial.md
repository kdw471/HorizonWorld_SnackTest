# ColorFill_Dial.ts — 주석 아카이브

> 원본 스크립트: `ColorFill_Dial.ts`
> 걷어낸 주석 6건 / 956 B 절감 (8,747 B → 7,791 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Color Fill Dial - 다이얼 + 회전 바늘의 순수 상태 머신 (PUZ_04)

사양 §5 정화 규칙 / §6 다이얼 바늘 / §8.1~§8.4 구현.

핵심은 §6 의 이중 효과다.
  **터치 = 방향 반전이 항상 발생하고, 바늘이 오염 칸 위에 있을 때만 추가로 정화가 발생한다.**

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `isInputLockedDuringReverse?: boolean,`

> 원본 L32

방향 전환 딜레이 동안 입력을 잠글지 - §8.3
"reverseDelay 동안은 방향 전환 연출/입력 잠금 처리 여부를 파라미터로 둔다."

## `private _pendingReverseSeconds: number = 0;`

> 원본 L47

 방향 반전까지 남은 시간. 0 이하면 대기 중인 반전이 없다

## `public get hasPendingReverse(): boolean {`

> 원본 L63

 방향 반전 대기 중인지 - 연출에서 쓴다

## `public get isInputAccepted(): boolean {`

> 원본 L68

 지금 입력을 받을 수 있는지

## `console.warn(`[ColorFillDial] Slot array length is ${slots.length}; expected ${DIAL_SLOT_COUNT}. Falling back…`

> 원본 L78

전부 비활성 슬롯으로 대체되면 isSolved() 가 영원히 false 가 되어
시간초과 패배만 가능해진다. 조용히 넘어가지 말고 알린다.

