#!/usr/bin/env python3
"""Scrub sensitive identifiers from a directory tree before publishing.

Walks `target_dir` and applies replacements defined in `config.json`.
Skips binary files, .git/, node_modules/, and anything in the `skip` list.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path


SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__"}
TEXT_EXTS = {
    ".js", ".ts", ".mjs", ".cjs", ".json", ".md", ".sh", ".py", ".yaml", ".yml",
    ".toml", ".html", ".css", ".txt", ".env", ".example", ".template", ".sql",
}


def is_text_file(path: Path) -> bool:
    if path.suffix.lower() in TEXT_EXTS:
        return True
    try:
        chunk = path.read_bytes()[:8192]
    except OSError:
        return False
    if not chunk:
        return True
    if b"\x00" in chunk:
        return False
    return True


def main(target: str, config_path: str) -> int:
    target_dir = Path(target).resolve()
    config = json.loads(Path(config_path).read_text())
    literal = config.get("replacements", [])
    regex_rules = [(re.compile(r["pattern"]), r["replace"]) for r in config.get("regex", [])]
    skip_files = set(config.get("skip", []))

    changed = 0
    for root, dirs, files in os.walk(target_dir):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            path = Path(root) / name
            rel = path.relative_to(target_dir).as_posix()
            if rel in skip_files:
                continue
            if not is_text_file(path):
                continue
            try:
                content = path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            original = content
            for rule in literal:
                content = content.replace(rule["find"], rule["replace"])
            for pattern, repl in regex_rules:
                content = pattern.sub(repl, content)
            if content != original:
                path.write_text(content, encoding="utf-8")
                print(f"  scrubbed: {rel}")
                changed += 1
    print(f"{changed} file(s) scrubbed")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("usage: scrub.py <target_dir> <config.json>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))
