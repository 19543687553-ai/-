# 心屿 · AI 情感陪伴机器人 — 交接文档

> 面向下一个接手本项目的 AI / 工程师。请先完整读完本文件，再动代码。
> 最后更新：2026-10-24 · 版本：v1.1.0

---

## 0. 一句话概括

一个「有情绪、会主动说话」的 AI 情感陪伴产品：PHP 8 + SQLite 单文件后端，原生 HTML/CSS/JS 三套前端（登录注册页、陪伴主界面、管理后台），**无构建步骤、无前端框架、上传即用**。

三个入口：

| 页面 | 文件 | 作用 |
| --- | --- | --- |
| 登录 / 注册 | `ai-companion/index.html` | 登录、注册、体验账号、主题预览、封禁弹窗 |
| 陪伴主界面 | `ai-companion/app.html` | 聊天、情绪、手势互动、主动说话、回忆、设置 |
| 管理后台 | `ai-companion/admin.html` | 数据看板、用户、封禁、聊天记录、模型、公告、反馈等 |

---

## 1. 当前状态与交付物

- 版本：`v1.1.0`（`PHP/config.php` 的 `LUMI_VERSION`、`admin.html` 登录页脚、压缩包文件名三处需一致）
- 安装包：`/workspace/AI 情感陪伴-v1.1.0.zip`（566 KB，22 个文件，**不含** `PHP/data/`）
- 默认账号：
  - 管理员：`zrl / 201354`（首次建库时写入，可用环境变量覆盖）
  - 体验用户：`demo / demo123`（昵称「晚晚」，有 12 条种子对话与 14 天情绪记录）
  - 封禁演示：`momo / demo123`
  - 另一用户：`chen / demo123`
- 模型：默认 DeepSeek 预设，但**未配置 Key**，因此默认走离线陪伴模板。真实对话需在后台「模型配置」填 Key。

功能完成度：登录注册、四套主题、情绪引擎、主动说话、手势互动、聊天记录、回忆/轨迹、后台 13 个模块、秒级封禁与前端封禁弹窗、模型配置与拉取模型 —— 均已实现并通过浏览器验证。

---

## 2. 运行与部署

### 本地开发

```bash
cd /workspace/ai-companion
php -S 0.0.0.0:8080 -t .
# 打开 http://127.0.0.1:8080/index.html
```

要求 PHP ≥ 8.0，扩展：`pdo_sqlite`、`curl`、`openssl`、`mbstring`（生成图片不依赖 GD，头像为静态 jpg）。

### 生产部署（目标：`http://zx.2026027.xyz/PHP`）

1. 把 `ai-companion/` 内的 `index.html`、`app.html`、`admin.html`、`assets/` 放到站点根目录；
2. 把 `PHP/` 整个目录放到根目录下（即 `/PHP/api.php` 可访问）；
3. 确保 `PHP/data/` 可写（不存在会自动创建），首次访问自动建表 + 写种子数据；
4. `PHP/.htaccess` 已禁止访问 `data/`、`.app_secret`、`*.sqlite`、`*.log`；Nginx 需自行加等价规则；
5. 若前端与后端不同域/不同目录，在加载 `assets/config.js` 前设置 `window.LUMI_API_OVERRIDE = 'https://.../PHP/api.php'`。

### 关键约定

- 前端默认按 `['/PHP/api.php', 'PHP/api.php', '/api.php']` 依次探测（`assets/api.js` 的 `init()`），探测成功会写入 `localStorage`（键 `xinyu.apiBase`）。
- 管理端与用户端是**两套独立 token**，分别存 `xinyu.admin.token` 与 `xinyu.token`。
- 环境变量（可选）：`LUMI_SECRET`（加密主密钥，≥16 字符）、`LUMI_ADMIN_USERNAME`、`LUMI_ADMIN_PASSWORD`。
- 不要提交 `PHP/data/`（数据库、`.app_secret`、日志）到仓库。

---

## 3. 架构与数据流

```
浏览器（原生 JS，无构建）
   │  fetch  POST api.php?action=xxx   JSON / Bearer Token
   ▼
PHP/api.php   ── switch($action) 单入口路由，try/catch 统一 JSON 错误
   ├─ PHP/config.php   常量 / DB / 建表 / 设置 / 认证 / 加密 / 封禁 / 限流 / 审计
   └─ PHP/emotion.php  情绪分析、情绪衰减、提示词、模型调用、降级回复、主动消息
        ▼
   SQLite（PHP/data/companion.sqlite，WAL + busy_timeout）
```

### 认证

- 用户：`user_sessions`；管理员：`admin_sessions`。token 明文只返回一次，库里存 `sha256`。
- `lumi_bearer()` 同时支持 `Authorization: Bearer xxx` 与 `?token=xxx`（后者仅供下载类接口，如备份/导出）。
- 前端 `request()` 收到 401 会派发 `lumi:auth-expired`；收到 403 且带 `ban` 会派发 `lumi:ban`，由 `auth.js` / `app.js` 弹出封禁弹窗。
- 管理员角色：`superadmin` / `admin` / `moderator`，前端按角色隐藏导航，后端逐接口校验。

### 加密

模型 API Key 用 AES-256-GCM（`openssl_encrypt`，随机 IV + tag）加密入库；主密钥来自 `LUMI_SECRET` 或 `PHP/data/.app_secret`。后台只返回掩码（`lumi_mask_key`），任何接口都不回显明文。

### 数据库表（15 张）

| 表 | 用途 |
| --- | --- |
| `settings` | 键值配置（应用名、主题、模型、主动说话、安全等） |
| `admins` / `admin_sessions` | 管理员与后台会话 |
| `users` / `user_sessions` | 用户、亲密度/信任/情绪状态、偏好 JSON、用户会话 |
| `conversations` / `messages` | 会话与消息（role、emotion、mood_after、pinned、read） |
| `ban_history` | 封禁原因、起止时间（秒级）、操作人、解封记录 |
| `mood_logs` | 情绪快照（valence/anger/sadness/energy/affection/label/source） |
| `interactions` | 手势互动（hug/headpat/flower/hand/warm） |
| `feedbacks` | 用户反馈与后台回复 |
| `announcements` | 公告（级别、启用、过期时间） |
| `sensitive_words` | 敏感词与处置动作 |
| `audit_logs` | 后台操作审计（含 `model.list` 拉取记录） |
| `rate_limits` | 接口限流计数 |

---

## 4. 接口清单

所有请求：`POST /PHP/api.php?action=<name>`，body 为 JSON；响应统一 `{code, msg, data}`，`code=200` 为成功。

### 公共（无需登录）
`health`、`appConfig`、`announcementPublic`

### 用户
`register`、`login`、`logout`、`me`、`updateProfile`、`changePassword`、`deleteAccount`、
`chat`、`gesture`、`poll`、`history`、`markRead`、`insights`、`pinMessage`、`feedbackCreate`、`feedbackList`

### 后台
`adminLogin`、`adminLogout`、`adminMe`、`adminStats`、`adminUsers`、`adminUserDetail`、`adminUpdateUser`、`adminBanUser`、`adminUnbanUser`、`adminResetPassword`、`adminDeleteUser`、`adminConversations`、`adminMessages`、`adminDeleteMessage`、`adminPinMessage`、`adminSendMessage`、`adminMoodAnalytics`、`adminSettings`、`adminSaveSettings`、`adminModelSave`、`adminModelTest`、`adminModelList`、`adminAnnouncements`、`adminAnnouncementSave`、`adminAnnouncementDelete`、`adminWords`、`adminWordSave`、`adminWordDelete`、`adminFeedbacks`、`adminFeedbackReply`、`adminAdmins`、`adminAdminSave`、`adminAdminDelete`、`adminAuditLogs`、`adminBroadcast`、`adminBackup`、`adminExportUsers`、`adminSystemInfo`

几个容易记错的返回结构：

- `adminStats` → `{stats, series(14天), mood_distribution, theme_distribution, recent_users, recent_audit, recent_feedbacks}`
- `adminUserDetail` → `{user, state, ban, messages, mood_series, ban_history, feedbacks, interactions, last_session, stats}`
- `adminUsers` → `{items, total, page, per_page, pages}`，筛选 `q/status(all|active|banned|high)/page`
- `adminMessages` → 筛选 `user_id/q/role/from/to/page`
- `adminModelList` → `{models:[{id, owned_by}], count, endpoint}`（失败 `code=400` + 可读原因）
- `adminBackup` / `adminExportUsers` 直接输出文件流，需要 `?token=`

### 封禁接口约定

`adminBanUser` 参数：`user_id`、`reason`（≥2 字）、`until_at`（**Unix 秒**，必须 > 当前时间）、`permanent`。
返回 `ban`：`{reason, until_at, until_text, banned_at, banned_at_text, permanent, remaining_seconds}`，`until_text` 精确到秒。前端弹窗展示原因 + 封禁时间 + 解封时间 + 倒计时 + 编号。

---

## 5. 情绪系统（产品核心，改动请谨慎）

相关函数全在 `PHP/emotion.php`：

| 函数 | 职责 |
| --- | --- |
| `lumi_analyze_user_message()` | 关键词/标点/长度打分，得出 anger/sadness/joy/anxiety/affection 等增量 |
| `lumi_apply_mood()` | 把增量合并进用户状态，计算 `mood_label`、亲密度，写 `mood_logs` |
| `lumi_mood_decay()` | 按时间衰减，避免情绪永远停在高点 |
| `lumi_extract_mood_tag()` | 从模型回复里解析 `<mood>happy|calm|sad|angry|shy|tired|excited</mood>` 并剥离标签 |
| `lumi_generate_reply()` | 组 prompt → 调模型 → 解析情绪标签 → 失败降级 |
| `lumi_fallback_reply()` | 未配置模型时的本地模板回复（按情绪/关键词选句） |
| `lumi_proactive_message()` | 主动说话：idle + 冷却 + 概率 |
| `lumi_gesture_effect()` | 手势 → 情绪/亲密度变化 + 文案 |

关系阶段由 `lumi_relationship()` 根据亲密度映射（陌生 → 熟悉 → 亲近 → 依恋……）。提示词模板在 `settings.model_system_prompt`，支持 `{{companion_name}}`、`{{nickname}}`、`{{affection}}`、`{{mood_label}}` 等变量。

**主动说话的触发链**：前端每 22 秒 `poll` → 后端检查 `proactive_enabled`、用户是否开启主动、距最后一条消息是否 ≥ `proactive_idle_seconds`（默认 75s）、距上次主动是否 ≥ `proactive_cooldown_seconds`（180s）、随机数 < `proactive_probability`（0.55）→ 生成一条 `role=proactive` 消息。**页面关闭时不会主动推送**（无 WebSocket/推送）。

**手势**：`hug` 抱抱 / `headpat` 摸摸头 / `flower` 送花 / `hand` 牵手 / `warm` 披外套。前端文案与后端 label 必须一致（曾经不一致，已修）。

---

## 6. 模型配置与「拉取模型」

### 配置项（`settings`）

`model_provider`、`model_base`、`model_name`、`model_key`（加密）、`model_temperature`、`model_max_tokens`、`model_system_prompt`。

### 端点推断

- 对话：`lumi_model_endpoint($base)` → 若已含 `/chat/completions` 原样；否则补 `/chat/completions`（兼容 `/v1`、`/api/v3`）。
- 模型列表：`lumi_models_endpoint($base)` → 若含 `/chat/completions` 替换为 `/models`；已含 `/models` 原样；否则补 `/models`。

### 拉取模型（v1.1.0 新增）

- 接口：`adminModelList`，参数 `model_base`、`model_key`（留空则复用已保存的 Key）。
- 实现：`lumi_models_request()` 用 curl GET `{base}/models`，兼容 `{data:[...]}` 与 `{models:[...]}` 两种返回；去重、按 id 排序、最多 500 个。
- 错误映射：401/403 → Key 无效；404 → 地址不支持 `/models`；其他非 2xx 带 HTTP 状态与响应片段；网络失败单独提示。
- 前端：`admin.js` 的 `fetchModels()` / `showModelPicker()`，弹窗内搜索、点击填入 `#modelName`，无需手输模型 ID。
- 若服务商不支持 `/models`，仍可手动填写模型名，不影响保存与「测试连接」。
- 每次拉取写审计日志 `model.list`。

### 测试连接

`adminModelTest` 用当前表单参数真实请求一次（80 tokens，45s 超时），返回模型原文、耗时、实际 model 名；未填完整会返回 400。

---

## 7. 前端结构与设计系统

### 文件职责

- `assets/config.js`：API 地址与候选、`storagePrefix`
- `assets/api.js`：`ApiError`、`LumiAPI`（init/request/getToken/setToken/downloadUrl）、`ICONS`（约 70 个 SVG path）、`icon()`、`THEMES`、`applyTheme()`、`UI`（escapeHTML/formatTime/relativeTime/toast/debounce/chime 等）
- `assets/base.css`：设计令牌与通用组件（按钮、字段、开关、弹窗、封禁弹窗、toast、`[hidden]`）
- `index.html` + `auth.css` + `auth.js`：登录注册
- `app.html` + `app.css` + `app.js`：陪伴主界面
- `admin.html` + `admin.css` + `admin.js`：后台

### 主题

4 套：`dusk` 暮色 / `dawn` 晨雾 / `sakura` 樱夜 / `forest` 森语。主题通过 `<html data-theme="...">` 切换，CSS 变量定义在 `base.css`（`--bg/--panel/--text/--accent/--user-bubble/...`）。用户主题存服务端 `users.theme`，同时写 `localStorage` 防闪烁。

**新增主题要同步 4 处**：`base.css` 变量块、`api.js` 的 `THEMES`、注册页氛围选项（`index.html` + `auth.js`）、`admin.js` 的 `THEME_TEXT`。

### 主界面

左侧导航（桌面竖栏 / 移动底栏）+ 聊天区 + 右侧情绪栏；视图 `chat/insights/memories/settings`。`setMood()` 用 `--mood-a/--mood-b` 驱动光晕。包装输入框、手势条、建议 chips。轮询 22s。封禁监听 `lumi:ban`。

### 后台

hash 路由（`#dashboard` 等 13 个视图），`switchView` / `loadView` / 各 `renderXxx`；通用 `openModal`、`confirmDialog`（支持输入）、`chartSVG`（自绘 SVG 折线，移动端 430 viewBox / 11px 字号）、`barList`、`pagerHTML`；用户详情抽屉 6 个 tab（概览/对话/情绪/封禁/反馈/资料），抽屉内点击用 `data-drawer-act` 单独委托（**抽屉不在 `#adminContent` 内**）。

---

## 8. 踩过的坑（务必不要回归）

| 现象 | 根因 | 修复位置 |
| --- | --- | --- |
| 任何含「你」的消息都被判生气 | `analyze` 里对「你」无条件加权 angry | `emotion.php`：仅在已命中 angry 关键词时加权 |
| 主动说话永不触发 | `lumi_current_user()` 每次请求都更新 `users.last_active_at` | 改为只更新 `user_sessions.last_seen_at` |
| `hidden` 属性无效 | `.btn` 等 display 规则覆盖 | `base.css` 加 `[hidden]{display:none!important}` |
| 图标被 `mountIcons` 覆盖 | 元素本身用 `data-icon`，innerHTML 被重写 | 改为内部 `<span data-icon>` |
| 抽屉内刷新/置顶/删除按钮无反应 | 抽屉不在 `#adminContent` 事件委托范围 | `onDrawerClick` 处理 `data-drawer-act` 与抽屉内 `msg-pin/msg-del` |
| 抽屉标签栏被纵向裁切 | flex 收缩 | `.drawer-head/.drawer-tabs/.drawer-foot` 加 `flex:0 0 auto` |
| 手机横屏输入框被裁到首屏外 | 左侧导航 min-content 495px 撑高整行 grid | `.app-shell` 用 `grid-template-rows: minmax(0,1fr)`，`.app-rail` 允许内部滚动，并加小高度横屏压缩规则 |
| iOS 聚焦输入框自动放大 | 输入框字号 < 16px | 窄屏/触屏强制 16px |
| 移动端图表日期挤在一起 | 760 宽 viewBox 缩到 390 | `chartSVG` 增加 mobile 分支（430 宽、11px、少标签） |
| 注册后主题不生效 | 后端未接收 `theme` | `register` 校验并写入 `users.theme` |
| 未登录就请求 `history` | 初始化顺序错误 | `fillFeedbackHistory()` 移到 `me` 成功之后 |
| `modelPayload` 空对象报错 | `($('#providerSeg .active') || {}).dataset` | 先取 `active` 再判断 |
| 日期/下拉筛选重复请求 | `input` 事件监听包含 SELECT/date | `onContentInput` 提前 return，交给 `change` |
| 图片底部水印 | 生成图自带水印 | `login-bg.jpg` 用 PIL 裁掉底部 110px |
| 后台提示默认账号仍是 admin | 文案遗漏 | `admin.html` 与 `config.php` 同步为 `zrl` |

---

## 9. 验证方法（改完必做）

1. 语法：`php -l PHP/api.php && php -l PHP/config.php && php -l PHP/emotion.php && node --check assets/admin.js`
2. 接口冒烟：登录取 token，逐个请求 `adminStats/adminUsers/adminUserDetail/adminMoodAnalytics/adminSettings/adminModelList/adminSystemInfo`，确认 200 与字段完整。
3. 封禁链路：`adminBanUser` 用 `until_at = now + 125`，确认 `remaining_seconds=125`、`until_text` 到秒；再用被封账号登录确认 403 + `ban`。
4. 拉取模型：本地起一个 mock `/models`（返回含重复项），验证去重、排序、搜索、点击填入、空 Key 与错误 Key 提示。
5. 浏览器：至少覆盖 1920×1080、1366×768、844×390、390×844；检查横向溢出、输入框 16px、横屏首屏可见输入区、抽屉标签完整、控制台 0 报错。
6. 前台链路：demo 登录 → 发消息 → 情绪变化 → 手势 → 主动说话（调小 idle 或等 75s）→ 主题切换 → 设置保存 → 反馈提交；momo 登录 → 封禁弹窗。

---

## 10. 打包规范

```bash
cd /workspace
zip -r "AI 情感陪伴-v<版本>.zip" ai-companion -x "ai-companion/PHP/data/*"
unzip -t "AI 情感陪伴-v<版本>.zip"
```

- 不打包 `PHP/data/`（首次部署自动生成）。
- 升版本时同步：`PHP/config.php` 的 `LUMI_VERSION`、`admin.html` 页脚、压缩包文件名。
- 打包后记录 SHA-256，方便校验。

---

## 11. 已知限制与后续建议

- **无真实模型 Key**：默认走离线模板；配置 Key 后才有真实生成能力。
- 主动说话依赖页面轮询，**关闭页面即停止**；要做真推送需 WebSocket / 消息队列 / 定时任务。
- SQLite 适合中小规模；高并发写入需换 MySQL/Postgres，注意 `busy_timeout`。
- `model_base` 由管理员填写，服务端会请求该地址（存在 SSRF 面），仅管理员可用；若开放给低权限角色需加白名单。
- 无验证码、无二步验证；登录限流较基础（`rate_limits`）。
- 用户偏好里有 `tts/sound` 字段，但**语音合成尚未接入**，前端只用 WebAudio 提示音。
- 备份接口直接下载 sqlite 文件，大库需改为分卷/定时备份。
- 仓库默认分支是 `master`，功能提交在 `trae/agent-*` 分支；确认合并后再交付。
- `PHP/data/companion.sqlite` 曾被误提交，已从版本库移除并加入 `.gitignore`；本地文件保留，删除后会自动重建。

---

## 12. 给下一个 AI 的工作约定

1. **先读**：`HANDOFF.md` → `PHP/config.php` → `PHP/emotion.php` → `PHP/api.php` 路由表 → 对应前端文件。不要凭猜测改。
2. **保持架构**：单入口 `api.php?action=`，不引入框架/构建工具；前端继续用原生 JS 与 CSS 变量。
3. **模型 Key 只在后台配置**，永远不要在前端暴露明文、不要写进日志、不要提交 `.app_secret` / `data/`。
4. **改情绪逻辑要做回归**：至少用「我今天有点难过，你可以抱抱我吗」验证不误判 angry，用「我很生气」验证能命中 angry。
5. **改布局要测四种视口**，特别是 844×390 横屏与 390×844 竖屏。
6. **新增后台接口**：在 `api.php` 加 `case`、在 `admin.js` 加 `render`/`data-act`、必要时同步 `HANDOFF.md` 的接口清单。
7. **新增主题**：同步 4 处（见 §7），并检查登录页色板、后台图表配色。
8. **交付前**：语法检查 + 接口冒烟 + 浏览器回归 + 重新打包 + 更新版本号与本文档。
