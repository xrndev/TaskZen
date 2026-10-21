import type { Db } from '@/server/db'
import { isInviteValid } from './invites'

/** Cookie que lleva el token de invitación durante el registro (la fija /api/invite/claim). */
export const INVITE_COOKIE = 'tz_invite'

export interface RegistrationPolicy {
  /** Registro abierto a cualquiera (ALLOW_OPEN_SIGNUP=true). Por defecto está cerrado. */
  openSignup: boolean
  /** Correos que pueden crear la primera cuenta sin invitación, solo si el proveedor los ha verificado. */
  bootstrapEmails: string[]
}

export function policyFromEnv(env: Record<string, string | undefined> = process.env): RegistrationPolicy {
  return {
    openSignup: env.ALLOW_OPEN_SIGNUP === 'true',
    bootstrapEmails: (env.BOOTSTRAP_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
  }
}

export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

/**
 * ¿Puede crearse esta cuenta? Aplica a todas las vías (contraseña, Google, Microsoft, GitHub).
 * Se permite con: registro abierto, una invitación válida, o un correo de la lista de arranque
 * que el proveedor ha verificado (con contraseña `emailVerified` es siempre falso, así que no sirve
 * para colarse escribiendo el correo de otra persona).
 */
export async function canRegister(
  db: Db,
  input: { email: string; emailVerified: boolean; inviteToken: string | null },
  policy: RegistrationPolicy = policyFromEnv(),
): Promise<boolean> {
  if (policy.openSignup) return true
  if (input.inviteToken && (await isInviteValid(db, input.inviteToken))) return true
  return input.emailVerified && policy.bootstrapEmails.includes(input.email.trim().toLowerCase())
}
