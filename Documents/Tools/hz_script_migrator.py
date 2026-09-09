"""Stage TypeScript files into a Horizon Worlds scripts folder, one at a time.

Horizon Worlds keeps a registry file named ``.editor`` at the root of a world's
``scripts`` folder.  It is a single-line JSON object mapping each script's
basename (without the ``.ts`` extension) to an editor-assigned ID, and the
Horizon Worlds desktop editor rewrites it whenever it ingests a script.  That
makes ``.editor`` the only reliable signal that a file dropped into the folder
was actually picked up.

This tool moves files from a staging folder into the scripts root in dependency
order, and after each move waits for the file's key to appear in ``.editor``
before touching the next one.  If a file is never registered, the run stops so
the remaining queue is not dumped into the folder unverified.

Run ``hz_script_migrator --help`` for usage.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path

__version__ = "1.0.0"

# Matches the module specifier of any `import ... from '<spec>'` / `export ... from '<spec>'`.
_FROM_RE = re.compile(r"""from\s+['"]([^'"]+)['"]""")

# Horizon Worlds projects conventionally name scripts `<Game>_<Role>.ts`.  Files
# within one game routinely import each other in cycles (CoreAPI <-> Session <->
# DataTables), so a strict topological sort is impossible.  When the sort gets
# stuck, the cycle is broken by emitting the lowest-ranked role first, which puts
# type/constant modules ahead of the behaviour modules that consume them.
DEFAULT_ROLE_ORDER = (
    "Definitions",
    "DataTables",
    "GameEvents",
    "FieldData",
    "Board",
    "Dial",
    "CoreAPI",
    "LevelGenerator",
    "Solver",
    "InputController",
    "DragController",
    "AutoPlayBot",
    "Session",
)


class MigrationError(Exception):
    """Fatal problem that should abort the run with a message, not a traceback."""


# ---------------------------------------------------------------------------
# .editor registry
# ---------------------------------------------------------------------------


def read_registry(editor_path: Path) -> dict[str, str]:
    """Return the ``.editor`` mapping, or an empty dict if it is absent/unreadable.

    The editor rewrites this file in place, so a read can land on a partial
    write.  A malformed read is treated as "nothing registered yet" and the
    caller simply polls again.
    """
    try:
        text = editor_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return {}
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def is_registered(editor_path: Path, name: str) -> bool:
    return name in read_registry(editor_path)


def wait_for_registration(
    editor_path: Path, name: str, timeout: float, interval: float
) -> float | None:
    """Poll ``.editor`` until *name* appears.  Returns elapsed seconds, or None on timeout."""
    start = time.monotonic()
    while True:
        if is_registered(editor_path, name):
            return time.monotonic() - start
        elapsed = time.monotonic() - start
        if elapsed + interval > timeout:
            # One last check right at the deadline before giving up.
            time.sleep(max(0.0, timeout - elapsed))
            if is_registered(editor_path, name):
                return time.monotonic() - start
            return None
        time.sleep(interval)


# ---------------------------------------------------------------------------
# Dependency ordering
# ---------------------------------------------------------------------------


def local_dependencies(names: set[str], source: Path) -> dict[str, set[str]]:
    """Map each module to the sibling modules it imports.

    Horizon Worlds resolves sibling scripts by bare module name (``from
    'CardMatch_DataTables'``), but relative specifiers are accepted too, so only
    the last path segment is compared against the known module names.
    """
    deps: dict[str, set[str]] = {}
    for name in sorted(names):
        try:
            text = (source / f"{name}.ts").read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            raise MigrationError(f"cannot read {name}.ts: {exc}") from exc
        found = set()
        for spec in _FROM_RE.findall(text):
            dep = spec.split("/")[-1]
            if dep in names and dep != name:
                found.add(dep)
        deps[name] = found
    return deps


def role_rank(name: str, role_order: tuple[str, ...]) -> tuple[int, str]:
    """Sort key used both for tie-breaking and for breaking dependency cycles."""
    suffix = name.split("_", 1)[1] if "_" in name else name
    try:
        return (role_order.index(suffix), name)
    except ValueError:
        return (len(role_order), name)


def dependency_order(
    names: set[str], source: Path, role_order: tuple[str, ...] = DEFAULT_ROLE_ORDER
) -> list[str]:
    """Return *names* ordered so a module follows the siblings it imports.

    Cycles are unavoidable in practice, so when no module has all of its
    dependencies already emitted, the lowest-ranked remaining module is forced
    out to make progress.
    """
    deps = local_dependencies(names, source)
    remaining = set(names)
    order: list[str] = []
    while remaining:
        ready = sorted(
            (n for n in remaining if not (deps[n] & remaining)),
            key=lambda n: role_rank(n, role_order),
        )
        if ready:
            order.extend(ready)
            remaining.difference_update(ready)
        else:
            forced = min(remaining, key=lambda n: role_rank(n, role_order))
            order.append(forced)
            remaining.discard(forced)
    return order


# ---------------------------------------------------------------------------
# Planning
# ---------------------------------------------------------------------------


def build_plan(scripts_dir: Path, source: Path, role_order: tuple[str, ...]) -> list[str]:
    """Return the pending modules -- those staged in *source* but not yet in the root."""
    staged = {p.stem for p in source.glob("*.ts")}
    if not staged:
        return []
    already = {p.stem for p in scripts_dir.glob("*.ts")}
    pending = staged - already
    if not pending:
        return []
    # Dependencies already sitting in the scripts root are satisfied, so ordering
    # only has to respect the edges between the files still waiting to move.
    return dependency_order(pending, source, role_order)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


def cmd_plan(args: argparse.Namespace) -> int:
    pending = build_plan(args.scripts_dir, args.source, args.role_order)
    if not pending:
        print("nothing pending: no .ts files in the staging folder await migration")
        return 0
    print(f"{len(pending)} file(s) pending, in migration order:")
    for i, name in enumerate(pending, 1):
        print(f"{i:4d}  {name}.ts")
    return 0


def cmd_verify(args: argparse.Namespace) -> int:
    editor = args.scripts_dir / ".editor"
    registry = read_registry(editor)
    root = sorted(p.stem for p in args.scripts_dir.glob("*.ts"))
    missing = [n for n in root if n not in registry]
    staged = sorted(p.stem for p in args.source.glob("*.ts"))
    print(f"scripts root : {len(root)} .ts file(s)")
    print(f".editor keys : {len(registry)}")
    print(f"staged       : {len(staged)} file(s) awaiting migration")
    if missing:
        print(f"\nUNREGISTERED ({len(missing)}) -- in the root but absent from .editor:")
        for name in missing:
            print(f"  {name}.ts")
        return 1
    print("\nall files in the scripts root are registered in .editor")
    return 0


def cmd_migrate(args: argparse.Namespace) -> int:
    editor = args.scripts_dir / ".editor"
    pending = build_plan(args.scripts_dir, args.source, args.role_order)
    if not pending:
        print("nothing pending: no .ts files in the staging folder await migration")
        return 0

    limit = len(pending) if args.batch_size <= 0 else min(args.batch_size, len(pending))
    batch = pending[:limit]
    print(
        f"migrating {len(batch)} of {len(pending)} pending file(s)"
        f" -- timeout {args.timeout:g}s per file, polling every {args.interval:g}s"
    )
    if args.dry_run:
        for name in batch:
            print(f"DRY-RUN  would move {name}.ts and wait for .editor registration")
        return 0

    moved = 0
    for name in batch:
        src = args.source / f"{name}.ts"
        dst = args.scripts_dir / f"{name}.ts"
        if dst.exists():
            print(f"SKIP     {name} (already in the scripts root)")
            continue
        try:
            shutil.move(os.fspath(src), os.fspath(dst))
        except OSError as exc:
            print(f"FAIL     {name}: move failed: {exc}", file=sys.stderr)
            return 2

        elapsed = wait_for_registration(editor, name, args.timeout, args.interval)
        if elapsed is not None:
            moved += 1
            print(f"OK       {name} (registered in {elapsed:.0f}s)")
            continue

        print(
            f"TIMEOUT  {name}: not registered in .editor after {args.timeout:g}s",
            file=sys.stderr,
        )
        if args.revert_on_timeout:
            try:
                shutil.move(os.fspath(dst), os.fspath(src))
                print(f"         reverted {name}.ts to the staging folder", file=sys.stderr)
            except OSError as exc:
                print(f"         could not revert {name}.ts: {exc}", file=sys.stderr)
        else:
            print(f"         left {name}.ts in the scripts root", file=sys.stderr)
        print(
            "         stopping: is the Horizon Worlds editor running with this world open?",
            file=sys.stderr,
        )
        _summarize(args, moved)
        return 1

    _summarize(args, moved)
    return 0


def _summarize(args: argparse.Namespace, moved: int) -> None:
    root = len(list(args.scripts_dir.glob("*.ts")))
    left = len(list(args.source.glob("*.ts")))
    print(f"done: {moved} migrated this run -- scripts root {root}, staging folder {left}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _positive(kind):
    def parse(raw: str):
        try:
            value = kind(raw)
        except ValueError:
            raise argparse.ArgumentTypeError(f"{raw!r} is not a number") from None
        if value <= 0:
            raise argparse.ArgumentTypeError("must be greater than zero")
        return value

    return parse


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="hz_script_migrator",
        description=(
            "Move staged TypeScript files into a Horizon Worlds scripts folder in "
            "dependency order, confirming each one is registered in .editor before "
            "moving the next."
        ),
        epilog=(
            "The default batch size of 5 keeps the editor's file watcher from being "
            "overwhelmed and makes a failure easy to attribute to one file. Pass "
            "--batch-size 0 to migrate everything pending in one run."
        ),
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument(
        "-d",
        "--scripts-dir",
        type=Path,
        default=Path.cwd(),
        metavar="DIR",
        help="the world's scripts folder, holding .editor (default: current directory)",
    )
    parser.add_argument(
        "-s",
        "--source",
        type=Path,
        default=None,
        metavar="DIR",
        help="staging folder holding the .ts files to migrate "
        "(default: <scripts-dir>/Documents/Backup)",
    )
    parser.add_argument(
        "-n",
        "--batch-size",
        type=int,
        default=5,
        metavar="N",
        help="files to migrate this run; 0 means all pending (default: 5)",
    )
    parser.add_argument(
        "-t",
        "--timeout",
        type=_positive(float),
        default=120.0,
        metavar="SEC",
        help="how long to wait for one file's .editor entry (default: 120)",
    )
    parser.add_argument(
        "-i",
        "--interval",
        type=_positive(float),
        default=5.0,
        metavar="SEC",
        help="how often to re-read .editor while waiting (default: 5)",
    )
    parser.add_argument(
        "--revert-on-timeout",
        action="store_true",
        help="move an unregistered file back to the staging folder instead of leaving it",
    )
    parser.add_argument(
        "--role-order",
        metavar="ROLES",
        default=",".join(DEFAULT_ROLE_ORDER),
        help="comma-separated <Game>_<Role> suffixes, lowest first, used to break "
        "import cycles (default: %(default)s)",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--plan",
        action="store_true",
        help="print the migration order and exit without moving anything",
    )
    mode.add_argument(
        "--verify",
        action="store_true",
        help="report any .ts file in the scripts root that is missing from .editor",
    )
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="print what this run would move, without moving it",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    args.scripts_dir = args.scripts_dir.expanduser().resolve()
    if args.source is None:
        args.source = args.scripts_dir / "Documents" / "Backup"
    args.source = args.source.expanduser().resolve()
    args.role_order = tuple(r.strip() for r in args.role_order.split(",") if r.strip())

    try:
        if not args.scripts_dir.is_dir():
            raise MigrationError(f"scripts folder not found: {args.scripts_dir}")
        if not (args.scripts_dir / ".editor").exists() and not args.plan:
            raise MigrationError(
                f"no .editor file in {args.scripts_dir} -- is this a Horizon Worlds "
                "scripts folder? Open the world in the editor once to create it."
            )
        if args.verify:
            if not args.source.is_dir():
                args.source = args.scripts_dir  # verify only needs the root
            return cmd_verify(args)
        if not args.source.is_dir():
            raise MigrationError(f"staging folder not found: {args.source}")
        if args.source == args.scripts_dir:
            raise MigrationError("staging folder and scripts folder must differ")
        if args.plan:
            return cmd_plan(args)
        return cmd_migrate(args)
    except MigrationError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\ninterrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
