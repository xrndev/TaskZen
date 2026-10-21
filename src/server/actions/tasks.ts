'use server'

import { z } from 'zod'
import { db } from '@/server/db'
import { removeUploads, saveUpload } from '@/server/storage'
import * as svc from '@/server/services/tasks'
import { run } from './run'

const id = z.uuid()
const date = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha no válida.')

const taskFields = {
  title: z.string().trim().min(1, 'El título es obligatorio.').max(200),
  description: z.string().max(5000).nullish(),
  due_date: date.nullish().or(z.literal('')),
  image_url: z.string().max(500).regex(/^(https?:\/\/|\/api\/media\/covers\/)/, 'URL de imagen no válida.').nullish().or(z.literal('')),
  assigned_to: z.string().min(1).nullish().or(z.literal('')),
  tag_ids: z.array(id).max(50).optional(),
}
const createSchema = z.object(taskFields)
const updateSchema = z.object(taskFields).partial()

export async function listTasksAction(teamId: string) {
  return run((u) => svc.listTasks(db, u, id.parse(teamId)))
}

export async function createTaskAction(teamId: string, input: z.input<typeof createSchema>) {
  return run(async (u) => (await svc.createTask(db, u, id.parse(teamId), createSchema.parse(input))).id)
}

export async function updateTaskAction(taskId: string, patch: z.input<typeof updateSchema>) {
  return run((u) => svc.updateTask(db, u, id.parse(taskId), updateSchema.parse(patch)))
}

export async function moveTaskAction(
  taskId: string,
  target: { status: 'pending' | 'in_progress' | 'completed'; prevId?: string | null; nextId?: string | null },
) {
  const schema = z.object({
    status: z.enum(['pending', 'in_progress', 'completed']),
    prevId: id.nullish(),
    nextId: id.nullish(),
  })
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
