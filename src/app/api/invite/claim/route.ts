import { z } from 'zod'
import { db } from '@/server/db'
import { isInviteValid } from '@/server/services/invites'
import { INVITE_COOKIE } from '@/server/services/registration'

/**
 * Guarda el token de invitación en una cookie httpOnly para que el control de registro
 * lo vea al crear la cuenta, también en los flujos de Google, Microsoft y GitHub (que salen de la web).
 */
export async function POST(req: Request) {
  const body = z.object({ token: z.string().min(10).max(100) }).safeParse(await req.json().catch(() => null))
  if (!body.success || !(await isInviteValid(db, body.data.token))) {
    return Response.json({ error: 'Invitación no válida o caducada.' }, { status: 404 })
  }
  const secure = new URL(req.url).protocol === 'https:' || process.env.NODE_ENV === 'production'
  const cookie = [`${INVITE_COOKIE}=${encodeURIComponent(body.data.token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=3600', secure ? 'Secure' : ''].filter(Boolean).join('; ')
  return new Response(null, { status: 204, headers: { 'Set-Cookie': cookie } })
}
