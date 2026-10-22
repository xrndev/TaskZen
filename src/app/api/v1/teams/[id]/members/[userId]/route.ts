import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/teams'

export const dynamic = 'force-dynamic'

export const PATCH = endpoint(async ({ userId, params, json }) => uc.changeMemberRole(db, userId, params.id, params.userId, await json()))
export const DELETE = endpoint(({ userId, params }) => uc.removeMember(db, userId, params.id, params.userId))
