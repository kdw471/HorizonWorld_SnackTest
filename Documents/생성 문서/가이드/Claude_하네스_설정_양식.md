# Claude Code 하네스 설정 양식

> 이 저장소에서 Claude Code 의 동작(권한·훅·환경변수·상태줄 등)을 설정할 때
> **그대로 복사해 빈칸만 채우는 양식**이다. 스키마 설명서가 아니라 기입 서식이다.
>
> 설정을 실제로 바꾸는 절차와 검증은 §5~§7 을 순서대로 따른다.
> 퍼즐 프로젝트의 **테스트 하네스**(`Documents/Tests/*_Tests.ts`)와는 다른 것이다.
> 그쪽은 `가이드/타입체크와_테스트_실행.md` 를 본다.

---

## 1. 어느 파일에 쓸지 먼저 고른다

| 파일 | 범위 | 커밋 | 여기에 쓰는 것 |
|---|---|---|---|
| `~/.claude/settings.json` | 이 PC 의 모든 프로젝트 | 해당 없음 | 개인 취향 (테마·모델·알림) |
| `.claude/settings.json` | 이 저장소, 모두 | **커밋한다** | 팀 공통 훅·권한·플러그인 |
| `.claude/settings.local.json` | 이 저장소, 나만 | **gitignore** | 개인 권한 허용 목록, 실험용 훅 |

읽는 순서는 user → project → local 이고 **뒤가 앞을 덮는다.**

> 현재 이 저장소에는 `.claude/settings.local.json` 하나만 있고 `permissions.allow`
> 항목 1개가 들어 있다. `.claude/settings.json`(팀 공통) 은 아직 없다.

`theme` · `editorMode` · `verbose` · `model` · `permissions.defaultMode` 처럼 단순한
항목은 파일을 직접 고치지 말고 **`/config`** 에서 바꾼다. 아래 양식은 `/config` 가
다루지 않는 것(훅·권한 규칙·환경변수·MCP·상태줄)을 위한 것이다.

---

## 2. 골격 양식

새 설정 파일을 만들 때 이 골격으로 시작한다. **쓰지 않는 절은 통째로 지운다**
(빈 객체를 남겨 두지 않는다). JSON 에는 주석을 쓸 수 없으므로 `<...>` 자리는
값으로 바꾸고 설명은 이 문서에 남긴다.

```json
{
  "permissions": {
    "allow": [],
    "deny": [],
    "ask": []
  },
  "env": {},
  "hooks": {}
}
```

---

## 3. 항목별 기입 양식

### 3.1 권한 (`permissions`)

```json
{
  "permissions": {
    "allow": ["Bash(<명령 접두사> *)", "Read", "Edit(<경로>)"],
    "deny":  ["Bash(<금지할 명령>)"],
    "ask":   ["<확인받고 싶은 도구 호출>"],
    "additionalDirectories": ["<작업 폴더 밖에서 읽고 쓸 경로>"]
  }
}
```

규칙 문법은 세 가지뿐이다.

| 쓰임 | 표기 | 뜻 |
|---|---|---|
| 정확히 일치 | `"Bash(npm run test)"` | 그 명령만 |
| 접두사 와일드카드 | `"Bash(git *)"` | `git`, `git status`, `git commit` … |
| 도구 전체 | `"Read"` | 그 도구의 모든 호출 |

**기입 규칙**
- 배열은 **합친다.** 기존 항목을 지우고 새로 쓰면 이전 허용이 전부 사라진다.
- `deny` 가 `allow` 를 이긴다.
- 실행 형태가 매번 다른 명령(인자가 붙는 스크립트)은 접두사 와일드카드로 적는다.

### 3.2 환경변수 (`env`)

```json
{
  "env": {
    "<변수명>": "<값(문자열만)>"
  }
}
```

값은 **반드시 문자열**이다. `"true"` 는 되고 `true` 는 스키마 위반이다.
비밀키는 커밋되는 `.claude/settings.json` 에 넣지 않는다 — `settings.local.json` 에 둔다.

### 3.3 커밋·PR 서명 (`attribution`)

```json
{
  "attribution": {
    "commit": "<커밋 트레일러 문구>",
    "pr": "<PR 본문 문구>"
  }
}
```

빈 문자열 `""` 을 주면 그 서명이 **붙지 않는다.**

### 3.4 상태줄 (`statusLine`)

```json
{
  "statusLine": {
    "type": "command",
    "command": "<stdin 으로 세션 JSON 을 받아 한 줄을 출력하는 명령>",
    "refreshInterval": 5
  }
}
```

### 3.5 모델·플러그인·MCP

```json
{
  "model": "<opus | sonnet | haiku | 전체 모델 ID>",
  "enabledPlugins": { "<플러그인명>@<마켓플레이스>": true },
  "enabledMcpjsonServers": ["<승인할 서버명>"],
  "disabledMcpjsonServers": ["<막을 서버명>"]
}
```

---

## 4. 훅 양식 — 이벤트에 반응해 자동으로 뭔가 하기

**"~할 때마다 자동으로"** 는 기억·선호로 되지 않는다. 하네스가 실행하는 **훅**이어야 한다.
("파일을 쓰면 포매터 돌려라", "압축 전에 물어봐라", "bash 명령을 로그로 남겨라")

### 4.1 구조

```json
{
  "hooks": {
    "<이벤트명>": [
      {
        "matcher": "<도구명|다른도구>",
        "hooks": [
          {
            "type": "command",
            "command": "<실행할 셸 명령>",
            "timeout": 30,
            "statusMessage": "<도는 동안 스피너에 띄울 문구>"
          }
        ]
      }
    ]
  }
}
```

### 4.2 이벤트와 matcher

| 이벤트 | matcher | 언제 |
|---|---|---|
| `PreToolUse` | 도구명 | 도구 실행 **전** (막을 수 있다) |
| `PostToolUse` | 도구명 | 도구 성공 **후** |
| `PostToolUseFailure` | 도구명 | 도구 실패 후 |
| `PermissionRequest` | 도구명 | 권한 프롬프트 전 |
| `UserPromptSubmit` | — | 내가 프롬프트를 넣었을 때 |
| `SessionStart` / `SessionEnd` | — | 세션 시작 / 종료 |
| `Stop` | — | 응답이 끝났을 때 |
| `PreCompact` / `PostCompact` | `manual` / `auto` | 문맥 압축 전 / 후 |
| `Notification` | 알림 종류 | 알림이 뜰 때 |

자주 쓰는 도구 matcher: `Bash`, `Write`, `Edit`, `Read`, `Glob`, `Grep`.
여러 개는 `"Write|Edit"` 처럼 `|` 로 잇는다.

### 4.3 훅 종류

| `type` | 채울 것 | 쓰임 |
|---|---|---|
| `command` | `command` | 셸 명령 실행 (기본) |
| `prompt` | `prompt` | 작은 모델에게 판단을 맡김 (도구 이벤트 전용) |
| `agent` | `prompt` | 도구를 쓰는 에이전트에게 검증을 맡김 (도구 이벤트 전용) |
| `http` | `url` | 입력 JSON 을 POST |
| `mcp_tool` | `server`, `tool` | 이미 붙어 있는 MCP 도구 호출 |

### 4.4 Windows 에서 쓸 때 (이 저장소 해당)

```json
{
  "type": "command",
  "command": "<명령>",
  "shell": "powershell"
}
```

`shell` 을 적지 않으면 bash(Git Bash) 로 돈다. Git Bash 가 없는 Windows 에서는
PowerShell 로 떨어진다. **`jq` 를 쓰는 예시는 Git Bash + jq 가 깔려 있어야 한다.**
경로에 공백이 있는 이 저장소(`Horizon Worlds`)에서는 명령 안의 경로를 반드시 따옴표로 감싼다.

### 4.5 입력·출력 양식

훅은 **stdin 으로 JSON** 을 받는다.

```json
{
  "session_id": "...",
  "tool_name": "Write",
  "tool_input":    { "file_path": "...", "content": "..." },
  "tool_response": { "success": true }
}
```

훅이 stdout 으로 JSON 을 내면 하네스 동작을 바꾼다.

| 필드 | 효과 |
|---|---|
| `systemMessage` | 사용자에게 한 줄 띄운다 |
| `continue: false` + `stopReason` | 진행을 멈춘다 |
| `suppressOutput` | stdout 을 기록에 남기지 않는다 |
| `hookSpecificOutput.additionalContext` | 모델 문맥에 글을 밀어 넣는다 |
| `hookSpecificOutput.permissionDecision` | `allow` / `deny` / `ask` (`PreToolUse` 전용) |

---

## 5. 기입 절차 (순서대로)

1. **읽는다.** 대상 파일을 먼저 열어 **기존 내용을 확인한다.** 배열은 합치고,
   같은 이벤트+matcher 에 훅이 이미 있으면 교체할지 나란히 둘지 정한다.
2. **명령을 이 프로젝트 방식으로 쓴다.** 패키지 매니저(`npm`/`npx`), 경로 공백,
   `tsc` 호출 방식을 실제 이 저장소에서 쓰는 형태 그대로 적는다.
3. **파이프 시험**을 먼저 한다 (§6). 여기서 통과한 다음에 `2>/dev/null || true` 로 감싼다.
   막는 훅으로 쓸 거라면 감싸지 않는다.
4. **JSON 을 쓴다.** `.claude/settings.local.json` 을 처음 만들었다면 `.gitignore` 에 넣는다.
5. **문법·스키마를 검사한다** (§6).
6. **정말 도는지 확인한다** (§7).

---

## 6. 검증 양식

**파이프 시험** — 훅이 받을 stdin 을 직접 만들어 명령에 흘려 넣는다.

```bash
# Write|Edit 훅
echo '{"tool_name":"Edit","tool_input":{"file_path":"<이 저장소의 실제 파일>"}}' | <명령>

# Bash 훅
echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | <명령>

# Stop / SessionStart / UserPromptSubmit
echo '{}' | <명령>
```

종료 코드만 보지 말고 **부수 효과**(파일이 정말 정리됐는지, 테스트가 정말 돌았는지)를 확인한다.

**스키마 검사** — 한 줄로 끝낸다.

```bash
jq -e '.hooks.<이벤트>[] | select(.matcher == "<matcher>") | .hooks[] | select(.type == "command") | .command' <설정파일>
```

| 종료 코드 | 뜻 |
|---|---|
| 0 + 명령 출력 | 정상 |
| 4 | matcher 가 맞지 않는다 |
| 5 | JSON 이 깨졌거나 중첩이 틀렸다 |

> **JSON 하나가 깨지면 그 파일의 설정이 전부 조용히 무시된다.** 원래 깨져 있던
> 부분도 같이 고친다.

---

## 7. 반영 확인과 함정

- `PreToolUse` / `PostToolUse` 는 이 자리에서 도구를 한 번 굴려 확인할 수 있다.
  확신이 안 서면 명령 앞에 `echo "$(date) hook fired" >> /tmp/claude-hook-check.txt; ` 를
  잠깐 붙여 두고 도구를 굴린 뒤 그 파일을 본다. **확인이 끝나면 반드시 지운다.**
- `Stop` · `SessionStart` · `UserPromptSubmit` 은 이번 턴 밖에서 돈다. 다음 세션에서 확인한다.
- 파이프 시험과 `jq -e` 는 통과했는데 훅이 안 돌면, **세션이 시작될 때 그 폴더에
  설정 파일이 없었던 것**이다. 설정 감시기는 그때 있던 폴더만 본다.
  `/hooks` 를 한 번 열거나 Claude Code 를 다시 시작하면 다시 읽는다.
- 나중에 훅을 보고·고치고·끄는 곳은 **`/hooks`** 다.
- 훅이 조용히 성공하면 화면에 아무것도 안 뜬다. 오류가 나거나 느릴 때만 보인다.

---

## 8. 제출 전 점검표

- [ ] 대상 파일을 **먼저 읽고** 기존 값과 합쳤다
- [ ] 배열(allow/deny/hooks)을 덮어쓰지 않았다
- [ ] 비밀값이 커밋되는 파일에 들어가지 않았다
- [ ] `env` 의 값이 전부 문자열이다
- [ ] 경로에 공백(`Horizon Worlds`)이 있는 명령을 따옴표로 감쌌다
- [ ] 파이프 시험을 통과했다
- [ ] `jq -e` 가 0 으로 끝났다
- [ ] 훅이 실제로 도는 것을 확인했고 확인용 흔적을 지웠다

---

## 9. 기록 양식

설정을 바꿀 때마다 아래를 이 문서 끝이 아니라 **`구현 사항/` 의 새 파일**에 남긴다
(한 문서에 한 주제 원칙).

```
날짜:
파일:            ~/.claude/settings.json | .claude/settings.json | .claude/settings.local.json
바꾼 항목:       permissions.allow | hooks.PostToolUse | env | …
바꾼 이유:
검증:            파이프 시험 (결과) / jq -e (종료 코드) / 실제 발화 확인 (방법)
되돌리는 법:
```
