# CardMatch_Definitions.ts — 주석 아카이브

> 원본 스크립트: `CardMatch_Definitions.ts`
> 걷어낸 주석 48건 / 3,076 B 절감 (6,691 B → 3,615 B)
>
> 스크립트 루트의 `.ts` 는 인월드에서 실제로 쓰는 코드만 가볍게 유지한다.
> 그래서 설명은 코드가 아니라 이 문서에 둔다.
> 배경과 검증 절차는 `../가이드/타입체크와_테스트_실행.md` §3.1 · §3.2 를 본다.

---

## 파일 머리말

> 원본 L1

Card Match Puzzle - Core Definitions (PUZ_06 카드 맞추기 / 포탈 타일 메모리)

사양: `Documents/Prompts/PUZ_06_카드맞추기퍼즐.md` (+ PUZ_00 공통 기반)
인터랙션: 모바일 **탭(단일 터치)**. 드래그가 없다.

클래식 메모리 매치와 같은 규칙이되, 카드 대신 **포탈 타일**을 쓰고
**폭탄 타일이 셔플 기믹**으로 리셋을 대신하는 것이 이 퍼즐의 변형이다 (§1).

이 계층은 `horizon/core` 에 런타임 의존이 없는 순수 로직이다 (PUZ_00 §7.1).

## 파일 머리말

> 원본 L13

#region Constants

## 파일 머리말

> 원본 L15

 한 번에 활성화할 수 있는 포탈 타일 수 - §3 "포탈 타일은 한 번에 최대 2개까지 활성화 가능"

## `export const DEFAULT_MISMATCH_REVEAL_SECONDS = 0.4;`

> 원본 L18

짝이 틀렸을 때 뒤집힌 채로 보여 주는 시간(초) - 판정 연출.
원안은 0.8초였으나 "카드가 뒤집히는 연출이 굼뜨다" 는 피드백으로 줄였다 -
두 번째 카드를 확인할 시간은 남기되 다음 시도를 오래 막지 않는 값이다.

## `export const DEFAULT_BOMB_SHUFFLE_SECONDS = 1.2;`

> 원본 L25

 폭탄 셔플 연출 시간(초). 이 동안 제한 시간이 멈추고 입력이 잠긴다 - §4

## `export enum ETileState {`

> 원본 L28

#endregion

## `export enum ETileState {`

> 원본 L30

#region Enums

## `export enum ETileState {`

> 원본 L32

타일 상태 머신 - §9.2
  HIDDEN -> REVEALED -> (MATCHED | HIDDEN),  별도로 BOMB_REVEALED
MATCHED 와 폭탄 타일은 재선택 불가다.

## `HIDDEN = 'HIDDEN',`

> 원본 L38

 기본 (뒷면)

## `REVEALED = 'REVEALED',`

> 원본 L40

 활성화되어 오브젝트가 보이는 중

## `MATCHED = 'MATCHED',`

> 원본 L42

 짝을 맞춰 제거된 상태 - §6 파란색 -> 녹색

## `BOMB_REVEALED = 'BOMB_REVEALED',`

> 원본 L44

 폭탄이 드러나 비활성화된 상태 - §3.3

## `export enum ECardObjectType {`

> 원본 L48

 오브젝트 타입 - §8 NPUZ_06_ObjectData

## `NORMAL = 'NORMAL',`

> 원본 L50

 일반

## `TRAP = 'TRAP',`

> 원본 L52

 함정 (폭탄)

## `export enum ERevealOutcome {`

> 원본 L56

 타일을 활성화한 결과

## `REJECTED = 'REJECTED',`

> 원본 L58

 입력이 거절되었다 (잠금 중 / 재선택 / 잘못된 index)

## `FIRST_REVEALED = 'FIRST_REVEALED',`

> 원본 L60

 첫 번째 타일이 열렸다

## `MATCHED = 'MATCHED',`

> 원본 L62

 두 번째 타일이 열렸고 짝이 맞았다

## `MISMATCHED = 'MISMATCHED',`

> 원본 L64

 두 번째 타일이 열렸고 짝이 틀렸다 (곧 되돌아간다)

## `BOMB = 'BOMB',`

> 원본 L66

 폭탄이 나왔다 - 셔플이 시작된다

## `export enum ERevealRejection {`

> 원본 L70

 입력이 거절된 이유

## `LOCKED_BY_BOMB = 'LOCKED_BY_BOMB',`

> 원본 L74

 폭탄 셔플 중이라 조작할 수 없다 - §4

## `ALREADY_MATCHED = 'ALREADY_MATCHED',`

> 원본 L76

 이미 완료된 타일은 다시 고를 수 없다 - §4

## `ALREADY_BOMB = 'ALREADY_BOMB',`

> 원본 L78

 이미 드러난 폭탄 타일은 다시 고를 수 없다

## `ALREADY_REVEALED = 'ALREADY_REVEALED',`

> 원본 L80

 지금 열려 있는 타일을 또 누를 수 없다

## `export enum ECardMatchState {`

> 원본 L84

 퍼즐 진행 상태 머신

## `export type CardTile = {`

> 원본 L100

#endregion

## `export type CardTile = {`

> 원본 L102

#region Data types

## `export type CardTile = {`

> 원본 L104

 포탈 타일 한 개

## `objectId?: string,`

> 원본 L110

 이 타일에 배정된 오브젝트 ID. 폭탄이면 undefined

## `isBomb: boolean,`

> 원본 L112

 폭탄 타일인지 - §1

## `export type RevealResult = {`

> 원본 L116

 타일 활성화 결과

## `matchedTileIndexes: number[],`

> 원본 L121

 짝이 맞아 제거된 타일들

## `mismatchedTileIndexes: number[],`

> 원본 L123

 짝이 틀려 되돌아갈 타일들

## `shuffledTileIndexes: number[],`

> 원본 L125

 폭탄으로 인해 오브젝트 배정이 바뀐 타일들 - §3.3

## `didResolvePending: boolean,`

> 원본 L127

 이 입력 때문에 직전 판정이 즉시 마무리되었는지 - §9.4

## `export type CardMatchLevel = {`

> 원본 L131

 한 판의 배치 정보

## `bombCount: number,`

> 원본 L138

 폭탄 수 - §8 iBombTile

## `objectTileCount: number,`

> 원본 L140

 폭탄을 제외한 타일 수 (반드시 짝수) - §8 iObjectTile

## `remainingObjectTileCount: number,`

> 원본 L151

 아직 맞추지 못한 오브젝트 타일 수

## `export function cloneTile(tile: CardTile): CardTile {`

> 원본 L166

#endregion

## `export function cloneTile(tile: CardTile): CardTile {`

> 원본 L168

#region Helpers

## `export function isTileLockedForever(tile: CardTile): boolean {`

> 원본 L195

 재선택할 수 없는 상태인지 - §4

## `export type RandomSource = () => number;`

> 원본 L200

#endregion

## `export type RandomSource = () => number;`

> 원본 L202

#region Random

## `export function createSeededRandom(seed: number): RandomSource {`

> 원본 L206

 mulberry32

## `(파일 끝)`

> 원본 L236

#endregion

