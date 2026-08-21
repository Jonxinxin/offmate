import { useEffect, useState } from 'react'

/**
 * 离线提示条。
 *
 * 断网时必须明确告诉用户是网络问题，否则看到的是一份不再更新的缓存数据，
 * 会被当成"别人今天都没设置"——那是错误的结论。
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const online = () => setOffline(false)
    const down = () => setOffline(true)
    window.addEventListener('online', online)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="fixed left-0 right-0 top-0 z-50 bg-amber-500 py-1.5 text-center text-xs text-white">
      网络连接已断开，显示的是上次加载的内容
    </div>
  )
}
