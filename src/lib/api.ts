'use client'

/**
 * Cliente de las server actions. Mantiene la forma de las antiguas utilidades de datos para que los
 * componentes no cambien: los errores se muestran como aviso y la función devuelve un valor vacío.
 */
import type { Attachment, BoardColumn, Profile, Subtask, Tag, Task, TaskComment, TaskStatus, Team, TeamMember, TeamRole } from '@/types'
import * as commentsA from '@/server/actions/comments'
import * as profileA from '@/server/actions/profile'
import * as tagsA from '@/server/actions/tags'
import * as tasksA from '@/server/actions/tasks'
import * as teamsA from '@/server/actions/teams'
import * as templatesA from '@/server/actions/templates'
import * as subtasksA from '@/server/actions/subtasks'
import * as columnsA from '@/server/actions/columns'
import * as invitesA from '@/server/actions/invites'
import type { Result } from '@/server/actions/run'
import { reportError } from './upgrade'
import { rememberName } from './avatar'

/** Devuelve el dato o lanza con el mensaje del servidor. */
export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(r.error)
  return r.data
}

/** Devuelve el dato o muestra el error y devuelve `fallback`. */
async function soft<T, F>(p: Promise<Result<T>>, fallback: F): Promise<T | F> {
  const r = await p
  if (r.ok) return r.data
  reportError(r)
  return fallback
}

/* ---------- Equipos ---------- */
export const fetchUserTeams = (): Promise<Team[]> => soft(teamsA.listTeamsAction(), [] as Team[])
export async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  const members = await soft(teamsA.listMembersAction(teamId), [] as TeamMember[])
  members.forEach((m) => rememberName(m.user_id, m.profile?.full_name))
  return members
}
export const createNewTeam = (name: string): Promise<Team | null> => soft(teamsA.createTeamAction(name), null)

export async function inviteMemberByEmail(teamId: string, email: string, role: TeamRole = 'member') {
  const r = await teamsA.inviteMemberAction(teamId, email, role)
  if (!r.ok && r.code === 'LIMIT') reportError(r) // además del mensaje en el propio formulario
  return r.ok ? { success: true } : { success: false, error: r.error }
}
export const removeTeamMember = async (teamId: string, userId: string) => (await soft(teamsA.removeMemberAction(teamId, userId), false)) !== false
export const updateMemberRole = async (teamId: string, userId: string, role: TeamRole) =>
  (await soft(teamsA.updateMemberRoleAction(teamId, userId, role), false)) !== false

export interface InviteInfo { id: string; role: TeamRole; expires_at: string; created_at: string }
export const fetchInvites = (teamId: string): Promise<InviteInfo[]> => soft(invitesA.listInvitesAction(teamId), [] as InviteInfo[])
export async function createInviteLink(teamId: string, role: 'member' | 'product_owner'): Promise<string | null> {
  const r = await soft(invitesA.createInviteAction(teamId, role), null)
  return r ? `${window.location.origin}/invite/${r.token}` : null
}
export const revokeInvite = async (id: string) => (await soft(invitesA.revokeInviteAction(id), false)) !== false

/* ---------- Tareas ---------- */
export async function fetchTasks(teamId: string): Promise<Task[] | null> {
  const tasks = await soft(tasksA.listTasksAction(teamId), null)
  tasks?.forEach((t) => rememberName(t.assigned_to, t.assignee?.full_name))
  return tasks
}

export interface NewTaskPayload {
  title: string
  description?: string | null
  due_date?: string | null
  image_url?: string | null
  assigned_to?: string | null
  tag_ids?: string[]
}
export const createTask = (teamId: string, input: NewTaskPayload) => soft(tasksA.createTaskAction(teamId, input), null)
export const updateTask = async (id: string, patch: Partial<NewTaskPayload>) => (await soft(tasksA.updateTaskAction(id, patch), false)) !== false
export const moveTask = async (id: string, target: { columnId: string; prevId?: string | null; nextId?: string | null }) =>
  (await soft(tasksA.moveTaskAction(id, target), false)) !== false
export const deleteTask = async (id: string) => (await soft(tasksA.deleteTaskAction(id), false)) !== false

export async function uploadCover(file: File): Promise<string | null> {
  const form = new FormData()
  form.set('file', file)
  return soft(tasksA.uploadCoverAction(form), null)
}

/* ---------- Columnas ---------- */
export const fetchColumns = (teamId: string): Promise<BoardColumn[]> => soft(columnsA.listColumnsAction(teamId), [] as BoardColumn[])
export const createColumn = (teamId: string, input: { name: string; kind: TaskStatus; color?: string | null }) =>
  soft(columnsA.createColumnAction(teamId, input), null)
export const updateColumn = async (id: string, patch: { name?: string | null; color?: string | null; kind?: TaskStatus }) =>
  (await soft(columnsA.updateColumnAction(id, patch), false)) !== false
export const shiftColumn = async (id: string, direction: -1 | 1) => (await soft(columnsA.shiftColumnAction(id, direction), false)) !== false
export const deleteColumn = async (id: string, moveTo?: string | null) => (await soft(columnsA.deleteColumnAction(id, moveTo), false)) !== false

/* ---------- Subtareas ---------- */
export const fetchSubtasks = (taskId: string): Promise<Subtask[]> => soft(subtasksA.listSubtasksAction(taskId), [] as Subtask[])
export const createSubtask = (taskId: string, title: string) => soft(subtasksA.createSubtaskAction(taskId, { title }), null)
export const updateSubtask = async (id: string, patch: { title?: string; done?: boolean }) =>
  (await soft(subtasksA.updateSubtaskAction(id, patch), false)) !== false
export const deleteSubtask = async (id: string) => (await soft(subtasksA.deleteSubtaskAction(id), false)) !== false

export const applyTemplate = async (teamId: string, template: string, lang?: string) =>
  (await soft(templatesA.applyTemplateAction(teamId, { template, lang }), false)) !== false

/* ---------- Etiquetas ---------- */
export const fetchUserTags = (teamId: string): Promise<Tag[]> => soft(tagsA.listTagsAction(teamId), [] as Tag[])
export const createTag = (name: string, color = '#3b82f6', parentId: string | null = null, teamId: string | null = null): Promise<Tag | null> =>
  teamId ? soft(tagsA.createTagAction(teamId, { name, color, parent_id: parentId }), null) : Promise.resolve(null)
export const updateTag = async (id: string, updates: Partial<Pick<Tag, 'name' | 'color'>>) => (await soft(tagsA.updateTagAction(id, updates), false)) !== false
export const deleteTag = async (id: string) => (await soft(tagsA.deleteTagAction(id), false)) !== false

export type TagNode = Tag & { children: TagNode[] }

/** Árbol jerárquico a partir de la lista plana. */
export function buildTagTree(list: Tag[]): TagNode[] {
  const map = new Map<string, TagNode>(list.map((t) => [t.id, { ...t, children: [] }]))
  const roots: TagNode[] = []
  for (const t of list) {
    const node = map.get(t.id)!
    const parent = t.parent_id ? map.get(t.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

/* ---------- Comentarios y adjuntos ---------- */
export async function fetchTaskComments(taskId: string): Promise<TaskComment[]> {
  const comments = await soft(commentsA.listCommentsAction(taskId), [] as TaskComment[])
  const walk = (list: TaskComment[]) => list.forEach((c) => { rememberName(c.user_id, c.profile?.full_name); walk(c.replies ?? []) })
  walk(comments)
  return comments
}
export const createComment = (taskId: string, content: string, parentId: string | null = null): Promise<TaskComment | null> =>
  soft(commentsA.createCommentAction(taskId, content, parentId), null)
export const deleteComment = async (id: string) => (await soft(commentsA.deleteCommentAction(id), false)) !== false

/** Lanza con el mensaje del servidor si falla (los llamadores muestran el aviso). */
export async function uploadAttachment(file: File, target: { taskId?: string; commentId?: string }): Promise<Attachment> {
  const form = new FormData()
  form.set('file', file)
  if (target.taskId) form.set('taskId', target.taskId)
  if (target.commentId) form.set('commentId', target.commentId)
  return unwrap(await commentsA.uploadAttachmentAction(form))
}
export const getAttachmentsByTask = (taskId: string): Promise<Attachment[]> => soft(commentsA.listTaskAttachmentsAction(taskId), [] as Attachment[])
export const deleteAttachment = async (att: Attachment) => (await soft(commentsA.deleteAttachmentAction(att.id), false)) !== false
export const attachmentUrl = (att: Pick<Attachment, 'id'>) => `/api/files/${att.id}`

/* ---------- Perfil ---------- */
export const fetchMe = (): Promise<Profile | null> => soft(profileA.getMeAction(), null)
export const updateProfile = async (changes: { full_name?: string; avatar_url?: string | null }): Promise<Profile> =>
  (async () => { const me = unwrap(await profileA.updateProfileAction(changes)); rememberName(me.id, me.full_name); return me })()
export async function uploadAvatar(file: File): Promise<string> {
  const form = new FormData()
  form.set('file', file)
  return unwrap(await profileA.uploadAvatarAction(form))
}
