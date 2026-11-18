#!/usr/bin/env bash

set -u

dry_run=0
if [ "${1:-}" = "--dry-run" ]; then
  dry_run=1
fi

# Keep these roots explicit: every rm target below is found directly under one
# of these directories, and HOME must never be empty.
app_profile_dir="${HOME:?}/Library/Application Support/Google/Chrome-headless"
cache_profile_dir="${HOME:?}/Library/Caches/Google/Chrome-headless"

profile_count=0
headless_running=0
if pgrep -f -- '--headless' >/dev/null 2>&1; then
  headless_running=1
fi

for profile_dir in "$app_profile_dir" "$cache_profile_dir"; do
  [ -d "$profile_dir" ] || continue

  if [ "$headless_running" -eq 1 ]; then
    while IFS= read -r -d '' profile; do
      profile_count=$((profile_count + 1))
      if [ "$dry_run" -eq 0 ]; then
        rm -rf -- "$profile" 2>/dev/null || true
      fi
    done < <(
      find "$profile_dir" -mindepth 1 -maxdepth 1 -name 'scoped_dir*' -mmin +60 -print0 2>/dev/null
    )
  else
    while IFS= read -r -d '' profile; do
      profile_count=$((profile_count + 1))
      if [ "$dry_run" -eq 0 ]; then
        rm -rf -- "$profile" 2>/dev/null || true
      fi
    done < <(
      find "$profile_dir" -mindepth 1 -maxdepth 1 -name 'scoped_dir*' -print0 2>/dev/null
    )
  fi
done

if [ "$dry_run" -eq 1 ]; then
  printf 'headless Chrome の一時プロファイルを %d 件削除（dry-run）\n' "$profile_count"
elif [ "$profile_count" -gt 0 ]; then
  printf 'headless Chrome の一時プロファイルを %d 件削除\n' "$profile_count"
fi

exit 0
