# 퍼즐 구현 진행 상황

> 최종 갱신: 2026-09-01
> 작업 위치: `c:\Users\dkweon\AppData\LocalLow\Meta\Horizon Worlds\1360780137108679\scripts`
> 사양 문서: `Documents/Prompts/` (PUZ_00 공통 기반 + PUZ_01~08 + Rush_Hour_Mobile_Specification)

---

## 0. 전체 현황

| # | 퍼즐 | 상태 | 레이어 | 파일 | 줄 | 테스트 |
|---|------|------|--------|------|-----|--------|
### 0.1 퍼즐 로직 (8/8 완료)

| # | 퍼즐 | 상태 | 레이어 | 파일 | 줄 | 테스트 |
|---|------|------|--------|------|-----|--------|
| 01 | 레이저 해킹 | ✅ 완료 | `Laser_*` | 10 | 3,400 | 93 |
| 02 | 러시아워 (슬라이딩 블록) | ✅ 완료 | `RushHour_*` | 9 | 3,727 | 68 |
| 03 | 정렬 (건전지 색 분류) | ✅ 완료 | `ColorSort_*` | 9 | 2,822 | 106 |
| 04 | 색 채우기 (다이얼 타이밍) | ✅ 완료 | `ColorFill_*` | 9 | 2,401 | 97 |
| 05 | 연결 (전구 잇기) | ✅ 완료 | `Flow_*` | 9 | 3,078 | 97 |
| 06 | 카드 맞추기 (포탈 타일) | ✅ 완료 | `CardMatch_*` | 7 | 2,143 | 88 |
| 07 | 슬라이드 (N-퍼즐) | ✅ 완료 | `SlidePuzzle_*` | 8 | 2,100 | 93 |
| 08 | 스위치 (Lights Out 변형) | ✅ 완료 | `Switch_*` | 9 | 2,841 | 128 |

### 0.2 Horizon 통합 (브리지 + 레퍼런스 1종 완료)

| 파일 | 줄 | 역할 |
|---|---|---|
| `Puzzle_HorizonBridge.ts` | 438 | 8개 퍼즐 공통 어댑터. 좌표 변환 / 터치 라우팅 / 프레임 구동 / Focused Interaction / 자식 수집 |
| `Switch_CoreAPI.ts` | 378 | PUZ_08 을 실제로 구동하는 Component. **나머지 7종의 템플릿** |
| `Puzzle_LocalOwnership.ts` | 84 | Local 스크립트가 돌 수 있도록 소유권을 플레이어에게 넘긴다 |

### 0.3 메인 UI (퍼즐 허브 — §13)

| 파일 | 줄 | 역할 |
|---|---|---|
| `PuzzleUI_Definitions.ts` | 157 | 퍼즐 카탈로그(8종)·화면 enum·뷰 모델 타입·시계 라벨 헬퍼 |
| `PuzzleUI_Registry.ts` | 204 | CoreAPI ↔ 메인 UI 접점. 정규화 핸들 팩토리 + 레지스트리 |
| `PuzzleUI_Model.ts` | 328 | 화면 상태 머신 (선택→난이도→인게임→일시정지→결과) — 순수 로직 |
| `PuzzleUI_Tests.ts` | 487 | 검증 하네스 54건 (실제 SwitchSession 솔버 클리어 통합 포함) |
| `PuzzleUI_MainPanel.ts` | 570 | Horizon `UIComponent` 표현 계층 (Screen Overlay) |

**신규 코드 78개 파일 / 약 25,300줄. 테스트 824 PASS / 0 FAIL. 타입 체크 에러 0
(Horizon 에디터 제약 검사 §6.1.1 포함).**

**전 퍼즐 모바일 플레이 검증 리뷰(§8)를 1회 완료했다** — 모바일 입력 API만으로 전 난이도
클리어 시뮬레이션 + 적대적 입력 + 사양 대조를 수행해 버그 6건을 수정했다.

**2차 전체 검증 리뷰(§12)도 완료했다** — 모바일 입력 계층 NaN 추적 + 성능·실작동 리뷰로
버그 5건을 추가 수정했고, 출시 전 반드시 처리할 성능 이슈(§12.3)를 실측 근거와 함께 남겼다.

기존 `Basics_*` 매치3 코드는 **한 줄도 수정하지 않았다.**

---

## 1. 반드시 지킬 규약 (모든 퍼즐 공통)

사용자와 확정한 사항이다. **변경하지 말 것.**

### 1.1 기존 매치3 코드는 건드리지 않는다

- `Basics_*` 매치3 로직은 **그대로 둔다.** 삭제/개조 금지.
- 이유: 원본 TS 95개 중 **48개가 `Basics_Definitions`(Tile / ETileType / EGameState)에 의존**한다.
  Abilities(부스터), Score(콤보), Progression, UI, Tutorial 전부가 매치3 개념 위에 얹혀 있어
  in-place 개조 시 프로젝트 전체가 컴파일 불가가 된다.
- 새 퍼즐은 항상 `<퍼즐이름>_*.ts` 접두사의 **신규 레이어**로 추가한다.

### 1.2 코드 스타일

- 탭 인덴트, `=== false` / `=== undefined` 명시 비교, `//#region` 구획 주석
- non-relative import (`import { X } from 'RushHour_Board'`) — `tsconfig.json`의 `baseUrl: "."`
- 주석은 한국어, 기획서 조항 번호를 함께 적는다 (예: `- 기획서 §5.2`)

### 1.3 로직과 표현 분리 (PUZ_00 §7.1)

- 퍼즐 규칙은 `horizon/core`에 **런타임 의존이 없는 순수 로직**으로 작성한다.
  (`import type`만 쓰는 `Utility_Events`는 예외적으로 사용 가능 — 컴파일 시 소거된다.)
- 입력/연출은 어댑터 계층으로 분리한다. 2D 프로토타입/Node에서 동일 로직이 검증 가능해야 한다.

### 1.4 인터랙션은 모바일 기준

원본 기획서 8종은 모두 **VR 핸드 트래킹** 기준으로 쓰여 있다. 규칙 절은 그대로 따르되
**조작 절만 모바일로 대체**한다. 확정된 공통 규격은 다음과 같다.

- **단일 터치 전용.** 동시에 하나의 오브젝트만 조작하며, 조작 중 추가 터치는 완전히 무시한다.
  기획서가 "양손 동시 조작 허용"이라 적어도 모바일에서는 금지한다.
- 손을 떼면 오브젝트의 중심이 위치한 칸으로 **반올림 스냅**한다.
- 포인터가 영역 밖으로 나가도 **드래그 입력은 유지**되며, 이동 가능한 최외곽 경계에 고정된다.
- 터치 지점 중심부에 **가장 가까운 오브젝트 하나만** 선택하고, 히트박스는 칸보다 넉넉히 잡는다.
- 손가락이 대상을 가리므로, 활성화된 오브젝트는 손가락 위로 띄우거나 조작 버튼을 대상 밖에 둔다.

각 퍼즐의 모바일 조작 규격은 해당 `Documents/Prompts/PUZ_0N_*.md` 하단에 절로 추가해 두었다.

---

## 2. 공통 아키텍처

8개 퍼즐이 모두 같은 골격을 따른다. 새 퍼즐을 추가할 때 이 구성을 그대로 복제하면 된다.

| 역할 | 파일 패턴 | 내용 |
|---|---|---|
| 정의 | `*_Definitions.ts` | 상수·enum·타입·좌표 헬퍼·시드 난수(mulberry32) |
| 보드 | `*_Board.ts` / `*_Dial.ts` | 규칙의 순수 상태 머신. 클리어 판정 포함 |
| 솔버 | `*_Solver.ts` / `*_BeamTracer.ts` / `*_AutoPlayBot.ts` | 해의 존재·난이도·클리어 가능성 검증 |
| 테이블 | `*_DataTables.ts` | PUZ_00 §6의 3계층 테이블 + 난이도 테이블 + **설정 검증** |
| 생성기 | `*_LevelGenerator.ts` | 항상 풀 수 있는 배치만 출력 + 배치 검증기 |
| 조작 | `*_DragController.ts` / `*_InputController.ts` | 모바일 단일 터치 어댑터 |
| 이벤트 | `*_GameEvents.ts` | `EventPublisher` 허브. 연출 계층은 이것만 구독 |
| 세션 | `*_Session.ts` | 라운드·제한시간·승패 + PUZ_00 §7.4 외부 조회 API |
| 테스트 | `*_Tests.ts` | 각 기획서의 테스트 절을 구현한 검증 하네스 |

위까지가 **순수 로직**이며 `horizon/core` 에 런타임 의존이 없다.
실제 월드 구동에 필요한 **표현 계층**은 아래 두 종류다 (§9, §10).

| 역할 | 파일 | 내용 |
|---|---|---|
| 공통 브리지 | `Puzzle_HorizonBridge.ts` | 8개 퍼즐이 공유. 퍼즐마다 다시 만들지 않는다 |
| 퍼즐별 구동 | `*_CoreAPI.ts` | Horizon `Component`. 세션 생성 + 입력 연결 + 연출 |

### 2.1 세션이 공통으로 노출하는 API (PUZ_00 §7.4)

```ts
startQuest(questId) / startQuestByDifficulty(difficulty) / startRound()
update(deltaSeconds)          // 제한시간·연출 타이머 진행
pause() / resume() / abort()
state                          // 상태 머신
getRemainingTimeSeconds()
getRoundProgress()             // { current, total, cleared }
```

### 2.2 레벨 생성의 공통 원칙

`Documents/Prompts/README.md`가 권장하는 대로 **무작위 배치 대신 "완성 상태에서 역방향으로
흐트러뜨리는" 방식**을 우선했다. 퍼즐별 적용은 아래와 같다.

| 퍼즐 | 생성 방식 |
|---|---|
| 01 레이저 | 광선 경로를 직접 그려 해를 만든 뒤 크리스탈을 인벤토리로 되돌림 |
| 02 러시아워 | 완성 상태에서 도달 가능한 모든 배치의 최소 이동 수를 BFS로 구해 채택 |
| 03 정렬 | **역이동(reverse move)** 을 정의해 적용 (§4.3 참조 — 사양대로 하면 안 됨) |
| 04 색 채우기 | 오염 덩어리 비인접 배치 + 자동 플레이 봇 시뮬레이션 검증 |
| 05 연결 | 해밀턴 경로를 찾아 색깔별 구간으로 절단 |
| 06 카드 맞추기 | 짝 생성 후 셔플 + **데이터 검증**(홀수 거부) |
| 07 슬라이드 | 완성 상태에서 합법 이동만으로 역순 셔플 (되돌리기 배제) |
| 08 스위치 | 목표 상태(모두 눌림)에서 **서로 다른 칸 K개**를 눌러 역방향으로 흐트러뜨림 + GF(2) 솔버 재검증 |

---

## 3. 퍼즐별 상세

### 3.1 PUZ_01 레이저 해킹 — 93 PASS

| 파일 | 내용 |
|------|------|
| `Laser_Definitions.ts` | 상수·enum·좌표 헬퍼·**크리스탈 반사/분배 규칙**·시드 난수 |
| `Laser_Board.ts` | 5×5 배치 영역 + 테두리 기믹 상태 머신 (배치/회수/이동/인벤토리) |
| `Laser_BeamTracer.ts` | 광선 전파 + 클리어 판정 + On/Off/Fault 상태 산출 |
| `Laser_Solver.ts` | 크리스탈 배치 조합 탐색 (사용 개수 0개부터 늘리는 반복 심화) |
| `Laser_DataTables.ts` | 3계층 테이블 + 난이도 테이블 |
| `Laser_LevelGenerator.ts` | 경로 구성식 생성기 + 배치 검증기 |
| `Laser_DragController.ts` | 모바일 단일 터치 드래그 (인벤토리 ↔ 필드) |
| `Laser_GameEvents.ts` | 이벤트 허브 (`BEAM_UPDATED` 로 광선 갱신 전달) |
| `Laser_Session.ts` | 라운드·제한시간·승패 + 외부 조회 API |
| `Laser_Tests.ts` | 사양 §8.4 검증 하네스 (93 케이스) |

**좌표계**

```
전체 그리드 7×7 (LASER_FULL_GRID_SIZE)
 └ 바깥 테두리 1칸 = 발사체 / 수신체 전용 (플레이어 이용 불가, §5.1)
 └ 중앙 5×5       = 크리스탈 배치 영역 (§5.0). 중계체·해골도 이 안에 놓인다

crystal.row/.col → 배치 로컬 0..4   |   gimmick.row/.col → 전체 그리드 0..6
```

**삼각형 크리스탈의 방향 표기**

사양은 "상/하/좌/우" 4종으로 적지만 반사 계산에는 **직각 코너의 위치**가 필요하다.
그래서 `ETriangleCorner = TOP_LEFT | TOP_RIGHT | BOTTOM_LEFT | BOTTOM_RIGHT` 로 정의했다.
리소스 이름과의 매핑은 오브젝트 테이블에서 한다.

- 직각 코너에 붙은 두 변이 **평면(직각변)**, 나머지 한 변이 **빗변**
- 빗변 입사 → 직각 반사 / 평면 입사 → 되돌아감 (§4.1)
- `BOTTOM_LEFT` / `TOP_RIGHT` 는 `\` 거울, `BOTTOM_RIGHT` / `TOP_LEFT` 는 `/` 거울

**T자 크리스탈의 "2~3방향"**

`getCrystalOutputs()` 는 3개의 팔 중 **들어온 쪽으로 되돌아가는 방향만 제외**한다.
팔로 들어오면 2방향, 막힌 쪽으로 들어오면 3방향. 사양과 정확히 일치한다.

**무한 루프 방지 (§8.1)** — `(셀, 진입방향, 색)` 조합을 방문 집합에 기록한다.
색이 곧 레이어이므로 다른 색 광선은 교차해도 간섭하지 않는다 (§5).

**다중 빔 생성 시 주의** — 빔 2개 이상이면 빔 2의 크리스탈이 빔 1의 경로 위에 놓여
빔 1의 궤도를 꺾을 수 있다. 그래서 생성기는 두 집합을 따로 관리한다.

- `occupied` — 기믹/크리스탈이 차지한 칸. 새 배치를 막는다.
- `pathKeys` — 광선이 지나가는 칸. **크리스탈 배치만** 막고, 중계체는 이 위에 놓는다.

**성능** D1 2ms ~ D4 374ms. 같은 시드는 같은 레벨.

---

### 3.2 PUZ_02 러시아워 — 68 PASS

| 파일 | 내용 |
|------|------|
| `RushHour_Definitions.ts` | 상수·enum·타입·좌표 헬퍼·시드 난수 |
| `RushHour_Board.ts` | 7×7 보드 순수 상태 머신 (배치/이동/스냅/결합/클리어/줄 포화) |
| `RushHour_Solver.ts` | BFS 솔버 + 도달 가능 상태 전수 탐색 |
| `RushHour_DataTables.ts` | 3계층 테이블 + 난이도 테이블 |
| `RushHour_LevelGenerator.ts` | §6 배치 제약 검증기 + 레벨 생성기 |
| `RushHour_DragController.ts` | 모바일 단일 터치 드래그·스냅·USB 결합/분리 |
| `RushHour_GameEvents.ts` | 이벤트 허브 |
| `RushHour_Session.ts` | 라운드·제한시간·승패 + 외부 조회 API |
| `RushHour_Tests.ts` | 사양 §11.4 검증 하네스 (66 케이스) |

**좌표계**

```
전체 그리드 9×9  (RUSH_HOUR_FULL_GRID_SIZE)
 └ 바깥 테두리 링 1칸 = 도착 포인트 / USB 단자 배치 구역 (보이지 않음)
 └ 중앙 7×7 = 실제 플레이 공간

piece.row/.col    → 플레이 로컬 0..6, 좌측·상단 칸 기준 (§7)
endPoint.row/.col → 전체 9×9 좌표 0..8 (테두리 링 위)
```

**클리어 판정 — 도달만으로는 부족하다**

모바일 사양 §2 / §11.3은 **"도달 및 결합(삽입)"** 을 요구한다.
VR 기획서(PDF)의 "도달 시 클리어"와 다르므로 주의.

- `hasEveryGoalArrived()` — 도달 여부만 (솔버·생성기가 목표 상태로 삼는다)
- `isSolved()` — 도달 + **결합까지** 끝나야 true
- 결합은 슬롯 쪽으로 반 칸 이상 추가 드래그하면 확정, 반대로 끌면 분리
- 결합 시 3칸 점유: 플레이 공간 2칸 + 테두리 링 1칸 (필드 점유는 불변)
- 결합된 USB는 먼저 `undock()` 해야 움직인다

**레벨 생성 — 두 번 바꿨다**

최종: 목표 USB를 도착 포인트에 밀착한 완성 상태로 놓고 방해물을 배치 → 도달 가능한 모든 배치와
최소 이동 수를 `exploreReachableStates()` 로 한 번에 구함 → 깊은 배치부터 §6 검사 후 채택.

슬라이딩은 가역적이라 상태 그래프가 무향이고, 클리어 상태들로부터의 BFS 거리가 곧 최소 이동 수다.

버린 방식: 무작위 배치 → 솔버 검사 → 재시도. 난이도 2 이상이 400회 시도에도 실패, D3는 97초.

**§6 배치 제약 구현 위치**

| 기획서 조항 | 구현 |
|---|---|
| [금지] 목표와 같은 이동 방향 방해물을 목표–도착 지점 사이에 배치 | `getCellsBetweenGoalAndEndPoint()` + `validateGoalCorridor()` |
| [금지] 동일 이동 방향 오브젝트가 한 줄을 가득 채움 | `getSaturatedLines()` + `validateSaturatedLines()` |
| [필수] 모든 오브젝트는 최소 1칸 이상 이동 가능 | `getImmovablePieceIds()` + `validateEveryPieceCanMove()` |

> 1×1 `FREE`는 전 방향 이동이 가능해 줄을 잠그지 않으므로 "줄 포화" 계산에서 제외한다.
> 또 `FREE`는 H/V와 orientation이 달라 "같은 이동 방향" 조항에도 걸리지 않는다.
>
> 첫 번째 조항은 **초기 배치**에 대한 제약이지 플레이 중 불변식이 아니다.
> 목표 앞을 같은 축 블록이 막은 배치는 애초에 해가 없어 완성 상태에서 도달할 수 없으므로
> 생성기의 탐색 결과에서 자동으로 제외된다.
> (한때 "같은 축 블록을 목표 레인에서 배제"하는 더 엄격한 규칙을 넣었다가 난이도 상한만
> 깎아서 되돌렸다. **다시 넣지 말 것.**)

**성능** D1 39ms ~ D5 3.7초.

---

### 3.3 PUZ_03 정렬 — 106 PASS

| 파일 | 내용 |
|------|------|
| `ColorSort_Definitions.ts` | 상수·enum·타입·런 길이/완성 판정 헬퍼·시드 난수 |
| `ColorSort_Board.ts` | 케이스 스택 상태 머신 (§10.2 이동 검사, 데드락, 공개, 클리어) |
| `ColorSort_Solver.ts` | DFS + 메모이제이션 해 탐색 (실제 보드 규칙으로 수를 둔다) |
| `ColorSort_DataTables.ts` | 3계층 테이블 + 난이도 테이블 + 설정 검증 |
| `ColorSort_LevelGenerator.ts` | **역이동** 셔플 생성기 + 배치 검증기 |
| `ColorSort_DragController.ts` | 모바일 단일 터치 드래그·미리보기·2초 리스폰 |
| `ColorSort_GameEvents.ts` | 이벤트 허브 |
| `ColorSort_Session.ts` | 라운드·제한시간·승패(시간초과/데드락) + 외부 조회 API |
| `ColorSort_Tests.ts` | 사양 §10.6 검증 하네스 (97 케이스) |

**블랙(미지) 건전지**

- `Battery.color` 는 **언제나 실제 색**을 담고, `isRevealed` 가 표시와 규칙을 가른다.
  공개 시 색을 새로 뽑지 않으므로 상태가 갈라지지 않는다.
- 최상단에 노출되면 즉시 공개. 보드 생성 시점에도 한 번 수행 (§7)
- 미공개 건전지는 **런을 끊는다** → 언제나 단일로만 움직인다 (§7)
- 마스킹은 셔플 후 최상단이 아닌 위치에만 적용하고, 마스킹이 시작부터 데드락을 만들 수 있으므로
  생성 후 데드락 여부와 해의 존재를 다시 확인한다

**데드락과 리스폰 잠금의 상호작용**

영역 밖 드랍 시 케이스가 2초간 잠기는데(§8), 그동안 유효 이동이 0개가 될 수 있다.
이를 데드락으로 오판하면 억울한 즉시 패배가 된다. `checkDeadlock()` 은
**리스폰 대기 중에는 판정을 미루고** 리스폰이 끝난 뒤 다시 확인한다.

**성능** D1~D5 생성 각 1~2ms. 솔버는 이동 순서 휴리스틱(빈 케이스보다 합치는 수를 먼저)으로
백트래킹 없이 해를 찾는다.

---

### 3.4 PUZ_04 색 채우기 — 97 PASS

배치 퍼즐이 아니라 **반응속도/타이밍 퍼즐**이라 구조가 다르다. 드래그가 없고 조작은 탭 하나뿐이다.

| 파일 | 내용 |
|------|------|
| `ColorFill_Definitions.ts` | 18칸 원형 배열 헬퍼(wrap-around 포함)·enum·타입·시드 난수 |
| `ColorFill_Dial.ts` | 다이얼 + 바늘 상태 머신 (회전, 정화, 방향 반전 딜레이) |
| `ColorFill_AutoPlayBot.ts` | §8.6 밸런싱 검증용 자동 플레이 봇 (**반응 지연 포함**) |
| `ColorFill_DataTables.ts` | 3계층 테이블 + 난이도 테이블 + 설정 검증 |
| `ColorFill_LevelGenerator.ts` | 오염 덩어리 비인접 배치 + 봇 시뮬레이션 검증 |
| `ColorFill_InputController.ts` | 모바일 단일 터치 / 연타 방지 |
| `ColorFill_GameEvents.ts` | 이벤트 허브 |
| `ColorFill_Session.ts` | 라운드·제한시간·승패 + 외부 조회 API |
| `ColorFill_Tests.ts` | 사양 §8.7 검증 하네스 (97 케이스) |

**방향 전환 딜레이 중 재터치**

§8.3이 "입력 잠금 처리 여부를 파라미터로 둔다"고 해서 `isInputLockedDuringReverse` 로 노출했다.

- **켜짐(기본):** 반전 대기 중 터치는 완전히 무시
- **꺼짐:** 정화는 일어나고 반전 타이머만 재시작.
  **연타해도 방향은 한 번만 뒤집힌다** (타이머가 끝날 때 한 번 반전)

**봇에 반응 지연이 없으면 §8.6 검증이 무의미하다**

봇이 매 프레임 완벽하게 반응하면 어떤 레벨이든 몇 초 만에 끝난다.
이 퍼즐의 실제 난이도는 **반응 속도**에 있다 (160도/초에서 한 칸 20도는 0.125초 만에 지나간다).
그래서 봇은 `reactionSeconds` 간격으로만 판단하고, 그 사이 지나간 칸은 놓친다.

---

### 3.5 PUZ_05 연결 — 97 PASS

| 파일 | 내용 |
|------|------|
| `Flow_Definitions.ts` | 7×7 격자·비트맵 파싱·인접 판정·enum·타입·시드 난수 |
| `Flow_Board.ts` | 타일/노드/색깔별 경로 상태 머신 (확장·되돌리기·클리어 판정) |
| `Flow_Solver.ts` | **정점 서로소 경로 덮개** 탐색 (모든 서브 사용 조건 포함) |
| `Flow_DataTables.ts` | 3계층 테이블 + 타일 마스크 5종 + 난이도 테이블 |
| `Flow_LevelGenerator.ts` | 해밀턴 경로 분해 생성기 + 배치 검증기 |
| `Flow_DragController.ts` | 모바일 단일 터치 그리기·역주행 지우기 |
| `Flow_GameEvents.ts` | 이벤트 허브 |
| `Flow_Session.ts` | 라운드·제한시간·승패 + 외부 조회 API |
| `Flow_Tests.ts` | 사양 §9.6 검증 하네스 (97 케이스) |

**색을 하나씩 탐욕적으로 이으면 안 된다**

이 퍼즐은 일반 Flow와 달리 **모든 서브 오브젝트를 전부 사용**해야 클리어된다 (§5).
따라서 "각 색이 START~END로 이어졌는가"만 보면 틀린다. 실제로는

> **정점 서로소 경로 덮개(vertex-disjoint path cover)** — 색깔별 경로들이 모든 SUB 칸을 빈틈없이 덮어야 한다

처음에 색을 하나씩 DFS로 잇는 방식을 만들었다가 전 난이도 검증이 실패했다.
앞 색이 도착만 하고 서브를 남기거나 뒤 색의 길을 막기 때문이다.

가지치기: 미착색 서브는 "열린 이웃"이 **최소 2개** 있어야 한다.
서브는 입력 1 / 출력 1 뿐이라(§4) 들어오는 길과 나가는 길이 각각 필요하기 때문이다.

**타일 마스크별 해밀턴 경로 가능 여부**

| 마스크 | 타일 | 이분 분할 | 차이 | 해밀턴 경로 |
|---|---|---|---|---|
| FULL | 49 | 25/24 | 1 | ✅ |
| HOLES | 45 | 21/24 | **3** | ❌ 불가능 |
| CROSS | 33 | 17/16 | 1 | ✅ |
| STAIR | 33 | 17/16 | 1 | ✅ |
| SPLIT | 40 | 20/20 | 0 | ✅ |

격자는 이분 그래프이므로 두 색의 칸 수 차이가 1을 넘으면 해밀턴 경로가 존재할 수 없다.
`HOLES` 는 §3 예시에 있지만 경로 분해 생성기가 쓸 수 없어 난이도 설정에서 제외했다.
마스크 카탈로그에는 남겨 두었으니 손으로 배치한 필드 테이블에서는 쓸 수 있다.

> 현재 생성기는 "한 줄 뱀을 색으로 자른" 형태의 레벨을 만든다. 더 다양한 모양을 원하면
> 여러 개의 독립적인 경로로 분해하는 방식을 추가하면 된다. 미구현.

---

### 3.6 PUZ_06 카드 맞추기 — 88 PASS

| 파일 | 내용 |
|------|------|
| `CardMatch_Definitions.ts` | 타일 상태 머신·enum·타입·시드 난수 |
| `CardMatch_Board.ts` | 포탈 타일 상태 머신 (활성화·판정·폭탄 셔플·클리어) |
| `CardMatch_DataTables.ts` | NPUZ_06_FieldData / ObjectData + **데이터 검증** |
| `CardMatch_LevelGenerator.ts` | §9.1 필드 생성 알고리즘 + 배치 검증기 |
| `CardMatch_GameEvents.ts` | 이벤트 허브 |
| `CardMatch_Session.ts` | 라운드·제한시간·승패 + 폭탄 중 타이머 정지 + 리셋 무효화 |
| `CardMatch_Tests.ts` | 사양 §9.7 검증 하네스 (88 케이스) |

**데이터 검증이 이 퍼즐의 핵심 안전장치다**

§8은 `iObjectTile = (X × Y) - iBombTile` 이며 **반드시 짝수**라고 못박는다.
홀수면 짝 없는 오브젝트가 하나 남아 **클리어가 원천적으로 불가능**해진다.
`validateFieldData()` 가 다음을 검사하고 위반 시 생성 자체를 거부한다.

- `iObjectTile` 이 `(X × Y) - iBombTile` 과 일치하는가
- 그 값이 **짝수**인가 (§9.1이 명시적으로 요구)
- 폭탄 수가 전체 타일 수 미만인가
- **오브젝트 그룹의 종류 수가 필요한 pairs 수 이상인가**

마지막 항목은 실제로 걸렸다. 초기 오브젝트 테이블이 GROUP_CH2 6종 / GROUP_CH3 8종이었는데
5×3 필드는 7종, 5×5 필드는 12종이 필요해 난이도 2·4·5 생성이 전부 실패했다.
지금은 GROUP_CH2 8종 / GROUP_CH3 12종으로 채웠다.
**필드 크기를 키우면 오브젝트 풀도 함께 늘려야 한다.**

**판정 연출 중 세 번째 타일 (§4 / §9.4)**

짝이 틀려 되돌아가는 연출 중에 새 타일을 누르면 **직전 판정을 즉시 마무리하고** 새 선택으로 넘어간다.
`RevealResult.didResolvePending` 으로 그 사실을 알려 준다.

**폭탄이 리셋을 대신한다**

- 폭탄을 열면 **완료되지 않은 모든 타일**의 오브젝트 배정과 폭탄 여부를 함께 섞는다 (§8 / §9.3).
  완료(MATCHED)된 타일과 이미 드러난 폭탄은 건드리지 않는다.
- 셔플 동안 **입력이 잠기고 제한 시간이 멈춘다** (§4). 세션이 `board.isTimerPaused` 를 보고 시간을 안 깎는다.
- 그래서 **리셋 버튼은 동작하지 않는다** (§1 / §9.5). 버튼은 남기되 `RESET_IGNORED` 만 발행한다.

**클리어** 폭탄이 아닌 모든 타일이 MATCHED면 클리어. **마지막에 남은 타일이 폭탄뿐이어도 클리어**다 (§2).

---

### 3.7 PUZ_07 슬라이드 — 93 PASS

| 파일 | 내용 |
|------|------|
| `SlidePuzzle_Definitions.ts` | 규격 상수(§4)·좌표 헬퍼·풀이 가능성 판정·시드 난수 |
| `SlidePuzzle_Board.ts` | 조각 배치 + 이동 잠금 상태 머신 + 역순 셔플 |
| `SlidePuzzle_DataTables.ts` | NPUZ_07_FieldData / ObjectData + 규격 검증 |
| `SlidePuzzle_LevelGenerator.ts` | 역순 셔플 생성기 + 배치 검증기 |
| `SlidePuzzle_InputController.ts` | 모바일 단일 터치 / 동시 입력 타임스탬프 처리 |
| `SlidePuzzle_GameEvents.ts` | 이벤트 허브 |
| `SlidePuzzle_Session.ts` | 라운드·제한시간·승패 + 외부 조회 API |
| `SlidePuzzle_Tests.ts` | 사양 §12.7 검증 하네스 (90 케이스) |

**규격값을 그대로 반영했다 (§4)**

| 항목 | 값 | 검산 |
|---|---|---|
| 완성 이미지 | 35cm × 35cm | — |
| 3×3 조각 | 11.5cm, 간격 0.25cm | 11.5×3 + 0.25×2 = **35** ✅ |
| 4×4 조각 | 8.6cm, 간격 0.2cm | 8.6×4 + 0.2×3 = **35** ✅ |
| 조각 두께 | 4cm | — |
| 인터랙션 높이 | 7cm | — |
| 이동 연출 | 0.25초 | — |
| 호버 Emissive | `#FF5C41` | — |

두 규격 모두 정확히 35cm로 맞아떨어진다. 테스트가 이 항등식을 검사한다.

**셔플은 반드시 역순 + 되돌리기 배제 (§8)**

무작위 순열 셔플은 **절반이 풀 수 없는 배치**가 된다. 테스트가 이 사실도 검증한다
(8-퍼즐에서 두 조각만 바꾸면 풀 수 없음).

역순 셔플은 합법 이동만 쓰므로 항상 풀 수 있다. 되돌리기를 배제해 제자리걸음도 막는다
— 100개 시드로 2회 셔플했을 때 완성 상태로 돌아온 경우 0건.

**입력 잠금 (§12.3)** `IDLE → MOVING(0.25초, 전체 입력 잠금) → IDLE`, 완성 시 `LOCKED_CLEARED`.
동시 입력은 **타임스탬프가 빠른 쪽만 채택**하고 나머지는 폐기한다 (§12.4).

---

### 3.8 PUZ_08 스위치 — 128 PASS

| 파일 | 내용 |
|------|------|
| `Switch_Definitions.ts` | 5×5 격자·A1~E5 좌표·3×3 마스크 파싱/검증·레이아웃 파싱·시드 난수 |
| `Switch_Board.ts` | 키 판 상태 머신 (토글·연출 잠금·클리어·역셔플) |
| `Switch_Solver.ts` | GF(2) 가우스 소거 솔버 (해 존재 판정 + 최소 해) |
| `Switch_DataTables.ts` | 3계층 테이블 + 스위치 영역(마스크) 카탈로그 + 데이터 검증 |
| `Switch_LevelGenerator.ts` | 역셔플 생성기 + 배치 검증기 (솔버 재검증 포함) |
| `Switch_InputController.ts` | 모바일 단일 터치 (touchDown/Up 부분 누름 취소) |
| `Switch_GameEvents.ts` | 이벤트 허브 (`MASK_CHANGED` / `KEY_PRESSED` / `AREA_TOGGLED` …) |
| `Switch_Session.ts` | 라운드·제한시간·승패 + 외부 조회 API |
| `Switch_Tests.ts` | 사양 §9.7 검증 하네스 + 솔버 브루트포스 교차 검증 (128 케이스) |

**상태 모델** — `grid[25]`: `PRESSED(1)` / `UNPRESSED(0)` / `FREE(-1)`.
사양 §5의 라벨-텍스트 표기 모순은 **1 = 눌림(녹색/목표)** 로 통일했다 (§4.7 참조).

**토글 규칙 (§6 / §9.2)** — (r, c)를 누르면 3×3 마스크의 1인 오프셋이 XOR 반전된다.
판 밖 오프셋과 FREE 칸은 무시한다 (랩어라운드 금지). 마스크 중앙은 항상 1 이어야 하며
`validateObjectTable()` 이 위반 데이터를 거부한다.

**연출 잠금 (§7)** — 토글(논리 상태)은 누르는 즉시 반영하고, 잠금만
`IDLE → SEQUENCE(0.4초) → IDLE` 로 관리한다. 0.2초에 `AREA_TOGGLED`,
0.4초에 `PRESS_SEQUENCE_FINISHED` + 클리어 판정. `touchDown` 은 잠금 중
접수 자체를 거부한다 (연출 중 입력이 1개 버퍼링되는 것을 막는다).

**역셔플 생성 (§9.4)** — 목표 상태에서 **서로 다른 칸 K개**를 누른다.
같은 칸을 두 번 누르면 상쇄되어(involution) 실질 난이도가 K 아래로 내려가기 때문이다.
단, 누른 집합이 토글 행렬의 **커널**에 들어가면 K번 눌렀는데도 완성 상태 그대로일 수 있다
(예: 가로줄 마스크로 한 줄의 세 칸을 모두 누름). 그래서 생성 후 "미완성 + 해 존재"를
확인하고 아니면 재시도한다.

**GF(2) 솔버** — 변수 = 누를 칸, 방정식 = 각 칸의 반전 조건. 행 하나를 32비트
비트마스크(계수 25비트 + RHS 1비트)로 놓고 가우스 소거한다. 자유 변수가 16개 이하면
커널 기저의 부분합을 Gray 코드로 전수 열거해 **최소 해**를 보장한다.
테스트가 작은 보드에서 브루트포스(2^n 부분집합 전수)와 교차 검증한다.

**난이도 축 (§9.4)** — K(역셔플 누름 횟수) / 사용 칸 수(FREE 비율) / 마스크 복잡도.
기본 테이블: D1 3×3+십자 K3 → D5 다이아몬드 레이아웃+전체 마스크 K12.

---

## 4. 사양서에서 발견한 문제 (총 8건)

구현하며 드러난 기획서 자체의 모순·누락이다. **모두 코드에 가드를 넣어 조용히 실패하지 않게 했다.**

### 4.1 러시아워 §6이 난이도 상한을 만든다 (실측)

`[필수] 모든 오브젝트는 최소 1칸 이상 움직일 수 있도록 배치` 조항 때문에
**깊이 5수 이상 배치는 전부 탈락**한다. 다른 조항은 아예 걸리지도 않는다.

원시 최대 깊이는 12수까지 나오지만 §6 통과 깊이는 2~4수에 머문다.
깊은 배치 = 촘촘한 배치인데, 촘촘하면 반드시 끼는 조각이 생긴다.
**방해 블록을 늘릴수록 오히려 깊이가 낮아진다** (블록 4개 중앙값 3 → 6개 중앙값 2).

→ 난이도 테이블의 `minimumMoves` 범위를 실측값(2~12)으로 재조정하고,
난이도를 **방해 오브젝트 수 / 목표 개수 / 제한시간**으로 함께 스케일링.
생성기는 요구 범위를 못 채우면 실패시키지 않고 찾아낸 것 중 가장 어려운 배치를 실제 값과 함께 반환.

> 더 어려운 레벨이 필요하면 구성 자체를 언덕오르기(hill climbing)로 개선하는 방법이 있다. 미구현.

### 4.2 레이저 — 인벤토리 5슬롯이 난이도 설계를 제한한다

`빔 수 × 해 크리스탈 수 + 여분 ≤ 5` 를 넘으면 **어떤 레벨도 생성되지 않는다.**
D4/D5를 빔 2개 × 크리스탈 3개로 잡았다가 필요 슬롯이 6개가 되어
200회 시도가 8ms 만에 전부 실패했다.

→ 테이블을 상한에 맞추고, `generate()` 시작 시 이 조건을 확인해 **즉시 경고**한다.

### 4.3 정렬 §10.4를 그대로 구현하면 안 된다

사양은 "완성 상태에서 역방향으로 **유효 이동**을 N회 수행해 셔플하면 항상 해가 존재한다"고 적지만,
**이 퍼즐의 이동은 가역적이지 않다.** 최상단 동일색 런이 통째로 움직이므로
A→B로 옮긴 뒤 B→A로 되돌리는 수가 규칙상 불가능한 경우가 많다.

→ **역이동(reverse move)** 을 직접 정의해, 되돌리는 정방향 이동이 반드시 합법이 되도록 조건을 건다.

```
k <= min(3, B의 최상단 런 길이)          … 정방향 이동 개수 제한 (§6)
k < 런 길이  또는  k == B의 전체 개수     … 꺼낸 뒤 B의 최상단이 c이거나 B가 빔
A는 비어 있거나 A의 최상단 색 != c        … 올린 뒤 A의 최상단 런이 정확히 k
A의 잔여 공간 >= k                        … §6
```

`ColorSortLevelGenerator.collectReverseMoves()` 가 이 조건을 구현한다.

### 4.4 색 채우기 §4 난이도 표가 모순이다

| 난이도 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| 활성 칸 | 12 | 10 | **8** | **8** | **6** | **6** |
| 오염 칸 | 12-13 | 10 | **12-14** | **5/5(=10)** | **3/3/3(=9)** | **2/2/2/2(=8)** |

오염 영역은 활성 영역의 부분집합이어야 하는데 오염이 활성보다 많다.
원본 PDF 표가 옮겨지며 어긋난 것으로 보인다.

→ 난이도 곡선을 결정하는 **오염 덩어리 구성을 정본으로 삼고** 활성 칸 수를 올렸다
(D4 8→10, D5 6→9, D6 6→8). `validateDifficultyConfig()` 가 검사해 위반 시 즉시 경고.
**실제 표 값이 확인되면 `DEFAULT_COLOR_FILL_DIFFICULTY_TABLE` 만 교체하면 된다.**

### 4.5 색 채우기 — 제한 시간이 사양에 없다

처음에 60~100초로 잡았다가 봇으로 재보니 근거 없이 헐거웠다.
한 번의 터치가 오염 덩어리를 통째로 정화하므로 필요한 터치가 덩어리 수만큼뿐이고,
다이얼 한 바퀴가 2~4초라 놓쳐도 곧 기회가 온다.

봇 실측(레벨 30개, 90퍼센타일): **D1 0.8초 ~ D6 4.1초.** 반응 지연 0.6초에도 전부 클리어.

→ 실측의 5~7배인 **15~30초**로 재조정.

### 4.6 연결 §3의 HOLES 마스크는 해밀턴 경로가 존재할 수 없다

이분 그래프 불균형이 3(45칸 = 21/24)이라 원리적으로 불가능하다.

→ 난이도 설정에서 제외. 생성기는 탐색 전에 불균형을 확인해 헛돌지 않는다.

### 4.7 스위치 §5 — 상태 표기가 도식과 텍스트에서 서로 다르다

문서 도식 라벨은 "안 눌린 상태=1 / 눌린 상태=0", 텍스트 정의는 그 반대다.

→ 구현은 **1 = 눌림(녹색/목표), 0 = 안 눌림(빨강)** 으로 통일했다.
외부 데이터가 반대 표기라면 임포터에서 한 번만 매핑한다.

### 4.8 슬라이드 §12.2 — 셔플 의사코드의 prev 정의가 자기모순

"빈칸의 새 위치가 아니라, 방금 이동한 조각이 원래 있던 자리"라고 적었지만
그 둘은 **같은 칸**이라 문장이 성립하지 않는다.

→ 올바른 정의는 **prev = 이동 전의 빈칸 위치**(= 조각이 이동해 들어간 자리).
코드는 처음부터 이 정의였고, 사양 문서를 수정해 맞췄다.

---

## 5. 남은 작업

### 5.1 Horizon 통합 — 공통 브리지 + 레퍼런스 1종 완료, 나머지 7종 남음

**완료된 것**

| 파일 | 내용 |
|---|---|
| `Puzzle_HorizonBridge.ts` | 8개 퍼즐 공통 어댑터. 좌표 변환 / 터치 라우팅 / 프레임 구동 / Focused Interaction / 자식 수집 |
| `Switch_CoreAPI.ts` | PUZ_08 을 실제로 구동하는 Horizon `Component`. **나머지 7종의 템플릿** |
| `Puzzle_LocalOwnership.ts` | 플레이어 입장 시 소유권 이전. Local 스크립트 실행의 전제 조건 |

**남은 것** — `Laser_` / `RushHour_` / `ColorSort_` / `ColorFill_` / `Flow_` / `CardMatch_` /
`SlidePuzzle_CoreAPI.ts` 7개. `Switch_CoreAPI.ts` 를 복제해 세션 타입과 연출만 바꾸면 된다.
브리지와 소유권 컴포넌트는 **그대로 재사용**하므로 다시 만들지 않는다.

자세한 구동 방법은 **§9**, 빈 레벨 셋업은 **§10** 을 참고한다.

### 5.2 데이터 테이블 실데이터 교체

현재 모든 `DEFAULT_*_TABLE` 은 구조를 보여 주는 초기값이다.
리소스 경로(`meshPath`, `imagePath`, `materialId`)와 난이도 수치를 실제 값으로 교체해야 한다.
`load*Table()` 로 통째 교체할 수 있게 만들어 두었다.

### 5.3 러시아워·레이저 필드 테이블 사전 채움 (성능 — §12.3 필수 조치)

러시아워 D2~D5, 레이저 D2~D5 는 기본 필드 테이블이 D1 한 판뿐이라 **항상 런타임 생성기**로
떨어진다. 데스크톱 실측 러시아워 D5 3.7초 / 레이저 D4 374ms 인데 폰 CPU 는 3~10배 느리므로
**퀘스트 시작·라운드 전환마다 수 초의 동기 프레임 정지**가 난다. 출시 전에 생성기를 에디터/
빌드 타임에 돌려 필드 테이블을 난이도별로 사전 채움하거나, 생성 루프를 프레임 분할해야 한다.
상세 근거는 §12.3.

---

## 6. 검증 방법

### 6.1 타입 체크

```bash
node ./node_modules/typescript/bin/tsc --noEmit --skipLibCheck
```

> `--skipLibCheck` 는 반드시 붙인다. Horizon이 제공하는 `types/*.d.ts` 자체가
> `TS1038: A 'declare' modifier cannot be used in an already ambient context` 를 다량 발생시킨다.
> 우리 코드 문제가 아니다.

현재 기준 **에러 0건**.

### 6.1.1 Horizon 에디터 컴파일 제약 검사 (반드시 함께 돌린다)

**로컬 `tsc` 가 통과해도 Horizon 에디터에서는 컴파일이 깨질 수 있다.**
에디터의 TypeScript 는 우리 `tsconfig.json`(target ES2020)보다 낮은 `target`을 쓰고
lib 도 제한적이다. 실측으로 확인된 제약은 두 가지다.

| 제약 | 증상 | 대응 |
|---|---|---|
| `target < ES2015` | `Set` / `Map` 이터레이터를 `for...of` 로 직접 순회하면 `TS2802` | `Array.from(...)` 으로 감싼다 |
| lib 에 TypedArray 없음 | `Int8Array` 등이 `Cannot find name` | 일반 `number[]` 를 쓴다 |

로컬에서 같은 조건을 재현하는 명령이다. **커밋 전에 이것도 통과해야 한다.**

```bash
node ./node_modules/typescript/bin/tsc --noEmit --skipLibCheck --target ES5 --lib ES2020
```

> `--lib ES2020` 을 남겨 두는 이유: `Map`/`Set`/`Promise` 타입 자체는 살리고
> **다운레벨 반복 위반만** 드러내기 위해서다. `--target ES5` 만 주면 lib 도 ES5 로 떨어져
> 무관한 오류가 쏟아진다.
>
> 이 명령이 잡지 못하는 것도 있다. `Int8Array` 는 ES5 lib 에 있어서 여기서는 통과한다.
> 에디터 lib 은 그보다 더 좁으므로, **ES2015 이후 내장 API 를 새로 쓸 때는
> 기존 `Basics_*` 코드에 전례가 있는지 먼저 확인한다.**
> (전례 있음: `Array.from`, `new Map`, `new Set` / 전례 없어 회피함: `padStart`, TypedArray)

**적용 이력** — 에디터 로그로 확인해 4개 파일을 수정했다.

| 파일 | 오류 | 수정 |
|---|---|---|
| `Flow_Board.ts` (3곳) | `IterableIterator` 순회 | `Array.from(this._nodes.values())` |
| `Laser_LevelGenerator.ts` | `Set` 순회 | `Array.from(pathKeys)` |
| `RushHour_Board.ts` | `Set` 순회 | `Array.from(this._dockedGoalIds)` |
| `RushHour_Solver.ts` (4곳) | `Int8Array` 없음 | `number[]` + `new Array<number>(n).fill(-1)` |
| `SlidePuzzle_Board.ts` | (선제 조치) `padStart` 는 ES2017 | 폭 2 수동 패딩 |

수정 후 770 PASS 유지 — 동작 변화 없음.

### 6.2 전체 테스트 (Node)

non-relative import를 Node가 해석하도록 `NODE_PATH` 를 걸어 실행한다.

```bash
OUT=/tmp/allbuild
node ./node_modules/typescript/bin/tsc \
  $(ls RushHour_*.ts Laser_*.ts ColorSort_*.ts ColorFill_*.ts Flow_*.ts CardMatch_*.ts SlidePuzzle_*.ts Switch_*.ts) \
  PuzzleUI_Definitions.ts PuzzleUI_Registry.ts PuzzleUI_Model.ts PuzzleUI_Tests.ts \
  Utility_Events.ts \
  --outDir $OUT --module CommonJS --target ES2020 --baseUrl . --skipLibCheck --strict

cat > $OUT/all.js <<'EOF'
const suites = [
  ['PUZ_01 레이저',      'Laser_Tests',       'runLaserTests'],
  ['PUZ_02 러시아워',    'RushHour_Tests',    'runRushHourTests'],
  ['PUZ_03 정렬',        'ColorSort_Tests',   'runColorSortTests'],
  ['PUZ_04 색 채우기',   'ColorFill_Tests',   'runColorFillTests'],
  ['PUZ_05 연결',        'Flow_Tests',        'runFlowTests'],
  ['PUZ_06 카드 맞추기', 'CardMatch_Tests',   'runCardMatchTests'],
  ['PUZ_07 슬라이드',    'SlidePuzzle_Tests', 'runSlidePuzzleTests'],
  ['PUZ_08 스위치',      'Switch_Tests',      'runSwitchTests'],
  ['메인 UI 허브',       'PuzzleUI_Tests',    'runPuzzleUITests'],
];
let pass = 0, fail = 0;
for (const [name, mod, fn] of suites) {
  const r = require(mod)[fn]();
  pass += r.passed; fail += r.failed;
  for (const x of r.results) if (!x.isPassed) console.log(`FAIL [${name}]`, x.name, '-', x.detail ?? '');
  console.log(`${name} ${r.passed} PASS / ${r.failed} FAIL`);
}
console.log(`합계 ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
EOF

NODE_PATH=$OUT node $OUT/all.js
```

`Utility_Events.ts` 는 `horizon/core` 를 `import type` 으로만 쓰므로 컴파일 시 소거된다.
위 명령에서 나오는 `Cannot find module 'horizon/core'` 경고는 무시해도 되며, JS는 정상 생성된다.

카드 맞추기 실행 중 나오는 `필드 데이터 오류 ... 홀수입니다` 경고는
**홀수 데이터 거부를 확인하는 의도된 negative 테스트**의 출력이다.

### 6.3 현재 결과

```
PUZ_01 레이저              93 PASS / 0 FAIL
PUZ_02 러시아워             68 PASS / 0 FAIL
PUZ_03 정렬               106 PASS / 0 FAIL
PUZ_04 색 채우기            97 PASS / 0 FAIL
PUZ_05 연결                97 PASS / 0 FAIL
PUZ_06 카드 맞추기          88 PASS / 0 FAIL
PUZ_07 슬라이드             93 PASS / 0 FAIL
PUZ_08 스위치             128 PASS / 0 FAIL
메인 UI 허브               54 PASS / 0 FAIL
                       --------------------
합계                      824 PASS / 0 FAIL
```

> 러시아워 실행 중 나오는 `탐색 거리 N 수 배치의 실제 최소 이동 수는 M 수입니다` 경고는
> 생성기가 minimumMoves 를 솔버로 재측정해 보정했다는 정상 로그다 (§8 버그 2 수정).

---

## 7. 기획서 조항 대응표

### 7.1 PUZ_01 레이저

| 조항 | 구현 위치 |
|---|---|
| §2 필드 규격 / 인벤토리 5슬롯 | `Laser_Definitions.ts` 상수, `LaserPlacementValidator` |
| §3 1.x 직선 진행 / 발사체 색 == 레이저 색 | `LaserBeamTracer.trace()` |
| §3 2.x 수신체 색 일치 판정 | `trace()` / `isSolved()` |
| §3 3.x 크리스탈 궤도 변경 / 방향 고정 / 여분 허용 | `getCrystalOutputs()`, `LaserBoard.placeFromInventory()` |
| §3 4.1 중계체 경유 (다색 지원) | `LaserBeamTracer` RELAY 분기 |
| §3 4.2 해골 → 전 수신체 Fault | `didHitSkull`, `buildObjectStates()` |
| §4.1 크리스탈 5종 동작 | `reflectTriangle()`, `getTeeArms()`, `getCrystalOutputs()` |
| §4.3 고정 크리스탈 | `EGimmickType.FIXED_CRYSTAL`, `pickUp()` |
| §5 색 = 레이어, 교차 무간섭 | 방문 키 `(셀, 진입방향, 색)` |
| §6 On / Off / Fault | `buildObjectStates()` |
| §7 데이터 테이블 3계층 | `Laser_DataTables.ts` |
| §8.1 무한 루프 방지 | `LaserBeamTracer` visited 집합 |
| §8.2 배치 변경 시 즉시 재계산 | `LaserSession.refreshBeams()` → `BEAM_UPDATED` |
| §8.3 솔버 + 생성기 | `Laser_Solver.ts`, `Laser_LevelGenerator.ts` |
| §8.4 예외 테스트 | `Laser_Tests.ts` |

### 7.2 PUZ_02 러시아워

| 조항 | 구현 위치 |
|---|---|
| §3 필드 규격 9×9 / 플레이 7×7 | `RushHour_Definitions.ts` 상수 |
| §4 도착 포인트 (꼭짓점 제외, 최대 2곳) | `getEndPointCandidates()`, `validateEndPoints()` |
| §5.1 목표 USB 1×2, 최대 2개, 난이도 3+ | `GOAL_OBJECT_LENGTH`, `placeGoal()` |
| §5.2 방해 오브젝트 1~4×1, 1×1은 전 방향 | `BLOCKER_LENGTHS`, `EOrientation.FREE` |
| §6 배치 제약 3종 | `RushHourPlacementValidator` |
| §7 이동 & 스냅 | `slide()` / `snapToCell()` / `snapFromContinuous()` |
| §8 단일 터치 / 히트박스 / 화면 이탈 | `RushHourDragController` |
| §9 USB 결합·분리, 3칸 점유 | `dock()` / `undock()` / `getGoalOccupiedCellsInFullGrid()` |
| §10 데이터 테이블 3계층 | `RushHour_DataTables.ts` |
| §11.2 BFS 솔버 + 생성기 | `RushHour_Solver.ts`, `RushHour_LevelGenerator.ts` |
| §11.3 목표 2개 동시 클리어 | `isSolved()`, `isGoalState()` |
| §11.4 테스트 케이스 | `RushHour_Tests.ts` |

### 7.3 PUZ_03 정렬

| 조항 | 구현 위치 |
|---|---|
| §2 승패 (시간 초과 / 데드락 즉시 종료) | `ColorSortSession.fail()`, `EColorSortFailReason` |
| §3 케이스 8개 / 정원 4 / 활성 수량 | `TOTAL_CASE_COUNT`, `CASE_CAPACITY`, `isActive` |
| §4 케이스 상태 4종 | `getCaseState()`, `ECaseState` |
| §5 색상 10종 | `ALL_BATTERY_COLORS` |
| §6 이동 규칙 (런 이동, 1~3개, 잔여 공간) | `getTopRunLength()`, `getMovableCount()`, `canMove()` |
| §7 블랙 건전지 | `Battery.isRevealed`, `revealExposedBatteries()` |
| §8 조작 (모바일 대체) | `ColorSort_DragController.ts` |
| §9 데이터 테이블 3계층 | `ColorSort_DataTables.ts` |
| §10.2 유효성 검사 순서 | `canMove()` |
| §10.3 데드락 감지 | `isDeadlocked()`, `checkDeadlock()` |
| §10.4 레벨 생성기 (역이동 방식) | `ColorSort_LevelGenerator.ts` |
| §10.5 클리어 판정 | `isSolved()` |
| §10.6 테스트 | `ColorSort_Tests.ts` |

### 7.4 PUZ_04 색 채우기

| 조항 | 구현 위치 |
|---|---|
| §2 승패 | `ColorFillSession.succeed()` / `fail()` |
| §3 18칸 / 20도 | `DIAL_SLOT_COUNT`, `DEGREES_PER_SLOT` |
| §4 난이도별 활성/오염 구성 | `ColorFill_DataTables.ts` (모순 처리는 §4.4 참조) |
| §5 연속 오염 1회 정화 / 무패널티 / 머티리얼 | `getContiguousContaminatedRun()`, 오브젝트 테이블 |
| §6 바늘 회전 / 터치 = 항상 반전 / 딜레이 | `ColorFillDial.touch()`, `scheduleReverse()` |
| §7 데이터 테이블 3계층 | `ColorFill_DataTables.ts` |
| §8.1~§8.3 모델 / 회전 / 터치 처리 | `ColorFill_Dial.ts` |
| §8.4 클리어 판정 | `isSolved()` |
| §8.5 레벨 생성기 (덩어리 비인접) | `placeContamination()` |
| §8.6 자동 플레이 봇 밸런싱 검증 | `ColorFill_AutoPlayBot.ts` |
| §8.7 테스트 | `ColorFill_Tests.ts` |

### 7.5 PUZ_05 연결

| 조항 | 구현 위치 |
|---|---|
| §2 승패 | `FlowSession.succeed()` / `fail()` |
| §3 7×7 / 0-1 비트맵 | `parseTileBitmap()`, `FLOW_TILE_MASKS` |
| §4 메인/서브 정의, 입출력 1회 제한 | `FlowNode`, `canExtend()` 자기교차 검사 |
| §5 인접 이동 / 대각선 금지 / 타 색 통과 금지 | `isOrthogonallyAdjacent()`, `canExtend()` |
| §5 모든 서브 사용 | `getUncoloredSubCount()`, `isSolved()` |
| §6 그랩 / 해제 / 지우기 / 양손 금지 | `Flow_DragController.ts` |
| §7 실패 시 입력 차단 | `FlowSession.fail()` |
| §8 데이터 테이블 3계층 | `Flow_DataTables.ts` |
| §9.2 경로 확장 유효성 | `canExtend()` |
| §9.3 되돌아가기 (스택) | `popHead()` |
| §9.4 두 조건 클리어 검증 | `isSolved()` |
| §9.5 해밀턴 경로 분해 생성기 | `Flow_LevelGenerator.ts` |
| §9.6 테스트 | `Flow_Tests.ts` |

### 7.6 PUZ_06 카드 맞추기

| 조항 | 구현 위치 |
|---|---|
| §1 폭탄이 리셋을 대신 / 리셋 불가 | `CardMatchSession.requestReset()` |
| §2 클리어 (폭탄만 남아도 클리어) | `CardMatchBoard.isSolved()` |
| §3 게임 플로우 / 최대 2개 활성화 | `reveal()`, `MAX_REVEALED_TILES` |
| §4 예외 처리 (동시 활성화 / 재선택 / 폭탄 잠금) | `reveal()` 거절 분기, `isInputLocked` |
| §5 난이도별 타일 수 | `DEFAULT_CARD_FIELD_TABLE` |
| §6 판정 결과별 색상 | `TILES_MATCHED` / `TILES_MISMATCHED` |
| §8 데이터 테이블 3계층 | `CardMatch_DataTables.ts` |
| §9.1 필드 생성 + 홀수 거부 | `CardMatchLevelGenerator`, `validateFieldData()` |
| §9.2 타일 상태 머신 | `ETileState`, `CardMatchBoard` |
| §9.3 폭탄 셔플 + 타이머/입력 잠금 | `shuffleUnmatchedObjects()`, `isTimerPaused` |
| §9.4 판정 중 세 번째 선택 | `didResolvePending` |
| §9.5 리셋 무효화 | `requestReset()` |
| §9.7 테스트 | `CardMatch_Tests.ts` |

### 7.7 PUZ_07 슬라이드

| 조항 | 구현 위치 |
|---|---|
| §2 승패 | `SlidePuzzleSession.succeed()` / `fail()` |
| §4 규격 및 사이즈 | `SlidePuzzle_Definitions.ts` 상수, `getLayoutTotalCm()` |
| §5 인접 빈칸 조건 / 호버 Emissive / 동시 입력 | `canHover()`, `SlidePuzzleInputController` |
| §6 0.25초 이동 + 전체 입력 잠금 | `ESlideInputState.MOVING`, `board.update()` |
| §8 역순 셔플 + 되돌리기 배제 | `SlidePuzzleBoard.shuffle()` |
| §9 완성 연출 | `PUZZLE_COMPLETED` 이벤트 (원본 이미지 경로 전달) |
| §10 사이드 패널 원본 이미지 | `getReferenceImagePath()` |
| §11 데이터 테이블 3계층 | `SlidePuzzle_DataTables.ts` |
| §12.1 보드 모델 | `board: number[]`, blank sentinel |
| §12.2 셔플 알고리즘 | `shuffle()` |
| §12.3 입력 잠금 상태 | `ESlideInputState` |
| §12.4 동시 입력 타임스탬프 처리 | `SlidePuzzleInputController.flush()` |
| §12.6 클리어 판정 | `isBoardSolved()` |
| §12.7 테스트 | `SlidePuzzle_Tests.ts` |

### 7.8 PUZ_08 스위치

| 조항 | 구현 위치 |
|---|---|
| §3 규격 (7cm 키 판 / 35cm / 6cm 키 캡 / 7cm 콜리전) | `Switch_Definitions.ts` 상수 |
| §4 5×5 키 판 / A1~E5 / FREE 칸 | `parseKeyLayout()`, `toCoordLabel()`, `ESwitchCellState.FREE` |
| §4 생성 연출 (1초 / 0.2초) | `BOARD_SPAWN_SECONDS`, `INITIAL_PRESS_SECONDS` |
| §5 키 캡 2상태 (1=눌림 통일) | `ESwitchCellState`, §4.7 참조 |
| §6 스위치 영역 3×3 / 중앙 항상 포함 | `parseSwitchMask()`, `getMaskViolations()` |
| §6 우측 미니 UI 표시 | `MASK_CHANGED` 이벤트, `getMask()` |
| §7 조작 연출 0.0/0.2/0.4초 | `SwitchBoard.update()`, `KEY_PRESSED`/`AREA_TOGGLED`/`PRESS_SEQUENCE_FINISHED` |
| §7 먼저 들어간 손만 인식 / 부분 누름 미반응 | `SwitchInputController.touchDown()`/`touchUp()` |
| §8 데이터 테이블 3계층 | `Switch_DataTables.ts` |
| §9.1 상태 모델 | `grid[25]` + `mask[9]` |
| §9.2 토글 (클리핑 / FREE 무영향 / 랩어라운드 금지) | `getToggledPositions()` |
| §9.3 클리어 판정 | `isGridSolved()` |
| §9.4 역셔플 생성기 + GF(2) 솔버 | `SwitchBoard.shuffleFromSolved()`, `Switch_Solver.ts` |
| §9.5 마스크 상시 표시 | `MASK_CHANGED`, PUZ_08 문서 M4 |
| §9.6 입력 배타성 | `SwitchInputController` 단일 터치 잠금 |
| §9.7 테스트 | `Switch_Tests.ts` (128 케이스) |

---

## 8. 전 퍼즐 모바일 플레이 검증 리뷰 (2026-09-01)

8개 퍼즐 전부에 대해 다음을 1회 수행했다.

- 사양 문서(PUZ_00 §8 + 퍼즐별 모바일 절) 대 코드 전수 대조
- **모바일 입력 API만 사용**(드래그 시작/이동/종료, 탭, touchDown/Up)한 전 난이도
  클리어 시뮬레이션 — 8개 퍼즐 × D1~D5(6) 전부 클리어 확인
- 적대적 입력: 조작 중 두 번째 터치, 영역 밖 드랍/이탈, 연출·잠금 중 입력, 연타,
  완료·실패 후 입력, 같은 프레임 멀티터치 등
- 생성기 스윕 (러시아워 150판, 레이저 100판, 색 채우기 300판 등)

### 8.1 수정한 버그 (6건 — 회귀 테스트 포함)

| 퍼즐 | 증상 | 수정 |
|---|---|---|
| 러시아워 | **결합된 USB 가 탭 수준 지터만으로 분리.** `update()` 기준점이 저장 좌표(밀착)라, 슬롯 좌표에서 시작한 드래그의 첫 update 가 곧바로 반 칸 이동 판정이 됨 | `RushHour_DragController` 에 `_beginValue`(드래그 시작 좌표) 도입. §9 반 칸 규칙 준수 |
| 러시아워 | `minimumMoves` 과대평가. `exploreReachableStates()` 가 상태 상한에서 그래프를 잘라 거리가 +1 될 수 있음 (150판 중 11판) | 채택 직전 솔버로 재측정 (`adoptBoard()`) |
| 슬라이드 | **클리어 판정이 이동 완료(0.25초)가 아닌 누름 시점에 발생.** 완성 연출이 조각이 미끄러지는 중에 시작되고, 마지막 이동의 `PIECE_MOVE_FINISHED` 가 누락되며 보드가 `MOVING` 으로 방치 | `applyMoveResult` 가 `board.isSolved()` 대신 `inputState !== MOVING` 을 검사 (§12.6 시점 준수) |
| 연결 | 역주행 지우기 시 `NODE_UNLIT` 이 꺼진 칸(pop 된 이전 머리)이 아니라 이동해 간 칸을 발행 → UI 가 엉뚱한 전구를 끔 | `moveDraw()` 가 이동 전 머리 좌표를 캡처해 발행 |
| 정렬 | 리스폰 슬롯이 1개라 연속 영역 밖 드랍 시 앞선 2초 잠금이 조기·무음 해제 (`RESPAWN_FINISHED` 짝 깨짐) | 케이스별 독립 리스폰 목록으로 변경. 각 드랍이 자기만의 2초를 기다림 |
| 정렬 | `CASE_CLOSED` 가 이미 닫힌 케이스에 매 이동마다 재발행 (닫힘 연출 반복 재생) | 이동 전 완성 집합을 스냅샷해 **새로 닫힌 케이스만** 알림 |

### 8.2 사양 보완 / 품질 수정 (12건)

- **스위치**: 연출 잠금(0.4초) 중 `touchDown` 이 접수되어 사실상 입력 1개가 버퍼링 → 잠금 중 다운 거부
- **정렬**: 필드 테이블 레벨이 시작부터 데드락이어도 방치 → 라운드 시작 시 즉시 데드락 판정 (§2)
- **정렬**: 집었던 케이스 위 제자리 드랍이 2초 잠금 벌점 → 무벌점 복귀로 변경 (M4 에 명시)
- **정렬**: 솔버의 visited 집합 + 깊이 컷 상호작용으로 풀 수 있는 보드를 "해 없음" 오판 가능 → 상태별 최소 확장 깊이를 기록하는 Map 으로 변경
- **러시아워**: `USB_DOCKED` / `USB_UNDOCKED` 이벤트 신설 — §9 "결합 성공 이펙트(LED, 진동)" 트리거. 기존 GOAL_REACHED/LEFT 는 READY↔DOCKED 전이를 구분하지 못했다
- **레이저**: 고정 크리스탈이 최근접이면 드래그 전체가 거절 → 반경 안 **이동 가능** 크리스탈 중 최근접 선택
- **레이저**: 인벤토리發 배치 거절 시 `PLACEMENT_REJECTED` 미발행 → 회수(`CRYSTAL_RETURNED`)와 별개로 발행
- **레이저**: `resetPlacements()` 가 일시정지/종료 중에도 보드 변경 → `isActive` 검사 추가
- **색 채우기**: 봇 반응 지연이 "판단 주기"가 아닌 "터치 후 쿨다운"으로만 동작해 사실상 매 프레임 완벽 반응 → 판단 시도마다 리셋 (§8.6 실측의 의미 회복. 제한시간 15~30초는 여전히 충분함을 재확인)
- **색 채우기**: 다이얼 슬롯 배열 길이 오류 시 무음으로 전부 비활성 대체 → 경고 로그 추가
- **공통 (8개 세션)**: 레벨 생성 실패 시 `GAME_OVER` 상태 전이만 있고 `QUEST_FAILED`/`GAME_END` 미발행 → 결과 UI 가 영원히 대기하지 않도록 `fail()` 경유로 통일
- **공통 (6개 세션)**: 필드 테이블 레벨 선택이 `Math.random` 으로 세션 seed 무시 → seed 반영 (재현성)

### 8.3 수정하지 않고 남긴 메모

- 러시아워 `MOVE_REJECTED` 이벤트는 선언만 있고 발행처가 없다 (컨트롤러가 조용히 경계에 클램프하는 설계라 실제로 거절이 발생하지 않는다). `ERushHourState.MOVING` 도 미사용.
- 클리어/셔플이 끝나는 프레임의 델타 시간이 제한시간에서 차감되지 않거나 과차감될 수 있다 (최대 1프레임, 플레이어에게 유리하거나 무시 가능한 수준).
- 연결: 손가락이 빨라 칸을 건너뛰면 로직은 그 입력을 거절한다. **화면 어댑터가 셀 경계를 보간**해 중간 칸을 순서대로 호출해야 한다 (PUZ_05 문서 M3 에 명시).
- 색 채우기: 필드 테이블 경유 레벨은 봇 클리어 검증(§8.6)을 거치지 않는다. 현재 기본 필드 테이블이 비어 있어 실害 없음 — 실데이터 투입 시(§5.2) 봇 검증을 함께 돌릴 것.
- 레이저 드래그는 화면 이탈 시 경계 클램프를 하지 않는다 — 영역 밖 드랍 = 인벤토리 회수가 정식 조작(M2)이라 의도된 설계다.

---

## 9. 실제 월드에서 실행하기 (Horizon 통합)

순수 로직은 `horizon/core` 를 전혀 모르므로, 그것만으로는 게임이 돌지 않는다.
**Horizon `Component` 를 하나 붙여 3가지를 연결하면 그때부터 실제로 플레이된다.**

```
[1] 프레임 구동   World.onUpdate  ->  session.update(deltaTime)
[2] 입력          화면 터치 ray   ->  격자 좌표  ->  session 의 입력 진입점
[3] 연출          session 이벤트  ->  3D 오브젝트 갱신
```

셋 중 **[1]을 빠뜨리는 것이 가장 흔한 실수**다. 제한 시간이 흐르지 않고,
슬라이드의 0.25초 이동·스위치의 0.4초 누름·카드의 폭탄 셔플이 영원히 끝나지 않아
"눌러도 아무 반응이 없는" 상태가 된다.

### 9.1 공통 브리지 — `Puzzle_HorizonBridge.ts`

8개 퍼즐이 공유한다. 퍼즐마다 다시 만들지 않는다.

| 클래스 / 함수 | 역할 |
|---|---|
| `PuzzleBoardMapper` | 격자 좌표 ↔ 월드 좌표. `getGridFromRay()` 가 터치 ray 를 **연속 격자 좌표**로 바꾼다 |
| `PuzzleTouchRouter` | `Basics_Input_Screen` 의 터치를 받아 격자 좌표로 변환해 콜백. **단일 터치 강제** (§8.1) |
| `connectPuzzleUpdate()` | `World.onUpdate` 에 세션의 `update(dt)` 를 건다 |
| `enterPuzzleInteraction()` | Focused Interaction 진입 + 카메라 자동 배치. **없으면 터치가 오지 않는다** |
| `collectChildEntities()` | 루트 엔티티의 자식을 이름순으로 모은다. 격자 오브젝트를 하나씩 연결하지 않아도 된다 |

**콜라이더 레이캐스트가 아니라 보드 평면과의 교차를 쓴다.** PUZ_00 §8.4 가
"포인터가 영역 밖으로 나가도 드래그 입력은 유지된다" 를 요구하는데, 타일 콜라이더에
레이캐스트하면 보드 밖을 가리키는 순간 히트가 사라져 이 규칙을 지킬 수 없다.
평면 교차는 보드 밖이든 칸 사이든 항상 좌표를 돌려준다.
드래그 컨트롤러들이 요구하는 **소수 좌표**(예: `col + 0.6`)도 이 방식이라야 나온다.

좌표 규약은 보드 중심 엔티티의 축을 그대로 쓴다.

```
right = +col 방향 / up = -row 방향 (row 0 이 위) / forward = 평면의 법선
```

### 9.2 레퍼런스 구현 — `Switch_CoreAPI.ts`

PUZ_08 을 실제로 구동하는 완성된 컴포넌트다. 탭 전용이라 구조가 가장 짧아 템플릿으로 삼는다.

**월드에 붙이는 순서** (전체 셋업은 §10 참조)

1. 빈 엔티티에 `Switch_CoreAPI` 스크립트를 붙이고 실행 모드를 **Local** 로 둔다.
2. `boardCentre` 에 키 판 중심 엔티티를 넣는다 (이 엔티티의 방향이 곧 보드 평면).
3. `keyCapRoot` 에 키 캡 25개를 자식으로 가진 **부모 엔티티 하나**를 넣는다.
   자식 이름을 `KeyCap_00` ~ `KeyCap_24` 로 자리수를 맞춰 붙이면 이름순 = A1..E5 가 된다.
   비워 두면 연출 없이 로직만 돈다 — 배선 확인용으로 유용하다.
4. 같은 월드에 `InputScreenListener`(`Basics_Input_Screen.ts`)가 붙은 엔티티가 있어야 한다.
   **터치 입력이 전부 거기서 나오므로 없으면 조작이 안 된다.**
5. `Puzzle_LocalOwnership` 의 `targets` 에 이 엔티티를 넣어 소유권을 넘긴다.
   **넘기지 않으면 Local 스크립트가 아예 실행되지 않는다** (§10.1-2).
6. `autoStart` 를 켜면 바로 시작한다. 퍼즐 트리거(PUZ_00 §1)에서 시작하려면
   끄고 `SwitchCoreAPI.instance?.startQuestByDifficulty(n)` 을 호출한다.

**`props` 목록**

| prop | 기본값 | 내용 |
|---|---|---|
| `boardCentre` | — | 키 판 중심이자 평면 정의 |
| `keyCapRoot` | — | 키 캡 25개의 부모 엔티티 |
| `cellSpacing` | 0.07 | 칸 간격 (m). §3 의 7cm |
| `difficulty` | 1 | 시작 난이도 |
| `autoStart` | true | 시작과 동시에 퀘스트 진행 |
| `seed` | 0 | 0 이면 매번 다른 레벨 |
| `cameraObject` | — | **보통 비워 둔다.** 비우면 보드 정면에 자동 배치 |
| `cameraDistance` | 0.6 | 보드-카메라 거리 (m). 0 이면 카메라를 건드리지 않음 |
| `cameraFov` | 40 | 시야각 |

### 9.3 나머지 7개 퍼즐로 확장하기

`Switch_CoreAPI.ts` 를 복제하고 **입력 배선만** 퍼즐 성격에 맞게 바꾼다. 나머지는 동일하다.

**탭 퍼즐** (슬라이드 / 카드 맞추기) — 가장 단순하다.

```ts
onEnd: (point) => {
    const cell = mapper.toCellIndex(point);
    if (cell !== undefined) { session.pressPiece(cell); }
}
```

**드래그 퍼즐** (러시아워 / 레이저 / 정렬 / 연결) — 소수 좌표를 그대로 넘긴다.
`toCellIndex()` 로 반올림하면 **안 된다.** 스냅은 각 퍼즐의 드래그 컨트롤러가 한다.

```ts
onBegin: (point) => session.beginDrag(point.row, point.col),
onMove:  (point) => session.updateDrag(point.row, point.col),   // 보드 밖 좌표도 그대로
onEnd:   ()      => session.endDrag(),
```

> 정렬 퍼즐은 케이스 인덱스를 받으므로 `point.col` 을 케이스 번호로 변환해 넘긴다.
> 연결 퍼즐은 칸을 건너뛴 입력을 거절하므로, 어댑터가 **셀 경계를 보간**해
> 중간 칸을 순서대로 호출해야 한다 (PUZ_05 문서 M3).

**색 채우기**는 격자가 없다. 터치 좌표가 필요 없으므로 라우터 없이
화면의 터치 버튼에서 `session.touch()` 만 부르면 된다 (PUZ_00 §8.5 — 손가락 가림 대응).

### 9.4 연출 붙이기

각 `*_GameEvents.ts` 를 구독한다. 로직 클래스를 직접 참조하지 않는다 (§1.3).
예를 들어 스위치는 §7 연출 타이밍이 이벤트로 그대로 나온다.

```
KEY_PRESSED(0.0초)  ->  AREA_TOGGLED(0.2초)  ->  PRESS_SEQUENCE_FINISHED(0.4초)
```

### 9.5 기존 승패 흐름에 얹기 (선택)

`*_ObjectiveValidator.ts` 로 `IObjectiveValidator`(`Basics_Definitions.ts`)를 구현해
`Basics_ObjectiveManager` 에 등록하면 기존 팡파레·포스트게임 흐름을 재사용할 수 있다.
매치3 개념 위에 얹혀 있으므로 필수는 아니다 — 퍼즐 세션의 `QUEST_CLEAR` / `QUEST_FAILED` 를
직접 구독해도 된다.

### 9.6 브리지 검증 결과

`horizon/core` / `horizon/camera` 런타임 스텁을 만들어 Node 에서 실측했다.
Horizon Component 자체는 검증할 수 없지만, **좌표 계산과 배선 로직은 전부 순수 함수**라 검증 가능하다.

| 대상 | 결과 | 검증 항목 |
|---|---|---|
| 좌표 변환 | **12 PASS** | 격자↔월드 왕복 일치(축정렬 및 **회전된 보드**), ray→격자 정확도, 보드 밖에서도 좌표가 나오는지(§8.4), 평행·역방향 ray 거절 |
| 터치 통합 | **11 PASS** | 화면 터치 ray 만으로 D1~D5 전 난이도 클리어, 두 번째 손가락 무시(§8.1), 밖에서 떼면 취소되는 부분 누름(M2), `update()` 미배선 시 연출이 안 끝나 입력이 막히는 것 |
| 카메라 자동 배치 | **4 PASS** | 보드-카메라 거리, 카메라가 보드 **앞쪽**에 있는지, 시선이 보드 중심을 향하는지, 부호 반전 대조군 |
| 자식 수집 | **7 PASS** | 이름 오름차순 정렬, 25개 row-major, **자리수 미맞춤 시 순서가 깨지는 것**(경고의 근거), 정렬 끄기, 루트 미지정, 개수 불일치 경고, 원본 배열 미변형 |

> 회전된 보드로 검증하는 것이 중요하다. 축정렬 보드만 쓰면 `up` 부호 실수를 놓친다.

---

## 10. 빈 레벨에서 퍼즐만 띄우기 (매치3 제거 셋업)

기존 매치3 씬을 걷어내고 퍼즐만 구동할 때의 절차다. PUZ_08 스위치 기준이며 나머지도 동일하다.

### 10.1 반드시 알아야 할 함정 2가지

**(1) Focused Interaction 을 켜지 않으면 터치 이벤트가 아예 오지 않는다**

`Basics_Input_Screen` 이 구독하는 `PlayerControls.onFocusedInteractionInput*` 는 그 모드 전용이다.
매치3 는 `Basics_CameraController` **생성자**에서 진입했으므로 (`Basics_CameraController.ts:44`),
`BasicsPool` 을 끄면 그 코드가 돌지 않아 화면을 눌러도 무반응이 된다.

→ `Puzzle_HorizonBridge.enterPuzzleInteraction()` 이 대신한다. `Switch_CoreAPI.start()` 가 이미 부른다.

**(2) Local 스크립트는 소유자가 지정되어야 실행된다**

`*_CoreAPI` 는 `LocalCamera` 와 Focused Interaction 을 쓰므로 클라이언트에서 돌아야 한다.
그래서 실행 모드를 `Local` 로 두는데, Horizon 에서 **Local 스크립트는 엔티티에 소유자(플레이어)가
지정되기 전까지 아예 실행되지 않는다.** 소유자가 서버인 채로 두면 `start()` 의 소유자 검사에
걸려 조용히 아무 일도 일어나지 않는다.

→ `Puzzle_LocalOwnership.ts` 가 플레이어 입장 시 소유권을 넘겨 준다.

### 10.2 만들어야 하는 오브젝트

| # | 오브젝트 | 붙일 스크립트 | 실행 모드 |
|---|---|---|---|
| 1 | **SpawnPoint** | (없음) | — |
| 2 | **InputListener** (빈 엔티티) | `Basics_Input_Screen` | Local |
| 3 | **PuzzleBoard** (빈 엔티티) | (없음) | — |
| 4 | **KeyCapRoot** (빈 엔티티) + 자식 큐브 25개 | (없음) | — |
| 5 | **PuzzleController** (빈 엔티티) | `Switch_CoreAPI` | **Local** |
| 6 | **OwnershipSetter** (빈 엔티티) | `Puzzle_LocalOwnership` | **Default(서버)** |

- 3번 `PuzzleBoard` 는 키 판의 중심이자 **평면 정의**다. `right` = +col, `up` = -row, `forward` = 플레이어 쪽.
- 4번은 **루트 하나만 props 에 연결**한다. 25개를 일일이 지정하지 않는다 (§10.4 참조).
- 6번은 `targets` 에 `PuzzleController`(그리고 필요하면 `InputListener`)를 넣는다.
- `ServerSpawner` 는 지금 필요 없다 (프리배치 방식). 다른 퍼즐에서 `LocalSpawner` 를 쓸 때 추가한다.

### 10.3 카메라는 손으로 맞추지 않는다

빈 엔티티를 보드 정면에 놓고 회전까지 맞추는 것은 실수가 나기 쉽다.
`cameraObject` 를 **비워 두면** `boardCentre` 정면에 자동 배치된다.

```
카메라 위치 = boardCentre.position + boardCentre.forward * cameraDistance
카메라 방향 = -boardCentre.forward   (보드를 정면으로 바라본다)
```

`cameraDistance` 기본 0.6m, `cameraFov` 기본 40.
`cameraDistance` 를 0 으로 두면 카메라를 건드리지 않는다 (직접 제어하고 싶을 때).

정 직접 지정하고 싶으면 `cameraObject` 에 엔티티를 넣으면 그 위치/방향을 그대로 쓴다.

### 10.4 배치 요령

- 키 캡 25개의 **위치는 아무 데나 둬도 된다.** `onLevelLoaded()` 가 `boardCentre` 기준으로
  전부 다시 배치한다 (`cellSpacing` 기본 0.07m = §3 의 7cm).
- 크기만 맞춘다. 7cm 간격이므로 큐브 한 변 0.06m 정도가 자연스럽다.
- 색은 `MeshEntity.style.tintColor` 로 칠하므로 **틴트가 먹는 머티리얼**을 쓴다.
**키 캡은 루트 하나로 연결한다**

`keyCapRoot` 에 부모 엔티티 하나만 넣으면, 그 **자식들을 이름 오름차순으로 정렬해** 격자에 대응시킨다.
25개를 props 에 일일이 드래그할 필요가 없다.

```
KeyCapRoot
 ├─ KeyCap_00   -> A1
 ├─ KeyCap_01   -> A2
 ├─ ...
 └─ KeyCap_24   -> E5
```

> **이름의 자리수를 반드시 맞춘다.** 문자열 정렬이므로 `KeyCap_9` 와 `KeyCap_10` 을 섞으면
> `KeyCap_10` 이 `KeyCap_9` 보다 앞에 온다. `KeyCap_09` 처럼 0 을 채운다.
>
> 에디터 계층 순서는 드래그 한 번으로 뒤집히지만 이름은 잘 바뀌지 않으므로 이름을 기준으로 삼는다.
> 계층 순서를 그대로 쓰고 싶으면 `collectChildEntities(root, { sortByName: false })` 로 끈다.

### 10.5 순서

```
1. 빈 레벨에 SpawnPoint 배치
2. InputListener 엔티티 + Basics_Input_Screen 스크립트 (Local)
3. PuzzleBoard 빈 엔티티를 플레이어가 볼 위치에 배치
   - forward 가 플레이어 쪽을 향하도록 회전
4. KeyCapRoot 빈 엔티티 + 그 아래 큐브 25개 (크기 0.06m)
   - 이름을 KeyCap_00 ~ KeyCap_24 로 자리수 맞춰 붙인다
5. PuzzleController 엔티티 + Switch_CoreAPI (Local)
   - boardCentre = PuzzleBoard
   - keyCapRoot = KeyCapRoot (루트 하나만!)
   - cameraObject 는 비워 둔다 (자동 배치)
   - difficulty 1, autoStart 체크
6. OwnershipSetter 엔티티 + Puzzle_LocalOwnership (Default)
   - targets = [PuzzleController, InputListener]
7. 플레이 -> 키 캡이 빨강/녹색으로 칠해지고 탭이 먹으면 성공
```

### 10.6 안 될 때 확인 순서

| 증상 | 원인 |
|---|---|
| 아무 일도 안 일어남 | 실행 모드가 `Default` 이거나 **소유권이 안 넘어감** (§10.1-2). `OwnershipSetter` 확인 |
| 키 캡이 재배치·색칠 안 됨 | `boardCentre` / `keyCapRoot` 미연결 |
| 키 캡 순서가 뒤죽박죽 | 자식 이름 자리수 미맞춤 (`KeyCap_9` vs `KeyCap_09`) |
| "자식이 N개입니다" 경고 | `KeyCapRoot` 아래 큐브가 25개가 아니다 |
| 보드는 보이는데 탭이 안 먹음 | `InputListener` 엔티티가 없거나 소유권 미이전 |
| 보드가 화면 밖 / 뒤통수가 보임 | `PuzzleBoard` 의 forward 가 플레이어 반대쪽. 180도 돌린다 |
| 탭 위치가 어긋남 | `cellSpacing` 이 실제 배치와 다름 |
| 색이 안 칠해짐 | 틴트가 먹지 않는 머티리얼 (§10.4) |

### 10.7 에디터 조작 요약

| 하고 싶은 것 | 방법 |
|---|---|
| 빈 오브젝트 만들기 | Build 메뉴 > Gizmos > **Empty Object** |
| 스크립트 붙이기 | 오브젝트 선택 > Properties 패널 하단 **Attached Script** 드롭다운에서 선택 |
| 실행 모드 바꾸기 | **Scripts 패널**에서 스크립트 항목의 **⋮ (three-dot) 메뉴** > 실행 모드를 `Local` 로 |
| props 값 넣기 | 스크립트를 붙이면 Properties 패널에 `propsDefinition` 항목이 그대로 나타난다 |
| 소유권 | 코드로만 넘긴다 (`entity.owner.set(player)`) — `Puzzle_LocalOwnership` 이 담당 |

Scripts 패널의 각 항목은 아래처럼 표시되며, **부제의 `Default` / `Local` 이 곧 현재 실행 모드**다.

```
[T] Switch_CoreAPI                    [복제] [⋮] [삭제]
    Compiled · Default          <- 여기가 실행 모드
```

> 실행 모드 전환의 정확한 클릭 경로는 공식 문서에 명시돼 있지 않고 에디터 버전에 따라 다르다.
> 항목의 `⋮` 메뉴를 먼저 확인하고, 없으면 스크립트를 선택했을 때 나오는 설정 패널을 본다.

### 10.8 실행 모드가 제대로 걸렸는지 확인하는 법

UI 를 못 찾겠으면 **콘솔 로그로 판별**한다. `Switch_CoreAPI.start()` 가 두 경로 모두 로그를 남긴다.

| 콘솔에 보이는 것 | 의미 |
|---|---|
| `로컬 클라이언트에서 시작합니다. 소유권 이전 정상.` | ✅ 제대로 걸렸다 |
| `서버 인스턴스입니다. 소유권 이전을 기다립니다.` **만** 뜬다 | ❌ 실행 모드가 `Default` 이거나 소유권이 안 넘어갔다 |
| `[PuzzleLocalOwnership] N개 엔티티의 소유권을 넘겼습니다.` 가 없다 | ❌ `OwnershipSetter` 가 없거나 `targets` 가 비었다 |
| 아무 로그도 없다 | ❌ 스크립트가 아예 안 붙었거나 컴파일 실패 |

서버 인스턴스 로그는 정상 셋업에서도 한 번 뜬다. **그 뒤에 "로컬 클라이언트에서 시작" 이 이어서
뜨는지**가 판단 기준이다.

---

## 11. 세션 작업 이력 (2026-09-01)

이 세션에서 한 일과 **그 과정에서 드러난 함정**을 순서대로 남긴다.
같은 작업을 반복할 때 여기부터 읽으면 시행착오를 건너뛸 수 있다.

### 11.1 PUZ_08 스위치 퍼즐 구현

마지막 남은 퍼즐을 `Switch_*` 9개 파일로 추가했다 (§3.8, §7.8).
GF(2) 가우스 소거 솔버와 역셔플 생성기가 핵심이며, 테스트 128건을 붙였다.

### 11.2 전 퍼즐 모바일 플레이 검증 (§8)

8개 퍼즐 전부를 사양 문서와 대조하고, **모바일 입력 API 만으로** 전 난이도를
클리어하는 시뮬레이션과 적대적 입력 테스트를 돌렸다.
→ 실제 버그 **6건** 수정, 품질 개선 **12건**. 상세는 §8.

### 11.3 Horizon 통합 (§9, §10)

순수 로직을 실제 월드에서 돌리기 위해 표현 계층을 만들었다.

| 만든 것 | 이유 |
|---|---|
| `Puzzle_HorizonBridge.ts` | 8개 퍼즐이 공유하는 어댑터. 퍼즐마다 다시 만들지 않는다 |
| `Switch_CoreAPI.ts` | 레퍼런스 구현. 나머지 7종은 이걸 복제한다 |
| `Puzzle_LocalOwnership.ts` | Local 스크립트 실행의 전제인 소유권 이전 |

### 11.4 이 과정에서 드러난 함정 5가지

**모두 "조용히 아무 일도 일어나지 않는" 형태로 실패하므로 원인 파악이 어렵다.**

| # | 함정 | 증상 | 대응 |
|---|---|---|---|
| 1 | Horizon 에디터 컴파일 제약 | 로컬 `tsc` 는 통과하는데 에디터에서 4개 파일 컴파일 실패 | `Array.from()` 감싸기 / `Int8Array` → `number[]`. 재현 명령은 §6.1.1 |
| 2 | Focused Interaction 미진입 | 화면을 눌러도 터치 이벤트가 **아예 오지 않음** | `enterPuzzleInteraction()` 호출 (§10.1-1) |
| 3 | Local 스크립트 소유권 미이전 | `start()` 가 조용히 리턴, 아무 일도 안 일어남 | `Puzzle_LocalOwnership` (§10.1-2) |
| 4 | `update()` 미배선 | 제한 시간이 안 흐르고 연출이 안 끝나 입력이 영구히 막힘 | `connectPuzzleUpdate()` (§9) |
| 5 | 격자 오브젝트 이름 자리수 | `KeyCap_9` 가 `KeyCap_10` 뒤로 가 배치가 뒤죽박죽 | 자리수를 맞춘다 (`KeyCap_09`) |

1번은 §6.1.1 의 검사 명령으로, 2~3번은 §10.8 의 콘솔 로그로 판별한다.

### 11.5 사용성 개선 (사용자 피드백 반영)

| 피드백 | 대응 |
|---|---|
| "카메라를 보드 정면에 고정하는 법을 모르겠다" | `cameraObject` 를 비우면 `boardCentre` 정면에 **자동 배치**하도록 변경 (§10.3) |
| "키 캡 25개를 일일이 지정하는 게 비효율적" | `keyCapRoot` 루트 하나만 받아 **자식을 이름순으로 수집**하도록 변경 (§10.4) |
| "실행 모드 설정을 어떻게 하는지 모르겠다" | 에디터 UI 안내(§10.7) + **콘솔 로그로 판별하는 방법**(§10.8) 추가 |

### 11.6 다음 단계

1. **§10 절차로 빈 레벨에 스위치 퍼즐을 띄워 본다.** 실제 기기에서 도는지가 먼저다.
   메인 UI 도 함께 붙여 본다 (§13.3 — Custom UI gizmo + autoStart 끄기).
2. 동작을 확인한 뒤 나머지 7개 `*_CoreAPI.ts` 를 만든다 (§9.3 입력 배선 + §13.2 허브 등록 +
   §12.2 dispose/포커스 수명주기를 함께 복제한다).
3. 데이터 테이블을 실데이터로 교체한다 (§5.2). **러시아워·레이저는 필드 테이블 사전 채움이
   성능상 필수다 (§5.3 / §12.3).**

> 2번을 1번보다 먼저 하지 않는 것을 권한다. 에셋 구성(프리배치 vs `LocalSpawner` 스폰)에 따라
> 연출 코드가 달라지므로, 한 종을 실제로 붙여 본 뒤 나머지를 찍어 내는 편이 헛수고가 적다.

---

## 12. 2차 전체 검증 리뷰 (2026-09-01)

§8 의 1차 리뷰에 이어, 다음 세 관점으로 전 코드를 다시 검증했다.

- **모바일 인터랙션** — 입력/드래그 컨트롤러 7종 + CardMatch 진입점 + 공통 브리지를
  PUZ_00 §8 규격과 전수 대조. 특히 **NaN 좌표**(라우터가 평면 뒤 릴리즈 시 `{NaN, NaN}` 을
  onEnd 로 넘기는 규약)가 각 컨트롤러의 스냅 계산까지 흘러드는 경로를 전부 추적했다.
- **성능** — 폰 단일 JS 스레드(프레임 예산 ~16ms) 기준으로 레벨 생성기·솔버의 동기 실행
  시간, 매 프레임 경로의 할당, 이벤트 구독 누수를 검사했다.
- **실작동** — 소유권 이전·Focused Interaction·구독 수명 등 "조용히 실패하는" 경로를 검사했다.

자동 검증도 재확인했다: 타입체크 0건(정식 + §6.1.1 에디터 제약), 테스트 824 PASS / 0 FAIL.

### 12.1 수정한 버그 (5건)

| # | 위치 | 증상 | 수정 |
|---|---|---|---|
| 1 | `Puzzle_HorizonBridge.toCellIndex()` | NaN 이 모든 부등호 비교를 통과해 **NaN 셀 번호**가 로직 계층으로 유입. 스위치에서는 아무 키도 안 바뀌면서 0.4초 잠금만 걸리는 "유령 눌림" 이 됨 | 반올림 전 `isNaN` 가드 (에디터 lib 에 없는 `Number.isFinite` 대신 전역 `isNaN` 사용) |
| 2 | `RushHour_Board.slide()/snapToCell()` | NaN steps/target 이 경계 검사를 전부 통과해 `piece.row += NaN` → **오브젝트 좌표 영구 오염** (선택·클리어 판정 불능) | 두 함수 모두 NaN 거부 |
| 3 | `RushHour_DragController.update()` | NaN 좌표가 경계 클램프(`Math.min/max`)를 통과해 `_currentValue` 오염 | NaN 입력 무시 (직전 시각 상태 반환) |
| 4 | `ColorSort_DragController.end()` | NaN 드랍이 마지막 hover 케이스로 폴백해 **의도치 않은 이동이 확정**될 수 있음 | NaN 은 명시적 "영역 밖 드랍"(리스폰)으로 처리. undefined(인자 생략)의 hover 폴백은 유지 |
| 5 | `PuzzleTouchRouter` | `Basics_Input_Screen` 이 `interactionInfo[0]` 만 중계하므로 두 손가락을 같은 프레임에 떼면 추적 중 터치의 end 가 유실 → **라우터 영구 잠김**(소프트락) | 같은 interactionIndex 의 새 touchStart 가 오면 이전 조작을 취소(NaN 드랍)로 마감하고 회복 |

### 12.2 실작동 수정 (Switch_CoreAPI — 나머지 7종 템플릿에 그대로 적용할 것)

| 문제 | 수정 |
|---|---|
| **퀘스트 종료 후 Focused Interaction 영구 갇힘.** `enterPuzzleInteraction` 은 탈출 버튼을 숨기는데(disableFocusExitButton 기본 true) `exitPuzzleInteraction` 호출처가 없어, 클리어/실패 후 고정 카메라에 갇혔다 | 포커스 진입을 `start()` 무조건 실행에서 **퀘스트 시작 시점**으로 옮기고(`enterInteraction()`), `abort()` 가 `releaseInteraction()` 으로 포커스+고정 카메라를 되돌린다. `exitPuzzleInteraction` 에 3인칭 카메라·FOV 복원 추가 |
| **`PuzzleTouchRouter.dispose()` 호출처 없음.** 라우터가 모듈 전역 터치 이벤트에 건 구독은 Horizon 이 자동 정리하지 않으므로, 소유권 이탈 후에도 죽은 세션이 터치를 받고, 재획득 시 라우터가 중첩된다 | `SwitchCoreAPI.dispose()` 오버라이드 추가 — 라우터 dispose + 포커스 해제 + 정적 `instance` 클리어 |

### 12.3 남긴 성능 이슈 (수정하지 않음 — 출시 전 필수 1건 + 권장 2건)

**[필수] 러시아워·레이저 D2~D5 의 런타임 레벨 생성 = 수 초 프레임 정지.**
두 퍼즐 모두 기본 필드 테이블이 D1 한 판뿐이라 D2 이상은 항상 생성기로 떨어진다.
생성은 `startRound()` 안에서 **동기**로 돌며, 라운드 전환(클리어 입력의 콜스택 안)마다
재실행된다. 데스크톱 실측 러시아워 D1 39ms ~ D5 3.7초 / 레이저 D4 374ms → 폰(3~10배)에서
러시아워 D5 는 **10~30초대 정지**까지 가능하다. 대응은 §5.3 (필드 테이블 사전 채움 권장.
경량 생성기 4종 — 정렬·슬라이드·카드·스위치 — 은 폰에서도 프레임 예산 내라 해당 없음).

**[권장] 힌트 API 가 풀 솔버를 동기 실행.** `RushHour_Session.getHintMove()` 등이
maxStates 기본값(러시아워 20만 / 레이저 30만 / 연결 40만)으로 솔버를 돌린다. 아직 호출하는
UI 가 없지만, 힌트 버튼을 붙이기 전에 상태 상한 축소 또는 프레임 분할이 필요하다.

**[권장] 매 프레임 소량 할당.** 각 보드 `update()` 의 결과 리터럴, `EventPublisher.publish`
의 `Array.from`, 터치 이동마다 Vec3 체이닝 ~6개. 개별로는 미미하나 8종 통합 후 GC 스파이크가
보이면 이 지점부터 프로파일한다.

### 12.4 남긴 인터랙션 메모 (어댑터 작성 시 지킬 것)

- **NaN onEnd 안전 패턴** — 모범은 두 가지다. ① onEnd 콜백이 좌표를 아예 쓰지 않는다
  (Switch_CoreAPI 방식, 탭 퍼즐). ② 컨트롤러의 `end()` 가 좌표 인자를 받지 않는다
  (러시아워·레이저·연결 방식, 드래그 퍼즐). 나머지 어댑터도 이 패턴을 복제하면 NaN 규격은
  자동 충족된다.
- **연결(Flow) 어댑터는 셀 경계 보간 필수** (§8.3 재확인) — 빠른 스와이프로 칸을 건너뛰면
  로직이 거절하므로, 어댑터가 중간 칸을 순서대로 `moveTo()` 해야 한다.
- **카드 맞추기는 모바일 입력 계층이 없다** — 어댑터는 반드시 `PuzzleTouchRouter` 를 경유해
  단일 터치를 보장하고, `toCellIndex()` 로 반올림한 정수만 `revealTile()` 에 넘긴다
  (`revealTileAt` 은 정수 전제).
- 연결(Flow)의 begin 히트박스는 정확한 셀 반올림(0.5칸)뿐이다. 러시아워·레이저처럼 0.75칸
  최근접 보정을 원하면 어댑터에서 주변 셀을 함께 검사한다.
- 빈 영역을 먼저 짚은 손가락이 라우터를 선점한다(설계상 단일 터치). 체감 문제가 되면
  onBegin 거절 시 라우터 점유를 풀어 주는 개선을 검토한다.

---

## 13. 메인 UI (퍼즐 허브) — `PuzzleUI_*`

8개 퍼즐을 고르고(난이도 포함), 플레이 중 HUD 를 띄우고, 승패 결과를 보여 주는 메인 UI.
기존 매치3 UI(`UI_MainMenu` 등)는 매치3 CoreAPI 4종에 강결합이라 재사용하지 않고
**신규 `PuzzleUI_` 레이어**로 만들었다. `Basics_*`/`UI_*` 는 여전히 한 줄도 수정하지 않았다.

### 13.1 구조 (§1.3 로직·표현 분리 그대로)

```
PuzzleUI_Definitions.ts   카탈로그(8종 이름·부제)·화면 enum·뷰 타입·시계 라벨   ← 순수
PuzzleUI_Registry.ts      IPuzzleGameHandle + createPuzzleHandle() + 레지스트리  ← 순수
PuzzleUI_Model.ts         화면 상태 머신 (모든 전이 규칙이 여기에만 있다)        ← 순수
PuzzleUI_Tests.ts         54건 검증 하네스                                       ← 순수
PuzzleUI_MainPanel.ts     horizon/ui UIComponent — Binding·Pressable 배선만      ← 표현
```

화면 흐름:

```
MAIN_MENU(퍼즐 8칸 격자) → DIFFICULTY_SELECT → IN_GAME(상단 HUD만) ⇄ PAUSED
        ▲                        │(시작)              │(퀘스트 종료 이벤트)
        └────── quitToMenu ──────┴──── RESULT(재도전/메뉴로) ──┘
```

- 미등록 퍼즐(CoreAPI 미구현)은 메인 메뉴에 어둡게 + "준비 중" 으로 표시되고 눌러도 토스트만 뜬다.
- 인게임에서는 **상단 바(일시정지·퍼즐명·남은 시간·라운드)만** 그려 보드와 손가락을 가리지 않는다 (PUZ_00 §8.5).
- 레벨 생성 실패로 시작 즉시 `QUEST_FAILED` 가 동기 발행되는 경로(§8.2)도 결과 화면으로 수렴한다.
- 버튼은 화면 폭 40%+ / 세로 8%+ 로 잡아 엄지 조작에 넉넉하다.

### 13.2 CoreAPI ↔ 메인 UI 의 접점 — 정규화 핸들

8개 퍼즐의 세션·이벤트 허브가 이미 같은 규약(§2.1)이라, 메인 UI 는 퍼즐별 타입을 모른 채
**구조적 타이핑**으로 전부 받는다. 퍼즐별 어댑터 코드가 없다.

```ts
// 각 *_CoreAPI 의 constructSystems() 에 이 블록만 추가하면 메뉴에 나타난다 (Switch_CoreAPI 참조)
PuzzleHubRegistry.instance.register(createPuzzleHandle(
    EPuzzleId.SWITCH,                                      // ← 퍼즐 id 만 바꾼다
    {
        startQuestByDifficulty: (d) => this.startQuestByDifficulty(d),
        pause: () => this.pause(),
        resume: () => this.resume(),
        abort: () => this.abort(),
        getRemainingTimeSeconds: () => this.session.getRemainingTimeSeconds(),
        getRoundProgress: () => this.session.getRoundProgress(),
    },
    this.events,                                           // TIME_CHANGED 등은 구조적으로 호환
    probePuzzleDifficulties((d) => this.tables.getQuestByDifficulty(d)),
));
```

- `QUEST_CLEAR`/`QUEST_FAILED` 페이로드는 퍼즐마다 다르지만 전부
  `{roundsCleared, roundCount, remainingTimeSeconds}` 를 포함하므로 그 부분만 읽어 승패를 정규화한다.
- 핸들의 `abort()` 는 CoreAPI 의 `abort()` 로 배선한다 — 세션 정리에 더해
  **Focused Interaction 해제(§12.2)** 까지 한 경로로 묶인다.

### 13.3 월드에 붙이는 법

1. **Custom UI gizmo** 를 만들어 `PuzzleUI_MainPanel` 을 붙이고 Display Mode 를 **Screen Overlay** 로 둔다.
2. 실행 모드 **Local** + `Puzzle_LocalOwnership` 의 `targets` 에 추가 (§10.1-2 와 동일한 이유).
3. 각 퍼즐 `*_CoreAPI` 의 **`autoStart` 를 끈다** — 시작은 메뉴가 한다.
   (autoStart 를 켠 단독 구동 모드도 그대로 동작한다. 그때 메뉴는 쓰지 않는다.)
4. CoreAPI 가 §13.2 블록으로 핸들을 등록하면 해당 퍼즐이 메뉴에서 "준비 중" 이 풀린다.
   등록 순서는 무관하다 (패널이 늦게 떠도 초기 카탈로그를 다시 읽고, CoreAPI 가 늦으면
   `HANDLE_REGISTERED` 이벤트로 갱신된다).

### 13.4 포커스·카메라 수명주기 (§12.2 와 한 세트)

```
메뉴/난이도/결과 화면   → 포커스 밖 (아바타 카메라, 화면은 오버레이가 덮음)
퀘스트 시작             → CoreAPI.enterInteraction() — 고정 카메라 + Focused Interaction
그만두기/메뉴로         → model.quitToMenu() → handle.abort() → CoreAPI.releaseInteraction()
```

결과 화면에서 "다시 도전" 은 포커스를 유지한 채 같은 난이도로 재시작한다 (재진입 없음).

### 13.5 검증 (54 PASS)

- 시계 라벨·카탈로그 무결성·난이도 탐침 / 핸들 팩토리의 승패 매핑·구독 해제 / 레지스트리 등록·교체
- 모델 전 화면 전이 + 잘못된 화면에서의 액션 거절(가드) + 미등록 퍼즐 잠금
- 시작 실패 2경로: 이벤트 없는 거절(난이도 화면 유지 + START_FAILED) / 동기 QUEST_FAILED(결과 화면 수렴)
- **실제 SwitchSession 통합**: GF(2) 솔버가 시키는 대로 눌러 실제 클리어 → 승리 결과,
  재도전 → 시간 초과 → 패배 결과, 메뉴 복귀 → 세션 IDLE 확인

