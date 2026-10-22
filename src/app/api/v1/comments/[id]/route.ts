import { db } from '@/server/db'
import { api, idParam } from '@/server/api/http'
import { removeUploads } from '@/server/storage'
import * as svc from '@/server/services/comments'

export const dynamic = 'force-dynamic'

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return api(req, async (u) => {
    await removeUploads(await svc.deleteComment(db, u, idParam(id)))
  })
}
