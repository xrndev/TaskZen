import { createHash, timingSafeEqual } from 'node:crypto'
import { db } from '@/server/db'
import { getPushSender } from '@/server/push/sender'
import { runTick } from '@/server/services/notifications'

export const dynamic = 'force-dynamic'

const MIN_SECRET_LENGTH = 32
const MAX_CALLS_PER_MINUTE = 30
const calls: number[] = []

// Se comparan los hashes (misma longitud siempre) y en tiempo constante: no se puede deducir la clave por el tiempo de respuesta.
const digest = (s: string) => createHash('sha256').update(s).digest()

function authorized(req: Request, secret: string) {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  return timingSafeEqual(digest(token), digest(secret))
}

/**
 * Lo llama el Worker de Cloudflare (o el cron de la VPS) cada 5 minutos. Está protegido con una clave compartida,
 * solo admite POST y nunca devuelve datos de tareas ni de personas: solo contadores.
 */
export async function POST(req: Request) {
  const secret = process.env.TICK_SECRET
  const sender = getPushSender()
  if (!secret || secret.length < MIN_SECRET_LENGTH || !sender) {
    return Response.json({ error: 'not_configured' }, { status: 503 })
  }
  if (!authorized(req, secret)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Freno básico: un uso normal es 1 llamada por minuto.
  const now = Date.now()
  while (calls.length && now - calls[0] > 60_000) calls.shift()
  if (calls.length >= MAX_CALLS_PER_MINUTE) return Response.json({ error: 'rate_limited' }, { status: 429 })
  calls.push(now)

  try {
    const result = await runTick(db, sender)
    // Una línea por minuto: permite comprobar con `docker compose logs app` que el despertador está vivo.
    console.info('[tick]', JSON.stringify(result))
    return Response.json(result)
  } catch (e) {
    console.error('[tick]', e)
    return Response.json({ error: 'tick_failed' }, { status: 500 })
  }
}
