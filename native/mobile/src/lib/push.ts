import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { apiClient } from './client'

/** Debe coincidir con `channel_id` del servidor (src/server/push/fcm.ts). */
export const CHANNEL = 'avisos'
const TOKEN_KEY = 'serenboard.fcm'

// Con la app abierta también se muestra el aviso (por defecto Android lo silenciaría).
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
})

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
const agent = () => `Serenboard Android ${Platform.Version}`

async function ensureChannel() {
  // El canal debe existir antes de pedir el permiso: en Android 13+ el aviso no aparece sin canal.
  await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Avisos de tareas', importance: Notifications.AndroidImportance.HIGH })
}

export type TokenResult = { token: string } | { error: string }

/** Token de FCM de este móvil. Con `ask` pide el permiso si aún no se ha concedido. */
export async function getFcmToken(ask: boolean): Promise<TokenResult> {
  if (Platform.OS !== 'android') return { error: 'Las notificaciones de la app solo están disponibles en Android.' }
  await ensureChannel()
  let { status } = await Notifications.getPermissionsAsync()
  if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status
  if (status !== 'granted') return { error: 'No has permitido las notificaciones. Puedes cambiarlo en los ajustes de Android.' }
  try {
    const t = await Notifications.getDevicePushTokenAsync()
    return typeof t.data === 'string' ? { token: t.data } : { error: 'No se pudo obtener el identificador de este móvil.' }
  } catch {
    // Sin google-services.json en la compilación, Firebase no arranca y no hay token.
    return { error: 'Esta versión de la app no incluye las notificaciones. Instala la última desde /instalar.' }
  }
}

export const savedToken = () => SecureStore.getItemAsync(TOKEN_KEY)

/** Registra este móvil en el servidor (idempotente) y recuerda el token. */
export async function registerDevice(token: string) {
  const r = await apiClient.registerDevice({ token, userAgent: agent(), timezone: timezone() })
  await SecureStore.setItemAsync(TOKEN_KEY, token)
  return r
}

/** Quita este móvil del servidor (avisos desactivados o cierre de sesión). Nunca lanza: es "lo mejor posible". */
export async function unregisterDevice() {
  const token = await savedToken()
  if (!token) return
  await apiClient.unregisterDevice(token).catch(() => undefined)
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined)
}

/** "/board?task=<id>" → id de la tarea. */
export function taskIdFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const m = /[?&]task=([0-9a-f-]{36})/i.exec(url)
  return m ? m[1] : null
}

/**
 * Mantiene el registro al día mientras la app está abierta: el token de FCM puede cambiar, y si otra cuenta usó
 * este móvil el servidor debe asociarlo a quien ha entrado ahora. También abre la tarea de un aviso al tocarlo
 * (con la app abierta, en segundo plano o cerrada).
 */
export function usePushLifecycle(onOpenTask: (taskId: string) => void) {
  useEffect(() => {
    let alive = true
    void (async () => {
      if (!(await savedToken())) return // el usuario no ha activado los avisos en este móvil
      const t = await getFcmToken(false)
      if ('token' in t && alive) await registerDevice(t.token).catch(() => undefined)
    })()

    const refreshed = Notifications.addPushTokenListener((t) => {
      void savedToken().then((saved) => { if (saved && typeof t.data === 'string') return registerDevice(t.data) }).catch(() => undefined)
    })
    const tapped = Notifications.addNotificationResponseReceivedListener((r) => {
      const id = taskIdFromUrl(r.notification.request.content.data?.url)
      if (id) onOpenTask(id)
    })
    // Aviso que abrió la app desde cero.
    const last = Notifications.getLastNotificationResponse()
    const lastId = taskIdFromUrl(last?.notification.request.content.data?.url)
    if (lastId) onOpenTask(lastId)

    return () => { alive = false; refreshed.remove(); tapped.remove() }
  }, [onOpenTask])
}
