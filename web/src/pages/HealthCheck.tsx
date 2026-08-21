import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/request'

interface Health {
  status: string
  db: string
  host: string
  today: string
  timestamp: number
}

/** M0 临时页：验证前端 → Worker → D1 整条链路是通的。M3 会被首页替换掉。 */
export function HealthCheck() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<Health>('/api/health'),
    retry: false,
  })

  return (
    <div className="mx-auto flex min-h-full max-w-[480px] flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">OffMate</h1>
      <p className="text-sm text-ink-soft">M0 骨架 · 链路自检</p>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {isLoading && <p className="text-sm text-ink-soft">检查中…</p>}

        {error && (
          <p className="text-sm text-red-600">
            后端不可达：{error instanceof Error ? error.message : String(error)}
          </p>
        )}

        {data && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-soft">服务</dt>
            <dd>{data.status}</dd>
            <dt className="text-ink-soft">数据库</dt>
            <dd className={data.db === 'connected' ? 'text-green-600' : 'text-red-600'}>
              {data.db}
            </dd>
            <dt className="text-ink-soft">今天</dt>
            <dd>{data.today}</dd>
            <dt className="text-ink-soft">域名</dt>
            <dd className="break-all">{data.host}</dd>
          </dl>
        )}
      </div>
    </div>
  )
}
