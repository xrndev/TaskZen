import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/profile'

export const dynamic = 'force-dynamic'

export const POST = endpoint(async ({ req, json }) => uc.setPassword(req.headers, await json()))
