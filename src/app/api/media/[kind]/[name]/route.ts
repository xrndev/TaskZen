import { getSession } from '@/server/session'
import { readUpload } from '@/server/storage'

const KINDS = new Set(['avatars', 'covers'])
const NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif)$/
const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }

/** Avatares y portadas: nombres UUID no adivinables, visibles solo con sesión iniciada. */
export async function GET(_req: Request, ctx: { params: Promise<{ kind: string; name: string }> }) {
  if (!(await getSession())) return new Response('No autenticado', { status: 401 })
  const { kind, name } = await ctx.params
  if (!KINDS.has(kind) || !NAME.test(name)) return new Response('No encontrado', { status: 404 })

  try {
    const body = await readUpload(`${kind}/${name}`)
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': TYPES[name.split('.').pop()!],
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    })
  } catch {
    return new Response('No encontrado', { status: 404 })
  }
}
