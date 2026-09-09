# Puzzle_LocalOwnership.ts — 주석 아카이브

> 원본 스크립트: `Puzzle_LocalOwnership.ts`
> 걷어낸 주석 6건 / 1,695 B 절감 (3,275 B → 1,580 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Puzzle Local Ownership - 퍼즐 컨트롤러를 플레이어 소유로 넘겨 주는 서버 컴포넌트

#### 왜 필요한가

`*_CoreAPI` 는 `LocalCamera` 와 Focused Interaction 을 쓰므로 **클라이언트에서 돌아야 한다.**
그래서 실행 모드를 `Local` 로 두는데, Horizon 에서 Local 스크립트는
**엔티티에 소유자(플레이어)가 지정되어야 비로소 실행된다.**
소유자가 서버인 채로 두면 `start()` 안의 소유자 검사에 걸려 아무 일도 일어나지 않는다.

이 컴포넌트는 그 한 가지만 한다.
  플레이어가 월드에 들어오면 -> 지정한 엔티티들의 소유권을 그 플레이어에게 넘긴다

#### 붙이는 법

  1. 빈 엔티티를 만들고 이 스크립트를 붙인다.
  2. 실행 모드는 **Default(서버)** 로 둔다. 이 스크립트만은 서버에서 돌아야 한다.
  3. `targets` 에 소유권을 넘길 엔티티들을 넣는다 (예: PuzzleController).

단일 플레이어 퍼즐을 전제로, 먼저 들어온 플레이어가 소유자가 된다.
이미 소유자가 지정된 뒤에 다른 플레이어가 들어와도 뺏지 않는다.

## `targets: { type: PropTypes.EntityArray },`

> 원본 L28

 소유권을 넘길 엔티티들. 보통 퍼즐 CoreAPI 가 붙은 엔티티 하나면 된다

## `firstPlayerOnly: { type: PropTypes.Boolean, default: true },`

> 원본 L30

 이미 누군가 소유 중이면 넘기지 않을지 (기본 true - 단일 플레이어 전제)

## `private _assignedPlayer: Player | undefined = undefined;`

> 원본 L34

 지금 소유자로 지정된 플레이어. 없으면 아직 아무도 없다

## `if (this._assignedPlayer !== undefined && this._assignedPlayer.id === player.id) {`

> 원본 L58

나간 플레이어가 소유자였다면 비워 둔다. 다음 사람이 들어오면 다시 넘어간다.

## `target.owner.set(player);`

> 원본 L76

.set() 이어야 다른 클라이언트에도 전파된다

