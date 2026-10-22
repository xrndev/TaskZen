import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/teams'

export const dynamic = 'force-dynamic'

export const GET = endpoint(({ userId }) => uc.listTeams(db, userId))
export const POST = endpoint(async ({ userId, json }) => uc.createTeam(db, userId, await json()), 201)
