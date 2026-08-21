import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { ok } from '../lib/response'
import { today, nowSeconds } from '../lib/date'

export const health = new Hono<AppEnv>()

/** 联通性检查：同时验证 D1 绑定可用，避免"接口通了但数据库没绑上"的假成功。 */
health.get('/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>()

  return ok(c, {
    status: 'up',
    db: row?.ok === 1 ? 'connected' : 'unreachable',
    // Worker 实际看到的 hostname。部署后用它确认两个域名的 route 都绑对了。
    // 注意 wrangler dev 的代理会把它重写成 127.0.0.1，本地看不到真实值。
    host: new URL(c.req.url).hostname,
    today: today(),
    timestamp: nowSeconds(),
  })
})
