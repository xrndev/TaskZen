/**
 * Datos de las páginas legales (política de privacidad y condiciones del servicio).
 * La identidad del responsable no está en el repositorio: se define en el `.env` del servidor y se lee en cada
 * petición (las páginas son dinámicas), así que cambiarla no exige reconstruir la imagen.
 */
export const PRIVACY_PATH = '/privacidad'
export const TERMS_PATH = '/terminos'

/** Fecha de la última revisión de los textos. Cámbiala cada vez que se modifiquen. */
export const LEGAL_UPDATED = '23 de octubre de 2026'

export interface LegalInfo {
  /** Nombre y apellidos o razón social de quien presta el servicio. */
  owner: string | null
  /** Correo para ejercer derechos y para cualquier consulta legal. */
  email: string | null
  /** NIF/NIE/CIF (opcional). */
  taxId: string | null
  /** Domicilio de contacto (opcional). */
  address: string | null
  /** Dirección pública del servicio, por ejemplo `taskzen.duckdns.org`. */
  site: string
}

export function legalInfo(env: Record<string, string | undefined> = process.env): LegalInfo {
  const clean = (v: string | undefined) => v?.trim() || null
  let site = 'este sitio'
  try {
    if (env.BETTER_AUTH_URL) site = new URL(env.BETTER_AUTH_URL).host
  } catch {
    // dirección mal escrita: se deja el texto genérico
  }
  return { owner: clean(env.LEGAL_OWNER_NAME), email: clean(env.LEGAL_CONTACT_EMAIL), taxId: clean(env.LEGAL_OWNER_TAX_ID), address: clean(env.LEGAL_ADDRESS), site }
}
