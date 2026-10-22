import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/profile'

export const dynamic = 'force-dynamic'

export const GET = endpoint(({ userId }) => uc.getMe(db, userId))
export const PATCH = endpoint(async ({ userId, json }) => uc.updateProfile(db, userId, await json()))
