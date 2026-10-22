import { z } from 'zod'
import { db } from '@/server/db'
import { api, readJson } from '@/server/api/http'
import * as svc from '@/server/services/teams'

export const dynamic = 'force-dynamic'

const body = z.object({ name: z.string().trim().min(1, 'El nombre es obligatorio.').max(80) })

export function GET(req: Request) {
  return api(req, (u) => svc.listTeams(db, u))
}

export function POST(req: Request) {
  return api(req, async (u) => svc.createTeam(db, u, body.parse(await readJson(req)).name), 201)
}
