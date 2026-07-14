# self_construction

一个很小的自我建设工具箱，用来处理这种状态：

- 当前工作没有意义感，但还需要它提供现金流
- 外部方向很多，但大多数需要额外学习
- 上班时反复思考机会，下班后又没有真正产出
- 最后变成“工作没做好，新方向也没推进”的双重消耗

这个仓库的目标不是提供鸡血，而是把状态拆成可执行的小动作。

## 网页版

`web/` 中包含一个可部署到 GitHub Pages 的个人行动工作台，功能包括：

- 60 / 90 / 120 分钟定时回顾和浏览器通知
- 岗位要求、能力差距、阶段和下一步跟踪
- TODO、截止日期、预计时间和 P0-P3 优先级
- 14 天实验管理
- Inbox 机会收纳
- 自动生成给 agent 分析的 Markdown 上下文
- 本地 JSON 数据导入和导出

本地运行：

```powershell
cd D:\personal\ineoui\self_construction\web
npm install
npm run dev
```

网页数据默认保存在当前浏览器的 `localStorage` 中，不会自动上传到远端。换设备前需要在“Agent 分析”页面导出 JSON，再在另一台设备导入。

GitHub Pages 部署说明见 `web/README.md`。

## 快速开始

Windows 用户可以直接双击：

```text
tools/time-checkin/start-hourly.bat
```

它会每 60 分钟弹出一次回顾窗口。也可以双击：

```text
tools/time-checkin/start-two-hours.bat
```

每 120 分钟提醒一次。

每次弹窗只回答三件事：

1. 这段时间实际做了什么
2. 有没有陷入“想方向但不产出”
3. 下一段只推进一个什么可见动作

记录会保存在：

```text
tools/time-checkin/logs/
```

## 推荐执行方式

先跑一个 14 天实验，不要试图一次性决定人生方向。

1. 状态塌掉时，先看 `templates/reset-card.md`
2. 用 `docs/immediate-actions.md` 做从浅到深的复位
3. 用 `templates/direction-scorecard.md` 给外部方向打分
4. 只选一个方向进入 14 天实验
5. 用 `templates/14-day-experiment.md` 定义两周后要拿出的证据
6. 每天用提醒器把时间从“空想机会”拉回“可见产出”

## 和 agent 一起用

不需要每天手填所有 Markdown。

推荐方式是：

1. 用提醒器自动生成时间日志
2. 把临时想法丢进 `workspace/inbox.md`
3. 当前只维护一个 `workspace/current-experiment.md`
4. 需要分析时运行：

```powershell
cd D:\personal\ineoui\self_construction
python .\tools\agent-review\build_context.py --days 7 --clipboard --open
```

脚本会生成：

```text
agent-out/agent-context.md
```

然后把这份内容发给 ChatGPT、Codex 或其他 agent，让它帮你分析最近的循环、机会焦虑、下一步行动和 14 天实验是否要调整。

详细说明见 `docs/agent-workflow.md`。

## 核心原则

当前工作先降级成现金流项目：

```text
今天工作上最不能炸的一件事是什么？
做到什么程度就算对得起工资？
```

外部方向先降级成 14 天实验：

```text
14 天后，我能拿出什么可以给别人看的证据？
```

你现在最需要的不是更宏大的答案，而是稳定地产出一点证据。

## 开机启动

在 PowerShell 中运行：

```powershell
cd D:\personal\ineoui\self_construction\tools\time-checkin
.\install-startup.ps1
```

取消开机启动：

```powershell
cd D:\personal\ineoui\self_construction\tools\time-checkin
.\uninstall-startup.ps1
```

## 仓库结构

```text
docs/
  agent-workflow.md         如何和 agent 一起分析
  cuda-architecture-refresh.md CUDA 和 GPU 架构临时补强
  gpu-driver-roadmap.md     GPU 驱动学习路线
  immediate-actions.md      从浅到深的立即行动
  method.md                 方法说明
templates/
  14-day-experiment.md      14 天实验模板
  daily-checkin.md          每日复盘模板
  direction-scorecard.md    方向评分模板
  reset-card.md             状态复位卡片
tools/
  agent-review/             生成 agent 分析上下文
  time-checkin/             定时回顾提醒器
web/                        GitHub Pages 网页版
```
