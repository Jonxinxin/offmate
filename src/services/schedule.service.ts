import { ApiError } from '../lib/response'
import { nowSeconds } from '../lib/date'
import { ulid } from '../lib/id'
import type { Status, ViewStatus } from '../schemas/schedule'
import type { Role, Visibility } from './group.service'
import { assertMember } from './group.service'

export interface DayMember {
  userId: string
  nickname: string
  avatarEmoji: string | null
  avatarColor: string
  role: Role
  isMe: boolean
  status: ViewStatus
  note: string | null
}

export interface ScheduleEntry {
  date: string
  status: ViewStatus
  note: string | null
}

/**
 * 按可见范围脱敏。
 *
 * 必须在服务端完成——客户端不应该拿到被隐藏的原始班次，否则"隐藏"只是界面上的
 * 障眼法，翻一下网络响应就穿帮了。
 *
 * 自己看自己永远不脱敏，否则设了隐藏之后连自己都看不见自己的排班。
 */
function applyVisibility(
  status: Status | null,
  note: string | null,
  visibility: Visibility,
  isMe: boolean,
): { status: ViewStatus; note: string | null } {
  if (status === null) return { status: 'unset', note: null }
  if (isMe || visibility === 'full') return { status, note }
  if (visibility === 'hidden') return { status: 'unset', note: null }

  // busy_only：保留休息与否，抹掉具体是哪个班次
  return { status: status === 'off' ? 'off' : 'work', note: null }
}

export async function getGroupDay(
  db: D1Database,
  groupId: string,
  date: string,
  requesterId: string,
): Promise<{ members: DayMember[]; summary: { off: number; work: number; unset: number } }> {
  await assertMember(db, groupId, requesterId)

  const { results } = await db
    .prepare(
      `SELECT u.id, u.nickname, u.avatar_emoji, u.avatar_color,
              m.role, m.visibility, s.status, s.note
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN schedules s ON s.user_id = m.user_id AND s.date = ?
       WHERE m.group_id = ?
       ORDER BY m.joined_at ASC`,
    )
    .bind(date, groupId)
    .all<{
      id: string
      nickname: string
      avatar_emoji: string | null
      avatar_color: string
      role: Role
      visibility: Visibility
      status: Status | null
      note: string | null
    }>()

  const summary = { off: 0, work: 0, unset: 0 }

  const members = results.map((r) => {
    const isMe = r.id === requesterId
    const view = applyVisibility(r.status, r.note, r.visibility, isMe)

    if (view.status === 'unset') summary.unset++
    else if (view.status === 'off') summary.off++
    else summary.work++

    return {
      userId: r.id,
      nickname: r.nickname,
      avatarEmoji: r.avatar_emoji,
      avatarColor: r.avatar_color,
      role: r.role,
      isMe,
      status: view.status,
      note: view.note,
    }
  })

  return { members, summary }
}

/**
 * 日期条用的每日休息人数。
 *
 * 排除设为 hidden 的成员，否则聚合数字会把他们藏起来的信息漏出去。
 * 但请求者自己始终计入，不然自己明明休息却不体现在概览里，会以为是 bug。
 */
export async function getGroupSummary(
  db: D1Database,
  groupId: string,
  from: string,
  to: string,
  requesterId: string,
): Promise<Record<string, number>> {
  await assertMember(db, groupId, requesterId)

  const { results } = await db
    .prepare(
      `SELECT s.date, COUNT(*) AS off_count
       FROM memberships m
       JOIN schedules s ON s.user_id = m.user_id
       WHERE m.group_id = ?
         AND s.date BETWEEN ? AND ?
         AND s.status = 'off'
         AND (m.visibility != 'hidden' OR m.user_id = ?)
       GROUP BY s.date`,
    )
    .bind(groupId, from, to, requesterId)
    .all<{ date: string; off_count: number }>()

  return Object.fromEntries(results.map((r) => [r.date, r.off_count]))
}

/** 某成员的区间作息。要求请求者与目标同群，并按目标在该群的可见范围脱敏。 */
export async function getMemberRange(
  db: D1Database,
  groupId: string,
  targetUserId: string,
  from: string,
  to: string,
  requesterId: string,
): Promise<{ entries: ScheduleEntry[] }> {
  await assertMember(db, groupId, requesterId)
  const target = await assertMember(db, groupId, targetUserId)

  const { results } = await db
    .prepare(
      `SELECT date, status, note FROM schedules
       WHERE user_id = ? AND date BETWEEN ? AND ?
       ORDER BY date ASC`,
    )
    .bind(targetUserId, from, to)
    .all<{ date: string; status: Status; note: string | null }>()

  const isMe = targetUserId === requesterId

  const entries = results
    .map((r) => ({ date: r.date, ...applyVisibility(r.status, r.note, target.visibility, isMe) }))
    // hidden 的记录脱敏后变成 unset，等同于没有记录，不必下发
    .filter((e) => e.status !== 'unset')

  return { entries }
}

export async function getMyRange(
  db: D1Database,
  userId: string,
  from: string,
  to: string,
): Promise<{ entries: ScheduleEntry[] }> {
  const { results } = await db
    .prepare(
      `SELECT date, status, note FROM schedules
       WHERE user_id = ? AND date BETWEEN ? AND ?
       ORDER BY date ASC`,
    )
    .bind(userId, from, to)
    .all<{ date: string; status: Status; note: string | null }>()

  return { entries: results }
}

/**
 * 设置某天。
 *
 * source 一律写 manual：用户手动改过的日期，之后排班规律重算时不再覆盖它。
 */
export async function setMyDay(
  db: D1Database,
  userId: string,
  date: string,
  status: Status,
  note: string | null,
): Promise<ScheduleEntry> {
  await db
    .prepare(
      `INSERT INTO schedules (id, user_id, date, status, note, source, updated_at)
       VALUES (?, ?, ?, ?, ?, 'manual', ?)
       ON CONFLICT(user_id, date) DO UPDATE SET
         status = excluded.status,
         note = excluded.note,
         source = 'manual',
         updated_at = excluded.updated_at`,
    )
    .bind(ulid(), userId, date, status, note, nowSeconds())
    .run()

  return { date, status, note }
}

export async function setMyDays(
  db: D1Database,
  userId: string,
  dates: string[],
  status: Status,
  note: string | null,
): Promise<number> {
  const now = nowSeconds()

  // D1 的 batch 在单个事务中执行，要么全部生效要么全部不生效
  await db.batch(
    dates.map((date) =>
      db
        .prepare(
          `INSERT INTO schedules (id, user_id, date, status, note, source, updated_at)
           VALUES (?, ?, ?, ?, ?, 'manual', ?)
           ON CONFLICT(user_id, date) DO UPDATE SET
             status = excluded.status,
             note = excluded.note,
             source = 'manual',
             updated_at = excluded.updated_at`,
        )
        .bind(ulid(), userId, date, status, note, now),
    ),
  )

  return dates.length
}

/** 清除某天，恢复为"未设置"。删除记录而不是写一个 unset 状态。 */
export async function clearMyDay(
  db: D1Database,
  userId: string,
  date: string,
): Promise<void> {
  const result = await db
    .prepare('DELETE FROM schedules WHERE user_id = ? AND date = ?')
    .bind(userId, date)
    .run()

  if (result.meta.changes === 0) {
    throw new ApiError('NOT_FOUND', '这一天本来就没有设置')
  }
}
