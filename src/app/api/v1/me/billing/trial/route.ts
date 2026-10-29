import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/billing'

export const dynamic = 'force-dynamic'

export const POST = endpoint(async ({ userId, json }) => uc.startUserTrial(db, userId, await json()), 201)
