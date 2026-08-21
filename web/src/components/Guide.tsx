import { useState } from 'react'
import { btnGhost, btnPrimary } from '../lib/ui'

/**
 * 首次使用引导。
 *
 * key 带版本号：以后功能有大改动时把版本号一提，老用户会再看一次，
 * 而不是永远停留在旧的说明上。
 */
const SEEN_KEY = 'offmate.guideSeen.v1'

export function hasSeenGuide(): boolean {
  return localStorage.getItem(SEEN_KEY) === '1'
}

export function markGuideSeen(): void {
  localStorage.setItem(SEEN_KEY, '1')
}

interface Step {
  icon: string
  title: string
  body: string
  /** 需要额外强调的提醒 */
  warn?: string
}

const STEPS: Step[] = [
  {
    icon: '📅',
    title: '打开就知道今天谁有空',
    body:
      '首页把群里的人按「休息 / 上班 / 未设置」分成三组，休息的人排最前。' +
      '顶部的日期条可以左右滑动，看未来两周的情况——日期下面的绿点表示那天有几个人休息，' +
      '绿点最多的那天最适合约人。',
  },
  {
    icon: '✏️',
    title: '设置自己的作息',
    body:
      '在首页点自己那一行，就能选白班、中班、晚班或休息，还可以写一句备注（比如「下午三点后有空」）。' +
      '如果要一次录一整周，去底部的「我的作息」，点「批量设置」后连续点选多个日期，一次改完。',
  },
  {
    icon: '🔁',
    title: '固定规律不用天天改',
    body:
      '做五休二、三班倒这类固定循环，在「我的」→「排班规律」里选一个模板，' +
      '或者自己定义一个 2 到 14 天的循环，未来一年就自动填好了。' +
      '临时调班时手动改那一天就行，你改过的日期不会被规律覆盖掉。',
  },
  {
    icon: '🔗',
    title: '叫上朋友一起用',
    body:
      '进群组页复制邀请链接发到微信群，朋友点开填个昵称就进来了，不用注册也不用下载。' +
      '当面加人可以直接让对方扫二维码。',
    warn:
      '你的身份保存在这个浏览器里，没有账号密码。换手机、换浏览器，或者清理了数据之后，' +
      '要用「恢复码」才能找回。恢复码在「我的」页面可以随时重新生成，建议现在就截图存好。' +
      '另外，在微信里打开和在浏览器里打开算两个互不相通的地方，换入口时请用恢复码登录，不要重新创建身份，否则群里会出现两个你。',
  },
]

export function Guide({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const step = STEPS[index]
  const isLast = index === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="关闭说明" />

      <div className="relative max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-[480px]">
          <div className="flex items-start justify-between">
            <span className="text-4xl leading-none">{step.icon}</span>
            <button className="text-sm text-ink-soft" onClick={onClose}>
              跳过
            </button>
          </div>

          <h2 className="mt-4 text-xl font-semibold">{step.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>

          {step.warn && (
            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
              {step.warn}
            </div>
          )}

          <div className="mt-6 flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-5 bg-ink' : 'w-1.5 bg-gray-200'
                }`}
              />
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            {index > 0 && (
              <button className={btnGhost} onClick={() => setIndex(index - 1)}>
                上一步
              </button>
            )}
            <button
              className={btnPrimary}
              onClick={() => (isLast ? onClose() : setIndex(index + 1))}
            >
              {isLast ? '开始使用' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
