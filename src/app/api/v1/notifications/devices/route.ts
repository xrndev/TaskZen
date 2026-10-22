import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/notifications'

export const dynamic = 'force-dynamic'

/** App nativa: registra el token de FCM del móvil. DELETE lo quita (cierre de sesión o avisos desactivados). */
export const POST = endpoint(async ({ userId, json }) => uc.registerDevice(db, userId, await json()), 201)
export const DELETE = endpoint(async ({ userId, json }) => uc.unregister(db, userId, await json()))
