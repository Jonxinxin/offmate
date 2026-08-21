/** ID、邀请码、恢复码生成。全部基于 crypto.getRandomValues，不用 Math.random。 */

/** Crockford Base32：已排除 I / L / O / U */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
/** 邀请码字母表：在 Crockford 基础上再去掉 0 和 1，手输时不会与 O / I 混淆 */
const INVITE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

/** 从字母表按拒绝采样取 n 个字符，避免取模带来的分布偏斜 */
function randomString(n: number, alphabet: string): string {
  const max = Math.floor(256 / alphabet.length) * alphabet.length
  let out = ''
  while (out.length < n) {
    for (const byte of randomBytes(n * 2)) {
      if (byte >= max) continue
      out += alphabet[byte % alphabet.length]
      if (out.length === n) break
    }
  }
  return out
}

/**
 * ULID：26 字符，前 10 位为毫秒时间戳，后 16 位随机。
 * 相比 UUID 的好处是字典序即创建顺序，可直接用于排序和索引。
 */
export function ulid(): string {
  let ms = Date.now()
  let time = ''
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[ms % 32] + time
    ms = Math.floor(ms / 32)
  }
  return time + randomString(16, CROCKFORD)
}

/** 6 位邀请码 */
export function inviteCode(): string {
  return randomString(6, INVITE_ALPHABET)
}

/** 12 位恢复码，展示为 XXXX-XXXX-XXXX，约 60 bit 熵 */
export function recoveryCode(): string {
  const raw = randomString(12, CROCKFORD)
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
}

/** 归一化用户输入的恢复码：大写、去掉连字符与空格 */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

export async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const AVATAR_COLORS = [
  '#F59E0B', '#22C55E', '#3B82F6', '#6366F1',
  '#EC4899', '#14B8A6', '#EF4444', '#8B5CF6',
  '#0EA5E9', '#84CC16', '#F97316', '#06B6D4',
]

/** 按 id 稳定地分配头像底色，同一个 id 永远得到同一个颜色 */
export function avatarColorFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
