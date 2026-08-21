/**
 * 生成演示数据：一个群组 + 几位成员 + 两周作息。
 *
 * M3 的成果主要是"看"，只有自己一个人的首页看不出分组、日期条圆点这些效果。
 * 跑完会输出邀请链接，用你自己的账号点进去加入即可。
 *
 * 用法：npm run seed
 */
const BASE = process.argv[2] ?? 'http://127.0.0.1:8787'

const CST = 8 * 3600 * 1000
const DAY = 86400000
const today = new Date(Date.now() + CST).toISOString().slice(0, 10)
const offset = (n) =>
  new Date(Date.parse(`${today}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)

async function call(method, path, { body, token } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await res.json()
  if (!payload.ok) throw new Error(`${method} ${path} → ${JSON.stringify(payload.error)}`)
  return payload.data
}

const weekdayOf = (d) => new Date(`${d}T00:00:00Z`).getUTCDay()

/** 每个成员一种典型作息，好让首页的三个分组都有内容 */
const CAST = [
  {
    nickname: '小明',
    emoji: '🐟',
    // 做五休二：周末休息
    plan: (d) => ([0, 6].includes(weekdayOf(d)) ? 'off' : 'day'),
  },
  {
    nickname: '小红',
    emoji: '🌻',
    // 三班倒，四天一循环
    plan: (d, i) => ['day', 'mid', 'night', 'off'][i % 4],
  },
  {
    nickname: '阿强',
    emoji: '🍜',
    // 做六休一
    plan: (d, i) => (i % 7 === 3 ? 'off' : 'night'),
  },
  {
    nickname: '老王',
    emoji: '☕',
    // 自由职业，休息偏多
    plan: (d, i) => (i % 3 === 0 ? 'day' : 'off'),
  },
  {
    nickname: '小李',
    emoji: '🐈',
    // 从不设置，用来展示"未设置"分组
    plan: () => null,
  },
]

const owner = await call('POST', '/auth/register', {
  body: { nickname: '演示群主', avatarEmoji: '🦉' },
})

const { group } = await call('POST', '/groups', {
  body: { name: '摸鱼小分队' },
  token: owner.token,
})

const detail = await call(`GET`, `/groups/${group.id}`, { token: owner.token })
const inviteCode = detail.group.inviteCode

for (const person of CAST) {
  const user = await call('POST', '/auth/register', {
    body: { nickname: person.nickname, avatarEmoji: person.emoji, inviteCode },
  })

  const entries = []
  for (let i = -7; i <= 13; i++) {
    const date = offset(i)
    const status = person.plan(date, i + 7)
    if (status) entries.push({ date, status })
  }

  // 按状态分组批量写入，比逐天 PUT 少很多请求
  for (const status of ['day', 'mid', 'night', 'off']) {
    const dates = entries.filter((e) => e.status === status).map((e) => e.date)
    if (dates.length > 0) {
      await call('POST', '/schedules/me/batch', {
        body: { dates, status },
        token: user.token,
      })
    }
  }

  console.log(`  ${person.emoji} ${person.nickname.padEnd(4)} 写入 ${entries.length} 天`)
}

// 群主自己也来点数据，避免他在首页孤零零挂在"未设置"里
await call('POST', '/schedules/me/batch', {
  body: { dates: [offset(0), offset(1), offset(6), offset(7)], status: 'off' },
  token: owner.token,
})

console.log(`\n演示群「${group.name}」已创建，成员 ${CAST.length + 1} 人`)
console.log(`\n用你自己的账号打开这个链接加入：`)
console.log(`  http://localhost:5173/join/${inviteCode}`)
console.log(`\n或在「创建或加入群组」里输入邀请码：${inviteCode}\n`)
