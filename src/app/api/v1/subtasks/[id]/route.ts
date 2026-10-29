import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/subtasks'

export const dynamic = 'force-dynamic'

export const PATCH = endpoint(async ({ userId, params, json }) => uc.updateSubtask(db, userId, params.id, await json()))
export const DELETE = endpoint(({ userId, params }) => uc.deleteSubtask(db, userId, params.id))
