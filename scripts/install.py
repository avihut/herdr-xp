#!/usr/bin/env python3
"""Install Herdr XP into the Herdr app's home (~/.config/herdr-app, or $HERDR_APP_HOME).

  python3 scripts/install.py              copy the layout, themes and mod in; add its key
  python3 scripts/install.py --uninstall  take them out again

It never overwrites a key you already bound, never creates keys.json, and backs
it up before changing it. Note that Herdr treats an edited keys.json as yours:
it stops adding new default shortcuts to it. Standard library only.
"""
import json
import os
import shutil
import sys
import tempfile
import subprocess
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HOME = Path(os.environ.get("HERDR_APP_HOME") or Path.home() / ".config" / "herdr-app")
FILES = ["layouts/winxp.json", "layouts/winxp.svg", "themes/winxp.json", "themes/winxp-dark.json"]
MOD = "mods/winxp"


def merge_keys(remove=False):
    path = HOME / "keys.json"
    ours = json.loads((REPO / "keys.json").read_text())
    if not path.exists():
        # Herdr writes keys.json itself; a file holding only our key could stand in for its defaults.
        if not remove:
            print('  keys.json not found: to open the Start menu with Ctrl+Esc, add "layout:winxp": {"ctrl-escape": "winxp.start"} to it')
        return False
    current = json.loads(path.read_text())
    merged = json.loads(json.dumps(current))
    for section, bindings in ours.items():
        target = merged.setdefault(section, {})
        for key, action in bindings.items():
            if remove:
                if target.get(key) == action:
                    del target[key]
            elif key not in target:
                target[key] = action
            elif target[key] != action:
                print(f"  kept your {section} {key} = {target[key]!r} (Herdr XP wanted {action!r})")
        if not target:
            del merged[section]
    if merged == current:
        return False
    if path.exists():
        shutil.copy2(path, path.with_name(f"keys.json.winxp-backup-{time.strftime('%Y%m%d-%H%M%S')}"))
    fd, tmp = tempfile.mkstemp(dir=HOME, prefix=".keys-", suffix=".json")
    with os.fdopen(fd, "w") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, path)
    return True


def install():
    if not HOME.is_dir():
        sys.exit(f"{HOME} not found: open the Herdr app once first.")
    dst = HOME / MOD
    dst.parent.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix=".winxp-staging-", dir=HOME))
    stage = work / "winxp"
    backup = HOME / "backups" / ("winxp-install-" + str(time.time_ns()))
    old_moved = new_moved = False
    changed = []
    external = [*FILES, "keys.json"]
    try:
        if dst.exists(): shutil.copytree(dst, stage)
        else: stage.mkdir()
        shutil.copytree(REPO / MOD, stage, dirs_exist_ok=True)
        subprocess.run(["herdr-app", "check", str(stage)], check=True, capture_output=True, text=True, timeout=45)
        backup.mkdir(parents=True)
        for rel in external:
            src = HOME / rel
            if src.exists():
                saved = backup / rel
                saved.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, saved)
        if dst.exists():
            os.replace(dst, backup / "winxp")
            old_moved = True
        os.replace(stage, dst)
        new_moved = True
        for rel in FILES:
            target = HOME / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            temp = work / "file"
            shutil.copy2(REPO / rel, temp)
            os.replace(temp, target)
            changed.append(rel)
        changed.append("keys.json")
        merge_keys()
    except Exception:
        failures = []
        for rel in reversed(changed):
            try:
                saved = backup / rel
                if saved.exists(): shutil.copy2(saved, HOME / rel)
                else: (HOME / rel).unlink(missing_ok=True)
            except Exception as exc: failures.append(exc)
        try:
            if new_moved: shutil.rmtree(dst)
            if old_moved: os.replace(backup / "winxp", dst)
        except Exception as exc: failures.append(exc)
        if failures:
            print(f"Rollback incomplete; retain recovery files: {backup} and {work}", file=sys.stderr)
        else:
            shutil.rmtree(work, ignore_errors=True)
        raise
    else:
        shutil.rmtree(work, ignore_errors=True)
    print(f"Installed complete XP folder. Backup: {backup}. Current layout unchanged.")


def uninstall():
    for rel in FILES:
        p = HOME / rel
        if p.exists():
            p.unlink()
            print(f"  removed {rel}")
    if (HOME / MOD).exists():
        shutil.rmtree(HOME / MOD)
        print(f"  removed {MOD}/")
    if merge_keys(remove=True):
        print("  keys.json: removed Herdr XP's key")


if __name__ == "__main__":
    uninstall() if "--uninstall" in sys.argv[1:] else install()
