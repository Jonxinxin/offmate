/**
 * 一键部署到 Cloudflare。
 *
 * 把原本需要逐条敲的 wrangler 命令串成一条，并且做成可重复执行的——
 * 中途失败或需要重来时直接再跑一次即可，已完成的步骤会自动跳过。
 *
 * 前置：先执行 npx wrangler login 完成浏览器授权。
 * 用法：npm run setup:cloudflare
 */
import { execSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'

const DB_NAME = 'offmate-db'
const TOML = 'wrangler.toml'

let step = 0
const say = (msg) => console.log(`\n[${++step}] ${msg}`)
const detail = (msg) => console.log(`    ${msg}`)

function run(cmd, { capture = false, input } = {}) {
  return execSync(cmd, {
    encoding: 'utf8',
    input,
    stdio: capture || input ? ['pipe', 'pipe', 'pipe'] : 'inherit',
  })
}

function tryRun(cmd, opts) {
  try {
    return { ok: true, out: run(cmd, opts) }
  } catch (err) {
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}` || err.message }
  }
}

// ---------- 0. 登录检查 ----------
const who = tryRun('npx wrangler whoami', { capture: true })
if (!who.ok || who.out.includes('not authenticated')) {
  console.error(
    '\n还没有登录 Cloudflare。\n\n' +
      '请先执行下面这条命令，浏览器会弹出授权页面，点 Allow 即可：\n\n' +
      '    npx wrangler login\n\n' +
      '完成后再运行 npm run setup:cloudflare\n',
  )
  process.exit(1)
}
const account = who.out.match(/│\s+([^│]+?)\s+│\s+([0-9a-f]{32})\s+│/)
say(`已登录 Cloudflare${account ? `：${account[1].trim()}` : ''}`)

// ---------- 1. D1 数据库 ----------
say('检查 D1 数据库')
let toml = fs.readFileSync(TOML, 'utf8')

if (toml.includes('PLACEHOLDER_RUN_WRANGLER_D1_CREATE')) {
  // 可能上次跑到一半，数据库已创建但 id 还没写回，所以先查再建
  const list = tryRun('npx wrangler d1 list --json', { capture: true })
  let id = null

  if (list.ok) {
    try {
      const json = JSON.parse(list.out.slice(list.out.indexOf('[')))
      id = json.find((d) => d.name === DB_NAME)?.uuid ?? null
    } catch {
      // 输出解析不了就当作没有，走创建流程
    }
  }

  if (id) {
    detail(`已存在同名数据库，直接复用：${id}`)
  } else {
    detail('创建中…')
    const created = tryRun(`npx wrangler d1 create ${DB_NAME}`, { capture: true })
    if (!created.ok) {
      console.error(`\n创建数据库失败：\n${created.out}\n`)
      process.exit(1)
    }
    id = created.out.match(/database_id\s*=\s*"([^"]+)"/)?.[1] ?? null
    if (!id) {
      console.error(`\n创建成功但没能解析出 database_id，请手动填入 ${TOML}：\n${created.out}\n`)
      process.exit(1)
    }
    detail(`创建完成：${id}`)
  }

  toml = toml.replace('PLACEHOLDER_RUN_WRANGLER_D1_CREATE', id)
  fs.writeFileSync(TOML, toml)
  detail(`已写入 ${TOML}`)
} else {
  detail('配置里已有 database_id，跳过')
}

// ---------- 2. 建表 ----------
say('在线上数据库建表')
const migrated = tryRun(`npx wrangler d1 migrations apply ${DB_NAME} --remote`)
if (!migrated.ok) {
  console.error(`\n建表失败：\n${migrated.out}\n`)
  process.exit(1)
}

// ---------- 3. 构建并部署 ----------
say('构建前端并部署 Worker')
const deployed = tryRun('npm run deploy')
if (!deployed.ok) {
  const out = deployed.out
  console.error(`\n部署失败：\n${out}\n`)

  if (/zone|route|not found|does not exist/i.test(out)) {
    console.error(
      '看起来是域名的问题。wrangler.toml 里配置了把 om.988869.xyz 和\n' +
        'omapi.988869.xyz 指向这个 Worker，这要求域名 988869.xyz 已经添加到\n' +
        '你的 Cloudflare 账号里（NS 指向 Cloudflare）。\n\n' +
        '请在 Cloudflare 控制台确认该域名已存在，再重新运行本命令。\n',
    )
  }
  process.exit(1)
}

// ---------- 4. 签名密钥 ----------
// 放在部署之后：Worker 存在了，secret 才有地方挂
say('设置身份令牌签名密钥')
const secrets = tryRun('npx wrangler secret list', { capture: true })

if (secrets.ok && secrets.out.includes('JWT_SECRET')) {
  detail('已存在，跳过（重新生成会让所有用户被迫重新登录）')
} else {
  const secret = randomBytes(32).toString('base64')
  const put = tryRun('npx wrangler secret put JWT_SECRET', { input: `${secret}\n` })
  if (!put.ok) {
    console.error(`\n设置密钥失败：\n${put.out}\n`)
    console.error('可以手动执行：npx wrangler secret put JWT_SECRET\n')
    process.exit(1)
  }
  detail('已生成并设置（内容不显示，也不落盘）')
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
部署完成。还差最后一步，需要你在网页上点几下。

打开 Cloudflare 控制台 → 选择 988869.xyz → 左侧 DNS → 记录，
添加下面两条，两条都要把「代理状态」设成【已代理】（橙色云朵）：

    类型  名称    内容         代理状态
    A     om      192.0.2.1    已代理
    A     omapi   192.0.2.1    已代理

192.0.2.1 是占位地址，真实流量由 Worker 接管，不会发到那个 IP。
橙色云朵必须打开，否则请求不经过 Cloudflare，Worker 不会生效。

然后进 SSL/TLS → 概述，把加密模式设为 Full。

DNS 生效后（通常一两分钟），跑一次验证：

    npm run verify:deploy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
