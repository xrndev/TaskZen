import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/billing'

export const dynamic = 'force-dynamic'

export const GET = endpoint(({ userId, params, req }) => uc.exportTeam(db, userId, params.id, new URL(req.url).searchParams.get('format')))
