'use server'

import { z } from 'zod'
import { db } from '@/server/db'
import { removeUploads, saveUpload } from '@/server/storage'
import * as attSvc from '@/server/services/attachments'
import * as svc from '@/server/services/comments'
import { run } from './run'

const id = z.uuid()

export async function listCommentsAction(taskId: string) {
  return run((u) => svc.listComments(db, u, id.parse(taskId)))
}

export async function createCommentAction(taskId: string, content: string, parentId: string | null = null) {
  return run((u) =>
    svc.createComment(db, u, id.parse(taskId), z.string().max(5000).parse(content), parentId ? id.parse(parentId) : null),
  )
}

export async function deleteCommentAction(commentId: string) {
  return run(async (u) => {
    const files = await svc.deleteComment(db, u, id.parse(commentId))
    await removeUploads(files)
  })
}

/** Sube un adjunto a una tarea (`taskId`) o a un comentario (`commentId`), solo uno de los dos. */
export async function uploadAttachmentAction(form: FormData) {
  return run(async (u) => {
    const file = form.get('file')
    if (!(file instanceof File)) throw new Error('Falta el archivo.')
    const taskId = form.get('taskId') ? id.parse(form.get('taskId')) : null
    const commentId = form.get('commentId') ? id.parse(form.get('commentId')) : null
    // Autorizar ANTES de escribir en disco.
    await attSvc.authorizeUpload(db, u, { taskId, commentId })
    const saved = await saveUpload(file, { dir: 'attachments', maxSize: attSvc.MAX_FILE_SIZE })
    try {
      return await attSvc.recordAttachment(db, u, {
        task_id: taskId,
        comment_id: commentId,
        file_name: file.name,
        file_path: saved.key,
        file_type: saved.type,
        size: saved.size,
      })
    } catch (e) {
      await removeUploads([saved.key])
      throw e
    }
  })
}

export async function listTaskAttachmentsAction(taskId: string) {
  return run((u) => attSvc.listTaskAttachments(db, u, id.parse(taskId)))
}

export async function deleteAttachmentAction(attachmentId: string) {
  return run(async (u) => {
    const key = await attSvc.deleteAttachment(db, u, id.parse(attachmentId))
    await removeUploads([key])
  })
}
