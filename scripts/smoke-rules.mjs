/**
 * 排班规律冒烟测试。
 *
 * 重点验证"手动记录永远优先"：规律是物化写入的，一旦覆盖了用户手写的日期，
 * 用户会发现自己改过的排班莫名其妙被改回去，那是不可接受的。
 *
 * 用法：node scripts/smoke-rules.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://127.0.0.1:8787'

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
  return { status: res.status, payload: await res.json() }
}

const CST = 8 * 3600 * 1000
const DAY = 86400000
const today = new Date(Date.now() + CST).toISOString().slice(0, 10)
const offset = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
const dowOf = (d) => new Date(`${d}T00:00:00Z`).getUTCDay()

console.log(`\n排班规律冒烟测试 → ${BASE}\n今天是 ${today}（周${'日一二三四五六'[dowOf(today)]}）\n`)

const user = (await call('POST', '/auth/register', { body: { nickname: '轮班族' } })).payload.data

async function myRange(from, to) {
  const r = await call('GET', `/schedules/me?from=${from}&to=${to}`, { token: user.token })
  return new Map(r.payload.data.entries.map((e) => [e.date, e.status]))
}

// --- 预设列表 ---
const presets = await call('GET', '/rules/presets')
check('预设列表免登录可取', presets.payload.ok && presets.payload.data.presets.length === 6)
check('包含做五休二', presets.payload.data.presets.some((p) => p.key === 'w5d2'))

check('初始没有规律', (await call('GET', '/rules/me', { token: user.token })).payload.data.rule === null)

// --- 做五休二：锚定星期 ---
const w5d2 = await call('PUT', '/rules/me', {
  token: user.token,
  body: { type: 'preset', presetKey: 'w5d2' },
})
check('设置做五休二', w5d2.payload.ok)
check('物化了 365 天', w5d2.payload.data.generated === 365, `实际 ${w5d2.payload.data.generated}`)

const twoWeeks = await myRange(today, offset(13))
const weekendWrong = [...twoWeeks].filter(([d, s]) => {
  const weekend = [0, 6].includes(dowOf(d))
  return weekend ? s !== 'off' : s !== 'day'
})
check('做五休二：周末休息、工作日白班', weekendWrong.length === 0,
  weekendWrong.slice(0, 3).map(([d, s]) => `${d}=${s}`).join(' '))

// --- 只影响今天及以后 ---
const past = await myRange(offset(-7), offset(-1))
check('不回填过去的日期', past.size === 0, `过去有 ${past.size} 条`)

// --- 手动记录优先 ---
const pickWorkday = [...twoWeeks.keys()].find((d) => ![0, 6].includes(dowOf(d)))
await call('PUT', `/schedules/me/${pickWorkday}`, {
  token: user.token,
  body: { status: 'off', note: '请假' },
})

const afterManual = await myRange(pickWorkday, pickWorkday)
check('手动改掉规律生成的某天', afterManual.get(pickWorkday) === 'off')

// 换个规律，触发重新物化
const w6d1 = await call('PUT', '/rules/me', {
  token: user.token,
  body: { type: 'preset', presetKey: 'w6d1', anchorDate: today },
})
check('换成做六休一', w6d1.payload.ok)

const afterRegen = await call('GET', `/schedules/me?from=${pickWorkday}&to=${pickWorkday}`, {
  token: user.token,
})
const kept = afterRegen.payload.data.entries[0]
check('重新物化不覆盖手动记录', kept?.status === 'off', `实际 ${kept?.status}`)
check('手动记录的备注也保留', kept?.note === '请假')

// --- 做六休一：7 天循环 ---
const week = await myRange(today, offset(13))
const offDays = [...week].filter(([, s]) => s === 'off').map(([d]) => d)
check('做六休一：两周里约有 2 天休息', offDays.length >= 2 && offDays.length <= 4,
  `实际 ${offDays.length} 天`)

// --- 自定义循环 ---
const custom = await call('PUT', '/rules/me', {
  token: user.token,
  body: { type: 'custom', pattern: ['day', 'day', 'night', 'night', 'off', 'off'], anchorDate: today },
})
check('设置自定义循环', custom.payload.ok)

const cycle = await myRange(today, offset(11))
const expected = ['day', 'day', 'night', 'night', 'off', 'off']
const mismatches = []
for (let i = 0; i < 12; i++) {
  const d = offset(i)
  // 手动记录那天不参与比对
  if (d === pickWorkday) continue
  if (cycle.get(d) !== expected[i % 6]) mismatches.push(`${d}=${cycle.get(d)}≠${expected[i % 6]}`)
}
check('自定义循环按周期重复', mismatches.length === 0, mismatches.slice(0, 3).join(' '))

const savedRule = (await call('GET', '/rules/me', { token: user.token })).payload.data.rule
check('能读回当前规律', savedRule?.type === 'custom')
check('循环内容正确', JSON.stringify(savedRule.pattern) === JSON.stringify(expected))

// --- 锚点日期生效 ---
await call('PUT', '/rules/me', {
  token: user.token,
  body: { type: 'custom', pattern: ['off', 'day'], anchorDate: today },
})
const anchored = await myRange(today, offset(3))
check('锚点当天取循环第一位', anchored.get(today) === 'off', `实际 ${anchored.get(today)}`)
check('次日取循环第二位', anchored.get(offset(1)) === 'day')

// --- 参数校验 ---
check(
  '循环少于 2 天被拒绝',
  (await call('PUT', '/rules/me', { token: user.token, body: { type: 'custom', pattern: ['day'] } })).status === 400,
)
check(
  '循环超过 14 天被拒绝',
  (await call('PUT', '/rules/me', {
    token: user.token,
    body: { type: 'custom', pattern: Array(15).fill('day') },
  })).status === 400,
)
check(
  '全是上班的循环被拒绝',
  (await call('PUT', '/rules/me', {
    token: user.token,
    body: { type: 'custom', pattern: ['day', 'night'] },
  })).status === 400,
)
check(
  '未知预设被拒绝',
  (await call('PUT', '/rules/me', { token: user.token, body: { type: 'preset', presetKey: 'w9d9' } })).status === 400,
)
check(
  '未登录不能设置规律',
  (await call('PUT', '/rules/me', { body: { type: 'preset', presetKey: 'w5d2' } })).status === 401,
)

// --- 停用 ---
const stopKeep = await call('DELETE', '/rules/me', { token: user.token })
check('停用规律', stopKeep.payload.ok)
check('停用后读不到规律', (await call('GET', '/rules/me', { token: user.token })).payload.data.rule === null)

const keptEntries = await myRange(today, offset(6))
check('默认保留已生成的记录', keptEntries.size > 0, `剩 ${keptEntries.size} 条`)

// 重新设置再带清除停用
await call('PUT', '/rules/me', { token: user.token, body: { type: 'preset', presetKey: 'w5d2' } })
await call('DELETE', '/rules/me?clearGenerated=true', { token: user.token })

const cleared = await myRange(today, offset(30))
check('清除后规律生成的记录消失', cleared.size <= 1, `剩 ${cleared.size} 条`)
check('但手动记录仍在', cleared.get(pickWorkday) === 'off' || pickWorkday > offset(30))

console.log(`\n${passed} 通过, ${failed} 失败\n`)
process.exit(failed > 0 ? 1 : 0)
