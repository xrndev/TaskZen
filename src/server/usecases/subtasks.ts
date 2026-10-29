import { z } from 'zod'
import type { Db } from '@/server/db'
import * as svc from '@/server/services/subtasks'
import { parseId } from './common'

const title = z.string().trim().min(1, 'El texto es obligatorio.').max(200)
const createSchema = z.object({ title })
const updateSchema = z.object({ title: title.optional(), done: z.boolean().optional() })

export const listSubtasks = (db: Db, userId: string, taskId: string) => svc.listSubtasks(db, userId, parseId(taskId))

export async function createSubtask(db: Db, userId: string, taskId: string, input: unknown) {
  return svc.createSubtask(db, userId, parseId(taskId), createSchema.parse(input).title)
}

export const updateSubtask = (db: Db, userId: string, subtaskId: string, patch: unknown) =>
  svc.updateSubtask(db, userId, parseId(subtaskId), updateSchema.parse(patch))

export const deleteSubtask = (db: Db, userId: string, subtaskId: string) => svc.deleteSubtask(db, userId, parseId(subtaskId))
