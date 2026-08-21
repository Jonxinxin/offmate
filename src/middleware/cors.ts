import { cors } from 'hono/cors'

/**
 * 前端在 om.988869.xyz，API 在 omapi.988869.xyz，属于跨源请求。
 *
 * exposeHeaders 中的 X-Refresh-Token 不能漏：滑动续期靠这个响应头下发新 token，
 * 跨域下不显式 expose 的话前端读不到，续期会静默失效。
 */
export const corsMiddleware = cors({
  origin: ['https://om.988869.xyz', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Refresh-Token'],
  maxAge: 86400,
})
