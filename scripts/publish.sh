#!/bin/bash
# Publish a sanitized snapshot of the current iCloud Home Controller state to
# the public GitHub repo (winsthuang/home-controller).
#
# Flow:
#   1. Assert iCloud master is clean and push it to `private`
#   2. Sync code from iCloud into ~/HomeController-public/ (excluding secrets, node_modules, .git)
#   3. Run scripts/scrub.py over ~/HomeController-public/ using scripts/scrub.json
#   4. Commit + push to public (origin). One commit per publish — no force pushes.
#
# Run from anywhere; the script resolves paths from its own location.

set -eu
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ICLOUD="$( cd "$SCRIPT_DIR/.." && pwd )"
PUBLIC="$HOME/HomeController-public"

if [ ! -d "$PUBLIC/.git" ]; then
  echo "ERROR: $PUBLIC is not a git clone of the public repo." >&2
  exit 1
fi

# --- 1. iCloud master must be clean ---
cd "$ICLOUD"
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: iCloud working tree has uncommitted changes. Commit first." >&2
  git status --short
  exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "master" ]; then
  echo "ERROR: expected branch 'master', got '$CURRENT_BRANCH'." >&2
  exit 1
fi

HEAD_SHA=$(git rev-parse HEAD)
HEAD_SUBJECT=$(git log -1 --pretty=format:%s)

echo "→ pushing master to private..."
git push private master

# --- 2. Sync into public clone ---
cd "$PUBLIC"
git pull --ff-only origin master

echo "→ syncing iCloud working tree to public clone (excluding secrets, node_modules, .git)..."
# --delete keeps the public clone tracking removals
# Exclusions: anything gitignored in the iCloud repo, plus belt-and-suspenders patterns.
rsync -a --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.*.local' \
  --exclude='.tesla-tokens.json' \
  --exclude='tesla-*-key.pem' \
  --exclude='*.pem' \
  --exclude='.mcp.json' \
  --exclude='*-mcp-wrapper.sh' \
  --exclude='scripts/scrub.json' \
  --exclude='logs/' \
  --exclude='data/' \
  --exclude='energy-analysis/data/' \
  --exclude='.claude/settings.local.json' \
  --exclude='tasks/lessons.md' \
  --exclude='tasks/todo.md' \
  --exclude='.DS_Store' \
  "$ICLOUD/" "$PUBLIC/"

# --- 3. Scrub ---
echo "→ scrubbing per $SCRIPT_DIR/scrub.json..."
python3 "$SCRIPT_DIR/scrub.py" "$PUBLIC" "$SCRIPT_DIR/scrub.json"

# --- 4. Commit + push ---
cd "$PUBLIC"
if [ -z "$(git status --porcelain)" ]; then
  echo "✓ public is already up to date — nothing to publish"
  exit 0
fi

git add -A
git commit -m "Publish snapshot from iCloud@${HEAD_SHA:0:7}

Source commit: $HEAD_SUBJECT"
echo "→ pushing to public (origin)..."
git push origin master

echo "✓ published to https://github.com/winsthuang/home-controller"
