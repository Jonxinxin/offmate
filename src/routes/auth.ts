import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { ok, ApiError } from '../lib/response'
import { nowSeconds } from '../lib/date'
import { signToken } from '../lib/jwt'
import { checkRateLimit, clientIp } from '../lib/rateLimit'
import { jsonBody } from '../lib/validator'
import { requireAuth } from '../middleware/auth'
import { registerSchema, recoverSchema, updateMeSchema } from '../schemas/auth'
import * as authService from '../services/auth.service'
import * as groupService from '../services/group.service'

export const auth = new Hono<AppEnv>()

const HOUR = 3600

/**
 * 限流阈值放得比较宽，是因为按 IP 限流在国内移动网络下会误伤：
 * 运营商 CGNAT 让大量用户共享同一个出口 IP，阈值太低会把同小区的正常用户一起挡住。
 *
 * 这里防的是"有人写脚本批量刷"消耗 D1 额度，不是防恢复码爆破——
 * 恢复码有 60 bit 熵，穷举在数学上本来就不可行。
 */
const REGISTER_LIMIT = 20
const RECOVER_LIMIT = 30

/** 创建身份。恢复码仅在此处返回一次，之后任何接口都不再下发。 */
auth.post('/auth/register', jsonBody(registerSchema), async (c) => {
  const now = nowSeconds()
  await checkRateLimit(c.env.DB, `register:${clientIp(c.req.raw)}`, REGISTER_LIMIT, HOUR, now)

  const { nickname, avatarEmoji, inviteCode } = c.req.valid('json')

  const { user, recoveryCode } = await authService.createUser(
    c.env.DB,
    nickname,
    avatarEmoji ?? null,
  )

  // 从邀请链接进来的用户，注册后立即入群，省掉一次"注册完再手动加入"的往返。
  // 邀请码失效不应该让注册整体失败——身份已经创建好了，让用户进去后再手动加入。
  let joinedGroup = null
  if (inviteCode) {
    try {
      joinedGroup = await groupService.joinByInviteCode(c.env.DB, inviteCode, user.id)
    } catch (err) {
      if (!(err instanceof ApiError)) throw err
    }
  }

  return ok(c, {
    token: await signToken(user.id, c.env.JWT_SECRET, now),
    user,
    recoveryCode,
    joinedGroup,
  })
})

/** 恢复码登录：换设备后找回身份的唯一途径。 */
auth.post('/auth/recover', jsonBody(recoverSchema), async (c) => {
  const now = nowSeconds()
  await checkRateLimit(c.env.DB, `recover:${clientIp(c.req.raw)}`, RECOVER_LIMIT, HOUR, now)

  const user = await authService.findByRecoveryCode(c.env.DB, c.req.valid('json').recoveryCode)
  if (!user) {
    throw new ApiError('RECOVERY_INVALID', '恢复码不正确')
  }

  await authService.touchLastSeen(c.env.DB, user.id)

  return ok(c, {
    token: await signToken(user.id, c.env.JWT_SECRET, now),
    user,
  })
})

auth.get('/auth/me', requireAuth, async (c) => {
  const user = await authService.getUser(c.env.DB, c.get('userId'))
  await authService.touchLastSeen(c.env.DB, user.id)

  return ok(c, { user, groups: await groupService.listMyGroups(c.env.DB, user.id) })
})

auth.patch('/auth/me', requireAuth, jsonBody(updateMeSchema), async (c) => {
  const user = await authService.updateUser(c.env.DB, c.get('userId'), c.req.valid('json'))
  return ok(c, { user })
})

/** 重置恢复码。已登录设备即身份证明，因此不需要额外验证。 */
auth.post('/auth/recovery/reset', requireAuth, async (c) => {
  const recoveryCode = await authService.resetRecoveryCode(c.env.DB, c.get('userId'))
  return ok(c, { recoveryCode })
})

auth.delete('/auth/me', requireAuth, async (c) => {
  await authService.deleteUser(c.env.DB, c.get('userId'))
  return ok(c, { deleted: true })
})
