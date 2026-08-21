import { useState } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { btnPrimary, card, page } from '../lib/ui'

/**
 * 恢复码强制留存页。
 *
 * 这一页是产品级必需品，不是可选提示：网页版的身份存在浏览器里，微信内置浏览器
 * 与系统浏览器的存储完全隔离，用户清理微信存储也会丢身份。恢复码是唯一的找回途径。
 * 因此必须勾选确认才能继续。
 */
export function RecoveryCode() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const code = (state as { code?: string } | null)?.code

  const [saved, setSaved] = useState(false)
  const [copyHint, setCopyHint] = useState<string | null>(null)

  // 直接访问或刷新后 state 丢失。此时用户已登录，可在「我的」页重置恢复码。
  if (!code) return <Navigate to="/" replace />

  async function copy() {
    try {
      await navigator.clipboard.writeText(code!)
      setCopyHint('已复制')
    } catch {
      // 微信内置浏览器和非 HTTPS 环境下 clipboard API 可能不可用
      setCopyHint('复制失败，请长按上方文字手动复制或截图')
    }
  }

  return (
    <div className={`${page} justify-between p-6`}>
      <div className="flex flex-col gap-5 pt-10">
        <div>
          <h1 className="text-2xl font-semibold">保存你的恢复码</h1>
          <p className="mt-1 text-sm text-ink-soft">
            换手机、换浏览器时，靠它找回你的身份
          </p>
        </div>

        <div className={`${card} flex flex-col items-center gap-4 py-8`}>
          <p className="select-all font-mono text-2xl font-semibold tracking-widest">
            {code}
          </p>
          <button
            onClick={copy}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-ink"
          >
            复制
          </button>
          {copyHint && <p className="text-xs text-ink-soft">{copyHint}</p>}
        </div>

        <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          <p className="font-medium">这串码只显示这一次</p>
          <p className="mt-1.5">
            建议截图保存，或发给自己的微信文件传输助手。丢了也不要紧——只要还能打开
            OffMate，就能在「我的」页面重新生成一个。
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="h-5 w-5 rounded"
          />
          我已经保存好了
        </label>
        <button
          className={btnPrimary}
          disabled={!saved}
          onClick={() => navigate('/', { replace: true })}
        >
          进入 OffMate
        </button>
      </div>
    </div>
  )
}
