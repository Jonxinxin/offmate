import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { groupsApi } from '../api/groups'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from '../components/Avatar'
import { btnGhost, card, page, pageBottomPlain } from '../lib/ui'

export function GroupMembers() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const { me } = useAuth()
  const [acting, setActing] = useState<string | null>(null)

  const group = useQuery({
    queryKey: ['group', id],
    queryFn: () => groupsApi.detail(id),
    retry: false,
  })

  const members = useQuery({
    queryKey: ['members', id],
    queryFn: () => groupsApi.members(id),
    retry: false,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['members', id] })
    queryClient.invalidateQueries({ queryKey: ['group', id] })
    setActing(null)
  }

  const remove = useMutation({
    mutationFn: (userId: string) => groupsApi.removeMember(id, userId),
    onSuccess: invalidate,
  })

  const transfer = useMutation({
    mutationFn: (userId: string) => groupsApi.transfer(id, userId),
    onSuccess: invalidate,
  })

  const isOwner = group.data?.group.myRole === 'owner'
  const list = members.data?.members ?? []

  return (
    <div className={`${page} gap-4 p-6 ${pageBottomPlain}`}>
      <Link to={`/group/${id}`} className="text-sm text-ink-soft">
        ← 返回
      </Link>
      <h1 className="text-xl font-semibold">成员 {list.length ? `· ${list.length}` : ''}</h1>

      {members.isLoading && <p className="text-sm text-ink-soft">加载中…</p>}

      <div className="flex flex-col gap-2">
        {list.map((m) => {
          const isMe = m.userId === me?.user.id
          const expanded = acting === m.userId

          return (
            <div key={m.userId} className={card}>
              <div className="flex items-center gap-3">
                <Avatar
                  nickname={m.nickname}
                  emoji={m.avatarEmoji}
                  color={m.avatarColor}
                />
                <div className="flex-1">
                  <p className="font-medium">
                    {m.nickname}
                    {isMe && <span className="ml-1 text-xs text-ink-soft">（我）</span>}
                  </p>
                  {m.role === 'owner' && (
                    <p className="text-xs text-ink-soft">群主</p>
                  )}
                </div>

                {isOwner && !isMe && (
                  <button
                    className="text-sm text-ink-soft"
                    onClick={() => setActing(expanded ? null : m.userId)}
                  >
                    {expanded ? '收起' : '管理'}
                  </button>
                )}
              </div>

              {expanded && (
                <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
                  <button
                    className={btnGhost}
                    disabled={transfer.isPending}
                    onClick={() => transfer.mutate(m.userId)}
                  >
                    把群主转让给 {m.nickname}
                  </button>
                  <button
                    className="flex h-12 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-base font-medium text-red-600"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(m.userId)}
                  >
                    移出群组
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {(remove.error || transfer.error) && (
        <p className="text-sm text-red-600">
          {(remove.error ?? transfer.error) instanceof Error
            ? (remove.error ?? transfer.error)!.message
            : '操作失败'}
        </p>
      )}

      {isOwner && (
        <p className="text-xs leading-relaxed text-ink-soft">
          转让群主后你会变成普通成员，之后就可以退出群组了。
        </p>
      )}
    </div>
  )
}
