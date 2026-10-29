import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/columns'

export const dynamic = 'force-dynamic'

export const GET = endpoint(({ userId, params }) => uc.listColumns(db, userId, params.id))
export const POST = endpoint(async ({ userId, params, json }) => uc.createColumn(db, userId, params.id, await json()), 201)
