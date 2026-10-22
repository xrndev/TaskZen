/**
 * Worker de Cloudflare "despertador" de los recordatorios de TaskZen.
 *
 * No tiene datos ni lógica de negocio: cada 5 minutos (Cron Trigger) llama al endpoint protegido de la app y
 * la app decide qué avisos tocan. Así Cloudflare nunca ve tareas ni personas, solo una petición con una clave.
 *
 * Variables:
 *   TICK_URL     (wrangler.toml)  https://<dominio>/api/internal/reminders/tick
 *   TICK_SECRET  (secreto)        la misma clave que TICK_SECRET del servidor: `wrangler secret put TICK_SECRET`
 */

export interface Env {
  TICK_URL: string
  TICK_SECRET: string
}

export interface TickSummary {
  planned: number
  sent: number
  skipped: number
  retried: number
  disabledEndpoints: number
}

export interface Deps {
  fetch: typeof fetch
  sleep: (ms: number) => Promise<void>
  log: (entry: Record<string, unknown>) => void
}

const defaults: Deps = {
  fetch: (...args) => fetch(...args),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  log: (entry) => console.log(JSON.stringify(entry)),
}

const REQUEST_TIMEOUT_MS = 20_000
const RETRY_DELAY_MS = 2_000

/** 5xx y 429 son transitorios: merecen un segundo intento. 401/503 de configuración no se arreglan reintentando. */
const retryable = (status: number) => status === 429 || (status >= 500 && status !== 503)

export async function callTick(env: Env, deps: Deps = defaults): Promise<{ status: number; summary: TickSummary | null }> {
  const attempt = async () => {
    const res = await deps.fetch(env.TICK_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.TICK_SECRET}`, Accept: 'application/json', 'User-Agent': 'taskzen-reminders-worker/1' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const summary = res.ok ? ((await res.json().catch(() => null)) as TickSummary | null) : null
    return { status: res.status, summary }
  }

  let last: { status: number; summary: TickSummary | null }
  try {
    last = await attempt()
  } catch (e) {
    deps.log({ level: 'warn', msg: 'tick: error de red, reintentando', error: String((e as Error).message ?? e) })
    await deps.sleep(RETRY_DELAY_MS)
    return attempt()
  }
  if (retryable(last.status)) {
    deps.log({ level: 'warn', msg: 'tick: respuesta transitoria, reintentando', status: last.status })
    await deps.sleep(RETRY_DELAY_MS)
    last = await attempt()
  }
  return last
}

export async function runScheduled(env: Env, deps: Deps = defaults): Promise<void> {
  if (!env.TICK_URL || !env.TICK_SECRET) throw new Error('Falta TICK_URL o TICK_SECRET')
  const { status, summary } = await callTick(env, deps)
  if (status !== 200) {
    deps.log({ level: 'error', msg: 'tick fallido', status })
    // Lanzar marca la ejecución como fallida en el panel de Cloudflare: así se ve que algo va mal.
    throw new Error(`El tick respondió ${status}`)
  }
  // Solo se registra cuando pasó algo: el silencio de cada ejecución no ensucia el historial.
  if (summary && (summary.sent || summary.retried || summary.disabledEndpoints)) deps.log({ level: 'info', msg: 'tick', ...summary })
}

interface ScheduledEvent { scheduledTime: number; cron: string }
interface Ctx { waitUntil(promise: Promise<unknown>): void }

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: Ctx): Promise<void> {
    ctx.waitUntil(runScheduled(env))
  },
  // Sin ruta pública: el Worker solo responde a su temporizador.
  async fetch(): Promise<Response> {
    return new Response('Not found', { status: 404 })
  },
}
