'use server'

import { db } from '@/server/db'
import * as uc from '@/server/usecases/comments'
import { run } from './run'

export async function listCommentsAction(taskId: string) {
  return run((u) => uc.listComments(db, u, taskId))
}
export async function createCommentAction(taskId: string, content: string, parentId: string | null = null) {
  return run((u) => uc.createComment(db, u, taskId, { content, parent_id: parentId }))
}
export async function deleteCommentAction(commentId: string) {
  return run((u) => uc.deleteComment(db, u, commentId))
}

/** Sube un adjunto a una tarea (`taskId`) o a un comentario (`commentId`), solo uno de los dos. */
export async function uploadAttachmentAction(form: FormData) {
  return run((u) => uc.uploadAttachment(db, u, form.get('file'), { taskId: form.get('taskId'), commentId: form.get('commentId') }))
}
export async function listTaskAttachmentsAction(taskId: string) {
  return run((u) => uc.listTaskAttachments(db, u, taskId))
}
export async function deleteAttachmentAction(attachmentId: string) {
  return run((u) => uc.deleteAttachment(db, u, attachmentId))
}
