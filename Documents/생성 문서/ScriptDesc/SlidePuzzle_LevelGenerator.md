# SlidePuzzle_LevelGenerator.ts — 주석 아카이브

> 원본 스크립트: `SlidePuzzle_LevelGenerator.ts`
> 걷어낸 주석 4건 / 939 B 절감 (6,271 B → 5,332 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Slide Puzzle Level Generator - 역순 셔플 생성기 (PUZ_07 §8 / §12.2)

사양 §8:
  "이미지 조각은 완성 상태에서 역순으로 섞는다.
   직전에 이동한 위치로는 이동되지 않는다.
   섞는 횟수(N)는 테이블 변수(iShuffleNum)로 지정한다."

  "이 방식은 항상 풀 수 있는(solvable) 배치를 보장한다.
   무작위 순열 셔플을 사용하면 절반이 풀 수 없는 배치가 되므로 절대 사용하지 말 것."

셔플 자체는 `SlidePuzzleBoard.shuffle()` 이 수행한다.
여기서는 테이블에서 값을 읽어 레벨을 만들고, 결과가 실제로 풀 수 있는지 확인한다.

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `fieldIndex?: number,`

> 원본 L35

 특정 필드 데이터를 지정하고 싶을 때

## `maxAttempts?: number,`

> 원본 L37

 재시도 횟수 상한 (섞었는데 완성 상태로 돌아온 경우 대비)

## `export class SlidePlacementValidator {`

> 원본 L43

#region Validator

