import { ApiError } from './response'

/**
 * 固定窗口限流。窗口过期即重置计数。
 *
 * 选固定窗口而非滑动窗口：实现只需一次读 + 一次写，边界处最多放行两倍请求，
 * 对"防脚本批量尝试"这个目标完全够用，不值得为精确性增加复杂度。
 */
export async function checkRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
  nowSec: number,
): Promise<void> {
  const row = await db
    .prepare('SELECT count, window_start FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<{ count: number; window_start: number }>()

  const expired = !row || nowSec - row.window_start >= windowSeconds

  if (expired) {
    await db
      .prepare(
        `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start`,
      )
      .bind(key, nowSec)
      .run()
    return
  }

  if (row.count >= limit) {
    const retryIn = Math.ceil((row.window_start + windowSeconds - nowSec) / 60)
    throw new ApiError('RATE_LIMITED', `操作太频繁，请 ${retryIn} 分钟后再试`)
  }

  await db
    .prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?')
    .bind(key)
    .run()
}

/** 取客户端 IP。Cloudflare always sets CF-Connecting-IP；本地开发时回落到固定值。 */
export function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') ?? 'local'
}
