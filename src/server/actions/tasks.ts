'use server'

import { db } from '@/server/db'
import * as uc from '@/server/usecases/tasks'
import { run } from './run'

// Adaptador de las server actions de la web: sesión + resultado serializable. Las reglas viven en `server/usecases`.

export async function listTasksAction(teamId: string) {
  return run((u) => uc.listTasks(db, u, teamId))
}
export async function createTaskAction(teamId: string, input: uc.CreateTaskInput) {
  return run(async (u) => (await uc.createTask(db, u, teamId, input)).id)
}
export async function updateTaskAction(taskId: string, patch: uc.UpdateTaskInput) {
  return run((u) => uc.updateTask(db, u, taskId, patch))
}
export async function moveTaskAction(taskId: string, target: uc.MoveTaskInput) {
  return run((u) => uc.moveTask(db, u, taskId, target))
}
export async function deleteTaskAction(taskId: string) {
  return run((u) => uc.deleteTask(db, u, taskId))
}
export async function uploadCoverAction(form: FormData) {
  return run(() => uc.uploadCover(form.get('file')))
}
