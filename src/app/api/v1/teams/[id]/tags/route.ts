import { db } from '@/server/db'
import { api, idParam } from '@/server/api/http'
import * as svc from '@/server/services/tags'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return api(req, (u) => svc.listTags(db, u, idParam(id)))
}
