# PuzzleUI_PersistentProgress.ts — 주석 아카이브

> 원본 스크립트: `PuzzleUI_PersistentProgress.ts`
> 걷어낸 주석 4건 / 1,971 B 절감 (3,472 B → 1,501 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Puzzle UI Persistent Progress - 진행도를 플레이어 영구 변수에 얹는 저장소

`PuzzleUI_Progress.ts` 의 `IPuzzleProgressStorage` 구현이다.
순수 계층과 분리해 둔 이유는 여기만 `horizon/core` 를 알기 때문이다 (PUZ_00 §7.1).

#### 에디터에서 해야 하는 설정 (1회)

  1. Systems > **Variable Groups** 에서 새 그룹을 만든다 (예: `PuzzleHub`).
  2. 그 그룹에 변수를 하나 추가한다. 이름 `progress`, 타입 **String**.
  3. `PuzzleUI_MainPanel` 의 `progressVariableKey` prop 을 `PuzzleHub:progress` 로 둔다
     (기본값이 이미 그것이라 이름을 그대로 썼다면 손댈 것이 없다).

**설정하지 않아도 게임은 돈다.** 키가 비어 있거나 읽기가 실패하면 호출자가
메모리 저장소로 떨어지므로, 그 세션 안에서는 Continue 가 정상 동작하고
월드를 나가면 초기화된다. 어느 쪽인지는 시작 시 콘솔 로그로 알린다.

#### 왜 String 변수에 JSON 을 넣나

퍼즐 8종의 진행도를 변수 8개로 나누면 에디터 설정이 8배가 되고 퍼즐이 늘 때마다
설정을 고쳐야 한다. 한 문자열에 `{"LASER":3,"SWITCH":1}` 형태로 담으면
에디터 설정은 영원히 하나면 된다. 8종 전부를 담아도 100바이트가 안 된다.

## `export const DEFAULT_PROGRESS_VARIABLE_KEY = 'PuzzleHub:progress';`

> 원본 L33

 기본 변수 키. `그룹이름:변수이름` 형식이다

## `console.warn(`[PuzzleProgress] Could not read "${this._key}": ${error}`);`

> 원본 L53

변수 그룹이 없으면 여기서 던진다. 진행도가 없는 것으로 보고 넘어간다.

## `export function canUsePersistentStorage(world: World, player: Player, key: string): boolean {`

> 원본 L69

영구 저장소를 쓸 수 있는지 확인한다.

변수 그룹이 설정되지 않은 월드에서 `getPlayerVariable` 은 던지거나 null 을 돌려준다.
**null 은 "아직 아무것도 저장하지 않았다" 와 구분되지 않으므로 실패로 보지 않는다** -
처음 플레이하는 사람도 null 을 받기 때문이다. 던지는 경우만 사용 불가로 판정한다.

