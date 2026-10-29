import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/columns'

export const dynamic = 'force-dynamic'

export const POST = endpoint(async ({ userId, params, json }) => uc.shiftColumn(db, userId, params.id, await json()))
