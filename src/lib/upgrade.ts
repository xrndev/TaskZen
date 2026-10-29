import { toast } from './toast'

/**
 * Cuando una acción choca con el límite del plan no se muestra un simple error: se ofrece mejorar justo en ese
 * momento (el diálogo `UpgradeDialog`), que es donde más sentido tiene. Mismo patrón de eventos que `toast`.
 */
export type UpgradeScope = 'user' | 'team'
export interface UpgradeRequest {
  message: string
  /** Qué plan habría que mejorar: el de la persona o el del equipo. */
  scope: UpgradeScope
}

type Listener = (r: UpgradeRequest) => void
const listeners = new Set<Listener>()

export function showUpgrade(r: UpgradeRequest) {
  listeners.forEach((fn) => fn(r))
}

export function subscribeUpgrade(fn: Listener) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Muestra el error de una acción: los límites del plan abren el diálogo de mejora; el resto, un aviso. */
export function reportError(r: { error: string; code?: string; scope?: UpgradeScope }) {
  if (r.code === 'LIMIT') showUpgrade({ message: r.error, scope: r.scope ?? 'user' })
  else toast.error(r.error)
}

/** Abre el perfil (plan personal) o los ajustes del equipo actual (plan del equipo); lo escucha el tablero. */
export const OPEN_SETTINGS_EVENT = 'serenboard:open-settings'
export function openSettings(target: 'profile' | 'team') {
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT, { detail: target }))
}
