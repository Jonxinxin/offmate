import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { ok } from '../lib/response'
import { nowSeconds } from '../lib/date'
import { checkRateLimit, clientIp } from '../lib/rateLimit'
import { jsonBody, queryParams } from '../lib/validator'
import { requireAuth } from '../middleware/auth'
import {
  createGroupSchema,
  renameGroupSchema,
  joinGroupSchema,
  previewQuerySchema,
  transferSchema,
  visibilitySchema,
  refreshInviteSchema,
} from '../schemas/group'
import * as groupService from '../services/group.service'

export const groups = new Hono<AppEnv>()

/**
 * 认证逐个路由显式声明，而不是用 use('/groups/*') 统一挂。
 * 这里只有 preview 是免登录的，用通配中间件的话它能否豁免就取决于注册顺序——
 * 一次无心的顺序调整就会让公开接口变成需要登录，或者更糟，反过来。
 */

/** 邀请落地页用，免登录。限流防止有人拿它枚举邀请码。 */
groups.get('/groups/preview', queryParams(previewQuerySchema), async (c) => {
  const now = nowSeconds()
  await checkRateLimit(c.env.DB, `preview:${clientIp(c.req.raw)}`, 60, 3600, now)

  const preview = await groupService.previewByInviteCode(
    c.env.DB,
    c.req.valid('query').code,
    now,
  )
  return ok(c, preview)
})

groups.get('/groups', requireAuth, async (c) =>
  ok(c, { groups: await groupService.listMyGroups(c.env.DB, c.get('userId')) }),
)

groups.post('/groups', requireAuth, jsonBody(createGroupSchema), async (c) => {
  const group = await groupService.createGroup(
    c.env.DB,
    c.get('userId'),
    c.req.valid('json').name,
  )
  return ok(c, { group })
})

groups.post('/groups/join', requireAuth, jsonBody(joinGroupSchema), async (c) => {
  const group = await groupService.joinByInviteCode(
    c.env.DB,
    c.req.valid('json').inviteCode,
    c.get('userId'),
  )
  return ok(c, { group })
})

groups.get('/groups/:id', requireAuth, async (c) => {
  const group = await groupService.getDetail(c.env.DB, c.req.param('id'), c.get('userId'))
  return ok(c, { group, inviteUrl: `${c.env.WEB_ORIGIN}/join/${group.inviteCode}` })
})

groups.patch('/groups/:id', requireAuth, jsonBody(renameGroupSchema), async (c) => {
  await groupService.renameGroup(
    c.env.DB,
    c.req.param('id'),
    c.get('userId'),
    c.req.valid('json').name,
  )
  return ok(c, { renamed: true })
})

groups.delete('/groups/:id', requireAuth, async (c) => {
  await groupService.deleteGroup(c.env.DB, c.req.param('id'), c.get('userId'))
  return ok(c, { deleted: true })
})

groups.get('/groups/:id/members', requireAuth, async (c) => {
  const groupId = c.req.param('id')
  await groupService.assertMember(c.env.DB, groupId, c.get('userId'))
  return ok(c, { members: await groupService.listMembers(c.env.DB, groupId) })
})

groups.post('/groups/:id/leave', requireAuth, async (c) => {
  await groupService.leaveGroup(c.env.DB, c.req.param('id'), c.get('userId'))
  return ok(c, { left: true })
})

groups.delete('/groups/:id/members/:userId', requireAuth, async (c) => {
  await groupService.removeMember(
    c.env.DB,
    c.req.param('id'),
    c.req.param('userId'),
    c.get('userId'),
  )
  return ok(c, { removed: true })
})

groups.post('/groups/:id/transfer', requireAuth, jsonBody(transferSchema), async (c) => {
  await groupService.transferOwner(
    c.env.DB,
    c.req.param('id'),
    c.get('userId'),
    c.req.valid('json').userId,
  )
  return ok(c, { transferred: true })
})

groups.post(
  '/groups/:id/invite/refresh',
  requireAuth,
  jsonBody(refreshInviteSchema),
  async (c) => {
    const result = await groupService.refreshInviteCode(
      c.env.DB,
      c.req.param('id'),
      c.get('userId'),
      c.req.valid('json').expireIn,
    )
    return ok(c, { ...result, inviteUrl: `${c.env.WEB_ORIGIN}/join/${result.inviteCode}` })
  },
)

groups.patch('/groups/:id/visibility', requireAuth, jsonBody(visibilitySchema), async (c) => {
  await groupService.updateVisibility(
    c.env.DB,
    c.req.param('id'),
    c.get('userId'),
    c.req.valid('json').visibility,
  )
  return ok(c, { updated: true })
})
