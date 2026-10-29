/** Dirección pública del sitio (sin barra final). La misma variable que usa Better Auth. */
export function siteUrl(env: Record<string, string | undefined> = process.env): URL {
  try {
    return new URL(env.BETTER_AUTH_URL || 'http://localhost:3000')
  } catch {
    return new URL('http://localhost:3000')
  }
}

/** Páginas públicas que tiene sentido indexar. Todo lo demás (tablero, login, invitaciones, admin) queda fuera. */
export const PUBLIC_PATHS = ['/', '/precios', '/instalar', '/terminos', '/privacidad'] as const
