import { ApiError } from '../lib/response'
import { nowSeconds } from '../lib/date'
import { ulid, inviteCode as generateInviteCode } from '../lib/id'

/** 限额同时起到防滥用和守住免费额度的作用 */
export const MAX_MEMBERS = 30
export const MAX_JOINED_GROUPS = 10
export const MAX_OWNED_GROUPS = 5

export type Role = 'owner' | 'member'
export type Visibility = 'full' | 'busy_only' | 'hidden'

export interface Group {
  id: string
  name: string
  ownerId: string
  memberCount: number
  createdAt: number
}

/** 含邀请码的详情，只对群成员下发 */
export interface GroupDetail extends Group {
  inviteCode: string
  inviteExpire: number | null
  myRole: Role
  myVisibility: Visibility
}

export interface Member {
  userId: string
  nickname: string
  avatarEmoji: string | null
  avatarColor: string
  role: Role
  joinedAt: number
}

export interface Membership {
  id: string
  role: Role
  visibility: Visibility
}

interface GroupRow {
  id: string
  name: string
  owner_id: string
  invite_code: string
  invite_expire: number | null
  member_count: number
  created_at: number
}

function toGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    memberCount: row.member_count,
    createdAt: row.created_at,
  }
}

// ---------- 权限校验 ----------

/** 取成员关系，不是成员则 403。所有涉及群内数据的接口都必须先过这一关。 */
export async function assertMember(
  db: D1Database,
  groupId: string,
  userId: string,
): Promise<Membership> {
  const row = await db
    .prepare('SELECT id, role, visibility FROM memberships WHERE group_id = ? AND user_id = ?')
    .bind(groupId, userId)
    .first<{ id: string; role: Role; visibility: Visibility }>()

  if (!row) throw new ApiError('FORBIDDEN', '你不在这个群组里')
  return row
}

export async function assertOwner(
  db: D1Database,
  groupId: string,
  userId: string,
): Promise<void> {
  const membership = await assertMember(db, groupId, userId)
  if (membership.role !== 'owner') {
    throw new ApiError('FORBIDDEN', '只有群主可以进行这个操作')
  }
}

// ---------- 查询 ----------

async function findById(db: D1Database, groupId: string): Promise<GroupRow> {
  const row = await db
    .prepare('SELECT * FROM groups WHERE id = ?')
    .bind(groupId)
    .first<GroupRow>()

  if (!row) throw new ApiError('NOT_FOUND', '群组不存在')
  return row
}

export async function listMyGroups(db: D1Database, userId: string): Promise<Group[]> {
  const { results } = await db
    .prepare(
      `SELECT g.* FROM memberships m
       JOIN groups g ON g.id = m.group_id
       WHERE m.user_id = ?
       ORDER BY m.joined_at ASC`,
    )
    .bind(userId)
    .all<GroupRow>()

  return results.map(toGroup)
}

export async function getDetail(
  db: D1Database,
  groupId: string,
  userId: string,
): Promise<GroupDetail> {
  const membership = await assertMember(db, groupId, userId)
  const row = await findById(db, groupId)

  return {
    ...toGroup(row),
    inviteCode: row.invite_code,
    inviteExpire: row.invite_expire,
    myRole: membership.role,
    myVisibility: membership.visibility,
  }
}

export async function listMembers(db: D1Database, groupId: string): Promise<Member[]> {
  const { results } = await db
    .prepare(
      `SELECT u.id, u.nickname, u.avatar_emoji, u.avatar_color, m.role, m.joined_at
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ?
       ORDER BY m.joined_at ASC`,
    )
    .bind(groupId)
    .all<{
      id: string
      nickname: string
      avatar_emoji: string | null
      avatar_color: string
      role: Role
      joined_at: number
    }>()

  return results.map((r) => ({
    userId: r.id,
    nickname: r.nickname,
    avatarEmoji: r.avatar_emoji,
    avatarColor: r.avatar_color,
    role: r.role,
    joinedAt: r.joined_at,
  }))
}

/**
 * 邀请码预览（免登录）。只返回展示落地页所需的最少信息，
 * 不下发群组 id 等内部标识，避免未登录访客拿到可用于其他接口的句柄。
 */
export async function previewByInviteCode(
  db: D1Database,
  code: string,
  now: number,
): Promise<{ name: string; memberCount: number; ownerNickname: string }> {
  const row = await db
    .prepare(
      `SELECT g.name, g.member_count, g.invite_expire, u.nickname AS owner_nickname
       FROM groups g JOIN users u ON u.id = g.owner_id
       WHERE g.invite_code = ?`,
    )
    .bind(code)
    .first<{
      name: string
      member_count: number
      invite_expire: number | null
      owner_nickname: string
    }>()

  if (!row) throw new ApiError('INVITE_INVALID', '邀请码无效')
  if (row.invite_expire !== null && row.invite_expire <= now) {
    throw new ApiError('INVITE_INVALID', '邀请码已过期')
  }

  return {
    name: row.name,
    memberCount: row.member_count,
    ownerNickname: row.owner_nickname,
  }
}

// ---------- 写操作 ----------

export async function createGroup(
  db: D1Database,
  ownerId: string,
  name: string,
): Promise<Group> {
  const owned = await db
    .prepare("SELECT COUNT(*) AS n FROM memberships WHERE user_id = ? AND role = 'owner'")
    .bind(ownerId)
    .first<{ n: number }>()

  if ((owned?.n ?? 0) >= MAX_OWNED_GROUPS) {
    throw new ApiError('LIMIT_EXCEEDED', `最多只能创建 ${MAX_OWNED_GROUPS} 个群组`)
  }

  await assertJoinLimit(db, ownerId)

  const id = ulid()
  const now = nowSeconds()

  // 邀请码有 UNIQUE 约束，碰撞时换一个重试
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode()
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO groups
               (id, name, owner_id, invite_code, invite_expire, member_count, created_at, updated_at)
             VALUES (?, ?, ?, ?, NULL, 1, ?, ?)`,
          )
          .bind(id, name, ownerId, code, now, now),
        db
          .prepare(
            `INSERT INTO memberships (id, group_id, user_id, role, visibility, joined_at)
             VALUES (?, ?, ?, 'owner', 'full', ?)`,
          )
          .bind(ulid(), id, ownerId, now),
      ])

      return { id, name, ownerId, memberCount: 1, createdAt: now }
    } catch (err) {
      if (!(err instanceof Error) || !err.message.includes('UNIQUE')) throw err
    }
  }

  throw new ApiError('INTERNAL', '创建群组失败，请重试')
}

async function assertJoinLimit(db: D1Database, userId: string): Promise<void> {
  const joined = await db
    .prepare('SELECT COUNT(*) AS n FROM memberships WHERE user_id = ?')
    .bind(userId)
    .first<{ n: number }>()

  if ((joined?.n ?? 0) >= MAX_JOINED_GROUPS) {
    throw new ApiError('LIMIT_EXCEEDED', `最多只能加入 ${MAX_JOINED_GROUPS} 个群组`)
  }
}

export async function joinByInviteCode(
  db: D1Database,
  code: string,
  userId: string,
): Promise<Group> {
  const now = nowSeconds()
  const row = await db
    .prepare('SELECT * FROM groups WHERE invite_code = ?')
    .bind(code)
    .first<GroupRow>()

  if (!row) throw new ApiError('INVITE_INVALID', '邀请码无效')
  if (row.invite_expire !== null && row.invite_expire <= now) {
    throw new ApiError('INVITE_INVALID', '邀请码已过期')
  }

  const existing = await db
    .prepare('SELECT id FROM memberships WHERE group_id = ? AND user_id = ?')
    .bind(row.id, userId)
    .first()

  if (existing) throw new ApiError('ALREADY_MEMBER', '你已经在这个群组里了')
  if (row.member_count >= MAX_MEMBERS) {
    throw new ApiError('GROUP_FULL', `群组人数已满（上限 ${MAX_MEMBERS} 人）`)
  }
  await assertJoinLimit(db, userId)

  // 人数上限的检查与写入之间存在毫秒级竞态，理论上可能超出 1～2 人。
  // 对 3～20 人的熟人群来说危害为零，不值得为此引入条件更新加回滚的复杂度。
  await db.batch([
    db
      .prepare(
        `INSERT INTO memberships (id, group_id, user_id, role, visibility, joined_at)
         VALUES (?, ?, ?, 'member', 'full', ?)`,
      )
      .bind(ulid(), row.id, userId, now),
    db
      .prepare('UPDATE groups SET member_count = member_count + 1, updated_at = ? WHERE id = ?')
      .bind(now, row.id),
  ])

  return { ...toGroup(row), memberCount: row.member_count + 1 }
}

export async function leaveGroup(
  db: D1Database,
  groupId: string,
  userId: string,
): Promise<void> {
  const membership = await assertMember(db, groupId, userId)

  // 群主直接退群会留下无人管理的群组。要求先转让或解散，让归属始终明确。
  if (membership.role === 'owner') {
    throw new ApiError('FORBIDDEN', '你是群主，请先转让群主或解散群组')
  }

  await removeMembership(db, groupId, userId)
}

export async function removeMember(
  db: D1Database,
  groupId: string,
  targetUserId: string,
  operatorId: string,
): Promise<void> {
  await assertOwner(db, groupId, operatorId)

  if (targetUserId === operatorId) {
    throw new ApiError('FORBIDDEN', '不能移除自己，如需退出请解散或转让群主')
  }

  await assertMember(db, groupId, targetUserId)
  await removeMembership(db, groupId, targetUserId)
}

async function removeMembership(
  db: D1Database,
  groupId: string,
  userId: string,
): Promise<void> {
  await db.batch([
    db
      .prepare('DELETE FROM memberships WHERE group_id = ? AND user_id = ?')
      .bind(groupId, userId),
    db
      .prepare(
        `UPDATE groups SET member_count = MAX(member_count - 1, 0), updated_at = ?
         WHERE id = ?`,
      )
      .bind(nowSeconds(), groupId),
  ])
}

export async function transferOwner(
  db: D1Database,
  groupId: string,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  await assertOwner(db, groupId, fromUserId)

  if (fromUserId === toUserId) {
    throw new ApiError('INVALID_PARAM', '不能转让给自己')
  }
  await assertMember(db, groupId, toUserId)

  const now = nowSeconds()
  await db.batch([
    db
      .prepare("UPDATE memberships SET role = 'member' WHERE group_id = ? AND user_id = ?")
      .bind(groupId, fromUserId),
    db
      .prepare("UPDATE memberships SET role = 'owner' WHERE group_id = ? AND user_id = ?")
      .bind(groupId, toUserId),
    db
      .prepare('UPDATE groups SET owner_id = ?, updated_at = ? WHERE id = ?')
      .bind(toUserId, now, groupId),
  ])
}

export async function renameGroup(
  db: D1Database,
  groupId: string,
  userId: string,
  name: string,
): Promise<void> {
  await assertOwner(db, groupId, userId)
  await db
    .prepare('UPDATE groups SET name = ?, updated_at = ? WHERE id = ?')
    .bind(name, nowSeconds(), groupId)
    .run()
}

/** 解散群组。成员关系由外键级联删除，个人作息数据不受影响。 */
export async function deleteGroup(
  db: D1Database,
  groupId: string,
  userId: string,
): Promise<void> {
  await assertOwner(db, groupId, userId)
  await db.prepare('DELETE FROM groups WHERE id = ?').bind(groupId).run()
}

export async function refreshInviteCode(
  db: D1Database,
  groupId: string,
  userId: string,
  expireIn?: number,
): Promise<{ inviteCode: string; inviteExpire: number | null }> {
  await assertOwner(db, groupId, userId)

  const now = nowSeconds()
  const expire = expireIn ? now + expireIn : null

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode()
    try {
      await db
        .prepare('UPDATE groups SET invite_code = ?, invite_expire = ?, updated_at = ? WHERE id = ?')
        .bind(code, expire, now, groupId)
        .run()

      return { inviteCode: code, inviteExpire: expire }
    } catch (err) {
      if (!(err instanceof Error) || !err.message.includes('UNIQUE')) throw err
    }
  }

  throw new ApiError('INTERNAL', '刷新邀请码失败，请重试')
}

export async function updateVisibility(
  db: D1Database,
  groupId: string,
  userId: string,
  visibility: Visibility,
): Promise<void> {
  await assertMember(db, groupId, userId)
  await db
    .prepare('UPDATE memberships SET visibility = ? WHERE group_id = ? AND user_id = ?')
    .bind(visibility, groupId, userId)
    .run()
}
