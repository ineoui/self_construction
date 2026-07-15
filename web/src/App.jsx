import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  BellRing,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare2,
  Circle,
  ClipboardCopy,
  Clock3,
  Cloud,
  CloudOff,
  Download,
  ExternalLink,
  FileJson,
  Filter,
  Focus,
  Inbox,
  LayoutDashboard,
  Link2,
  LogOut,
  Mail,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  RefreshCw,
  Save,
  Search,
  Target,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { buildAgentContext } from "./agent.js";
import {
  CHECKIN_STATES,
  JOB_STAGES,
  PRIORITIES,
  STORAGE_KEY,
  TASK_CATEGORIES,
  createId,
  defaultData,
  localDateKey,
  normalizeData,
} from "./data.js";
import { useCloudSync } from "./useCloudSync.js";

const NAV_ITEMS = [
  { id: "dashboard", label: "今日总览", icon: LayoutDashboard },
  { id: "jobs", label: "岗位跟踪", icon: BriefcaseBusiness },
  { id: "tasks", label: "TODO", icon: CheckSquare2 },
  { id: "agent", label: "Agent 分析", icon: Bot },
];

const VIEW_TITLES = {
  dashboard: ["今日总览", "把注意力拉回今天能推进的事情"],
  jobs: ["岗位跟踪", "记录要求、差距和下一步，不在脑子里反复比较"],
  tasks: ["TODO 与优先级", "用可见动作代替模糊压力"],
  agent: ["Agent 分析", "把本地数据整理成可复制的结构化上下文"],
};

function readInitialData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeData(JSON.parse(stored)) : defaultData();
  } catch {
    return defaultData();
  }
}

function formatCountdown(nextCheckAt, now) {
  if (!nextCheckAt) return "--:--";
  const remaining = Math.max(0, new Date(nextCheckAt).getTime() - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatShortDate(value) {
  if (!value) return "未设置";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(date);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function downloadFile(name, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function IconButton({ label, children, className = "", ...props }) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}

function Modal({ title, onClose, children, size = "medium" }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <IconButton label="关闭" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

function cloudStatusLabel(cloud) {
  if (!cloud.configured) return "本地模式";
  if (!cloud.user) return cloud.status === "link_sent" ? "检查邮箱" : "未登录";
  const labels = {
    loading: "读取云端",
    pending: "等待同步",
    saving: "正在同步",
    synced: "已同步",
    offline: "离线缓存",
    error: "同步异常",
  };
  return labels[cloud.status] || "云同步";
}

function CloudStatusButton({ cloud, onClick }) {
  const active = Boolean(cloud.user && cloud.status !== "error" && cloud.status !== "offline");
  const Icon = active ? Cloud : CloudOff;
  return (
    <button
      className={`sync-button status-${cloud.status}`}
      onClick={onClick}
      title="云同步设置"
    >
      <Icon size={17} />
      <span>{cloudStatusLabel(cloud)}</span>
    </button>
  );
}

function CloudSyncModal({ cloud, onClose }) {
  const [email, setEmail] = useState(cloud.user?.email || "");
  const [submitting, setSubmitting] = useState(false);

  const sendLink = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    await cloud.sendMagicLink(email.trim());
    setSubmitting(false);
  };

  return (
    <Modal title="手机与 PC 云同步" onClose={onClose}>
      {!cloud.configured ? (
        <div className="cloud-empty">
          <CloudOff size={28} />
          <strong>当前部署还没有连接 Supabase</strong>
          <p>配置 Project URL、Publishable key 和数据库 SQL 后，这里会启用邮箱登录与跨设备同步。</p>
          <a href="https://github.com/ineoui/self_construction/blob/main/docs/supabase-setup.md" target="_blank" rel="noreferrer">
            查看配置说明 <ExternalLink size={14} />
          </a>
        </div>
      ) : null}

      {cloud.configured && !cloud.user ? (
        <form className="modal-form" onSubmit={sendLink}>
          <div className="sync-intro">
            <Mail size={22} />
            <div>
              <strong>用同一个邮箱登录手机和 PC</strong>
              <span>Supabase 会发送登录链接，不需要单独设置密码。</span>
            </div>
          </div>
          <Field label="邮箱">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoFocus
            />
          </Field>
          {cloud.status === "link_sent" ? (
            <div className="inline-notice success">登录链接已发送，请在这台设备上打开邮件中的链接。</div>
          ) : null}
          {cloud.errorMessage ? <div className="inline-notice error">{cloud.errorMessage}</div> : null}
          <div className="modal-actions">
            <button className="button primary" type="submit" disabled={submitting}>
              <Mail size={17} />
              {submitting ? "发送中" : "发送登录链接"}
            </button>
          </div>
        </form>
      ) : null}

      {cloud.user ? (
        <div className="cloud-account">
          <div className="cloud-account-header">
            <span className="cloud-avatar"><Cloud size={21} /></span>
            <span>
              <strong>{cloud.user.email}</strong>
              <small>{cloudStatusLabel(cloud)}</small>
            </span>
          </div>
          <dl className="sync-details">
            <div><dt>同步方式</dt><dd>本地立即保存，联网后约 1 秒上传</dd></div>
            <div><dt>最近同步</dt><dd>{cloud.lastSyncedAt ? formatDateTime(cloud.lastSyncedAt) : "尚未完成"}</dd></div>
            <div><dt>冲突规则</dt><dd>最后一次修改覆盖</dd></div>
          </dl>
          {cloud.errorMessage ? <div className="inline-notice error">{cloud.errorMessage}</div> : null}
          <div className="modal-actions split">
            <button className="button danger-quiet" onClick={cloud.signOut} type="button">
              <LogOut size={17} />退出登录
            </button>
            <button className="button primary" onClick={cloud.syncNow} type="button">
              <RefreshCw size={17} />立即同步
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function Field({ label, hint, className = "", children }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      <Icon size={24} />
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  );
}

function PriorityBadge({ value }) {
  return <span className={`badge priority-${value.toLowerCase()}`}>{value}</span>;
}

function StateBadge({ value }) {
  const key = CHECKIN_STATES.indexOf(value);
  return <span className={`badge state-${Math.max(0, key)}`}>{value}</span>;
}

function Stat({ icon: Icon, label, value, tone = "teal" }) {
  return (
    <div className="stat-item">
      <span className={`stat-icon tone-${tone}`}>
        <Icon size={18} />
      </span>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

function TimerPanel({ data, now, onStart, onPause, onOpen, onInterval, onNotify }) {
  const running = data.settings.timerRunning;
  return (
    <section className="timer-panel tool-surface">
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">定时复位</span>
          <h2>{running ? "下一次回顾" : "提醒器已暂停"}</h2>
        </div>
        <IconButton
          label={data.settings.notifications ? "浏览器通知已开启" : "开启浏览器通知"}
          className={data.settings.notifications ? "active" : ""}
          onClick={onNotify}
        >
          {data.settings.notifications ? <BellRing size={18} /> : <Bell size={18} />}
        </IconButton>
      </div>

      <div className="timer-readout">{formatCountdown(data.settings.nextCheckAt, now)}</div>
      <div className="segmented" aria-label="提醒间隔">
        {[60, 90, 120].map((minutes) => (
          <button
            key={minutes}
            className={data.settings.intervalMinutes === minutes ? "selected" : ""}
            onClick={() => onInterval(minutes)}
          >
            {minutes} 分
          </button>
        ))}
      </div>

      <div className="button-row">
        <button className="button primary" onClick={running ? onPause : onStart}>
          {running ? <Pause size={17} /> : <Play size={17} />}
          {running ? "暂停" : "开始计时"}
        </button>
        <button className="button secondary" onClick={onOpen}>
          <Focus size={17} />
          立即回顾
        </button>
      </div>
    </section>
  );
}

function Dashboard({ data, now, actions }) {
  const today = localDateKey();
  const todayCheckIns = data.checkIns.filter(
    (item) => localDateKey(new Date(item.createdAt)) === today,
  );
  const openTasks = data.tasks.filter((task) => !task.done);
  const urgentTasks = openTasks.filter((task) => ["P0", "P1"].includes(task.priority));
  const activeJobs = data.jobs.filter((job) => !["拒绝", "暂停"].includes(job.stage));
  const focusTasks = [...openTasks]
    .sort((a, b) => a.priority.localeCompare(b.priority))
    .slice(0, 5);
  const nextJobs = activeJobs.filter((job) => job.nextAction).slice(0, 4);
  const recentCheckIns = [...data.checkIns]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4);
  const [inboxText, setInboxText] = useState("");

  const addInbox = (event) => {
    event.preventDefault();
    if (!inboxText.trim()) return;
    actions.addInbox(inboxText.trim());
    setInboxText("");
  };

  return (
    <div className="view-stack">
      <section className="reset-strip">
        <div className="reset-title">
          <Focus size={20} />
          <strong>状态塌下去时，先做这一轮</strong>
        </div>
        <ol className="reset-steps">
          <li><span>1</span>坐直</li>
          <li><span>2</span>双脚踩地</li>
          <li><span>3</span>呼气一次</li>
          <li><span>4</span>只选下一步</li>
        </ol>
        <button className="button primary" onClick={actions.openCheckIn}>
          <Focus size={17} />
          现在回顾
        </button>
      </section>

      <section className="stat-grid" aria-label="今日状态">
        <Stat icon={Activity} label="今日回顾" value={todayCheckIns.length} tone="teal" />
        <Stat icon={CheckSquare2} label="未完成 TODO" value={openTasks.length} tone="blue" />
        <Stat icon={Target} label="P0 / P1" value={urgentTasks.length} tone="amber" />
        <Stat icon={BriefcaseBusiness} label="活跃岗位" value={activeJobs.length} tone="coral" />
      </section>

      <div className="dashboard-grid">
        <TimerPanel
          data={data}
          now={now}
          onStart={actions.startTimer}
          onPause={actions.pauseTimer}
          onOpen={actions.openCheckIn}
          onInterval={actions.setIntervalMinutes}
          onNotify={actions.requestNotifications}
        />

        <section className="tool-surface focus-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">当前实验</span>
              <h2>{data.experiment.direction || "还没有选择方向"}</h2>
            </div>
            <button className="text-button" onClick={() => actions.setView("agent")}>编辑</button>
          </div>
          <dl className="experiment-summary">
            <div>
              <dt>14 天证据</dt>
              <dd>{data.experiment.evidence || "先定义一个别人能打开、阅读或运行的东西"}</dd>
            </div>
            <div>
              <dt>每天最小动作</dt>
              <dd>{data.experiment.dailyMinimum || "30-60 分钟内可完成"}</dd>
            </div>
            <div>
              <dt>工作最低交付</dt>
              <dd>{data.experiment.workBaseline || "今天最不能炸的一件事"}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="dashboard-grid wide-left">
        <section className="tool-surface">
          <div className="section-heading">
            <div>
              <span className="eyebrow">下一步</span>
              <h2>优先任务</h2>
            </div>
            <button className="text-button" onClick={() => actions.setView("tasks")}>查看全部</button>
          </div>
          {focusTasks.length ? (
            <div className="compact-list">
              {focusTasks.map((task) => (
                <button
                  className="compact-row"
                  key={task.id}
                  onClick={() => actions.toggleTask(task.id)}
                >
                  {task.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  <span className="compact-main">
                    <strong>{task.title}</strong>
                    <small>{task.category} · {formatShortDate(task.dueDate)} · {task.estimate || "?"} 分钟</small>
                  </span>
                  <PriorityBadge value={task.priority} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CheckSquare2}
              title="暂时没有任务"
              description="添加一个能在 5-60 分钟内开始的动作。"
              action={<button className="button secondary" onClick={() => actions.openTask()}>添加 TODO</button>}
            />
          )}
        </section>

        <section className="tool-surface">
          <div className="section-heading">
            <div>
              <span className="eyebrow">机会收纳</span>
              <h2>Inbox</h2>
            </div>
          </div>
          <form className="inbox-form" onSubmit={addInbox}>
            <input
              value={inboxText}
              onChange={(event) => setInboxText(event.target.value)}
              placeholder="记下来，但现在不展开"
            />
            <IconButton label="加入 Inbox" type="submit">
              <Plus size={18} />
            </IconButton>
          </form>
          {data.inbox.length ? (
            <div className="inbox-list">
              {data.inbox.slice(0, 6).map((item) => (
                <div className="inbox-item" key={item.id}>
                  <Inbox size={15} />
                  <span>{item.text}</span>
                  <IconButton label="删除" onClick={() => actions.removeInbox(item.id)}>
                    <X size={15} />
                  </IconButton>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-copy">想到外部方向时先放这里，固定时间再处理。</p>
          )}
        </section>
      </div>

      <div className="dashboard-grid">
        <section className="tool-surface">
          <div className="section-heading">
            <div>
              <span className="eyebrow">岗位推进</span>
              <h2>最近的下一步</h2>
            </div>
            <button className="text-button" onClick={() => actions.setView("jobs")}>岗位列表</button>
          </div>
          {nextJobs.length ? (
            <div className="compact-list">
              {nextJobs.map((job) => (
                <button className="compact-row" key={job.id} onClick={() => actions.openJob(job)}>
                  <BriefcaseBusiness size={18} />
                  <span className="compact-main">
                    <strong>{job.company} · {job.role}</strong>
                    <small>{job.nextAction}</small>
                  </span>
                  <span className="badge neutral">{job.stage}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={BriefcaseBusiness}
              title="还没有岗位下一步"
              description="记录岗位时，务必写一条具体的下一步。"
              action={<button className="button secondary" onClick={() => actions.openJob()}>添加岗位</button>}
            />
          )}
        </section>

        <section className="tool-surface">
          <div className="section-heading">
            <div>
              <span className="eyebrow">最近状态</span>
              <h2>回顾记录</h2>
            </div>
          </div>
          {recentCheckIns.length ? (
            <div className="checkin-list compact">
              {recentCheckIns.map((item) => (
                <article className="checkin-entry" key={item.id}>
                  <div>
                    <StateBadge value={item.state} />
                    <time>{formatDateTime(item.createdAt)}</time>
                  </div>
                  <p>{item.nextAction || item.did || "这次没有填写内容"}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Activity}
              title="还没有回顾记录"
              description="先做一次 1 分钟回顾。"
              action={<button className="button secondary" onClick={actions.openCheckIn}>立即回顾</button>}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function JobsView({ data, actions }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("全部");
  const filtered = data.jobs.filter((job) => {
    const matchesStage = stage === "全部" || job.stage === stage;
    const haystack = `${job.company} ${job.role} ${job.requirements} ${job.gaps}`.toLowerCase();
    return matchesStage && haystack.includes(query.toLowerCase());
  });

  return (
    <div className="view-stack">
      <div className="view-toolbar">
        <div className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索公司、岗位或要求" />
        </div>
        <label className="select-wrap">
          <Filter size={16} />
          <select value={stage} onChange={(event) => setStage(event.target.value)}>
            <option>全部</option>
            {JOB_STAGES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <button className="button primary" onClick={() => actions.openJob()}>
          <Plus size={17} />
          添加岗位
        </button>
      </div>

      {filtered.length ? (
        <div className="job-grid">
          {filtered.map((job) => (
            <article className="job-card" key={job.id}>
              <header>
                <div>
                  <span className="eyebrow">{job.company}</span>
                  <h2>{job.role}</h2>
                </div>
                <div className="card-actions">
                  {job.link ? (
                    <a className="icon-button" href={job.link} target="_blank" rel="noreferrer" aria-label="打开岗位链接" title="打开岗位链接">
                      <ExternalLink size={17} />
                    </a>
                  ) : null}
                  <IconButton label="编辑岗位" onClick={() => actions.openJob(job)}>
                    <Pencil size={17} />
                  </IconButton>
                </div>
              </header>
              <div className="badge-row">
                <span className="badge neutral">{job.stage}</span>
                <PriorityBadge value={job.priority} />
                {job.location ? <span className="badge subtle">{job.location}</span> : null}
              </div>
              <dl className="job-details">
                <div>
                  <dt>岗位要求</dt>
                  <dd>{job.requirements || "尚未整理"}</dd>
                </div>
                <div>
                  <dt>当前差距</dt>
                  <dd>{job.gaps || "尚未评估"}</dd>
                </div>
              </dl>
              <footer>
                <Target size={16} />
                <span>{job.nextAction || "还没有设置下一步"}</span>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BriefcaseBusiness}
          title={data.jobs.length ? "没有符合筛选条件的岗位" : "开始建立岗位地图"}
          description="记录岗位要求、能力差距和下一步，减少反复搜索。"
          action={<button className="button primary" onClick={() => actions.openJob()}><Plus size={17} />添加岗位</button>}
        />
      )}
    </div>
  );
}

function TasksView({ data, actions }) {
  const [filter, setFilter] = useState("进行中");
  const tasks = [...data.tasks]
    .filter((task) => filter === "全部" || (filter === "已完成" ? task.done : !task.done))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.priority !== b.priority) return a.priority.localeCompare(b.priority);
      return String(a.dueDate).localeCompare(String(b.dueDate));
    });

  return (
    <div className="view-stack">
      <div className="view-toolbar">
        <div className="segmented">
          {["进行中", "全部", "已完成"].map((item) => (
            <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>
          ))}
        </div>
        <button className="button primary" onClick={() => actions.openTask()}>
          <Plus size={17} />
          添加 TODO
        </button>
      </div>

      <section className="task-surface">
        <div className="task-header" aria-hidden="true">
          <span>完成</span><span>任务</span><span>类别</span><span>截止</span><span>预计</span><span>优先级</span><span>操作</span>
        </div>
        {tasks.length ? tasks.map((task) => (
          <div className={`task-row ${task.done ? "is-done" : ""}`} key={task.id}>
            <button className="task-check" onClick={() => actions.toggleTask(task.id)} aria-label={task.done ? "标记为未完成" : "标记为已完成"}>
              {task.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            </button>
            <strong>{task.title}</strong>
            <span>{task.category}</span>
            <span>{formatShortDate(task.dueDate)}</span>
            <span>{task.estimate ? `${task.estimate} 分` : "--"}</span>
            <PriorityBadge value={task.priority} />
            <div className="row-actions">
              <IconButton label="编辑任务" onClick={() => actions.openTask(task)}><Pencil size={16} /></IconButton>
              <IconButton label="删除任务" onClick={() => actions.removeTask(task.id)}><Trash2 size={16} /></IconButton>
            </div>
          </div>
        )) : (
          <EmptyState
            icon={CheckSquare2}
            title="这个列表是空的"
            description="添加一个具体、可开始、有优先级的动作。"
            action={<button className="button primary" onClick={() => actions.openTask()}><Plus size={17} />添加 TODO</button>}
          />
        )}
      </section>
    </div>
  );
}

function AgentView({ data, actions, cloud }) {
  const context = useMemo(() => buildAgentContext(data), [data]);
  const importRef = useRef(null);

  return (
    <div className="view-stack">
      <div className="agent-grid">
        <section className="tool-surface">
          <div className="section-heading">
            <div>
              <span className="eyebrow">两周只押一个方向</span>
              <h2>当前 14 天实验</h2>
            </div>
          </div>
          <div className="form-grid">
            <Field label="方向" className="span-2">
              <input value={data.experiment.direction} onChange={(event) => actions.updateExperiment("direction", event.target.value)} placeholder="例如：用 AI 做一个工作流工具" />
            </Field>
            <Field label="14 天后要拿出的证据" className="span-2">
              <textarea rows="3" value={data.experiment.evidence} onChange={(event) => actions.updateExperiment("evidence", event.target.value)} placeholder="必须能被别人打开、阅读、运行或评价" />
            </Field>
            <Field label="每天最小动作">
              <input value={data.experiment.dailyMinimum} onChange={(event) => actions.updateExperiment("dailyMinimum", event.target.value)} placeholder="每天 30 分钟完成什么" />
            </Field>
            <Field label="当前工作最低交付">
              <input value={data.experiment.workBaseline} onChange={(event) => actions.updateExperiment("workBaseline", event.target.value)} placeholder="最不能炸的一件事" />
            </Field>
            <Field label="开始日期">
              <input type="date" value={data.experiment.startDate} onChange={(event) => actions.updateExperiment("startDate", event.target.value)} />
            </Field>
            <Field label="结束日期">
              <input type="date" value={data.experiment.endDate} onChange={(event) => actions.updateExperiment("endDate", event.target.value)} />
            </Field>
          </div>
        </section>

        <section className="tool-surface privacy-panel">
          <div className="privacy-icon">{cloud.user ? <Cloud size={22} /> : <FileJson size={22} />}</div>
          <h2>{cloud.user ? "本地缓存与云端同步" : "数据保存在当前浏览器"}</h2>
          <p>{cloud.user
            ? `已登录 ${cloud.user.email}。数据会保留本地缓存，并同步到你的 Supabase 账户。`
            : "网页目前使用本地存储。换设备或清理浏览器前，请先导出 JSON 备份。"}</p>
          <div className="button-stack">
            <button className="button secondary" onClick={actions.openCloudSync}>
              {cloud.user ? <RefreshCw size={17} /> : <Cloud size={17} />}
              {cloud.user ? cloudStatusLabel(cloud) : "设置云同步"}
            </button>
            <button className="button secondary" onClick={actions.exportData}><Download size={17} />导出数据</button>
            <button className="button secondary" onClick={() => importRef.current?.click()}><Upload size={17} />导入数据</button>
            <button className="button danger-quiet" onClick={actions.resetData}><RotateCcw size={17} />清空并重置</button>
          </div>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={actions.importData} />
        </section>
      </div>

      <section className="tool-surface agent-output">
        <div className="section-heading">
          <div>
            <span className="eyebrow">自动汇总</span>
            <h2>给 agent 的上下文</h2>
          </div>
          <div className="button-row">
            <button className="button secondary" onClick={() => actions.copyText(context)}><ClipboardCopy size={17} />复制</button>
            <button className="button secondary" onClick={() => downloadFile(`agent-context-${localDateKey()}.md`, context, "text/markdown")}><Download size={17} />下载 MD</button>
          </div>
        </div>
        <textarea className="agent-preview" value={context} readOnly aria-label="Agent 上下文预览" />
      </section>
    </div>
  );
}

function CheckInModal({ onClose, onSave, onSnooze }) {
  const [form, setForm] = useState({ state: "维护现金流", did: "", loop: "", nextAction: "" });

  const submit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <Modal title="这一段时间过得怎么样？" onClose={onClose} size="large">
      <div className="reset-callout">
        <Focus size={22} />
        <div><strong>先坐直，再回答。</strong><span>双脚踩地，肩膀放下，慢慢呼气一次。</span></div>
      </div>
      <form className="modal-form" onSubmit={submit}>
        <Field label="当前状态">
          <select value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })}>
            {CHECKIN_STATES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="这段时间实际做了什么？">
          <textarea rows="4" value={form.did} onChange={(event) => setForm({ ...form, did: event.target.value })} autoFocus />
        </Field>
        <Field label="有没有陷入想方向但不产出？触发点是什么？">
          <textarea rows="3" value={form.loop} onChange={(event) => setForm({ ...form, loop: event.target.value })} />
        </Field>
        <Field label="下一段只推进一个可见动作">
          <input value={form.nextAction} onChange={(event) => setForm({ ...form, nextAction: event.target.value })} placeholder="例如：打开需求文档并写出前三个步骤" />
        </Field>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onSnooze}><Clock3 size={17} />顺延 10 分钟</button>
          <button type="submit" className="button primary"><Save size={17} />保存并开始下一段</button>
        </div>
      </form>
    </Modal>
  );
}

function JobModal({ job, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => job || {
    id: createId(), company: "", role: "", stage: "关注", priority: "P2", location: "", salary: "", link: "", requirements: "", gaps: "", nextAction: "", notes: "",
  });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal title={job ? "编辑岗位" : "添加岗位"} onClose={onClose} size="large">
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
        <div className="form-grid">
          <Field label="公司"><input required value={form.company} onChange={(event) => update("company", event.target.value)} autoFocus /></Field>
          <Field label="岗位"><input required value={form.role} onChange={(event) => update("role", event.target.value)} /></Field>
          <Field label="阶段"><select value={form.stage} onChange={(event) => update("stage", event.target.value)}>{JOB_STAGES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="优先级"><select value={form.priority} onChange={(event) => update("priority", event.target.value)}>{PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="地点"><input value={form.location} onChange={(event) => update("location", event.target.value)} placeholder="城市 / 远程" /></Field>
          <Field label="薪资范围"><input value={form.salary} onChange={(event) => update("salary", event.target.value)} /></Field>
          <Field label="岗位链接" className="span-2"><div className="input-with-icon"><Link2 size={16} /><input type="url" value={form.link} onChange={(event) => update("link", event.target.value)} placeholder="https://" /></div></Field>
          <Field label="具体要求" className="span-2"><textarea rows="4" value={form.requirements} onChange={(event) => update("requirements", event.target.value)} placeholder="职责、技术栈、年限、加分项" /></Field>
          <Field label="我当前的差距"><textarea rows="3" value={form.gaps} onChange={(event) => update("gaps", event.target.value)} placeholder="缺少哪些知识、作品或经历" /></Field>
          <Field label="下一步"><textarea rows="3" value={form.nextAction} onChange={(event) => update("nextAction", event.target.value)} placeholder="例如：周三前完成一个相关 demo" /></Field>
          <Field label="备注" className="span-2"><textarea rows="3" value={form.notes} onChange={(event) => update("notes", event.target.value)} /></Field>
        </div>
        <div className="modal-actions split">
          {job ? <button type="button" className="button danger-quiet" onClick={() => onDelete(job.id)}><Trash2 size={17} />删除</button> : <span />}
          <button type="submit" className="button primary"><Save size={17} />保存岗位</button>
        </div>
      </form>
    </Modal>
  );
}

function TaskModal({ task, onClose, onSave }) {
  const [form, setForm] = useState(() => task || {
    id: createId(), title: "", category: "当前工作", priority: "P1", dueDate: localDateKey(), estimate: 30, done: false, createdAt: new Date().toISOString(),
  });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal title={task ? "编辑 TODO" : "添加 TODO"} onClose={onClose}>
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
        <Field label="具体动作" hint="尽量用动词开头，确保能在 5-60 分钟内开始。">
          <input required value={form.title} onChange={(event) => update("title", event.target.value)} autoFocus placeholder="例如：整理岗位要求并标出三个能力差距" />
        </Field>
        <div className="form-grid">
          <Field label="类别"><select value={form.category} onChange={(event) => update("category", event.target.value)}>{TASK_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="优先级"><select value={form.priority} onChange={(event) => update("priority", event.target.value)}>{PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="截止日期"><input type="date" value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} /></Field>
          <Field label="预计分钟"><input type="number" min="5" step="5" value={form.estimate} onChange={(event) => update("estimate", Number(event.target.value))} /></Field>
        </div>
        <div className="modal-actions"><button type="submit" className="button primary"><Save size={17} />保存 TODO</button></div>
      </form>
    </Modal>
  );
}

export default function App() {
  const [data, setData] = useState(readInitialData);
  const [view, setView] = useState("dashboard");
  const [now, setNow] = useState(Date.now());
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [jobModal, setJobModal] = useState(null);
  const [taskModal, setTaskModal] = useState(null);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [toast, setToast] = useState("");

  const cloud = useCloudSync({ data, setData, onMessage: setToast });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const due = data.settings.timerRunning
      && data.settings.nextCheckAt
      && now >= new Date(data.settings.nextCheckAt).getTime();
    if (!due || checkInOpen) return;

    setCheckInOpen(true);
    setData((current) => ({
      ...current,
      settings: { ...current.settings, timerRunning: false, nextCheckAt: null },
    }));
    if (data.settings.notifications && "Notification" in window && Notification.permission === "granted") {
      new Notification("该做一次时间回顾了", { body: "先坐直，再写下下一段只推进什么。" });
    }
  }, [now, data.settings.timerRunning, data.settings.nextCheckAt, data.settings.notifications, checkInOpen]);

  const updateSettings = (patch) => setData((current) => ({
    ...current,
    settings: { ...current.settings, ...patch },
  }));

  const startTimer = () => {
    const next = new Date(Date.now() + data.settings.intervalMinutes * 60_000).toISOString();
    updateSettings({ timerRunning: true, nextCheckAt: next });
  };

  const pauseTimer = () => updateSettings({ timerRunning: false, nextCheckAt: null });

  const setIntervalMinutes = (minutes) => {
    const patch = { intervalMinutes: minutes };
    if (data.settings.timerRunning) patch.nextCheckAt = new Date(Date.now() + minutes * 60_000).toISOString();
    updateSettings(patch);
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      setToast("当前浏览器不支持通知");
      return;
    }
    const permission = await Notification.requestPermission();
    updateSettings({ notifications: permission === "granted" });
    setToast(permission === "granted" ? "浏览器通知已开启" : "没有获得通知权限");
  };

  const saveCheckIn = (form) => {
    const entry = { id: createId(), ...form, createdAt: new Date().toISOString() };
    const next = new Date(Date.now() + data.settings.intervalMinutes * 60_000).toISOString();
    setData((current) => ({
      ...current,
      checkIns: [entry, ...current.checkIns],
      settings: { ...current.settings, timerRunning: true, nextCheckAt: next },
    }));
    setCheckInOpen(false);
    setToast("回顾已保存，开始下一段");
  };

  const snoozeCheckIn = () => {
    updateSettings({ timerRunning: true, nextCheckAt: new Date(Date.now() + 10 * 60_000).toISOString() });
    setCheckInOpen(false);
  };

  const saveJob = (job) => {
    setData((current) => {
      const exists = current.jobs.some((item) => item.id === job.id);
      return { ...current, jobs: exists ? current.jobs.map((item) => item.id === job.id ? job : item) : [job, ...current.jobs] };
    });
    setJobModal(null);
    setToast("岗位已保存");
  };

  const removeJob = (id) => {
    if (!window.confirm("确定删除这个岗位记录吗？")) return;
    setData((current) => ({ ...current, jobs: current.jobs.filter((item) => item.id !== id) }));
    setJobModal(null);
  };

  const saveTask = (task) => {
    setData((current) => {
      const exists = current.tasks.some((item) => item.id === task.id);
      return { ...current, tasks: exists ? current.tasks.map((item) => item.id === task.id ? task : item) : [task, ...current.tasks] };
    });
    setTaskModal(null);
    setToast("TODO 已保存");
  };

  const toggleTask = (id) => setData((current) => ({
    ...current,
    tasks: current.tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task),
  }));

  const removeTask = (id) => {
    if (!window.confirm("确定删除这个 TODO 吗？")) return;
    setData((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== id) }));
  };

  const addInbox = (text) => setData((current) => ({
    ...current,
    inbox: [{ id: createId(), text, createdAt: new Date().toISOString() }, ...current.inbox],
  }));

  const removeInbox = (id) => setData((current) => ({
    ...current,
    inbox: current.inbox.filter((item) => item.id !== id),
  }));

  const updateExperiment = (key, value) => setData((current) => ({
    ...current,
    experiment: { ...current.experiment, [key]: value },
  }));

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast("已复制到剪贴板");
    } catch {
      setToast("复制失败，请从文本框手动复制");
    }
  };

  const exportData = () => downloadFile(
    `self-construction-${localDateKey()}.json`,
    JSON.stringify(data, null, 2),
    "application/json",
  );

  const importData = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setData(normalizeData(JSON.parse(String(reader.result))));
        setToast("数据已导入");
      } catch {
        setToast("导入失败：不是有效的 JSON 数据");
      }
    };
    reader.readAsText(file);
  };

  const resetData = () => {
    if (!window.confirm("这会清空当前浏览器中的所有记录。确定继续吗？")) return;
    setData(defaultData());
    setToast("已恢复初始状态");
  };

  const actions = {
    setView,
    startTimer,
    pauseTimer,
    setIntervalMinutes,
    requestNotifications,
    openCheckIn: () => setCheckInOpen(true),
    openJob: (job = null) => setJobModal({ job }),
    openTask: (task = null) => setTaskModal({ task }),
    toggleTask,
    removeTask,
    addInbox,
    removeInbox,
    updateExperiment,
    copyText,
    exportData,
    importData,
    resetData,
    openCloudSync: () => setCloudOpen(true),
  };

  const [title, subtitle] = VIEW_TITLES[view];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Focus size={22} /></span>
          <span><strong>Self Construction</strong><small>个人行动工作台</small></span>
        </div>
        <nav className="side-nav" aria-label="主导航">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Clock3 size={16} />
          <span>{data.settings.timerRunning ? `回顾倒计时 ${formatCountdown(data.settings.nextCheckAt, now)}` : "提醒器当前暂停"}</span>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="topbar-actions">
            <CloudStatusButton cloud={cloud} onClick={() => setCloudOpen(true)} />
            <button className="button secondary desktop-only" onClick={() => setCheckInOpen(true)}><Focus size={17} />立即回顾</button>
            <IconButton label="添加 TODO" onClick={() => setTaskModal({ task: null })}><Plus size={19} /></IconButton>
          </div>
        </header>

        <div className="content-area">
          {view === "dashboard" ? <Dashboard data={data} now={now} actions={actions} /> : null}
          {view === "jobs" ? <JobsView data={data} actions={actions} /> : null}
          {view === "tasks" ? <TasksView data={data} actions={actions} /> : null}
          {view === "agent" ? <AgentView data={data} actions={actions} cloud={cloud} /> : null}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="移动端主导航">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {checkInOpen ? <CheckInModal onClose={() => setCheckInOpen(false)} onSave={saveCheckIn} onSnooze={snoozeCheckIn} /> : null}
      {jobModal ? <JobModal job={jobModal.job} onClose={() => setJobModal(null)} onSave={saveJob} onDelete={removeJob} /> : null}
      {taskModal ? <TaskModal task={taskModal.task} onClose={() => setTaskModal(null)} onSave={saveTask} /> : null}
      {cloudOpen ? <CloudSyncModal cloud={cloud} onClose={() => setCloudOpen(false)} /> : null}
      {toast ? <div className="toast"><Check size={17} />{toast}</div> : null}
    </div>
  );
}
