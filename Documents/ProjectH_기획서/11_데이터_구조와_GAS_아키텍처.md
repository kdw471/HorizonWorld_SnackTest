# 11. 데이터 구조와 GAS 아키텍처

> 상위 문서: `ReadMe.md` / 원안: `../Ideation/GAS_구현_로드맵.md`
> 형제 문서: `04_스킬_시스템_Stack과_Rule.md`, `05_퀘스트_숙달도_시스템.md`

## 1. 소유 구조

원안대로 **PlayerState가 ASC를 소유**한다.

| 역할 | 클래스 | 비고 |
| --- | --- | --- |
| OwnerActor | `APH_PlayerState` | ASC + AttributeSet 3종 소유. 스탯·스킬 정보 보존 |
| AvatarActor | `APH_PlayerCharacter` | 비주얼·물리 상호작용 |
| 몬스터 | `APH_EnemyCharacter` | ASC를 **직접 소유**(PlayerState 없음) |

- 이 분리 덕분에 캐릭터가 파괴·재생성되어도 스킬과 스택이 유지된다. 부활 기능(메타 강화
  「불굴」)의 전제 조건이기도 하다.
- 몬스터는 짧은 수명이므로 별도 Owner를 두지 않는다.

## 2. 클래스 목록

### 2-1. 코어

| 클래스 | 책임 |
| --- | --- |
| `UPH_AbilitySystemComponent` | 태그 스택 컨테이너 보유, 스킬 부여/제거 API |
| `UPH_StatusAttributeSet` | 체력·마나·이동 |
| `UPH_CombatAttributeSet` | 공격·치명타·방어·범위 |
| `UPH_SkillMetaAttributeSet` | 전역 메타 수치 |
| `UPH_GameplayAbility` | 모든 스킬의 베이스. Tier/Rule 조회 헬퍼 제공 |

### 2-2. 시스템

| 클래스 | 책임 |
| --- | --- |
| `UPH_SkillStackSubsystem` | 스택 이벤트 수신, 초당 상한 처리, Tier 승급 판정 |
| `UPH_QuestSubsystem` | 퀘스트 생성·추적·완료 판정 |
| `UPH_CardSelectionSubsystem` | 카드 풀 구성, 가중치 추출, 리롤 |
| `UPH_FusionSubsystem` | 레시피 스캔, 융합 실행, 상속 계산 |
| `APH_SpawnDirector` | 예산 기반 스폰, 웨이브 이벤트 |
| `UPH_WidgetController` | ASC 변화를 HUD로 브로드캐스트 |

### 2-3. 데이터 에셋

| 에셋 | 주요 필드 |
| --- | --- |
| `UPH_SkillDataAsset` | AbilityClass, 원소, 기본 데미지, 쿨타임, RulePool, TierThresholds, 이펙트 참조 |
| `UPH_SkillCardDataAsset` | CardType, 대상 스킬/Attribute, 아이콘, 설명 포맷, 가중치, 등장 조건 태그 |
| `UPH_RuleDataAsset` | RuleTag, 표시명, 설명, 적용 GE, 배타 규칙 |
| `UPH_FusionRecipeDataAsset` | 재료 태그 2종, 결과 AbilityClass, 상속 계수, 연출 Cue |
| `UPH_EnemyDataAsset` | 기본 스탯, 스폰 비용, 해금 시각, AI 파라미터 |
| `UPH_MetaUpgradeDataAsset` | 강화 종류, 단계별 값, 비용 테이블 |

**원칙: 스킬·카드·Rule·몬스터·레시피는 전부 데이터 에셋이다.** 신규 콘텐츠 추가에
코드 수정이 필요하면 설계가 잘못된 것이다.

## 3. GameplayTag 트리

```
Skill.Fire.Fireball
Skill.Fire.Fireball.Mastered
Skill.Ice.IceCone
Skill.Wind.WindCutter
Skill.Fusion.FlameLance

Rule.Fire.Hot            (뜨거움)
Rule.Fire.Burn           (화상)
Rule.Fire.Consume        (잠식)
Rule.Ice.Sharp           (뾰족함)
Rule.Ice.Cold            (차가움)
Rule.Ice.Solid           (단단함)
Rule.Wind.Fast           (빠름)
Rule.Wind.Keen           (날카로움)
Rule.Wind.Condense       (응축)

Stack.Skill.Fireball     (태그 스택 카운터)
Stack.Quest.NoHitTime

Debuff.Burn / Chill / Shock / Sunder / Root

State.Alive.Normal / Casting / Staggered
State.Dead

Event.Skill.Hit / Crit / Kill / DebuffApplied
Event.Quest.Completed
Event.Card.Selected

Cue.Skill.Fireball.Impact
Cue.Quest.Completed
Cue.Fusion.Success
```

명명 규칙: `<범주>.<하위>.<식별자>`. 범주는 위 9종으로 고정하고 임의 추가하지 않는다.

## 4. 태그 스택 컨테이너

`FPH_GameplayTagStackContainer` — `TMap<FGameplayTag, int32>`를 감싼 구조체.

- ASC가 소유하며, 스킬 스택·퀘스트 진행도를 모두 여기에 저장한다.
- 변경 시 델리게이트를 발행해 HUD 게이지를 갱신한다.
- 저장 시 그대로 직렬화한다.

`05` 5-1에서 설명한 대로, 스킬별 Attribute 대신 이 구조를 쓴다.

## 5. 데미지 파이프라인

```
GA (스킬 시전)
  └─ 히트 판정 (Overlap / Trace)
       └─ GE_Damage 적용 (SetByCaller: Damage)
            └─ UPH_DamageExecution
                 ├─ 스킬 레벨 / Rule 배율 조회
                 ├─ 치명타 롤
                 ├─ Armor / Resistance 감산
                 └─ IncomingDamage 메타 어트리뷰트에 기록
                      └─ PostGameplayEffectExecute
                           ├─ Health 반영
                           ├─ Event.Skill.Hit 발행 → 스택 시스템
                           └─ 플로팅 텍스트 / Cue 발행
```

26/03/04 TODO의 "데미지 로직 + GameplayEffect + AbilitySet 연동"이 이 파이프라인이다.

## 6. AbilitySet

`UPH_AbilitySet` — 한 묶음의 GA·GE·AttributeSet을 정의하는 데이터 에셋.

| 세트 | 내용 |
| --- | --- |
| `AS_PlayerCore` | 이동/사망 등 기본 GA, AttributeSet 3종, 초기 스탯 GE |
| `AS_Skill_Fireball` | Fireball GA + 관련 Cue |
| `AS_Enemy_Chaser` | 몬스터 기본 GA + 스케일링 GE |

`GiveAbility` 직접 호출(26/03/03 현재 방식)은 개발용으로만 남기고, 정식 부여는
AbilitySet 단위로 수행한다. 부여 핸들을 보관해 융합 시 `ClearAbility`로 정확히
회수할 수 있어야 한다.

## 7. 멀티플레이 고려

원안은 "네트워크 멀티플레이와 데이터 확장성을 고려"한다고 명시했다. 데모는 싱글
플레이지만, 다음 규칙만 지키면 이후 확장이 가능하다.

- 모든 상태 변경은 **서버 권한**에서 수행한다(스택 증가, 카드 선택 확정 포함).
- 연출(Cue, 플로팅 텍스트)은 클라이언트에서만 재생한다.
- AttributeSet과 태그 스택 컨테이너는 리플리케이트 대상으로 설계한다.
- 단, **데모 단계에서 멀티플레이 테스트에 시간을 쓰지 않는다.** 구조만 지킨다.
