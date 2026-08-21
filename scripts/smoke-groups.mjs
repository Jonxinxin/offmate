/**
 * 群组流程冒烟测试。重点覆盖权限边界与多用户交互——
 * 这些路径手点很难穷尽，但一旦有洞就是越权读别人数据。
 *
 * 用法：node scripts/smoke-groups.mjs [baseUrl]
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
  if (!res.payload.ok) throw new Error(`注册 ${nickname} 失败: ${JSON.stringify(res.payload)}`)
  return { token: res.payload.data.token, ...res.payload.data.user }
}

console.log(`\n群组流程冒烟测试 → ${BASE}\n`)

const alice = await newUser('阿丽')
const bob = await newUser('阿波')
const carol = await newUser('阿卡')

// --- 创建与邀请 ---
const created = await call('POST', '/groups', { token: alice.token, body: { name: '摸鱼小分队' } })
check('创建群组', created.payload.ok)
const groupId = created.payload.data.group.id
check('创建者初始人数为 1', created.payload.data.group.memberCount === 1)

const detail = await call('GET', `/groups/${groupId}`, { token: alice.token })
check('群主能看到邀请码', detail.payload.ok && /^[2-9A-HJ-NP-Z]{6}$/.test(detail.payload.data.group.inviteCode))
check('返回可直接分享的邀请链接', detail.payload.data.inviteUrl.includes('/join/'))
const inviteCode = detail.payload.data.group.inviteCode

// --- 免登录预览 ---
const preview = await call('GET', `/groups/preview?code=${inviteCode}`)
check('未登录可预览邀请信息', preview.payload.ok && preview.payload.data.name === '摸鱼小分队')
check('预览显示邀请人昵称', preview.payload.data.ownerNickname === '阿丽')
check('预览不泄露群组 id', preview.payload.data.id === undefined)

const badPreview = await call('GET', '/groups/preview?code=ZZZZZZ')
check('无效邀请码预览被拒绝', badPreview.status === 404)

// --- 加入 ---
const joined = await call('POST', '/groups/join', { token: bob.token, body: { inviteCode } })
check('用邀请码加入', joined.payload.ok && joined.payload.data.group.memberCount === 2)

const lower = await call('POST', '/groups/join', {
  token: carol.token,
  body: { inviteCode: inviteCode.toLowerCase() },
})
check('邀请码大小写不敏感', lower.payload.ok)

const dup = await call('POST', '/groups/join', { token: bob.token, body: { inviteCode } })
check('重复加入被拒绝', dup.status === 409 && dup.payload.error.code === 'ALREADY_MEMBER')

const members = await call('GET', `/groups/${groupId}/members`, { token: bob.token })
check('成员能看到成员列表', members.payload.ok && members.payload.data.members.length === 3)
check('群主角色正确', members.payload.data.members.find((m) => m.userId === alice.id).role === 'owner')

// --- 数据隔离：非成员一律看不到 ---
const outsider = await newUser('路人')
check(
  '非成员看不到群详情',
  (await call('GET', `/groups/${groupId}`, { token: outsider.token })).status === 403,
)
check(
  '非成员看不到成员列表',
  (await call('GET', `/groups/${groupId}/members`, { token: outsider.token })).status === 403,
)
check(
  '未登录看不到群详情',
  (await call('GET', `/groups/${groupId}`)).status === 401,
)

// --- 权限：普通成员不能做群主的事 ---
check(
  '成员不能改群名',
  (await call('PATCH', `/groups/${groupId}`, { token: bob.token, body: { name: '篡改' } })).status === 403,
)
check(
  '成员不能解散群组',
  (await call('DELETE', `/groups/${groupId}`, { token: bob.token })).status === 403,
)
check(
  '成员不能移除他人',
  (await call('DELETE', `/groups/${groupId}/members/${carol.id}`, { token: bob.token })).status === 403,
)
check(
  '成员不能刷新邀请码',
  (await call('POST', `/groups/${groupId}/invite/refresh`, { token: bob.token, body: {} })).status === 403,
)

// --- 群主不能直接退群 ---
const ownerLeave = await call('POST', `/groups/${groupId}/leave`, { token: alice.token })
check('群主退群被拒绝并提示转让', ownerLeave.status === 403 && ownerLeave.payload.error.message.includes('转让'))

// --- 刷新邀请码使旧码失效 ---
const refreshed = await call('POST', `/groups/${groupId}/invite/refresh`, {
  token: alice.token,
  body: {},
})
check('群主能刷新邀请码', refreshed.payload.ok && refreshed.payload.data.inviteCode !== inviteCode)

const staleJoin = await call('POST', '/groups/join', {
  token: outsider.token,
  body: { inviteCode },
})
check('旧邀请码立即失效', staleJoin.status === 404, `得到 ${staleJoin.status}`)

const freshJoin = await call('POST', '/groups/join', {
  token: outsider.token,
  body: { inviteCode: refreshed.payload.data.inviteCode },
})
check('新邀请码可用', freshJoin.payload.ok)

// --- 过期邀请码 ---
const expiring = await call('POST', `/groups/${groupId}/invite/refresh`, {
  token: alice.token,
  body: { expireIn: 1 },
})
await new Promise((r) => setTimeout(r, 1500))
const expiredPreview = await call('GET', `/groups/preview?code=${expiring.payload.data.inviteCode}`)
check('过期邀请码预览被拒绝', expiredPreview.status === 404 && expiredPreview.payload.error.message.includes('过期'))

// --- 移除成员 ---
const removed = await call('DELETE', `/groups/${groupId}/members/${outsider.id}`, { token: alice.token })
check('群主能移除成员', removed.payload.ok)
check(
  '被移除后立刻失去访问权',
  (await call('GET', `/groups/${groupId}`, { token: outsider.token })).status === 403,
)

const selfRemove = await call('DELETE', `/groups/${groupId}/members/${alice.id}`, { token: alice.token })
check('群主不能移除自己', selfRemove.status === 403)

// --- 退群 ---
const left = await call('POST', `/groups/${groupId}/leave`, { token: carol.token })
check('成员能退群', left.payload.ok)

const afterLeave = await call('GET', `/groups/${groupId}`, { token: alice.token })
check('退群后人数正确递减', afterLeave.payload.data.group.memberCount === 2, `实际 ${afterLeave.payload.data.group.memberCount}`)

// --- 可见范围 ---
const vis = await call('PATCH', `/groups/${groupId}/visibility`, {
  token: bob.token,
  body: { visibility: 'busy_only' },
})
check('成员能设置自己的可见范围', vis.payload.ok)

const badVis = await call('PATCH', `/groups/${groupId}/visibility`, {
  token: bob.token,
  body: { visibility: 'invisible' },
})
check('非法可见范围被拒绝', badVis.status === 400)

// --- 转让群主 ---
const transfer = await call('POST', `/groups/${groupId}/transfer`, {
  token: alice.token,
  body: { userId: bob.id },
})
check('转让群主', transfer.payload.ok)

const afterTransfer = await call('GET', `/groups/${groupId}`, { token: bob.token })
check('新群主角色生效', afterTransfer.payload.data.group.myRole === 'owner')

const oldOwner = await call('GET', `/groups/${groupId}`, { token: alice.token })
check('原群主降为普通成员', oldOwner.payload.data.group.myRole === 'member')
check(
  '原群主失去群主权限',
  (await call('DELETE', `/groups/${groupId}`, { token: alice.token })).status === 403,
)
check('原群主现在可以退群', (await call('POST', `/groups/${groupId}/leave`, { token: alice.token })).payload.ok)

// --- 注册时通过邀请码直接入群 ---
// 上面测过期时把邀请码换成了 1 秒失效的那个，这里先换回一个长期有效的
const revived = await call('POST', `/groups/${groupId}/invite/refresh`, {
  token: bob.token,
  body: {},
})
const currentCode = revived.payload.data.inviteCode
check('刷新出长期有效的邀请码', revived.payload.ok && revived.payload.data.inviteExpire === null)

const viaInvite = await call('POST', '/auth/register', {
  body: { nickname: '新朋友', inviteCode: currentCode },
})
check('注册时带邀请码直接入群', viaInvite.payload.ok && viaInvite.payload.data.joinedGroup?.id === groupId)

const meAfter = await call('GET', '/auth/me', { token: viaInvite.payload.data.token })
check('新用户的群组列表已包含该群', meAfter.payload.data.groups.some((g) => g.id === groupId))

const badInvite = await call('POST', '/auth/register', {
  body: { nickname: '码错了', inviteCode: 'ZZZZZZ' },
})
check('邀请码无效时注册仍然成功', badInvite.payload.ok)
check('但不会加入任何群组', badInvite.payload.data.joinedGroup === null)

// --- 解散 ---
const dissolved = await call('DELETE', `/groups/${groupId}`, { token: bob.token })
check('群主能解散群组', dissolved.payload.ok)
check(
  '解散后成员访问返回 403',
  (await call('GET', `/groups/${groupId}`, { token: bob.token })).status === 403,
)

console.log(`\n${passed} 通过, ${failed} 失败\n`)
process.exit(failed > 0 ? 1 : 0)
