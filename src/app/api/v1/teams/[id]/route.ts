import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/teams'

export const dynamic = 'force-dynamic'

export const DELETE = endpoint(({ userId, params }) => uc.deleteTeam(db, userId, params.id))
