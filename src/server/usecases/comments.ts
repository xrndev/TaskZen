import { z } from 'zod'
import type { Db } from '@/server/db'
import * as attSvc from '@/server/services/attachments'
import * as svc from '@/server/services/comments'
import { removeUploads, saveUpload } from '@/server/storage'
import { parseId, requireFile, uuid } from './common'

const commentSchema = z.object({ content: z.string().max(5000), parent_id: uuid.nullish() })

export const listComments = (db: Db, userId: string, taskId: string) => svc.listComments(db, userId, parseId(taskId))

export async function createComment(db: Db, userId: string, taskId: string, input: unknown) {
  const { content, parent_id } = commentSchema.parse(input)
  return svc.createComment(db, userId, parseId(taskId), content, parent_id ?? null)
}

export async function deleteComment(db: Db, userId: string, commentId: string) {
  await removeUploads(await svc.deleteComment(db, userId, parseId(commentId)))
}

export const listTaskAttachments = (db: Db, userId: string, taskId: string) => attSvc.listTaskAttachments(db, userId, parseId(taskId))

/** Sube un adjunto a una tarea (`taskId`) o a un comentario (`commentId`), solo uno de los dos. */
export async function uploadAttachment(db: Db, userId: string, file: unknown, target: { taskId?: unknown; commentId?: unknown }) {
  const upload = requireFile(file)
  const taskId = target.taskId ? parseId(target.taskId) : null
  const commentId = target.commentId ? parseId(target.commentId) : null
  // Autorizar ANTES de escribir en disco.
  await attSvc.authorizeUpload(db, userId, { taskId, commentId })
  const saved = await saveUpload(upload, { dir: 'attachments', maxSize: attSvc.MAX_FILE_SIZE })
  try {
    return await attSvc.recordAttachment(db, userId, {
      task_id: taskId,
      comment_id: commentId,
      file_name: upload.name,
      file_path: saved.key,
      file_type: saved.type,
      size: saved.size,
    })
  } catch (e) {
    await removeUploads([saved.key])
    throw e
  }
}

export async function deleteAttachment(db: Db, userId: string, attachmentId: string) {
  await removeUploads([await attSvc.deleteAttachment(db, userId, parseId(attachmentId))])
}
