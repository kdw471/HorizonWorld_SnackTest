# HzScriptMigratorGui — Horizon Worlds 스크립트 이주 도구 (GUI)

Horizon Worlds 에디터의 Scripts 패널이 망가졌을 때, 원본 월드의 `scripts` 폴더에서
새 월드의 `scripts` 폴더로 TypeScript 파일을 **한 번에 하나씩** 옮기는 Windows 프로그램입니다.
파일 하나를 복사한 뒤 대상 폴더의 `.editor` 파일에 그 스크립트 이름이 등록될 때까지 기다리고,
등록이 확인되면 다음 파일로 넘어갑니다. 모든 파일을 옮기면 작업이 끝납니다.

## 실행 파일 위치

```
C:\Users\<사용자>\Documents\HorizonTools\HzScriptMigratorGui.exe   ← 이 파일을 실행하세요
<월드>\scripts\Documents\Tools\HzScriptMigratorGui\dist\HzScriptMigratorGui.exe   (빌드 산출물 사본)
```

별도 설치가 필요 없습니다. Windows에 기본 포함된 .NET Framework 4.x만 사용하며 파일 하나(약 30 KB)로 동작합니다.

`AppData\LocalLow` 아래에 있는 실행 파일은 Windows가 "낮은 무결성" 프로세스로 실행합니다.
그 상태에서도 `LocalLow` 안의 Horizon 월드 폴더끼리 옮기는 작업은 정상 동작하지만,
`LocalLow` 밖의 폴더(예: 바탕 화면, 문서 폴더의 백업)로는 쓰기가 거부됩니다.
그래서 `Documents\HorizonTools` 사본을 사용하는 것을 권장합니다.

## 실행하기

Windows 탐색기에서 `HzScriptMigratorGui.exe`를 **더블클릭**하세요.
VS Code 탐색기에서 exe를 클릭하면 실행되지 않고 아무 일도 일어나지 않습니다.
터미널에서는 다음과 같이 실행할 수 있습니다.

```
start "" "%USERPROFILE%\Documents\HorizonTools\HzScriptMigratorGui.exe"
```

창이 뜨지 않으면 `%USERPROFILE%\AppData\LocalLow\HzScriptMigrator\app.log`를 확인하세요.
프로그램은 시작·종료·오류를 이 파일에 기록하고, 오류는 메시지 상자로도 표시합니다.

## 사용 방법

1. **원본(From) scripts 폴더**: 이주할 원본 월드의 `scripts` 폴더를 지정합니다.
   예: `C:\Users\<사용자>\AppData\LocalLow\Meta\Horizon Worlds\<원본 월드 ID>\scripts`
2. **대상(To) scripts 폴더**: 새 월드의 `scripts` 폴더를 지정합니다. `.editor` 파일이 있어야 합니다.
   (`.editor`는 Horizon 에디터에서 그 월드를 열고 Scripts 패널을 한 번 표시하면 생성됩니다.)
   월드 ID 폴더를 고르면 자동으로 그 아래 `scripts`로 바꿔 줍니다.
3. **목록 새로고침**을 누르면 옮길 파일 목록과 순서, 대상에 이미 있는 파일이 표시됩니다.
4. Horizon 에디터에서 **대상 월드를 연 상태**로 **▶ 시작**을 누릅니다.
5. 진행 과정은 화면 가운데의 **현재 작업 패널**에 크게 표시됩니다.
   `[4/57] Test_DataTables.ts — ② Horizon 에디터의 .editor 등록 대기 중` 처럼
   몇 번째 파일을 어느 단계(① 복사 → ② .editor 등록 대기 → ③ 다음 파일 준비)에서 처리 중인지,
   대기 경과 시간과 제한 시간, 전체 경과 시간, 완료·건너뜀·실패 집계, 남은 파일 수가 실시간으로 갱신됩니다.
   목록의 각 파일 상태도 `① 복사 중 → ② 등록 대기 중 (n초) → ✔ 완료`로 바뀌고,
   창 제목과 작업 표시줄 아이콘에도 진행률이 표시됩니다.
6. 끝나면 패널이 초록(성공) 또는 빨강(중단)으로 바뀌고 창이 깜빡이며, 로그에
   `=== 모든 작업 종료 ... ===` 요약이 찍힙니다. 중단된 경우 ▶ 시작을 다시 누르면
   이미 옮긴 파일은 건너뛰고 이어서 진행합니다.

원본 폴더의 파일은 기본적으로 **삭제하지 않고 복사**만 합니다.

## 옵션

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| 등록 대기 제한(초) | 120 | 이 시간 안에 `.editor`에 등록되지 않으면 타임아웃 처리 |
| .editor 확인 주기(ms) | 2000 | 대기 중 `.editor`를 다시 읽는 간격 |
| 파일 간 대기(ms) | 1000 | 한 파일 완료 후 다음 파일 복사 전 쉬는 시간 |
| import 의존성 순서로 정렬 | 켬 | `import ... from` 을 분석해 의존하는 파일을 먼저 옮김. 순환 참조는 `Definitions → DataTables → … → Session` 역할 순서로 끊음 |
| 타임아웃 시 작업 중단 | 켬 | 한 파일이라도 등록되지 않으면 멈춤(에디터가 인식을 멈춘 상황을 놓치지 않기 위함). 끄면 다음 파일로 계속 |
| 대상에 같은 이름이 있으면 덮어쓰기 | 끔 | 끔: 내용이 같으면 건너뜀, 다르면 건너뛰고 경고. 켬: 덮어쓰고 `.editor` 변경을 기다림 |
| 복사 후 원본 삭제(이동) | 끔 | 등록이 확인된 파일만 원본 폴더에서 삭제 |

## 상태 표시

| 상태 | 의미 |
| --- | --- |
| 대기 | 아직 처리 전 |
| 복사 중 / 등록 대기 중 (n초) | 복사했고 `.editor`에 이름이 나타나기를 기다리는 중 |
| 완료 | `.editor`에 등록 확인됨 |
| 건너뜀 | 대상에 이미 같은 파일이 있음(비고 참고) |
| 타임아웃 | 제한 시간 안에 등록되지 않음. 에디터가 대상 월드를 열고 있는지 확인 |
| 완료 (변경 감지 안 됨) | 덮어쓰기했지만 `.editor`가 다시 쓰이지 않음. 기존 등록은 유지되므로 계속 진행 |

## 로그와 설정

* 이주 실행마다 로그가 `%USERPROFILE%\AppData\LocalLow\HzScriptMigrator\migrate_<날짜시각>.log`에 남습니다.
  프로그램의 시작·종료·오류는 같은 폴더의 `app.log`에 기록됩니다. **로그 폴더 열기** 버튼으로 바로 열 수 있습니다.
* 마지막으로 사용한 폴더와 옵션은 같은 폴더의 `settings.json`에 저장되어 다음 실행 때 복원됩니다.

## 빌드

```
build.cmd
```

Windows 내장 `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`(C# 5)로 컴파일하므로
Visual Studio나 .NET SDK가 없어도 됩니다. 빌드 후 `dist\`에 exe가 생기고
`%USERPROFILE%\Documents\HorizonTools\`로 자동 복사됩니다.
소스는 C# 5 문법으로 유지해야 합니다(문자열 보간 `$"..."`, `?.`, `nameof` 등 사용 불가).

## 명령줄 도구와의 관계

같은 폴더 위의 `hz_script_migrator.py`(및 PyInstaller exe)는 동일한 `.editor` 확인 방식을
명령줄로 제공하는 이전 버전입니다. 이 GUI 도구는 그 로직을 C#으로 옮기고 한 파일씩 진행 상황을
표시하도록 만든 것이며, Python이나 임시 폴더 압축 해제 없이 동작합니다.
