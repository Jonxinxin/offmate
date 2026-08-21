import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: '今天', icon: '📅' },
  { to: '/schedule', label: '我的作息', icon: '🗓' },
  { to: '/me', label: '我', icon: '👤' },
]

/**
 * 底部导航。
 *
 * 高度不写死，由内容自然撑开——微信内置浏览器允许用户放大字体，
 * 固定高度会被撑破，图标和文字溢出到导航栏外面。
 *
 * 实际高度用 ResizeObserver 实测后写进 --tab-h，页面里的悬浮按钮据此避让
 * （见 lib/ui.ts 的 floatingAboveTab）。这样无论字号被放大到多少，
 * 悬浮按钮始终贴在导航栏上沿之上。
 */
export function TabBar() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const publish = () => {
      document.documentElement.style.setProperty('--tab-h', `${el.offsetHeight}px`)
    }
    publish()

    // 微信 Android 的 X5 内核版本可能没有 ResizeObserver，降级到 resize 事件。
    // 两者同时挂上没有副作用，publish 是幂等的。
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : null
    observer?.observe(el)

    window.addEventListener('resize', publish)
    window.addEventListener('orientationchange', publish)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', publish)
      window.removeEventListener('orientationchange', publish)
      // 卸载后恢复默认值，避免没有导航栏的页面留出多余空白
      document.documentElement.style.removeProperty('--tab-h')
    }
  }, [])

  return (
    <nav
      ref={ref}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-100 bg-white/95 backdrop-blur"
    >
      {/* 底部安全区：iPhone 的 home 横条会盖住内容 */}
      <div className="mx-auto flex max-w-[480px] pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 ` +
              `text-[11px] transition ${isActive ? 'text-ink' : 'text-ink-soft'}`
            }
          >
            {/*
              emoji 在不同系统字体下实际高度差别很大，给一个固定的行盒把它框住，
              免得某个平台上的字形把整条导航顶高。
            */}
            <span className="flex h-6 items-center text-lg leading-none">{tab.icon}</span>
            <span className="max-w-full truncate">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
