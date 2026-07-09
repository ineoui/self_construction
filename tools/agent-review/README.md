# Agent Review

把提醒器日志、当前实验、inbox 和模板整理成一份 agent 可读的上下文。

## 使用

```powershell
cd D:\personal\ineoui\self_construction
python .\tools\agent-review\build_context.py --days 7 --clipboard --open
```

输出文件：

```text
agent-out/agent-context.md
```

`--clipboard` 会尝试把内容复制到剪贴板。`--open` 会打开输出文件。

## 常用参数

```powershell
python .\tools\agent-review\build_context.py --days 3
python .\tools\agent-review\build_context.py --days 14 --max-chars 90000
python .\tools\agent-review\build_context.py --init-only
```
