#!/bin/bash
# Pre-commit hook: refuse the commit if staged content contains likely secrets.
# Install via: ln -sf ../../scripts/pre-commit-secrets.sh .git/hooks/pre-commit
# Bypass once with: git commit --no-verify (don't make a habit of it)

set -u

# Patterns to flag. Tuned for the home-controller stack.
# Each is a regex; if any matches in any added line, the commit is rejected.
PATTERNS=(
  # Tesla refresh tokens (long base64 with periods)
  'eyJhbGciOi[A-Za-z0-9_\-]{20,}'
  # Bearer tokens
  'Bearer [A-Za-z0-9_\-\.=]{32,}'
  # Generic long secrets in key=value form
  '(client_secret|api_key|access_token|refresh_token|password)[[:space:]]*[:=][[:space:]]*['\''"]?[A-Za-z0-9_\-\.=]{20,}'
  # AWS-style keys (just in case)
  'AKIA[0-9A-Z]{16}'
  # Private key headers
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
)

# Pull the staged diff (lines being added only)
DIFF=$(git diff --cached --unified=0 -- ':!**/*.example' ':!**/*.template' 2>/dev/null | grep '^+' | grep -v '^+++ ')

if [ -z "$DIFF" ]; then
  exit 0
fi

HITS=""
for p in "${PATTERNS[@]}"; do
  MATCH=$(printf '%s\n' "$DIFF" | grep -E -e "$p" || true)
  if [ -n "$MATCH" ]; then
    HITS+="\n  pattern: $p\n  $(printf '%s' "$MATCH" | head -3)\n"
  fi
done

if [ -n "$HITS" ]; then
  printf '\nERROR: staged diff contains likely secret(s):\n%b\n' "$HITS" >&2
  echo "Refusing the commit. Move secrets to .env (gitignored) or use --no-verify if this is a false positive." >&2
  exit 1
fi

exit 0
