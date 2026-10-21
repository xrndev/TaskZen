'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * ¿El navegador admite passkeys? En el servidor devuelve false y en el cliente el valor real,
 * sin provocar el error de hidratación que daría leer `window` directamente al renderizar.
 */
export function usePasskeySupport() {
  return useSyncExternalStore(
    subscribe,
    () => typeof window.PublicKeyCredential !== 'undefined',
    () => false,
  )
}
