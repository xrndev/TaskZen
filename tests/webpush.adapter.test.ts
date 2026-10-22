// @vitest-environment node
import { createECDH, randomBytes } from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'
import { createServer, type Server } from 'node:https'
import type { AddressInfo } from 'node:net'
import { generate } from 'selfsigned'
import webpush from 'web-push'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { vapidFromEnv, WebPushSender } from '@/server/push/webpush'

/**
 * Prueba de integración real del emisor: envía a un servidor HTTPS local que hace de servicio de push y
 * comprueba lo que viajaría a Google, Mozilla o Apple (cifrado, firma VAPID y caducidad).
 * No prueba la entrega a un móvil: eso solo se verifica en un dispositivo real.
 */
// Certificado autofirmado generado al ejecutar la prueba: no hay claves privadas en el repositorio.
let tls: { key: string; cert: string }

interface Hit { headers: IncomingHttpHeaders; bytes: number }
let server: Server
let base: string
const hits: Hit[] = []
let respondWith = 201

const vapid = webpush.generateVAPIDKeys()
const b64url = (b: Buffer) => b.toString('base64url')

function subscriptionTarget(pathname: string) {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return { endpoint: `${base}${pathname}`, p256dh: b64url(ecdh.getPublicKey()), auth: b64url(randomBytes(16)) }
}

let previousTls: string | undefined
beforeAll(async () => {
  previousTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' // certificado autofirmado de pruebas
  const pems = await generate([{ name: 'commonName', value: 'localhost' }], {
    notAfterDate: new Date(Date.now() + 86_400_000), keySize: 2048, algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }] }],
  })
  tls = { key: pems.private, cert: pems.cert }
  server = createServer(tls, (req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      hits.push({ headers: req.headers, bytes: Buffer.concat(chunks).length })
      res.statusCode = respondWith
      res.end()
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `https://localhost:${(server.address() as AddressInfo).port}`
})
afterAll(async () => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTls
  if (previousTls === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
  await new Promise((r) => server.close(r))
})

const sender = () => new WebPushSender({ publicKey: vapid.publicKey, privateKey: vapid.privateKey, subject: 'mailto:test@taskzen.invalid' })
const payload = { title: 'Vence pronto', body: 'Revisar permisos · vence en 1 h', url: '/board?task=abc', tag: 'due-abc' }

describe('WebPushSender', () => {
  it('envía un mensaje cifrado, firmado con VAPID y con caducidad', async () => {
    respondWith = 201
    const r = await sender().send(subscriptionTarget('/push/ok'), payload)
    expect(r).toEqual({ ok: true })
    const hit = hits.at(-1)!
    expect(hit.headers['content-encoding']).toBe('aes128gcm')
    expect(hit.headers.ttl).toBe('3600')
    expect(hit.headers.urgency).toBe('normal')
    expect(hit.headers.authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/)
    expect(hit.headers.authorization).toContain(vapid.publicKey)
    // El cuerpo es un paquete opaco: más largo que el texto y sin el título en claro.
    expect(hit.bytes).toBeGreaterThan(JSON.stringify(payload).length)
  })

  it('el texto del aviso no viaja en claro', async () => {
    let raw = Buffer.alloc(0)
    const spy = createServer(tls, (req, res) => {
      const c: Buffer[] = []
      req.on('data', (d) => c.push(d))
      req.on('end', () => { raw = Buffer.concat(c); res.statusCode = 201; res.end() })
    })
    await new Promise<void>((r) => spy.listen(0, '127.0.0.1', r))
    const port = (spy.address() as AddressInfo).port
    const ecdh = createECDH('prime256v1'); ecdh.generateKeys()
    await sender().send({ endpoint: `https://localhost:${port}/x`, p256dh: b64url(ecdh.getPublicKey()), auth: b64url(randomBytes(16)) }, payload)
    await new Promise((r) => spy.close(r))
    expect(raw.length).toBeGreaterThan(0)
    expect(raw.toString('latin1')).not.toContain('Revisar permisos')
    expect(raw.toString('latin1')).not.toContain('Vence pronto')
  })

  it('410 y 404 significan que el dispositivo ya no existe', async () => {
    for (const status of [410, 404]) {
      respondWith = status
      expect(await sender().send(subscriptionTarget(`/push/${status}`), payload)).toMatchObject({ ok: false, gone: true, status })
    }
  })

  it('429 y 5xx son transitorios: no se da el dispositivo de baja', async () => {
    for (const status of [429, 500, 503]) {
      respondWith = status
      expect(await sender().send(subscriptionTarget(`/push/${status}`), payload)).toMatchObject({ ok: false, gone: false, status })
    }
  })

  it('un servidor inalcanzable es un fallo transitorio, no una baja', async () => {
    const dead = { ...subscriptionTarget('/x'), endpoint: 'https://localhost:9/x' }
    expect(await sender().send(dead, payload)).toMatchObject({ ok: false, gone: false })
  })
})

describe('vapidFromEnv', () => {
  it('lee las claves del entorno y devuelve null si faltan', () => {
    expect(vapidFromEnv({})).toBeNull()
    expect(vapidFromEnv({ VAPID_PUBLIC_KEY: 'a' })).toBeNull()
    expect(vapidFromEnv({ VAPID_PUBLIC_KEY: 'a', VAPID_PRIVATE_KEY: 'b' })).toEqual({ publicKey: 'a', privateKey: 'b', subject: 'mailto:admin@taskzen.invalid' })
    expect(vapidFromEnv({ VAPID_PUBLIC_KEY: 'a', VAPID_PRIVATE_KEY: 'b', VAPID_SUBJECT: 'mailto:yo@x.dev' })?.subject).toBe('mailto:yo@x.dev')
  })
})
