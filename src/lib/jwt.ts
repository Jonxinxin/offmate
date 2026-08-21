/**
 * HS256 JWT，用 Web Crypto 实现，不引入依赖。
 * payload 只放 { sub, iat, exp }——不放昵称等业务数据，避免 token 里的信息过期。
 */

/** token 有效期：180 天 */
export const TOKEN_TTL_SECONDS = 180 * 24 * 60 * 60
/** 剩余有效期低于 90 天时下发新 token（滑动续期） */
export const REFRESH_THRESHOLD_SECONDS = 90 * 24 * 60 * 60

export interface JwtPayload {
  sub: string
  iat: number
  exp: number
}

const encoder = new TextEncoder()

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
}

function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function signToken(
  userId: string,
  secret: string,
  nowSec: number,
): Promise<string> {
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const payload: JwtPayload = {
    sub: userId,
    iat: nowSec,
    exp: nowSec + TOKEN_TTL_SECONDS,
  }
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)))
  const data = `${header}.${body}`

  const key = await importKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))

  return `${data}.${base64UrlEncode(new Uint8Array(signature))}`
}

/** 验签并检查过期。任何问题一律返回 null，调用方不需要区分失败原因。 */
export async function verifyToken(
  token: string,
  secret: string,
  nowSec: number,
): Promise<JwtPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, body, signature] = parts
  const key = await importKey(secret)

  let valid: boolean
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signature),
      encoder.encode(`${header}.${body}`),
    )
  } catch {
    return null
  }
  if (!valid) return null

  let payload: JwtPayload
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)))
  } catch {
    return null
  }

  if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null
  if (payload.exp <= nowSec) return null

  return payload
}

export function shouldRefresh(payload: JwtPayload, nowSec: number): boolean {
  return payload.exp - nowSec < REFRESH_THRESHOLD_SECONDS
}
