import { db } from '@/server/db'
import { api, idParam, readJson } from '@/server/api/http'
import { notifyAssignedInBackground } from '@/server/actions/notify'
import { updateTaskSchema } from '@/server/schemas/tasks'
import { removeUploads } from '@/server/storage'
import * as svc from '@/server/services/tasks'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return api(req, async (u) => {
    const taskId = idParam(id)
    const { assigneeChanged, assignedTo } = await svc.updateTask(db, u, taskId, updateTaskSchema.parse(await readJson(req)))
    if (assigneeChanged && assignedTo) notifyAssignedInBackground(u, taskId)
  })
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return api(req, async (u) => {
    await removeUploads(await svc.deleteTask(db, u, idParam(id)))
  })
}
