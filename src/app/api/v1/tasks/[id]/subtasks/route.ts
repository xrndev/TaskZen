import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/subtasks'

export const dynamic = 'force-dynamic'

export const GET = endpoint(({ userId, params }) => uc.listSubtasks(db, userId, params.id))
export const POST = endpoint(async ({ userId, params, json }) => uc.createSubtask(db, userId, params.id, await json()), 201)
