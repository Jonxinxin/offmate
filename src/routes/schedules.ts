import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../types'
import { ok, ApiError } from '../lib/response'
import { isValidDate } from '../lib/date'
import { jsonBody, queryParams } from '../lib/validator'
import { requireAuth } from '../middleware/auth'
import {
  setScheduleSchema,
  batchScheduleSchema,
  dayQuerySchema,
  rangeQuerySchema,
  memberRangeQuerySchema,
  assertEditableDate,
} from '../schemas/schedule'
import * as scheduleService from '../services/schedule.service'

export const schedules = new Hono<AppEnv>()

/** 路径里的 :date 不经过 zod，单独校验 */
function parseDateParam(date: string): string {
  if (!isValidDate(date)) throw new ApiError('INVALID_PARAM', '日期格式应为 YYYY-MM-DD')
  try {
    assertEditableDate(date)
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new ApiError('INVALID_PARAM', err.issues[0]?.message ?? '日期超出可设置范围')
    }
    throw err
  }
  return date
}

/** 首页主接口：群组某日全员状态 */
schedules.get(
  '/schedules/group/:groupId',
  requireAuth,
  queryParams(dayQuerySchema),
  async (c) => {
    const { members, summary } = await scheduleService.getGroupDay(
      c.env.DB,
      c.req.param('groupId'),
      c.req.valid('query').date,
      c.get('userId'),
    )
    return ok(c, { date: c.req.valid('query').date, groupId: c.req.param('groupId'), members, summary })
  },
)

/** 日期条：区间内每天的休息人数 */
schedules.get(
  '/schedules/group/:groupId/summary',
  requireAuth,
  queryParams(rangeQuerySchema),
  async (c) => {
    const { from, to } = c.req.valid('query')
    const counts = await scheduleService.getGroupSummary(
      c.env.DB,
      c.req.param('groupId'),
      from,
      to,
      c.get('userId'),
    )
    return ok(c, { counts })
  },
)

/** 成员详情：需同群，按对方的可见范围脱敏 */
schedules.get(
  '/schedules/user/:userId',
  requireAuth,
  queryParams(memberRangeQuerySchema),
  async (c) => {
    const { groupId, from, to } = c.req.valid('query')
    const result = await scheduleService.getMemberRange(
      c.env.DB,
      groupId,
      c.req.param('userId'),
      from,
      to,
      c.get('userId'),
    )
    return ok(c, result)
  },
)

schedules.get('/schedules/me', requireAuth, queryParams(rangeQuerySchema), async (c) => {
  const { from, to } = c.req.valid('query')
  return ok(c, await scheduleService.getMyRange(c.env.DB, c.get('userId'), from, to))
})

schedules.put(
  '/schedules/me/:date',
  requireAuth,
  jsonBody(setScheduleSchema),
  async (c) => {
    const { status, note } = c.req.valid('json')
    const entry = await scheduleService.setMyDay(
      c.env.DB,
      c.get('userId'),
      parseDateParam(c.req.param('date')),
      status,
      note ?? null,
    )
    return ok(c, { entry })
  },
)

schedules.delete('/schedules/me/:date', requireAuth, async (c) => {
  await scheduleService.clearMyDay(
    c.env.DB,
    c.get('userId'),
    parseDateParam(c.req.param('date')),
  )
  return ok(c, { cleared: true })
})

schedules.post(
  '/schedules/me/batch',
  requireAuth,
  jsonBody(batchScheduleSchema),
  async (c) => {
    const { dates, status, note } = c.req.valid('json')
    dates.forEach(parseDateParam)

    const count = await scheduleService.setMyDays(
      c.env.DB,
      c.get('userId'),
      [...new Set(dates)],
      status,
      note ?? null,
    )
    return ok(c, { count })
  },
)
