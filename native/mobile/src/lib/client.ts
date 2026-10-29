import type { UserBilling, UserPlanId } from '@domain/lib/plans'
import type { Attachment, Profile, Tag, Task, TaskComment, TaskStatus, Team, TeamMember, TeamRole } from '@domain/types'
import { api, upload, type PickedFile } from './api'

/**
 * Cliente tipado de la API del servidor. Una función por operación, con los mismos nombres que los casos de uso
 * de `src/server/usecases`: es el único sitio de la app que conoce las rutas HTTP.
 */
export interface TaskInput {
  title: string
  description?: string | null
  due_date?: string | null
  image_url?: string | null
  assigned_to?: string | null
  tag_ids?: string[]
}

export interface NotificationPrefs {
  enabled: boolean
  due_soon: boolean
  assigned: boolean
  offsets_minutes: number[]
  quiet_start: string | null
  quiet_end: string | null
  timezone: string
}
export interface NotificationState { publicKey: string | null; fcm: boolean; prefs: NotificationPrefs; devices: number; allowedOffsets: number[]; maxOffsets: number }

export interface InviteInfo { id: string; role: TeamRole; expires_at: string; created_at: string }

export const apiClient = {
  me: () => api<Profile>('GET', '/me'),
  updateProfile: (changes: { full_name?: string; avatar_url?: string | null }) => api<Profile>('PATCH', '/me', changes),
  setPassword: (password: string) => api<null>('POST', '/me/password', { password }),
  uploadAvatar: (file: PickedFile) => upload<string>('/uploads/avatar', file),
  providers: () => api<string[]>('GET', '/auth/providers'),
  billing: () => api<UserBilling>('GET', '/me/billing'),
  startTrial: (plan: UserPlanId) => api<null>('POST', '/me/billing/trial', { plan }),

  teams: () => api<Team[]>('GET', '/teams'),
  createTeam: (name: string) => api<Team>('POST', '/teams', { name }),
  deleteTeam: (teamId: string) => api<null>('DELETE', `/teams/${teamId}`),
  members: (teamId: string) => api<TeamMember[]>('GET', `/teams/${teamId}/members`),
  addMember: (teamId: string, email: string, role: TeamRole) => api<null>('POST', `/teams/${teamId}/members`, { email, role }),
  changeMemberRole: (teamId: string, userId: string, role: TeamRole) => api<null>('PATCH', `/teams/${teamId}/members/${userId}`, { role }),
  removeMember: (teamId: string, userId: string) => api<null>('DELETE', `/teams/${teamId}/members/${userId}`),
  invites: (teamId: string) => api<InviteInfo[]>('GET', `/teams/${teamId}/invites`),
  createInvite: (teamId: string, role: 'member' | 'product_owner') => api<{ token: string; invite: InviteInfo }>('POST', `/teams/${teamId}/invites`, { role }),
  revokeInvite: (inviteId: string) => api<null>('DELETE', `/invites/${inviteId}`),

  tasks: (teamId: string) => api<Task[]>('GET', `/teams/${teamId}/tasks`),
  createTask: (teamId: string, input: TaskInput) => api<{ id: string }>('POST', `/teams/${teamId}/tasks`, input),
  updateTask: (taskId: string, patch: Partial<TaskInput>) => api<null>('PATCH', `/tasks/${taskId}`, patch),
  moveTask: (taskId: string, target: { status: TaskStatus; prevId?: string | null; nextId?: string | null }) => api<null>('POST', `/tasks/${taskId}/move`, target),
  deleteTask: (taskId: string) => api<null>('DELETE', `/tasks/${taskId}`),
  uploadCover: (file: PickedFile) => upload<string>('/uploads/cover', file),

  tags: (teamId: string) => api<Tag[]>('GET', `/teams/${teamId}/tags`),
  createTag: (teamId: string, input: { name: string; color?: string; parent_id?: string | null }) => api<Tag>('POST', `/teams/${teamId}/tags`, input),
  updateTag: (tagId: string, patch: { name?: string; color?: string }) => api<Tag>('PATCH', `/tags/${tagId}`, patch),
  deleteTag: (tagId: string) => api<null>('DELETE', `/tags/${tagId}`),

  comments: (taskId: string) => api<TaskComment[]>('GET', `/tasks/${taskId}/comments`),
  createComment: (taskId: string, content: string, parentId: string | null) => api<TaskComment>('POST', `/tasks/${taskId}/comments`, { content, parent_id: parentId }),
  deleteComment: (commentId: string) => api<null>('DELETE', `/comments/${commentId}`),

  notifications: () => api<NotificationState>('GET', '/notifications'),
  updatePrefs: (prefs: NotificationPrefs) => api<NotificationPrefs>('PUT', '/notifications/prefs', prefs),
  registerDevice: (input: { token: string; userAgent: string; timezone: string }) => api<{ devices: number }>('POST', '/notifications/devices', input),
  unregisterDevice: (token: string) => api<{ devices: number }>('DELETE', '/notifications/devices', { endpoint: token }),
  testPush: () => api<{ sent: number; failed: number }>('POST', '/notifications/test'),

  attachments: (taskId: string) => api<Attachment[]>('GET', `/tasks/${taskId}/attachments`),
  uploadAttachment: (file: PickedFile, target: { taskId?: string; commentId?: string }) => upload<Attachment>('/attachments', file, target as Record<string, string>),
  deleteAttachment: (attachmentId: string) => api<null>('DELETE', `/attachments/${attachmentId}`),
}
