/**
 * Avatar por defecto: SVG con las iniciales sobre un color estable por persona.
 * Sin servicios externos y sin peticiones de red (es un data URI).
 */
const names = new Map<string, string>()

/** Recuerda el nombre de una persona para poder dibujar sus iniciales donde solo se conoce su id. */
export function rememberName(id: string | null | undefined, name: string | null | undefined) {
  if (id && name) names.set(id, name)
}

const PALETTE = ['#6366f1', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#64748b']

function hash(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = Array.from(parts[0])[0]
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : ''
  return (first + last).toUpperCase()
}

export function fallbackAvatar(seed: string | null | undefined, name?: string | null) {
  const id = seed ?? 'none'
  const text = initials(name ?? names.get(id))
  const color = PALETTE[hash(id) % PALETTE.length]
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${color}"/>` +
    `<text x="32" y="32" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="#fff">${text.replace(/[<>&]/g, '')}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
