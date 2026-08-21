/** 客户端日期工具。时区固定 UTC+8，与服务端一致——不用设备本地时区，避免出国时错乱。 */

const CST_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function today(): string {
  return new Date(Date.now() + CST_OFFSET_MS).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

export function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function weekdayOf(date: string): string {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]
}

export function isWeekend(date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay()
  return d === 0 || d === 6
}

/** "8月21日 周四" */
export function formatFull(date: string): string {
  const [, m, d] = date.split('-')
  return `${Number(m)}月${Number(d)}日 周${weekdayOf(date)}`
}

/** 日期条上的短标签：今天/昨天/明天优先，其余显示日 */
export function shortLabel(date: string, base: string): string {
  const delta = diffDays(base, date)
  if (delta === 0) return '今天'
  if (delta === -1) return '昨天'
  if (delta === 1) return '明天'
  return String(Number(date.split('-')[2]))
}

/** 当月第一天 */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`
}

export function addMonths(date: string, delta: number): string {
  const [y, m] = date.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/** 该日期所在周的周一 */
export function weekStart(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  return addDays(date, dow === 0 ? -6 : 1 - dow)
}

/**
 * 月历网格：固定 6 行 × 7 列。
 * 固定行数是为了翻月时高度不跳变——2 月有时只占 5 行，跟着变会让整页抖一下。
 */
export function monthGrid(monthAnchor: string): string[] {
  const first = monthStart(monthAnchor)
  const dow = new Date(`${first}T00:00:00Z`).getUTCDay()
  // 周一为一周之首
  const gridStart = addDays(first, dow === 0 ? -6 : 1 - dow)
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

export function isSameMonth(date: string, anchor: string): boolean {
  return date.slice(0, 7) === anchor.slice(0, 7)
}

export function formatMonth(date: string): string {
  const [y, m] = date.split('-')
  return `${y} 年 ${Number(m)} 月`
}
