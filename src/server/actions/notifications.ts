'use server'

import { db } from '@/server/db'
import * as uc from '@/server/usecases/notifications'
import { run } from './run'

/** Estado para la pantalla de ajustes: clave pública, preferencias y número de dispositivos. */
export async function getNotificationStateAction() {
  return run((u) => uc.getState(db, u))
}

/** Registra este navegador y, la primera vez, enciende las notificaciones. */
export async function savePushSubscriptionAction(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string | null, timezone: string) {
  return run((u) => uc.subscribe(db, u, { ...subscription, userAgent, timezone }))
}

/** Quita este dispositivo; si era el último, apaga las notificaciones. */
export async function removePushSubscriptionAction(endpoint: string) {
  return run((u) => uc.unregister(db, u, { endpoint }))
}

export async function updateNotificationPrefsAction(input: uc.PrefsInput) {
  return run((u) => uc.updatePrefs(db, u, input))
}

export async function sendTestPushAction() {
  return run((u) => uc.sendTest(db, u))
}
