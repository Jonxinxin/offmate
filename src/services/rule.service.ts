import { nowSeconds, today, addDays, diffDays, dayOfWeek } from '../lib/date'
import { ulid } from '../lib/id'
import { PRESETS, type PresetKey } from '../schemas/rule'
import type { Status } from '../schemas/schedule'

/** 规律向后生效的天数 */
const HORIZON_DAYS = 365

/**
 * 每个 batch 里放多少条语句。
 *
 * 注意 D1 的绑定参数上限是 100（比 SQLite 默认的 999 严格得多），所以这里用
 * 单行 INSERT（每条 5 个参数）而不是多行 VALUES——多行拼接很容易撞上限，
 * 报出来的是 "too many SQL variables"。batch 内是单个事务，分批只是控制单次
 * 请求体积。
 */
const BATCH_SIZE = 100

export interface ShiftRule {
  id: string
  type: 'preset' | 'custom'
  presetKey: PresetKey | null
  pattern: Status[]
  anchorDate: string
  name: string
}

interface RuleRow {
  id: string
  type: 'preset' | 'custom'
  preset_key: PresetKey | null
  pattern: string
  anchor_date: string
}

function toRule(row: RuleRow): ShiftRule {
  return {
    id: row.id,
    type: row.type,
    presetKey: row.preset_key,
    pattern: JSON.parse(row.pattern),
    anchorDate: row.anchor_date,
    name: row.preset_key ? PRESETS[row.preset_key].name : '自定义循环',
  }
}

/**
 * 推算某天的状态。
 *
 * 做五休二锚定星期而非循环长度——按 7 天循环算的话，用户改一次锚点日期就会
 * 错位成"周二到周六上班"，那显然不是他要的。
 */
export function statusOn(rule: Pick<ShiftRule, 'presetKey' | 'pattern' | 'anchorDate'>, date: string): Status {
  if (rule.presetKey === 'w5d2') {
    const dow = dayOfWeek(date)
    return dow === 0 || dow === 6 ? 'off' : 'day'
  }

  const offset = diffDays(rule.anchorDate, date)
  const len = rule.pattern.length
  // 锚点之前的日期 offset 为负，先取模再补正
  return rule.pattern[((offset % len) + len) % len]
}

export async function getRule(db: D1Database, userId: string): Promise<ShiftRule | null> {
  const row = await db
    .prepare(
      `SELECT id, type, preset_key, pattern, anchor_date
       FROM shift_rules WHERE user_id = ? AND active = 1`,
    )
    .bind(userId)
    .first<RuleRow>()

  return row ? toRule(row) : null
}

/**
 * 保存规律并物化未来 365 天。
 *
 * 采用物化而非查询时实时计算：读路径（首页、日期条）因此永远是简单的按日期查表，
 * 不需要在每次查询时区分"这条是手写的还是规律推出来的"。
 *
 * 手动记录永远优先：先只删 source='rule' 的未来记录，再用 DO NOTHING 插入，
 * 于是 source='manual' 的行会因主键冲突被跳过，原样保留。
 */
export async function saveRule(
  db: D1Database,
  userId: string,
  input: {
    type: 'preset' | 'custom'
    presetKey?: PresetKey
    pattern?: Status[]
    anchorDate?: string
  },
): Promise<{ rule: ShiftRule; generated: number }> {
  const now = nowSeconds()
  const start = today()
  const anchorDate = input.anchorDate ?? start

  const pattern: Status[] =
    input.type === 'preset'
      ? ([...PRESETS[input.presetKey!].pattern] as Status[])
      : input.pattern!

  const rule: ShiftRule = {
    id: ulid(),
    type: input.type,
    presetKey: input.presetKey ?? null,
    pattern,
    anchorDate,
    name: input.presetKey ? PRESETS[input.presetKey].name : '自定义循环',
  }

  // 一个用户同时只有一条生效规律，换规律即替换
  await db.batch([
    db.prepare('DELETE FROM shift_rules WHERE user_id = ?').bind(userId),
    db
      .prepare(
        `INSERT INTO shift_rules
           (id, user_id, type, preset_key, pattern, anchor_date, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        rule.id,
        userId,
        rule.type,
        rule.presetKey,
        JSON.stringify(pattern),
        anchorDate,
        now,
        now,
      ),
    db
      .prepare("DELETE FROM schedules WHERE user_id = ? AND source = 'rule' AND date >= ?")
      .bind(userId, start),
  ])

  const rows: { date: string; status: Status }[] = []
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const date = addDays(start, i)
    rows.push({ date, status: statusOn(rule, date) })
  }

  const insert = `INSERT INTO schedules (id, user_id, date, status, note, source, updated_at)
                  VALUES (?, ?, ?, ?, NULL, 'rule', ?)
                  ON CONFLICT(user_id, date) DO NOTHING`

  const statements = rows.map((r) =>
    db.prepare(insert).bind(ulid(), userId, r.date, r.status, now),
  )

  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    await db.batch(statements.slice(i, i + BATCH_SIZE))
  }

  return { rule, generated: rows.length }
}

/** 停用规律。clearGenerated 为真时一并删除它生成的未来记录，手动记录不受影响。 */
export async function deleteRule(
  db: D1Database,
  userId: string,
  clearGenerated: boolean,
): Promise<void> {
  const statements = [db.prepare('DELETE FROM shift_rules WHERE user_id = ?').bind(userId)]

  if (clearGenerated) {
    statements.push(
      db
        .prepare("DELETE FROM schedules WHERE user_id = ? AND source = 'rule' AND date >= ?")
        .bind(userId, today()),
    )
  }

  await db.batch(statements)
}
