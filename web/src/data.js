export const STORAGE_KEY = "self-construction-web-v1";

export const JOB_STAGES = ["关注", "准备", "已投", "面试", "暂停", "拒绝", "Offer"];
export const PRIORITIES = ["P0", "P1", "P2", "P3"];
export const TASK_CATEGORIES = ["当前工作", "新方向", "学习", "求职", "个人"];
export const CHECKIN_STATES = [
  "维护现金流",
  "推进新方向",
  "机会焦虑",
  "陷入循环",
  "需要休息",
];

export function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultData() {
  const createdAt = new Date().toISOString();
  return {
    version: 1,
    settings: {
      intervalMinutes: 60,
      timerRunning: false,
      nextCheckAt: null,
      notifications: false,
    },
    checkIns: [],
    jobs: [],
    tasks: [
      {
        id: createId(),
        title: "完成今天工作上最不能炸的一件事",
        category: "当前工作",
        priority: "P0",
        dueDate: localDateKey(),
        estimate: 30,
        done: false,
        createdAt,
      },
      {
        id: createId(),
        title: "定义本轮 14 天实验要产出的证据",
        category: "新方向",
        priority: "P1",
        dueDate: localDateKey(),
        estimate: 30,
        done: false,
        createdAt,
      },
    ],
    experiment: {
      direction: "",
      evidence: "",
      dailyMinimum: "",
      workBaseline: "",
      startDate: localDateKey(),
      endDate: "",
    },
    inbox: [],
  };
}

export function normalizeData(value) {
  const fallback = defaultData();
  if (!value || typeof value !== "object") return fallback;
  return {
    ...fallback,
    ...value,
    settings: { ...fallback.settings, ...(value.settings || {}) },
    experiment: { ...fallback.experiment, ...(value.experiment || {}) },
    checkIns: Array.isArray(value.checkIns) ? value.checkIns : [],
    jobs: Array.isArray(value.jobs) ? value.jobs : [],
    tasks: Array.isArray(value.tasks) ? value.tasks : fallback.tasks,
    inbox: Array.isArray(value.inbox) ? value.inbox : [],
  };
}
