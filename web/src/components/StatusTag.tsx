import type { ViewStatus } from '../types/api'
import { STATUS_STYLES } from '../lib/status'

/** 色点 + 文字。不能只靠颜色区分状态——色觉障碍用户看不出区别。 */
export function StatusTag({ status }: { status: ViewStatus }) {
  const style = STATUS_STYLES[status]

  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
      <span className={`text-sm ${status === 'unset' ? 'text-ink-soft' : 'text-ink'}`}>
        {style.label}
      </span>
    </span>
  )
}
