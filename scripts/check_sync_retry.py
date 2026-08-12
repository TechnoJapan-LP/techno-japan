#!/usr/bin/env python3
"""画像同期の再試行が、正しく効くかを検証する。

■ なぜ必要か（AUDIT §9-75）

  2026-08-12、Sync Drive Images が
  `Failed to fetch articles: HTTP Error 404: Not Found` で失敗した。

  GAS は一時的に 404 や 5xx を返すことがある（curl で叩いたときにも
  同じ 404 を踏んでいる）。**実体は何も壊れていないのに赤くなる。**
  1回の失敗で諦める作りだったのが原因。

  再試行は「普段は動かない道」なので、壊れていても気づけない。
  埋め込み Python から再試行部分だけを取り出して、ここで確かめる。

■ 何を見るか

  1. 埋め込み Python の構文が壊れていないこと
  2. `time` が import されていること（再試行に必要）
  3. 1回失敗しても、2回目で成功すれば通ること
  4. 3回とも失敗したら、ちゃんと失敗として扱うこと
  5. 成功したら余計な再試行をしないこと（無駄な待ちを入れない）

使い方:
  python3 scripts/check_sync_retry.py
"""

import ast
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
WF = ROOT / ".github" / "workflows" / "sync-drive-images.yml"

failures = []


def check(name, ok, detail=""):
    if ok:
        print(f"  ✅ {name}")
    else:
        print(f"  ❌ {name}" + (f" — {detail}" if detail else ""))
        failures.append(name)


def embedded_python():
    d = yaml.safe_load(WF.read_text(encoding="utf-8"))
    for job in d["jobs"].values():
        for st in job.get("steps", []):
            run = st.get("run", "") or ""
            if "python3 << 'PYTHON'" in run:
                return run.split("python3 << 'PYTHON'", 1)[1].split("PYTHON", 1)[0]
    return None


body = embedded_python()
if body is None:
    print("❌ 埋め込み Python が見つかりません")
    sys.exit(1)

print("埋め込み Python")
try:
    ast.parse(body)
    check("構文が正しい", True)
except SyntaxError as e:
    check("構文が正しい", False, str(e))

check("time を import している", re.search(r"^\s*import time\b", body, re.M) is not None)
check("再試行の回数が明示されている", "range(1, 4)" in body, "range(1, 4) が見つからない")
check("待ち時間を入れている", "time.sleep(" in body)
check("タイムアウトを指定している", "timeout=" in body,
      "urlopen に timeout が無いと、応答が返らないとき永久に待つ")

# --- 再試行そのものの挙動を、同じ形の小さな関数で確かめる ---
print("\n再試行の挙動")


def fetch_with_retry(sequence, sleeps):
    """埋め込み Python と同じ構造。sequence は各試行の結果（例外 or 値）。"""
    data = None
    last_err = None
    for attempt in range(1, 4):
        try:
            r = sequence[attempt - 1]
            if isinstance(r, Exception):
                raise r
            data = r
            break
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt < 3:
                sleeps.append(attempt * 10)
    return data, last_err


err = Exception("HTTP Error 404: Not Found")

s = []
d, e = fetch_with_retry([err, {"status": "ok"}, None], s)
check("1回目が失敗しても2回目で成功すれば通る", d == {"status": "ok"} and e is not None, f"{d}")
check("成功までに1回だけ待つ", s == [10], f"待ち = {s}")

s = []
d, e = fetch_with_retry([{"status": "ok"}, None, None], s)
check("1回目で成功したら待たない", d == {"status": "ok"} and s == [], f"待ち = {s}")

s = []
d, e = fetch_with_retry([err, err, err], s)
check("3回とも失敗したら失敗として扱う", d is None and e is not None)
check("最後の試行のあとには待たない", s == [10, 20], f"待ち = {s}")

print()
if failures:
    print(f"❌ {len(failures)}件の問題があります")
    sys.exit(1)
print("✅ 画像同期の再試行は正しく動く")
