import { ZodError } from 'zod'
import { auth } from '@/lib/auth'
import { ServiceError, type ErrorCode } from '@/server/services/common'
import { uuid } from '@/server/schemas/tasks'

const STATUS: Record<ErrorCode, number> = { FORBIDDEN: 403, NOT_FOUND: 404, INVALID: 400, CONFLICT: 409 }

/**
 * Envoltorio común de la API HTTP para clientes nativos. Hace lo mismo que `run` en las server actions
 * (exige sesión y traduce los errores de negocio), pero con códigos HTTP y un cuerpo `{ data }` / `{ error }`.
 * La sesión llega como `Authorization: Bearer <token>` (plugin bearer de Better Auth) o como cookie.
 */
export async function api<T>(req: Request, fn: (userId: string) => Promise<T>, status = 200): Promise<Response> {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return Response.json({ error: 'Tu sesión ha caducado. Vuelve a iniciar sesión.' }, { status: 401 })
  try {
    const data = await fn(session.user.id)
    return Response.json({ data: data ?? null }, { status })
  } catch (e) {
    if (e instanceof ServiceError) return Response.json({ error: e.message, code: e.code }, { status: STATUS[e.code] })
    if (e instanceof ZodError) return Response.json({ error: e.issues[0]?.message || 'Datos no válidos.', code: 'INVALID' }, { status: 400 })
    console.error('[api]', e)
    return Response.json({ error: 'Ha ocurrido un error inesperado.' }, { status: 500 })
  }
}

/** Cuerpo JSON de la petición; un cuerpo ausente o roto es un error del cliente, no del servidor. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    throw new ServiceError('INVALID', 'El cuerpo de la petición no es JSON válido.')
  }
}

/** Identificador de la ruta. Uno mal formado se trata como inexistente (no se distingue de "no tienes acceso"). */
export function idParam(value: string): string {
  const parsed = uuid.safeParse(value)
  if (!parsed.success) throw new ServiceError('NOT_FOUND', 'No encontrado.')
  return parsed.data
}
