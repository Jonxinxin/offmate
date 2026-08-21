import { z } from 'zod'
import { addDays, isValidDate, today } from '../lib/date'

/** 落库的状态。unset 不落库——查不到即未设置。 */
export const STATUSES = ['day', 'mid', 'night', 'off'] as const

/** 可见范围脱敏后可能出现的状态，work 表示"在上班但不透露具体班次" */
export const VIEW_STATUSES = [...STATUSES, 'work', 'unset'] as const

export type Status = (typeof STATUSES)[number]
export type ViewStatus = (typeof VIEW_STATUSES)[number]

/** 可编辑区间：过去 90 天到未来 365 天，防止误操作产生极端数据 */
export const PAST_LIMIT_DAYS = 90
export const FUTURE_LIMIT_DAYS = 365

/** 单次区间查询的最大跨度，避免一次拉走整年数据 */
const MAX_RANGE_DAYS = 400

const dateString = z.string().refine(isValidDate, '日期格式应为 YYYY-MM-DD')

export function assertEditableDate(date: string): void {
  const now = today()
  if (date < addDays(now, -PAST_LIMIT_DAYS) || date > addDays(now, FUTURE_LIMIT_DAYS)) {
    throw new z.ZodError([
      { code: 'custom', path: ['date'], message: '只能设置最近三个月到未来一年内的日期' },
    ])
  }
}

export const setScheduleSchema = z.object({
  status: z.enum(STATUSES, { errorMap: () => ({ message: '不支持的作息状态' }) }),
  note: z.string().trim().max(30, '备注最多 30 个字').nullable().optional(),
})

export const batchScheduleSchema = z.object({
  dates: z
    .array(dateString)
    .min(1, '请选择日期')
    .max(60, '一次最多设置 60 天'),
  status: z.enum(STATUSES, { errorMap: () => ({ message: '不支持的作息状态' }) }),
  note: z.string().trim().max(30, '备注最多 30 个字').nullable().optional(),
})

export const dayQuerySchema = z.object({ date: dateString })

export const rangeQuerySchema = z
  .object({ from: dateString, to: dateString })
  .refine((v) => v.from <= v.to, { message: '起始日期不能晚于结束日期' })
  .refine(
    (v) => {
      const span = (Date.parse(`${v.to}T00:00:00Z`) - Date.parse(`${v.from}T00:00:00Z`)) / 86400000
      return span <= MAX_RANGE_DAYS
    },
    { message: `一次最多查询 ${MAX_RANGE_DAYS} 天` },
  )

export const memberRangeQuerySchema = z
  .object({ groupId: z.string().trim().min(1, '缺少群组'), from: dateString, to: dateString })
  .refine((v) => v.from <= v.to, { message: '起始日期不能晚于结束日期' })
