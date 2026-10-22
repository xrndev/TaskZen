import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/comments'

export const dynamic = 'force-dynamic'

export const DELETE = endpoint(({ userId, params }) => uc.deleteComment(db, userId, params.id))
