#!/bin/bash
# Публикация на GitHub (нужен: gh auth login ИЛИ существующий remote)
set -euo pipefail
USER="vladymyrzaicenko1992-ai"
REPO="${1:-hrl-documents}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  git init
  git branch -M main
fi

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh repo create "$REPO" --public --source=. --remote=origin --push 2>/dev/null || true
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "git@github.com:${USER}/${REPO}.git"
fi

git add -A
git diff --staged --quiet || git commit -m "HR & Legal: три отдельных документа (отчёт, иск, договор)"
git push -u origin main

echo "Сайт: https://${USER}.github.io/${REPO}/"
echo "Админка: https://${USER}.github.io/${REPO}/admin/report.html"
