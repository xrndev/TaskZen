import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/billing'

export const dynamic = 'force-dynamic'

export const GET = endpoint(({ userId, params }) => uc.getTeamBilling(db, userId, params.id))
