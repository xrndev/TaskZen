import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/columns'

export const dynamic = 'force-dynamic'

export const PATCH = endpoint(async ({ userId, params, json }) => uc.updateColumn(db, userId, params.id, await json()))
// El cuerpo es opcional: indica a qué columna se mueven las tareas.
export const DELETE = endpoint(async ({ userId, params, json }) => uc.deleteColumn(db, userId, params.id, await json().catch(() => ({}))))
