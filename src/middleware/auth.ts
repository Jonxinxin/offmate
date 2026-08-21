import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types'
import { ApiError } from '../lib/response'
import { nowSeconds } from '../lib/date'
import { signToken, verifyToken, shouldRefresh } from '../lib/jwt'

/**
 * 校验 Bearer token，把 userId 写入上下文。
 *
 * 同时实现滑动续期：token 剩余有效期不足时，通过 X-Refresh-Token 响应头下发新 token。
 * 跨域下该头必须在 CORS 的 exposeHeaders 中声明，否则前端读不到，续期会静默失效。
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError('UNAUTHORIZED', '请先登录')
  }

  const now = nowSeconds()
  const payload = await verifyToken(header.slice(7), c.env.JWT_SECRET, now)
  if (!payload) {
    throw new ApiError('UNAUTHORIZED', '登录已失效，请重新登录')
  }

  c.set('userId', payload.sub)
  await next()

  if (shouldRefresh(payload, now)) {
    c.res.headers.set('X-Refresh-Token', await signToken(payload.sub, c.env.JWT_SECRET, now))
  }
})
