import { api } from '../lib/request'
import type { GroupDayResult, ScheduleEntry, Status } from '../types/api'

export const schedulesApi = {
  groupDay: (groupId: string, date: string) =>
    api.get<GroupDayResult>(`/api/schedules/group/${groupId}?date=${date}`),

  /** 日期条：区间内每天的休息人数 */
  groupSummary: (groupId: string, from: string, to: string) =>
    api.get<{ counts: Record<string, number> }>(
      `/api/schedules/group/${groupId}/summary?from=${from}&to=${to}`,
    ),

  memberRange: (userId: string, groupId: string, from: string, to: string) =>
    api.get<{ entries: ScheduleEntry[] }>(
      `/api/schedules/user/${userId}?groupId=${groupId}&from=${from}&to=${to}`,
    ),

  myRange: (from: string, to: string) =>
    api.get<{ entries: ScheduleEntry[] }>(`/api/schedules/me?from=${from}&to=${to}`),

  setDay: (date: string, status: Status, note?: string | null) =>
    api.put<{ entry: ScheduleEntry }>(`/api/schedules/me/${date}`, { status, note }),

  clearDay: (date: string) => api.del<{ cleared: boolean }>(`/api/schedules/me/${date}`),

  setDays: (dates: string[], status: Status, note?: string | null) =>
    api.post<{ count: number }>('/api/schedules/me/batch', { dates, status, note }),
}
