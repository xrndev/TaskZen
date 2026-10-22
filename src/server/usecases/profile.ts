import { z } from 'zod'
import { auth } from '@/lib/auth'
import type { Db } from '@/server/db'
import { ServiceError } from '@/server/services/common'
import * as svc from '@/server/services/profile'
import { saveUpload } from '@/server/storage'
import { requireFile } from './common'

const updateSchema = z.object({ full_name: z.string().optional(), avatar_url: z.string().nullable().optional() })
const passwordSchema = z.object({ password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(128) })

export const getMe = (db: Db, userId: string) => svc.getMe(db, userId)
export const updateProfile = (db: Db, userId: string, changes: unknown) => svc.updateProfile(db, userId, updateSchema.parse(changes))

export async function uploadAvatar(file: unknown) {
  const saved = await saveUpload(requireFile(file), { dir: 'avatars', maxSize: 2 * 1024 * 1024, imagesOnly: true })
  return `/api/media/${saved.key}`
}

/** Crea una contraseña para una cuenta que entró con un proveedor y aún no tiene ninguna. `headers` identifica la sesión. */
export async function setPassword(headers: Headers, input: unknown) {
  const { password } = passwordSchema.parse(input)
  try {
    await auth.api.setPassword({ body: { newPassword: password }, headers })
  } catch {
    throw new ServiceError('CONFLICT', 'No se pudo crear la contraseña. Puede que tu cuenta ya tenga una.')
  }
}
