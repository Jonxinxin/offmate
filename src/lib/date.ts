/**
 * 全系统日期工具。时区固定 Asia/Shanghai (UTC+8)，不随服务器或用户设备变化。
 * 日期一律用 'YYYY-MM-DD' 字符串表示——字典序即时间序。
 */

const CST_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

/** 北京时间的今天 */
export function today(): string {
  return new Date(Date.now() + CST_OFFSET_MS).toISOString().slice(0, 10)
}

export function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

export function addDays(date: string, days: number): string {
  const ms = new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS
  return new Date(ms).toISOString().slice(0, 10)
}

/** b - a，单位天。两个日期都按 UTC 零点解析，不受夏令时影响。 */
export function diffDays(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()
  return Math.round(ms / DAY_MS)
}

/** 0=周日 … 6=周六 */
export function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}
