import { api } from '../lib/request'
import type { Group, GroupDetail, Member, InvitePreview, Visibility } from '../types/api'

export const groupsApi = {
  list: () => api.get<{ groups: Group[] }>('/api/groups'),

  create: (name: string) => api.post<{ group: Group }>('/api/groups', { name }),

  detail: (id: string) =>
    api.get<{ group: GroupDetail; inviteUrl: string }>(`/api/groups/${id}`),

  rename: (id: string, name: string) =>
    api.patch<{ renamed: boolean }>(`/api/groups/${id}`, { name }),

  dissolve: (id: string) => api.del<{ deleted: boolean }>(`/api/groups/${id}`),

  join: (inviteCode: string) =>
    api.post<{ group: Group }>('/api/groups/join', { inviteCode }),

  leave: (id: string) => api.post<{ left: boolean }>(`/api/groups/${id}/leave`),

  members: (id: string) => api.get<{ members: Member[] }>(`/api/groups/${id}/members`),

  removeMember: (id: string, userId: string) =>
    api.del<{ removed: boolean }>(`/api/groups/${id}/members/${userId}`),

  transfer: (id: string, userId: string) =>
    api.post<{ transferred: boolean }>(`/api/groups/${id}/transfer`, { userId }),

  refreshInvite: (id: string, expireIn?: number) =>
    api.post<{ inviteCode: string; inviteExpire: number | null; inviteUrl: string }>(
      `/api/groups/${id}/invite/refresh`,
      { expireIn },
    ),

  setVisibility: (id: string, visibility: Visibility) =>
    api.patch<{ updated: boolean }>(`/api/groups/${id}/visibility`, { visibility }),

  /** 免登录，邀请落地页用 */
  preview: (code: string) =>
    api.get<InvitePreview>(`/api/groups/preview?code=${encodeURIComponent(code)}`),
}
