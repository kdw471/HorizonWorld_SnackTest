# hz_script_migrator

Stages TypeScript files into a Horizon Worlds `scripts` folder one at a time, in
dependency order, confirming after each move that the Horizon Worlds editor
actually picked the file up before touching the next one.

## Why this exists

Dropping a hundred `.ts` files into a world's `scripts` folder at once is
unreliable: the Horizon Worlds editor ingests files with a watcher, and a large
burst can leave some files silently unregistered. There is also no feedback in
the folder itself — a file sitting on disk looks identical whether the editor
saw it or not.

The registry is the `.editor` file at the root of the `scripts` folder. It is a
single-line JSON object mapping each script's basename (without the `.ts`
extension) to an editor-assigned ID:

```json
{"CardMatch_Definitions":"9a168ed10f96db124cef3b89e875bc22","Utility_Events":"..."}
```

The editor rewrites this file whenever it ingests a script, so the appearance of
a file's key is the one trustworthy signal that the migration of that file
succeeded. This tool moves a file, polls `.editor` until the key shows up, and
only then moves the next one. If a key never appears, the run stops rather than
dumping the rest of the queue into the folder unverified.

## Installation

Either run the script directly with Python 3.9 or newer (it has no third-party
dependencies), or use the packaged executable. Both are installed at:

```
C:\Users\<you>\Documents\HorizonTools\hz_script_migrator.exe   standalone Windows executable
C:\Users\<you>\Documents\HorizonTools\hz_script_migrator.py    source
```

The source is also kept alongside the world at
`<world>/scripts/Documents/tools/`, together with the PyInstaller `build/`
directory and spec file.

### The executable must not live under `AppData\LocalLow`

`AppData\LocalLow` carries a **Low Mandatory Level** integrity label, which a
file inherits. A low-integrity process cannot write to the normal `%TEMP%`, and
a `--onefile` PyInstaller executable *must* unpack itself into `%TEMP%` before
it can run. An `.exe` left under `LocalLow` therefore fails immediately with:

```
[PYI-12345:ERROR] Could not create temporary directory!
```

This is why the executable is installed under `Documents\HorizonTools` rather
than next to the world's scripts. Keep it anywhere outside `LocalLow` and point
it at the scripts folder with `-d`. (Running `hz_script_migrator.py` with Python
directly is unaffected — only the packaged `--onefile` executable unpacks to
`%TEMP%`.)

### Rebuilding the executable

```
cd "<world>/scripts/Documents/tools"
python -m PyInstaller --onefile --console --clean --name hz_script_migrator \
    --distpath dist --workpath build --specpath . hz_script_migrator.py
copy dist\hz_script_migrator.exe "%USERPROFILE%\Documents\HorizonTools\"
```

The `--onefile` build bundles the Python runtime, so the `.exe` runs on machines
without Python installed. Remember the copy step — the freshly built `.exe` in
`dist/` is under `LocalLow` and will not run from there. `build/` and
`hz_script_migrator.spec` are regenerable build artifacts.

## Usage

Point it at the world's `scripts` folder — the one containing `.editor`. Setting
`SCRIPTS` once keeps the commands short:

```
set SCRIPTS=C:\Users\<you>\AppData\LocalLow\Meta\Horizon Worlds\<world-id>\scripts

hz_script_migrator.exe -d "%SCRIPTS%"            migrate the next 5 pending files
hz_script_migrator.exe -d "%SCRIPTS%" --plan     show the migration order, move nothing
hz_script_migrator.exe -d "%SCRIPTS%" --dry-run  show what this run would move
hz_script_migrator.exe -d "%SCRIPTS%" --verify   report root .ts files missing from .editor
hz_script_migrator.exe -d "%SCRIPTS%" -n 0       migrate everything pending in one run
```

`-d` defaults to the current directory, so the flag can be dropped when the
working directory is already the scripts folder — but note that the executable
itself must be stored outside `LocalLow`, as explained above.

### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `-d`, `--scripts-dir DIR` | current directory | The world's `scripts` folder, the one holding `.editor`. |
| `-s`, `--source DIR` | `<scripts-dir>/Documents/Backup` | Staging folder holding the `.ts` files to migrate. |
| `-n`, `--batch-size N` | `5` | Files to migrate this run. `0` migrates everything pending. |
| `-t`, `--timeout SEC` | `120` | How long to wait for one file's `.editor` entry before giving up. |
| `-i`, `--interval SEC` | `5` | How often to re-read `.editor` while waiting. |
| `--revert-on-timeout` | off | Move an unregistered file back to the staging folder instead of leaving it in the root. |
| `--role-order ROLES` | see below | Comma-separated role suffixes used to break import cycles. |
| `--plan` | — | Print the migration order and exit. |
| `--dry-run` | — | Print what this run would move, without moving it. |
| `--verify` | — | Report any `.ts` in the scripts root that is missing from `.editor`. |

### Why batches of five

The default batch size is deliberately small. A small batch keeps the editor's
watcher from being overwhelmed, and when something does go wrong it is
immediately clear which file caused it. Larger batches finish sooner but make a
partial failure much harder to attribute. Raise it only when you have reason to.

## Migration order

Horizon Worlds scripts import each other by bare module name — `import type
{ CardFieldTableEntry } from 'CardMatch_DataTables'` — so a file that lands
before its dependencies will not compile in the editor until they arrive. The
tool parses every pending file's `from '...'` specifiers, keeps the ones that
name another pending module, and topologically sorts the result so a module
follows everything it imports.

Real projects contain import cycles: within a single game, `CoreAPI`,
`DataTables`, `FieldData`, `LevelGenerator` and `Session` routinely reference
one another, which makes a strict topological sort impossible. When the sort
gets stuck — no remaining module has all its dependencies already emitted — the
tool breaks the tie by emitting the lowest-ranked *role* first, where the role
is the part of the filename after the first underscore. The default ranking is:

```
Definitions, DataTables, GameEvents, FieldData, Board, Dial, CoreAPI,
LevelGenerator, Solver, InputController, DragController, AutoPlayBot, Session
```

This puts type and constant modules ahead of the behaviour modules that consume
them. Roles not in the list sort last, alphabetically. Override the ranking with
`--role-order` if your project uses different suffixes.

Note that a cycle means *some* file in the group will necessarily arrive before
a module it imports. That is a transient state: once the whole group has
migrated the imports resolve, and the editor recompiles.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | The batch completed, or `--verify` found nothing unregistered. |
| `1` | A file was not registered within the timeout, or `--verify` found unregistered files. |
| `2` | Bad arguments, a missing folder, a missing `.editor`, or a failed move. |
| `130` | Interrupted with Ctrl-C. |

## Troubleshooting

**`TIMEOUT <name>: not registered in .editor after 120s`** — the editor is not
ingesting files. Check that the Horizon Worlds desktop editor is running with
this world open. The file is left in the scripts root so the editor still has a
chance to pick it up; re-run the tool and it will be skipped as already present.
Pass `--revert-on-timeout` if you would rather it be moved back to staging.

**`[PYI-xxxxx:ERROR] Could not create temporary directory!`** — the executable is
stored under `AppData\LocalLow` and cannot unpack itself. Move it outside
`LocalLow` (for example to `Documents\HorizonTools`) and pass the scripts folder
with `-d`. See the installation section above.

**`no .editor file in <dir>`** — the path is not a Horizon Worlds scripts folder,
or the world has never been opened in the editor. Opening it once creates the
file.

**`--verify` reports unregistered files** — those `.ts` files are in the root but
the editor never registered them. Move them back to the staging folder and
re-run the migration so each one is confirmed individually.

**A file registers but the editor shows compile errors** — expected while a
cyclic group is only partly migrated. Finish migrating the remaining files in
that game's group and the errors should clear.

## Behaviour notes

- A file already present in the scripts root is skipped, never overwritten, so
  re-running after an interruption is safe.
- `.editor` is re-read on every poll rather than watched, and a malformed read
  (the editor rewriting the file mid-read) is treated as "not yet registered"
  and retried.
- Only the top level of the staging folder is scanned; subfolders are ignored.
