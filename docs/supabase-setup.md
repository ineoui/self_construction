# Supabase 同步配置

网页在没有 Supabase 配置时仍然使用浏览器本地存储。完成下面配置后，会增加邮箱登录、云端保存和手机/PC 实时同步。

## 1. 创建项目

打开 <https://supabase.com/dashboard>，创建一个 Free Plan 项目。

项目创建完成后，在 SQL Editor 中执行仓库里的：

```text
supabase/schema.sql
```

它会创建 `user_state` 表、RLS 权限和 Realtime publication。

## 2. 配置登录跳转地址

在 Supabase Dashboard 的 Authentication URL Configuration 中设置：

```text
Site URL:
https://ineoui.github.io/self_construction/

Redirect URLs:
https://ineoui.github.io/self_construction/
http://localhost:5173/self_construction/
```

## 3. 获取前端配置

从项目的 Connect 或 API Settings 页面获取：

- Project URL
- Publishable key

不要使用或提供 `service_role` key。

本地开发时复制 `web/.env.example` 为 `web/.env.local`：

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

## 4. 配置 GitHub Pages

在 GitHub 仓库中打开 `Settings -> Secrets and variables -> Actions`，添加两个 Repository secrets：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

重新运行 `Deploy web app to GitHub Pages` workflow。

## 5. 第一次同步

1. 打开网页右上角的同步按钮
2. 输入邮箱并发送登录链接
3. 在邮箱中打开链接
4. 第一次登录会把当前浏览器的数据上传到 Supabase
5. 其他设备使用同一邮箱登录后，会优先读取云端数据

网页仍然会立即写入 `localStorage`。断网时可以继续使用，恢复网络后会自动上传最后一份状态。

## 当前冲突策略

当前版本使用单行 JSONB 和“最后一次写入覆盖”。非常适合一个人使用，但不适合两台设备同时高频编辑。如果后续需要多人协作，会把任务、岗位和回顾拆成独立数据表。
