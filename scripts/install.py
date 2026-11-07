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
    for rel in FILES:
        dst = HOME / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(REPO / rel, dst)
        print(f"  {rel}")
    # The mod goes in whole: staged beside mods/, then swapped in with renames, so Herdr reloads
    # it once instead of once per file (and never sees a folder without mod.json).
    dst = HOME / MOD
    dst.parent.mkdir(parents=True, exist_ok=True)
    stage = HOME / f".winxp-staging-{os.getpid()}"
    old = HOME / f".winxp-old-{os.getpid()}"
    try:
        shutil.copytree(REPO / MOD, stage)
        if dst.exists():
            os.replace(dst, old)
        os.replace(stage, dst)
    finally:
        shutil.rmtree(stage, ignore_errors=True)
        shutil.rmtree(old, ignore_errors=True)
    print(f"  {MOD}/")
    if merge_keys():
        print("  keys.json: Ctrl+Esc opens the Start menu")
    print("Installed. Switch to it with Cmd+Shift+L, or: herdr-app do layout.switch '{\"name\":\"winxp\"}'")


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
