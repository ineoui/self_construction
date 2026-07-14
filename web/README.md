# Self Construction Web

一个无需后端的个人行动工作台。数据保存在浏览器本地，适合部署到 GitHub Pages。

## 功能

- 定时回顾和浏览器通知
- 岗位跟踪：公司、岗位、阶段、要求、差距、下一步
- TODO 和 P0-P3 优先级
- 14 天实验
- Inbox
- Agent Markdown 上下文生成
- JSON 数据备份和恢复

## 本地运行

```powershell
npm install
npm run dev
```

构建：

```powershell
npm run build
```

## 发布到 GitHub Pages

仓库根目录已经包含 `.github/workflows/pages.yml`。将仓库推送到 GitHub 后：

1. 打开仓库的 `Settings -> Pages`
2. 在 `Build and deployment` 中选择 `GitHub Actions`
3. 推送 `main` 分支，等待 `Deploy web app to GitHub Pages` workflow 完成

仓库名为 `self_construction` 时，默认访问地址是：

```text
https://ineoui.github.io/self_construction/
```

Vite 的部署基础路径配置在 `vite.config.js`。如果仓库改名，需要同步修改其中的 `base`。

## 数据说明

所有个人数据都写入浏览器 `localStorage`。静态网页本身不会把数据发送到 GitHub，也不会自动跨设备同步。

需要跨设备时：

1. 在“Agent 分析”页面点击“导出数据”
2. 在另一台设备打开网页
3. 点击“导入数据”并选择刚才的 JSON 文件

浏览器通知只在网页处于打开状态时可靠工作。关闭页面后，纯 GitHub Pages 无法持续在后台计时。
