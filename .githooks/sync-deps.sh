#!/bin/sh
# Shared by post-merge and post-checkout: reinstall only what actually changed
# between $1 and $2. Never fails the git operation itself.
from="$1"
to="$2"
[ -z "$from" ] && exit 0
git rev-parse --verify --quiet "$from" >/dev/null || exit 0

changed() {
  git diff --name-only "$from" "$to" -- "$1" 2>/dev/null | grep -q .
}

if changed package-lock.json; then
  echo "[sync-deps] package-lock.json changed - running npm ci"
  npm ci || echo "[sync-deps] npm ci failed; run 'npm run setup' manually"
fi

if changed backend/requirements.txt; then
  if [ -x backend/.venv/Scripts/python.exe ]; then
    py=backend/.venv/Scripts/python.exe
  elif [ -x backend/.venv/bin/python ]; then
    py=backend/.venv/bin/python
  else
    py=""
  fi
  if [ -n "$py" ]; then
    echo "[sync-deps] backend/requirements.txt changed - reinstalling"
    "$py" -m pip install -q -r backend/requirements.txt || echo "[sync-deps] pip install failed; run 'npm run setup' manually"
  else
    echo "[sync-deps] backend/requirements.txt changed but no .venv - run 'npm run setup'"
  fi
fi
exit 0
