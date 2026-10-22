'use server'

import { z } from 'zod'
import { db } from '@/server/db'
import { getPushSender, vapidFromEnv } from '@/server/push/webpush'
import { ServiceError } from '@/server/services/common'
import * as svc from '@/server/services/notifications'
import { run } from './run'

const prefsSchema = z.object({
  enabled: z.boolean(),
  due_soon: z.boolean(),
  assigned: z.boolean(),
  offsets_minutes: z.array(z.number().int()).max(svc.MAX_OFFSETS),
  quiet_start: z.string().nullable(),
  quiet_end: z.string().nullable(),
  timezone: z.string().min(1).max(64),
})

const subscriptionSchema = z.object({
  endpoint: z.string().min(1).max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
})

/** Estado para la pantalla de ajustes: clave pública, preferencias y número de dispositivos. */
export async function getNotificationStateAction() {
  return run(async (u) => ({
    publicKey: vapidFromEnv()?.publicKey ?? null,
    prefs: await svc.getPrefs(db, u),
    devices: await svc.countActiveEndpoints(db, u),
    allowedOffsets: [...svc.ALLOWED_OFFSETS],
  }))
}

/** Registra este dispositivo y, la primera vez, enciende las notificaciones. */
export async function savePushSubscriptionAction(subscription: z.input<typeof subscriptionSchema>, userAgent: string | null, timezone: string) {
  return run(async (u) => {
    const sub = subscriptionSchema.parse(subscription)
    await svc.saveEndpoint(db, u, { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent })
    const prefs = await svc.getPrefs(db, u)
    if (!prefs.enabled) await svc.savePrefs(db, u, { ...prefs, enabled: true, timezone: z.string().max(64).parse(timezone) })
    return { devices: await svc.countActiveEndpoints(db, u) }
  })
}

/** Quita este dispositivo; si era el último, apaga las notificaciones. */
export async function removePushSubscriptionAction(endpoint: string) {
  return run(async (u) => {
    await svc.removeEndpoint(db, u, z.string().max(1000).parse(endpoint))
    const devices = await svc.countActiveEndpoints(db, u)
    if (devices === 0) {
      const prefs = await svc.getPrefs(db, u)
      if (prefs.enabled) await svc.savePrefs(db, u, { ...prefs, enabled: false })
    }
    return { devices }
  })
}

export async function updateNotificationPrefsAction(input: z.input<typeof prefsSchema>) {
  return run((u) => svc.savePrefs(db, u, prefsSchema.parse(input)))
}

export async function sendTestPushAction() {
  return run(async (u) => {
    const sender = getPushSender()
    if (!sender) throw new ServiceError('INVALID', 'Las notificaciones no están configuradas en el servidor.')
    return svc.sendTestNotification(db, sender, u)
  })
}
