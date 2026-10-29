'use server'

import { db } from '@/server/db'
import * as uc from '@/server/usecases/subtasks'
import { run } from './run'

export async function listSubtasksAction(taskId: string) {
  return run((u) => uc.listSubtasks(db, u, taskId))
}
export async function createSubtaskAction(taskId: string, input: { title: string }) {
  return run((u) => uc.createSubtask(db, u, taskId, input))
}
export async function updateSubtaskAction(subtaskId: string, patch: { title?: string; done?: boolean }) {
  return run((u) => uc.updateSubtask(db, u, subtaskId, patch))
}
export async function deleteSubtaskAction(subtaskId: string) {
  return run((u) => uc.deleteSubtask(db, u, subtaskId))
}
