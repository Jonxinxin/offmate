/**
 * 部署后验证。
 *
 * 本地开发走 Vite proxy、前后端同源，跨域相关的问题一个都测不出来，
 * 只能在生产验。这个脚本把 docs/DEPLOY.md 第 7 节的检查项自动化，
 * 给出明确的成功/失败判断，不用自己看 curl 输出。
 *
 * 用法：npm run verify:deploy
 */
const WEB = 'https://om.988869.xyz'
const API = 'https://omapi.988869.xyz'

let passed = 0
let failed = 0
const problems = []

function check(name, ok, hint) {
  if (ok) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name}`)
    if (hint) problems.push({ name, hint })
  }
}

async function get(url, init) {
  try {
    return await fetch(url, init)
  } catch (err) {
    return { ok: false, status: 0, headers: new Headers(), _err: err.message }
  }
}

console.log(`\n验证线上部署\n  前端 ${WEB}\n  后端 ${API}\n`)

// ---------- 前端 ----------
console.log('前端')
const home = await get(WEB)
check(
  '首页可访问',
  home.status === 200,
  home.status === 0
    ? `连不上 ${WEB}。检查 DNS 里 om 这条记录是否存在、是否开了橙色云朵。`
    : `返回了 ${home.status}。`,
)

const deepLink = await get(`${WEB}/schedule`)
check(
  '刷新子路由不 404（SPA 回退正常）',
  deepLink.status === 200 && (deepLink.headers.get('content-type') ?? '').includes('text/html'),
  '返回不是 HTML。检查 wrangler.toml 里的 not_found_handling = "single-page-application"。' +
    '这项不生效的话，微信里点开的邀请链接会白屏。',
)

const manifest = await get(`${WEB}/manifest.webmanifest`)
check('PWA manifest 可访问', manifest.status === 200)

// ---------- 后端 ----------
console.log('\n后端')
const health = await get(`${API}/api/health`)
check(
  '健康检查可访问',
  health.status === 200,
  health.status === 0
    ? `连不上 ${API}。检查 DNS 里 omapi 这条记录是否存在、是否开了橙色云朵。`
    : `返回了 ${health.status}。`,
)

let healthData = null
if (health.status === 200) {
  const json = await health.json()
  healthData = json.data
  check('数据库已连接', healthData?.db === 'connected', '数据库没连上，确认已执行过建表步骤。')
  check(
    'API 域名路由正确',
    healthData?.host === 'omapi.988869.xyz',
    `Worker 看到的域名是 ${healthData?.host}，与预期不符。检查 wrangler.toml 的 routes。`,
  )
}

const apiRoot = await get(`${API}/schedule`)
check(
  'API 域名不返回页面',
  apiRoot.status === 404,
  `返回了 ${apiRoot.status}，预期 404。API 域名不应托管前端页面。`,
)

// ---------- 跨域 ----------
console.log('\n跨域（本地测不出来，只能在线上验）')
const preflight = await get(`${API}/api/health`, {
  method: 'OPTIONS',
  headers: {
    Origin: WEB,
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization',
  },
})

check(
  '预检请求通过',
  preflight.status === 204 || preflight.status === 200,
  `返回了 ${preflight.status}。`,
)
check(
  '允许前端域名跨域',
  preflight.headers.get('access-control-allow-origin') === WEB,
  `Access-Control-Allow-Origin 是 ${preflight.headers.get('access-control-allow-origin')}，` +
    `预期 ${WEB}。检查 src/middleware/cors.ts 的 origin 白名单。`,
)
check(
  '暴露 X-Refresh-Token 响应头',
  (preflight.headers.get('access-control-expose-headers') ?? '').includes('X-Refresh-Token'),
  '这一条漏掉的后果最隐蔽：登录令牌的滑动续期靠这个响应头下发，' +
    '跨域下不显式暴露的话浏览器不允许 JS 读取，续期会静默失效，' +
    '表现为用户半年后突然掉线且查不出原因。检查 src/middleware/cors.ts 的 exposeHeaders。',
)

// ---------- 真实流程 ----------
console.log('\n完整流程')
const nickname = `联调测试${Math.floor(Date.now() / 1000) % 10000}`
const reg = await get(`${API}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: WEB },
  body: JSON.stringify({ nickname }),
})

let token = null
if (reg.status === 200) {
  const json = await reg.json()
  token = json.data?.token
  check('能创建身份', json.ok === true)
  check('返回了恢复码', /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(json.data?.recoveryCode ?? ''))
} else {
  check('能创建身份', false, `注册接口返回 ${reg.status}。`)
}

if (token) {
  const created = await get(`${API}/api/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Origin: WEB },
    body: JSON.stringify({ name: '联调测试群' }),
  })
  const groupJson = created.status === 200 ? await created.json() : null
  check('能创建群组', groupJson?.ok === true)

  if (groupJson?.ok) {
    const detail = await get(`${API}/api/groups/${groupJson.data.group.id}`, {
      headers: { Authorization: `Bearer ${token}`, Origin: WEB },
    })
    const detailJson = detail.status === 200 ? await detail.json() : null
    const inviteUrl = detailJson?.data?.inviteUrl ?? ''
    check(
      '邀请链接指向前端域名',
      inviteUrl.startsWith(`${WEB}/join/`),
      `生成的是 ${inviteUrl}。检查 wrangler.toml 里 [vars] 的 WEB_ORIGIN。`,
    )

    if (inviteUrl) {
      const landing = await get(inviteUrl)
      check('邀请链接可以打开', landing.status === 200)
    }

    // 清掉测试数据，别在正式库里留垃圾
    await get(`${API}/api/groups/${groupJson.data.group.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, Origin: WEB },
    })
  }

  await get(`${API}/api/auth/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, Origin: WEB },
  })
  console.log('  · 测试数据已清理')
}

// ---------- 结果 ----------
console.log(`\n${passed} 项通过，${failed} 项失败`)

if (failed > 0) {
  console.log('\n需要处理：')
  for (const p of problems) console.log(`\n  ${p.name}\n    ${p.hint}`)
  console.log('')
  process.exit(1)
}

console.log(`\n部署正常，可以把 ${WEB} 发给朋友了。\n`)
