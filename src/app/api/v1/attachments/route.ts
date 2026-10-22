import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/comments'

export const dynamic = 'force-dynamic'

export const POST = endpoint(async ({ userId, form }) => {
  const body = await form()
  return uc.uploadAttachment(db, userId, body.get('file'), { taskId: body.get('taskId'), commentId: body.get('commentId') })
}, 201)
