import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/comments'

export const dynamic = 'force-dynamic'

export const GET = endpoint(({ userId, params }) => uc.listTaskAttachments(db, userId, params.id))
