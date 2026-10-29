import { ZodError } from 'zod'
import { ServiceError } from '@/server/services/common'
import { getSession } from '@/server/session'

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: 'LIMIT'; scope?: 'user' | 'team' }

/**
 * Envoltorio común de las server actions: exige sesión y convierte los errores de negocio en
 * un resultado serializable (Next oculta el mensaje de las excepciones en producción).
 */
export async function run<T>(fn: (userId: string) => Promise<T>): Promise<Result<T>> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'Tu sesión ha caducado. Vuelve a iniciar sesión.' }
  try {
    return { ok: true, data: await fn(session.user.id) }
  } catch (e) {
    if (e instanceof ServiceError) return e.code === 'LIMIT' ? { ok: false, error: e.message, code: 'LIMIT', scope: e.scope } : { ok: false, error: e.message }
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message || 'Datos no válidos.' }
    console.error('[action]', e)
    return { ok: false, error: 'Ha ocurrido un error inesperado.' }
  }
}
