import { z } from 'zod'
import type { Db } from '@/server/db'
import { notifyAssignedInBackground } from '@/server/push/assigned'
import * as svc from '@/server/services/tasks'
import { removeUploads, saveUpload } from '@/server/storage'
import { parseId, requireFile, uuid } from './common'

const date = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha no válida.')

const taskFields = {
  title: z.string().trim().min(1, 'El título es obligatorio.').max(200),
  description: z.string().max(5000).nullish(),
  due_date: date.nullish().or(z.literal('')),
  image_url: z.string().max(500).regex(/^(https?:\/\/|\/api\/media\/covers\/)/, 'URL de imagen no válida.').nullish().or(z.literal('')),
  assigned_to: z.string().min(1).nullish().or(z.literal('')),
  tag_ids: z.array(uuid).max(50).optional(),
}
const createSchema = z.object(taskFields)
const updateSchema = z.object(taskFields).partial()
const moveSchema = z
  .object({ status: z.enum(['pending', 'in_progress', 'completed']).optional(), columnId: uuid.nullish(), prevId: uuid.nullish(), nextId: uuid.nullish() })
  .refine((v) => v.status || v.columnId, 'Indica la columna de destino.')

export type CreateTaskInput = z.input<typeof createSchema>
export type UpdateTaskInput = z.input<typeof updateSchema>
export type MoveTaskInput = z.input<typeof moveSchema>

export const listTasks = (db: Db, userId: string, teamId: string) => svc.listTasks(db, userId, parseId(teamId))

export async function createTask(db: Db, userId: string, teamId: string, input: unknown) {
  const task = await svc.createTask(db, userId, parseId(teamId), createSchema.parse(input))
  if (task.assigned_to) notifyAssignedInBackground(userId, task.id)
  return { id: task.id }
}

export async function updateTask(db: Db, userId: string, taskId: string, patch: unknown) {
  const id = parseId(taskId)
  const { assigneeChanged, assignedTo } = await svc.updateTask(db, userId, id, updateSchema.parse(patch))
  if (assigneeChanged && assignedTo) notifyAssignedInBackground(userId, id)
}

export const moveTask = (db: Db, userId: string, taskId: string, target: unknown) =>
  svc.moveTask(db, userId, parseId(taskId), moveSchema.parse(target))

export async function deleteTask(db: Db, userId: string, taskId: string) {
  await removeUploads(await svc.deleteTask(db, userId, parseId(taskId)))
}

/** Imagen de portada: devuelve la URL para guardarla en `image_url`. */
export async function uploadCover(file: unknown) {
  const saved = await saveUpload(requireFile(file), { dir: 'covers', maxSize: 5 * 1024 * 1024, imagesOnly: true })
  return `/api/media/${saved.key}`
}
