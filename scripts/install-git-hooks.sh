#!/usr/bin/env bash
#
# このリポジトリのpush前ローカルテストを有効にする。

set -euo pipefail
cd "$(dirname "$0")/.."

git config core.hooksPath .githooks
echo "Git hooksを有効化しました: core.hooksPath=.githooks"
echo "以後、push前に scripts/preflight.sh が自動実行されます。"
