#!/bin/bash
# open-reader.command — collect markdown files (+ optional AI summary sidecars) and open MD Reader
# Usage: bash open-reader.command <md-path> [more md paths...]
#        Double-click (no args) → open the reader with the existing _md_bundle.js
# Sidecar: <filename>.summary.json next to the markdown file (e.g. report.md.summary.json)
#   schema: {tl_dr, key_points[], conclusions[], action_items[], generated_by, generated_at}
# Output: ./_md_bundle.js (loaded by the reader on start; same path wins if re-collected)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HTML="${SCRIPT_DIR}/md-reader.html"
BUNDLE="${SCRIPT_DIR}/_md_bundle.js"

open_reader() {
  if [[ ! -f "$HTML" ]]; then
    echo "[ERR] md-reader.html not found at $HTML" >&2
    exit 1
  fi
  if command -v open >/dev/null 2>&1; then
    open "$HTML"
  elif command -v xdg-open >/dev/null 2>&1; then
    if ! xdg-open "$HTML" >/dev/null 2>&1; then
      echo "[INFO] Could not auto-open. Open this file in a browser: $HTML"
    fi
  else
    echo "[INFO] Open this file in a browser: $HTML"
  fi
}

if [[ $# -eq 0 ]]; then
  echo "[INFO] No markdown paths given; opening the reader with the existing bundle (if any)"
  echo "       Usage: bash \"$0\" <md-path> [more md paths...]"
  if [[ ! -f "$BUNDLE" ]]; then
    echo "[INFO] No _md_bundle.js yet. Drag a .md file onto the page, or run:"
    echo "       bash \"$0\" notes.md"
  fi
  open_reader
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "[ERR] python3 is required to bundle markdown files (pre-installed on macOS)" >&2
  exit 1
fi

python3 - "${SCRIPT_DIR}" "$@" <<'PYEOF'
import json, sys, time
from pathlib import Path

script_dir = Path(sys.argv[1])
paths = sys.argv[2:]

files, skipped, seen = [], [], set()
for raw in paths:
    p = Path(raw).expanduser()
    try:
        p = p.resolve()
    except OSError:
        pass
    key = str(p)
    if key in seen:
        continue
    seen.add(key)
    if not p.is_file():
        skipped.append(f"{raw}: 文件不存在")
        continue
    if p.suffix.lower() not in (".md", ".markdown", ".txt"):
        skipped.append(f"{p.name}: 非 md/txt 文件")
        continue
    try:
        content = p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        try:
            content = p.read_text(encoding="utf-8", errors="replace")
            skipped.append(f"{p.name}: 非 UTF-8，已按替换模式读入")
        except OSError as e:
            skipped.append(f"{p.name}: {e}")
            continue
    except OSError as e:
        skipped.append(f"{p.name}: {e}")
        continue

    rec = {
        "path": str(p),
        "name": p.name,
        "mtime": time.strftime("%Y-%m-%d %H:%M", time.localtime(p.stat().st_mtime)),
        "size_bytes": p.stat().st_size,
        "content": content,
        "summary": None,
    }
    # AI summary sidecar: <filename>.summary.json (valid JSON with key fields)
    sc = p.with_name(p.name + ".summary.json")
    if sc.is_file():
        try:
            s = json.loads(sc.read_text(encoding="utf-8"))
            if isinstance(s, dict) and (s.get("tl_dr") or s.get("key_points")):
                rec["summary"] = s
            else:
                skipped.append(f"{sc.name}: 摘要缺 tl_dr/key_points，忽略")
        except (OSError, json.JSONDecodeError) as e:
            skipped.append(f"{sc.name}: 摘要 JSON 解析失败（{e}），忽略")
    files.append(rec)

if not files:
    print("[ERR] 没有可读的 md 文件，阅读器未打开", file=sys.stderr)
    sys.exit(1)

bundle = {
    "_bundle": "md",
    "generated_at": time.strftime("%Y-%m-%d %H:%M"),
    "files": files,
}
payload = json.dumps(bundle, ensure_ascii=False)
out = script_dir / "_md_bundle.js"
out.write_text("window.__MD_BUNDLE__ = " + payload + ";\n", encoding="utf-8")

kb = len(payload.encode("utf-8"))
n_sum = sum(1 for f in files if f["summary"])
print(f"[OK] 收集 {len(files)} 个 md（AI 摘要 {n_sum}/{len(files)}）→ {out.name}（{kb/1024:.0f} KB）")
for f in files:
    mark = "✨" if f["summary"] else "—"
    print(f"     {mark} {f['name']}（{f['size_bytes']/1024:.0f} KB · {f['mtime']}）")
if skipped:
    print(f"[WARN] 跳过/降级 {len(skipped)} 项：")
    for s in skipped:
        print(f"     - {s}")
# Body text stays off localStorage (reading state only); bundle is a disk load
if kb > 8 * 1024 * 1024:
    print("[WARN] bundle 已超 8MB，页面渲染可能变慢，建议分批打开")
PYEOF

open_reader
echo "[OK] 阅读器已打开，文档自动装载完成"
