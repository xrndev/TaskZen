import { FcmSender, fcmFromEnv } from './fcm'
import type { PushKind, PushPayload, PushResult, PushSender, PushTarget } from './types'
import { WebPushSender, vapidFromEnv } from './webpush'

/** Reparte cada aviso al canal que corresponde a su destino. */
export class RoutingSender implements PushSender {
  constructor(private readonly senders: Partial<Record<PushKind, PushSender>>) {}

  async send(target: PushTarget, payload: PushPayload): Promise<PushResult> {
    const sender = this.senders[target.kind]
    // Canal sin configurar: fallo transitorio (no se da de baja el destino por un problema del servidor).
    if (!sender) return { ok: false, gone: false, message: `Canal ${target.kind} no configurado` }
    return sender.send(target, payload)
  }
}

let cached: PushSender | null | undefined

/** Emisor configurado por entorno (Web Push con VAPID y/o FCM con cuenta de servicio), o null si no hay ninguno. */
export function getPushSender(): PushSender | null {
  if (cached !== undefined) return cached
  const vapid = vapidFromEnv()
  const fcm = fcmFromEnv()
  cached = vapid || fcm ? new RoutingSender({ ...(vapid ? { webpush: new WebPushSender(vapid) } : {}), ...(fcm ? { fcm: new FcmSender(fcm) } : {}) }) : null
  return cached
}

export const isFcmConfigured = () => fcmFromEnv() !== null
