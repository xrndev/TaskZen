'use server'

import { z } from 'zod'
import { db } from '@/server/db'
import { removeUploads, saveUpload } from '@/server/storage'
import { createTaskSchema, moveTaskSchema, updateTaskSchema, uuid } from '@/server/schemas/tasks'
import * as svc from '@/server/services/tasks'
import { notifyAssignedInBackground } from './notify'
import { run } from './run'

const id = uuid
const createSchema = createTaskSchema
const updateSchema = updateTaskSchema

export async function listTasksAction(teamId: string) {
  return run((u) => svc.listTasks(db, u, id.parse(teamId)))
}

export async function createTaskAction(teamId: string, input: z.input<typeof createSchema>) {
  return run(async (u) => {
    const task = await svc.createTask(db, u, id.parse(teamId), createSchema.parse(input))
    if (task.assigned_to) notifyAssignedInBackground(u, task.id)
    return task.id
  })
}

export async function updateTaskAction(taskId: string, patch: z.input<typeof updateSchema>) {
  return run(async (u) => {
    const taskUuid = id.parse(taskId)
    const { assigneeChanged, assignedTo } = await svc.updateTask(db, u, taskUuid, updateSchema.parse(patch))
    if (assigneeChanged && assignedTo) notifyAssignedInBackground(u, taskUuid)
  })
}

export async function moveTaskAction(
  taskId: string,
  target: { status: 'pending' | 'in_progress' | 'completed'; prevId?: string | null; nextId?: string | null },
) {
  const schema = moveTaskSchema
  return run((u) => svc.moveTask(db, u, id.parse(taskId), schema.parse(target)))
}

export async function deleteTaskAction(taskId: string) {
  return run(async (u) => {
    const files = await svc.deleteTask(db, u, id.parse(taskId))
    await removeUploads(files)
  })
}

/** Sube la imagen de portada de una tarea y devuelve la URL para guardarla en `image_url`. */
export async function uploadCoverAction(form: FormData) {
  return run(async () => {
    const file = form.get('file')
    if (!(file instanceof File)) throw new Error('Falta el archivo.')
    const saved = await saveUpload(file, { dir: 'covers', maxSize: 5 * 1024 * 1024, imagesOnly: true })
    return `/api/media/${saved.key}`
  })
}
