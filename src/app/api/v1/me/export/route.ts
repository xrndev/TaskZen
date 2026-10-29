import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/billing'

export const dynamic = 'force-dynamic'

export const GET = endpoint(({ userId, req }) => uc.exportMine(db, userId, new URL(req.url).searchParams.get('format')))
