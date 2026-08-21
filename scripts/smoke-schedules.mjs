/**
 * 作息流程冒烟测试。
 *
 * 重点是可见范围脱敏：这是隐私承诺的兑现处，一旦服务端漏发原始班次，
 * 前端再怎么隐藏都只是障眼法。因此每一档可见性都直接检查响应内容。
 *
 * 用法：node scripts/smoke-schedules.mjs [baseUrl]
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

async function newUser(nickname) {
  const res = await call('POST', '/auth/register', { body: { nickname } })
  if (!res.payload.ok) throw new Error(`注册 ${nickname} 失败`)
  return { token: res.payload.data.token, ...res.payload.data.user }
}

/** 统一用北京时间，与服务端保持一致 */
const CST = 8 * 3600 * 1000
const DAY = 86400000
const todayStr = new Date(Date.now() + CST).toISOString().slice(0, 10)
const offset = (n) => new Date(Date.parse(`${todayStr}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)

console.log(`\n作息流程冒烟测试 → ${BASE}\n今天是 ${todayStr}\n`)

const alice = await newUser('阿丽')
const bob = await newUser('阿波')
const carol = await newUser('阿卡')

const created = await call('POST', '/groups', { token: alice.token, body: { name: '作息测试群' } })
const groupId = created.payload.data.group.id
const code = (await call('GET', `/groups/${groupId}`, { token: alice.token })).payload.data.group.inviteCode
await call('POST', '/groups/join', { token: bob.token, body: { inviteCode: code } })
await call('POST', '/groups/join', { token: carol.token, body: { inviteCode: code } })

// --- 设置状态 ---
const set = await call('PUT', `/schedules/me/${todayStr}`, {
  token: alice.token,
  body: { status: 'off', note: '调休' },
})
check('设置今天为休息', set.payload.ok && set.payload.data.entry.status === 'off')

check(
  '阿波设为晚班',
  (await call('PUT', `/schedules/me/${todayStr}`, { token: bob.token, body: { status: 'night' } }))
    .payload.ok,
)
// 阿卡不设置，用来验证 unset 分支

const day = await call('GET', `/schedules/group/${groupId}?date=${todayStr}`, { token: alice.token })
check('取到当日全员状态', day.payload.ok && day.payload.data.members.length === 3)
check('汇总正确', JSON.stringify(day.payload.data.summary) === JSON.stringify({ off: 1, work: 1, unset: 1 }),
  JSON.stringify(day.payload.data.summary))
check('自己被标记为 isMe', day.payload.data.members.find((m) => m.userId === alice.id).isMe === true)
check('未设置的成员返回 unset', day.payload.data.members.find((m) => m.userId === carol.id).status === 'unset')

// --- 可见范围：full ---
const bobAsSeenByAlice = () =>
  call('GET', `/schedules/group/${groupId}?date=${todayStr}`, { token: alice.token }).then((r) =>
    r.payload.data.members.find((m) => m.userId === bob.id),
  )

check('full 下能看到具体班次', (await bobAsSeenByAlice()).status === 'night')

// --- 可见范围：busy_only ---
await call('PATCH', `/groups/${groupId}/visibility`, { token: bob.token, body: { visibility: 'busy_only' } })
const busy = await bobAsSeenByAlice()
check('busy_only 下班次被归并为 work', busy.status === 'work', `实际 ${busy.status}`)
check('busy_only 下不下发备注', busy.note === null)

await call('PUT', `/schedules/me/${todayStr}`, { token: bob.token, body: { status: 'off', note: '秘密' } })
const busyOff = await bobAsSeenByAlice()
check('busy_only 下休息仍显示为休息', busyOff.status === 'off')
check('busy_only 下休息的备注也被抹掉', busyOff.note === null)

// --- 可见范围：hidden ---
await call('PATCH', `/groups/${groupId}/visibility`, { token: bob.token, body: { visibility: 'hidden' } })
const hidden = await bobAsSeenByAlice()
check('hidden 下状态显示为未设置', hidden.status === 'unset', `实际 ${hidden.status}`)
check('hidden 下不下发备注', hidden.note === null)

const selfView = await call('GET', `/schedules/group/${groupId}?date=${todayStr}`, { token: bob.token })
const bobSelf = selfView.payload.data.members.find((m) => m.userId === bob.id)
check('设为 hidden 后自己仍能看到自己', bobSelf.status === 'off', `实际 ${bobSelf.status}`)
check('自己能看到自己的备注', bobSelf.note === '秘密')

// --- 备注在 full 下正常 ---
const aliceSelf = day.payload.data.members.find((m) => m.userId === alice.id)
check('full 下备注正常下发', aliceSelf.note === '调休')

// --- 日期条统计 ---
await call('PATCH', `/groups/${groupId}/visibility`, { token: bob.token, body: { visibility: 'full' } })
await call('PUT', `/schedules/me/${offset(1)}`, { token: alice.token, body: { status: 'off' } })
await call('PUT', `/schedules/me/${offset(1)}`, { token: bob.token, body: { status: 'off' } })

const sum = await call(
  'GET',
  `/schedules/group/${groupId}/summary?from=${offset(-1)}&to=${offset(3)}`,
  { token: alice.token },
)
check('日期条统计明天有 2 人休息', sum.payload.data.counts[offset(1)] === 2, JSON.stringify(sum.payload.data.counts))
check('没有记录的日期不出现在统计里', sum.payload.data.counts[offset(3)] === undefined)

// hidden 的人不应计入他人看到的聚合数字，否则等于把隐藏的信息漏出去
await call('PATCH', `/groups/${groupId}/visibility`, { token: bob.token, body: { visibility: 'hidden' } })
const sumAfterHide = await call(
  'GET',
  `/schedules/group/${groupId}/summary?from=${offset(-1)}&to=${offset(3)}`,
  { token: alice.token },
)
check('hidden 成员不计入他人看到的统计', sumAfterHide.payload.data.counts[offset(1)] === 1,
  JSON.stringify(sumAfterHide.payload.data.counts))

const sumSelf = await call(
  'GET',
  `/schedules/group/${groupId}/summary?from=${offset(-1)}&to=${offset(3)}`,
  { token: bob.token },
)
check('但自己始终计入自己看到的统计', sumSelf.payload.data.counts[offset(1)] === 2,
  JSON.stringify(sumSelf.payload.data.counts))
await call('PATCH', `/groups/${groupId}/visibility`, { token: bob.token, body: { visibility: 'full' } })

// --- 成员详情 ---
const detail = await call(
  'GET',
  `/schedules/user/${bob.id}?groupId=${groupId}&from=${offset(-7)}&to=${offset(7)}`,
  { token: alice.token },
)
check('能查看同群成员的区间作息', detail.payload.ok && detail.payload.data.entries.length === 2)

const outsider = await newUser('路人')
const denied = await call(
  'GET',
  `/schedules/user/${bob.id}?groupId=${groupId}&from=${offset(-7)}&to=${offset(7)}`,
  { token: outsider.token },
)
check('非同群者无法查看成员作息', denied.status === 403, `得到 ${denied.status}`)
check(
  '非成员无法读取群组当日状态',
  (await call('GET', `/schedules/group/${groupId}?date=${todayStr}`, { token: outsider.token })).status === 403,
)
check(
  '未登录无法读取群组当日状态',
  (await call('GET', `/schedules/group/${groupId}?date=${todayStr}`)).status === 401,
)

// --- 我的作息 ---
const mine = await call('GET', `/schedules/me?from=${offset(-7)}&to=${offset(7)}`, { token: alice.token })
check('能取到自己的区间作息', mine.payload.ok && mine.payload.data.entries.length === 2)

// --- 批量设置 ---
const batchDates = [offset(3), offset(4), offset(5)]
const batch = await call('POST', '/schedules/me/batch', {
  token: alice.token,
  body: { dates: batchDates, status: 'day' },
})
check('批量设置三天', batch.payload.ok && batch.payload.data.count === 3)

const afterBatch = await call('GET', `/schedules/me?from=${offset(3)}&to=${offset(5)}`, { token: alice.token })
check('批量设置已生效', afterBatch.payload.data.entries.length === 3)
check('批量设置的状态正确', afterBatch.payload.data.entries.every((e) => e.status === 'day'))

const dupBatch = await call('POST', '/schedules/me/batch', {
  token: alice.token,
  body: { dates: [offset(6), offset(6)], status: 'off' },
})
check('批量设置对重复日期幂等', dupBatch.payload.ok && dupBatch.payload.data.count === 1)

// --- 覆盖与清除 ---
const overwrite = await call('PUT', `/schedules/me/${offset(3)}`, {
  token: alice.token,
  body: { status: 'night', note: '换班' },
})
check('重复设置同一天为覆盖而非报错', overwrite.payload.ok && overwrite.payload.data.entry.status === 'night')

const cleared = await call('DELETE', `/schedules/me/${offset(3)}`, { token: alice.token })
check('清除某天', cleared.payload.ok)

const clearAgain = await call('DELETE', `/schedules/me/${offset(3)}`, { token: alice.token })
check('清除本来就没有的日期返回 404', clearAgain.status === 404)

const afterClear = await call('GET', `/schedules/group/${groupId}?date=${offset(3)}`, { token: alice.token })
check(
  '清除后回到未设置',
  afterClear.payload.data.members.find((m) => m.userId === alice.id).status === 'unset',
)

// --- 参数校验 ---
check(
  '非法状态被拒绝',
  (await call('PUT', `/schedules/me/${todayStr}`, { token: alice.token, body: { status: 'sleeping' } })).status === 400,
)
check(
  '非法日期格式被拒绝',
  (await call('PUT', '/schedules/me/2026-8-1', { token: alice.token, body: { status: 'off' } })).status === 400,
)
check(
  '超长备注被拒绝',
  (await call('PUT', `/schedules/me/${todayStr}`, {
    token: alice.token,
    body: { status: 'off', note: '一'.repeat(31) },
  })).status === 400,
)
check(
  '过于久远的日期被拒绝',
  (await call('PUT', `/schedules/me/${offset(-200)}`, { token: alice.token, body: { status: 'off' } })).status === 400,
)
check(
  '过于遥远的日期被拒绝',
  (await call('PUT', `/schedules/me/${offset(400)}`, { token: alice.token, body: { status: 'off' } })).status === 400,
)
check(
  '起止日期颠倒被拒绝',
  (await call('GET', `/schedules/me?from=${offset(5)}&to=${offset(1)}`, { token: alice.token })).status === 400,
)
check(
  '一次批量超过 60 天被拒绝',
  (await call('POST', '/schedules/me/batch', {
    token: alice.token,
    body: { dates: Array.from({ length: 61 }, (_, i) => offset(i + 10)), status: 'off' },
  })).status === 400,
)

console.log(`\n${passed} 通过, ${failed} 失败\n`)
process.exit(failed > 0 ? 1 : 0)
