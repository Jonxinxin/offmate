# OffMate

朋友作息共享工具 —— 打开就知道今天谁有空。

产品与技术设计见 [`docs/PRD.md`](docs/PRD.md)。

| | |
| --- | --- |
| 前端 | React 19 + Vite + TypeScript + Tailwind v4 |
| 后端 | Cloudflare Workers + Hono |
| 数据库 | Cloudflare D1 (SQLite) |
| 前端域名 | `om.988869.xyz` |
| 后端域名 | `omapi.988869.xyz` |

前后端是**同一个 Worker**：`/api/*` 交给 Hono，其余路径走静态资源。一条 `wrangler deploy` 同时发布两端。

部署步骤见 [`docs/DEPLOY.md`](docs/DEPLOY.md)。

## 功能

- **首页「今天」**：群内成员按休息 / 上班 / 未设置分组，休息的人排最前；日期条可切换前后两周，每天下方的绿点表示当天休息人数
- **我的作息**：月历与周视图，单日点选修改，多选批量设置（支持「选中这一周」「本月剩余」快捷选择）
- **排班规律**：做五休二、做六休一、上二休二等预设，或自定义 2–14 天循环；设置后自动填满未来一年，且**手动改过的日期不会被覆盖**
- **群组**：邀请链接与二维码、邀请码手输、成员管理、转让群主、解散
- **隐私**：可针对每个群单独设置可见范围（显示具体班次 / 只显示忙闲 / 完全隐藏），脱敏在服务端完成
- **身份**：无密码，点链接填昵称即用；换设备用恢复码找回
- **PWA**：可添加到主屏幕，弱网秒开，断网时显示明确的离线提示

## 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars        # 本地变量，已 gitignore
npm run db:init:local                 # 建本地 D1 表
npm run dev                           # Vite :5173 + Worker :8787
```

打开 http://localhost:5173 ，应看到欢迎页，填昵称即可创建身份。

`.dev.vars` 里的 `WEB_ORIGIN` 指向 `http://localhost:5173`，这样群组页复制出来的邀请链接在本地就能直接点开测试。生产环境用 `wrangler.toml` 中的值。

手机真机调试：同一局域网下访问 `http://<你的电脑IP>:5173`。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 同时启动前端与后端 |
| `npm run build` | 构建前端到 `dist/`，并检查产物样式 |
| `npm run typecheck` | 前后端类型检查 |
| `npm run smoke` | 冒烟测试：身份 + 群组 + 作息（需先 `npm run dev`） |
| `npm run seed` | 生成演示群组与两周作息数据，输出邀请链接 |
| `npm run db:init:local` | 应用迁移到本地 D1 |
| `npm run db:reset:local` | 清空本地 D1 的业务数据（保留表结构） |
| `npm run db:init:remote` | 应用迁移到线上 D1 |
| `npm run deploy` | 构建并发布到 Cloudflare |

`npm run smoke` 会先清空本地限流表，再依次跑四个套件：`smoke-auth.mjs`（注册、恢复码找回、JWT 防篡改、滑动续期、改资料、注销）、`smoke-groups.mjs`（创建、邀请码、权限边界、数据隔离、转让、解散）、`smoke-schedules.mjs`（状态读写、可见范围三档脱敏、日期条统计、批量设置、参数边界）、`smoke-rules.mjs`（预设与自定义循环、365 天物化、手动记录不被覆盖）。共 **142 项断言**。

首页只有自己一个人看不出效果，`npm run seed` 会造一个 6 人的演示群，各人作息规律不同（做五休二、三班倒、做六休一、自由职业、从不设置），用输出的邀请链接加入即可。

## 部署

```bash
npx wrangler login          # 浏览器弹出授权页，点 Allow
npm run setup:cloudflare    # 建库、建表、构建、部署、设密钥，一条搞定
```

然后在 Cloudflare 控制台给 `988869.xyz` 加两条 **已代理（橙色云朵）** 的 A 记录，`om` 和 `omapi` 都指向 `192.0.2.1`（占位 IP，流量实际由 Worker 接管），SSL/TLS 模式设为 **Full**。

```bash
npm run verify:deploy       # 自动检查是否真的部署成功
```

`setup:cloudflare` 可重复执行，中途失败直接重跑即可，已完成的步骤会跳过。详细说明见 [`docs/DEPLOY.md`](docs/DEPLOY.md)。

后续改完代码重新发布只需 `npm run deploy`。

## 本地环境的已知限制

以下现象是 `wrangler dev` 代理层导致的，不是配置错误：

- 响应头 `Access-Control-Allow-Origin` 的值会被改写成本地地址，**CORS 是否真的配对只能在生产验证**
- Worker 里读到的 hostname 恒为 `wrangler.toml` 中第一条 route 的域名，与实际 Host 头无关
- Vite proxy 让前后端同源，本地不会触发跨域

详见 `docs/PRD.md` §13.2 与 §13.6。

## 故障排查

**页面能打开，但注册/所有 API 都失败**

几乎可以肯定是上次的 `wrangler` 没退干净：它的运行时子进程 `workerd` 变成孤儿继续占着 8787，但已不再响应请求。于是 Vite 正常起来、页面照常显示，只有 API 全部静默失败，看起来像代码 bug。

`npm run dev` 现在会在启动前自动检测并清理这类残留（见 `scripts/predev.mjs`），正常情况下你不会再遇到。如果需要手动清理：

```bash
taskkill /F /IM workerd.exe      # Windows
pkill -f workerd                 # macOS / Linux
```

**按钮或文字没有颜色**

Tailwind v4 中引用 `@theme` 里定义的颜色，要用语义类名 `bg-ink` / `text-ink-soft`，**不能**写成 `bg-[--color-ink]`。后者 Tailwind 会输出成 `background-color:--color-ink`，缺少 `var()` 包装，是无效 CSS，浏览器静默丢弃，表现为元素没有背景色或文字颜色。

`npm run build` 的 `postbuild` 会自动检查产物里有没有这类无效声明（`scripts/check-styles.mjs`），发现即报错并指出具体是哪条规则。

**复制出来的邀请链接打不开**

本地开发时 `.dev.vars` 里的 `WEB_ORIGIN` 应该是 `http://localhost:5173`。如果它指向生产域名，而生产还没部署，链接自然打不开。`.dev.vars.example` 里已是正确值，确认你的 `.dev.vars` 是从它复制的。

## 目录结构

```
src/          Worker 后端（Hono）
web/          前端（React SPA）
migrations/   D1 迁移
docs/         PRD 与部署文档
dist/         前端构建产物（gitignore）
```
