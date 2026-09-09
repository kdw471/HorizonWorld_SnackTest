# PuzzleUI_Progress.ts — 주석 아카이브

> 원본 스크립트: `PuzzleUI_Progress.ts`
> 걷어낸 주석 6건 / 1,798 B 절감 (5,953 B → 4,155 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Puzzle UI Progress - 퍼즐별 "마지막으로 클리어한 레벨" 을 기억하는 순수 계층

메인 UI 의 **Continue** 버튼이 이 값 하나로 결정된다.

  클리어한 레벨이 없다  -> Continue 잠김, Start 만 가능
  3레벨까지 클리어했다  -> Continue 는 4레벨부터
  마지막 레벨까지 깼다  -> Continue 는 마지막 레벨을 다시 (더 갈 곳이 없다)

#### 레벨이란

**레벨 하나 = 퀘스트 라운드 하나 = 기획 판(field) 하나.**
난이도 오름차순으로 각 난이도의 판을 순서대로 이어 붙인 것이 그 퍼즐의 레벨 목록이다.
(레이저 난이도 1이 12판이면 L1~L12 가 난이도 1, L13 부터 난이도 2)

#### 저장소

`IPuzzleProgressStorage` 뒤로 감춰 두었다. 기본은 메모리이고,
Horizon 영구 변수에 얹는 구현은 `PuzzleUI_PersistentProgress.ts` 에 있다.
영구 변수가 준비되지 않은 월드에서도 그 세션 안에서는 Continue 가 동작한다.

`horizon/core` 에 런타임 의존이 없다 (PUZ_00 §7.1).

## `export type PuzzleProgressSnapshot = { [puzzleId: string]: number };`

> 원본 L27

#region Storage

## `export type PuzzleProgressSnapshot = { [puzzleId: string]: number };`

> 원본 L29

 퍼즐 id -> 마지막으로 클리어한 레벨 번호 (1-based). 없으면 키가 없다

## `export interface IPuzzleProgressStorage {`

> 원본 L32

진행도를 실제로 담아 두는 곳. 구현은 둘이다.
  - `MemoryProgressStorage` : 이 세션 동안만 (기본값, 어디서나 동작)
  - `HorizonProgressStorage`: 플레이어 영구 변수 (`PuzzleUI_PersistentProgress.ts`)

## `export class MemoryProgressStorage implements IPuzzleProgressStorage {`

> 원본 L42

 기본 저장소. 월드를 나가면 사라진다

## `export function parseProgressSnapshot(raw: string | undefined | null): PuzzleProgressSnapshot {`

> 원본 L66

저장된 문자열을 스냅샷으로 되돌린다. 깨진 값은 통째로 버리고 빈 진행도로 시작한다.
(영구 변수는 사람이 에디터에서 지우거나 형식이 바뀔 수 있으므로 절대 던지지 않는다)

