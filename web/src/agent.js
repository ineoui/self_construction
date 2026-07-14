function text(value, empty = "(暂无)") {
  const result = String(value || "").trim();
  return result || empty;
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function buildAgentContext(data) {
  const openTasks = data.tasks
    .filter((task) => !task.done)
    .sort((a, b) => a.priority.localeCompare(b.priority));
  const recentCheckIns = [...data.checkIns]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20);
  const activeJobs = data.jobs.filter((job) => !["拒绝", "暂停"].includes(job.stage));

  const taskLines = openTasks.length
    ? openTasks.map(
        (task) =>
          `- [${task.priority}] ${task.title} | ${task.category} | 截止 ${task.dueDate || "未设置"} | 预计 ${task.estimate || "?"} 分钟`,
      )
    : ["- 暂无未完成任务"];

  const jobLines = activeJobs.length
    ? activeJobs.map(
        (job) =>
          `### ${job.company} / ${job.role}\n- 阶段：${job.stage}\n- 优先级：${job.priority}\n- 要求：${text(job.requirements)}\n- 我的差距：${text(job.gaps)}\n- 下一步：${text(job.nextAction)}\n- 备注：${text(job.notes)}`,
      )
    : ["暂无活跃岗位。"];

  const checkInLines = recentCheckIns.length
    ? recentCheckIns.map(
        (item) =>
          `### ${formatDateTime(item.createdAt)} / ${item.state}\n- 做了什么：${text(item.did)}\n- 循环或触发点：${text(item.loop)}\n- 下一步：${text(item.nextAction)}`,
      )
    : ["暂无回顾记录。"];

  const inboxLines = data.inbox.length
    ? data.inbox.slice(0, 20).map((item) => `- ${item.text}`)
    : ["- 暂无 inbox 内容"];

  return `# Self Construction Agent Context

生成时间：${new Date().toLocaleString("zh-CN")}

## 请 agent 完成的任务

请基于以下材料进行一次执行复盘：

1. 判断我最近最明显的失控循环，不要泛泛鼓励。
2. 区分哪些行为是在维护现金流、推进新方向、机会焦虑或需要休息。
3. 找出反复出现但没有产出的方向。
4. 判断当前 14 天实验是否应继续、缩小或更换。
5. 给出明天 1-3 个可见动作，每个动作应能在 5-60 分钟内开始。
6. 给出当前工作的一条最低交付定义。
7. 信息不足时，最多问 3 个问题。

约束：不要鸡血，不要宏大人生规划，一次不要建议超过 3 个方向。

## 当前 14 天实验

- 方向：${text(data.experiment.direction)}
- 14 天证据：${text(data.experiment.evidence)}
- 每天最小动作：${text(data.experiment.dailyMinimum)}
- 工作最低交付：${text(data.experiment.workBaseline)}
- 时间：${text(data.experiment.startDate)} 至 ${text(data.experiment.endDate)}

## 当前 TODO

${taskLines.join("\n")}

## 岗位跟踪

${jobLines.join("\n\n")}

## 最近回顾

${checkInLines.join("\n\n")}

## Inbox

${inboxLines.join("\n")}
`;
}
