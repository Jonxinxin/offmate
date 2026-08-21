import type { ViewStatus } from '../types/api'

/**
 * 状态的文案与配色。
 *
 * 类名必须写成完整字面量，不能拼接（`bg-status-${status}`）——Tailwind 靠扫描
 * 源码文本收集类名，拼出来的类名它看不见，最终不会生成对应 CSS。
 */
interface StatusStyle {
  label: string
  /** 圆点/色块背景 */
  dot: string
  /** 日历格子等大面积浅底 */
  soft: string
  text: string
}

export const STATUS_STYLES: Record<ViewStatus, StatusStyle> = {
  off: {
    label: '休息',
    dot: 'bg-status-off',
    soft: 'bg-status-off/12',
    text: 'text-status-off',
  },
  day: {
    label: '白班',
    dot: 'bg-status-day',
    soft: 'bg-status-day/12',
    text: 'text-status-day',
  },
  mid: {
    label: '中班',
    dot: 'bg-status-mid',
    soft: 'bg-status-mid/12',
    text: 'text-status-mid',
  },
  night: {
    label: '晚班',
    dot: 'bg-status-night',
    soft: 'bg-status-night/12',
    text: 'text-status-night',
  },
  work: {
    label: '上班',
    dot: 'bg-status-work',
    soft: 'bg-status-work/12',
    text: 'text-status-work',
  },
  unset: {
    label: '未设置',
    dot: 'bg-status-unset',
    soft: 'bg-status-unset/12',
    text: 'text-status-unset',
  },
}

/** 可供用户选择的状态，顺序即选择面板的呈现顺序：先休息，因为最常用 */
export const SELECTABLE_STATUSES = ['off', 'day', 'mid', 'night'] as const

/** 首页分组：休息的人排最前，那才是用户最想看到的信息 */
export function groupKeyOf(status: ViewStatus): 'off' | 'work' | 'unset' {
  if (status === 'off') return 'off'
  if (status === 'unset') return 'unset'
  return 'work'
}
