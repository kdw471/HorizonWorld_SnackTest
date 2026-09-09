# ColorFill_LevelGenerator.ts — 주석 아카이브

> 원본 스크립트: `ColorFill_LevelGenerator.ts`
> 걷어낸 주석 5건 / 1,354 B 절감 (12,407 B → 11,053 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Color Fill Level Generator - 항상 클리어 가능한 다이얼 배치를 만드는 생성기 (PUZ_04 §8.5 / §8.6)

사양 §8.5:
  "난이도 표의 활성화 칸 수와 오염 그룹 구성을 입력받아, 18칸 원형 배열 위에
   지정된 크기의 오염 덩어리들을 서로 인접하지 않게(그룹이 합쳐지지 않게) 배치한다.
   활성화 영역은 연속/분산 모두 허용한다."

사양 §8.6:
  "밸런싱 검증: 자동 플레이 봇으로 제한 시간 내 클리어 가능 여부를 시뮬레이션한다."

이 퍼즐은 배치 자체는 언제나 풀 수 있다(바늘이 한 바퀴 돌면 모든 칸을 지난다).
따라서 검증의 핵심은 "해가 있는가" 가 아니라 **"제한 시간 안에 끝낼 수 있는가"** 다.

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `clearTimeMarginRatio?: number,`

> 원본 L45

봇이 제한 시간의 이 비율 안에 끝내야 채택한다.
1.0 이면 아슬아슬한 레벨도 통과하므로 약간의 여유를 둔다.

## `const MIN_VERIFICATION_REACTION_SECONDS = 0.05;`

> 원본 L55

 검증 봇 반응 시간의 상·하한 (초)

## `function getVerificationReactionSeconds(level: ColorFillLevel): number {`

> 원본 L59

검증 봇이 쓸 반응 시간.
가장 좁은 오염 덩어리가 바늘 아래를 지나가는 시간보다 짧게 잡아야
"충분히 빠른 플레이어라면 풀 수 있는가"를 제대로 잴 수 있다.

## `export class ColorFillPlacementValidator {`

> 원본 L84

#region Validator

