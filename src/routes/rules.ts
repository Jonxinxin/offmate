import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { ok } from '../lib/response'
import { jsonBody, queryParams } from '../lib/validator'
import { requireAuth } from '../middleware/auth'
import { putRuleSchema, deleteRuleQuerySchema, PRESETS } from '../schemas/rule'
import * as ruleService from '../services/rule.service'

export const rules = new Hono<AppEnv>()

/** 静态模板列表，前端用来渲染选项 */
rules.get('/rules/presets', (c) =>
  ok(c, {
    presets: Object.entries(PRESETS).map(([key, p]) => ({
      key,
      name: p.name,
      desc: p.desc,
      pattern: p.pattern,
    })),
  }),
)

rules.get('/rules/me', requireAuth, async (c) =>
  ok(c, { rule: await ruleService.getRule(c.env.DB, c.get('userId')) }),
)

rules.put('/rules/me', requireAuth, jsonBody(putRuleSchema), async (c) => {
  const result = await ruleService.saveRule(c.env.DB, c.get('userId'), c.req.valid('json'))
  return ok(c, result)
})

rules.delete('/rules/me', requireAuth, queryParams(deleteRuleQuerySchema), async (c) => {
  await ruleService.deleteRule(
    c.env.DB,
    c.get('userId'),
    c.req.valid('query').clearGenerated === 'true',
  )
  return ok(c, { deleted: true })
})
