import { ZodError } from 'zod'
import { auth } from '@/lib/auth'
import { ServiceError, type ErrorCode } from '@/server/services/common'

const STATUS: Record<ErrorCode, number> = { FORBIDDEN: 403, NOT_FOUND: 404, INVALID: 400, CONFLICT: 409, LIMIT: 402 }

export interface EndpointContext {
  userId: string
  req: Request
  /** Segmentos dinámicos de la ruta (`[id]`, `[userId]`…), sin validar: los casos de uso los validan. */
  params: Record<string, string>
  /** Cuerpo JSON; un cuerpo ausente o roto es un error del cliente, no del servidor. */
  json: () => Promise<unknown>
  form: () => Promise<FormData>
}

type RouteContext = { params: Promise<Record<string, string>> }

/**
 * Adaptador HTTP de la API para clientes nativos (`/api/v1`). Es el equivalente de `run` en las server actions:
 * exige sesión (cookie o `Authorization: Bearer`), entrega a un caso de uso y traduce los errores de negocio a
 * códigos HTTP con un cuerpo `{ data }` / `{ error, code }`. No contiene reglas: esas viven en `server/usecases`.
 */
export function endpoint<T>(handler: (c: EndpointContext) => Promise<T>, status = 200) {
  return async (req: Request, ctx?: RouteContext): Promise<Response> => {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session) return Response.json({ error: 'Tu sesión ha caducado. Vuelve a iniciar sesión.' }, { status: 401 })
    try {
      const data = await handler({
        userId: session.user.id,
        req,
        params: (await ctx?.params) ?? {},
        json: async () => {
          try {
            return await req.json()
          } catch {
            throw new ServiceError('INVALID', 'El cuerpo de la petición no es JSON válido.')
          }
        },
        form: () => req.formData(),
      })
      return Response.json({ data: data ?? null }, { status })
    } catch (e) {
      if (e instanceof ServiceError) return Response.json({ error: e.message, code: e.code }, { status: STATUS[e.code] })
      if (e instanceof ZodError) return Response.json({ error: e.issues[0]?.message || 'Datos no válidos.', code: 'INVALID' }, { status: 400 })
      console.error('[api]', e)
      return Response.json({ error: 'Ha ocurrido un error inesperado.' }, { status: 500 })
    }
  }
}
