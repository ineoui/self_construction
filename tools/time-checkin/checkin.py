# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
import sys
from pathlib import Path
import tkinter as tk
from tkinter import messagebox, ttk


APP_NAME = "Time Check-in"
DEFAULT_INTERVAL_MINUTES = 60
DEFAULT_SNOOZE_MINUTES = 10
MIN_INTERVAL_MINUTES = 5
MAX_INTERVAL_MINUTES = 480


def now_local() -> dt.datetime:
    return dt.datetime.now().replace(microsecond=0)


def clamp_interval(value: int) -> int:
    return max(MIN_INTERVAL_MINUTES, min(MAX_INTERVAL_MINUTES, int(value)))


def parse_iso(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value)
    except ValueError:
        return None


def one_line(value: str, limit: int = 62) -> str:
    text = " ".join(value.split())
    if not text:
        return "(空)"
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "..."


def indent_block(value: str) -> str:
    text = value.strip()
    if not text:
        return "  (空)"
    return "\n".join(f"  {line}" if line else "  " for line in text.splitlines())


def format_time(value: dt.datetime) -> str:
    return value.strftime("%H:%M")


def format_period(started_at: dt.datetime, ended_at: dt.datetime) -> str:
    if started_at.date() == ended_at.date():
        return f"{format_time(started_at)} - {format_time(ended_at)}"
    return f"{started_at:%Y-%m-%d %H:%M} - {ended_at:%Y-%m-%d %H:%M}"


class CheckInApp:
    def __init__(self, root: tk.Tk, args: argparse.Namespace) -> None:
        self.root = root
        self.app_dir = Path(__file__).resolve().parent
        self.config_path = self.app_dir / "config.json"
        self.log_dir = (
            Path(args.log_dir).expanduser().resolve()
            if args.log_dir
            else self.app_dir / "logs"
        )
        self.config = self._load_config()

        saved_interval = self.config.get("interval_minutes", DEFAULT_INTERVAL_MINUTES)
        initial_interval = args.interval if args.interval else saved_interval
        self.interval_var = tk.IntVar(value=clamp_interval(initial_interval))
        self.status_var = tk.StringVar(value="尚未开始")
        self.countdown_var = tk.StringVar(value="")
        self.log_path_var = tk.StringVar(value=str(self.log_dir))

        self.running = False
        self.next_due: dt.datetime | None = None
        self.period_start = now_local()
        self.due_timer_id: str | None = None
        self.tick_timer_id: str | None = None
        self.prompt_window: tk.Toplevel | None = None

        self._build_main_window()
        self._load_recent_entries()
        self._tick()

        if not args.start_paused:
            self.start_timer()

    def _load_config(self) -> dict:
        if not self.config_path.exists():
            return {}
        try:
            return json.loads(self.config_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}

    def _save_config(self) -> None:
        self.config["interval_minutes"] = clamp_interval(self.interval_var.get())
        self.config["last_checkin_at"] = self.period_start.isoformat()
        self.config["log_dir"] = str(self.log_dir)
        payload = json.dumps(self.config, ensure_ascii=False, indent=2)
        tmp_path = self.config_path.with_suffix(".tmp")
        tmp_path.write_text(payload + "\n", encoding="utf-8")
        tmp_path.replace(self.config_path)

    def _build_main_window(self) -> None:
        self.root.title(APP_NAME)
        self.root.geometry("520x430")
        self.root.minsize(470, 380)
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        try:
            ttk.Style().theme_use("clam")
        except tk.TclError:
            pass

        outer = ttk.Frame(self.root, padding=16)
        outer.pack(fill="both", expand=True)

        title = ttk.Label(outer, text="时间回顾提醒", font=("", 15, "bold"))
        title.pack(anchor="w")

        summary = ttk.Label(
            outer,
            text="到点后弹出回顾窗口，把机会焦虑拉回到可见行动：刚才做了什么，下一段只推进哪一件事。",
            wraplength=470,
        )
        summary.pack(anchor="w", pady=(4, 14))

        status_frame = ttk.Frame(outer)
        status_frame.pack(fill="x")
        ttk.Label(status_frame, textvariable=self.status_var, font=("", 11, "bold")).pack(
            anchor="w"
        )
        ttk.Label(status_frame, textvariable=self.countdown_var).pack(anchor="w", pady=(3, 0))

        controls = ttk.Frame(outer)
        controls.pack(fill="x", pady=(16, 12))
        ttk.Label(controls, text="提醒间隔").pack(side="left")
        spin = tk.Spinbox(
            controls,
            from_=MIN_INTERVAL_MINUTES,
            to=MAX_INTERVAL_MINUTES,
            increment=5,
            width=6,
            textvariable=self.interval_var,
        )
        spin.pack(side="left", padx=(8, 4))
        ttk.Label(controls, text="分钟").pack(side="left")
        ttk.Button(controls, text="应用并重计时", command=self.start_timer).pack(
            side="left", padx=(12, 0)
        )

        buttons = ttk.Frame(outer)
        buttons.pack(fill="x", pady=(0, 14))
        ttk.Button(buttons, text="开始", command=self.start_timer).pack(side="left")
        ttk.Button(buttons, text="暂停", command=self.pause_timer).pack(side="left", padx=(8, 0))
        ttk.Button(buttons, text="立即回顾", command=self.prompt_now).pack(
            side="left", padx=(8, 0)
        )
        ttk.Button(buttons, text="打开日志", command=self.open_logs).pack(side="left", padx=(8, 0))

        ttk.Separator(outer).pack(fill="x", pady=(0, 12))

        ttk.Label(outer, text="最近记录", font=("", 10, "bold")).pack(anchor="w")
        self.recent_box = tk.Listbox(outer, height=7, activestyle="none")
        self.recent_box.pack(fill="both", expand=True, pady=(6, 10))

        log_label = ttk.Label(
            outer,
            textvariable=self.log_path_var,
            foreground="#555555",
            wraplength=470,
        )
        log_label.pack(anchor="w")

    def start_timer(self) -> None:
        interval = clamp_interval(self.interval_var.get())
        self.interval_var.set(interval)
        self.running = True
        self._save_config()
        self._schedule_after(dt.timedelta(minutes=interval))

    def pause_timer(self) -> None:
        self.running = False
        self.next_due = None
        self._cancel_due_timer()
        self._update_status()

    def prompt_now(self) -> None:
        self.running = True
        self._cancel_due_timer()
        self.next_due = None
        self._show_prompt()

    def _schedule_after(self, delay: dt.timedelta) -> None:
        self._cancel_due_timer()
        self.next_due = now_local() + delay
        delay_ms = max(1000, int(delay.total_seconds() * 1000))
        self.due_timer_id = self.root.after(delay_ms, self._reminder_due)
        self._update_status()

    def _cancel_due_timer(self) -> None:
        if self.due_timer_id:
            self.root.after_cancel(self.due_timer_id)
            self.due_timer_id = None

    def _tick(self) -> None:
        self._update_status()
        self.tick_timer_id = self.root.after(1000, self._tick)

    def _update_status(self) -> None:
        if not self.running:
            self.status_var.set("已暂停")
            self.countdown_var.set("暂停期间不会弹出提醒。")
            return

        if not self.next_due:
            self.status_var.set("等待回顾窗口")
            self.countdown_var.set("")
            return

        remaining = self.next_due - now_local()
        seconds = max(0, int(remaining.total_seconds()))
        minutes, seconds = divmod(seconds, 60)
        hours, minutes = divmod(minutes, 60)
        if hours:
            left = f"{hours} 小时 {minutes:02d} 分 {seconds:02d} 秒"
        else:
            left = f"{minutes:02d} 分 {seconds:02d} 秒"
        self.status_var.set(f"下次回顾：{self.next_due:%H:%M}")
        self.countdown_var.set(f"剩余 {left}")

    def _reminder_due(self) -> None:
        if not self.running:
            return
        self.due_timer_id = None
        self.next_due = None
        self._show_prompt()

    def _show_prompt(self) -> None:
        if self.prompt_window and self.prompt_window.winfo_exists():
            self.prompt_window.lift()
            self.prompt_window.focus_force()
            return

        ended_at = now_local()
        self._play_sound()
        self.root.deiconify()
        self.root.lift()

        popup = tk.Toplevel(self.root)
        self.prompt_window = popup
        popup.title("这一段时间过得怎么样？")
        popup.geometry("600x620")
        popup.minsize(540, 560)
        popup.transient(self.root)
        popup.attributes("-topmost", True)
        popup.protocol("WM_DELETE_WINDOW", lambda: self._snooze_prompt(popup))

        frame = ttk.Frame(popup, padding=16)
        frame.pack(fill="both", expand=True)

        ttk.Label(frame, text="先坐直，再把时间拿回来", font=("", 14, "bold")).pack(
            anchor="w"
        )
        ttk.Label(
            frame,
            text="坐直，双脚踩地，肩膀放下，慢慢呼气一次。",
            foreground="#444444",
        ).pack(anchor="w", pady=(4, 0))
        ttk.Label(frame, text=f"回顾范围：{format_period(self.period_start, ended_at)}").pack(
            anchor="w", pady=(4, 12)
        )

        ttk.Label(frame, text="这段时间我主要做了什么？").pack(anchor="w")
        done_text = tk.Text(frame, height=7, wrap="word", undo=True)
        done_text.pack(fill="both", expand=True, pady=(4, 12))

        ttk.Label(frame, text="有没有陷入想方向但不产出？触发点是什么？").pack(anchor="w")
        drift_text = tk.Text(frame, height=5, wrap="word", undo=True)
        drift_text.pack(fill="both", expand=True, pady=(4, 12))

        next_frame = ttk.Frame(frame)
        next_frame.pack(fill="x", pady=(0, 12))
        ttk.Label(next_frame, text="下一段只推进一个可见动作").pack(anchor="w")
        next_entry = ttk.Entry(next_frame)
        next_entry.pack(fill="x", pady=(4, 0))

        status_frame = ttk.Frame(frame)
        status_frame.pack(fill="x", pady=(0, 14))
        ttk.Label(status_frame, text="当前状态").pack(side="left")
        status_var = tk.StringVar(value="维护现金流")
        status_combo = ttk.Combobox(
            status_frame,
            textvariable=status_var,
            state="readonly",
            width=14,
            values=("维护现金流", "推进新方向", "机会焦虑", "陷入循环", "需要休息"),
        )
        status_combo.pack(side="left", padx=(8, 0))

        actions = ttk.Frame(frame)
        actions.pack(fill="x")
        ttk.Button(
            actions,
            text="保存并开始下一段",
            command=lambda: self._save_prompt(
                popup,
                ended_at,
                done_text.get("1.0", "end").strip(),
                drift_text.get("1.0", "end").strip(),
                next_entry.get().strip(),
                status_var.get(),
            ),
        ).pack(side="left")
        ttk.Button(
            actions,
            text=f"顺延 {DEFAULT_SNOOZE_MINUTES} 分钟",
            command=lambda: self._snooze_prompt(popup),
        ).pack(side="left", padx=(8, 0))
        ttk.Button(actions, text="暂停提醒", command=lambda: self._pause_from_prompt(popup)).pack(
            side="left", padx=(8, 0)
        )

        self._center_window(popup)
        popup.grab_set()
        done_text.focus_set()

    def _save_prompt(
        self,
        popup: tk.Toplevel,
        ended_at: dt.datetime,
        done: str,
        drift: str,
        next_action: str,
        status: str,
    ) -> None:
        if not done and not next_action:
            ok = messagebox.askyesno(
                "仍然保存？",
                "这次记录几乎是空的。要继续保存吗？",
                parent=popup,
            )
            if not ok:
                return

        entry = {
            "started_at": self.period_start.isoformat(),
            "ended_at": ended_at.isoformat(),
            "status": status,
            "did": done,
            "drift": drift,
            "next_action": next_action,
        }
        self._append_log(entry)

        self.period_start = now_local()
        self._save_config()
        self._load_recent_entries()
        popup.grab_release()
        popup.destroy()

        if self.running:
            self._schedule_after(dt.timedelta(minutes=clamp_interval(self.interval_var.get())))

    def _snooze_prompt(self, popup: tk.Toplevel) -> None:
        popup.grab_release()
        popup.destroy()
        if self.running:
            self._schedule_after(dt.timedelta(minutes=DEFAULT_SNOOZE_MINUTES))

    def _pause_from_prompt(self, popup: tk.Toplevel) -> None:
        popup.grab_release()
        popup.destroy()
        self.pause_timer()

    def _append_log(self, entry: dict) -> None:
        self.log_dir.mkdir(parents=True, exist_ok=True)
        ended_at = parse_iso(entry["ended_at"]) or now_local()
        started_at = parse_iso(entry["started_at"]) or ended_at
        day_path = self.log_dir / f"{ended_at:%Y-%m-%d}.md"

        if not day_path.exists():
            day_path.write_text(f"# 时间回顾 {ended_at:%Y-%m-%d}\n\n", encoding="utf-8")

        block = (
            f"## {ended_at:%H:%M}\n"
            f"- 覆盖：{format_period(started_at, ended_at)}\n"
            f"- 状态：{entry['status']}\n"
            f"- 做了什么：\n{indent_block(entry['did'])}\n"
            f"- 跑偏/卡住/触发点：\n{indent_block(entry['drift'])}\n"
            f"- 下一段只做一件事：{entry['next_action'] or '(空)'}\n\n"
        )
        with day_path.open("a", encoding="utf-8") as handle:
            handle.write(block)

        jsonl_path = self.log_dir / "entries.jsonl"
        with jsonl_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")

    def _load_recent_entries(self) -> None:
        if not hasattr(self, "recent_box"):
            return

        self.recent_box.delete(0, tk.END)
        jsonl_path = self.log_dir / "entries.jsonl"
        if not jsonl_path.exists():
            self.recent_box.insert(tk.END, "还没有记录。第一次提醒后，这里会出现最近几条。")
            return

        entries: list[dict] = []
        try:
            for line in jsonl_path.read_text(encoding="utf-8").splitlines():
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        except OSError:
            self.recent_box.insert(tk.END, "日志读取失败。")
            return

        for entry in entries[-7:][::-1]:
            ended_at = parse_iso(entry.get("ended_at")) or now_local()
            status = entry.get("status", "")
            did = one_line(entry.get("did", ""))
            next_action = one_line(entry.get("next_action", ""), 34)
            self.recent_box.insert(
                tk.END,
                f"{ended_at:%m-%d %H:%M} [{status}] {did} -> {next_action}",
            )

    def open_logs(self) -> None:
        self.log_dir.mkdir(parents=True, exist_ok=True)
        if os.name == "nt":
            os.startfile(str(self.log_dir))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(self.log_dir)])
        else:
            subprocess.Popen(["xdg-open", str(self.log_dir)])

    def _play_sound(self) -> None:
        try:
            if os.name == "nt":
                import winsound

                winsound.MessageBeep(winsound.MB_ICONEXCLAMATION)
            else:
                self.root.bell()
        except Exception:
            pass

    def _center_window(self, window: tk.Toplevel) -> None:
        window.update_idletasks()
        width = window.winfo_width()
        height = window.winfo_height()
        x = max(0, (window.winfo_screenwidth() - width) // 2)
        y = max(0, (window.winfo_screenheight() - height) // 3)
        window.geometry(f"{width}x{height}+{x}+{y}")

    def _on_close(self) -> None:
        ok = messagebox.askokcancel("退出提醒器", "退出后就不会继续提醒。确定退出吗？")
        if not ok:
            return
        self._cancel_due_timer()
        if self.tick_timer_id:
            self.root.after_cancel(self.tick_timer_id)
            self.tick_timer_id = None
        self.root.destroy()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Local periodic check-in reminder.")
    parser.add_argument(
        "--interval",
        type=int,
        default=None,
        help="Reminder interval in minutes. Default is saved config or 60.",
    )
    parser.add_argument(
        "--log-dir",
        default=None,
        help="Directory for markdown and jsonl logs. Default: ./logs",
    )
    parser.add_argument(
        "--start-paused",
        action="store_true",
        help="Open the window without starting the reminder timer.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root = tk.Tk()
    CheckInApp(root, args)
    root.mainloop()


if __name__ == "__main__":
    main()
