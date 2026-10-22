import { createSign } from 'node:crypto'
import type { PushPayload, PushResult, PushSender, PushTarget } from './types'

export interface FcmConfig {
  projectId: string
  clientEmail: string
  privateKey: string
}

/**
 * Clave de la cuenta de servicio de Firebase, codificada en base64 en `FCM_SERVICE_ACCOUNT_B64`
 * (un JSON de varias líneas no cabe bien en un archivo `.env`). Sin ella, FCM queda desactivado.
 */
export function fcmFromEnv(env: Record<string, string | undefined> = process.env): FcmConfig | null {
  const raw = env.FCM_SERVICE_ACCOUNT_B64
  if (!raw) return null
  try {
    const json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as { project_id?: string; client_email?: string; private_key?: string }
    if (!json.project_id || !json.client_email || !json.private_key) return null
    return { projectId: json.project_id, clientEmail: json.client_email, privateKey: json.private_key }
  } catch {
    return null
  }
}

const b64url = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url')
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const TIMEOUT_MS = 10_000

/** Entrega por Firebase Cloud Messaging (API HTTP v1) con una cuenta de servicio, sin dependencias externas. */
export class FcmSender implements PushSender {
  private access: { value: string; expiresAt: number } | null = null

  constructor(private readonly cfg: FcmConfig, private readonly doFetch: typeof fetch = fetch, private readonly ttlSeconds = 60 * 60) {}

  /** Token OAuth de la cuenta de servicio (dura 1 h; se reutiliza hasta un minuto antes de caducar). */
  private async accessToken(): Promise<string> {
    const now = Date.now()
    if (this.access && this.access.expiresAt - 60_000 > now) return this.access.value

    const iat = Math.floor(now / 1000)
    const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({
      iss: this.cfg.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
    })}`
    const signature = createSign('RSA-SHA256').update(unsigned).sign(this.cfg.privateKey, 'base64url')

    const res = await this.doFetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null
    if (!res.ok || !json?.access_token) throw new Error(`OAuth de Google respondió ${res.status}`)
    this.access = { value: json.access_token, expiresAt: now + (json.expires_in ?? 3600) * 1000 }
    return json.access_token
  }

  async send(target: PushTarget, payload: PushPayload): Promise<PushResult> {
    try {
      const res = await this.doFetch(`https://fcm.googleapis.com/v1/projects/${this.cfg.projectId}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: target.endpoint,
            notification: { title: payload.title, body: payload.body },
            data: { url: payload.url, ...(payload.tag ? { tag: payload.tag } : {}) },
            android: {
              priority: 'HIGH',
              ttl: `${this.ttlSeconds}s`, // un aviso de "vence en 1 h" no sirve pasada una hora
              notification: { channel_id: 'avisos', ...(payload.tag ? { tag: payload.tag } : {}) },
            },
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.ok) return { ok: true }

      if (res.status === 401) this.access = null // token caducado o revocado: se pide otro la próxima vez
      const body = (await res.json().catch(() => null)) as { error?: { status?: string; message?: string; details?: { errorCode?: string }[] } } | null
      const code = body?.error?.details?.find((d) => d.errorCode)?.errorCode ?? body?.error?.status
      // 404 / UNREGISTERED: el móvil desinstaló la app o el token caducó. El resto (429, 5xx, red) es transitorio.
      return { ok: false, gone: res.status === 404 || code === 'UNREGISTERED', status: res.status, message: body?.error?.message?.slice(0, 200) }
    } catch (e) {
      return { ok: false, gone: false, message: (e as Error).message?.slice(0, 200) }
    }
  }
}
