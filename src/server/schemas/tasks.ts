import { z } from 'zod'

export const uuid = z.uuid()
const date = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha no válida.')

const taskFields = {
  title: z.string().trim().min(1, 'El título es obligatorio.').max(200),
  description: z.string().max(5000).nullish(),
  due_date: date.nullish().or(z.literal('')),
  image_url: z.string().max(500).regex(/^(https?:\/\/|\/api\/media\/covers\/)/, 'URL de imagen no válida.').nullish().or(z.literal('')),
  assigned_to: z.string().min(1).nullish().or(z.literal('')),
  tag_ids: z.array(uuid).max(50).optional(),
}

export const createTaskSchema = z.object(taskFields)
export const updateTaskSchema = z.object(taskFields).partial()
export const moveTaskSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed']),
  prevId: uuid.nullish(),
  nextId: uuid.nullish(),
})
export const commentContentSchema = z.string().max(5000)
