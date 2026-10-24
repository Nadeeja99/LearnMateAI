#!/usr/bin/env python3
"""Fail if backend/requirements.lock doesn't contain every pin from backend/requirements.txt.

Deterministic (no network, no re-resolution), so CI doesn't break when an unrelated
transitive package publishes a new release. Fix a failure with scripts/lock-requirements.sh.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def pins(path: Path) -> dict:
    found = {}
    for line in path.read_text().splitlines():
        match = re.match(r"^\s*([A-Za-z0-9_.\-]+)(?:\[[^\]]*\])?==([^\s;#]+)", line)
        if match:
            found[re.sub(r"[-_.]+", "-", match.group(1)).lower()] = match.group(2)
    return found


direct = pins(ROOT / "backend/requirements.txt")
locked = pins(ROOT / "backend/requirements.lock")
problems = [f"{name}=={version} (lock has {locked.get(name, 'nothing')})" for name, version in direct.items() if locked.get(name) != version]
if problems:
    print("requirements.lock is stale; run scripts/lock-requirements.sh. Mismatched:\n  " + "\n  ".join(problems))
    sys.exit(1)
print(f"requirements.lock OK: all {len(direct)} direct pins present ({len(locked)} packages locked)")
