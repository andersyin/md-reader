#!/bin/bash
# 打开阅读器.command — 收集 md 文件（+可选 AI 摘要 sidecar）并打开 MD 阅读器
# 用法：bash 打开阅读器.command <md路径> [更多md路径...]
#       双击（无参数）→ 用现有 _md_bundle.js 直接打开阅读器
# sidecar 约定：与 md 同目录的 <文件名>.summary.json（如 报告.md.summary.json）
#   schema: {tl_dr, key_points[], conclusions[], action_items[], generated_by, generated_at}
# 产物：同目录 _md_bundle.js（阅读器启动时自动装载，同路径以最新收集为准）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ $# -eq 0 ]; then
  echo "[INFO] 未传入 md 路径，使用现有 bundle 直接打开阅读器"
  echo "       用法：bash \"$0\" <md路径> [更多md路径...]"
  open "${SCRIPT_DIR}/md-reader.html"
  exit 0
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
    except Exception:
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
        except Exception as e:
            skipped.append(f"{p.name}: {e}")
            continue
    except Exception as e:
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
    # AI 摘要 sidecar：<文件名>.summary.json（合法 JSON 且含关键字段才并入）
    sc = p.with_name(p.name + ".summary.json")
    if sc.is_file():
        try:
            s = json.loads(sc.read_text(encoding="utf-8"))
            if isinstance(s, dict) and (s.get("tl_dr") or s.get("key_points")):
                rec["summary"] = s
            else:
                skipped.append(f"{sc.name}: 摘要缺 tl_dr/key_points，忽略")
        except Exception as e:
            skipped.append(f"{sc.name}: 摘要 JSON 解析失败（{e}），忽略")
    files.append(rec)

if not files:
    sys.exit("[ERR] 没有可读的 md 文件，阅读器未打开")

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
# 正文不入 localStorage（只存阅读状态），bundle 走磁盘装载；仅超大时提示浏览器内存压力
if kb > 8 * 1024 * 1024:
    print("[WARN] bundle 已超 8MB，页面渲染可能变慢，建议分批打开")
PYEOF

open "${SCRIPT_DIR}/md-reader.html"
echo "[OK] 阅读器已打开，文档自动装载完成"
