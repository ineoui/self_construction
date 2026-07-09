# 和 agent 一起使用

这些 Markdown 不需要每个都每天手填。

它们分成三类：

- 方法文档：`docs/`，给人和 agent 看的原则，不需要每天改
- 模板：`templates/`，需要时复制或由脚本初始化，不需要全部填写
- 个人运行数据：`workspace/` 和 `tools/time-checkin/logs/`，这是每天真正产生的内容

## 推荐工作流

### 1. 日常只做两件事

第一件事：开着提醒器。

```text
tools/time-checkin/start-hourly.bat
```

它会自动把每次回顾写到：

```text
tools/time-checkin/logs/
```

第二件事：想到方向、机会、焦虑点时，不展开搜索，只写进：

```text
workspace/inbox.md
```

格式可以很粗糙：

```text
- 想到：是不是该学 AI agent
- 担心：现在岗位经验和外部机会不匹配
- 晚上再看：有没有 14 天能做出的作品
```

### 2. 开一个 14 天实验时再填模板

只维护一个当前实验：

```text
workspace/current-experiment.md
```

它来自：

```text
templates/14-day-experiment.md
```

这份文件不是日报，只在实验开始、第 7 天、第 14 天更新。

### 3. 需要分析时生成 agent 上下文

运行：

```powershell
cd D:\personal\ineoui\self_construction
python .\tools\agent-review\build_context.py --days 7 --clipboard --open
```

脚本会：

- 自动创建 `workspace/`
- 自动创建 `workspace/inbox.md`
- 自动创建 `workspace/current-experiment.md`
- 收集最近 N 天的提醒器日志
- 收集当前实验、方向评分、inbox、每日复盘
- 生成 `agent-out/agent-context.md`
- 可选复制到剪贴板，方便直接粘贴给 agent

### 4. 给 agent 的提问方式

把生成的 `agent-out/agent-context.md` 发给 agent，然后说：

```text
基于这份上下文，帮我做一次复盘。
请重点分析：
1. 我最近最常见的失控循环是什么
2. 哪些外部方向只是焦虑，哪些值得进入实验
3. 当前工作最低交付应该是什么
4. 明天只推进哪 1-3 个可见动作
5. 我当前的 14 天实验是否需要调整

不要给鸡血，不要空泛鼓励，输出可执行建议。
```

### 5. 推荐频率

```text
每天：提醒器自动记录 + inbox 随手记
每 2-3 天：生成一次 agent-context，让 agent 帮你复盘
每 7 天：检查当前 14 天实验是否继续
每 14 天：决定继续、调整或换方向
```

## 最少手填版本

如果你不想维护很多文件，只做这个：

```text
1. 开提醒器
2. 把乱想写进 workspace/inbox.md
3. 每 2-3 天运行 build_context.py
4. 把 agent-context.md 发给 agent
```

这已经足够形成一个闭环。
