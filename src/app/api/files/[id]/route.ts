import { z } from 'zod'
import { db } from '@/server/db'
import { ServiceError } from '@/server/services/common'
import { getAccessibleAttachment } from '@/server/services/attachments'
import { getSession } from '@/server/session'
import { readUpload } from '@/server/storage'

const INLINE = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'])

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return new Response('No autenticado', { status: 401 })

  const parsed = z.uuid().safeParse((await ctx.params).id)
  if (!parsed.success) return new Response('No encontrado', { status: 404 })

  try {
    const { att } = await getAccessibleAttachment(db, session.user.id, parsed.data)
    const body = await readUpload(att.file_path)
    const disposition = INLINE.has(att.file_type) ? 'inline' : 'attachment'
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': att.file_type,
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(att.file_name)}`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e) {
    if (e instanceof ServiceError) return new Response('No encontrado', { status: 404 })
    console.error('[files]', e)
    return new Response('Error', { status: 500 })
  }
}
