# 部署指南

从零把 OffMate 部署到 Cloudflare，绑定 `om.988869.xyz` 与 `omapi.988869.xyz`。

前后端是**同一个 Worker**：`/api/*` 交给 Hono，其余路径返回静态资源。一条命令同时发布两端，不需要分别部署。

---

## 最简流程（推荐）

总共三条命令加一次网页操作。

### 第 1 步 · 授权（一次性）

```bash
npx wrangler login
```

浏览器会自动打开 Cloudflare 的授权页面，点 **Allow** 即可。之后这台电脑就记住了，不用再登录。

### 第 2 步 · 一键部署

```bash
npm run setup:cloudflare
```

这条命令会自动完成：创建 D1 数据库 → 把数据库 ID 写进配置 → 建表 → 构建前端 → 部署 Worker → 生成并设置签名密钥。

**中途失败可以直接重跑**，已完成的步骤会自动跳过，不会重复创建。

### 第 3 步 · 在网页上配 DNS

这一步必须手动，因为涉及你域名的解析记录。

打开 [Cloudflare 控制台](https://dash.cloudflare.com) → 选择 `988869.xyz` → 左侧 **DNS** → **记录** → 添加记录，加两条：

| 类型 | 名称 | IPv4 地址 | 代理状态 |
| --- | --- | --- | --- |
| A | `om` | `192.0.2.1` | **已代理**（橙色云朵） |
| A | `omapi` | `192.0.2.1` | **已代理**（橙色云朵） |

两个要点：

- `192.0.2.1` 是保留的占位地址，真实流量由 Worker 接管，不会真的发到那个 IP
- **橙色云朵必须打开**。灰色云朵意味着请求不经过 Cloudflare 网络，Worker 不会生效，表现为域名能解析但页面打不开

然后进 **SSL/TLS** → **概述**，把加密模式设为 **Full**。

### 第 4 步 · 验证

DNS 通常一两分钟生效。然后：

```bash
npm run verify:deploy
```

它会自动检查前端可访问性、SPA 路由回退、数据库连接、域名分流、CORS 配置，并真实走一遍注册建群流程（测试数据会自动清理）。

任何一项失败都会给出具体原因和修复方向，不需要自己看日志。

全部通过后，把 `https://om.988869.xyz` 发给朋友就能用了。

---

## 后续更新

改完代码后重新发布：

```bash
npm run deploy
```

数据库结构有变动时（`migrations/` 下新增了文件）：

```bash
npm run db:init:remote
```

---

## 手动分步（了解细节或排查问题时看）

### 1. 前置准备

| 项 | 说明 |
| --- | --- |
| Cloudflare 账号 | 免费版即可 |
| 域名 `988869.xyz` | NS 需指向 Cloudflare，即该域名已作为 zone 添加到你的账号下 |

**不需要** ICP 备案——服务运行在 Cloudflare 的境外节点上。这正是放弃小程序方案换来的主要收益。

### 2. 创建数据库

```bash
npx wrangler d1 create offmate-db
```

命令会输出一段配置，其中的 `database_id` 填进 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "offmate-db"
database_id = "把这里的 PLACEHOLDER 换成真实 id"
```

### 3. 建表

```bash
npx wrangler d1 migrations apply offmate-db --remote
```

注意 `--remote`。不加这个参数操作的是本地开发库。

验证：

```bash
npx wrangler d1 execute offmate-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

应看到 `users`、`groups`、`memberships`、`schedules`、`shift_rules`、`rate_limits`。

### 4. 部署

```bash
npm run deploy
```

这条命令做三件事：构建前端到 `dist/`、检查产物样式、上传静态资源与 Worker。

### 5. 设置密钥

```bash
# 生成一个足够强的随机密钥
openssl rand -base64 32

npx wrangler secret put JWT_SECRET
# 粘贴上面生成的值
```

`JWT_SECRET` 用于签发身份令牌，**绝不能写进 `wrangler.toml` 或提交到仓库**。

一旦更换这个密钥，所有已登录用户的令牌会立即失效，他们需要用恢复码重新登录。

---

本地开发走 Vite proxy、前后端同源，**跨域相关的问题在本地一个都测不出来**。以下四项只能在生产验证：

**① 前端可访问，且刷新子路由不 404**

```bash
curl -I https://om.988869.xyz/schedule
```

期望 `200` 且 `content-type: text/html`。如果返回 404，说明 `wrangler.toml` 里的 `not_found_handling = "single-page-application"` 没生效——微信里点开的邀请链接会直接白屏。

**② 后端可访问，两个域名各归其位**

```bash
curl https://omapi.988869.xyz/api/health
```

期望返回 JSON，其中 `db` 为 `connected`、`host` 为 `omapi.988869.xyz`。

`host` 字段就是 Worker 实际观测到的域名，用它确认两条 route 都绑对了。

```bash
curl -I https://omapi.988869.xyz/schedule
```

期望 `404`——API 域名不托管页面。

**③ CORS 配对**

```bash
curl -i -X OPTIONS https://omapi.988869.xyz/api/health \
  -H "Origin: https://om.988869.xyz" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization"
```

期望响应头包含：

```
Access-Control-Allow-Origin: https://om.988869.xyz
Access-Control-Expose-Headers: X-Refresh-Token
```

**`Access-Control-Expose-Headers` 这一条最容易漏，后果也最隐蔽。** 登录令牌的滑动续期靠 `X-Refresh-Token` 响应头下发，跨域场景下如果没有显式 expose，浏览器不允许 JS 读取该头，续期会静默失效——表现为用户在半年后突然掉线，且完全查不出原因。

**④ 完整走一遍真实流程**

用手机浏览器打开 `https://om.988869.xyz`，创建身份 → 保存恢复码 → 建群 → 复制邀请链接 → 换一台设备或无痕窗口打开链接加入。

特别要在**微信里打开一次邀请链接**，那是这个产品最主要的入口。

---

## 日常运维

**查看实时日志**

```bash
npx wrangler tail
```

**查询线上数据**

```bash
npx wrangler d1 execute offmate-db --remote --command "SELECT COUNT(*) FROM users"
```

**回滚**

Cloudflare 控制台 → Workers & Pages → offmate → Deployments，选择历史版本回滚。

---

## 免费额度

按 100 名活跃用户、每人每天打开 3 次估算：

| 资源 | 免费额度 | 预估用量 | 余量 |
| --- | --- | --- | --- |
| Workers 请求 | 100,000/天 | ~2,000/天 | 98% |
| D1 读行数 | 5,000,000/天 | ~30,000/天 | 99% |
| D1 写行数 | 100,000/天 | ~2,000/天 | 98% |
| D1 存储 | 5 GB | < 50 MB | 99% |

唯一的写入大户是排班规律——每次设置会物化 365 行。即便如此，免费额度也能支撑约 270 次/天的规律设置，远超实际需要。

---

## 常见问题

**页面能打开但所有接口报错**

先看 `curl https://omapi.988869.xyz/api/health`。如果它正常而浏览器里失败，基本可以断定是 CORS，回到第 7 节的第 ③ 项检查。

**用户反馈"突然要重新登录"**

检查 `X-Refresh-Token` 是否在 `exposeHeaders` 中（第 7 节 ③）。另外确认没有重新设置过 `JWT_SECRET`——换密钥会让所有令牌立即失效。

**国内访问慢或偶发失败**

Cloudflare 免费版在国内的连通性本就不稳定。已有的缓解手段：绑定自有域名（优于 `workers.dev`）、Service Worker 缓存 app shell 让弱网也能秒开、断网时显示明确的离线提示条。

如果长期不可接受，后端 Hono 代码迁到国内云基本可以复用，主要工作是把 D1 换成其他 SQLite/MySQL 实现，以及走一遍 ICP 备案。

**群里出现同一个人的两个账号**

微信内置浏览器与系统浏览器的存储互相隔离，同一个人从不同入口进来会被当成新访客。让他用恢复码登录而不是重新创建身份；已经产生的重复账号由群主在成员管理页移除。
