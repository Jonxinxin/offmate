# OffMate 朋友作息共享工具 — 产品需求文档（PRD）

| 项 | 内容 |
| --- | --- |
| 项目代号 | OffMate |
| 文档版本 | **v2.0（网页版）** |
| 日期 | 2026-08-20 |
| 形态 | 移动端优先的网页应用（PWA） + Cloudflare Workers 后端 |
| 目标用户规模 | 单群组 3–20 人，总用户量千级以内 |
| 前端域名 | `om.988869.xyz` |
| 后端域名 | `omapi.988869.xyz` |

> **v2.0 变更说明**：v1.0 方案为微信小程序，因需要 ICP 备案、服务器域名白名单配置和平台审核，改为纯网页方案。后端技术栈（Cloudflare Workers + Hono + D1）完全保留，登录方式由「微信静默登录」改为「邀请链接 + 昵称 + 恢复码」。

---

## 1. 产品定位

### 1.1 一句话定义

OffMate 让几个朋友把各自的班次和休息日放在同一个页面上，**打开就知道今天谁有空**。

### 1.2 要解决的问题

轮班工作的人（护士、餐饮、零售、司机、工厂、程序员值班）约不到一起，核心痛点不是"没时间"，而是**信息不同步**：

- 想约饭要在群里挨个问"你明天休不休"，问一轮要半天。
- 别人的排班是变化的，问过一次的答案第二周就失效。
- 微信群里发的排班消息会被聊天记录冲掉，翻不到。

### 1.3 产品主张

- **以"今天"为中心**：首页第一屏必须直接回答"今天谁上班、谁休息"，不需要任何操作。
- **零门槛进入**：点开链接、填个昵称就能用。不注册、不下载、不授权。
- **录入成本极低**：设置一天的状态只需要一次点击；有固定规律的人一次配置后永久不用管。
- **小范围熟人**：不做社交发现、不做公开主页、不做陌生人推荐。

### 1.4 为什么网页比小程序更适合这个产品

| 维度 | 小程序 | 网页 |
| --- | --- | --- |
| 上线门槛 | 需备案域名、服务器域名白名单、平台审核 | 部署即可用 |
| 迭代速度 | 每次发版需审核（1–3 天） | 推送即生效 |
| 分享方式 | 小程序卡片（仅限微信内） | 链接，微信/短信/任何渠道都能发 |
| 跨端 | 仅微信内 | 微信、浏览器、桌面端通用 |
| 身份识别 | openid，天然唯一（**优势**） | 需自建（**唯一的代价**） |

唯一的代价是身份识别，本文档 §4.1 与 §10.2 专门处理这个问题。

### 1.5 明确不做的事（v1 范围外）

| 不做 | 原因 |
| --- | --- |
| 陌生人社交、附近的人 | 与定位冲突 |
| 聊天 / 私信 | 微信本身就是聊天工具，不重复造 |
| 打卡、考勤、工时统计 | 那是 HR 工具，会让产品变重且引入合规风险 |
| 图片上传（自定义头像） | 需要 R2 存储 + 图片处理 + 鉴黄合规，收益远小于成本。改用 emoji + 配色头像 |
| 微信 JS-SDK 自定义分享卡片 | 需要认证公众号 + 域名绑定，等于绕回备案。用 Open Graph 标签达到 80% 效果 |
| 付费功能 | v1 免费，控制在云服务免费额度内 |

---

## 2. 用户与场景

### 2.1 用户画像

**A. 轮班族（核心用户）**
上班时间不固定，休息日随排班表变化。有明确的班次概念（白班/中班/晚班）。愿意花一分钟维护自己的排班，换来朋友不再反复问他。

**B. 常规作息者（关联用户）**
朝九晚五、周末双休。自己几乎不需要维护数据，配置一次"做五休二"规律即可，主要是**看**别人的状态。

**C. 组织者（角色而非人群）**
群里张罗聚会的那个人。高频使用"未来几天视图"，需要一眼看出哪天大家的空闲重合度最高。通常也是创建群组、发邀请链接的人。

### 2.2 核心场景

| 场景 | 触发 | 用户动作 | 期望结果 |
| --- | --- | --- | --- |
| 临时约人 | 突然有空 | 点开收藏的链接 | 3 秒内知道今天谁休息 |
| 约周末聚餐 | 群里提议聚会 | 切到"未来几天" | 看出哪天空闲的人最多 |
| 维护自己排班 | 拿到新一周排班表 | 进"我的作息"批量设置 | 1 分钟内录完一周 |
| 规律作息 | 首次使用 | 配置"做五休二" | 之后长期零维护 |
| 拉人进来 | 有新朋友 | 复制邀请链接发微信群 | 对方点开填昵称即加入 |
| 换手机 | 换了新设备 | 输入恢复码 | 找回原身份和数据 |

---

## 3. 核心概念模型

```
用户 User ──┬── 成员关系 Membership ──── 群组 Group
            │                              │
            ├── 作息记录 Schedule          └── 邀请码（内嵌于 Group）
            │   （按 用户+日期 唯一）
            └── 排班规则 ShiftRule
                （生成 Schedule 的模板）
```

### 3.1 作息状态（Status）

| 值 | 名称 | 语义 | 归类 | 色值 |
| --- | --- | --- | --- | --- |
| `day` | 白班 | 上午到傍晚 | 上班 | `#F59E0B` 橙 |
| `mid` | 中班 | 中午到夜间 | 上班 | `#3B82F6` 蓝 |
| `night` | 晚班 | 夜间到次日凌晨 | 上班 | `#6366F1` 靛紫 |
| `off` | 休息 | 全天空闲 | 休息 | `#22C55E` 绿 |
| `unset` | 未设置 | 无数据 | 未知 | `#9CA3AF` 灰 |

**设计约定：**

- `unset` **不落库**。数据库里没有记录 = 未设置。避免为每个用户每一天都写一行数据。
- 首页的核心二分是「休息 / 上班 / 未知」三态，班次细分是第二层信息。
- v1 状态集合固定，不支持用户自定义状态（避免群内语义不统一）。

### 3.2 状态可选备注

每条作息记录可附加一条 ≤ 30 字的备注（例："下午 3 点后有空""调休"）。备注在成员详情和日期详情中展示，首页不展示。

---

## 4. 功能需求

优先级：**P0** = v1 必须有；**P1** = v1 尽量有；**P2** = v1 之后。

### 4.1 身份与登录（P0）— 网页版核心改动

网页没有 openid，身份必须自建。采用**无密码 + 设备令牌 + 恢复码**方案。

#### 4.1.1 首次进入（通过邀请链接）

```
1. 朋友在微信群发出链接：https://om.988869.xyz/join/K7M9P2
2. 点开 → 落地页显示："小明 邀请你加入「摸鱼小分队」（5 人）"
3. 输入昵称（≤ 12 字），可选挑一个 emoji 头像
4. 点「加入」→ 后端创建用户 + 成员关系，签发 token
5. 强制展示恢复码页面（见 4.1.3），确认后进入首页
```

#### 4.1.2 身份令牌

| 编号 | 需求 | 说明 |
| --- | --- | --- |
| A-1 | 设备令牌 | 后端签发 JWT（180 天有效期），前端存 `localStorage`。之后每次打开自动登录。 |
| A-2 | 滑动续期 | 每次请求若 token 剩余有效期 < 90 天，响应头 `X-Refresh-Token` 返回新 token，前端静默替换。**只要每半年打开一次就永不掉线**。跨域下该响应头必须在 CORS 的 `exposeHeaders` 中声明，否则前端读不到（见 §5.2）。 |
| A-3 | 无感体验 | 正常使用中用户不会看到任何登录界面。 |

#### 4.1.3 恢复码（换设备的唯一手段）

| 编号 | 需求 | 说明 |
| --- | --- | --- |
| A-4 | 生成 | 创建身份时生成 12 位恢复码，格式 `XXXX-XXXX-XXXX`（Crockford Base32，排除 I/L/O/U 避免混淆），约 60 bit 熵。 |
| A-5 | 强制留存 | 首次创建后**必须**展示一次，提供「复制」按钮并引导截图保存，用户须勾选"我已保存"才能继续。 |
| A-6 | 服务端只存哈希 | 数据库存 SHA-256，不存明文。丢失无法找回，只能重置。 |
| A-7 | 随时重置 | 已登录设备可在「我的」页重置恢复码，生成新码并作废旧码。这是丢码后的补救途径。 |
| A-8 | 用码登录 | 首页/设置页提供「用恢复码登录」入口，输码验证后签发新 token。输入时自动大写、忽略连字符与空格。 |
| A-9 | 防滥用限流 | 按 IP 固定窗口限流：注册 20 次/小时，恢复码校验 30 次/小时。 |

**为什么不做"恢复链接"**：链接可点击、可被转发、会留在聊天记录和浏览器历史里，泄露风险显著高于需要手动输入的码。仅在恢复码展示页提供「保存为图片」，引导用户存到相册或发给自己的微信文件传输助手。

#### 4.1.4 无邀请链接的入口

直接访问根域名且未登录时，展示三个选项：**创建新群组** / **输入邀请码** / **用恢复码登录**。

#### 4.1.5 头像方案

**不做图片上传。** 头像 = `emoji（可选）` + `背景色`：

- 默认：昵称首字 + 按用户 ID 哈希自动分配的背景色（从 12 色板中取）
- 可选：从一组约 40 个 emoji 中挑一个替换首字

理由：图片上传需要引入 R2 对象存储、图片压缩、内容审核，成本和复杂度远超收益。emoji 方案零存储、零延迟、辨识度足够。

#### 4.1.6 其他

| 编号 | 需求 | 说明 |
| --- | --- | --- |
| A-10 | 修改资料 | 「我的」页可改昵称、emoji 头像 |
| A-11 | 注销账号 | 二次确认后清除该用户全部数据 |

### 4.2 群组（P0）

| 编号 | 需求 | 说明 |
| --- | --- | --- |
| G-1 | 创建群组 | 输入群名（≤ 16 字）即可创建，创建者自动成为群主 |
| G-2 | 邀请链接 | `https://om.988869.xyz/join/<邀请码>`，一键复制，可直接发微信 |
| G-3 | 邀请二维码 | 群组页展示邀请二维码，方便当面扫码加入（前端 canvas 生成，不依赖服务端） |
| G-4 | 邀请码手输 | 6 位大写字母数字码（排除易混淆的 0/O/1/I/L），支持手动输入加入 |
| G-5 | 邀请码管理 | 群主可刷新邀请码（旧码立即失效）、设置有效期（永久/7天/24小时） |
| G-6 | 多群组切换 | 一个用户可加入多个群组。首页顶部提供群组切换器 |
| G-7 | 群成员列表 | 展示头像、昵称、角色、加入时间 |
| G-8 | 退出群组 | 成员可退群。本人作息数据保留（可能在别的群用） |
| G-9 | 群主不可直接退群 | 群主退群会留下无人管理的群组，因此要求**先转让群主或解散**。接口明确拒绝并给出提示，不做"自动转让给最早成员"这类隐式行为——归属权变更必须是用户的显式决定 |
| G-10 | 移除成员 | 仅群主，二次确认。群主不能移除自己 |
| G-11 | 转让群主 | 群主可转让身份给其他成员，转让后自己降为普通成员 |
| G-12 | 解散群组 | 仅群主，二次确认，删除群组及成员关系（不删个人作息数据） |

**限额（防滥用 + 保证免费额度）：** 单群 ≤ 30 人；单用户加入 ≤ 10 群、创建 ≤ 5 群。

### 4.3 首页 — 今天（P0）

| 编号 | 需求 | 说明 |
| --- | --- | --- |
| H-1 | 今日总览 | 顶部显示日期、星期、摘要："今天 3 人休息，2 人上班" |
| H-2 | 成员分组 | 按「休息 → 上班 → 未设置」三段分组，休息的人排最前 |
| H-3 | 成员卡片 | 头像 + 昵称 + 状态标签（带色）。自己标注"我" |
| H-4 | 日期切换 | 顶部日期条支持横滑/点击，默认锚定今天，提供「回到今天」按钮 |
| H-5 | 未来几天条 | 展示前 1 天 + 今天 + 未来 13 天（共 15 天），每天下方用小圆点提示"当天休息人数" |
| H-6 | 成员详情 | 点击成员进入详情页，展示近 14 天 + 未来 14 天作息 |
| H-7 | 空状态 | 未加入任何群组时展示引导（创建群组 / 输入邀请码） |
| H-8 | 下拉刷新 | 移动端支持下拉刷新；同时窗口重新获得焦点时自动重新拉取 |

**首页布局：**

```
┌─────────────────────────────┐
│  [摸鱼小分队 ▾]        [＋] │  ← 群组切换 / 加入创建
├─────────────────────────────┤
│  8月20日 周四        [今天] │
│  今天 3 人休息，2 人上班     │
├─────────────────────────────┤
│ 昨 今 五 六 日 一 二 …       │  ← 横向日期条
│ ·· ⦿⦿⦿ · ···· ·· ·         │  ← 每日休息人数点
├─────────────────────────────┤
│  休息 · 3 人                 │
│  🐟 小明   休息              │
│  🌵 小红   休息              │
│  😴 我     休息              │
│                             │
│  上班 · 2 人                 │
│  🍜 阿强   晚班              │
│  ☕ 老王   白班              │
│                             │
│  未设置 · 1 人               │
│  🐈 小李   —                 │
└─────────────────────────────┘
```

### 4.4 我的作息（P0）

| 编号 | 需求 | 说明 |
| --- | --- | --- |
| M-1 | 月历视图 | 默认视图，日历格子内以底色表示状态，可左右翻月 |
| M-2 | 周视图 | 一行 7 天，展示更详细的班次名和备注 |
| M-3 | 单日设置 | 点击某天弹出状态选择面板，选中即保存（乐观更新） |
| M-4 | 批量设置 | 多选模式可连续点选多个日期统一设置。支持「选中整周」「选中本月剩余」快捷选择 |
| M-5 | 清除状态 | 支持恢复为"未设置"（删除记录） |
| M-6 | 备注 | 单日面板内可填 ≤ 30 字备注 |
| M-7 | 历史保护 | 允许修改过去日期（补录），但过去日期 UI 上弱化显示 |

**编辑边界：** 仅允许设置 **今天前 90 天 ~ 今天后 365 天**，防止误操作产生极端数据。

### 4.5 排班规律（P1）

| 编号 | 需求 | 说明 |
| --- | --- | --- |
| R-1 | 预设规律 | 做五休二、做六休一、做四休三、上一休一、上二休二、上三休一（见附录 A） |
| R-2 | 自定义循环 | 定义 2–14 天循环周期，逐位指定状态，例 `[day, day, night, night, off, off]` |
| R-3 | 起始锚点 | 指定"循环第 1 天对应哪个日期" |
| R-4 | 生成范围 | 向后生效至 365 天 |
| R-5 | 手动覆盖优先 | 手动记录**永远优先**，规律重算不覆盖 |
| R-6 | 规律管理 | 查看/停用/更换。停用时询问"是否清除已生成的记录" |

**实现策略（关键架构决策）：采用物化生成而非实时计算。**

启用规律时，后端一次性向 `schedules` 表批量写入未来 365 天记录，标记 `source='rule'`。

- 优点：读路径永远是简单的按日期查表，首页查询不区分手动/规律，性能稳定。
- 代价：单次写入 365 行。D1 免费额度 10 万行写/天，可支撑约 270 次规律设置/天，对本产品规模绰绰有余。
- 规律变更时先删除该用户 `source='rule'` 且日期 ≥ 今天的记录，再重新生成。`source='manual'` 的记录不受影响。

### 4.6 成员详情（P0）

点击首页成员卡片进入，展示：头像、昵称、加入时间、近 14 天作息横条（今天高亮）、未来 14 天作息横条。若对方可见范围为 `busy_only`，班次细分统一显示为"上班"。

### 4.7 隐私与可见范围（P0）

| 编号 | 需求 | 说明 |
| --- | --- | --- |
| P-1 | 群级可见范围 | 针对**每个群组**单独设置自己的作息可见程度 |
| P-2 | 三档可见性 | `full`（显示具体班次）/ `busy_only`（只显示"上班/休息"，隐藏班次与备注）/ `hidden`（对该群完全隐藏，显示为未设置） |
| P-3 | 默认值 | 新加入群组默认 `full` |
| P-4 | 数据隔离 | 用户只能查询自己所在群组的成员数据。每个接口都必须校验"请求者与目标用户是否同群" |
| P-5 | 隐私说明 | 首次进入展示一次："OffMate 只在你加入的群组内共享作息状态。我们不收集手机号、位置或通讯录。" |

**数据隔离是安全红线：** 所有涉及他人数据的接口必须在 SQL 层通过 `memberships` JOIN 限定范围，禁止在应用层过滤。脱敏必须在服务端完成——`busy_only` 用户的具体班次**绝不下发到客户端**。

### 4.8 我的（P0）

昵称与 emoji 头像编辑、我的群组列表（含每群可见范围入口）、排班规律入口、**恢复码管理**、关于/隐私说明、注销账号。

### 4.9 PWA 支持（P1）

| 编号 | 需求 | 说明 |
| --- | --- | --- |
| W-1 | Web App Manifest | 配置名称、图标、主题色、`display: standalone` |
| W-2 | 添加到主屏幕 | 在浏览器中打开时，展示一次引导提示（微信内置浏览器不支持，需引导"用浏览器打开"） |
| W-3 | Service Worker | 缓存静态资源（app shell），实现秒开与弱网可用 |
| W-4 | 离线兜底 | 断网时展示上次缓存的数据 + 明确的"离线"提示条，禁止伪装成在线 |

**Service Worker 只缓存静态资源，不缓存 API 响应**，避免出现"改了状态却显示旧数据"的问题。API 层的缓存交给 TanStack Query 在内存中管理。

### 4.10 P2 待办

- 空闲重合度分析（"本周六 4 人都休息，适合聚会"）
- 发起"约一下"，成员接龙确认
- Web Push 提醒（"明天你和小明都休息"）— iOS 需已添加到主屏幕
- 群级自定义班次名称与颜色
- 数据导出

---

## 5. 技术架构

### 5.1 总体架构

```
┌──────────────────────────────────────────┐
│  浏览器（移动端优先 / PWA）                │
│  React + Vite + TS + Tailwind            │
│  TanStack Query（缓存/乐观更新）          │
└───────┬──────────────────────┬───────────┘
        │ om.988869.xyz        │ omapi.988869.xyz
        │ 加载页面与静态资源     │ 调用 API（跨子域，需 CORS）
        ▼                      ▼
┌──────────────────────────────────────────┐
│      Cloudflare Workers（单一 Worker）     │
│      同时绑定两个 route，按 hostname 分流   │
│                                          │
│  om.988869.xyz/*    → ASSETS 静态资源     │
│                       （SPA fallback）    │
│  omapi.988869.xyz/* → Hono /api/*        │
│      ├ CORS 中间件                        │
│      ├ 认证中间件（JWT）                   │
│      ├ 参数校验（Zod）                     │
│      └ 业务 Service 层                     │
└──────────────────┬───────────────────────┘
                   │ D1 Binding
┌──────────────────▼───────────────────────┐
│           Cloudflare D1 (SQLite)          │
└───────────────────────────────────────────┘
```

**关键架构决策：两个域名，但仍然只部署一个 Worker。**

Worker 同时绑定 `om.988869.xyz/*` 和 `omapi.988869.xyz/*` 两条 route，入口按 `hostname` 分流：命中 API 域名交给 Hono，否则交给 `ASSETS` 静态资源绑定（带 SPA fallback）。

这样保留了单一部署的全部好处——**一条 `wrangler deploy` 同时发布前后端、前后端版本天然一致、不需要维护两套 CI**——同时满足你的域名划分。相比拆成 Pages + Workers 两个项目，少一半配置和一次部署命令。

**代价：跨子域调用需要配置 CORS。** 这是分域名方案唯一的实质成本，具体见 §5.2。

### 5.2 CORS 与跨域细节

前端在 `om.988869.xyz`，API 在 `omapi.988869.xyz`，浏览器视为跨源，必须正确配置 CORS，否则请求会被拦截。

```ts
app.use('/api/*', cors({
  origin: ['https://om.988869.xyz', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Refresh-Token'],
  maxAge: 86400,
}))
```

**三个必须注意的点：**

1. **`exposeHeaders` 不能漏。** §4.1.2 的滑动续期是靠响应头 `X-Refresh-Token` 下发新 token 的。跨域场景下，浏览器默认只允许 JS 读取几个基础响应头，**不显式 expose 的话前端读不到这个头，续期会静默失效**，表现为用户在 180 天后突然掉线且查不出原因。这是分域名方案最容易埋的雷。

2. **`origin` 用白名单，不要用 `*`。** 通配符在带 `Authorization` 头的请求中行为受限，且没有安全收益。

3. **`maxAge: 86400` 缓存预检结果。** 跨域的非简单请求（带 `Authorization` 头就算）每次都会先发一个 OPTIONS 预检。缓存 24 小时后，实际请求数基本等于同域方案，不会额外消耗 Workers 免费额度。

**认证不用 Cookie，用 `Authorization` 头**，所以不需要处理 `credentials: 'include'`、`SameSite`、Cookie 域等一系列跨域 Cookie 的麻烦。这是无密码 token 方案在分域名场景下的额外便利。

### 5.3 API 路径前缀

即使 API 已经独立域名，路径**仍保留 `/api` 前缀**：

- 生产：`https://omapi.988869.xyz/api/auth/register`
- 本地：`http://localhost:5173/api/auth/register`（Vite proxy 转发到 `localhost:8787`）

理由：本地开发时前端通过 Vite proxy 走同源，路径必须和生产一致才能让前端代码零差异；同时保留了将来合并回同域部署的可能性，不用改任何请求路径。前端只需一个 `VITE_API_BASE` 环境变量控制域名部分。

### 5.4 技术选型与理由

| 层 | 选型 | 理由 |
| --- | --- | --- |
| 框架 | React 19 + Vite | 生态成熟，Vite 构建快；无需 SSR（纯内部工具，不需要 SEO） |
| 语言 | TypeScript | 类型安全，前后端可共享类型定义 |
| 样式 | Tailwind CSS | 无运行时开销，构建时裁剪，产物体积小；避免自己维护 CSS 架构 |
| 路由 | React Router | SPA 路由标准方案 |
| 数据层 | TanStack Query | 内置缓存、失效、乐观更新、窗口聚焦重新拉取，正好覆盖 §8.3 全部交互需求 |
| 后端运行时 | Cloudflare Workers | 免费 10 万请求/天，全球边缘，无需运维 |
| 后端框架 | Hono | 为 Workers 设计，~14KB，TS 友好 |
| 数据库 | Cloudflare D1 | 同生态，免费 5GB / 500 万行读/天 / 10 万行写/天 |
| 校验 | Zod | 与 `@hono/zod-validator` 集成，校验与类型共用一份定义 |
| 认证 | 自签 JWT（HS256） | Workers 内用 Web Crypto 实现，无额外依赖 |
| 二维码 | `qrcode` (canvas) | 纯前端生成，不占服务端资源 |
| 部署 | Wrangler CLI | 官方工具，本地开发 + 一键发布 |

**为什么不用 Next.js / Remix**：需要 SSR 的场景不存在（登录后才有内容，无 SEO 需求），引入服务端渲染只会增加 Worker 的 CPU 时间消耗和构建复杂度。纯 SPA 是这个产品的正确形态。

**为什么不用 KV / Durable Objects**：KV 是最终一致性，不适合"设置状态后立刻要看到"；Durable Objects 在 v1 无实时协作需求下属于过度设计。

### 5.5 目录结构

```
offmate/
├── docs/
│   ├── PRD.md
│   └── DEPLOY.md
├── src/                          # 后端（Workers）
│   ├── index.ts                  # 入口：按 hostname 分流（API 域名 → Hono，否则 → ASSETS）
│   ├── types.ts                  # Env 绑定类型（DB / ASSETS / WEB_ORIGIN / API_HOST / JWT_SECRET）
│   ├── middleware/
│   │   ├── cors.ts               # CORS 白名单配置（含 exposeHeaders）
│   │   ├── auth.ts               # JWT 校验 + 滑动续期（下发 X-Refresh-Token）
│   │   ├── rateLimit.ts          # 恢复码/加入接口限流
│   │   └── error.ts              # 统一错误处理
│   ├── routes/
│   │   ├── auth.ts               # 注册、恢复码登录、资料
│   │   ├── groups.ts             # 群组 CRUD、成员
│   │   ├── schedules.ts          # 作息读写
│   │   └── rules.ts              # 排班规律
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── group.service.ts
│   │   ├── schedule.service.ts
│   │   └── rule.service.ts       # 规律展开算法
│   └── lib/
│       ├── jwt.ts
│       ├── date.ts               # 统一时区日期工具
│       ├── id.ts                 # ULID / 邀请码 / 恢复码生成
│       └── response.ts
├── web/                          # 前端
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx               # 路由定义
│   │   ├── pages/
│   │   │   ├── Home.tsx          # 首页-今天
│   │   │   ├── MySchedule.tsx    # 我的作息
│   │   │   ├── MemberDetail.tsx
│   │   │   ├── GroupDetail.tsx
│   │   │   ├── GroupMembers.tsx
│   │   │   ├── Join.tsx          # /join/:code 落地页
│   │   │   ├── Onboarding.tsx    # 未登录入口
│   │   │   ├── Recovery.tsx      # 恢复码展示 / 登录
│   │   │   ├── ShiftRule.tsx
│   │   │   └── Me.tsx
│   │   ├── components/
│   │   │   ├── DateStrip.tsx
│   │   │   ├── MemberCard.tsx
│   │   │   ├── StatusTag.tsx
│   │   │   ├── MonthCalendar.tsx
│   │   │   ├── StatusPicker.tsx   # 底部弹出面板
│   │   │   ├── Avatar.tsx         # emoji + 配色头像
│   │   │   └── TabBar.tsx
│   │   ├── api/                   # 按后端路由分文件
│   │   ├── hooks/                 # useAuth / useGroup / useSchedule
│   │   ├── lib/
│   │   │   ├── request.ts         # fetch 封装 + token + 401 处理
│   │   │   ├── date.ts
│   │   │   └── status.ts          # 状态枚举与配色
│   │   └── types/api.d.ts         # 与后端 Zod schema 对应
│   ├── public/
│   │   ├── manifest.webmanifest
│   │   └── icons/
│   ├── index.html
│   ├── vite.config.ts
│   └── tailwind.config.ts
├── migrations/
│   └── 0001_init.sql
├── wrangler.toml
├── package.json
└── tsconfig.json
```

**前后端类型共享策略：** v1 不引入 monorepo。前端在 `web/src/types/api.d.ts` 手工维护与后端 Zod schema 对应的类型。理由：只有两端、接口约 25 个，引入 pnpm workspace + 共享包的复杂度收益不划算。**若接口超过 40 个再重构为 workspace。**

---

## 6. 数据库设计

### 6.1 ER 概览

```
users 1───N memberships N───1 groups
  │
  ├── 1───N schedules
  └── 1───N shift_rules
```

### 6.2 表结构

```sql
-- 用户（网页版：无 openid，改用恢复码哈希）
CREATE TABLE users (
  id                 TEXT PRIMARY KEY,          -- ULID
  nickname           TEXT NOT NULL,
  avatar_emoji       TEXT,                      -- NULL 则前端用昵称首字
  avatar_color       TEXT NOT NULL,             -- hex，创建时按 id 哈希分配
  recovery_code_hash TEXT NOT NULL UNIQUE,      -- SHA-256(恢复码)，不存明文
  created_at         INTEGER NOT NULL,          -- Unix 秒
  updated_at         INTEGER NOT NULL,
  last_seen_at       INTEGER NOT NULL           -- 用于清理僵尸账号
);
CREATE INDEX idx_users_recovery ON users(recovery_code_hash);

-- 群组
CREATE TABLE groups (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  owner_id      TEXT NOT NULL REFERENCES users(id),
  invite_code   TEXT NOT NULL UNIQUE,      -- 6 位，去除易混字符
  invite_expire INTEGER,                   -- NULL = 永不过期
  member_count  INTEGER NOT NULL DEFAULT 1,-- 冗余计数，避免每次 COUNT
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_groups_invite_code ON groups(invite_code);
CREATE INDEX idx_groups_owner ON groups(owner_id);

-- 成员关系（同时承载群内可见范围）
CREATE TABLE memberships (
  id            TEXT PRIMARY KEY,
  group_id      TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member',  -- owner | member
  visibility    TEXT NOT NULL DEFAULT 'full',    -- full | busy_only | hidden
  joined_at     INTEGER NOT NULL,
  UNIQUE(group_id, user_id)
);
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_group ON memberships(group_id);

-- 作息记录（unset 不落库）
CREATE TABLE schedules (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,             -- 'YYYY-MM-DD'，Asia/Shanghai
  status        TEXT NOT NULL,             -- day | mid | night | off
  note          TEXT,                      -- ≤ 30 字
  source        TEXT NOT NULL DEFAULT 'manual', -- manual | rule
  updated_at    INTEGER NOT NULL,
  UNIQUE(user_id, date)
);
CREATE INDEX idx_schedules_date_user ON schedules(date, user_id);
CREATE INDEX idx_schedules_user_date ON schedules(user_id, date);

-- 排班规律
CREATE TABLE shift_rules (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,             -- preset | custom
  preset_key    TEXT,                      -- 'w5d2' | 'w6d1' | ...
  pattern       TEXT NOT NULL,             -- JSON: ["day","day","off"]
  anchor_date   TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_rules_user ON shift_rules(user_id, active);
```

### 6.3 关键设计决策

**1. 为什么 `date` 用 TEXT 而不是时间戳**

作息是"日历日"概念，不是时间点。`'2026-08-20'` 字符串存储可以：字典序 = 时间序（`BETWEEN` 直接可用）、无时区歧义、SQL 可读性强。全系统统一 **Asia/Shanghai**。

**2. 为什么 `unset` 不落库**

若为每人每天写一行，10 人群一年就是 3650 行，而多数用户不会填满每一天。稀疏存储把数据量压到实际填写量，且"未设置"天然等于"查不到"。代价是首页需 LEFT JOIN 拼接，可接受。

**3. `source` 字段的作用**

区分手动与规律生成，使"手动优先"可实现：重算规律只删 `source='rule'` 的行。用户在规律生成的日期上手动改状态时，该行 `source` 更新为 `'manual'`，从此不再被覆盖。

**4. `member_count` 冗余**

群组列表需显示人数。D1 按读取行数计费，每次 `COUNT(*)` 都是全表扫描。冗余计数字段并在加入/退出时同事务更新，把读放大降到 O(1)。

**5. `recovery_code_hash` 加 UNIQUE 约束**

除了防碰撞，更重要的是**让恢复码登录查询走唯一索引**，单行命中，避免全表扫描。

**6. `last_seen_at` 的用途**

网页版没有平台层的账号体系，会积累"点进来看一眼就再也不来"的僵尸账号。记录最后活跃时间，便于后续清理超过 2 年未活跃且不属于任何群组的账号。v1 只记录不清理。

**7. 为什么不做软删除**

v1 用户量小，数据恢复需求约等于零。硬删除 + `ON DELETE CASCADE` 让逻辑最简单，注销账号时也天然满足隐私合规。

### 6.4 主查询：首页某日群组状态

```sql
SELECT
  u.id, u.nickname, u.avatar_emoji, u.avatar_color,
  m.role, m.visibility,
  s.status, s.note
FROM memberships m
JOIN users u ON u.id = m.user_id
LEFT JOIN schedules s ON s.user_id = m.user_id AND s.date = ?2
WHERE m.group_id = ?1
ORDER BY m.joined_at ASC;
```

单次查询拿到全部成员及当日状态。`visibility` 脱敏在应用层完成（`busy_only` → 班次归并为 `work`；`hidden` → 状态置空）。

**日期条的休息人数统计**（一次查 15 天）：

```sql
SELECT s.date, COUNT(*) AS off_count
FROM memberships m
JOIN schedules s ON s.user_id = m.user_id
WHERE m.group_id = ?1
  AND s.date BETWEEN ?2 AND ?3
  AND s.status = 'off'
GROUP BY s.date;
```

---

## 7. API 设计

### 7.1 通用约定

- Base URL：`https://omapi.988869.xyz/api`（前端在 `om.988869.xyz`，跨子域，见 §5.2）
- 所有请求/响应为 `application/json`，UTF-8
- 除注册/恢复/预览接口外，全部需要 `Authorization: Bearer <token>`

**统一响应格式：**

```jsonc
{ "ok": true, "data": { ... } }
{ "ok": false, "error": { "code": "GROUP_FULL", "message": "群组人数已满" } }
```

**错误码表：**

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | `INVALID_PARAM` | 参数校验失败 |
| 401 | `UNAUTHORIZED` | token 缺失/过期，前端跳转登录入口 |
| 401 | `RECOVERY_INVALID` | 恢复码错误 |
| 403 | `FORBIDDEN` | 无权限（非群主 / 非群成员） |
| 404 | `NOT_FOUND` | 资源不存在 |
| 404 | `INVITE_INVALID` | 邀请码无效或已过期 |
| 409 | `ALREADY_MEMBER` | 已是群成员 |
| 409 | `GROUP_FULL` | 群组已满 |
| 409 | `LIMIT_EXCEEDED` | 超出创建/加入数量限制 |
| 429 | `RATE_LIMITED` | 请求过快 |
| 500 | `INTERNAL` | 服务端异常 |

### 7.2 接口清单

#### 认证与身份

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| POST | `/auth/register` | 否 | 创建身份 `{ nickname, avatarEmoji?, inviteCode? }` → `{ token, user, recoveryCode }` |
| POST | `/auth/recover` | 否 | 恢复码登录 `{ recoveryCode }` → `{ token, user }`（限流） |
| GET | `/auth/me` | 是 | 当前用户 + 群组列表 |
| PATCH | `/auth/me` | 是 | 更新 `{ nickname?, avatarEmoji? }` |
| POST | `/auth/recovery/reset` | 是 | 重置恢复码 → `{ recoveryCode }` |
| DELETE | `/auth/me` | 是 | 注销账号，级联删除全部数据 |

> `recoveryCode` **仅在 register 和 reset 的响应中出现一次**，之后任何接口都不再返回。

#### 群组

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| GET | `/groups` | 是 | 我加入的群组列表 |
| POST | `/groups` | 是 | 创建 `{ name }` |
| GET | `/groups/:id` | 是 | 群组详情（含邀请码、邀请链接） |
| PATCH | `/groups/:id` | 是 | 改名（仅群主） |
| DELETE | `/groups/:id` | 是 | 解散（仅群主） |
| POST | `/groups/join` | 是 | 加入 `{ inviteCode }` |
| POST | `/groups/:id/leave` | 是 | 退出 |
| GET | `/groups/:id/members` | 是 | 成员列表 |
| DELETE | `/groups/:id/members/:userId` | 是 | 移除成员（仅群主） |
| POST | `/groups/:id/transfer` | 是 | 转让群主 `{ userId }` |
| POST | `/groups/:id/invite/refresh` | 是 | 刷新邀请码 `{ expireIn? }`（仅群主） |
| PATCH | `/groups/:id/visibility` | 是 | 设置我在该群的可见范围 |
| GET | `/groups/preview?code=XXXXXX` | **否** | 邀请落地页预览：群名、人数、邀请人昵称（限流） |

#### 作息

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/schedules/group/:groupId?date=YYYY-MM-DD` | 群组某日全员状态（首页主接口） |
| GET | `/schedules/group/:groupId/summary?from=&to=` | 区间每日休息人数（日期条） |
| GET | `/schedules/user/:userId?groupId=&from=&to=` | 某成员区间作息（需同群校验） |
| GET | `/schedules/me?from=&to=` | 我的区间作息 |
| PUT | `/schedules/me/:date` | 设置某天 `{ status, note? }` |
| DELETE | `/schedules/me/:date` | 清除某天 |
| POST | `/schedules/me/batch` | 批量设置 `{ dates[], status, note? }`，单次 ≤ 60 天 |

#### 排班规律

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/rules/me` | 当前规律 |
| PUT | `/rules/me` | 设置/更新，触发重新物化 |
| DELETE | `/rules/me?clearGenerated=true` | 停用，可选清除已生成记录 |
| GET | `/rules/presets` | 预设模板列表（静态） |

### 7.3 关键接口详例

**注册（首次进入）**

```
POST /api/auth/register
{ "nickname": "小明", "avatarEmoji": "🐟", "inviteCode": "K7M9P2" }
```

```jsonc
{
  "ok": true,
  "data": {
    "token": "eyJhbGciOi...",
    "recoveryCode": "K7M9-P2X4-B8QR",   // 仅此一次返回
    "user": { "id": "01H...", "nickname": "小明", "avatarEmoji": "🐟", "avatarColor": "#F59E0B" },
    "joinedGroup": { "id": "01H...", "name": "摸鱼小分队" }
  }
}
```

`inviteCode` 可选：若携带则注册后立即加入该群；若不携带（从"创建群组"入口进来）则只创建身份。

**邀请码失效时的降级**：如果携带的邀请码已过期或被刷新，注册**仍然成功**，只是 `joinedGroup` 返回 `null`。理由是身份创建与入群是两件事——用户已经填完昵称了，因为一个过期的码就让整个注册失败并丢掉输入，是把系统的问题转嫁给用户。进去之后再手动加入即可。

**首页主接口**

```
GET /api/schedules/group/01H.../?date=2026-08-20
```

```jsonc
{
  "ok": true,
  "data": {
    "date": "2026-08-20",
    "groupId": "01H...",
    "summary": { "off": 3, "work": 2, "unset": 1 },
    "members": [
      {
        "userId": "01H...",
        "nickname": "小明",
        "avatarEmoji": "🐟",
        "avatarColor": "#F59E0B",
        "role": "member",
        "isMe": false,
        "status": "off",       // day|mid|night|off|work|unset
        "note": "调休"          // visibility=busy_only 时恒为 null
      }
    ]
  }
}
```

`status` 中的 `work` 是 `busy_only` 下的脱敏结果——**脱敏在服务端完成，客户端拿不到原始班次**。

**批量设置**

```
POST /api/schedules/me/batch
{ "dates": ["2026-08-21", "2026-08-22"], "status": "off" }
```

服务端用 `D1.batch()` 在单次事务中执行多条 `INSERT ... ON CONFLICT(user_id, date) DO UPDATE`，保证原子性。

### 7.4 认证流程

```
新用户                        Worker                      D1
  │                             │                          │
  ├─ 点开 /join/K7M9P2 ────────►│                          │
  ├─ GET /groups/preview ──────►├─ 查群组 ────────────────►│
  │◄── { 群名, 人数, 邀请人 } ──┤                          │
  ├─ 填昵称，POST /auth/register►│                          │
  │                             ├─ 生成 ULID + 恢复码       │
  │                             ├─ SHA-256(恢复码)          │
  │                             ├─ INSERT users            ─►│
  │                             ├─ INSERT memberships      ─►│
  │                             ├─ 签发 JWT (180d)          │
  │◄─ { token, recoveryCode } ──┤                          │
  ├─ localStorage 存 token      │                          │
  ├─ 强制展示恢复码，确认已保存  │                          │
  └─ 后续请求带 Bearer token ──►│                          │
```

**安全要点：**

1. `JWT_SECRET` 通过 `wrangler secret put` 存储，**绝不写入 `wrangler.toml` 或提交仓库**。
2. JWT payload 只放 `{ sub: userId, iat, exp }`。
3. 恢复码服务端只存 SHA-256，明文仅在生成时返回一次。
4. 恢复码校验、注册、预览接口按 IP 限流，防爆破与批量刷号。
5. 401 时前端清除本地 token 并跳转登录入口，**不自动重试**（网页版没有静默重登的手段）。

---

## 8. 前端设计

### 8.1 路由结构

```
/                        首页（今天）           需登录
/schedule                我的作息               需登录
/me                      我的                   需登录
/member/:userId          成员详情               需登录
/group/:id               群组管理               需登录
/group/:id/members       成员管理               需登录
/group/create            创建群组               需登录
/join/:code              邀请落地页             免登录 ← 分享链接入口
/welcome                 未登录引导页           免登录
/recovery                恢复码登录             免登录
/rule                    排班规律               需登录
```

底部 TabBar 三项：**今天 / 我的作息 / 我**。

### 8.2 视觉规范

**布局：移动端优先。** 桌面端限宽 480px 居中，两侧留白，不做独立的桌面布局（用户 95% 从微信点链接进来，都是手机）。

**配色（状态色是核心视觉语言）**

| 用途 | 色值 |
| --- | --- |
| 休息 off | `#22C55E` 绿（最醒目，是用户最想看到的信息） |
| 白班 day | `#F59E0B` 橙 |
| 中班 mid | `#3B82F6` 蓝 |
| 晚班 night | `#6366F1` 靛紫 |
| 未设置 | `#9CA3AF` 灰 |
| 主文字 | `#1F2328` |
| 次文字 | `#6B7280` |
| 页面背景 | `#F5F6F8` |
| 卡片 | `#FFFFFF`，圆角 16px，弱阴影 |

全部定义为 Tailwind theme token，便于后续做深色模式。

**无障碍：** 状态不能只靠颜色区分，每个状态标签必须同时带文字（"休息""白班"），保证色觉障碍用户可用。

**尺寸：** 主标题 18px / 正文 14px / 辅助 12px。触控目标最小 44×44px。

**安全区适配：** 底部 TabBar 需处理 iPhone 刘海屏底部安全区（`env(safe-area-inset-bottom)`）。

### 8.3 交互原则

1. **乐观更新**：设置状态时立即更新 UI，后台发请求；失败则回滚并提示。用 TanStack Query 的 `onMutate` / `onError` 实现。
2. **缓存优先渲染**：TanStack Query 的 `staleWhileRevalidate` 让二次进入先渲染缓存再刷新，消除白屏。
3. **窗口聚焦重新拉取**：用户切回标签页时自动刷新（`refetchOnWindowFocus`），保证数据不陈旧。
4. **零弹窗打断**：除破坏性操作（解散群组、移除成员、注销账号、重置恢复码）外，不使用确认弹窗。
5. **失败可见**：网络错误显示明确文案与重试按钮，禁止静默失败。
6. **单手可达**：主要操作按钮放在屏幕下半部分。

### 8.4 关键组件

| 组件 | 职责 | 关键点 |
| --- | --- | --- |
| `DateStrip` | 横向 15 天日期条 | 横向滚动容器，默认滚动定位到今天；每项下渲染休息人数点（>3 显示"3+"） |
| `MemberCard` | 成员行 | 头像 + 昵称 + 状态标签右对齐 |
| `StatusTag` | 状态色标签 | 纯展示，接收 status 枚举输出色 + 文字 |
| `MonthCalendar` | 月历 | 6×7 固定网格避免高度跳变；支持多选模式 |
| `StatusPicker` | 底部弹出面板 | 5 个大按钮 + 备注输入；点遮罩关闭；需处理移动端键盘顶起 |
| `Avatar` | emoji/首字头像 | 无 emoji 时取昵称首字 + `avatarColor` 背景 |
| `TabBar` | 底部导航 | 三项，处理底部安全区 |

### 8.5 状态管理

**不引入 Redux/Zustand。** 分两类：

- **服务端状态**（用户信息、群组、作息）→ 全部交给 TanStack Query，它本身就是缓存层。
- **客户端状态**（当前选中群组 ID、当前查看日期）→ React Context + `localStorage` 持久化。

理由：这个产品几乎所有状态都是服务端状态，TanStack Query 已经覆盖。额外引入状态库属于过度设计。

### 8.6 请求层

`web/src/lib/request.ts` 统一封装 fetch：

- 自动注入 `Authorization` 头
- 读取 `X-Refresh-Token` 响应头并静默替换本地 token（滑动续期）
- 统一解包 `{ ok, data }`，`ok: false` 时 throw 携带 code 的错误
- 401 → 清除 token → 跳转 `/welcome`
- baseURL 由 `VITE_API_BASE` 控制：开发环境留空（走 Vite proxy，同源）；生产为 `https://omapi.988869.xyz`

---

## 9. 非功能需求

| 维度 | 目标 |
| --- | --- |
| 首屏可交互（二次访问，SW 缓存命中） | < 1s |
| 首屏可交互（首次访问，4G） | < 2.5s |
| JS 产物体积（gzip） | < 200KB |
| API P95 响应 | < 300ms |
| 可用性 | 依赖 Cloudflare SLA，无自建组件 |
| 成本 | 月度 0 元（严格控制在免费额度内） |

**免费额度余量测算（100 活跃用户，每人每天打开 3 次）：**

| 资源 | 免费额度 | 预估用量 | 余量 |
| --- | --- | --- | --- |
| Workers 请求 | 100,000/天 | ~2,000/天 | 98% |
| D1 读行数 | 5,000,000/天 | ~30,000/天 | 99.4% |
| D1 写行数 | 100,000/天 | ~2,000/天 | 98% |
| D1 存储 | 5GB | < 50MB | 99% |
| 静态资源请求 | 不计费 | — | — |

规律物化是唯一的写入大户（365 行/次），但属于低频操作，无风险。

跨域带来的 OPTIONS 预检请求会计入 Workers 请求数，但 `maxAge: 86400` 让每个用户每天最多触发一次预检，按 100 用户计约 +100 请求/天，相对 10 万额度可忽略。

---

## 10. 风险与应对

### 10.1 国内访问 Cloudflare 的稳定性（中风险）

**问题**：Cloudflare 免费版在国内的访问质量不稳定，高峰期可能变慢或偶发连接失败。

**应对**：
- 绑定自有域名（而非 `*.workers.dev`），连通性优于默认域名
- Service Worker 缓存 app shell，网络不佳时仍能秒开并展示上次数据
- 明确的离线提示条，让用户知道是网络问题而非产品故障
- 若长期不可接受，备选是迁到国内云 + 备案，届时后端 Hono 代码可基本复用（换 D1 为其他 SQLite/MySQL）

### 10.2 微信内置浏览器的身份隔离（高风险，必须处理）

**问题**：这是网页版最容易踩的坑。

微信内置浏览器的 `localStorage` 与系统浏览器**完全隔离**。同一个人：

- 在微信里点链接进来 → 创建了身份 A
- 后来在 Safari 里打开同一个网址 → 是全新访客，会被引导创建身份 B
- 结果：群里出现两个"小明"

此外，用户清理微信存储空间会清掉 localStorage，身份直接丢失。

**应对**：

1. **恢复码是产品级的必需品，不是可选项**——这正是 §4.1.3 强制展示恢复码的原因。
2. 未登录访客访问 `/join/:code` 且该群已有成员时，落地页除「加入」外，同时显著展示**「我已经加入过，用恢复码登录」**入口。
3. 在微信内打开时，检测 UA 并在「我的」页展示提示：*"在浏览器中打开可添加到桌面，体验更好。切换后请用恢复码登录，避免创建重复账号。"*
4. 群主可在成员管理页移除重复账号，作为兜底。

### 10.3 无密码方案的账号安全（低风险，可接受）

**问题**：token 存 localStorage，若设备被他人接触即可看到数据；恢复码泄露等于账号泄露。

**评估**：本产品数据敏感度低（只有班次信息），使用者是熟人小圈子，威胁模型简单。为几个朋友的工具引入两步验证属于过度设计。

**应对**：提供恢复码重置；注销账号可彻底删数据（已验证外键级联生效，注销会连带清掉作息与成员关系）。

**关于限流阈值**：按 IP 限流在国内移动网络下容易误伤——运营商 CGNAT 让大量用户共享同一出口 IP，阈值定太低会把同小区的正常用户一起挡住。因此阈值放宽到注册 20 次/小时、恢复码 30 次/小时。这个限流防的是"脚本批量刷接口消耗 D1 额度"，**不是防恢复码爆破**：60 bit 熵的穷举在数学上本来就不可行，不需要靠限流兜底。

### 10.4 僵尸账号累积（低风险）

无平台账号体系，会积累"点进来看一眼就再不来"的空账号。用 `last_seen_at` 记录，v1 只记录不清理，数据量可忽略。

---

## 11. 安全与合规

| 项 | 措施 |
| --- | --- |
| 数据隔离 | 所有跨用户查询必须 JOIN `memberships` 限定群组；中间件强制校验群成员身份 |
| 脱敏位置 | `busy_only` / `hidden` 的脱敏在服务端完成，敏感数据不下发 |
| 密钥管理 | `JWT_SECRET` 用 `wrangler secret` 管理，不入库不入仓 |
| 传输安全 | 全程 HTTPS（Cloudflare 自动签发证书） |
| 最小收集 | 只收集昵称。**不收集手机号、邮箱、位置、通讯录** |
| 数据可删除 | 提供注销入口，级联删除全部个人数据 |
| 防滥用 | 注册/恢复/预览接口按 IP 限流；邀请码可刷新失效；群组与成员数量硬上限 |
| 输入校验 | 全部入参经 Zod 校验；文本限长；日期范围限制在 ±1 年 |
| XSS | React 默认转义；禁用 `dangerouslySetInnerHTML` |

**关于 ICP 备案**：服务部署在 Cloudflare（境外），`988869.xyz` 只要 NS 指向 Cloudflare 即可直接使用，**不需要 ICP 备案**。这正是放弃小程序方案换来的主要收益之一。

**关于 CORS**：`origin` 必须是白名单（`om.988869.xyz` + 本地开发地址），禁止使用 `*`。API 域名 `omapi.988869.xyz` 不托管任何页面，只响应 `/api/*`，其余路径一律 404。

---

## 12. 里程碑

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| **M0 骨架** | 项目初始化、Vite + Tailwind、wrangler 配置（含 assets）、D1 建库、请求层 | 已完成 |
| **M1 身份** | 注册、恢复码、JWT、滑动续期、资料编辑 | 已完成 · 30 项断言 |
| **M2 群组** | 创建/加入/成员/邀请链接/二维码/落地页 | 已完成 · 44 项断言 |
| **M3 首页** | 今日总览、日期条、成员卡片、成员详情、单日设置 | 已完成 · 40 项断言 |
| **M4 作息编辑** | 月历、周视图、多选批量设置、快捷选择 | 已完成 |
| **M5 隐私与管理** | 可见范围三档、退群、移除、转让、解散、注销 | 已完成（并入 M2/M3） |
| **M6 排班规律** | 预设 + 自定义循环 + 物化生成 + 手动优先 | 已完成 · 28 项断言 |
| **M7 PWA 与上线** | TabBar、manifest、Service Worker、离线兜底、隐私说明、部署文档 | 已完成 |

合计 142 项自动化断言，`npm run smoke` 可一次跑完。

相比小程序方案，省去了备案、域名白名单、平台审核三个环节，上线从"提审等 1–3 天"变成"部署即上线"。

---

## 13. 部署与配置要点（详见 `docs/DEPLOY.md`）

### 13.1 需要准备的东西

1. Cloudflare 账号（免费版即可）
2. 域名 `988869.xyz` 的 NS 指向 Cloudflare（即该域名已作为 zone 添加到 Cloudflare 账号下）

**不再需要**：微信小程序 AppID/AppSecret、ICP 备案、服务器域名白名单、平台审核。

### 13.2 本地开发

```bash
npm i
npx wrangler d1 create offmate-db          # 记下 database_id 填入 wrangler.toml
npx wrangler d1 migrations apply offmate-db --local
npm run dev        # 并行启动 Vite(5173) 与 wrangler dev(8787)，Vite 代理 /api → 8787
```

浏览器打开 `http://localhost:5173`。本地开发走 Vite proxy，前后端同源，**不触发 CORS**。

真机调试：用手机浏览器访问局域网 IP（如 `http://192.168.1.5:5173`），`vite.config.ts` 中已设置 `server.host = true`。

**本地环境的三个已验证限制**（都源于 `wrangler dev` 的代理层，不是配置错误，排查时不要误判）：

| 现象 | 原因 | 影响 |
| --- | --- | --- |
| 响应头 `Access-Control-Allow-Origin` 的值被改写为 `http://127.0.0.1:8787` | wrangler 的 ProxyWorker 会重写 URL 类响应头，使代理对浏览器透明 | 本地看到的值不可信，**CORS 是否配对必须在生产验证**。但白名单匹配逻辑本身可测：给一个不在白名单的 Origin，该响应头应完全不出现 |
| Worker 中 `new URL(c.req.url).hostname` 恒为 `om.988869.xyz` | wrangler dev 用 `wrangler.toml` 里**第一条 route** 的域名模拟本地 hostname，与实际 Host 头无关 | `hostname === API_HOST` 的 404 分支在本地永远走不到。要验证该逻辑，用 `wrangler dev --var API_HOST:om.988869.xyz` 临时覆盖 |
| 本地测不出跨域问题 | Vite proxy 让前后端同源 | 见 §13.6 的上线验证清单 |

`/api/health` 返回的 `host` 字段就是 Worker 观测到的 hostname，部署后用它确认两个域名的 route 都绑对了。

### 13.3 部署

```bash
npx wrangler secret put JWT_SECRET          # 用 openssl rand -base64 32 生成
npx wrangler d1 migrations apply offmate-db --remote
npm run build                               # Vite 构建到 dist/
npx wrangler deploy                         # 一条命令同时发布静态资源 + Worker
```

### 13.4 `wrangler.toml` 关键配置

```toml
name = "offmate"
main = "src/index.ts"
compatibility_date = "2026-01-01"

[assets]
directory = "./dist"
binding = "ASSETS"
not_found_handling = "single-page-application"   # SPA 路由 fallback

[vars]
WEB_ORIGIN = "https://om.988869.xyz"             # 后端生成邀请链接时使用
API_HOST    = "omapi.988869.xyz"                 # 入口按此 hostname 分流

[[d1_databases]]
binding = "DB"
database_name = "offmate-db"
database_id = "<填入创建后返回的 id>"

# 前端域名：命中后走静态资源
[[routes]]
pattern = "om.988869.xyz/*"
zone_name = "988869.xyz"

# 后端域名：命中后走 Hono
[[routes]]
pattern = "omapi.988869.xyz/*"
zone_name = "988869.xyz"
```

两处需要解释：

- **`not_found_handling = "single-page-application"`** 是 SPA 能正常工作的关键。它让 `/schedule`、`/join/K7M9P2` 这类前端路由在被直接访问或刷新时回落到 `index.html` 而不是返回 404。少了这一行，用户从微信点开的邀请链接会直接白屏。
- **`WEB_ORIGIN`** 是后端拼接邀请链接（`https://om.988869.xyz/join/<code>`）时用的。后端跑在 API 域名上，无法自己推断出前端域名，必须显式配置。它不是密钥，放 `[vars]` 即可，不用 `wrangler secret`。

### 13.5 域名绑定

在 Cloudflare DNS 中为 `988869.xyz` 添加**两条**记录，都开启橙色云代理（Proxied）：

| 类型 | 名称 | 内容 | 代理 |
| --- | --- | --- | --- |
| A | `om` | `192.0.2.1` | 已代理 |
| A | `omapi` | `192.0.2.1` | 已代理 |

`192.0.2.1` 是 RFC 5737 保留的测试用占位 IP，流量实际由 `wrangler.toml` 中的 routes 接管，不会真的发往这个地址。**必须开启橙色云**，否则请求不经过 Cloudflare 网络，Worker route 不会生效。

SSL/TLS 加密模式设为 **Full**。

### 13.6 部署后必须验证的三件事

本地开发同源，测不出跨域问题，因此上线后要专门验证：

1. `https://om.988869.xyz` 能正常打开，且**刷新任意子路由**（如 `/schedule`）不 404
2. 浏览器 DevTools 的 Network 面板中，对 `omapi.988869.xyz` 的请求**没有 CORS 报错**
3. 登录后的响应中，**`X-Refresh-Token` 响应头能被前端 JS 读到**（这一条最容易漏，见 §5.2）

---

## 14. 开放问题

| # | 问题 | 建议 |
| --- | --- | --- |
| 1 | 晚班跨天如何计算？ | v1 简化为"晚班归属于开始日"，不做跨天拆分 |
| 2 | 是否需要"临时有空"这种即时状态？ | v2 考虑，v1 用备注字段替代 |
| 3 | 是否需要跨群组看到同一个人的作息？ | 已天然支持：作息数据属于用户，可见范围按群配置 |

---

## 附录 A：预设排班模板

| key | 名称 | pattern | 说明 |
| --- | --- | --- | --- |
| `w5d2` | 做五休二 | 周一至周五白班，周六日休息 | **特殊：锚定星期而非循环** |
| `w6d1` | 做六休一 | `[day×6, off]` | 7 天循环 |
| `w4d3` | 做四休三 | `[day×4, off×3]` | 7 天循环 |
| `d1r1` | 上一休一 | `[day, off]` | 2 天循环 |
| `d2r2` | 上二休二 | `[day, day, off, off]` | 4 天循环 |
| `d3r1` | 上三休一 | `[day, day, day, off]` | 4 天循环 |
| `custom` | 自定义 | 用户定义 2–14 天循环 | |

`w5d2` 因锚定星期，实现上单独处理：不依赖 `anchor_date`，直接按 `dayOfWeek` 判断。

## 附录 B：日期与时区规则

- 全系统日期字符串格式：`YYYY-MM-DD`
- 时区固定 **Asia/Shanghai (UTC+8)**，不做多时区支持
- 服务端"今天"：`new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)`
- 客户端同样按 UTC+8 计算，**不使用设备本地时区**，避免用户出国时数据错乱
- 跨零点场景：晚班用户凌晨 2 点打开，看到的"今天"是新的一天，符合日历直觉，不做特殊处理

## 附录 C：恢复码规格

- 字符集：Crockford Base32 去除 `I / L / O / U`（避免与 1/0 混淆及拼出不雅词）
- 长度：12 位，展示为 `XXXX-XXXX-XXXX`
- 熵：约 60 bit，配合限流足以抵抗爆破
- 输入时自动大写、自动忽略连字符与空格，容错用户手输
- 服务端存 SHA-256，明文仅在生成时返回一次
