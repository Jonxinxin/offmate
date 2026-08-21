import { Hono } from 'hono'
import type { AppEnv, Env } from './types'
import { corsMiddleware } from './middleware/cors'
import { onError, onNotFound } from './middleware/error'
import { health } from './routes/health'
import { auth } from './routes/auth'
import { groups } from './routes/groups'
import { schedules } from './routes/schedules'
import { rules } from './routes/rules'

const api = new Hono<AppEnv>().basePath('/api')

api.use('*', corsMiddleware)
api.onError(onError)
api.notFound(onNotFound)

api.route('/', health)
api.route('/', auth)
api.route('/', groups)
api.route('/', schedules)
api.route('/', rules)

export default {
  /**
   * 单个 Worker 同时服务两个域名，按路径与 hostname 分流：
   *   /api/*              → Hono
   *   API 域名的其他路径   → 404（API 域名不托管页面）
   *   其余                → 静态资源（SPA fallback 由 wrangler.toml 配置）
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api')) {
      return api.fetch(request, env, ctx)
    }

    if (url.hostname === env.API_HOST) {
      return new Response('Not Found', { status: 404 })
    }

    return env.ASSETS.fetch(request)
  },
}
