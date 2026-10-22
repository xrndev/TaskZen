import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/notifications'

export const dynamic = 'force-dynamic'

export const POST = endpoint(({ userId }) => uc.sendTest(db, userId))
