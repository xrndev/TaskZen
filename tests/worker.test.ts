// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import worker, { callTick, runScheduled, type Deps, type Env } from '../workers/reminders/src/index'

const ENV: Env = { TICK_URL: 'https://example.test/api/internal/reminders/tick', TICK_SECRET: 's'.repeat(40) }
const SUMMARY = { planned: 1, sent: 1, skipped: 0, retried: 0, disabledEndpoints: 0 }

const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function deps(responses: Array<Response | Error>) {
  const queue = [...responses]
  const log = vi.fn()
  const fetchMock = vi.fn(async () => {
    const next = queue.shift()
    if (!next) throw new Error('sin más respuestas')
    if (next instanceof Error) throw next
    return next
  })
  const d: Deps = { fetch: fetchMock as unknown as typeof fetch, sleep: async () => {}, log }
  return { d, fetchMock, log }
}

describe('Worker de recordatorios', () => {
  it('llama al endpoint con POST y la clave en la cabecera Authorization', async () => {
    const { d, fetchMock } = deps([json(200, SUMMARY)])
    const r = await callTick(ENV, d)
    expect(r).toEqual({ status: 200, summary: SUMMARY })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(ENV.TICK_URL)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${ENV.TICK_SECRET}`)
  })

  it('reintenta una vez ante un error de red y ante un 5xx transitorio', async () => {
    const a = deps([new Error('red caída'), json(200, SUMMARY)])
    expect((await callTick(ENV, a.d)).status).toBe(200)
    expect(a.fetchMock).toHaveBeenCalledTimes(2)

    const b = deps([json(502), json(200, SUMMARY)])
    expect((await callTick(ENV, b.d)).status).toBe(200)
    expect(b.fetchMock).toHaveBeenCalledTimes(2)

    const c = deps([json(429), json(200, SUMMARY)])
    expect((await callTick(ENV, c.d)).status).toBe(200)
  })

  it('no reintenta cuando el fallo es de configuración (401 clave incorrecta, 503 sin configurar)', async () => {
    for (const status of [401, 503]) {
      const { d, fetchMock } = deps([json(status), json(200, SUMMARY)])
      expect((await callTick(ENV, d)).status).toBe(status)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    }
  })

  it('solo reintenta una vez', async () => {
    const { d, fetchMock } = deps([json(500), json(500), json(200, SUMMARY)])
    expect((await callTick(ENV, d)).status).toBe(500)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('una ejecución fallida lanza error para que Cloudflare la marque como fallida', async () => {
    await expect(runScheduled(ENV, deps([json(401)]).d)).rejects.toThrow('401')
    await expect(runScheduled({ ...ENV, TICK_SECRET: '' }, deps([]).d)).rejects.toThrow('TICK_SECRET')
  })

  it('registra solo cuando pasó algo, para no llenar el historial cada minuto', async () => {
    const quiet = deps([json(200, { ...SUMMARY, planned: 0, sent: 0 })])
    await runScheduled(ENV, quiet.d)
    expect(quiet.log).not.toHaveBeenCalled()

    const busy = deps([json(200, SUMMARY)])
    await runScheduled(ENV, busy.d)
    expect(busy.log).toHaveBeenCalledWith(expect.objectContaining({ msg: 'tick', sent: 1 }))
  })

  it('el temporizador espera a que termine la llamada, y no hay ruta pública', async () => {
    const waited: Promise<unknown>[] = []
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, SUMMARY))
    await worker.scheduled({ scheduledTime: Date.now(), cron: '* * * * *' }, ENV, { waitUntil: (p) => void waited.push(p) })
    await Promise.all(waited)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    fetchSpy.mockRestore()
    expect((await worker.fetch()).status).toBe(404)
  })
})
