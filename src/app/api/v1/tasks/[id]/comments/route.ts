import { z } from 'zod'
import { db } from '@/server/db'
import { api, idParam, readJson } from '@/server/api/http'
import { commentContentSchema, uuid } from '@/server/schemas/tasks'
import * as svc from '@/server/services/comments'

export const dynamic = 'force-dynamic'

const body = z.object({ content: commentContentSchema, parent_id: uuid.nullish() })

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return api(req, (u) => svc.listComments(db, u, idParam(id)))
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return api(
    req,
    async (u) => {
      const { content, parent_id } = body.parse(await readJson(req))
      return svc.createComment(db, u, idParam(id), content, parent_id ?? null)
    },
    201,
  )
}
