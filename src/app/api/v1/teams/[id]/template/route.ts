import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/templates'

export const dynamic = 'force-dynamic'

export const POST = endpoint(async ({ userId, params, json }) => uc.applyTemplate(db, userId, params.id, await json()), 201)
