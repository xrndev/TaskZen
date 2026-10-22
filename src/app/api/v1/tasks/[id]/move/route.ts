import { db } from '@/server/db'
import { api, idParam, readJson } from '@/server/api/http'
import { moveTaskSchema } from '@/server/schemas/tasks'
import * as svc from '@/server/services/tasks'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return api(req, async (u) => svc.moveTask(db, u, idParam(id), moveTaskSchema.parse(await readJson(req))))
}
