export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  /** 前端站点地址，用于拼接邀请链接 */
  WEB_ORIGIN: string
  /** API 域名，该域名下非 /api 请求一律 404 */
  API_HOST: string
  /** JWT 签名密钥，通过 wrangler secret 注入 */
  JWT_SECRET: string
}

/** Hono 上下文变量：认证中间件写入，业务路由读取 */
export interface Variables {
  userId: string
}

export type AppEnv = { Bindings: Env; Variables: Variables }
