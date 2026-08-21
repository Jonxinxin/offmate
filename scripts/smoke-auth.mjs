/**
 * 身份流程冒烟测试。覆盖 M1 的验收标准：
 * 创建身份 → 换设备用恢复码找回 → 改资料 → 重置恢复码 → 注销，
 * 外加滑动续期与 JWT 防篡改。
 *
 * 用 node 而非 curl：Git Bash 下 curl 会破坏 UTF-8（emoji 变成 ??）。
 * 用法：node scripts/smoke-auth.mjs [baseUrl] [jwtSecret]
 */
import { createHmac } from 'node:crypto'

const BASE = process.argv[2] ?? 'http://127.0.0.1:8787'
// 与 .dev.vars 中的值一致；仅用于构造测试用 token，不参与生产
const SECRET = process.argv[3] ?? 'dev-only-secret-change-me'

const b64url = (input) => Buffer.from(input).toString('base64url')

/** 自签一个指定过期时间的 token，用来触发本来要等 90 天才会发生的续期 */
function signToken(sub, expiresInSeconds) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ sub, iat: now, exp: now + expiresInSeconds }))
  const sig = createHmac('sha256', SECRET).update(`${header}.${payload}`).digest()
  return `${header}.${payload}.${b64url(sig)}`
}

function decodeExp(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).exp
}

let passed = 0
let failed = 0

function check(name, condition, detail) {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function call(method, path, { body, token } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return {
    status: res.status,
    refreshHeader: res.headers.get('X-Refresh-Token'),
    payload: await res.json(),
  }
}

console.log(`\n身份流程冒烟测试 → ${BASE}\n`)

// --- 注册 ---
const reg = await call('POST', '/auth/register', {
  body: { nickname: '小明', avatarEmoji: '🐟' },
})
check('注册成功', reg.payload.ok, JSON.stringify(reg.payload))
if (!reg.payload.ok) process.exit(1)

const { token, recoveryCode, user } = reg.payload.data
check('返回了 token', typeof token === 'string' && token.split('.').length === 3)
check('恢复码格式为 XXXX-XXXX-XXXX', /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(recoveryCode), recoveryCode)
check('emoji 头像正确保存', user.avatarEmoji === '🐟', user.avatarEmoji)
check('自动分配了头像底色', /^#[0-9A-F]{6}$/i.test(user.avatarColor), user.avatarColor)

// --- 鉴权 ---
const me = await call('GET', '/auth/me', { token })
check('带 token 能取到自己', me.payload.ok && me.payload.data.user.id === user.id)
check('新 token 不触发续期', me.refreshHeader === null, `收到 ${me.refreshHeader}`)

const noAuth = await call('GET', '/auth/me')
check('无 token 返回 401', noAuth.status === 401 && noAuth.payload.error.code === 'UNAUTHORIZED')

const badAuth = await call('GET', '/auth/me', { token: 'not.a.token' })
check('伪造 token 返回 401', badAuth.status === 401)

// 篡改 payload 但保留原签名，验证签名校验真的生效
const [h, p, s] = token.split('.')
const tampered = JSON.parse(Buffer.from(p, 'base64url').toString())
tampered.sub = 'someone-else'
const forged = `${h}.${Buffer.from(JSON.stringify(tampered)).toString('base64url')}.${s}`
const forgedRes = await call('GET', '/auth/me', { token: forged })
check('篡改 sub 后签名校验失败', forgedRes.status === 401, `得到 ${forgedRes.status}`)

// --- 恢复码：模拟换设备 ---
const recovered = await call('POST', '/auth/recover', { body: { recoveryCode } })
check('恢复码能找回同一个账号', recovered.payload.ok && recovered.payload.data.user.id === user.id)

const loose = recoveryCode.replaceAll('-', '').toLowerCase()
const looseRes = await call('POST', '/auth/recover', { body: { recoveryCode: loose } })
check('恢复码容错小写与省略连字符', looseRes.payload.ok && looseRes.payload.data.user.id === user.id)

const wrong = await call('POST', '/auth/recover', { body: { recoveryCode: 'ZZZZ-ZZZZ-ZZZZ' } })
check('错误恢复码被拒绝', wrong.status === 401 && wrong.payload.error.code === 'RECOVERY_INVALID')

// --- 滑动续期 ---
// TTL 180 天、阈值 90 天，正常注册的 token 不会触发续期，
// 因此自签一个只剩 30 天的 token 来验证这条路径真的通。
const DAY = 86400
const staleToken = signToken(user.id, 30 * DAY)
const staleRes = await call('GET', '/auth/me', { token: staleToken })
check('临近过期的 token 仍可用', staleRes.payload.ok)
check('触发续期并下发 X-Refresh-Token', staleRes.refreshHeader !== null)
if (staleRes.refreshHeader) {
  check(
    '续期后的有效期被延长',
    decodeExp(staleRes.refreshHeader) > decodeExp(staleToken) + 100 * DAY,
  )
  const renewed = await call('GET', '/auth/me', { token: staleRes.refreshHeader })
  check('续期后的新 token 可用', renewed.payload.ok)
  check('新 token 不再重复触发续期', renewed.refreshHeader === null)
}

const expiredRes = await call('GET', '/auth/me', { token: signToken(user.id, -60) })
check('已过期的 token 被拒绝', expiredRes.status === 401)

const wrongSecret = `${staleToken.slice(0, -4)}AAAA`
check(
  '签名不匹配的 token 被拒绝',
  (await call('GET', '/auth/me', { token: wrongSecret })).status === 401,
)

// --- 改资料 ---
const patched = await call('PATCH', '/auth/me', {
  token,
  body: { nickname: '小明改名了', avatarEmoji: '🐼' },
})
check('改昵称和头像', patched.payload.ok && patched.payload.data.user.nickname === '小明改名了')
check('头像已更新', patched.payload.data.user.avatarEmoji === '🐼')

const tooLong = await call('PATCH', '/auth/me', { token, body: { nickname: '一二三四五六七八九十十一十二十三' } })
check('超长昵称被拒绝', tooLong.status === 400 && tooLong.payload.error.code === 'INVALID_PARAM')

const badEmoji = await call('PATCH', '/auth/me', { token, body: { avatarEmoji: '💩' } })
check('白名单外的 emoji 被拒绝', badEmoji.status === 400)
check('拒绝消息简洁可读', badEmoji.payload.error?.message === '不支持的头像', badEmoji.payload.error?.message)

// --- 重置恢复码 ---
const reset = await call('POST', '/auth/recovery/reset', { token })
check('能重置恢复码', reset.payload.ok && reset.payload.data.recoveryCode !== recoveryCode)

const oldCode = await call('POST', '/auth/recover', { body: { recoveryCode } })
check('旧恢复码立即失效', oldCode.status === 401, `得到 ${oldCode.status}`)

const newCode = await call('POST', '/auth/recover', {
  body: { recoveryCode: reset.payload.data.recoveryCode },
})
check('新恢复码可用', newCode.payload.ok)

// --- 注销 ---
const del = await call('DELETE', '/auth/me', { token })
check('注销成功', del.payload.ok)

const afterDelete = await call('GET', '/auth/me', { token })
check('注销后 token 失效', afterDelete.status === 404 || afterDelete.status === 401, `得到 ${afterDelete.status}`)

console.log(`\n${passed} 通过, ${failed} 失败\n`)
process.exit(failed > 0 ? 1 : 0)
