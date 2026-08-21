import { ApiError } from '../lib/response'
import { nowSeconds } from '../lib/date'
import {
  ulid,
  recoveryCode,
  normalizeRecoveryCode,
  sha256,
  avatarColorFor,
} from '../lib/id'

export interface User {
  id: string
  nickname: string
  avatarEmoji: string | null
  avatarColor: string
}

interface UserRow {
  id: string
  nickname: string
  avatar_emoji: string | null
  avatar_color: string
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    nickname: row.nickname,
    avatarEmoji: row.avatar_emoji,
    avatarColor: row.avatar_color,
  }
}

const SELECT_USER = 'SELECT id, nickname, avatar_emoji, avatar_color FROM users'

export async function createUser(
  db: D1Database,
  nickname: string,
  avatarEmoji: string | null,
): Promise<{ user: User; recoveryCode: string }> {
  const id = ulid()
  const now = nowSeconds()
  const color = avatarColorFor(id)

  // 恢复码有 UNIQUE 约束。60 bit 熵下碰撞概率极低，但仍重试几次而不是直接失败。
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = recoveryCode()
    const hash = await sha256(normalizeRecoveryCode(code))

    try {
      await db
        .prepare(
          `INSERT INTO users
             (id, nickname, avatar_emoji, avatar_color, recovery_code_hash,
              created_at, updated_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, nickname, avatarEmoji, color, hash, now, now, now)
        .run()

      return {
        user: { id, nickname, avatarEmoji, avatarColor: color },
        recoveryCode: code,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (!message.includes('UNIQUE')) throw err
    }
  }

  throw new ApiError('INTERNAL', '创建账号失败，请重试')
}

export async function findByRecoveryCode(
  db: D1Database,
  input: string,
): Promise<User | null> {
  const hash = await sha256(normalizeRecoveryCode(input))
  const row = await db
    .prepare(`${SELECT_USER} WHERE recovery_code_hash = ?`)
    .bind(hash)
    .first<UserRow>()

  return row ? toUser(row) : null
}

export async function getUser(db: D1Database, id: string): Promise<User> {
  const row = await db.prepare(`${SELECT_USER} WHERE id = ?`).bind(id).first<UserRow>()
  if (!row) throw new ApiError('NOT_FOUND', '账号不存在')
  return toUser(row)
}

export async function updateUser(
  db: D1Database,
  id: string,
  patch: { nickname?: string; avatarEmoji?: string | null },
): Promise<User> {
  const fields: string[] = []
  const values: (string | null)[] = []

  if (patch.nickname !== undefined) {
    fields.push('nickname = ?')
    values.push(patch.nickname)
  }
  if (patch.avatarEmoji !== undefined) {
    fields.push('avatar_emoji = ?')
    values.push(patch.avatarEmoji)
  }

  await db
    .prepare(`UPDATE users SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`)
    .bind(...values, nowSeconds(), id)
    .run()

  return getUser(db, id)
}

/** 重置恢复码，旧码立即失效。这是用户丢码后的唯一补救途径。 */
export async function resetRecoveryCode(db: D1Database, id: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = recoveryCode()
    const hash = await sha256(normalizeRecoveryCode(code))

    try {
      await db
        .prepare('UPDATE users SET recovery_code_hash = ?, updated_at = ? WHERE id = ?')
        .bind(hash, nowSeconds(), id)
        .run()
      return code
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (!message.includes('UNIQUE')) throw err
    }
  }

  throw new ApiError('INTERNAL', '重置恢复码失败，请重试')
}

/** 注销：外键 ON DELETE CASCADE 会连带清掉成员关系、作息和排班规律。 */
export async function deleteUser(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
}

export async function touchLastSeen(db: D1Database, id: string): Promise<void> {
  await db
    .prepare('UPDATE users SET last_seen_at = ? WHERE id = ?')
    .bind(nowSeconds(), id)
    .run()
}
