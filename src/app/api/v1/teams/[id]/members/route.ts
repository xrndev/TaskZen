import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/teams'

export const dynamic = 'force-dynamic'

export const GET = endpoint(({ userId, params }) => uc.listMembers(db, userId, params.id))
export const POST = endpoint(async ({ userId, params, json }) => uc.addMember(db, userId, params.id, await json()), 201)
