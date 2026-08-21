/**
 * 共用样式片段。只是字符串常量，比包一层组件更轻，也不妨碍逐处微调。
 *
 * 颜色一律用 @theme 生成的语义类名（bg-ink、text-ink-soft）。
 * 不要写 bg-[--color-ink]：Tailwind v4 会把它输出成 background-color:--color-ink，
 * 缺少 var() 包装，属于无效 CSS，浏览器会静默丢弃。npm run build 会拦截这种写法。
 */

export const card = 'rounded-2xl bg-white p-5 shadow-sm'

export const btnPrimary =
  'flex h-12 w-full items-center justify-center rounded-xl bg-ink px-4 ' +
  'text-base font-medium text-white transition active:scale-[0.98] ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

export const btnGhost =
  'flex h-12 w-full items-center justify-center rounded-xl border border-gray-200 ' +
  'bg-white px-4 text-base font-medium text-ink transition active:scale-[0.98] ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

export const btnDanger =
  'flex h-12 w-full items-center justify-center rounded-xl border border-red-200 ' +
  'bg-white px-4 text-base font-medium text-red-600 transition active:scale-[0.98] ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

export const input =
  'h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base ' +
  'outline-none transition focus:border-gray-400'

/** 移动端优先：桌面端限宽居中，不单独做桌面布局 */
export const page = 'mx-auto flex min-h-full max-w-[480px] flex-col'

/**
 * 底部避让。
 *
 * 一律基于 --tab-h，那是 TabBar 用 ResizeObserver 实测写入的真实高度，
 * 不是写死的数字——微信内置浏览器可以放大字体，导航栏高度会跟着变，
 * 用固定值的话悬浮按钮就会被压住。
 *
 * 这些值必须写成完整字面量，Tailwind 靠扫描源码文本收集类名，
 * 拼接出来的类名它看不见。
 */

/** 悬浮在 TabBar 之上的操作按钮 */
export const floatingAboveTab =
  'fixed bottom-[calc(var(--tab-h)+1rem)] left-1/2 ' +
  'w-[calc(100%-3rem)] max-w-[432px] -translate-x-1/2'

/** 有 TabBar、且底部有悬浮按钮的页面：导航 + 按钮 + 呼吸空间 */
export const pageBottomFloating = 'pb-[calc(var(--tab-h)+5.5rem)]'

/** 有 TabBar、底部有较高悬浮操作条的页面（批量设置） */
export const pageBottomFloatingTall = 'pb-[calc(var(--tab-h)+9rem)]'

/** 只有 TabBar、没有悬浮元素的页面 */
export const pageBottomTab = 'pb-[calc(var(--tab-h)+1.5rem)]'

/** 没有 TabBar 的页面，仅避开系统手势条 */
export const pageBottomPlain = 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]'
