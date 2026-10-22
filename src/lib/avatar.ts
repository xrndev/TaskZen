/**
 * Avatar por defecto: SVG con las iniciales sobre un color estable por persona.
 * Sin servicios externos y sin peticiones de red (es un data URI).
 */
import { avatarColor, initials } from './initials'

const names = new Map<string, string>()

/** Recuerda el nombre de una persona para poder dibujar sus iniciales donde solo se conoce su id. */
export function rememberName(id: string | null | undefined, name: string | null | undefined) {
  if (id && name) names.set(id, name)
}

export function fallbackAvatar(seed: string | null | undefined, name?: string | null) {
  const id = seed ?? 'none'
  const text = initials(name ?? names.get(id))
  const color = avatarColor(id)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${color}"/>` +
    `<text x="32" y="32" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="#fff">${text.replace(/[<>&]/g, '')}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
