import { db } from '@/server/db'
import { api, idParam, readJson } from '@/server/api/http'
import { notifyAssignedInBackground } from '@/server/actions/notify'
import { createTaskSchema } from '@/server/schemas/tasks'
import * as svc from '@/server/services/tasks'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return api(req, (u) => svc.listTasks(db, u, idParam(id)))
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return api(
    req,
    async (u) => {
      const task = await svc.createTask(db, u, idParam(id), createTaskSchema.parse(await readJson(req)))
      if (task.assigned_to) notifyAssignedInBackground(u, task.id)
      return { id: task.id }
    },
    201,
  )
}
