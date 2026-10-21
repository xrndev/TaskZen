import { z } from 'zod'
import { db } from '@/server/db'
import { subscribe } from '@/server/realtime'
import { roleIn } from '@/server/services/common'
import { getSession } from '@/server/session'

export const dynamic = 'force-dynamic'

/** Server-Sent Events: avisa cuando cambia el tablero de un equipo del que el usuario es miembro. */
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return new Response('No autenticado', { status: 401 })

  const teamId = z.uuid().safeParse(new URL(req.url).searchParams.get('teamId'))
  if (!teamId.success || !(await roleIn(db, session.user.id, teamId.data))) {
    return new Response('No encontrado', { status: 404 })
  }

  const enc = new TextEncoder()
  let cleanup = () => {}

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk))
        } catch {
          cleanup()
        }
      }
      const unsubscribe = await subscribe((id) => {
        if (id === teamId.data) send('data: changed\n\n')
      })
      const heartbeat = setInterval(() => send(': ping\n\n'), 25_000)
      cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          /* ya cerrado */
        }
      }
      req.signal.addEventListener('abort', cleanup)
      send('retry: 3000\n\n')
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
