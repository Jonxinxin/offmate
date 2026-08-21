/**
 * 统一请求层。
 *
 * - baseURL 为空时走同源（开发环境经 Vite proxy 转发到本地 Worker）
 * - 生产环境由 VITE_API_BASE 指向 https://omapi.988869.xyz
 * - 响应头 X-Refresh-Token 存在时静默替换本地 token（滑动续期）
 */

const BASE = import.meta.env.VITE_API_BASE ?? ''
const TOKEN_KEY = 'offmate.token'

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')

  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers })
  } catch {
    throw new ApiError('NETWORK', '网络连接失败，请检查网络后重试')
  }

  const refreshed = res.headers.get('X-Refresh-Token')
  if (refreshed) setToken(refreshed)

  if (res.status === 401) {
    clearToken()
    throw new ApiError('UNAUTHORIZED', '登录已失效')
  }

  let payload: ApiResponse<T>
  try {
    payload = await res.json()
  } catch {
    throw new ApiError('INTERNAL', '服务器返回了无法解析的内容')
  }

  if (!payload.ok) {
    throw new ApiError(payload.error.code, payload.error.message)
  }
  return payload.data
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
