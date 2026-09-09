# Laser_Board.ts — 주석 아카이브

> 원본 스크립트: `Laser_Board.ts`
> 걷어낸 주석 5건 / 780 B 절감 (10,111 B → 9,331 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Laser Board - 5x5 배치 영역 + 테두리 기믹의 순수 상태 머신 (PUZ_01)

사양 §2 / §5:
  - 크리스탈 배치 영역은 5×5 고정
  - 주변 1칸 테두리는 발사체/수신체 전용이며 플레이어가 이용할 수 없다
  - 중계체와 해골은 5×5 영역 안에 배치된다 (§2 필드 도식)
  - 크리스탈은 배치 후 방향을 전환할 수 없다 (§3 3.4)
  - 크리스탈을 모두 사용하지 않아도 클리어 가능하다 (§3 3.3)

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `export type LaserPlacementResult = {`

> 원본 L31

 크리스탈 배치 시도 결과

## `public get inventory(): readonly LaserCrystal[] {`

> 원본 L54

 아직 필드에 놓지 않은 크리스탈 - 인벤토리 슬롯에 표시된다 (§2)

## `public getGimmickAt(fullRow: number, fullCol: number): LaserGimmick | undefined {`

> 원본 L88

#region Lookup

## `public getGimmickAt(fullRow: number, fullCol: number): LaserGimmick | undefined {`

> 원본 L90

 전체 그리드 좌표의 기믹

