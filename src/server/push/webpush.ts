import webpush from 'web-push'
import type { PushPayload, PushResult, PushSender, PushTarget } from './types'

export interface VapidConfig {
  publicKey: string
  privateKey: string
  /** mailto: o https: de contacto; los servicios de push lo usan si hay que avisar de un abuso. */
  subject: string
}

export function vapidFromEnv(env: Record<string, string | undefined> = process.env): VapidConfig | null {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = env
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject: env.VAPID_SUBJECT || 'mailto:admin@taskzen.invalid' }
}

export class WebPushSender implements PushSender {
  constructor(private readonly vapid: VapidConfig, private readonly ttlSeconds = 60 * 60) {}

  async send(target: PushTarget, payload: PushPayload): Promise<PushResult> {
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        {
          vapidDetails: { subject: this.vapid.subject, publicKey: this.vapid.publicKey, privateKey: this.vapid.privateKey },
          TTL: this.ttlSeconds, // un aviso de "vence en 1 h" no sirve pasada una hora
          urgency: 'normal',
          timeout: 10_000,
        },
      )
      return { ok: true }
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      // 404/410: la suscripción ya no existe. Otros errores (429, 5xx, red) son transitorios.
      return { ok: false, gone: status === 404 || status === 410, status, message: (e as Error).message?.slice(0, 200) }
    }
  }
}

let cached: PushSender | null | undefined
/** Emisor configurado por entorno, o null si faltan las claves VAPID. */
export function getPushSender(): PushSender | null {
  if (cached !== undefined) return cached
  const vapid = vapidFromEnv()
  cached = vapid ? new WebPushSender(vapid) : null
  return cached
}
