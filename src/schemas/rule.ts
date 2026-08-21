import { z } from 'zod'
import { isValidDate } from '../lib/date'
import { STATUSES } from './schedule'

/**
 * 预设排班模板。
 *
 * w5d2 特殊：它锚定星期几而非循环周期，所以 pattern 为空，由 rule.service 单独处理。
 * 其余都是固定长度循环，配合 anchorDate 推算任意日期。
 */
export const PRESETS = {
  w5d2: { name: '做五休二', desc: '周一到周五上班，周末休息', pattern: [] as string[] },
  w6d1: { name: '做六休一', desc: '上六天休一天', pattern: ['day', 'day', 'day', 'day', 'day', 'day', 'off'] },
  w4d3: { name: '做四休三', desc: '上四天休三天', pattern: ['day', 'day', 'day', 'day', 'off', 'off', 'off'] },
  d1r1: { name: '上一休一', desc: '一天上班一天休息', pattern: ['day', 'off'] },
  d2r2: { name: '上二休二', desc: '上两天休两天', pattern: ['day', 'day', 'off', 'off'] },
  d3r1: { name: '上三休一', desc: '上三天休一天', pattern: ['day', 'day', 'day', 'off'] },
} as const

export type PresetKey = keyof typeof PRESETS

const dateString = z.string().refine(isValidDate, '日期格式应为 YYYY-MM-DD')

export const putRuleSchema = z
  .object({
    type: z.enum(['preset', 'custom'], { errorMap: () => ({ message: '不支持的规律类型' }) }),
    presetKey: z
      .enum(Object.keys(PRESETS) as [PresetKey, ...PresetKey[]], {
        errorMap: () => ({ message: '不支持的预设模板' }),
      })
      .optional(),
    pattern: z
      .array(z.enum(STATUSES, { errorMap: () => ({ message: '循环里含有不支持的状态' }) }))
      .min(2, '循环至少 2 天')
      .max(14, '循环最多 14 天')
      .optional(),
    /** 循环第 1 天对应的日期，省略则从今天算起 */
    anchorDate: dateString.optional(),
  })
  .refine((v) => v.type !== 'preset' || v.presetKey !== undefined, {
    message: '请选择预设模板',
  })
  .refine((v) => v.type !== 'custom' || (v.pattern?.length ?? 0) >= 2, {
    message: '请设置自定义循环',
  })
  .refine((v) => v.type !== 'custom' || v.pattern?.some((s) => s === 'off') !== false, {
    message: '循环里至少要有一天休息',
  })

export const deleteRuleQuerySchema = z.object({
  clearGenerated: z.enum(['true', 'false']).optional(),
})
