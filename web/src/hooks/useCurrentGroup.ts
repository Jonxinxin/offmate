import { useState } from 'react'
import type { Group } from '../types/api'

const KEY = 'offmate.currentGroupId'

/**
 * 当前查看的群组。选择持久化到 localStorage，下次进来还在同一个群。
 *
 * 存的 id 可能已经失效（退群、被移除、群被解散），所以每次都对着最新的
 * groups 列表校验一遍，失效时自动回退到第一个群，而不是让页面空掉。
 */
export function useCurrentGroup(groups: Group[]) {
  const [storedId, setStoredId] = useState(() => localStorage.getItem(KEY))

  const current = groups.find((g) => g.id === storedId) ?? groups[0] ?? null

  function select(id: string) {
    localStorage.setItem(KEY, id)
    setStoredId(id)
  }

  return { current, select }
}
