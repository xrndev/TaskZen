/**
 * Iniciales y color estable de un avatar por defecto. Código puro, compartido por la web (`avatar.ts`) y la app nativa.
 */
export const AVATAR_PALETTE = ['#6366f1', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#64748b']

export function hash(seed: string) {
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

export const avatarColor = (id: string | null | undefined) => AVATAR_PALETTE[hash(id ?? 'none') % AVATAR_PALETTE.length]
