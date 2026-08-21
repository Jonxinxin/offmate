import { Link } from 'react-router-dom'
import { card, page, pageBottomPlain } from '../lib/ui'

export function About() {
  return (
    <div className={`${page} gap-4 p-6 ${pageBottomPlain}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">关于 OffMate</h1>
        <Link to="/me" className="text-sm text-ink-soft">
          返回
        </Link>
      </div>

      <section className={card}>
        <p className="text-sm leading-relaxed">
          OffMate 是给朋友之间用的作息共享工具。把各自的班次和休息日放在同一个页面上，
          约人之前不用再一个个问「你明天休不休」。
        </p>
      </section>

      <section className={`${card} flex flex-col gap-3 text-sm leading-relaxed`}>
        <h2 className="font-medium">隐私</h2>
        <p>
          我们只保存你填写的昵称、头像和作息状态。
          <span className="font-medium">不收集手机号、邮箱、位置和通讯录</span>，
          也没有第三方统计代码。
        </p>
        <p>
          你的作息只在你加入的群组内可见，并且可以针对每个群单独设置可见范围——
          可以只显示忙闲，也可以完全隐藏。隐藏是在服务端生效的，别人拿不到被隐藏的内容。
        </p>
        <p>
          在「我的」页面可以随时注销账号，你的昵称、作息和群组关系会被一并删除，不保留备份。
        </p>
      </section>

      <section className={`${card} flex flex-col gap-3 text-sm leading-relaxed`}>
        <h2 className="font-medium">关于恢复码</h2>
        <p>
          OffMate 没有账号密码，你的身份保存在这个浏览器里。
          换手机、换浏览器，或者清理了浏览器数据之后，需要用恢复码找回。
        </p>
        <p className="text-ink-soft">
          特别提醒：在微信里打开和在浏览器里打开是两套独立的存储。
          同一个人从不同入口进来会被当成两个新用户，
          这时请用恢复码登录，不要重新创建身份，否则群里会出现两个你。
        </p>
      </section>

      <p className="pb-6 text-center text-xs text-ink-soft">
        数据存储在 Cloudflare · 无广告 · 不出售数据
      </p>
    </div>
  )
}
