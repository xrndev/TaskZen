'use client'

import { useSyncExternalStore } from 'react'

export interface PushEnvironment {
  /** El navegador sabe de service workers, Push y Notification. */
  supported: boolean
  isIOS: boolean
  /** Abierta desde el icono de la pantalla de inicio (iPhone solo admite push así). */
  standalone: boolean
}

const SERVER: PushEnvironment = { supported: false, isIOS: false, standalone: false }
let cached: PushEnvironment | null = null

function read(): PushEnvironment {
  if (cached) return cached
  const nav = navigator as Navigator & { standalone?: boolean }
  cached = {
    supported: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    standalone: window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
  }
  return cached
}

const subscribe = () => () => {}

/** Capacidades de notificación del navegador, sin errores de hidratación (en el servidor todo es falso). */
export function usePushEnvironment(): PushEnvironment {
  return useSyncExternalStore(subscribe, read, () => SERVER)
}

/** La clave pública VAPID viaja en base64url; el navegador la quiere como bytes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
