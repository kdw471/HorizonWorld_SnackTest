# CardMatch_LevelGenerator.ts — 주석 아카이브

> 원본 스크립트: `CardMatch_LevelGenerator.ts`
> 걷어낸 주석 3건 / 685 B 절감 (7,216 B → 6,531 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Card Match Level Generator - 필드 생성 알고리즘 (PUZ_06 §9.1)

사양 §9.1:
  total   = sTileArrayX * sTileArrayY
  objects = total - iBombTile          // 반드시 짝수 (assert)
  pairs   = objects / 2
  -> iObjectGroupID 로 오브젝트 풀에서 pairs 종류를 뽑고 각 2개씩 생성
  -> 폭탄 iBombTile 개 추가
  -> 전체를 랜덤 셔플하여 타일에 배치

`iObjectTile` 이 홀수가 되는 테이블 값은 데이터 검증 단계에서 에러로 처리한다.

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `fieldIndex?: number,`

> 원본 L35

 특정 필드 데이터를 지정하고 싶을 때

## `export class CardMatchPlacementValidator {`

> 원본 L39

#region Validator

