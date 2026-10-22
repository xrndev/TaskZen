// @vitest-environment node
import { createVerify, generateKeyPairSync } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { FcmSender, fcmFromEnv, type FcmConfig } from '@/server/push/fcm'
import { RoutingSender } from '@/server/push/sender'
import type { PushPayload, PushTarget } from '@/server/push/types'

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
const CFG: FcmConfig = { projectId: 'taskzen-test', clientEmail: 'push@taskzen-test.iam.gserviceaccount.com', privateKey }
const TARGET: PushTarget = { kind: 'fcm', endpoint: 'token-del-movil-'.repeat(8), p256dh: null, auth: null }
const PAYLOAD: PushPayload = { title: 'Vence pronto', body: 'Tarea · vence en 1 h', url: '/board?task=abc', tag: 'due-abc' }

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** `fetch` falso: contesta al OAuth de Google y a FCM con las respuestas que se le dan. */
function fakeFetch(fcm: Array<Response | Error>, oauth: Response[] = []) {
  const fcmQueue = [...fcm]
  const oauthQueue = [...oauth]
  const calls: { url: string; init: RequestInit }[] = []
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url)
    calls.push({ url: u, init: init ?? {} })
    if (u.startsWith('https://oauth2.googleapis.com/')) return oauthQueue.shift() ?? json(200, { access_token: 'ya29.token', expires_in: 3600 })
    const next = fcmQueue.shift()
    if (!next) throw new Error('sin más respuestas')
    if (next instanceof Error) throw next
    return next
  })
  return { impl: impl as unknown as typeof fetch, calls }
}

describe('FcmSender', () => {
  it('pide el token OAuth con un JWT firmado con la clave de la cuenta de servicio', async () => {
    const { impl, calls } = fakeFetch([json(200, { name: 'm' })])
    await new FcmSender(CFG, impl).send(TARGET, PAYLOAD)

    const oauth = calls[0]
    expect(oauth.url).toBe('https://oauth2.googleapis.com/token')
    const params = new URLSearchParams(String(oauth.init.body))
    expect(params.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')
    const [header, claim, signature] = params.get('assertion')!.split('.')
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' })
    const c = JSON.parse(Buffer.from(claim, 'base64url').toString())
    expect(c).toMatchObject({ iss: CFG.clientEmail, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token' })
    expect(c.exp - c.iat).toBe(3600)
    expect(createVerify('RSA-SHA256').update(`${header}.${claim}`).verify(publicKey, signature, 'base64url')).toBe(true)
  })

  it('envía el mensaje a la API v1 del proyecto con prioridad alta, canal y datos de apertura', async () => {
    const { impl, calls } = fakeFetch([json(200, { name: 'projects/x/messages/1' })])
    expect(await new FcmSender(CFG, impl).send(TARGET, PAYLOAD)).toEqual({ ok: true })

    const send = calls[1]
    expect(send.url).toBe('https://fcm.googleapis.com/v1/projects/taskzen-test/messages:send')
    expect((send.init.headers as Record<string, string>).Authorization).toBe('Bearer ya29.token')
    const { message } = JSON.parse(String(send.init.body))
    expect(message.token).toBe(TARGET.endpoint)
    expect(message.notification).toEqual({ title: PAYLOAD.title, body: PAYLOAD.body })
    expect(message.data).toEqual({ url: '/board?task=abc', tag: 'due-abc' })
    expect(message.android).toMatchObject({ priority: 'HIGH', ttl: '3600s', notification: { channel_id: 'avisos', tag: 'due-abc' } })
  })

  it('reutiliza el token OAuth mientras no caduca', async () => {
    const { impl, calls } = fakeFetch([json(200, {}), json(200, {})])
    const sender = new FcmSender(CFG, impl)
    await sender.send(TARGET, PAYLOAD)
    await sender.send(TARGET, PAYLOAD)
    expect(calls.filter((c) => c.url.includes('oauth2')).length).toBe(1)
  })

  it('da de baja el destino cuando FCM dice que ya no existe (404 o UNREGISTERED)', async () => {
    const a = fakeFetch([json(404, { error: { status: 'NOT_FOUND', message: 'x' } })])
    expect(await new FcmSender(CFG, a.impl).send(TARGET, PAYLOAD)).toMatchObject({ ok: false, gone: true, status: 404 })

    const b = fakeFetch([json(400, { error: { status: 'INVALID_ARGUMENT', details: [{ errorCode: 'UNREGISTERED' }] } })])
    expect(await new FcmSender(CFG, b.impl).send(TARGET, PAYLOAD)).toMatchObject({ ok: false, gone: true })
  })

  it('trata 429, 5xx y errores de red como transitorios (no da de baja)', async () => {
    for (const next of [json(429, {}), json(503, {}), new Error('red caída')]) {
      const r = await new FcmSender(CFG, fakeFetch([next]).impl).send(TARGET, PAYLOAD)
      expect(r).toMatchObject({ ok: false, gone: false })
    }
  })

  it('descarta el token OAuth tras un 401 y pide otro en el siguiente envío', async () => {
    const { impl, calls } = fakeFetch([json(401, { error: { status: 'UNAUTHENTICATED' } }), json(200, {})])
    const sender = new FcmSender(CFG, impl)
    expect(await sender.send(TARGET, PAYLOAD)).toMatchObject({ ok: false, gone: false, status: 401 })
    await sender.send(TARGET, PAYLOAD)
    expect(calls.filter((c) => c.url.includes('oauth2')).length).toBe(2)
  })

  it('falla de forma transitoria si Google rechaza las credenciales', async () => {
    const { impl } = fakeFetch([], [json(400, { error: 'invalid_grant' })])
    expect(await new FcmSender(CFG, impl).send(TARGET, PAYLOAD)).toMatchObject({ ok: false, gone: false })
  })
})

describe('fcmFromEnv', () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64')
  it('lee la cuenta de servicio de FCM_SERVICE_ACCOUNT_B64', () => {
    expect(fcmFromEnv({})).toBeNull()
    expect(fcmFromEnv({ FCM_SERVICE_ACCOUNT_B64: 'no-es-base64-json' })).toBeNull()
    expect(fcmFromEnv({ FCM_SERVICE_ACCOUNT_B64: b64({ project_id: 'p' }) })).toBeNull()
    expect(fcmFromEnv({ FCM_SERVICE_ACCOUNT_B64: b64({ project_id: 'p', client_email: 'e@x', private_key: 'k' }) })).toEqual({ projectId: 'p', clientEmail: 'e@x', privateKey: 'k' })
  })
})

describe('RoutingSender', () => {
  it('reparte cada destino a su canal y trata un canal sin configurar como fallo transitorio', async () => {
    const web = { send: vi.fn(async () => ({ ok: true as const })) }
    const fcm = { send: vi.fn(async () => ({ ok: true as const })) }
    const both = new RoutingSender({ webpush: web, fcm })
    await both.send({ kind: 'webpush', endpoint: 'https://fcm.googleapis.com/x', p256dh: 'a', auth: 'b' }, PAYLOAD)
    await both.send(TARGET, PAYLOAD)
    expect(web.send).toHaveBeenCalledTimes(1)
    expect(fcm.send).toHaveBeenCalledTimes(1)

    const onlyWeb = new RoutingSender({ webpush: web })
    expect(await onlyWeb.send(TARGET, PAYLOAD)).toMatchObject({ ok: false, gone: false })
  })
})
