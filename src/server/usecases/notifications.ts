import { z } from 'zod'
import type { Db } from '@/server/db'
import { fcmFromEnv } from '@/server/push/fcm'
import { getPushSender } from '@/server/push/sender'
import { vapidFromEnv } from '@/server/push/webpush'
import { ServiceError } from '@/server/services/common'
import { assertCanSetReminderOffsets, userLimits } from '@/server/services/billing'
import * as svc from '@/server/services/notifications'

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
  userAgent: z.string().nullish(),
  timezone: z.string().max(64),
})

const deviceSchema = z.object({ token: z.string().min(1).max(4096), userAgent: z.string().nullish(), timezone: z.string().max(64) })
const removeSchema = z.object({ endpoint: z.string().min(1).max(4096) })

export type PrefsInput = z.input<typeof prefsSchema>
export type SubscriptionInput = z.input<typeof subscriptionSchema>

/** Estado para la pantalla de ajustes: qué canales hay en el servidor, preferencias y número de dispositivos. */
export async function getState(db: Db, userId: string) {
  return {
    publicKey: vapidFromEnv()?.publicKey ?? null,
    fcm: fcmFromEnv() !== null,
    prefs: await svc.getPrefs(db, userId),
    devices: await svc.countActiveEndpoints(db, userId),
    allowedOffsets: [...svc.ALLOWED_OFFSETS],
    maxOffsets: (await userLimits(db, userId)).maxReminderOffsets,
  }
}

/** La primera vez que se registra un dispositivo se encienden las notificaciones (opt-in explícito). */
async function enableOnFirstDevice(db: Db, userId: string, timezone: string) {
  const prefs = await svc.getPrefs(db, userId)
  if (!prefs.enabled) await svc.savePrefs(db, userId, { ...prefs, enabled: true, timezone })
  return { devices: await svc.countActiveEndpoints(db, userId) }
}

/** Navegador: suscripción Web Push. */
export async function subscribe(db: Db, userId: string, input: unknown) {
  const { endpoint, keys, userAgent, timezone } = subscriptionSchema.parse(input)
  await svc.saveEndpoint(db, userId, { endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent })
  return enableOnFirstDevice(db, userId, timezone)
}

/** App nativa: token de FCM. */
export async function registerDevice(db: Db, userId: string, input: unknown) {
  if (!fcmFromEnv()) throw new ServiceError('INVALID', 'Las notificaciones de la app no están configuradas en el servidor.')
  const { token, userAgent, timezone } = deviceSchema.parse(input)
  await svc.saveDevice(db, userId, { token, userAgent })
  return enableOnFirstDevice(db, userId, timezone)
}

/** Quita un dispositivo (suscripción o token); si era el último, apaga las notificaciones. */
export async function unregister(db: Db, userId: string, input: unknown) {
  await svc.removeEndpoint(db, userId, removeSchema.parse(input).endpoint)
  const devices = await svc.countActiveEndpoints(db, userId)
  if (devices === 0) {
    const prefs = await svc.getPrefs(db, userId)
    if (prefs.enabled) await svc.savePrefs(db, userId, { ...prefs, enabled: false })
  }
  return { devices }
}

export async function updatePrefs(db: Db, userId: string, input: unknown) {
  const prefs = prefsSchema.parse(input)
  await assertCanSetReminderOffsets(db, userId, new Set(prefs.offsets_minutes).size, (await svc.getPrefs(db, userId)).offsets_minutes.length)
  return svc.savePrefs(db, userId, prefs)
}

export async function sendTest(db: Db, userId: string) {
  const sender = getPushSender()
  if (!sender) throw new ServiceError('INVALID', 'Las notificaciones no están configuradas en el servidor.')
  return svc.sendTestNotification(db, sender, userId)
}
