# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = ROOT / "workspace"
DAILY_DIR = WORKSPACE / "daily"
OUT_DIR = ROOT / "agent-out"
TEMPLATES = ROOT / "templates"
DOCS = ROOT / "docs"
TIME_LOGS = ROOT / "tools" / "time-checkin" / "logs"


def today() -> dt.date:
    return dt.date.today()


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def write_if_missing(path: Path, content: str) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def copy_if_missing(source: Path, target: Path) -> None:
    if target.exists():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.exists():
        shutil.copyfile(source, target)


def init_workspace() -> None:
    WORKSPACE.mkdir(parents=True, exist_ok=True)
    DAILY_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    write_if_missing(
        WORKSPACE / "inbox.md",
        """# Inbox

把上班时突然想到的方向、机会、焦虑点写在这里。

规则：记录，但不展开。

```text
- 想到：
- 担心：
- 晚上或固定窗口再看：
```
""",
    )
    copy_if_missing(TEMPLATES / "14-day-experiment.md", WORKSPACE / "current-experiment.md")
    copy_if_missing(TEMPLATES / "direction-scorecard.md", WORKSPACE / "direction-scorecard.md")
    copy_if_missing(TEMPLATES / "daily-checkin.md", DAILY_DIR / f"{today():%Y-%m-%d}.md")


def date_from_filename(path: Path) -> dt.date | None:
    match = re.search(r"(\d{4}-\d{2}-\d{2})", path.name)
    if not match:
        return None
    try:
        return dt.date.fromisoformat(match.group(1))
    except ValueError:
        return None


def files_in_days(directory: Path, days: int) -> list[Path]:
    if not directory.exists():
        return []
    start = today() - dt.timedelta(days=max(1, days) - 1)
    paths: list[Path] = []
    for path in sorted(directory.glob("*.md")):
        file_date = date_from_filename(path)
        if file_date and file_date >= start:
            paths.append(path)
    return paths


def section(title: str, body: str) -> str:
    body = body.strip()
    if not body:
        body = "(暂无内容)"
    return f"## {title}\n\n{body}\n"


def file_section(title: str, path: Path) -> str:
    rel = path.relative_to(ROOT)
    body = read_text(path)
    return section(f"{title}: {rel}", body)


def combine_file_sections(title: str, paths: list[Path]) -> str:
    if not paths:
        return section(title, "(暂无内容)")

    parts = [f"## {title}\n"]
    for path in paths:
        rel = path.relative_to(ROOT)
        content = read_text(path)
        parts.append(f"### {rel}\n\n{content or '(空)'}\n")
    return "\n".join(parts).strip() + "\n"


def build_prompt(days: int) -> str:
    generated_at = dt.datetime.now().replace(microsecond=0)

    method = read_text(DOCS / "method.md")
    immediate = read_text(DOCS / "immediate-actions.md")
    inbox = WORKSPACE / "inbox.md"
    experiment = WORKSPACE / "current-experiment.md"
    scorecard = WORKSPACE / "direction-scorecard.md"
    daily_files = files_in_days(DAILY_DIR, days)
    time_log_files = files_in_days(TIME_LOGS, days)

    instructions = """你是我的执行复盘 agent。请基于下面材料做分析。

回答要求：

1. 先判断我最近处在什么循环里，不要泛泛鼓励。
2. 区分“维护现金流”“推进新方向”“机会焦虑”“需要休息”。
3. 找出我反复提到但没有产出的方向。
4. 判断当前 14 天实验是否需要继续、缩小或更换。
5. 给出明天 1-3 个可见动作，每个动作要能在 5-60 分钟内开始。
6. 给出一个上班时的最低交付定义。
7. 如果信息不足，请列出最多 3 个需要我补充的问题。

约束：

- 不要鸡血。
- 不要输出宏大人生规划。
- 不要一次建议超过 3 个方向。
- 优先给能马上执行的下一步。
"""

    parts = [
        "# Agent Analysis Context",
        f"生成时间：{generated_at:%Y-%m-%d %H:%M:%S}",
        f"收集范围：最近 {days} 天",
        "",
        section("给 agent 的任务", instructions),
        file_section("当前 14 天实验", experiment),
        file_section("方向评分表", scorecard),
        file_section("Inbox", inbox),
        combine_file_sections("最近每日复盘", daily_files),
        combine_file_sections("最近提醒器日志", time_log_files),
        section("方法摘要：从机会焦虑回到可见行动", method),
        section("立即复位动作", immediate),
    ]
    return "\n".join(parts).strip() + "\n"


def trim_text(text: str, max_chars: int) -> str:
    if max_chars <= 0 or len(text) <= max_chars:
        return text

    marker = "\n\n<!-- 内容过长，已保留开头说明和最近部分。 -->\n\n"
    keep_head = min(12000, max_chars // 3)
    keep_tail = max_chars - keep_head - len(marker)
    if keep_tail <= 0:
        return text[:max_chars]
    return text[:keep_head].rstrip() + marker + text[-keep_tail:].lstrip()


def copy_to_clipboard(text: str) -> bool:
    try:
        import tkinter as tk

        root = tk.Tk()
        root.withdraw()
        root.clipboard_clear()
        root.clipboard_append(text)
        root.update()
        root.destroy()
        return True
    except Exception:
        return False


def open_path(path: Path) -> None:
    if os.name == "nt":
        os.startfile(str(path))  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build an agent-ready review context.")
    parser.add_argument("--days", type=int, default=7, help="Collect logs from recent N days.")
    parser.add_argument(
        "--max-chars",
        type=int,
        default=60000,
        help="Trim output to this many characters. Use 0 to disable trimming.",
    )
    parser.add_argument("--clipboard", action="store_true", help="Copy output to clipboard.")
    parser.add_argument("--open", action="store_true", help="Open generated markdown file.")
    parser.add_argument("--init-only", action="store_true", help="Only create workspace files.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    init_workspace()

    if args.init_only:
        print(f"Initialized workspace: {WORKSPACE}")
        return

    text = trim_text(build_prompt(max(1, args.days)), args.max_chars)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUT_DIR / "agent-context.md"
    output_path.write_text(text, encoding="utf-8")

    print(f"Wrote: {output_path}")

    if args.clipboard:
        copied = copy_to_clipboard(text)
        print("Copied to clipboard." if copied else "Clipboard copy failed.")

    if args.open:
        open_path(output_path)


if __name__ == "__main__":
    main()
